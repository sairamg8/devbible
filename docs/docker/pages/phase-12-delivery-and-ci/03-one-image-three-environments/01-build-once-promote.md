---
title: "Build once, promote the digest"
sidebar_label: "01 · Build once, promote"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker buildx imagetools create](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/),
> [Docker — building best practices](https://docs.docker.com/build/building/best-practices/)
> and [The Twelve-Factor App — Config](https://12factor.net/config).
> **No sandbox** — no console output on this page.

**A rebuild is a different image.** Not "probably the same" — different, and
provably so, because the digest changes. Everything in this chunk follows from
taking that seriously.

## Why a rebuild is not the same thing

Build the same commit twice, an hour apart, and at least three things can differ:

| What | Why it changes |
|---|---|
| The base image | "Image tags are mutable, meaning a publisher can update a tag to point to a new image" — `node:22-alpine` today is not `node:22-alpine` next month |
| Downloaded dependencies | A registry can serve a different artefact for the same version specifier unless the lockfile *and* the registry both hold still |
| Timestamps and layer ordering | Enough to change the digest even when the contents are equivalent ([Phase 4 · 16](../../phase-4-build-strategy/16-reproducible-builds.md)) |

🔴 **So "we build from the same commit in each environment" is not a guarantee of
anything.** It is a hope, and the digest is the thing that would have told you it
was false.

Reproducible builds narrow this ([Phase 4 · 16](../../phase-4-build-strategy/16-reproducible-builds.md)),
and they are genuinely hard. Promotion sidesteps the problem entirely: do not
rebuild, and there is nothing to reproduce.

## What promotion actually is

Promotion moves a **label**, never bytes. The image already exists in the
registry; you are adding another name for it:

```bash
# after tests pass on staging
docker buildx imagetools create \
  -t myregistry/myapp:production \
  myregistry/myapp@sha256:9f6c1ab…
```

`imagetools create` "create[s] a new manifest list based on source manifests", and
those "must already exist in the registry where the new manifest is created" — so
this is a registry-side operation. Nothing is pulled, nothing is built, and the
digest is unchanged by construction.

**The pipeline shape that follows:**

```
build once  →  push myapp:1.4.2-9f6c1ab  →  record digest
                       ↓
   deploy digest to dev        → test
                       ↓
   deploy the SAME digest to staging  → test
                       ↓
   deploy the SAME digest to production
```

Each arrow is a **deployment of an existing digest**, not a build. The only thing
that changes as it moves right is the configuration handed to it, which is
[chunk 02](02-configuration-from-outside.md).

⚠️ **The environment-named tag is a convenience, not the reference.** Keeping
`myapp:production` up to date is useful for humans reading the registry; the
deployment should still name the digest, because a tag can be moved by anyone
with push access ([Phase 12 · 01](../01-tag-strategy/02-the-strategy.md)).

## The anti-patterns, and what each one costs

**1 · A Dockerfile per environment.** `Dockerfile.staging` and
`Dockerfile.prod` guarantee the artefacts differ and guarantee they drift, since
a fix applied to one is applied to the other by memory. If the difference is
genuinely about *building* — a debug toolchain, dev dependencies — that is what
**multi-stage targets** are for
([Phase 4 · 06](../../phase-4-build-strategy/06-target.md)), and even then only
the dev/prod split of [Phase 9 · 02](../../phase-9-mern-pern-stack/02-dev-vs-prod-image.md)
is defensible.

**2 · Environment baked in as a build arg.** `ARG API_URL` consumed at build time
means one image per environment by construction, and it is how most teams get
here without deciding to. Build args are also recoverable from the image
([Phase 4 · 13](../../phase-4-build-strategy/13-build-args-vs-runtime-env.md)),
so this is a leak as well as a coupling.

**3 · Rebuilding to "refresh" a deployment.** A rebuild to pick up a base-image
security fix is legitimate — but it produces a **new digest**, which must then go
through the same promotion path. Treat it as a new release, not as redeploying
the current one.

**4 · A separate registry per environment.** Copying images between registries
means the digest is preserved only if you copy properly (`skopeo copy` does,
`pull`/`tag`/`push` can too) — and it doubles the number of places a mistake can
happen. If regulation demands it, mirror deliberately and verify digests on
arrival ([Phase 11 · 12](../../phase-11-podman-in-depth/12-buildah-and-skopeo.md)).

## The one genuine exception: build-time client bundles

Here is where the principle really does break, and it is worth knowing precisely
rather than treating it as a special case to be waved through.

A browser bundle is compiled before it is served. Vite's `VITE_*` variables are
**statically replaced at build time**
([Phase 9 · 12](../../phase-9-mern-pern-stack/12-react-vite-frontend.md)), so an
API URL compiled into the bundle cannot be changed by an environment variable at
`docker run`. One image per environment appears to be forced.

It is not, and there are two honest ways out:

- **Make the API same-origin.** Serve the app and the API under one origin and
  call `/api` — no absolute URL to configure, no CORS, and the reverse proxy owns
  the routing ([Phase 9 · 13](../../phase-9-mern-pern-stack/13-nginx-in-front.md)).
  This is the answer most of the time.
- **Serve configuration at runtime.** The container writes a small
  `config.json` — or a `<script>` block — from its environment at start-up, and
  the app fetches it before booting. One image, configuration from outside, at the
  cost of one request.

⚠️ **What both avoid is a per-environment bundle**, which otherwise means the
thing you tested in staging is not the thing production serves. If you do
consciously choose per-environment bundles, say so explicitly and accept that the
guarantee is gone rather than assuming it silently.

## Gotchas

**Symptom:** Staging passed and production failed with "the same version".
**Cause:** Each environment built its own image, so they were different
artefacts. The same commit does not imply the same image.
**Fix:** Build once, promote the digest. If the digests differ, they were never
the same version regardless of the tag.

**Symptom:** A deployment silently changed after a colleague pushed to the
registry.
**Cause:** The deployment referenced an environment tag such as
`myapp:production`, which someone re-pointed.
**Fix:** Deploy digests. Keep the environment tag as a human-readable pointer if
you like it, but never resolve it at deploy time.

**Symptom:** The frontend calls the wrong API host in staging.
**Cause:** The URL was compiled into the bundle at build time, so the image is
environment-specific whether or not you intended it.
**Fix:** Same-origin `/api`, or fetch a runtime `config.json` written from the
container's environment at start-up.

**Symptom:** A base-image CVE fix required rebuilding, and now nobody is sure
what is deployed where.
**Cause:** The rebuild produced a new digest that was pushed straight to
production without going through the promotion path.
**Fix:** Treat a rebuild as a new release. New digest, same pipeline, same gates.

## Interview questions

**★ What does "build once, deploy everywhere" actually require?**
That the artefact is an image identified by digest, and that every environment
deploys that same digest — so promotion moves a label rather than rebuilding.
`imagetools create` does it registry-side: the source manifests "must already
exist in the registry", so nothing is pulled or rebuilt. What varies per
environment is configuration supplied at start-up.

**★ Why is rebuilding from the same commit not equivalent?**
Because at least three things can differ between two builds — the base image
behind a mutable tag, dependency resolution, and timestamps or layer ordering.
The digest changes, which is the system telling you they are not the same image.
Reproducible builds narrow the gap and are hard; not rebuilding removes the
problem.

**★ Where does this principle genuinely break, and what do you do about it?**
Browser bundles. Build-time variables such as Vite's `VITE_*` are statically
replaced during the build, so an API URL cannot be changed at run time. The two
honest fixes are making the API same-origin so there is no URL to configure, or
having the container write a runtime `config.json` from its environment that the
app fetches before booting. A per-environment bundle is a real loss of the
guarantee, not a neutral choice.

**Is `Dockerfile.prod` ever right?**
Rarely, and not for environment differences. A genuine build-time difference —
dev dependencies, a debug toolchain — is a multi-stage `--target`, and the
dev-versus-prod image split is the one defensible case. Two Dockerfiles for
staging and production guarantee drift, because a fix to one is applied to the
other only by memory.

**How do you handle a security rebuild under this model?**
As a new release. The rebuild yields a new digest, and that digest goes through
the same promotion path as any other change. The mistake is treating it as
"redeploying what is already there" and pushing it straight to production,
because it is not the same image.

**What about a separate registry per environment?**
It is workable if regulation requires it, but the digest must be preserved when
copying — `skopeo copy` does this — and every extra hop is another place the
identity can be lost. Verify digests on arrival rather than trusting that the tag
means the same thing on both sides.

---

← Prev: [One image, three environments](README.md) · Index: [Phase 12](../README.md) · Next → [02 · Configuration from outside](02-configuration-from-outside.md)
