# TrueNorth — every gate runs through this file.
# CI and the Pages deploy call these targets and nothing else, so a green
# `make` locally is the same check a pull request gets.

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help
.PHONY: help setup lint typecheck test test-e2e test-perf test-a11y \
        assets check-assets check-textures validate-content verify-content verify-art build preview clean \
        check-obligations

help: ## List every target
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies and the Playwright browser
	npm ci
	npx playwright install --with-deps chromium

lint: ## ESLint, the dependency-cruiser architecture rules, the ADR-0009 obligation gate
	npm run lint

# `lint` carries the obligation gate (ADR-0009) as its last step, so it runs in
# the pull-request gate set and again before a deploy publishes. That gate reads
# the clock: it can fail on a commit that passed yesterday, because an
# obligation in docs/ fell due overnight. That is the decision, not a bug -- see
# the message it prints. This target runs it alone, for when that is all you
# want to look at.
check-obligations: ## ADR-0009: dated obligations in docs/ are discharged, voided, or not yet due
	npm run check-obligations

typecheck: ## TypeScript strict typecheck, no emit
	npm run typecheck

test: ## Vitest unit and integration tests with coverage thresholds
	npm run test

# ONE BROWSER SUITE AT A TIME, per checkout. The guard is in the npm scripts
# these targets call (scripts/browser-suite-lock.sh), NOT here, so that
# `npm run test:e2e` is covered too and so that nothing takes the lock twice and
# waits for itself.
#
# scripts/browser-suite-lock.sh has the full diagnosis. The short version: two
# Playwright runs in one working tree delete each other's artefacts -- the second
# wipes test-results/ at startup and both reuse the same
# `.playwright-artifacts-<n>` paths -- so the first starts failing with
# "browserContext.close: ENOENT ... traces/<id>-recording<n>.trace" and no
# assertion anywhere. Measured with `--trace off` as well: the runs still fail,
# as timeouts, because eight SwiftShader browsers on one CPU cannot satisfy
# assertions stated in seconds.
#
# `npx playwright test --config ...` typed directly BYPASSES this and will still
# corrupt a run that is already going. It cannot be guarded from inside the
# config: Playwright deletes outputDir in `createRemoveOutputDirsTask`, which
# runs BEFORE `globalSetup`, so by the time any hook of ours could refuse, the
# other run's artefacts are already gone. Use these targets.
test-e2e: ## Playwright end-to-end suite against the production build
	npm run test:e2e

test-perf: ## Playwright performance-budget suite
	npm run test:perf

test-a11y: ## Playwright axe-core accessibility suite
	npm run test:a11y

assets: ## Build assets/dist from assets/src, then hold both per-level budgets
	npm run assets

# `assets` already runs both gates over what it just built, in the same process
# and under the same exit code, so there is no way to build assets and skip them.
# These targets run them alone, for when that is all you want to look at, or to
# re-check a dist/ that `make build` produced:
#     npm run check-level-payload  -- --dir dist --source dist --no-scan-root
#     npm run check-texture-memory -- --dir dist --source dist
#
# Two targets because they are two quantities, not two views of one. `check-assets`
# weighs what a player DOWNLOADS; `check-textures` weighs what the GPU HOLDS, which
# is width x height x 4 and has nothing to do with how well WebP compressed it. A
# level can pass the first at 3 MB and fail the second at 130 MB -- that is how this
# project's predecessor lost a WebGL context, on a device that had reported every
# capability as available.
check-assets: ## budgets.levelPayloadBytes, over assets/dist/manifest.json
	npm run check-level-payload

check-textures: ## Decoded texture memory per level vs textureBudgetBytes and the 64 MiB cap
	npm run check-texture-memory

validate-content: ## Validate every content file against its JSON Schema
	npm run validate-content

# THE SEPARATION-OF-DUTIES GATE LIVES HERE, and it reads git history, so this
# target needs the history to be present. Both workflows set `fetch-depth: 0` on
# their checkout for that reason and the script refuses to run on a shallow clone
# rather than report green over commits it cannot see.
#
# It does NOT fetch canada.ca. A live check is a judgement recorded by a named
# checker in a source register's `liveChecks[]` (ADR-0016); a CI job that fetched
# a page and wrote its own finding would be granting itself the attestation the
# separation of duties exists to withhold. This target reads the record.
verify-content: ## ADR-0003/ADR-0016: separation of duties, the CI clause, the re-check table
	npm run verify-content

verify-art: ## Verify art against the style guide and references
	npm run verify-art

build: validate-content ## Validate content, build the site, then check the artefact
	npm run build
	node scripts/deploy-check.mjs

# `sync-workflows` used to live here, copying infra/github/workflows into
# .github/workflows. Both the target and the mirror are gone: .github/workflows
# is the only copy and is edited directly. infra/README.md explains why.

preview: ## Serve the production build locally
	npm run preview

clean: ## Remove build, coverage and test output
	rm -rf dist coverage playwright-report test-results .vite
