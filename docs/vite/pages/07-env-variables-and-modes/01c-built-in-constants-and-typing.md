---
title: "The Five Built-In Constants, and Why Your Variables Are Always Strings"
sidebar_label: "Built-Ins & the String Trap"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [Shared Options](https://vite.dev/config/shared-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Five Built-In Constants, and Why Your Variables Are Always Strings

[Chunk 1b](01b-the-vite-prefix-and-secrets.md) covered which variables reach the client. This one
covers **what type they arrive as** — and the answer splits cleanly in two, which is the single most
useful thing to internalise here.

---

## 1. Under-The-Hood Mechanics

### The five built-in constants

Available regardless of any `.env` file:

| Constant | Type | Documentation |
|---|---|---|
| `import.meta.env.MODE` | `string` | *"the mode the app is running in"* |
| `import.meta.env.BASE_URL` | `string` | *"the base url the app is being served from. This is determined by the `base` config option"* |
| `import.meta.env.PROD` | `boolean` | *"whether the app is running in production (running the dev server with `NODE_ENV='production'` or running an app built with `NODE_ENV='production'`)"* |
| `import.meta.env.DEV` | `boolean` | *"always the opposite of `import.meta.env.PROD`"* |
| `import.meta.env.SSR` | `boolean` | *"whether the app is running in the server"* |

### The seam: computed values vs values read off disk

🔴 **The built-ins are typed. Your variables are not.**

> *"Vite exposes env variables under the `import.meta.env` object as strings automatically."*

> *"As shown above, `VITE_SOME_KEY` is a number but returns a string when parsed. The same would also happen for boolean env variables. Make sure to convert to the desired type when using it in your code."*

This is not an inconsistency, it is a seam:

```
COMPUTED BY VITE                      READ FROM A .env FILE
────────────────                      ─────────────────────
MODE, BASE_URL      → string          every VITE_* variable → string
PROD, DEV, SSR      → boolean                              ALWAYS

Vite derives these from NODE_ENV      dotenv parses a text format.
and from config, so it knows          A text format cannot express
their types.                          a boolean or a number.
```

`PROD`/`DEV`/`SSR` really are booleans. `VITE_ANALYTICS_ENABLED=false` really is the seven-character
string `"false"` — which is **truthy**. Knowing which side of the seam a constant lives on tells you
immediately whether you have to coerce it.

---

## 2. Real-World Engineering Scenario

**A port that became a five-digit number, and a timeout that became `NaN`.**

A team moved their dev-tooling config into `.env` so it could vary per developer. Two values went
along for the ride:

```bash
VITE_PORT=3000
VITE_TIMEOUT_MS=5000
```

```typescript
const port = import.meta.env.VITE_PORT + 1;          // "30001", not 3001
const timeout = import.meta.env.VITE_TIMEOUT_MS * 2; // 10000 — this one worked
```

The first line concatenated, because `+` on a string does. The second **multiplied correctly**,
because `*` coerces — so half the code appeared to prove that env values were numbers. That
inconsistency is what made it survive review: a reviewer checking `VITE_TIMEOUT_MS` would have found
nothing wrong.

The port bug surfaced as a proxy that never connected. The real cost came later, when a developer
without the variable set hit `Number(undefined)` → `NaN`, and `setTimeout(fn, NaN)` fires
**immediately** rather than throwing — turning a config gap into a retry storm against a staging
API.

The fix was structural rather than local: one module that reads every variable, coerces it, and
**throws on anything invalid**, so a missing or malformed value fails at boot in CI instead of
producing a plausible-looking wrong number deep in a call stack.

---

## 3. Production-Grade Code Example

```typescript
// src/config/env.ts — the coercion boundary. Nothing downstream touches
// import.meta.env directly, so every conversion is written once and reviewed once.

const required = (v: string | undefined, name: string): string => {
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

/** "true" → true. Everything else → false. Never trust truthiness here. */
const asBool = (v: string | undefined, fallback = false): boolean =>
  v === undefined ? fallback : v === 'true';

/** Rejects '', undefined and 'abc' — all of which Number() turns into 0 or NaN. */
const asInt = (v: string | undefined, name: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer, got ${JSON.stringify(v)}`);
  return n;
};

export const env = {
  // ── read from disk: ALWAYS strings, always coerced ────────────────────────
  apiUrl: required(import.meta.env.VITE_API_URL, 'VITE_API_URL'),
  analyticsEnabled: asBool(import.meta.env.VITE_ANALYTICS_ENABLED),
  timeoutMs: asInt(import.meta.env.VITE_TIMEOUT_MS, 'VITE_TIMEOUT_MS'),

  // ── computed by Vite: already correctly typed, do NOT coerce ──────────────
  mode: import.meta.env.MODE,          // string
  isProdBuild: import.meta.env.PROD,   // boolean
  baseUrl: import.meta.env.BASE_URL,   // string
} as const;
```

```typescript
// The same boundary with a schema library, when the surface grows past a handful.
// z.coerce.* exists precisely because every env value arrives as a string.
import { z } from 'zod';

export const env = z
  .object({
    VITE_API_URL: z.string().url(),
    VITE_TIMEOUT_MS: z.coerce.number().int().positive(),
    VITE_ANALYTICS_ENABLED: z.enum(['true', 'false']).transform((v) => v === 'true'),
  })
  .parse(import.meta.env);   // throws at module evaluation — i.e. in CI, not at 3am
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Comparing a string to a boolean

```typescript
// ❌ WRONG. The value is the string "false" — truthy — and this comparison is
//    string === boolean, so it is NEVER true either way.
if (import.meta.env.VITE_ANALYTICS_ENABLED === true) { /* never runs */ }

// ❌ WORSE. This ALWAYS runs, including when the variable is set to false.
if (import.meta.env.VITE_ANALYTICS_ENABLED) { /* always */ }

// ✅ CORRECT.
if (import.meta.env.VITE_ANALYTICS_ENABLED === 'true') { /* correct */ }
```

