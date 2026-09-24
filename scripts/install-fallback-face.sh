#!/usr/bin/env bash
# Install the face the readability sweep's fallback tier measures (ADR-0066 §4e).
#
# tests/a11y/readability.spec.ts runs the HUD sweep a second time with the web
# font disabled, against DejaVu Sans. That tier asserts it is really drawing
# DejaVu Sans (a recorded reference width) and fails loudly if not, so an image
# without the face fails the run instead of quietly measuring something else.
# That failure would be correct and useless, so the face is installed here, next
# to the browser, by the same `make browsers` that CI's prepare action runs.
#
# Idempotent: present means nothing to do. The Ubuntu package is
# fonts-dejavu-core (2.37 on ubuntu-24.04, the runner image). apt's lists are
# fresh because `playwright install --with-deps` ran `apt-get update` just before
# this, but a missing package still refreshes them once, so a local machine
# with stale lists is not a special case.
set -euo pipefail

if command -v fc-list >/dev/null 2>&1 && [ -n "$(fc-list ':family=DejaVu Sans' family)" ]; then
  echo "fallback face: DejaVu Sans is installed ($(fc-list ':family=DejaVu Sans:style=Book' file | head -n 1 | tr -d ':'))"
  exit 0
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "error: DejaVu Sans is not installed and there is no apt-get to install it." >&2
  echo "       Install the DejaVu Sans font by hand; the readability sweep's fallback tier needs it (ADR-0066 §4e)." >&2
  exit 1
fi

sudo_cmd=()
if [ "$(id -u)" -ne 0 ]; then sudo_cmd=(sudo); fi
"${sudo_cmd[@]}" apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig \
  || { "${sudo_cmd[@]}" apt-get update -qq && "${sudo_cmd[@]}" apt-get install -y --no-install-recommends fonts-dejavu-core fontconfig; }
fc-cache -f >/dev/null 2>&1 || true

if [ -z "$(fc-list ':family=DejaVu Sans' family)" ]; then
  echo "error: fonts-dejavu-core installed, but fontconfig still does not list DejaVu Sans." >&2
  exit 1
fi
echo "fallback face: DejaVu Sans installed"
