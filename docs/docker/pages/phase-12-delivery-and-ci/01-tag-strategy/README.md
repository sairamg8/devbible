---
title: "Tag strategy"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against [docker image tag](https://docs.docker.com/reference/cli/docker/image/tag/),
> [Docker — building best practices](https://docs.docker.com/build/building/best-practices/)
> and the [OCI image specification](https://github.com/opencontainers/image-spec).
> **No sandbox** — no console output on this page.

**A tag is a mutable pointer, and every deployment problem in this phase starts
with treating it as a name.** `myapp:latest` on your machine and `myapp:latest`
on the server can be two entirely different images, and nothing will tell you.

The strategy that fixes it is one sentence: **immutable tags for machines,
moving tags for humans, and deploy by digest.** The two chunks below build the
argument and then the practice.

| Chunk | What it covers |
|---|---|
| **[01 · What a tag actually is](01-what-a-tag-is.md)** | The reference grammar, why tags are mutable by design, the digest as the real identity, and what `latest` is and is not |
| **[02 · The strategy](02-the-strategy.md)** | The rule and how to apply it — what to tag at build time, promoting by digest, base-image pinning, retention, and the rollback that follows for free |

## Phase gate

This topic is half of the phase's deliverable: a pipeline that builds one image,
**tags it by commit**, pushes it, and deploys **that exact digest** — with a
rollback you have actually tested.

## Where this connects

- **[Phase 2 · 03 · `pull`, `push`, `tag`](../../phase-2-images-and-registries/03-pull-push-tag.md)** —
  the mechanics this topic makes a policy out of.
- **[Phase 5 · 08 · Pinning by digest](../../phase-5-image-quality/08-pinning-by-digest.md)** —
  the same argument applied to the base image you build *from*, rather than the
  image you ship.
- **[Phase 11 · 10 · `podman auto-update`](../../phase-11-podman-in-depth/10-auto-update.md)** —
  what a moving tag means when something deploys it automatically at midnight.
- **[Phase 10 · 16 · Zero-downtime restarts](../../phase-10-production/16-zero-downtime-restarts.md)** —
  the restart dance a rollback depends on.

---

← Prev: [Phase 12 index](../README.md) · Start → [What a tag actually is](01-what-a-tag-is.md)
