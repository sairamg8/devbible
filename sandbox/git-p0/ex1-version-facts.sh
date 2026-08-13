#!/usr/bin/env bash
# Phase 0 / syllabus version facts. Every claim in docs/git/README.md's
# "Version facts" table comes from this script. Run: bash ex1-version-facts.sh
# Nothing here touches the devbible repo — all work happens in a temp dir.
set -u

WORK=$(mktemp -d /tmp/git-p0-XXXXXX)
trap 'rm -rf "$WORK"' EXIT
# Do not inherit the machine's identity or aliases into the measurements.
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=dev GIT_AUTHOR_EMAIL=dev@example.com
export GIT_COMMITTER_NAME=dev GIT_COMMITTER_EMAIL=dev@example.com

line() { printf '\n=== %s ===\n' "$1"; }

line "1. version"
git --version
echo "man-page date: $(man git 2>/dev/null | tail -3 | tr -s ' ' | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)"

line "2. porcelain surface"
printf 'main commands (git help -a, first section): %s\n' \
  "$(git help -a | sed -n '/^Main Porcelain/,/^$/p' | grep -cE '^   [a-z]')"
printf 'total commands on PATH:                    %s\n' \
  "$(git help -a | grep -cE '^   [a-z]')"

line "3. commands that may or may not exist on this build"
for c in switch restore sparse-checkout worktree maintenance replay backfill \
         last-modified bundle range-diff filter-branch filter-repo lfs; do
  if git help -a | grep -qE "^   $c( |$)"; then loc=builtin
  elif command -v "git-$c" >/dev/null 2>&1; then loc="external ($(command -v git-$c))"
  else loc=ABSENT; fi
  printf '  %-16s %s\n' "$c" "$loc"
done
printf '  %-16s %s\n' scalar \
  "$(command -v scalar >/dev/null 2>&1 && scalar version 2>&1 | head -1 || echo ABSENT)"

line "4. git init with no init.defaultBranch set"
cd "$WORK" || exit 1
git init defaultbranch 2>&1 | sed 's/^/  /'
printf 'HEAD points at: %s\n' "$(git -C defaultbranch symbolic-ref HEAD)"

line "5. ref storage backend"
printf 'default ref format:  %s\n' "$(git -C defaultbranch rev-parse --show-ref-format)"
if git init --ref-format=reftable rt >/dev/null 2>&1; then
  printf 'reftable supported:  yes → %s\n' "$(git -C rt rev-parse --show-ref-format)"
  printf 'reftable on disk:    %s\n' "$(ls rt/.git/reftable | tr '\n' ' ')"
else
  printf 'reftable supported:  no\n'
fi
printf 'loose-ref layout:    %s\n' "$(ls defaultbranch/.git/refs | tr '\n' ' ')"

line "6. object format"
printf 'default object hash: %s\n' "$(git -C defaultbranch rev-parse --show-object-format)"
if git init --object-format=sha256 s256 >/dev/null 2>&1; then
  printf 'sha256 supported:    yes → %s\n' "$(git -C s256 rev-parse --show-object-format)"
else
  printf 'sha256 supported:    no\n'
fi

line "7. defaults that changed in recent versions (unset = git's built-in default)"
cd "$WORK/defaultbranch" || exit 1
for k in init.defaultBranch pull.rebase push.default merge.conflictstyle \
         core.autocrlf feature.experimental fetch.prune diff.algorithm \
         maintenance.auto gc.auto rebase.updateRefs; do
  printf '  %-24s %s\n' "$k" "$(git config --get "$k" || echo '(unset)')"
done

line "8. what a bare 'git pull' does on diverged branches with pull.rebase unset"
git commit -q --allow-empty -m base
git clone -q . "$WORK/clone" 2>/dev/null
git commit -q --allow-empty -m "upstream commit"
cd "$WORK/clone" || exit 1
git commit -q --allow-empty -m "local commit"
git -c protocol.file.allow=always pull 2>&1 | sed 's/^/  /'

line "9. is 'git switch' still advertised as experimental?"
git switch -h 2>&1 | head -3 | sed 's/^/  /'
git restore -h 2>&1 | head -3 | sed 's/^/  /'

line "10. the empty-identity failure (why every setup guide starts with user.email)"
cd "$WORK" && git init -q noident && cd noident || exit 1
env -u GIT_AUTHOR_NAME -u GIT_AUTHOR_EMAIL -u GIT_COMMITTER_NAME \
    -u GIT_COMMITTER_EMAIL git commit -q --allow-empty -m x 2>&1 | head -12 | sed 's/^/  /'

line "11. hash of an empty file, and what an object actually is"
cd "$WORK/defaultbranch" || exit 1
printf 'hash-object of empty blob: %s\n' "$(printf '' | git hash-object --stdin)"
printf 'raw object header:         %s\n' \
  "$(printf 'hello\n' | git hash-object -w --stdin >/dev/null && \
     git cat-file -t "$(printf 'hello\n' | git hash-object --stdin)")"
printf 'sha1 of "blob 6\\0hello\\n": %s\n' \
  "$(printf 'blob 6\000hello\n' | sha1sum | cut -d' ' -f1)"
printf 'git says:                  %s\n' "$(printf 'hello\n' | git hash-object --stdin)"
