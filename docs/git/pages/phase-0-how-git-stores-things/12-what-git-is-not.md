---
title: "What Git is not"
sidebar_label: "12 · What Git is not"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Scripts:
> `sandbox/git-p0/ex2-object-model.sh` section 11;
> `sandbox/git-p0/ex1-version-facts.sh` section 10.

**Four things Git is routinely asked to be, and is not: a backup system, a
deployment mechanism, a place to keep secrets, and a store for large binaries.
Each misuse fails for the same underlying reason — history is permanent,
cumulative and copied in full to everyone who clones.**

## Not a backup

A backup protects against loss. Git protects against *unwanted change*, which is
a different thing:

| | Backup | Git |
|---|---|---|
| Protects against | Disk failure, deletion, ransomware | Bad edits, wrong direction, lost context |
| Covers | Everything, including uncommitted and ignored files | Only what you committed |
| Off-machine by default | Yes | **No** — a repository with no remote lives on one disk |
| Restores a point in time | Yes | Only points you chose to commit |

Uncommitted work, `.env` files, `node_modules`, build output and anything in
`.gitignore` are outside Git entirely. A repository that has never been pushed
is not backed up in any sense — it is one `rm -rf` from gone
([page 09](09-git-directory-tour.md)).

Pushing to a remote *is* an off-machine copy, and for most projects that is
enough. It is still not a backup of your machine, and a force-push can destroy
remote history that no backup then holds.

## Not a deployment tool

`git pull` on a server is a familiar deploy step and a poor one: it leaves a
`.git` directory on the host (often web-readable), gives no atomic switch
between versions, no rollback beyond another pull, no build step, and it fails
in interesting ways when someone edits a file on the server. Git is how the
artefact's *source* is versioned; a pipeline builds and ships it (Node
Phase 11 — Deployment).

## Not a place for secrets

This is the expensive one, because it is silent until it is not.

Committing a credential and deleting it in the next commit removes nothing: the
blob is still referenced by the earlier commit, and reachable objects are never
garbage collected ([page 01](01-what-git-is.md)). Meanwhile every clone,
every fork, and every CI cache now has a copy.

The correct response, in this order:

1. **Rotate the credential.** It is compromised the moment it is pushed. Every
   later step is cleanup, not containment.
2. Remove it from history (Phase 11 — needs `git-filter-repo`, which is **not
   installed on this machine**).
3. Force-push, and have every collaborator re-clone.
4. Add the pattern to `.gitignore` so it cannot recur (Phase 7).

Step 1 is the one people skip while doing 2 and 3, which is exactly backwards:
rewriting takes hours and rotation takes minutes.

## Not a large-file store

Packing gets an order of magnitude on text, measured on this build:

```console
$ git count-objects -vH
count: 0
size: 0 bytes
in-pack: 51
packs: 2
size-pack: 6.03 KiB
```

Already-compressed binaries get almost none of that: they do not delta against
their previous versions and they do not compress further. Commit a 50 MB video
ten times and the repository carries roughly 500 MB — forever, in every clone,
even after the file is deleted, because every historical commit still references
its blob.

Git LFS exists for this and stores pointers in Git with content elsewhere.
**`git-lfs` is not installed on this machine**, so its mechanics are covered in
Phase 7 rather than demonstrated here.

## What Git *is* good at

Worth stating plainly, so the boundaries are not read as criticism: text-shaped
content that changes incrementally and needs review, attribution, branching and
recoverable history. Source code, configuration, infrastructure definitions,
schema migrations, documentation. Everything above is a case of asking a tool
built for that to do something else.

## Trade-off

**Permanent history is the feature and the trap.**

Everything Git is good at follows from the same property: nothing is lost, every
state is reachable, and every clone is complete. That is what makes recovery
reliable, offline work possible, and audit trails trustworthy. It is also
precisely why a committed secret is an incident, a committed binary is
permanent weight, and a repository is not a backup. You cannot keep the first
set of properties and discard the second — they are the same mechanism seen from
two directions.

## Gotchas

**Symptom:** "I deleted the secret and committed the fix" — the scanner still flags it
**Cause:** the blob is still referenced by the earlier commit; deletion adds a commit, it does not remove content
**Fix:** rotate first, then rewrite history (Phase 11), then force-push and have everyone re-clone

**Symptom:** clone takes several minutes on a small-looking project
**Cause:** history contains large binaries that no longer exist in the working tree
**Fix:** confirm with `git count-objects -vH`; audit large blobs (Phase 9). Removing them needs a rewrite

**Symptom:** the machine died and work is gone despite "using Git"
**Cause:** commits were never pushed — Git is not off-machine by default, and uncommitted work is not in Git at all
**Fix:** push regularly; treat a single-machine repository as unbacked-up data

**Symptom:** `.git` is publicly readable on a deployed site
**Cause:** deploying by `git pull`/`git clone` onto the server leaves the repository in the web root
**Fix:** deploy a built artefact instead; at minimum, block `.git` at the web server

## Interview questions

**★ Is Git a backup system?**
No. It versions what you chose to commit, and by default lives on one machine.
Uncommitted and ignored files — including `.env` and build output — are outside
it entirely. Pushing to a remote is an off-machine copy, which is useful but is
not a backup of the machine.

**★ You committed an API key and pushed. What is the first thing you do?**
Rotate the key. It is compromised the moment it left your machine, and every
clone already has it. History rewriting, force-pushing and re-cloning come
afterwards — they are cleanup, not containment.

**★ Why does deleting a file in a new commit not shrink the repository?**
Earlier commits still reference the blob, and reachable objects are never
garbage collected. The content is only removable by rewriting the commits that
contain it.

**★ Why are binaries bad in Git?**
Compressed binaries neither delta against previous versions nor compress
further, so every version is stored near full size, permanently, in every clone.
Text packs down by an order of magnitude — measured 51 objects at 204K packing
to 6.03 KiB.

**What is wrong with deploying by running `git pull` on the server?**
No atomic switch between versions, no real rollback, no build step, a
`.git` directory exposed in the deploy root, and breakage when files are edited
on the server. Build an artefact and ship that.

---

← Prev: [Loose objects and packfiles](11-loose-objects-and-packfiles.md) · Next → [SHA-1, SHA-256 and object format](13-object-format.md)
