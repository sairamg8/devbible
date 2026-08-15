---
title: "ONBUILD"
sidebar_label: "17 · ONBUILD"
sidebar_position: 17
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the [Dockerfile reference — ONBUILD](https://docs.docker.com/reference/dockerfile/#onbuild)
> and [Dockerfile best practices](https://docs.docker.com/build/building/best-practices/).
> **No sandbox** — no console output on this page.

**`ONBUILD` records an instruction that runs in the *child* build — the one that
uses your image as its base.** It is the one Dockerfile instruction that acts at
a distance, which is exactly why it surprises everyone and why it has fallen out
of use.

## What it does

```dockerfile
# base image: myorg/node-base
FROM node:24-slim
WORKDIR /app
ONBUILD COPY package*.json ./
ONBUILD RUN npm ci --omit=dev
ONBUILD COPY . .
```

Building **that** image runs nothing — the `ONBUILD` lines are only recorded.
Then:

```dockerfile
# a downstream service
FROM myorg/node-base
CMD ["node", "server.js"]
```

Building the child triggers the three recorded instructions, **immediately after
its `FROM`**, before anything the child wrote. The two-line child Dockerfile has
copied files, installed dependencies and copied source.

## Why it surprises people

- **The instructions are invisible in the child.** A reader sees `FROM
  myorg/node-base` and two lines. Debugging why a file exists means running
  `docker image inspect` on the base to find `Config.OnBuild` — which nobody
  thinks to do.
- **They run before everything.** `ONBUILD COPY . .` executes before the child's
  own instructions, so the child cannot prepare anything first.
- **They inherit the child's build context**, so they can fail with confusing
  errors when the child's layout differs from what the base assumed.
- **They are not chained.** `ONBUILD` triggers are cleared for the grandchild —
  an image built `FROM` the child does **not** inherit them. Useful, and one more
  thing to remember.
- **`ONBUILD ONBUILD` is not allowed**, nor are `FROM` and `MAINTAINER` as
  triggers.

## Reading them

```bash
docker image inspect --format '{{json .Config.OnBuild}}' myorg/node-base
```

If a child build does something you did not write, this is the command. Worth
running on any unfamiliar base image whose builds behave oddly.

## Why it has fallen out of use

`ONBUILD` was popular for language "template" images — the `onbuild` variants of
official images, which have since been **deprecated and removed**. The reasons
generalise:

- **Multi-stage builds** solve the sharing problem better and visibly: the child
  writes its own instructions and copies artefacts explicitly (page 01, Phase 4).
- **Explicit is better in build files**, where debuggability matters more than
  brevity. Three visible lines beat two invisible ones.
- **Templating outside the Dockerfile** — a generator, a shared CI workflow, or a
  documented snippet — gives reuse without action at a distance.

Docker's own best-practices guidance is cautious about it, and the removal of the
`onbuild` official variants is the ecosystem's verdict.

## When it is still defensible

A narrow case: an internal base image used by many small services with an
identical, stable build shape, in an organisation where the base image's
behaviour is well known and documented.

Even then, weigh it against a shared CI workflow or a template repository, which
achieve the same consolidation without hiding steps from the file a developer
actually reads.

## Podman

`ONBUILD` is supported and behaves the same way; `podman image inspect` reports
`OnBuild` triggers identically. No divergence here.

## Gotchas

**Symptom:** A child build copies files or installs dependencies that its
Dockerfile never mentions.
**Cause:** `ONBUILD` triggers in the base image.
**Fix:** `docker image inspect --format '{{json .Config.OnBuild}}' <base>`.

**Symptom:** A child build fails on a path that does not exist in its repository.
**Cause:** An `ONBUILD COPY` assuming a layout the child does not have.
**Fix:** Either match the expected layout or stop using the base. This
brittleness is the core objection to `ONBUILD`.

**Symptom:** A grandchild image does not get the triggers.
**Cause:** Correct — triggers fire once, in the immediate child, and are not
inherited further.
**Fix:** Nothing; know the rule.

**Symptom:** `ONBUILD` instructions run before the child's `ARG` values are set.
**Cause:** They execute immediately after `FROM`, before the child's own
instructions.
**Fix:** Do not depend on child-set values inside `ONBUILD`. That ordering cannot
be changed.

## Interview questions

**★ What does `ONBUILD` do?**
Records an instruction in the image's config that executes in the **child** build
— the one using this image as its base — immediately after that child's `FROM`,
before any of the child's own instructions.

**★ Why is it discouraged?**
It acts at a distance: the child's Dockerfile does not show what will run, so
builds do things nobody can see in the file they are reading. Multi-stage builds
and shared CI templates achieve reuse explicitly, which is why the official
`onbuild` image variants were deprecated and removed.

**★ How do you find out whether a base image has `ONBUILD` triggers?**
`docker image inspect --format '{{json .Config.OnBuild}}' <image>`. This is the
first thing to check when a child build does something its Dockerfile does not
mention.

**Are `ONBUILD` triggers inherited by a grandchild image?**
No. They fire once, in the immediate child, and are cleared afterwards. An image
built from that child does not re-run them.

---

← Prev: [STOPSIGNAL and SHELL](16-stopsignal-and-shell.md) · Index: [Phase 3](README.md) · Start Phase 4 → [Build strategy: cache, multi-stage, BuildKit](../phase-4-build-strategy/README.md)
