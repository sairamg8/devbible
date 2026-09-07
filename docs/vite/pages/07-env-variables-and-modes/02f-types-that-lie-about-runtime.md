---
title: "Types That Lie About Runtime: a `.d.ts` Describes Intent, and Nothing Checks the `.env` File"
sidebar_label: "Types That Lie"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [`define`](https://vite.dev/config/shared-options#define). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Types That Lie About Runtime

[Chunk 2e](02e-typing-import-meta-env.md) covered the augmentation that stops working. This chunk
covers the one that **works perfectly and is wrong** — and it closes the topic, because it is where
every earlier chunk's failure mode reappears with the compiler's endorsement.

---

## 1. Under-The-Hood Mechanics

### The declaration is an assertion, not a check

```ts
interface ImportMetaEnv { readonly VITE_API_URL: string }
```

TypeScript now believes `import.meta.env.VITE_API_URL` is a `string`. **Nothing verifies that any
`.env` file defines it**, and nothing can: `.env` is not part of the TypeScript program. It is a text
file read by a build tool at a completely different time.

```
vite-env.d.ts          says     VITE_API_URL: string          ← intent
.env.production        says     (nothing)                     ← reality
runtime                gets     undefined, typed as string    ← the gap
```

Downstream, every operation is a *type-safe* call on `undefined`:

```ts
import.meta.env.VITE_API_URL.trim();      // compiles. throws.
new URL(import.meta.env.VITE_API_URL);    // compiles. throws.
```

This is the general hazard of hand-written declaration files, and env variables are its purest case:
the declaration is a promise nobody can keep and nothing will check.

### The worst case: a type that contradicts the runtime

```ts
readonly VITE_FEATURE_FLAG: boolean    // ⛔ compiles, and is a lie
```

Env values are always strings. This declaration makes the compiler *endorse*
`if (import.meta.env.VITE_FEATURE_FLAG)` — which is the classic bug from
[chunk 1c](01c-built-in-constants-and-typing.md): `"false"` is truthy, so the flag is on when set to
off.

🔴 **A wrong type is worse than no type.** No type leaves a place where you would have thought. A
wrong type replaces that with an assurance not to.

### `define` declarations have the same gap, doubled

```ts
declare const __APP_VERSION__: string
```

Nothing cross-checks this against the `define` block in `vite.config.ts`. Delete or rename the config
entry and the declaration still compiles — and now the identifier is not substituted at all, so it
is a genuine `ReferenceError` rather than an `undefined`.

---

## 2. Real-World Engineering Scenario

**A required variable that was optional in exactly one environment.**

A team declared `VITE_SUPPORT_URL: string` and used it in a footer link. It was defined in `.env`,
so every environment inherited it — until someone "cleaned up" `.env` by moving environment-specific
values into `.env.production` and `.env.staging`, and moved `VITE_SUPPORT_URL` along with them.

Preview deployments used `.env.preview`. Nobody added it there.

The footer rendered `<a href="undefined">`, which browsers resolve **relative to the current page**.
So the link went to `/undefined`, which the SPA's catch-all route rendered as the app's 404 page.
Not a crash, not an error, not a broken image — a plausible-looking page reached from a support
link.

It survived because every layer degraded politely:

- TypeScript said `string`, so no narrowing was required and nobody wrote a guard.
- `undefined` interpolated into an attribute is the string `"undefined"` — valid HTML.
- The router had a catch-all, so the navigation "worked".

The fix was the validation module, and the specific value of it here is that
`required(import.meta.env.VITE_SUPPORT_URL, 'VITE_SUPPORT_URL')` **fails the preview build** rather
than shipping a link to nowhere. A missing variable should be loud at build time; the whole reason
it was quiet is that a hand-written type had promised it could not happen.

---

## 3. Production-Grade Code Example

```typescript
// src/vite-env.d.ts — declare what the SHAPE is, honestly.
/// <reference types="vite/client" />

interface ViteTypeOptions { strictImportMetaEnv: unknown }

interface ImportMetaEnv {
  // ✅ Every one of these is `string`, because that is what the runtime provides.
  readonly VITE_API_URL: string;
  readonly VITE_SUPPORT_URL: string;
  readonly VITE_FEATURE_FLAG: string;   // ⛔ NOT boolean — "false" is truthy
  readonly VITE_TIMEOUT_MS: string;     // ⛔ NOT number  — "5000" is a string
}

interface ImportMeta { readonly env: ImportMetaEnv }

// Must match the `define` block in vite.config.ts. Nothing cross-checks these.
declare const __APP_VERSION__: string;
```

```typescript
// src/config/env.ts — where the real types are established.
// Every export below has been CHECKED; the .d.ts above only described intent.
const required = (v: string | undefined, name: string): string => {
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

const asBool = (v: string | undefined, fallback = false): boolean =>
  v === undefined ? fallback : v === 'true';

const asInt = (v: string | undefined, name: string): number => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer, got ${JSON.stringify(v)}`);
  return n;
};

