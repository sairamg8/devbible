---
title: "What Static Replacement Costs You: Dynamic Keys, One-Artefact Promotion & Auditing a Bundle"
sidebar_label: "Build-Time vs Runtime Config"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [Shared Options](https://vite.dev/config/shared-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ What Static Replacement Costs You: Dynamic Keys, One-Artefact Promotion & Auditing a Bundle

[Chunk 1](01-environment-system.md) established the mechanism: *"statically replaced at build
time."* This chunk is about the **bill** for that mechanism. Every limitation below is the same
property viewed from a different angle, and none of them is a missing feature waiting to be
implemented — they are what you bought when you bought tree-shakeable configuration.

---

## 1. Under-The-Hood Mechanics

The docs give the *why* in a subordinate clause that is easy to skim past:

> *"These constants are defined as global variables during dev and statically replaced at build time **to make tree-shaking effective**."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode) (emphasis added)

Tree-shaking is a *static* analysis. For a bundler to delete the body of `if (import.meta.env.DEV)`,
it has to know the condition is false **while it is looking at the syntax tree**, before anything
runs. The only way to know that is to have already put the literal there. Hence:

```
SOURCE                                    BUILD OUTPUT
──────                                    ────────────
if (import.meta.env.DEV) {                (nothing — the branch and every
  mountDebugPanel()                        module it imported are gone)
}

fetch(import.meta.env.VITE_API_URL)       fetch("https://api.acme.com")
                                          ↑ a literal, not a lookup
```

Three properties fall out, in order of how often they bite:

| Property | Why | Consequence |
|---|---|---|
| The key must be a literal | textual replacement needs a name at compile time | `import.meta.env[k]` is not replaced |
| The value is frozen in the artefact | it *is* the artefact now | one build cannot serve many environments |
| Every exposed value is greppable in `dist/` | literals, not lookups | auditing is trivial — and mandatory |

The third one is a genuine benefit and almost nobody uses it.

### The dev/build asymmetry that hides the first property

In development `import.meta.env` is *"defined as global variables"* — a real object. So
`import.meta.env[someKey]` **works in `vite dev`** and returns the value. It stops working at
`vite build`, where there is no object to index. This is the worst possible failure shape: correct
in the loop you iterate in, wrong in the artefact you ship, and silent in both.

---

## 2. Real-World Engineering Scenario

**A feature-flag helper that passed every test and shipped `undefined` to production.**

A team wrote what looked like good abstraction:

```typescript
export const flag = (name: string): boolean =>
  import.meta.env[`VITE_FLAG_${name.toUpperCase()}`] === 'true';
```

Every unit test passed — Vitest runs through Vite's dev transform, where `import.meta.env` is a real
object. The dev server behaved. Storybook behaved. The production build returned `undefined` for
every flag, so every `flag()` call was `false`, so every gated feature was **off** — including a
payment-provider switch that had been "enabled" for three days.

The abstraction was the bug. What made it feel safe — one helper, no repetition — is exactly what
removed the literal property names the bundler needed. The rewrite is uglier and correct:

```typescript
const FLAGS = {
  newCheckout: import.meta.env.VITE_FLAG_NEW_CHECKOUT === 'true',
  betaSearch:  import.meta.env.VITE_FLAG_BETA_SEARCH  === 'true',
} as const;

export const flag = (name: keyof typeof FLAGS): boolean => FLAGS[name];
```

The call sites are unchanged. The keys are now literals, so they are replaced; the object is built
from constants, so it still tree-shakes; and `keyof typeof FLAGS` makes a typo a type error instead
of a silent `false`. **The indirection moved from the bundler's problem to TypeScript's.**

---

## 3. Production-Grade Code Example

```typescript
// src/config/env.ts — build-time config: enumerated, coerced once, greppable.
const FLAGS = {
  newCheckout: import.meta.env.VITE_FLAG_NEW_CHECKOUT === 'true',
  betaSearch:  import.meta.env.VITE_FLAG_BETA_SEARCH  === 'true',
} as const;

export type FlagName = keyof typeof FLAGS;
export const flag = (name: FlagName): boolean => FLAGS[name];
```

