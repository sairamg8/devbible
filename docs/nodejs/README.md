---
title: "Node.js — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 against the Node.js v26.7.0 API index.

The complete topic inventory for Node.js, tiered for **mastery in fullstack
application development**. 13 phases, split into 4 parts to stay under the
300-line file cap.

## Version facts

| | |
|---|---|
| Current release | **Node.js 26** (26.7.0) — shipped **5 May 2026** |
| Active LTS | **Node.js 24** — maintained through 30 Apr 2028 |
| Node 26 → LTS | October 2026, supported through 30 Apr 2029 |
| Release model | Changes with **v27**: one major per year, every release LTS |
| v27 dates | Alpha opens **Oct 2026**; **27.0.0 ships April 2027**, LTS Oct 2027, EOL April 2030 |
| Build on today | **Node 24 LTS** in production · **Node 26** to learn what's next |

The odd/even "unstable vs stable" rule is the most outdated Node advice still in
circulation. It ends with v27: **one major each April, LTS each October.** Note
that October 2026 is when the v27 *alpha* opens, not when v27 ships — the release
itself is April 2027.

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[Foundations](syllabus/01-foundations.md)** | Runtime model, modules, async & the event loop | 0–2 |
| 2 | **[Core I/O](syllabus/02-core-io.md)** | Buffers, streams, filesystem, networking, processes | 3–5 |
| 3 | **[Application layer](syllabus/03-application.md)** | Data access, background work, security, testing | 6–9 |
| 4 | **[Production](syllabus/04-production.md)** | Observability, deployment, native & advanced | 10–12 |

## Explanations

The explanations live separately, in **[Explanations](./pages/README.md)** —
one page per topic, with code, gotchas and interview questions.

import Progress from '@site/src/components/Progress';

<Progress lang="nodejs" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |
| <span className="db-tier t-when">When Needed</span> | Don't study upfront |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 74 | 30% |
| <span className="db-tier t-understand">Understand</span> | 93 | 37% |
| <span className="db-tier t-know">Know</span> | 51 | 21% |
| <span className="db-tier t-when">When Needed</span> | 30 | 12% |
| **Total** | **248** | |

By part: Foundations 55 · Core I/O 67 · Application 79 · Production 47.

If you only ever finish the <span className="db-tier t-master">Master</span> set, you are a competent Node backend
developer. The rest is range.

## Prerequisites

JavaScript through closures, prototypes, and **promises**. The event loop is
unlearnable without promises — do not start Phase 2 before that is solid.

## Reading order

Phases are sequential and the order is load-bearing. Two rules:

1. **Do not skip Phase 0.** Every "Node is weird" complaint traces back to
   skipping the runtime model.
2. **Do not start Express before Phase 5.** Express is a thin layer over
   `node:http`. Learning it first means learning the abstraction without the thing
   it abstracts, and you will never debug it well.

Phases 6–12 are more parallelizable — Security and Testing can run alongside
whatever you're building.

## Sources

- [Node.js v26.7.0 API docs](https://nodejs.org/docs/latest/api/)
- [Evolving the Node.js Release Schedule](https://nodejs.org/en/blog/announcements/evolving-the-nodejs-release-schedule)
- [Node.js 26.0.0 release notes](https://nodejs.org/en/blog/release/v26.0.0)
- [Modules: TypeScript](https://nodejs.org/api/typescript.html) · [node:sqlite](https://nodejs.org/api/sqlite.html)
- [endoflife.date/nodejs](https://endoflife.date/nodejs) · [roadmap.sh/nodejs](https://roadmap.sh/nodejs)
