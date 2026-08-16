---
title: "Real World — Pages"
sidebar_label: "Overview"
sidebar_position: 0
---

> One storefront, implemented layer by layer. Chapters compose the language
> sections' concept pages into working code — they link, they never re-teach.

The explanations behind the [Real World syllabus](../README.md). Phase 0 is the
spec everything else refers to; read it first.

import Progress from '@site/src/components/Progress';

<Progress lang="realworld" />

## What each phase covers

| Phase | Covers | State |
|---|---|---|
| **[0 — The app](./phase-0-the-app/README.md)** | The storefront spec, architecture and data-model overview, how to read the track | ✅ 3 / 3 |
| **[1 — The database](./phase-1-database/README.md)** | Schema, migrations, catalog query, checkout transaction, search, indexes — raw SQL + `pg` | ✅ 12 / 12 |
| **[2 — Node services](./phase-2-node-services/README.md)** | Boot, data layer, uploads, outbox + email worker, scheduled jobs, webhooks, cache, health, CLI | ✅ 10 / 10 |
| **[3 — The Express API](./phase-3-express-api/README.md)** | Structure, validation, auth, RBAC, catalog/cart/checkout endpoints, errors, rate limits, webhooks | ✅ 12 / 12 |
| **[4 — The React UI](./phase-4-react-ui/README.md)** | The storefront’s custom hooks and screens, wired to the real API | ✅ 12 / 12 |
| **[5 — JS custom functions](./phase-5-js-functions/README.md)** | Fetch wrapper, TTL cache, task queue, event bus, validation engine, Intl formatting | 🚧 1 / 10 |
| **6 — TypeScript** | Shared types, zod inference, typed `pg` results, the order state machine | *(not written yet)* |
| **7 — CSS recipes** | Product grid, checkout form, skeletons, dark mode, overlays | *(not written yet)* |
| **8 — The MongoDB mirror** | The same data layer on MongoDB for MERN | *(not written yet)* |

## The chapter shape

Every chapter is: **the problem → the design choices (with their costs) → the
full implementation → using it in the app → gotchas → interview questions.**
Code is complete and copyable — realistic names, no elisions. Implementations
are validated against the concept pages they compose and the official
documentation named in each chapter's `> Verified:` line; no fabricated
console output, anywhere.
