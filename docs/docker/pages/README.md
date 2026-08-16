---
title: "Docker & Podman — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::tip Consolidated 2026-08-15 — all work is on `main`
Every worktree and branch in this repo was **merged into `main` and deleted** on
2026-08-15. Any "worktree `devbible-…`", "branch `…`" or "not merged" note below is
**historical** — nothing is stranded, and all of it is on `main`. Work in
`/run/media/sairam/Storage/Backup/Knowledge/devbible` on `main`, and keep staging
explicit paths (never `git add -A`) since everyone shares the checkout again.
:::

:::info 🔒 Split FOUR WAYS — 2026-08-15

The **129 unwritten topics are split into four chunks, whole phases only**, so no two
sessions ever write in the same phase directory. Phases **0–3 are already written**
(63 topics, session `40090c06`).

| Chunk | Phases | Topics | Start at | Claimed by |
|---|---|---|---|---|
| **A** | 4 · 5 | 28 | 🏁 **CHUNK A COMPLETE — phases 4 (16/16) and 5 (12/12) both closed 2026-08-15** | ✅ session `e75b3868` (took over from `2e26b051`) |
| **B** | 6 · 7 | 26 | 🏁 **CHUNK B COMPLETE — phase 6 12/12, phase 7 14/14** (2026-08-15) | session `d0c46f84` — finished |
| **C** | 8 · 9 | 31 | 🏁 **CHUNK C COMPLETE — phase 8 17/17, phase 9 14/14** (2026-08-15) | 🔴 session `016J3KVb` (2026-08-15, took over from `9219957a`) |
| **D** | 10 · 11 · 12 | 44 (**6 left**) | 🏁 **Phases 10 and 11 COMPLETE, 16/16 each** · 🚧 phase 12 **6/12** — next: **Phase 12 · 07 · When Compose stops being enough** | 🔴 session `8e7b6e12` (2026-08-16, took over from `75a196a7`) |

**Taking a chunk:** put your session id in the row above **and** in that chunk's row in
the [claim table](../../README.md), then start writing. Finish the lower-numbered phase
before starting the next; inside a phase, work the syllabus table in row order.

⛔ **Cross-chunk links break the build** — where a page needs a topic another chunk owns,
write it as **bold plain text with *(not written yet)***, never a link. Stage explicit
paths, **never `git add -A`**, and remember `src/data/progress.js` has **one** docker row
that all four chunks increment.

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
| **[00 · What a container actually is](./phase-0-what-a-container-is/README.md)** | 14 | 14 | ✅ **Complete** |
| **[01 · Running containers](./phase-1-running-containers/README.md)** | 16 | 16 | ✅ **Complete** |
| **[02 · Images, layers and registries](./phase-2-images-and-registries/README.md)** | 15 | 15 | ✅ **Complete** |
| **[03 · The Dockerfile](./phase-3-dockerfile/README.md)** | 18 | 18 | ✅ **Complete** |
| **[04 · Build strategy: cache, multi-stage, BuildKit](./phase-4-build-strategy/README.md)** | 16 | 16 | ✅ **Complete** |
| **[05 · Image quality, size and supply chain](./phase-5-image-quality/README.md)** | 12 | 12 | ✅ **Complete** |
| **[06 · Storage: volumes, mounts and data](./phase-6-storage/README.md)** | 12 | 12 | ✅ **Complete** |
| **[07 · Networking](./phase-7-networking/README.md)** | 14 | 14 | ✅ **Complete** |
| **[08 · Compose](./phase-8-compose/README.md)** | 17 | 17 | ✅ **Complete** |
| **[09 · The MERN/PERN stack in containers](./phase-9-mern-pern-stack/README.md)** | 14 | 14 | ✅ **Complete — chunk C** |
| **[10 · Running containers in production](./phase-10-production/README.md)** | 16 | 16 | ✅ **Complete — chunk D** |
| **[11 · Podman in depth](./phase-11-podman-in-depth/README.md)** | 16 | 16 | ✅ **Complete — chunk D** |
| **[12 · Delivery, CI and orchestration](./phase-12-delivery-and-ci/README.md)** | 12 | 6 | 🚧 **Writing — chunk D** |
| **Total** | **192** | **186** | |

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
