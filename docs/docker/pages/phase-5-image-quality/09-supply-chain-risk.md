---
title: "Supply-chain risk"
sidebar_label: "09 · Supply-chain risk"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against
> [Docker Hub — trusted content](https://docs.docker.com/docker-hub/repos/manage/trusted-content/),
> [Docker Scout](https://docs.docker.com/scout/),
> [Docker — engine security](https://docs.docker.com/engine/security/) and
> [the Dockerfile reference — `FROM`](https://docs.docker.com/reference/dockerfile/#from).
> **No sandbox** — no console output on this page.

**`FROM some-user/some-image` says: I will execute whatever this person puts
here, as part of my product, in my production environment.** Written that way it
is obviously a decision. Written as a `FROM` line it looks like a dependency
declaration, and gets about as much scrutiny as one.

## What you actually agreed to

A base image is not a library you call — it is **the filesystem your process runs
in**. Everything in it is present at runtime with the same access your
application has: its libraries, its shell, its cron entries if any, its
entrypoint script, and any binary somebody added.

And it composes transitively. Your image is `FROM` theirs, theirs is `FROM`
another, and that one is `FROM` a distribution image. Nothing in the Dockerfile
shows you that chain; `FROM` looks like one line and is a tree.

The concrete exposures, worst first:

| Risk | What it looks like |
|---|---|
| **Malicious content** | A deliberately backdoored image, or a typosquatted name one character from the real one |
| **Account compromise** | A legitimate publisher's tag repointed to something else |
| **Abandonment** | The image simply stops being updated, and its CVEs accumulate |
| **Opaque construction** | No Dockerfile published, so you cannot tell what is in it or how it got there |
| **Transitive drift** | The image's own base moved and changed things you never looked at |

The middle one — abandonment — is the most likely by a wide margin, and the one
that never announces itself.

## What the badges mean

Docker Hub runs three programmes, and it is worth knowing what each actually
asserts:

| Programme | What it means |
|---|---|
| **Docker Official Images** | "Reliable foundations for containerized applications" — contributors "propose and maintain images that meet Docker's highest standards for security and quality" |
| **Verified Publisher (DVP)** | Organisations "showcase trusted, high-quality images with a verified badge" and gain "priority in search results" |
| **Docker-Sponsored Open Source (DSOS)** | Open source projects "gain perks like verified badges, insights, and access to Docker Scout" |

Read them precisely. **Official Images** is a curation programme with review
against Docker's standards — the strongest of the three. **Verified Publisher**
and **Sponsored Open Source** primarily verify **who the publisher is**, which
addresses impersonation and typosquatting. That is genuinely valuable and it is
not a code audit: a verified publisher can still ship an image with an old
OpenSSL in it.

So the badge answers "is this who it claims to be?" much better than "is this
good?".

## Evaluating a base image

Five questions, in the order that eliminates candidates fastest:

**1. Who publishes it, and is that verifiable?** An Official Image, a
verified organisation, or a project whose repository you can find. An
unaffiliated account with a plausible name is where typosquatting lives — check
the exact spelling against the project's own documentation, not against search
results.

**2. Is it maintained?** When was the tag last pushed? A base that has not been
rebuilt in a year has a year of unpatched distribution packages, regardless of
who made it.

**3. Can you see how it was built?** A published Dockerfile turns "trust me" into
something reviewable. Its absence is not proof of anything and it is a reason to
prefer an alternative that has one.

**4. What does it score?** Scan it before adopting it
([page 07](07-vulnerability-scanning.md)) — Docker Scout, Trivy or Grype on the
candidate base tells you what you would be inheriting.

**5. Do you need it at all?** The strongest supply-chain move is usually
reduction. A distroless or `scratch` runtime built from a language image you
already trust removes a whole publisher from your dependency set
([page 06](06-distroless-and-scratch.md)).

## Reducing exposure

**Prefer official and language-team images**, then build the rest yourself. A
`FROM node:22-alpine` plus your own `RUN apt-get install` is a smaller trust set
than `FROM someone/node-with-tools`, even though the second is more convenient.

**Pin by digest, and automate the bump.** A digest cannot be repointed by a
compromised account, and the automation is what stops the pin becoming stale
([page 08](08-pinning-by-digest.md)).

**Mirror what you depend on.** Copying approved bases into your own registry
gives you a stable source, an audit point, and immunity to upstream deletion —
which happens, and takes your builds with it.

**Minimise the count.** Every distinct base image in an organisation is a
publisher to track. A small set of approved bases used everywhere is easier to
patch and easier to reason about than each team choosing its own.

**Know what is in it.** An SBOM makes the inventory explicit and machine-readable
rather than something you discover during an incident — **page 11 · SBOMs and
provenance** *(not written yet)*.

**Check the whole chain, not just the base.** Language dependencies are the other
half of the same problem, and typosquatted npm and PyPI packages are more common
than typosquatted images. A lockfile applied strictly is the equivalent control
([Phase 4 · the dependency-install pattern](../phase-4-build-strategy/03-dependency-install-pattern.md)).

## The honest limits

You cannot audit a base image's source in any practical sense, and pretending
otherwise is worse than admitting it. What you *can* do is reduce the number of
parties you depend on, pin what you depend on, know what is inside it, and be
able to rebuild and redeploy quickly when something turns out to be wrong.

**Response time is the control that actually pays.** Assume something you depend
on will need replacing at short notice, and make sure that is a routine operation
rather than a project. Everything else on this page is about lowering the
probability; this is the one that limits the damage.

## Podman

The risk model is identical — the images are the same artefacts from the same
registries. Two Podman-specific notes:

- **Short-name resolution is configurable** and is a supply-chain surface in its
  own right: an unqualified `FROM node:22` resolves through the registries listed
  in the host's configuration, so what you get depends on the machine. Fully
  qualify every reference
  ([Phase 4 · docker vs podman vs buildah](../phase-4-build-strategy/14-docker-vs-podman-vs-buildah.md)).
- **Docker Hub's badge programmes are Docker Hub's**, so an image pulled from
  another registry carries none of that signal. Judge it on the five questions
  above instead.

## Gotchas

**Symptom:** An image was pulled from a name one character different from the
intended one.
**Cause:** Typosquatting — a plausible account name and a familiar image name.
**Fix:** Copy the exact reference from the project's own documentation, and pin
by digest so a later mistake cannot silently substitute.

**Symptom:** A base image accumulates CVEs and never improves.
**Cause:** It is abandoned. Nobody announces this.
**Fix:** Check the last-pushed date before adopting, and re-check periodically.
Have a migration path off every base you depend on.

**Symptom:** A build suddenly fails because the base image no longer exists.
**Cause:** The publisher deleted the repository or the tag.
**Fix:** Mirror approved bases into your own registry. This is also the
mitigation for a compromised upstream.

**Symptom:** The team treats a "verified publisher" badge as a security review.
**Cause:** The badge verifies identity and quality programme membership, not the
absence of vulnerabilities.
**Fix:** Scan the candidate base before adopting it, and keep scanning it after.

## Interview questions

**★ What are you agreeing to when you write `FROM someuser/someimage`?**
To run everything in that image, with your application's access, in production —
and transitively, everything in *its* base too. It is not a library you call; it
is the filesystem your process lives in, and one `FROM` line hides a whole chain.

**★ What do Docker Hub's trusted-content badges actually assert?**
Docker Official Images is a curation programme whose images "meet Docker's
highest standards for security and quality". Verified Publisher and
Docker-Sponsored Open Source primarily verify **who the publisher is** — valuable
against impersonation and typosquatting, and not a code audit.

**★ How do you reduce base-image supply-chain risk in practice?**
Prefer official and language-team images; minimise how many distinct bases the
organisation depends on; pin by digest with automated bumps; mirror approved
bases into your own registry; scan before adopting and continuously after; and
keep rebuild-and-redeploy fast enough to be a routine response.

**Which risk is most likely, and why is it easy to miss?**
Abandonment. There is no announcement — the image simply stops being rebuilt and
its distribution packages age. Checking the last-pushed date before adopting, and
periodically after, is the whole control.

**Does Podman change any of this?**
Not the risk model. It adds one surface: short-name resolution is configured per
host, so an unqualified reference can resolve differently on different machines.
Fully qualify every image reference.

---

← Prev: [Pinning base images by digest](08-pinning-by-digest.md) · Index: [Phase 5](README.md) · Next → **Static binaries** *(not written yet)*
