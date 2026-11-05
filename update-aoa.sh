#!/usr/bin/env bash
# update-aoa.sh — move the AOA submodule external/aoa to another commit and relock the workspace.
#
# The version of AOA this repository builds with is the submodule's commit, not a version on PyPI.
# The script moves external/aoa to the ref asked for, stages the new pointer and rebuilds uv.lock.
# It commits nothing: the submodule and uv.lock go into one commit of their own.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AOA_DIR="$ROOT/external/aoa"
REF="origin/main"

usage() {
    cat <<'EOF'
Usage: ./update-aoa.sh [<ref>]

Moves external/aoa to <ref> (a commit, tag or branch of AOA; origin/main by default),
stages the submodule pointer and rebuilds uv.lock.

Examples:
  ./update-aoa.sh
  ./update-aoa.sh 00b174e2a
EOF
}

case "${1:-}" in
    -h|--help) usage; exit 0 ;;
    -*) echo "update-aoa.sh: unknown flag: $1" >&2; usage >&2; exit 2 ;;
    "") ;;
    *) REF="$1" ;;
esac

if [[ ! -e "$AOA_DIR/.git" ]]; then
    echo "update-aoa.sh: external/aoa is not initialised; run: git submodule update --init" >&2
    exit 1
fi
if [[ -n "$(git -C "$AOA_DIR" status --porcelain)" ]]; then
    echo "update-aoa.sh: external/aoa has uncommitted changes; AOA is changed in its own repository:" >&2
    git -C "$AOA_DIR" status --short >&2
    exit 1
fi

git -C "$AOA_DIR" fetch --tags --force --prune origin
if ! TARGET="$(git -C "$AOA_DIR" rev-parse --verify --quiet "${REF}^{commit}")"; then
    if ! TARGET="$(git -C "$AOA_DIR" rev-parse --verify --quiet "origin/${REF}^{commit}")"; then
        echo "update-aoa.sh: no such ref in AOA: $REF" >&2
        exit 1
    fi
fi

git -C "$AOA_DIR" checkout --quiet --detach "$TARGET"
git -C "$ROOT" add external/aoa
(cd "$ROOT" && uv lock)
git -C "$ROOT" add uv.lock
echo "external/aoa is at $(git -C "$AOA_DIR" log --oneline -1); commit external/aoa and uv.lock together."
