#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${LIQUIDFLOW_REPO_URL:-https://github.com/SPhillips1337/LiquidFlow.git}"
DEFAULT_DIR="LiquidFlow"
INSTALL_DIR="${1:-${LIQUIDFLOW_INSTALL_DIR:-$DEFAULT_DIR}}"
BRANCH="${LIQUIDFLOW_BRANCH:-main}"

log() { printf '[LiquidFlow install] %s\n' "$*"; }
fail() { printf '[LiquidFlow install] ERROR: %s\n' "$*" >&2; exit 1; }
need_cmd() { command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' was not found in PATH."; }

validate_project_dir() {
  local dir="$1"
  [ -d "$dir" ] || fail "Directory '$dir' does not exist."
  [ -f "$dir/package.json" ] || fail "'$dir' is missing package.json; refusing to install into an unrelated directory."
  [ -f "$dir/reader/package.json" ] || fail "'$dir' is missing reader/package.json; refusing to install into an unrelated directory."
  [ -f "$dir/pipeline/package.json" ] || fail "'$dir' is missing pipeline/package.json; refusing to install into an unrelated directory."

  node -e '
    const fs = require("fs");
    const root = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const reader = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
    const pipeline = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
    if (root.name !== "liquidflow" || reader.name !== "liquidflow-reader" || pipeline.name !== "liquidflow-pipeline") {
      process.exit(1);
    }
  ' "$dir/package.json" "$dir/reader/package.json" "$dir/pipeline/package.json" \
    || fail "Project identity check failed; refusing to install into '$dir'."

  if git -C "$dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local origin
    origin="$(git -C "$dir" remote get-url origin 2>/dev/null || true)"
    case "$origin" in
      git@github.com:SPhillips1337/LiquidFlow.git|https://github.com/SPhillips1337/LiquidFlow.git|https://github.com/SPhillips1337/LiquidFlow) ;;
      "") log "No origin remote configured; project markers passed." ;;
      *) fail "Existing directory origin '$origin' does not match SPhillips1337/LiquidFlow." ;;
    esac
  fi
}

need_cmd git
need_cmd node
need_cmd npm

case "${INSTALL_DIR:-}" in
  ""|"/"|"."|"..") fail "Unsafe install directory '$INSTALL_DIR'. Pass a project directory path." ;;
esac

if [ -d "$INSTALL_DIR/.git" ]; then
  log "Using existing git checkout: $INSTALL_DIR"
  validate_project_dir "$INSTALL_DIR"
elif [ -e "$INSTALL_DIR" ]; then
  log "Using existing project directory: $INSTALL_DIR"
  validate_project_dir "$INSTALL_DIR"
else
  log "Cloning $REPO_URL into $INSTALL_DIR (branch: $BRANCH)"
  if ! git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$INSTALL_DIR"; then
    [ "$BRANCH" = "main" ] || fail "Unable to clone requested branch '$BRANCH'."
    log "Branch 'main' was unavailable; retrying repository default branch clone."
    git clone "$REPO_URL" "$INSTALL_DIR"
  fi
  validate_project_dir "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

log "Installing npm workspace dependencies with npm ci when possible."
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

if command -v ollama >/dev/null 2>&1; then
  log "Ollama detected. Optional models can be pulled with: ollama pull llama3:latest && ollama pull granite4:3b"
else
  log "Ollama not detected. Install it from https://ollama.com/ for AI lookup and ingestion features."
fi

log "Running TypeScript/Vite production build."
npm run build

log "Install complete. Start the reader with: cd $(pwd) && npm run dev"
