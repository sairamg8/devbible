---
title: "Phase 10 — Strictness and correctness"
sidebar_label: "Phase 10 · Strictness and correctness"
sidebar_position: 10
---

> Verified: 2026-08 against the **`tsconfig` reference** on typescriptlang.org,
> the **TypeScript handbook**, and the **compiler's own option and diagnostic
> tables**, read rather than recalled — the message strings compiled into the
> **TypeScript 7.0.2** native binary, with codes from the numbered table in the
> **5.9.3** JavaScript build. Targets **TypeScript 7.0.2** and **Node 24.19.0**.
> **No sandbox, no console blocks** — where a measurement is needed, phase 0's
> recorded `sandbox/ts-p0/` runs are cited rather than re-derived.

**13 topics.** `strict: true` is the start, not the finish.

Phases 0–7 built up what the type system can express. This phase asks the
uncomfortable follow-up: **how much of that is actually guaranteed?** The answer
is "less than you think, and the gap is documented" — and knowing exactly where
the gap is turns out to be more useful than pretending it is not there.

> **Trusting a guarantee you do not have is worse than having no guarantee.**
> A `string` that might be `undefined`, an array index that might be empty, an
> `as` nobody checked — each is a place where the compiler stopped protecting you
> and did not say so. This phase is the map of those places.

The phase splits into three moves:

1. **Turn the flags up** — `strict` and the several correctness flags it does
   *not* include, each with the specific bug class it finds.
2. **Know where the soundness holes are** — TypeScript is unsound *by design* in
   about six places, all deliberate trade-offs for usability. They are worth
   naming, because every one of them is a runtime error the build cannot catch.
3. **Contain the escapes** — `any`, `as`, and `@ts-ignore` are the three ways a
   codebase quietly opts out. Containing them is a process problem with a
   type-system component.

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [`strict` flag by flag](./01-strict-flag-by-flag/README.md) *(3 chunks)* | <span className="db-tier t-master">Master</span> | The **nine** flags `strict` turns on — not seven — and the specific bug each one rejects |
| 02 | [`noUncheckedIndexedAccess`](./02-nouncheckedindexedaccess.md) | <span className="db-tier t-master">Master</span> | `arr[0]` and `record[key]` become `T \| undefined` — the flag that finds the most real bugs and annoys people most |
| 03 | [Containing `any`](./03-containing-any.md) | <span className="db-tier t-master">Master</span> | The four doors it enters through, and how it spreads silently once inside |
| 04 | [Reading a TypeScript error](./04-reading-a-typescript-error.md) | <span className="db-tier t-master">Master</span> | Start at the innermost message, read the property path first, ignore the outer noise |
| 05 | [`exactOptionalPropertyTypes`](./05-exactoptionalpropertytypes/README.md) *(4 chunks)* | <span className="db-tier t-understand">Understand</span> | "Absent" vs "present and `undefined`", and the API bugs that difference causes |
| 06 | [The other correctness flags](./06-the-other-correctness-flags/README.md) *(5 chunks)* | <span className="db-tier t-understand">Understand</span> | `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`/`noUnusedParameters` — plus `allowUnreachableCode`/`allowUnusedLabels`, whose default is a third state |
| 07 | [Where TypeScript is unsound by design](./07-unsound-by-design/README.md) *(5 chunks)* | <span className="db-tier t-understand">Understand</span> | Assertions, `any`, index access, method bivariance, mutation through an alias, `Object.keys` — plus object spread, and which two nobody opts into |
| 08 | [`@ts-expect-error` vs `@ts-ignore` vs `@ts-nocheck`](./08-suppression-directives/README.md) *(4 chunks)* | <span className="db-tier t-understand">Understand</span> | Why the first is the only acceptable one — it fails when the error goes away |
| 09 | [Excess property checks vs assignability](./09-excess-property-checks/README.md) *(4 chunks)* | <span className="db-tier t-understand">Understand</span> | Why an object literal errors where an identically-shaped variable does not |
| 10 | [The error codes you will actually meet](./10-the-error-codes/README.md) *(14 chunks)* | <span className="db-tier t-understand">Understand</span> | 2322, 2345, 2339, 2367, 2551, 7053, 18046, 18048, 2589 — and 🔴 why the **generic** message is always a ladder's last rung, so a bare `TS2339` says more than a specific one |
| 11 | [typescript-eslint type-aware rules](./11-typescript-eslint/README.md) *(🚧 7 of 9 chunks)* | <span className="db-tier t-understand">Understand</span> | ⚠️ The syllabus said *"the checks the compiler will not do"* — **half of that is wrong**: `no-unnecessary-condition` overlaps **seven** compiler codes, so the topic states the exact leftover instead. Plus the CI cost, quoted from typescript-eslint |
| 12 | Assertion discipline | <span className="db-tier t-understand">Understand</span> | Treating every `as` as a review comment, and the guard that should have been written |
| 13 | Designing APIs `unknown`-first | <span className="db-tier t-know">Know</span> | Making the caller prove the shape, rather than trusting a parameter type |

*(Pages are linked from this table as they are written.)*

## What this phase deliberately does not repeat

Several of these flags already have a page arguing them **in context**, and those
pages are better read there. This phase owns the *general* rule; the applied
version stays where it is:

- **`strict`'s default of `true`** is measured in
  [phase 0 · `strict`](../phase-0-how-typescript-runs/05-strict.md), from
  `tsc --help --all`. It is cited here, not re-derived.
- **`useUnknownInCatchVariables`** belongs to
  [phase 2 · `unknown` in `catch`](../phase-2-narrowing/12-unknown-in-catch.md),
  with the server consequences in
  [phase 7 · `catch (e: unknown)`](../phase-7-server/04-catch-e-unknown/README.md).
- **`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` on a server** —
  the `req.params` case and the `PATCH`-clears-a-field data-loss bug — are in
  [phase 7 · the annotated configs](../phase-7-server/01-tsconfig-for-a-node-service/04-the-annotated-configs.md).
- **`skipLibCheck` as a correctness trade** is in
  [phase 7 · `target`, `lib` and types](../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md).
  Phase 12 covers it again as a *performance* lever — a different question about
  the same flag.

## Phase gate

Move on when you can **turn `noUncheckedIndexedAccess` on in a real codebase and
fix the first twenty errors without a single `!` or `as`** — and when, shown a
40-line assignability error, you can find the one line that matters in under a
minute.

The failure this gate catches is the codebase that turned every flag on and then
suppressed its way back to where it started. A `!` is not a fix; it is the same
unchecked access with the warning removed.

## Where this connects

- **← [Phase 0 · `strict`](../phase-0-how-typescript-runs/05-strict.md)** — the
  measured default. ⚠️ That page says *seven* flags; the option table says **nine**
  ([topic 01](./01-strict-flag-by-flag/01-what-strict-actually-is.md)).
- **← [Phase 2 · Narrowing](../phase-2-narrowing/README.md)** — `strictNullChecks`
  is what makes narrowing mean anything at all.
- **← [Phase 7 · TypeScript on the server](../phase-7-server/README.md)** — every
  flag here has a concrete server consequence there.
- **→ Phase 12 · Tooling, performance and testing** *(not written yet)* — where
  the checks actually run, and what it costs to run them.

---

← [TypeScript explanations index](../README.md) · Start → [01 · `strict` flag by flag](./01-strict-flag-by-flag/README.md)
