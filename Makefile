# TrueNorth — CI calls only these targets.
SHELL := /bin/bash
.DEFAULT_GOAL := help
NPM ?= npm

.PHONY: help setup lint typecheck test test-e2e test-perf assets validate-content build preview deploy-check clean

help: ## List targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-18s %s\n", $$1, $$2}'

setup: ## Install dependencies (uses lockfile) and browsers for e2e
	$(NPM) ci
	npx playwright install --with-deps chromium

lint: ## ESLint + dependency-cruiser architecture rules
	$(NPM) run lint

typecheck: ## TypeScript strict typecheck
	$(NPM) run typecheck

test: ## Unit + integration tests with coverage gates
	$(NPM) run test

test-e2e: ## Playwright smoke tests against a production build
	$(NPM) run test:e2e

test-perf: ## Payload budget + frame-time checks
	$(NPM) run test:perf

assets: ## Idempotent asset pipeline (gltf-transform + ktx2) into assets/dist
	$(NPM) run assets

validate-content: ## Ajv-validate all content JSON, asset credits, volatile-fact freshness
	$(NPM) run validate-content

build: validate-content ## Production build into dist/
	$(NPM) run build

preview: ## Serve the production build locally
	$(NPM) run preview

deploy-check: ## Verify dist/ is deployable to GitHub Pages (base path, 404.html, size limits)
	$(NPM) run deploy-check

clean:
	rm -rf dist coverage playwright-report test-results
