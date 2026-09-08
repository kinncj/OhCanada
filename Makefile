# TrueNorth — every gate runs through this file.
# CI and the Pages deploy call these targets and nothing else, so a green
# `make` locally is the same check a pull request gets.

SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help
.PHONY: help setup lint typecheck test test-e2e test-perf test-a11y \
        assets validate-content verify-content verify-art build preview clean

help: ## List every target
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

setup: ## Install dependencies and the Playwright browser
	npm ci
	npx playwright install --with-deps chromium

lint: ## ESLint plus the dependency-cruiser architecture rules
	npm run lint

typecheck: ## TypeScript strict typecheck, no emit
	npm run typecheck

test: ## Vitest unit and integration tests with coverage thresholds
	npm run test

test-e2e: ## Playwright end-to-end suite against the production build
	npm run test:e2e

test-perf: ## Playwright performance-budget suite
	npm run test:perf

test-a11y: ## Playwright axe-core accessibility suite
	npm run test:a11y

assets: ## Build assets/dist from assets/src
	npm run assets

validate-content: ## Validate every content file against its JSON Schema
	npm run validate-content

verify-content: ## Verify questions against the Discover Canada sources
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
