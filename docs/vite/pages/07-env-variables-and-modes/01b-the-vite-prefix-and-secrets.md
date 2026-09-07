---
title: "The `VITE_` Prefix Is an Exposure Gate, Not a Vault"
sidebar_label: "The `VITE_` Prefix & Secrets"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [`envPrefix`](https://vite.dev/config/shared-options#envprefix), [`define`](https://vite.dev/config/shared-options#define). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The `VITE_` Prefix Is an Exposure Gate, Not a Vault

🔴 **Read the security paragraph before anything else on this page.** The most common production
incident in this area is not a *missing* variable — it is a *present* one. The prefix is an
**opt-in gate against accidental exposure**. Everything you deliberately put behind it is compiled
into a file the browser downloads.

> *"`VITE_*` variables should not contain sensitive information such as API keys. The values of these variables are bundled into your source code at build time. For production deployments, consider a backend server or serverless/edge functions to properly secure secrets."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

---

## 1. Under-The-Hood Mechanics

### The prefix

> *"Variables prefixed with `VITE_` will be exposed in client-side source code after Vite bundling. To prevent accidentally leaking env variables to the client, avoid using this prefix."*

The docs' own example says the whole thing in four lines:

```bash
# .env
VITE_SOME_KEY=123
DB_PASSWORD=foobar
```

```js
console.log(import.meta.env.VITE_SOME_KEY) // "123"
console.log(import.meta.env.DB_PASSWORD)   // undefined
```

Note the direction of the guarantee. `DB_PASSWORD` is protected **because it lacks the prefix**.
Nothing protects `VITE_SOME_KEY`. The prefix is a filter on a list, applied before substitution —
not an encryption boundary, not a scope, not a runtime check.

### Changing the prefix — and the one value it refuses

`envPrefix`, type `string | string[]`, default `VITE_`:

> *"Env variables starting with `envPrefix` will be exposed to your client source code via `import.meta.env`."*

🔴 The security callout, verbatim:

> *"`envPrefix` should not be set as `''`, which will expose all your env variables and cause unexpected leaking of sensitive information. Vite will throw an error when detecting `''`."*

That error is a feature. Vite would rather fail your build than let a config typo ship
`DATABASE_URL` to a browser. The documented way to expose **one** unprefixed variable is `define`,
not a widened prefix:

```js
define: {
  'import.meta.env.ENV_VARIABLE': JSON.stringify(process.env.ENV_VARIABLE)
}
```

The `JSON.stringify` is not decoration — `define` is a textual replacement, so an unquoted string
would be substituted as a bare identifier and become a `ReferenceError`. Full treatment on
[chunk 2](02-config-time-env-and-define.md).

---

## 2. Real-World Engineering Scenario

**A payment key that was public for four months and passed two security reviews.**

A team integrated a payment provider. The provider's dashboard shows two keys side by side —
publishable and secret — and the developer, wiring both into the frontend during a spike, prefixed
both so they would be readable from `import.meta.env`. The publishable key genuinely is public. The
secret one was now equally public, sitting as a literal in
`dist/assets/index-a1b2c3.js`, served with a one-year cache header from a CDN.

Two security reviews missed it. The first read the source and saw `import.meta.env.VITE_STRIPE_SECRET_KEY`
— which *looks* like indirection, like the value lives somewhere else. The second checked that
`.env` was gitignored, which it was. Neither review looked at the **artefact**, and the artefact is
the only place the truth is visible.

It surfaced when a secret-scanning crawler flagged the CDN URL. Remediation was not a code change —
it was rotating the key, auditing four months of API logs for use from unrecognised origins, and
accepting that every cached copy of that bundle in every intermediary still held the old value.

The rule that would have caught it costs one CI line and reads the output rather than the input:

```bash
grep -rq 'sk_live_' dist/ && { echo "secret in bundle"; exit 1; }
```

---

## 3. Production-Grade Code Example

```bash
# .env.production — committed. Everything here is public by construction.
VITE_APP_NAME=Acme Dashboard
VITE_API_URL=https://api.acme.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx     # ✅ publishable — public by design
VITE_ANALYTICS_ENABLED=true

# ⛔ NEVER. Prefixed means public. This ships to every visitor.
# VITE_STRIPE_SECRET_KEY=sk_live_xxx

# ✅ Unprefixed. Read on the server, never in the browser bundle.
STRIPE_SECRET_KEY=sk_live_xxx
DATABASE_URL=postgres://...
```

```typescript
// src/config/env.ts — coerce ONCE, at the edge, with real types.
// Nothing downstream touches import.meta.env directly.

/** Env values are always strings. Coerce deliberately; never compare to a boolean. */
const asBool = (v: string | undefined, fallback = false): boolean =>
  v === undefined ? fallback : v === 'true';

const required = (v: string | undefined, name: string): string => {
  // Fail at module evaluation, in CI, not at 3am inside a click handler.
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

export const env = {
  apiUrl: required(import.meta.env.VITE_API_URL, 'VITE_API_URL'),
  appName: import.meta.env.VITE_APP_NAME ?? 'App',
  analyticsEnabled: asBool(import.meta.env.VITE_ANALYTICS_ENABLED),
  stripeKey: required(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY, 'VITE_STRIPE_PUBLISHABLE_KEY'),

  // Built-ins are already typed — no coercion needed.
  mode: import.meta.env.MODE,
  isProdBuild: import.meta.env.PROD,
  baseUrl: import.meta.env.BASE_URL,
} as const;
```

```typescript
// vite.config.ts — widening the prefix, when a second tool genuinely needs one.
import { defineConfig } from 'vite';

export default defineConfig({
  // string | string[]. Multiple prefixes are legal.
  // '' is NOT — Vite throws, deliberately, rather than exposing everything.
  envPrefix: ['VITE_', 'PUBLIC_'],
});
```

```bash
# CI — the two checks that would have caught the scenario above.
# Both read dist/, because the artefact is the only place the truth is visible.
- run: yarn build
- name: Audit what actually shipped
  run: |
    echo "Exposed keys:"; grep -roh 'VITE_[A-Z0-9_]*' dist/ | sort -u
    if grep -rqE 'sk_live_|sk_test_|-----BEGIN|xox[baprs]-' dist/; then
      echo "::error::secret material found in dist/"; exit 1
    fi
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Believing the prefix protects the value

```typescript
// ❌ WRONG. The prefix decides WHETHER the value is exposed, not whether it is safe.
// This string is in dist/assets/index-*.js. Anyone can read it. So can a crawler.
const stripe = new Stripe(import.meta.env.VITE_STRIPE_SECRET_KEY);

// ✅ CORRECT. Secrets never enter a client bundle. The browser calls your server;
// the server holds the key — "consider a backend server or serverless/edge
// functions to properly secure secrets."
const res = await fetch('/api/checkout', { method: 'POST', body: JSON.stringify(cart) });
```

The rule that actually holds: **if it must stay secret, it must not have the prefix.** There is no
third option and no config flag that creates one.

### ⚠️ Pitfall 2 — Widening `envPrefix` without re-auditing

Adding `'PUBLIC_'` to `envPrefix` retroactively exposes **every** `PUBLIC_*` variable already in
every `.env` file in the repository — including ones a different team added years ago for a
different tool, under an assumption about that prefix that no longer holds. Widening the prefix is
not a local change; run the `dist/` audit immediately after, in the same pull request.

---

## Gotchas

**★ Symptom: a secret key appears in `dist/assets/index-*.js` and in the browser's Sources tab.** Cause: it was defined with the `VITE_` prefix (or a widened `envPrefix`), and the prefix is an opt-in to *exposure*; the values are *"bundled into your source code at build time."* Fix: drop the prefix, move the read to a server route, and treat the key as compromised — rotate it, because it was in a public artefact behind a long cache header.

```bash
# .env
- VITE_STRIPE_SECRET_KEY=sk_live_...   # public. rotate this key.
+ STRIPE_SECRET_KEY=sk_live_...        # server-only; never reaches import.meta.env
```

**★ Symptom: `envPrefix: ''` fails the build with an error rather than exposing everything.** Cause: deliberate — *"Vite will throw an error when detecting `''`."* Fix: name the prefixes you actually want. If the goal was one unprefixed variable, use `define`.

```js
envPrefix: ['VITE_', 'PUBLIC_'],   // ✅  not ''
```

**★ Symptom: adding a prefix to `envPrefix` exposes variables nobody intended.** Cause: the option is a filter over the whole loaded environment, not a per-variable opt-in — it applies retroactively to every matching key in every `.env` file. Fix: audit `dist/` in the same change, and prefer `define` when the requirement is genuinely one variable.

**★ Symptom: a teammate adds `VITE_` to a server-only variable to "make it easier to debug".** Cause: the prefix is the *only* gate, so a one-line debugging convenience is a permanent exposure. Fix: make the audit a CI failure rather than a review convention — the scenario on this page passed two human reviews and failed one grep.

---

## Interview questions

**★ Why does Vite require a `VITE_` prefix instead of just exposing `process.env`?**
Because the browser bundle is public, so the default has to be *deny*. A build tool that exposed the
whole environment would put every `AWS_SECRET_ACCESS_KEY` on a developer's laptop one
`console.log` away from a production artefact. The prefix inverts that: nothing is exposed unless
someone typed six extra characters, which makes exposure deliberate, greppable and reviewable. The
follow-up that separates people who read the docs from people who have shipped: **the prefix
protects the variables you didn't prefix.** It does nothing for the ones you did — those are
*"bundled into your source code at build time"* and are public by construction.

**★ You need one unprefixed variable in the client. What do you do?**
Not `envPrefix: ''` — Vite throws on that specifically, because it would expose everything. The
documented escape hatch is `define`, targeting the single key:
`define: { 'import.meta.env.ENV_VARIABLE': JSON.stringify(process.env.ENV_VARIABLE) }`. The
`JSON.stringify` is required because `define` performs a textual replacement, so an unquoted string
would be substituted as a bare identifier and become a `ReferenceError`. The deeper answer is that
wanting this is usually a smell: the variable is either safe to expose, in which case give it the
prefix and be honest, or it is not, and a `define` does not make it safer.

**★ Why is `VITE_FLAG=false` a classic production incident?**
Because env values are *"exposed … as strings"*, so the value is `"false"` — a non-empty string,
therefore truthy — and `if (import.meta.env.VITE_FLAG)` runs. The failure is silent and it fails
**open**, enabling the thing you tried to disable, which is the worst direction for a kill switch.
The structural fix is not to remember the comparison but to parse the environment exactly once, at a
module boundary, into a typed object, so the coercion is written once and reviewed once rather than
re-derived at every call site.

**★ How do you prove a bundle contains no secrets?**
By reading the bundle, not the source. Static replacement means every exposed value is a literal in
`dist/`, so `grep -roh 'VITE_[A-Z0-9_]*' dist/ | sort -u` enumerates the entire exposed surface, and
a second grep for secret *shapes* — `sk_live_`, `-----BEGIN`, `xox[baprs]-` — catches the case where
someone prefixed something they shouldn't have. Both belong in CI as failing checks rather than in a
review checklist. The scenario on this page is the argument: it passed two human security reviews
because both read the source, where `import.meta.env.VITE_STRIPE_SECRET_KEY` *looks* like
indirection.

---

← [Build-Time vs Runtime Config](01a-build-time-vs-runtime-config.md) · [Vite overview](../../README.md) · Next → [Built-In Constants & the String-Typing Trap](01c-built-in-constants-and-typing.md)
