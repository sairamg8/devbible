---
title: "v8 coverage reads what the engine actually executed, istanbul reads instrumentation it injected — and since Vitest 3.2 the two report the same numbers, which used to not be true"
sidebar_label: "01f · Coverage providers"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vitest documentation — [Coverage guide](https://vitest.dev/guide/coverage.html). Documentation-validated; **no sandbox run, no coverage percentages**. Target: **Vitest 5.0.0 · Vite 8.2.2**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Two ways to measure coverage, and one used to lie about accuracy

**`v8` and `istanbul` measure coverage by fundamentally different mechanisms — one reads what the V8 engine itself recorded as executed, the other rewrites your source to count executions manually — and until a specific Vitest release, that difference showed up as `v8` being fast but *less accurate* than `istanbul`.** That gap closed in Vitest 3.2 with AST-aware remapping, which matters for anyone whose mental model of "just use v8, it's faster" was formed before that release and never revisited.

## `v8` — the default, reading the engine's own instrumentation

> *"By default, `v8` will be used."* — [Coverage guide](https://vitest.dev/guide/coverage.html)

> Coverage collection works *"using node:inspector and Chrome DevTools Protocol in browsers."*

> *"User's source files can be executed as-is without any pre-instrumentation steps."*

```typescript
// vite.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8', // the default; explicit here for clarity
    },
  },
});
```

Because V8 tracks execution at the engine level, no rewriting of the source happens before it runs — the code Vitest executes is exactly the code you wrote (after Vite's own transform, but nothing coverage-specific is injected on top). The documented trade-offs:

> *"Faster execute times than Istanbul"* and *"Lower memory usage than Istanbul"* — direct results of not instrumenting anything.

> *"Does not work on environments that don't use V8, such as Firefox or Bun"* — the mechanism is tied to V8's own inspector protocol, so a Browser Mode suite running against Firefox, or any runtime not built on V8, cannot use this provider at all.

### The accuracy gap that closed in v3.2

> *"Since `v3.2.0` Vitest has used [AST based coverage remapping](https://vitest.dev/blog/vitest-3-2#coverage-v8-ast-aware-remapping) for V8 coverage, which produces identical coverage reports to Istanbul."*

> *"This allows users to have the speed of V8 coverage with accuracy of Istanbul coverage."*

Before that change, V8's raw coverage data — recorded against the *transformed* code Node actually executed, then remapped back to original source via source maps — could disagree with Istanbul's line-by-line instrumentation-based counts, particularly around statements a transform had rewritten or collapsed. The fix was making the remapping AST-aware rather than a naive source-map lookup, closing the gap without giving up V8's speed advantage. On Vitest 5, this is no longer a live trade-off between speed and accuracy — it is a trade-off between speed and runtime compatibility (V8-only).

## `istanbul` — works everywhere, costs execution speed

> Coverage tracking *"works by transforming your source code to add instrumentation logic."*

```typescript
// vite.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
    },
  },
});
```

```bash
npm install -D @vitest/coverage-istanbul
```

> *"Works on any Javascript runtime"* — because it does not depend on V8's own inspector protocol, an Istanbul-instrumented file runs its counting logic in plain JavaScript, portable to any engine.

> *"Widely used and battle-tested for over 13 years"* — Istanbul predates Vitest entirely and is the same engine Jest's coverage historically used.

> *"Source code is transformed to add instrumentation before running"* and, as a direct consequence, *"Execution speed is slower than V8 due to instrumentation overhead"* — every statement and branch gets a counter increment injected, and that counter code runs on every test, not just during a coverage run's analysis phase.

## Choosing between them

The default (`v8`) is correct for the overwhelming majority of Vitest projects, precisely because the accuracy gap that used to justify choosing `istanbul` for correctness reasons closed in 3.2. The remaining, narrower reasons to reach for `istanbul` are runtime compatibility — a Browser Mode suite targeting Firefox via WebdriverIO, or any non-V8 runtime — and, less commonly, an organization standardizing coverage tooling across a Jest and a Vitest codebase simultaneously, where using the same underlying instrumentation format simplifies aggregating reports from both.

## Coverage and transformed source — why the numbers can still mislead

Both providers ultimately have to answer "which line of *my* source did this correspond to," and both rely on source maps to translate from what actually ran (Vite-transformed, TypeScript-stripped, JSX-compiled code) back to the file and line number a developer wrote. A `@preserve` keyword is the documented way to keep an ignore-hint comment (`/* v8 ignore next */` or Istanbul's equivalent) from being stripped by esbuild's legal-comment handling before the coverage tool ever sees it — a comment stripped during transformation cannot instruct a coverage tool that never receives it, and the failure mode looks identical to the ignore hint simply not working.

⚠️ Nothing about coverage percentages themselves is asserted on this page — no run was performed, and no number reported here would be evidence of anything without one.

## Gotchas

**★ Symptom: a Browser Mode test suite running against Firefox via WebdriverIO reports zero coverage, or the coverage step fails outright.** Cause: the `v8` provider's coverage collection mechanism is tied to V8's own inspector protocol — the documentation states plainly it "does not work on environments that don't use V8, such as Firefox or Bun." Fix: switch that suite's coverage provider to `istanbul`, which instruments source directly and has no engine dependency.
```typescript
test: { coverage: { provider: 'istanbul' } }
```

**★ Symptom: an ignore-hint comment (`/* v8 ignore next */`) appears to have no effect — the ignored line still shows as uncovered, or still counts against the total.** Cause: esbuild's legal-comment stripping can remove the comment during transformation before any coverage tool reads the file, unless it is marked to survive that stripping. Fix: add `@preserve` to the comment so esbuild treats it as a legal comment to retain.

**★ Symptom: a suite that switched from `istanbul` to `v8` for speed, on a project still running an old Vitest version, sees coverage numbers that visibly disagree between the two providers for the same run.** Cause: before Vitest 3.2's AST-aware remapping, `v8`'s coverage-report accuracy could genuinely differ from `istanbul`'s, because the old remapping approach did not always correctly map transformed-code coverage back to original source at statement granularity. Fix: upgrade past 3.2 — on Vitest 5.0.0 this class of discrepancy is what the AST-aware remapping was built to eliminate, per the documentation's own claim of "identical coverage reports to Istanbul."

**★ Symptom: switching the coverage provider from `v8` to `istanbul` (or vice versa) throws a "cannot find module" error at coverage-collection time.** Cause: each provider ships as a separate installable package — `@vitest/coverage-v8` or `@vitest/coverage-istanbul` — and setting `provider` in config does not install the corresponding package. Fix: install the matching package explicitly; Vitest 5.0.0's own `peerDependencies` pin both to the exact string `5.0.0`, so install the version matching the core `vitest` package, not an independently-chosen range.
```bash
npm install -D @vitest/coverage-istanbul
```

## Interview questions

**★ Why was `v8` ever considered less accurate than `istanbul`, if it's reading real execution data straight from the engine?**
Because "real execution data" is recorded against the code V8 actually ran, which is the *transformed* output — TypeScript stripped, JSX compiled — not the original source a developer wrote. Mapping that raw coverage data back to original source lines requires source maps, and the pre-3.2 remapping approach did not always correctly reconstruct statement-level coverage from that transformed data, particularly where a transform restructured code rather than simply moving lines. Istanbul sidesteps this by instrumenting the source directly with counters tied to the original AST, so its coverage was inherently statement-accurate by construction, at the cost of execution speed. Vitest 3.2's AST-aware remapping closed that gap by making the V8-to-source mapping itself AST-aware rather than a naive line lookup.

**★ Given that Vitest 3.2+ makes `v8` and `istanbul` report identical coverage, why would anyone still choose `istanbul`?**
Runtime compatibility, primarily — `v8`'s mechanism depends on V8's own inspector protocol via `node:inspector` and the Chrome DevTools Protocol, so it simply does not function on a non-V8 runtime: Firefox in a Browser Mode/WebdriverIO suite, or Bun. `istanbul`'s instrumentation-based approach runs its counting logic as plain JavaScript, portable to any engine that can execute JS at all. A secondary reason is organizational — a codebase running both Jest (which historically used Istanbul) and Vitest side by side may prefer a single, consistent instrumentation format across both for simpler report aggregation.

**★ Why does a coverage ignore-hint comment sometimes silently fail to do anything?**
Because the comment has to survive the transform pipeline intact to reach the coverage tool that interprets it, and esbuild's legal-comment handling can strip ordinary comments — including coverage ignore hints — during transformation unless they are explicitly marked to be preserved with `@preserve`. The comment being present in the source a developer wrote is not the same as it being present in the code the coverage tool actually processes; those are two different points in the pipeline, and only the second one matters for whether the ignore hint takes effect.

---

← [01e · setupFiles vs globalSetup](01e-setup-and-teardown.md) · [Vite overview](../../README.md) · Next → [01g · In-source testing](01g-in-source-testing.md)
