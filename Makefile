SHELL := /bin/sh
IMAGE_NAME ?= ghcr.io/kn990x/easypages

# `corepack pnpm` resolves the version pinned by `packageManager` in package.json, so the
# image, CI and a development machine all agree without anyone installing pnpm globally.
PNPM ?= corepack pnpm

.PHONY: setup dev dev-ui build up lint test check image clean-data

setup:
	$(PNPM) install --frozen-lockfile
	@echo "Done. Copy .env.example to .env and fill in CF_API_TOKEN."
	@echo "The operator account is created in the browser the first time you open EasyPages."

# API on 8002. The data directory defaults to ./data, so deleting it gives you the setup
# wizard from scratch (see clean-data).
dev:
	$(PNPM) run dev

# Vite on 5173, proxying /api, /login and /logout to 8002. Run alongside `make dev`.
dev-ui:
	$(PNPM) run dev:ui

build:
	$(PNPM) run build

up:
	docker compose up -d

image:
	docker build -t $(IMAGE_NAME) -t easypages:local .

lint:
	$(PNPM) run lint

# Build first: the integration suite boots the real app and asserts the SPA shell is
# served, which needs dist/ to exist.
test: build
	$(PNPM) test

check:
	$(PNPM) run check

# Back to a fresh install: removes the credential and the session secret.
clean-data:
	rm -rf data
	@echo "Data directory removed. The setup wizard will run again on next start."