The second form is the dangerous one: it is what people write instinctively, and it is wrong in the
direction of *enabling* things.

### ⚠️ Pitfall 2 — `Number()` on a missing variable

`Number(undefined)` is `NaN` and `Number('')` is `0`. Neither throws. A missing `VITE_TIMEOUT_MS`
therefore becomes a timeout of `NaN`, and `setTimeout(fn, NaN)` fires immediately instead of
erroring — a config gap turns into a retry storm. Always validate the coerced result, never just
the coercion.

### ⚠️ Pitfall 3 — Coercing the built-ins

`import.meta.env.PROD === 'true'` is always `false`: `PROD` is already a real boolean. Applying the
string-coercion habit uniformly across `import.meta.env` inverts exactly the values you most want
correct. Know which side of the seam each constant is on.

---

## Gotchas

**★ Symptom: a feature flag set to `false` is on in production.** Cause: `import.meta.env.VITE_FLAG` is the string `"false"`, which is truthy. Fix: coerce once at the edge and never read `import.meta.env` inside a component.

```ts
export const flagOn = import.meta.env.VITE_FLAG === 'true';   // ✅ explicit
```

**★ Symptom: `VITE_PORT=3000` used in arithmetic produces `"30001"` instead of `3001`.** Cause: values are strings, so `+` concatenates while `*` and `-` coerce — so half your arithmetic appears to work, which is why this survives review. Fix: `Number(...)` at the boundary, and validate the result.

```ts
const port = Number(import.meta.env.VITE_PORT);
if (!Number.isInteger(port)) throw new Error('VITE_PORT must be an integer');
```

**★ Symptom: a timeout fires instantly, or a retry loop hammers an API.** Cause: `Number(undefined)` is `NaN`, `setTimeout(fn, NaN)` is treated as `0`, and nothing threw. Fix: validate every coerced number with `Number.isInteger` / `Number.isFinite` and throw at module evaluation, so it fails in CI rather than under load.

**★ Symptom: `import.meta.env.PROD === 'true'` is always false.** Cause: `PROD` is a genuine boolean — one of the five built-ins Vite computes rather than reads from disk. Fix: compare it as a boolean. The rule to carry: coerce what came from a `.env` file, never what Vite computed.

**★ Symptom: a `.env` value that looks like a number is rejected by a strict schema.** Cause: the docs are explicit — *"`VITE_SOME_KEY` is a number but returns a string when parsed."* Fix: this is exactly what `z.coerce.number()` is for, applied once in the config module so the rest of the app receives real types.

**★ Symptom: `import.meta.env.MODE` and `import.meta.env.PROD` disagree.** Cause: they are driven by different inputs — mode by `--mode`, `PROD` by `NODE_ENV`. They are *supposed* to be able to disagree. Fix: read [chunk 1e](01e-modes-and-node-env.md); using one to answer the other's question is the single most expensive mistake in this topic.

---

## Interview questions

**★ `import.meta.env.PROD` is a boolean but `import.meta.env.VITE_DEBUG` is a string. Why the inconsistency?**
They come from different places. `PROD`, `DEV`, `SSR`, `MODE` and `BASE_URL` are **built-ins** —
Vite computes them from `NODE_ENV` and from config, so it knows their types. Everything else comes
out of a `.env` file, and a `.env` file is a text format with no type system; `dotenv` produces
strings because that is all the format can express. It is not an inconsistency so much as a seam
between "values Vite computed" and "values Vite read off disk", and knowing which side a constant is
on tells you whether you must coerce it. The practical follow-up is that applying the coercion habit
uniformly is its own bug: `import.meta.env.PROD === 'true'` is always `false`.

**★ Why is `VITE_FLAG=false` a classic production incident?**
Because env values are *"exposed … as strings"*, so the value is `"false"` — a non-empty string,
therefore truthy — and `if (import.meta.env.VITE_FLAG)` runs. The failure is silent and it fails
**open**, enabling the thing you tried to disable, which is the worst direction for a kill switch.
The structural fix is not to remember the comparison but to parse the environment exactly once, at a
module boundary, into a typed object — so the coercion is written once and reviewed once rather than
re-derived at every call site by whoever is in a hurry.

**★ What is wrong with `Number(import.meta.env.VITE_TIMEOUT_MS)` on its own?**
Nothing, until the variable is missing. `Number(undefined)` is `NaN` and `Number('')` is `0`, and
neither throws — so a missing value produces a *plausible* number rather than an error. `NaN` is
particularly nasty because `setTimeout(fn, NaN)` is treated as `0` and fires immediately, which
turns a configuration gap into a retry storm against whatever the callback talks to. Coercion
without validation just moves the failure somewhere less diagnosable; the coerced result has to be
checked and the check has to throw at module evaluation, so it surfaces in CI.

**★ You inherit a codebase reading `import.meta.env` in forty components. What is the first change you make?**
Introduce a single config module that reads every variable, coerces it, validates it and throws on
anything invalid — then make `import.meta.env` outside that module a lint error. The argument is not
tidiness: forty call sites means forty independent opportunities to compare a string to a boolean,
and each is invisible in review because each looks locally reasonable. Centralising also makes the
exposed surface enumerable, which is what the `dist/` audit in
[chunk 1b](01b-the-vite-prefix-and-secrets.md) depends on, and gives one obvious place to add schema
validation when the surface grows.

---

← [The `VITE_` Prefix & Secrets](01b-the-vite-prefix-and-secrets.md) · [Vite overview](../../README.md) · Next → [`BASE_URL` & `SSR`](01d-base-url-and-ssr.md)
