---
title: "Loose objects, packfiles and delta compression"
sidebar_label: "11 · Packfiles"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex2-object-model.sh`, section 11.

**New objects are written one file each — "loose". Periodically Git packs them
into a single compressed file, storing similar objects as deltas against one
another. This is a storage layer beneath the object model: it changes the disk
footprint by an order of magnitude and changes no command's behaviour.**

## Measured: 51 files to 2, 204K to 36K

```console
$ find .git/objects -type f | wc -l      # loose objects before gc
51
$ du -sh .git/objects
204K	.git/objects
$ git gc && find .git/objects -type f -not -path "*/pack/*" | wc -l
2
$ ls .git/objects/pack
pack-2a55cefce47b131f3cdf41e7923e631150231cc8.idx
pack-2a55cefce47b131f3cdf41e7923e631150231cc8.pack
pack-2a55cefce47b131f3cdf41e7923e631150231cc8.rev
pack-de0412401f4a9e5f05411f44eaf9c86d46096746.idx
pack-de0412401f4a9e5f05411f44eaf9c86d46096746.mtimes
pack-de0412401f4a9e5f05411f44eaf9c86d46096746.pack
pack-de0412401f4a9e5f05411f44eaf9c86d46096746.rev
$ du -sh .git/objects
36K	.git/objects
$ git count-objects -vH
count: 0
size: 0 bytes
in-pack: 51
packs: 2
size-pack: 6.03 KiB
prune-packable: 0
garbage: 0
size-garbage: 0 bytes
```

51 objects, 204K on disk, became 6.03 KiB of packed content. Note the ratio is
far better than zlib alone would give: most of these files differ by one line,
so they delta beautifully. **Note also that `du` says 36K while `size-pack` says
6.03 KiB** — the difference is filesystem block overhead and the index files,
which is why `count-objects -vH` is the number to quote, not `du`.

### The files in a pack

| Extension | Holds |
|---|---|
| `.pack` | The objects themselves, delta-compressed |
| `.idx` | An index: object hash → offset in the pack, so lookup is O(log n) |
| `.rev` | Reverse index: pack position → object, used to speed some operations |
| `.mtimes` | Present only on a **cruft pack** — per-object timestamps for unreachable objects |

**Two packs appeared, not one.** The second is a *cruft pack*: `gc` collected
objects that are unreachable but not yet old enough to delete (the default grace
period is two weeks) and set them aside with their modification times. Cruft
packs are why a `gc` does not immediately shrink a repository that just had
history rewritten, and why recovery of just-orphaned objects still works.

## Reading `count-objects -vH`

| Field | Meaning |
|---|---|
| `count` / `size` | Loose objects and their size — 0 here, everything is packed |
| `in-pack` | Objects inside packfiles |
| `packs` | Number of packfiles |
| `size-pack` | Actual packed size — the honest "how big is my history" figure |
| `prune-packable` | Loose objects that also exist in a pack; safe to drop |
| `garbage` | Files Git does not recognise in the object store |

A repository with a large `count` and many loose objects has not been packed
recently — usually just a lot of recent commits.

## When packing happens

Automatically, when Git decides there is enough loose material: `git gc --auto`
runs as a side effect of commands like `commit`, `merge` and `fetch`, and does
real work only past a threshold (`gc.auto`, 6700 loose objects by default). On
this build `maintenance` can also run packing on a schedule (Phase 9). You will
rarely run `git gc` by hand, and `--aggressive` is almost never the right answer
— it repacks everything from scratch at large CPU cost for a marginal gain.

## The model is unaffected

This is the crucial point. Delta compression is invisible above the storage
layer:

- `git cat-file -p <sha>` returns the complete object, reconstructing it from
  its delta base if needed.
- Object hashes are unchanged — a hash is over the *content*, never over its
  stored representation.
- Deltas are chosen by similarity across the whole repository, **not** by commit
  adjacency. Two versions of a file from commits two years apart can be delta
  partners.

So "Git stores diffs" remains false as a statement about the model, and true as
a statement about bytes on disk. Both facts coexist because they describe
different layers ([page 02](02-commit-is-a-snapshot.md)).

## Trade-off

**Packing trades CPU for space and network, and adds a moment of latency you do
not control.**

The win is large: an order of magnitude on disk here, and the same packing is
what makes `git clone` transfer a compact stream rather than every object. The
costs are that reading a deeply-deltaed object requires reconstructing its
chain, that `gc` can pause an otherwise instant command at an unpredictable
moment, and that a repository full of already-compressed binaries (JPEGs, zips,
compiled artefacts) gets almost none of the benefit — they neither delta nor
compress. That last point is half the reason binaries in Git are a problem
(Phase 7).

## Gotchas

**Symptom:** `.git` did not shrink after `git gc`, even though history was rewritten
**Cause:** the old objects went into a cruft pack and are held for the grace period (two weeks by default)
**Fix:** expected and desirable — it is what makes recovery possible. Force it with `git gc --prune=now` only when you are certain

**Symptom:** an occasional Git command pauses for seconds for no obvious reason
**Cause:** `gc --auto` crossed its threshold and packed in the background
**Fix:** normal. `git maintenance start` moves this work to a schedule instead (Phase 9)

**Symptom:** the repository is huge despite few text files
**Cause:** compressed binaries do not delta or compress — every version is stored at nearly full size
**Fix:** keep them out (Phase 7) or use LFS. Existing ones need a history rewrite (Phase 11)

**Symptom:** `du -sh .git` and `git count-objects -vH` disagree
**Cause:** `du` includes index files, cruft packs, reflogs and filesystem block overhead
**Fix:** quote `size-pack` for history size — measured 6.03 KiB where `du` said 36K

## Interview questions

**★ Does Git store files as diffs?**
Not in the object model — every object is complete content. Inside packfiles,
objects are stored as deltas against similar objects for space. No command's
behaviour depends on it: `cat-file` still returns whole objects, and hashes are
over content, never over the stored form.

**★ What is the difference between loose objects and a packfile?**
A loose object is one zlib-compressed file per object, written on commit. A
packfile holds many objects together, delta-compressed, with an `.idx` for
lookup. Measured: 51 loose objects (204K) became 6.03 KiB packed.

**★ How do you find the true size of a repository's history?**
`git count-objects -vH` and read `size-pack`. `du -sh .git` overstates it —
36K versus 6.03 KiB in the run above.

**★ Why don't images and archives benefit from Git's compression?**
They are already compressed, so they neither delta against previous versions nor
shrink under zlib. Each version is stored at close to full size, forever.

**What is a cruft pack?**
A packfile holding unreachable objects together with their modification times,
so `gc` can keep them for a grace period instead of deleting them immediately.
It is why a repository does not shrink the instant history is rewritten — and
why just-orphaned objects are still recoverable.

**Is `git gc --aggressive` a good idea?**
Rarely. It discards existing delta choices and recomputes them at high CPU cost
for a usually marginal gain. Routine `gc --auto`, or scheduled `git maintenance`,
is the normal answer.

---

← Prev: [Identity and first-run setup](10-identity-setup.md) · Next → [What Git is not](12-what-git-is-not.md)