```typescript
// src/config/runtime.ts — runtime config: for values that must differ per
// deployment WITHOUT a rebuild. This is the escape hatch, and it has a real cost:
// nothing here can tree-shake, because nothing here is known at build time.
export type RuntimeConfig = { apiUrl: string; tenantId: string };

let cache: RuntimeConfig | undefined;

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (cache) return cache;
  // Served from the same origin, written by the deploy job, never cached long.
  const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`runtime config failed: ${res.status}`);
  cache = (await res.json()) as RuntimeConfig;
  return cache;
}
```

```typescript
// src/main.ts — the boot order the runtime approach forces on you.
// Everything that needs config now waits. That latency is the price of
// one-artefact promotion; pay it deliberately or not at all.
import { loadRuntimeConfig } from './config/runtime';

const config = await loadRuntimeConfig();
mountApp(config);
```

```bash
# The audit that static replacement makes possible. Run it in CI.
# It reads the SHIPPED artefact, not the source — the only thing that matters.
grep -roh 'VITE_[A-Z0-9_]*' dist/ | sort -u

# Fail the build if a key that should never be public appears in the output.
if grep -rq 'sk_live_\|-----BEGIN' dist/; then
  echo "::error::secret material found in dist/"; exit 1
fi
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Dynamic property access

```typescript
// ❌ WRONG. Works in `vite dev` (real object), returns undefined after `vite build`
//    (nothing to index). Correct in the loop you iterate in, wrong in what you ship.
const read = (key: string) => import.meta.env[key];