export const env = {
  apiUrl: required(import.meta.env.VITE_API_URL, 'VITE_API_URL'),
  supportUrl: required(import.meta.env.VITE_SUPPORT_URL, 'VITE_SUPPORT_URL'),
  featureFlag: asBool(import.meta.env.VITE_FEATURE_FLAG),
  timeoutMs: asInt(import.meta.env.VITE_TIMEOUT_MS, 'VITE_TIMEOUT_MS'),
} as const;

// `typeof env` is now: { apiUrl: string; featureFlag: boolean; timeoutMs: number }
// — types EARNED by runtime checks, not asserted in a declaration file.
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Believing the declared type

`readonly VITE_API_URL: string` is a claim about intent. Nothing verifies a `.env` file provides it.
A missing variable is `undefined` typed as `string`, and every downstream call is a type-safe
operation on `undefined`.

### ⚠️ Pitfall 2 — Typing a boolean-looking variable as `boolean`

It compiles and is a lie; the runtime value is the string `"true"`. Declare `string` and coerce at
the boundary, or the type system now endorses the classic truthiness bug.

### ⚠️ Pitfall 3 — `undefined` interpolated into markup

`` `href="${import.meta.env.VITE_X}"` `` with a missing variable produces `href="undefined"`, which
browsers resolve **relative to the current page**. The result is a real navigation to a wrong URL,
not an error — the most polite possible failure and therefore the longest-lived.

### ⚠️ Pitfall 4 — Forgetting `define` constants need separate declarations

They are globals, not `import.meta.env` properties. And if the `define` is removed from the config,
the surviving declaration turns a missing value into a `ReferenceError`.

---

## Gotchas

**★ Symptom: `.trim()` on a typed `string` throws "cannot read properties of undefined".** Cause: the declaration asserted `string`; the `.env` file never defined the key. Fix: validate once at a module boundary and export the checked object — the type must be earned by a runtime check, not asserted in a `.d.ts`.

```ts
apiUrl: required(import.meta.env.VITE_API_URL, 'VITE_API_URL'),
```

**★ Symptom: a variable declared `boolean` is `"false"` and truthy.** Cause: the declaration contradicts the runtime — env values are always strings. Fix: declare `string`, coerce at the boundary. A wrong type is worse than no type, because it suppresses the check that would have caught it.

**★ Symptom: a link renders as `href="undefined"` and navigates to a 404 page instead of erroring.** Cause: `undefined` interpolated into an attribute becomes the string `"undefined"`, which is a valid relative URL. Fix: `required(...)` at the config boundary, so a missing value fails the build instead of producing a plausible page.

**★ Symptom: a `define`d constant is declared and typed but `undefined` at runtime.** Cause: the declaration exists and the config entry does not — or was renamed. Fix: keep the declarations and the `define` block adjacent in review; nothing in the toolchain cross-checks them.

**★ Symptom: removing a `define` produces a `ReferenceError` rather than `undefined`.** Cause: an un-substituted `define` identifier is a genuine free variable, unlike `import.meta.env.X` which evaluates to `undefined`. Fix: this is the one case where the failure is *louder* than the env equivalent — take the free diagnostic and fix the config.

---

## Interview questions

**★ Your `.d.ts` says `VITE_API_URL: string` and it is `undefined` at runtime. Whose bug is it?**
Nobody's, and that is the point. The declaration is a claim about what you intend the environment to
contain; nothing in TypeScript reads a `.env` file, and nothing can — the file is not in the program.
So a hand-written declaration is an unchecked assertion, and it is *worse than no type*, because it
suppresses exactly the narrowing that would have forced you to handle the missing case. The workable
pattern inverts the direction: declare loosely, validate once at a module boundary with a function
that throws, and export an object whose type is **produced by** the validation. The type is then
earned rather than asserted, and the failure moves to module evaluation, which means CI.

**★ Should you type `VITE_FEATURE_FLAG` as `boolean`?**
No — it is a string at runtime, always, because `.env` is a text format with no type system.
Declaring it `boolean` makes the compiler endorse `if (import.meta.env.VITE_FEATURE_FLAG)`, which is
the classic bug: the string `"false"` is truthy, so the flag is on when it is set to off. This is the
general hazard of declaration files stated in one example — **a type that contradicts reality is
more harmful than a missing type**, because it converts a place where you would have thought into a
place where the compiler assures you not to. Declare `string`, coerce once, export a real `boolean`.

**★ A footer link renders as `href="undefined"` and takes users to a 404. Why did nothing catch it?**
Because every layer degraded politely. TypeScript said `string`, so no narrowing was required and
nobody wrote a guard. Interpolating `undefined` into an attribute yields the valid string
`"undefined"`. A browser resolves that relative to the current page, so it is a real URL. And a
single-page app's catch-all route renders *something* for it. Four independently reasonable
behaviours compose into a failure with no error anywhere — which is the recurring shape of every
defect in this topic, and the argument for making a missing variable throw at module evaluation,
where the failure is loud and early and impossible to route around.

---

← [Typing `import.meta.env`](02e-typing-import-meta-env.md) · [Vite overview](../../README.md) · Next → [The Validation Boundary](02g-the-validation-boundary.md)
