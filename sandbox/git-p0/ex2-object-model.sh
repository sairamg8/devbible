#!/usr/bin/env bash
# Phase 0 pages 01-07 and 10-11: the object store, the four object types,
# the commit graph, the three trees, the index, refs and HEAD, .git/ contents,
# loose objects vs packfiles.
# Every console block on those pages comes from here. Run: bash ex2-object-model.sh
set -u
WORK=$(mktemp -d /tmp/git-p0-obj-XXXXXX)
trap 'rm -rf "$WORK"' EXIT
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export GIT_AUTHOR_NAME=dev GIT_AUTHOR_EMAIL=dev@example.com
export GIT_COMMITTER_NAME=dev GIT_COMMITTER_EMAIL=dev@example.com
# Fixed dates so the commit hashes below are reproducible on a re-run.
export GIT_AUTHOR_DATE='2026-08-13T10:00:00+00:00'
export GIT_COMMITTER_DATE='2026-08-13T10:00:00+00:00'

line() { printf '\n=== %s ===\n' "$1"; }
cd "$WORK" || exit 1
git init -q -b main repo && cd repo || exit 1

line "1. an object is content, addressed by the hash of header+content"
printf 'hello\n' > greeting.txt
echo '$ git hash-object greeting.txt'
git hash-object greeting.txt
echo '$ printf "blob 6\\0hello\\n" | sha1sum        # the header Git prepends'
printf 'blob 6\000hello\n' | sha1sum | cut -d' ' -f1
echo '# identical: the name "greeting.txt" is nowhere in the hash'
cp greeting.txt copy-of-greeting.txt
echo '$ git hash-object copy-of-greeting.txt        # same bytes, same object'
git hash-object copy-of-greeting.txt

line "2. nothing is stored until you write it"
echo '$ git cat-file -t ce013625030ba8dba906f756967f9e9ca394464a'
git cat-file -t ce013625030ba8dba906f756967f9e9ca394464a 2>&1
echo '$ git hash-object -w greeting.txt             # -w actually writes'
git hash-object -w greeting.txt
echo '$ git cat-file -t ce013625030ba8dba906f756967f9e9ca394464a'
git cat-file -t ce013625030ba8dba906f756967f9e9ca394464a
echo '$ git cat-file -s ce013625030ba8dba906f756967f9e9ca394464a   # size'
git cat-file -s ce013625030ba8dba906f756967f9e9ca394464a
echo '$ find .git/objects -type f'
find .git/objects -type f | sort

line "3. the three trees: working tree, index, HEAD"
rm -f copy-of-greeting.txt
mkdir -p src && printf 'export const add = (a, b) => a + b;\n' > src/math.js
echo '$ git status --short          # ?? = in the working tree only'
git status --short
git add greeting.txt src/math.js
echo '$ git add greeting.txt src/math.js && git status --short   # A = in the index'
git status --short
echo '$ git ls-files --stage        # the index is a real file with real blobs'
git ls-files --stage

line "4. editing after add leaves the OLD content staged"
printf 'hello\nworld\n' > greeting.txt
echo '$ git status --short          # staged AND modified, at the same time'
git status --short
echo '$ git diff --stat             # working tree vs index'
git diff --stat
echo '$ git diff --staged --stat    # index vs HEAD'
git diff --staged --stat

line "5. a commit is a snapshot: a tree, parents, and metadata"
git add greeting.txt
git commit -q -m "Add greeting and math helper"
echo '$ git cat-file -p HEAD'
git cat-file -p HEAD
echo '$ git cat-file -p HEAD^{tree}   # the root tree'
git cat-file -p 'HEAD^{tree}'
echo '$ git cat-file -p HEAD:src      # a subdirectory is its own tree object'
git cat-file -p HEAD:src

