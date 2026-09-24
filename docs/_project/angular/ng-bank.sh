#!/usr/bin/env bash
# ng-bank.sh <topic-slug> "<commit subject>"
# Commits ONLY that one Angular Phase 0 topic directory. Never `git add -A`.
# flock-serialised so parallel lanes never collide on .git/index.lock.
set -euo pipefail
cd /mnt/Storage/Backup/Knowledge/devbible
DIR="docs/angular/pages/phase-0-how-angular-runs/$1"
exec 9>/tmp/claude-1000/ng-angular-commit.lock
flock -w 900 9 || { echo "ng-bank: could not take lock in 900s" >&2; exit 1; }
git add -- "$DIR"
if git diff --cached --quiet -- "$DIR"; then echo "ng-bank: nothing staged for $DIR"; exit 0; fi
git commit -q -m "angular phase 0: $2

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>" -- "$DIR"
echo "ng-bank: committed $(git log --oneline -1)"
