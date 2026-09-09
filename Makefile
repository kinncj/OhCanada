# TrueNorth — every gate runs through this file.
# CI and the Pages deploy call these targets and nothing else, so a green
# `make` locally is the same check a pull request gets.

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help
.PHONY: help setup lint typecheck test test-e2e test-perf test-a11y \
        assets check-assets check-textures validate-content verify-content verify-art art-handoff art-handoff-blind build preview clean \
        check-obligations sources

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
# ONE CLASS OF WORD THIS FILE MAY NOT CONTAIN, and "DEVICE" below is not a
# stylistic choice. `verify-art` hands an identifier a directory of hashed
# images and asks it to name what it sees. A subject id, a render filename or a
# candidate answer spelled anywhere the identifier plausibly looks turns an
# open-set identification into a multiple-choice one -- and a run that leaked
# produces output identical to a clean one, so there is nothing to notice
# afterwards. This file is one of those places: it is the target the identifier
# was told to run. tests/unit/infra/art-handoff-gate.test.ts asserts it against
# the real contract, so a word that becomes a subject id later fails here on the
# day it does.
#
# Two targets because they are two quantities, not two views of one. `check-assets`
# weighs what a DEVICE DOWNLOADS; `check-textures` weighs what the GPU HOLDS, which
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

# THIS TARGET RUNS A COMMAND RECORDED IN A CONTENT FILE, and it is NOT in CI or
# in the deploy, on purpose.
#
# `content/sources/<id>.json` records `extractedTextSha256`, and every question's
# `source.sourceHash` IS that digest. Until 2026-09-09 the register said nothing
# about how the extraction was made, so a contributor could fetch the right PDF,
# match its `sha256` exactly, and still be unable to produce a `.txt` that hashed
# to the recorded value -- which left the verbatim, quote-contiguity and evidence
# checks unrunnable for anyone who did not already have the file. The register
# now carries `extraction`: the tool, its version and the exact command. This
# runs that command and compares the result with the digest, so the record is
# checked rather than described.
#
# The command is run through `sh -c` from the repository root. It must write to
# STDOUT -- nothing passes it an output path -- and a command containing `>`, `;`,
# `&&`, `||`, a backtick or `$(...)` is refused both here and by
# content/schemas/source.schema.json. Bytes reach content/ only under `--write`.
#
# Not in CI because the documents are git-ignored (Crown copyright, ADR-0004):
# there is nothing there for it to read, and a workflow that executed a string
# out of a content file would buy a supply-chain hole in exchange for a check
# that cannot run. `content/sources/README.md` promised this target since slice 1
# and it did not exist; that is what this is.
#
#     npm run sources -- --write              re-derive and write the .txt
#     npm run sources -- --require-recorded   fail on an extraction with no
#                                             recorded command (5 of 7 today)
sources: ## Re-derive each cached extraction from its document and check the digest
	npm run sources

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

# THE ART GATE IS A HARNESS, NOT AN IDENTIFIER, and the distinction is the whole
# task. Naming what a render depicts is the art-verifier's judgement; a
# `verify-art` that answered its own question would be the machine equivalent of
# an author verifying their own question, which ADR-0003 forbids for people. So
# a verdict comes IN as data and this scores it against assets/refs/references.json.
#
# What this target establishes, every run:
#   - an ANONYMISED HAND-OFF can still be built from today's tree. Every subject
#     rasterises, every composite assembles, no render source draws text, no
#     handed-over file carries a token that names a subject, no PNG carries
#     metadata, and every render is named after sixteen hex characters.
#
# What it does NOT establish: that any identification was made blind. The first
# real pass (2026-09-08) COULD NOT run blind -- it had to locate the renders to
# rasterise them, and the source listing spells a subject out in a filename --
# and it marked every verdict untrusted rather than report a pass it could not
# stand behind. Nothing in this file names a subject, for the same reason: the
# SECOND run leaked through operator-facing text rather than through the images. Only the hand-off can give blindness, and only if it
# holds in use. BLINDNESS LEAKS SILENTLY: a leaked run's output is identical to a
# clean one's, which is why this target prints what it did not prove alongside
# what it did, and never a bare OK.
#
# There is no scored verdict record yet -- docs/art-verification.json is that
# hand pass and says of itself `blindnessHeld: false` -- so the gate reports
# `identification: NOT ESTABLISHED` and exits 0 on the half it can prove.
# `--require-identification` makes the missing record a failure, and is the
# one-flag change that makes this fully gating once a clean run is recorded.
verify-art: ## Build + leak-check the blind hand-off, and score any recorded verdict
	npm run verify-art

# TWO TARGETS, AND PICKING THE WRONG ONE COSTS THE RUN.
#
# Both build the directory the identifier is handed and the keymap it must not
# be. They differ only in what they PRINT, and that turned out to be where the
# second real run leaked: `art-handoff` named two of the three subjects in its
# own progress output, and the identifier had read them before it saw a pixel.
# The images were clean the whole time. The terminal was not.
#
#   art-handoff        loud. Names each subject as it builds. For someone running
#                      it FOR an identifier, who may read anything.
#   art-handoff-blind  quiet. Counts, totals and the run id, and no subject id
#                      anywhere. Safe to run AS the identifier when there is no
#                      second party -- which is the situation that produced the
#                      leak, because the old advice ("run this for the identifier,
#                      not as it") was correct and impossible to follow alone.
#
# Two separate temp roots by default, so the keymap is not even a sibling an idle
# `ls ..` would turn up. Override with OUT= and KEYMAP=. A non-empty output
# directory is REFUSED, not overwritten: two runs side by side relink by file
# size and by count what the salt renamed. Pass --force to clear one.
art-handoff: ## Build an anonymised hand-off FOR an identifier (names subjects as it builds)
	@out="$${OUT:-$$(mktemp -d -t truenorth-art-handoff-XXXXXX)}"; \
	 key="$${KEYMAP:-$$(mktemp -d -t truenorth-art-keymap-XXXXXX)/keymap.json}"; \
	 node scripts/verify-art.mjs handoff --out "$$out" --keymap "$$key"

art-handoff-blind: ## Same, printing no subject id: safe to run AS the identifier
	@out="$${OUT:-$$(mktemp -d -t truenorth-art-handoff-XXXXXX)}"; \
	 key="$${KEYMAP:-$$(mktemp -d -t truenorth-art-keymap-XXXXXX)/keymap.json}"; \
	 node scripts/verify-art.mjs handoff --quiet --out "$$out" --keymap "$$key"

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