line "6. the four object types, counted"
echo '$ git cat-file --batch-all-objects --batch-check="%(objecttype)" | sort | uniq -c'
git cat-file --batch-all-objects --batch-check='%(objecttype)' | sort | uniq -c
git tag -a v0.1 -m "first tag"
echo '$ git tag -a v0.1 -m "first tag" && (recount)'
git cat-file --batch-all-objects --batch-check='%(objecttype)' | sort | uniq -c
echo '$ git cat-file -p v0.1          # an annotated tag is an object; lightweight tags are not'
git cat-file -p v0.1

line "7. refs and HEAD are plain files"
git commit -q --allow-empty -m "Second commit"
echo '$ cat .git/HEAD'
cat .git/HEAD
echo '$ cat .git/refs/heads/main'
cat .git/refs/heads/main
echo '$ git rev-parse HEAD            # the same 40 characters'
git rev-parse HEAD
echo '$ git symbolic-ref HEAD'
git symbolic-ref HEAD
echo '$ ls -R .git/refs'
ls -R .git/refs

line "8. a branch costs 41 bytes"
git branch feature/pricing
echo '$ git branch feature/pricing && wc -c .git/refs/heads/feature/pricing'
wc -c .git/refs/heads/feature/pricing
echo '$ git cat-file --batch-all-objects --batch-check | wc -l   # object count unchanged'
git cat-file --batch-all-objects --batch-check | wc -l

line "9. the commit graph: parents, not timestamps"
echo '$ git log --format="%h %p %ad %s" --date=short'
git log --format='%h %p %ad %s' --date=short
echo '$ git rev-list --count HEAD'
git rev-list --count HEAD
echo '# a commit with a FUTURE author date is still the child of its parent'
GIT_AUTHOR_DATE='2030-01-01T00:00:00+00:00' \
GIT_COMMITTER_DATE='2026-08-13T10:00:00+00:00' \
  git commit -q --allow-empty -m "Dated 2030, still a child"
git log --format='%h %ad %s' --date=short
echo '$ git log --format="%h %s" --reverse   # ancestry order, not date order'
git log --format='%h %s' --reverse

line "10. what is actually in .git/"
echo '$ ls -1 .git'
ls -1 .git
echo '$ file .git/index'
file .git/index 2>/dev/null || echo '(file(1) not installed)'
echo '$ cat .git/config'
cat .git/config

line "11. loose objects become a packfile"
for i in $(seq 1 40); do printf 'line %s\n' "$i" > "file-$i.txt"; done
git add . && git commit -q -m "Add 40 files"
echo '$ find .git/objects -type f | wc -l      # loose objects before gc'
find .git/objects -type f -not -path '*/pack/*' | wc -l
echo '$ du -sh .git/objects'
du -sh .git/objects
git gc -q 2>/dev/null
echo '$ git gc && find .git/objects -type f -not -path "*/pack/*" | wc -l'
find .git/objects -type f -not -path '*/pack/*' | wc -l
echo '$ ls .git/objects/pack'
ls .git/objects/pack
echo '$ du -sh .git/objects'
du -sh .git/objects
echo '$ git count-objects -vH'
git count-objects -vH

line "12. config layers and precedence"
git config --local user.email 'work@example.com'
echo '$ git config --list --show-origin --show-scope | grep user.email'
git config --list --show-origin --show-scope | grep user.email
echo '$ git -c user.email=once@example.com config --show-scope user.email'
git -c user.email=once@example.com config --show-scope user.email

line "13. plumbing vs porcelain: commit built by hand"
blob=$(printf 'built by hand\n' | git hash-object -w --stdin)
tree=$(printf '100644 blob %s\thandmade.txt\n' "$blob" | git mktree)
commit=$(git commit-tree "$tree" -p HEAD -m "Made with plumbing only")
echo "blob   = $blob"
echo "tree   = $tree"
echo "commit = $commit"
echo '$ git cat-file -p $commit'
git cat-file -p "$commit"
echo '$ git log --oneline -1 $commit   # a real commit, reachable from no branch'
git log --oneline -1 "$commit"
