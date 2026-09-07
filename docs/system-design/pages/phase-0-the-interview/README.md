---
title: "Phase 0 — What system design interviews test"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-07. Technical claims on every page name their primary source on a `> Verified:`
> line (the Google SRE book, the Dynamo and Raft papers, Norvig's timing table). Interview-format
> observations are **tendencies, never statistics** — no company is quoted, no percentage invented.
> **No sandbox run**; these pages carry design reasoning and short code, never program output.

**A design round is not a knowledge quiz. It grades judgement under ambiguity — whether you scope
before you build, reason from numbers, name trade-offs unprompted, and go deep on one thing when
asked.** That is also what a senior engineer is paid for at work, so this phase is about seeing the
rubric clearly enough to hit it on purpose. Everything later in the track is a building block; this
phase is how the building blocks get graded.

🚧 **7 of 13 topics written.**

| # | Page | Tier | State |
|---|---|---|---|
| 01 | **[What "design" means at each level](./01-what-design-means-at-each-level.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 01b | **[Staff, and reading the room](./01b-staff-and-reading-the-room.md)** | <span className="db-tier t-master">Master</span> | ✅ written — 01 and 01b are one topic in two files |
| 02 | **[The three rounds that carry the word "design"](./02-the-three-design-rounds.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | **[The rubric interviewers actually hold](./03-the-rubric.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | **[The vocabulary contract](./04-the-vocabulary-contract.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | **[The latency ladder](./05-the-latency-ladder.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | **[Reading the question](./06-reading-the-question.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 07 | **[The common ways to fail](./07-the-common-ways-to-fail.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 08 | Why a reasoned wrong answer beats a memorised right one | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 09 | Communication mechanics | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 10 | How to practise | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 11 | Whiteboard and remote tooling | <span className="db-tier t-know">Know</span> | ⬜ not written yet |
| 12 | Primary sources behind the folklore | <span className="db-tier t-know">Know</span> | ⬜ not written yet |
| 13 | How this track relates to the rest of the bible | <span className="db-tier t-know">Know</span> | ⬜ not written yet |

## Phase gate

Move on when you can explain, in two minutes and without notes, what separates a senior answer from
an SDE-2 answer to "design a URL shortener" — and name the three things the interviewer is listening
for that a diagram alone cannot show.

## Where this connects

- [Part 1 of the syllabus](../../syllabus/01-the-interview-and-the-method.md) is the inventory this
  phase is written from; phase 1 there (the method) is what these pages assume you will apply next.
- The running example is the bible's [PERN storefront](../../../real-world/README.md) — catalog, cart,
  checkout, orders — because every classic question is one of its features at scale.
- The mechanics live in the other tracks: [Node](../../../nodejs/README.md),
  [Java](../../../java/README.md), [PostgreSQL](../../../postgresql/README.md),
  [Redis](../../../redis/README.md). This track adds the *decisions*.