// ✅ CORRECT. Enumerate. The keys are literals, so they are replaced —
//    and the surface becomes greppable, which is how you audit it.
const config = {
  apiUrl: import.meta.env.VITE_API_URL,
  appName: import.meta.env.VITE_APP_NAME,
} as const;
```

### ⚠️ Pitfall 2 — Wrapping `import.meta.env` in a helper "for cleanliness"

Any function that takes the key as a *parameter* has already lost the literal. This includes the
tasteful-looking ones: `getEnv('VITE_API_URL')`, `env.get(key)`, a `Proxy` around
`import.meta.env`. The bundler sees a function call, not a property it can substitute. Wrappers are
fine as long as the literal appears at the *definition* site and the wrapper only routes between
already-substituted values.

### ⚠️ Pitfall 3 — Assuming tests prove the build

Vitest shares Vite's transform pipeline, so tests run in the **dev** shape of
`import.meta.env`. A dynamic-key bug is therefore invisible to the entire test suite by
construction. The only test that catches it is one that asserts against `dist/` after a real build —
which is why the `grep` in the example above belongs in CI rather than in a runbook.

### ⚠️ Pitfall 4 — Reaching for runtime config too early

Runtime config is a real tool and a real cost: an extra blocking request before first render, a
value the bundler can no longer use to delete code, and a new failure mode when `config.json` 404s
on a bad deploy. Use it for the values that genuinely must vary per deployment — hostnames, tenant
ids, a kill switch you need to flip without a rebuild. Keep flags that *gate code paths* at build
time, because that is the only place they can remove the code they gate.

---

## Gotchas

**★ Symptom: `import.meta.env[someKey]` returns `undefined` in the build but works in dev.** Cause: dev has a real object; the build has textual substitution, which needs a literal property name. Fix: enumerate the keys.

```ts
// ❌ import.meta.env[`VITE_${name.toUpperCase()}_URL`]
// ✅ const urls = { billing: import.meta.env.VITE_BILLING_URL } as const;
```

**★ Symptom: every feature flag reads `false` in production and `true` locally.** Cause: a `flag(name)` helper indexing `import.meta.env` dynamically. Every flag resolves to `undefined`, and `undefined === 'true'` is `false` — so the failure is uniform, silent, and fails *closed*, which is why it survives review. Fix: build a literal-keyed constant object and let the helper index *that*.

**★ Symptom: the whole test suite passes and the production bundle is still wrong.** Cause: Vitest runs through Vite's dev transform, so it exercises the object form of `import.meta.env`, not the substituted form. Fix: add a post-build assertion against `dist/` — this class of defect is only observable in the artefact.

```bash
grep -roh 'VITE_[A-Z0-9_]*' dist/ | sort -u   # what actually shipped
```

**★ Symptom: a value must differ per environment but the team wants one build artefact.** Cause: these requirements are mutually exclusive under static replacement. Fix: move that specific value to a runtime source — a `/config.json` fetch at boot, or a server-rendered script tag — and keep everything genuinely build-time in `import.meta.env`, because only those values can tree-shake.

**★ Symptom: a `Proxy` or getter wrapper around `import.meta.env` returns nothing after a build.** Cause: the proxy's `get` trap receives a runtime string; there was never a literal for the bundler to replace. Fix: the wrapper may exist, but the literals must be at its definition site — route between already-substituted values rather than looking them up.

**★ Symptom: `config.json` is stale after a deploy and users see the previous environment's API.** Cause: the runtime-config escape hatch reintroduces caching problems that build-time config did not have — the JSON is a separate, cacheable resource with its own lifetime. Fix: `cache: 'no-store'` on the fetch and a short `Cache-Control` on the file, and treat the config document as part of the deploy, not as static content.

**★ Symptom: a debug panel is present in the production bundle despite being behind a flag.** Cause: the flag is a runtime value, so the branch is not statically false and nothing is removed — the code ships whether or not it executes. Fix: gate anything you need *removed* on `import.meta.env.DEV` or a build-time flag. A runtime flag hides a feature; only a build-time flag deletes it.

**★ Symptom: `grep VITE_ dist/` returns keys nobody recognises.** Cause: a dependency has its own `VITE_`-prefixed reads, and they were substituted from your environment during your build. Fix: this is working as designed and is exactly why the audit exists. Confirm each key is intentional; a library reading an unexpected prefix is worth understanding before it ships again.

---

## Interview questions

**★ Your team wants one build artefact promoted through dev → staging → prod. Can `import.meta.env` do that?**
No, and the reason is structural rather than a missing feature. Values are substituted as literals
during the build, so there is nothing left to configure afterwards. The options are a runtime fetch
of a config document at boot, or a server-injected script tag read before the app starts. Both work;
both give up the thing `import.meta.env` was *for*, which is letting the bundler delete code behind
a known-false condition. The mature answer splits the categories explicitly: flags that gate code
paths stay build-time so they can tree-shake, and values that merely differ per environment —
hostnames, tenant ids — move to runtime.

**★ Why does a `getEnv(key)` helper break in production but not in development?**
Because the two environments implement `import.meta.env` differently. In dev it is *"defined as
global variables"* — a real object, so indexing it with a runtime string works. In a build the
property accesses were *"statically replaced"*, which requires the property name to be visible in
the source; a key that only exists as a function argument is invisible. The general rule this
teaches is broader than Vite: **anything a bundler rewrites needs a statically analysable
argument.** It is the same rule that governs `import.meta.glob`, `new URL('./x.png', import.meta.url)`
and dynamic `import()` with a computed path — and in all four cases the failure is silent, because
the code stays syntactically valid.

**★ Why is a dynamic-key flag bug invisible to the test suite?**
Vitest shares Vite's transform pipeline, so tests see the dev shape of `import.meta.env` — the real
object — and the dynamic lookup succeeds. There is no test you can write in that environment that
distinguishes correct from broken, because the broken thing only exists in the artefact the test
never builds. The lesson generalises to anything build-time: sourcemap correctness, chunk splitting,
`define` replacements, tree-shaking of dead branches. The assertion has to run against `dist/`,
which in practice means a CI step, since nobody runs a production build locally often enough.

**★ Static replacement makes auditing easy. What audit would you actually run?**
`grep -roh 'VITE_[A-Z0-9_]*' dist/ | sort -u` — the complete list of environment keys that reached
the browser, read out of the shipped files rather than the source. Then a second grep for secret
*shapes* rather than names, since the dangerous case is a key that was never supposed to be
prefixed: `sk_live_`, `-----BEGIN`, long base64url runs. Both belong in CI as failing checks. The
reason this works at all is the property that causes every problem on this page — the values are
literals in the output — so the constraint and the safety net are the same fact.

**★ When is runtime configuration the right answer rather than a workaround?**
When the value genuinely has no meaning at build time. A tenant id in a white-label product, an API
hostname in a customer-managed on-prem install, a kill switch you must flip during an incident
without waiting for CI — none of these are knowable when the bundle is compiled, so forcing them
into `import.meta.env` means one build per customer, which is a worse problem. The signal that you
have reached for it too early is that the value is stable per environment and the environments are
known at build time; that is a build matrix, not a runtime concern, and paying a blocking request on
every page load to avoid three CI jobs is a bad trade.

---

← [Env System & `.env` Files](01-environment-system.md) · [Vite overview](../../README.md) · Next → [The `VITE_` Prefix & Built-In Constants](01b-the-vite-prefix-and-secrets.md)
