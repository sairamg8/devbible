---
title: "What a tag actually is"
sidebar_label: "01 · What a tag actually is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker image tag](https://docs.docker.com/reference/cli/docker/image/tag/)
> and [Docker — building best practices](https://docs.docker.com/build/building/best-practices/).
> **No sandbox** — no console output on this page.

**A tag is a mutable pointer to an image, not a name for one.** Everything that
goes wrong in deployment follows from people treating it as the second thing.

## The reference, piece by piece

A full image reference is `[HOST[:PORT]/]NAMESPACE/REPOSITORY[:TAG]`, and two
defaults fill in the gaps you leave:

> "If the namespace is omitted, Docker defaults to `library`." · "If no tag is
> provided, Docker defaults to `latest`."

So `nginx` is `docker.io/library/nginx:latest` — three defaults applied silently,
which is convenient interactively and a liability in a file that somebody else
will run in two years.

⚠️ **Podman does not apply the registry default the same way.** Short-name
resolution is configurable and can prompt or fail
([Phase 11 · 05](../../phase-11-podman-in-depth/05-where-podman-bites/README.md)),
which is one more reason to write references in full anywhere they are committed.

## The sentence the whole topic hangs on

> "Image tags are **mutable**, meaning a publisher can update a tag to point to a
> new image."

That is not a flaw, it is the design. It is what lets `alpine:3.21` mean "the
current patch of 3.21" — Docker's own example is that the tag "might point to
version 3.21.1 of the image" and, three months later, "a different version, such
as 3.21.4".

The consequence is stated just as plainly:

> "You don't have an audit trail of the exact image versions that you're using."

🔴 **Read that as a deployment statement, not just a build one.** If `myapp:prod`
is a moving tag, then "what is running in production?" has no answer you can
check. The tag tells you a policy, not a fact.

## The digest is the identity

Underneath every tag is a **content digest** — a hash of the image's manifest —
and it is the only reference that cannot change meaning:

```
myapp:1.4.2                                  a pointer, may move
myapp@sha256:9f6c…                           an identity, cannot
myapp:1.4.2@sha256:9f6c…                     both: human label + exact identity
```

The third form is the one worth internalising, and it is exactly what Docker's
own base-image advice uses:
`FROM alpine:3.21@sha256:a8560b36e8b8…`. **The tag carries meaning for a reader;
the digest carries identity for a machine.** They are not competing, and the best
references have both.

## What `latest` actually is

`latest` is **a default, not a promise**. It is the tag applied when you name
none, and there is no rule anywhere that it points at the newest image — a
publisher can leave it pinned to an old release, or never push it at all. Its
name is the single most misleading thing in the container ecosystem.

Three specific ways it bites:

- **It is not "the newest".** `latest` is whatever was last pushed *to that tag*,
  which on a project with release branches is routinely older than the newest
  version.
- **It defeats caching semantics you rely on elsewhere.** A pull of a moving tag
  may or may not fetch new layers depending on what is already local, so "it
  works on my machine" and "it works on the server" can be two different images
  with one name.
- **It makes rollback undefined.** Rolling back to "the previous `latest`" is a
  question the registry cannot answer, because the tag has no history you can
  reach.

⚠️ **This is not an argument for never having a moving tag.** It is an argument
for never *deploying* one. The next chunk gives moving tags a job where their
mutability is an advantage.

## What you may put in a tag

The CLI reference points at the distribution specification as "the canonical
definition of the format" rather than restating the grammar, so treat the safe
set as the practical one: **lowercase and uppercase letters, digits, underscores,
periods and hyphens**, not starting with a period or hyphen, and short.

That matters because the useful values are already in that set:

| Value | Example | Why |
|---|---|---|
| Commit SHA | `1.4.2-9f6c1ab` or `9f6c1ab` | Unique, immutable, traceable to source |
| Semantic version | `1.4.2` | Meaningful to a human consuming your image |
| Branch or PR | `pr-482` | Ephemeral previews, deleted afterwards |
| Build number | `build-1183` | Traceable to a pipeline run |

⚠️ **A git ref is not automatically a valid tag.** A branch name like
`feature/add-cart` contains a `/`, which is a path separator in an image
reference — sanitise it or use the commit SHA instead, which never has this
problem.

## Two failure modes, and they are different

Keeping these apart is what makes the strategy in the next chunk make sense.

**Build-time drift** — your `FROM` line resolves to a different base image than
it did last month, so a rebuild of unchanged source produces a different
artefact. Docker's answer is pinning the base image, with the honest caveat that
a pinned digest means "you're opting out of automated security fixes, which is
likely something you want to get". This is
[Phase 5 · 08](../../phase-5-image-quality/08-pinning-by-digest.md)'s territory,
and the modern answer is automation that updates the pin — Docker Scout, for
instance, can "automatically raise a pull request on your repository to update
your Dockerfiles to use the latest version".

**Deploy-time ambiguity** — the *tag you deploy* moved, so what is running is not
what you tested. No amount of base-image pinning helps here, because the drift is
in your own artefact's label. That failure is what the next chunk is about, and
its fix is a different one: deploy the digest.

🔴 **They are often conflated, and the fixes do not substitute for each other.**
Pinning your base image does not tell you what is in production; deploying by
digest does not stop your builds drifting.

## Gotchas

**Symptom:** The same tag behaves differently on two machines.
**Cause:** Tags are mutable. One machine pulled the tag before it moved, the
other after.
**Fix:** Compare digests, not tags. Long term, deploy by digest so the question
cannot arise.

**Symptom:** `myapp:latest` on the registry is older than `myapp:2.0`.
**Cause:** `latest` is only a default tag name, not a rule about recency —
nothing updates it unless a push does.
**Fix:** Do not read meaning into it. If you publish images for others, push
`latest` deliberately as part of a release, or not at all.

**Symptom:** A CI job fails tagging an image built from a feature branch.
**Cause:** The branch name contains a `/` or another character that is not valid
in a tag — the reference grammar reads it as a path separator.
**Fix:** Tag by commit SHA, or sanitise the branch name before using it.

**Symptom:** A rebuild of an unchanged commit produces a different image.
**Cause:** The base image tag moved. That is the tag doing its job — "image tags
are mutable" — not a build system fault.
**Fix:** Pin the base image by digest and automate updating the pin. Accept that
an unpinned base means unreproducible builds.

## Interview questions

**★ What is a Docker tag, mechanically?**
A mutable pointer from a name to an image manifest in a repository. The
documentation is explicit that "image tags are mutable, meaning a publisher can
update a tag to point to a new image" — so a tag records a policy ("the current
patch of 3.21") rather than an identity. The identity is the content digest,
which cannot change meaning.

**★ Why is `latest` a trap?**
Because it is a *default*, not a promise. It is the tag used when you name none,
and nothing guarantees it points at the newest image — plenty of projects leave
it behind their actual releases. Deploying it means you cannot say what is
running, cannot reproduce it, and cannot roll back to "the previous one", because
a tag has no history.

**★ What is the difference between build-time drift and deploy-time ambiguity?**
Build-time drift is your `FROM` resolving to a different base than before, so
rebuilding unchanged source gives a different artefact; the fix is pinning the
base image, ideally with automation to update the pin, since a static digest opts
you out of security updates. Deploy-time ambiguity is the tag *you* deploy having
moved, so production is not what you tested; the fix is deploying by digest. The
two are routinely confused and neither fix covers the other.

**How do you write a reference that is both readable and exact?**
`repo/image:1.4.2@sha256:…` — the tag for a human reading the file, the digest
for the machine resolving it. That is the form Docker's own base-image guidance
uses, and it costs nothing but line length.

**Is a short image name like `nginx` safe to use in a committed file?**
Not really. It expands via defaults — namespace `library`, tag `latest` — and on
Podman short-name resolution is configurable and can prompt or fail outright in
CI. Anything committed should carry the registry, repository and tag in full.

**What makes a good immutable tag?**
The commit SHA, alone or appended to a version. It is unique, never reused, and
traceable straight back to the source that produced it. Build numbers work too
but tell you less. The important property is that nothing ever re-points it.

---

← Prev: [Tag strategy](README.md) · Index: [Phase 12](../README.md) · Next → [02 · The strategy](02-the-strategy.md)
