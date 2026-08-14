---
title: "Docker & Podman — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::info 🔒 Claimed — session `40090c06`, 2026-08-14

All of `docs/docker/` is being written by one session, in the worktree
`devbible-docker` on branch **`docker-podman`**. Other sessions: please do not
write here. Claim table: [Contents](../../README.md).

:::

> **Target: Docker Engine 29.7.2 · Compose v5.4.0 · Podman 6.1.0.** Every page is
> **documentation-validated** — the claim is checked against the official Docker
> or Podman documentation, the OCI specifications, or the relevant release notes,
> and the source is named on the page's `> Verified:` line.
>
> **There is no sandbox for this track, and that is deliberate.** No `ex*`
> script was written and nothing was run to produce evidence, so these pages
> carry **no console output blocks**. Commands are shown as commands. Nothing is
> reconstructed from memory to look like a real terminal session, because a
> plausible-looking invented output is worse than none.
>
> Where the documentation genuinely does not settle a question, the page says so
> rather than guessing.

One page per topic from the [syllabus](../README.md), with the commands, the
mental model, gotchas written symptom → cause → fix, and interview questions with
answers.

## Phases

| Phase | Topics | Written | Status |
|---|---|---|---|
| **00 · What a container actually is** | 14 | 0 | ⏳ Not started |
| **01 · Running containers** | 16 | 0 | ⏳ Not started |
| **02 · Images, layers and registries** | 15 | 0 | ⏳ Not started |
| **03 · The Dockerfile** | 18 | 0 | ⏳ Not started |
| **04 · Build strategy: cache, multi-stage, BuildKit** | 16 | 0 | ⏳ Not started |
| **05 · Image quality, size and supply chain** | 12 | 0 | ⏳ Not started |
| **06 · Storage: volumes, mounts and data** | 12 | 0 | ⏳ Not started |
| **07 · Networking** | 14 | 0 | ⏳ Not started |
| **08 · Compose** | 17 | 0 | ⏳ Not started |
| **09 · The MERN/PERN stack in containers** | 14 | 0 | ⏳ Not started |
| **10 · Running containers in production** | 16 | 0 | ⏳ Not started |
| **11 · Podman in depth** | 16 | 0 | ⏳ Not started |
| **12 · Delivery, CI and orchestration** | 12 | 0 | ⏳ Not started |
| **Total** | **192** | **0** | |

import Progress from '@site/src/components/Progress';

<Progress lang="docker" />

## How a page is built

Every page carries, in this order:

1. A **tier badge** and a `> Verified:` line naming the documentation it was
   checked against.
2. The **concept** — what the thing is and why it exists, before any flag.
3. The **commands**, shown as commands, with what each flag changes.
4. **Both engines** where they differ: a Docker column and a Podman column, or an
   explicit note that the behaviour is identical.
5. **Gotchas**, written symptom → cause → fix.
6. **Interview questions** with answers.

## Where this connects

- **[Node.js](../../nodejs/README.md)** — Phase 9 containerises exactly the
  server that track teaches; PID 1 and graceful shutdown are the same topic seen
  from two sides.
- **[PostgreSQL](../../postgresql/README.md)** and
  **[MongoDB](../../mongodb/README.md)** — the database phases assume you can run
  one locally; Phase 9 is how.
- **[Git](../../git/README.md)** — `.dockerignore` and `.gitignore` solve
  different problems and are constantly confused.

---

← Syllabus: [Docker & Podman](../README.md)
