---
title: "One image, three environments"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [The Twelve-Factor App — Config](https://12factor.net/config),
> [docker buildx imagetools create](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/)
> and [Compose — environment variables precedence](https://docs.docker.com/compose/how-tos/environment-variables/envvars-precedence/).
> **No sandbox** — no console output on this page.

**The image is the artefact, and there is exactly one of it.** Dev, staging and
production run the *same digest*; what differs between them arrives from outside
the image at start-up.

That is the whole idea, and almost every deployment pathology is a violation of
it: an image rebuilt per environment, a `NODE_ENV` baked in at build time, a
staging image nobody can prove matches production.

| Chunk | What it covers |
|---|---|
| **[01 · Build once, promote the digest](01-build-once-promote.md)** | Why a rebuild is a different artefact, how promotion works, the anti-patterns — and the one genuine exception |
| **[02 · Configuration from outside](02-configuration-from-outside.md)** | Where the differences legitimately live: environment variables, files, secrets, and what must never differ |

## Phase gate

This is the other half of the phase's deliverable — a pipeline that deploys
**that exact digest** to each environment, with configuration supplied per
environment rather than per build.

## Where this connects

- **[Phase 12 · 01 · Tag strategy](../01-tag-strategy/README.md)** — the digest
  is what makes "the same image" a checkable claim rather than an intention.
- **[Phase 10 · 05 · Configuration and secrets at run time](../../phase-10-production/05-config-and-secrets.md)** —
  the mechanics of getting configuration into a running container.
- **[Phase 9 · 02 · Dev image vs prod image](../../phase-9-mern-pern-stack/02-dev-vs-prod-image.md)** —
  the one place two images are genuinely correct, and why it is not a
  counter-example.
- **[Phase 8 · 11 · Override files](../../phase-8-compose/11-override-files.md)** —
  Compose's way of varying the *run*, not the image.

---

← Prev: [Building images in CI](../02-building-in-ci.md) · Index: [Phase 12](../README.md) · Start → [Build once, promote the digest](01-build-once-promote.md)
