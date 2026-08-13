---
title: "SHA-1, SHA-256 and object format"
sidebar_label: "13 · Object format"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex1-version-facts.sh`, section 6.

**Git names objects with SHA-1 by default. SHA-256 repositories are fully
supported and chosen at `init` time, but the two formats cannot talk to each
other — which is why, years after the collision research, SHA-1 is still what
you will meet.**

## What this build does

```console
$ git rev-parse --show-object-format
default object hash: sha1
sha256 supported:    yes → sha256
```

The first line is a fresh repository's format; the second is the same command in
one created with `git init --object-format=sha256`. Both work on 2.55.0. The
default is SHA-1 and there is no sign of that changing soon.

```bash
git init --object-format=sha256 myrepo      # opt in, at creation only
git rev-parse --show-object-format          # ask an existing repo
```

The choice is made once, at `init`. There is no in-place conversion.

## Why SHA-1 is still here

SHA-1 is cryptographically broken for collision resistance — SHAttered (2017)
produced two different PDFs with the same SHA-1, and later work made chosen-
prefix collisions practical. That matters to Git because a collision would let
one object be substituted for another.

Two things kept the sky from falling:

1. **Git does not hash raw content.** It hashes `blob <size>\0<content>`
   ([page 01](01-what-git-is.md)). A generic collision is not directly usable;
   an attacker needs a collision in Git's own framing, with valid object
   structure.
2. **Git 2.13+ ships hardened SHA-1** (`sha1dc`), which detects the byte
   patterns produced by known collision attacks and **aborts** rather than
   writing the object. Every modern build, including this one, uses it.

So the practical risk is low, and it is genuinely non-zero. SHA-256 exists for
environments where "low" is not an acceptable answer.

## Why almost nobody uses SHA-256

**The formats do not interoperate.** A SHA-256 repository cannot fetch from or
push to a SHA-1 one — object names are the protocol's vocabulary, and there is
no translation layer in general use. That produces a hard adoption problem:

| Blocker | Consequence |
|---|---|
| Hosting support | The major hosts do not accept SHA-256 repositories |
| Tooling | CI actions, review tools and anything parsing 40-character hashes assume SHA-1 |
| Existing history | No conversion path; you would start a new repository |
| Collaboration | Everyone must move at once — the two formats cannot share a remote |

Hash length is the visible tell: 40 hex characters for SHA-1, 64 for SHA-256.
Any script that hard-codes 40, or a `[0-9a-f]{40}` regex, breaks on a SHA-256
repository. If you write tooling, match `[0-9a-f]{40,64}` and let Git tell you
what it uses.

## Where this actually surfaces

For everyday fullstack work: essentially nowhere. It is worth knowing for three
situations.

- **An interviewer asks whether Git is broken because SHA-1 is broken.** The
  answer is the hardened-SHA-1 detail above, not a shrug.
- **A compliance requirement forbids SHA-1.** Then SHA-256 is available, and the
  interoperability cost has to be planned for — see Phase 11.
- **You are writing tooling that parses hashes.** Do not assume 40 characters.

## Trade-off

**SHA-256 buys collision resistance and costs the entire ecosystem.**

The cryptography is unambiguously better. Everything else is worse: you cannot
push to a normal remote, your host probably will not take it, tools that assume
40-character hashes break, and there is no migration path from your existing
history. That is why the correct default for a fullstack project in 2026 is to
stay on SHA-1 with hardened detection, and know the escape hatch exists.

## Gotchas

**Symptom:** a script that validates commit hashes fails on some repository
**Cause:** it matches exactly 40 hex characters; SHA-256 object names are 64
**Fix:** match `[0-9a-f]{40,64}`, or ask Git with `git rev-parse --show-object-format`

**Symptom:** a SHA-256 repository cannot push to your host
**Cause:** the formats do not interoperate and most hosts accept SHA-1 only
**Fix:** none, short of recreating the repository as SHA-1. Confirm host support *before* choosing the format

**Symptom:** "SHA-1 is broken, is our history untrustworthy?"
**Cause:** conflating a generic hash collision with a usable attack on Git
**Fix:** Git hashes a typed, length-prefixed header and ships hardened SHA-1 that detects known collision attacks and refuses the write. The risk is low; SHA-256 exists where low is not enough

**Symptom:** you want to convert an existing repository to SHA-256
**Cause:** there is no in-place conversion; the format is fixed at `init`
**Fix:** treat it as a migration to a new repository, with the interoperability consequences that implies (Phase 11)

## Interview questions

**★ Git uses SHA-1, which is broken. Is that a problem?**
Less than it sounds. Git hashes `blob <size>\0<content>`, so a generic collision
is not directly usable, and modern builds ship hardened SHA-1 that detects known
collision attacks and aborts the write. SHA-256 is supported for environments
that need it.

**★ Can you switch a repository to SHA-256?**
Not in place. The format is chosen with `git init --object-format=sha256` and is
fixed thereafter. Moving means creating a new repository — and SHA-256 and SHA-1
repositories cannot fetch or push to each other.

**★ Why has SHA-256 seen so little adoption?**
Interoperability. The two formats cannot share a remote, major hosts do not
accept SHA-256, and tooling widely assumes 40-character hashes. The cryptography
is better; the ecosystem cost is prohibitive.

**How can you tell which hash a repository uses?**
`git rev-parse --show-object-format`, or look at a hash: 40 hex characters for
SHA-1, 64 for SHA-256.

**What does Git actually hash?**
The object type, a space, the content length in bytes, a NUL, then the content.
The type and length prefix are part of why a generic SHA-1 collision does not
translate into a usable Git attack.

---

← Prev: [What Git is not](12-what-git-is-not.md) · Next → [Plumbing versus porcelain](14-plumbing-vs-porcelain.md)
