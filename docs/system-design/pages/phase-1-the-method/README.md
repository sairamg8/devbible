---
title: "Phase 1 — The method: requirements to deep dives"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-07. Technical claims on every page name their primary source on a `> Verified:`
> line (RFC 9110 for HTTP method semantics, the Google SRE book for SLOs and availability,
> adr.github.io for decision records, the C4 model site for diagram levels). The method itself is
> **method** — stated as such, not as a quoted standard. Interview-format observations are
> tendencies, never statistics. **No sandbox run.**

**One method, applied to every question, so that the 45 minutes are spent designing rather than
deciding what to do next.** It is the same method a design document at work follows — context,
goals and non-goals, options, decision, risks — compressed to a whiteboard: functional and
non-functional requirements, estimation, an API sketch, a data model from the access patterns, the
high-level diagram with read and write paths traced separately, the deep dives chosen on purpose,
the trade-off sentence, the failure walk, the scaling walk, cost, evolution, and the clock.
[Phase 0](../phase-0-the-interview/README.md) said what is graded; this phase is how to produce
it, in order, on the bible's [PERN storefront](../../../real-world/README.md).

🚧 **2 of 18 topics written.**

| # | Page | Tier | State |
|---|---|---|---|
| 01 | **[Functional requirements](./01-functional-requirements.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | **[Non-functional requirements](./02-non-functional-requirements.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | Back-of-the-envelope estimation | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 04 | Traffic shapes | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 05 | The API sketch | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 06 | The data model from the access patterns | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 07 | The high-level diagram | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 08 | Read path and write path, separately | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 09 | Choosing the deep dives | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 10 | Trade-offs in one sentence | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 11 | Bottlenecks and single points of failure | <span className="db-tier t-master">Master</span> | ⬜ not written yet |
| 12 | The scaling walk | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 13 | Designing for cost | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 14 | Evolution and operations | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 15 | Time management in 45 minutes | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 16 | Estimation worked examples | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 17 | The same method in writing | <span className="db-tier t-understand">Understand</span> | ⬜ not written yet |
| 18 | Diagrams that scale with the conversation | <span className="db-tier t-know">Know</span> | ⬜ not written yet |

## Phase gate

Given "design a ticket-booking service" cold, produce in twelve minutes and without prompting:
scoped functional and non-functional requirements, three estimated numbers with the arithmetic
shown, an API sketch, a first diagram with numbered flows — and name the deep dive you would
choose and why.

## Where this connects

- [Part 1 of the syllabus](../../syllabus/01-the-interview-and-the-method.md) is the inventory
  this phase is written from; [Part 2](../../syllabus/02-the-network-path-and-caching.md) is
  where the building blocks start.
- [Phase 0 — What system design interviews test](../phase-0-the-interview/README.md) is the
  rubric these steps produce evidence for; [03 · The rubric](../phase-0-the-interview/03-the-rubric.md)
  maps each step to a line.
- The storefront's own code is in the [real-world track](../../../real-world/README.md); the
  decisions made here are implemented there.
