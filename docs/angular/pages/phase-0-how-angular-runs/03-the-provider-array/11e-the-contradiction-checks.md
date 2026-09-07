---
title: "Both hydration contradiction checks throw the same error code with different messages, both live inside `if (ngDevMode)`, and the configuration that throws in `ng serve` builds and ships without a word"
sidebar_label: "11e · The contradiction checks"
sidebar_position: 11.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`platform-browser/src/hydration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/hydration.ts),
> [`platform-browser/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/errors.ts)
> (reserved range and `HYDRATION_CONFLICTING_FEATURES`), and
> [`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts)
> (reserved range and the `MISCONFIGURED_INCREMENTAL_HYDRATION` code only).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`provideClientHydration()` validates its own arguments, which almost no other `provide*` function
in this topic does — and then throws away the guarantee in production.** Both checks are inside one
`if (typeof ngDevMode !== 'undefined' && ngDevMode)` block. This page is the third time this topic
has met that pattern, and the conclusion has not changed, but the reasoning is worth having in one
place because the *other* half of it is genuinely interesting: the check is possible at all because
of how features carry their identity.

## The two checks, and the one code behind them

```ts
if (typeof ngDevMode !== 'undefined' && ngDevMode) {
  if (featuresKind.has(HydrationFeatureKind.NoHttpTransferCache) && hasHttpTransferCacheOptions) {
    throw new RuntimeError(
      RuntimeErrorCode.HYDRATION_CONFLICTING_FEATURES,
      'Configuration error: found both withHttpTransferCacheOptions() and withNoHttpTransferCache() in the same call to provideClientHydration(), which is a contradiction.',
    );
  }
  if (
    featuresKind.has(HydrationFeatureKind.IncrementalHydration) &&
    featuresKind.has(HydrationFeatureKind.NoIncrementalHydration)
  ) {
    throw new RuntimeError(
      RuntimeErrorCode.HYDRATION_CONFLICTING_FEATURES,
      'Configuration error: found both withIncrementalHydration() and withNoIncrementalHydration() in the same call to provideClientHydration(), which is a contradiction.',
    );
  }
}
```

Both use `RuntimeErrorCode.HYDRATION_CONFLICTING_FEATURES`, which is **`5001`** and surfaces as
**`NG5001`**.

⚠️ **The enum is `platform-browser`'s, not `core`'s.** Its header comment reads *"Reserved error
code range: 5000-5500."* — which is why hydration errors are four digits where the `NG0xxx` codes
you meet more often are `core`'s, whose own header reserves **100-999**. If you are trying to work
out which package threw something, the number's magnitude is the first clue. The value is also
**positive**, which in Angular's convention means there is no dedicated guide page for it: the
rendered message carries no *"Find more at …"* suffix, and `NG5001` is all you get to search for.

One code, two messages — so the number alone does not tell you which pair you
contradicted, and searching for `NG5001` finds both. The message is what disambiguates, which is
the opposite of the convention elsewhere in the framework where each distinct condition gets its own
number. The two exact strings, for grepping:

```text
Configuration error: found both withHttpTransferCacheOptions() and withNoHttpTransferCache() in the same call to provideClientHydration(), which is a contradiction.
```

```text
Configuration error: found both withIncrementalHydration() and withNoIncrementalHydration() in the same call to provideClientHydration(), which is a contradiction.
```

## The check reads kinds, never providers

Look at what the conditions actually test: `featuresKind.has(...)`. The `Set` was built by the loop
at the top of the function, which adds every feature's `ɵkind` regardless of whether that feature
contributed any providers at all.

🔴 **That is what makes the check possible.** `withNoIncrementalHydration()` calls
`hydrationFeature()` with no providers — it is a kind and nothing else. A validation written against
the resulting provider array could not see it; a validation written against the set of kinds sees it
immediately. The identity of a feature is its `ɵkind`, and the providers are only its payload.

This is precisely the design [10e · XSRF protection](10e-xsrf-protection.md) works through for
`provideHttpClient()`, where `withXsrfConfiguration({})` contributes zero providers and still takes
part in the contradiction check. Two subsystems, written at different times, arriving at the same
mechanism — which is a reasonable signal that it is the right one for feature-style APIs generally.

## Why hydration validates and `provideRouter()` does not

Hydration's contradictory pairs write opposite values for a single behaviour flag. There is no
coherent meaning to "the transfer cache is configured and also disabled", or "incremental hydration
is on and also off"; whichever one wins, the other argument was a mistake, and the author cannot
have wanted both. The router's features mostly own **distinct tokens** — a view-transitions feature
and a scroll-restoration feature configure different things and compose without conflict — so there
is nothing to validate.

The general rule: a feature-style API can validate contradictions exactly where two features are
opinions about the same switch. Where they configure independent switches, the "validation" would be
arbitrary.

## What ships

🔴 **Both checks are inside `if (ngDevMode)`, so the same configuration that throws in `ng serve`
builds and ships silently.** This topic has now met that pattern three times —
[05f · `checkNoChanges` in production](05f-check-no-changes-in-production-and-developer-preview.md),
[10e · XSRF protection](10e-xsrf-protection.md), and here — and the conclusion is the same each
time: a dev-mode configuration guard is a **development-time** guarantee, and the only way it
protects production is if something exercises a development build. In CI, or on a developer's
machine. A configuration path that only exists in a production profile and is never served locally
is unguarded.

What actually happens if you ship the contradiction is only partly readable from this file.

For the incremental-hydration pair, the source is clear enough: the ternary tests
`featuresKind.has(HydrationFeatureKind.NoIncrementalHydration)` alone, so **the opt-out wins** — the
default call is skipped — while `withIncrementalHydration()`'s own providers are still pushed by the
loop. So both the opt-out's absence-of-providers and the deprecated opt-in's providers land, and
`ɵwithIncrementalHydration()` is registered once, from the feature rather than from the default.

⚠️ For the transfer-cache pair, less is determined. The ternary tests
`NoHttpTransferCache || hasHttpTransferCacheOptions`, so with both passed the default `{}` call is
skipped and both features' own providers land in argument order. Which of them then *wins* depends
on what `withNoHttpTransferCache()` provides, and that function's body was **not read** for this
page — do not assume it mirrors `withNoIncrementalHydration()`'s zero-provider shape without reading
it. Read the source before relying on the outcome.

## `NG0508` is a different code, and this page will not guess it

⚠️ **`MISCONFIGURED_INCREMENTAL_HYDRATION = 508`, surfacing as `NG0508`, also exists — in `core`'s
enum, not `platform-browser`'s.** Three digits, inside `core`'s reserved 100-999 range, and positive,
so like `NG5001` it has no guide-page link. It is separate from `NG5001`, it belongs to incremental
hydration, and its throw site and message text were **not read** when this page was written. It is named here so you know it
exists and can look it up; nothing about its condition or its wording is reconstructed. A guessed
error message is worse than no error message, because it is confidently wrong and someone will grep
for it.

## Gotchas

**★ Symptom: `Configuration error: found both withIncrementalHydration() and withNoIncrementalHydration() in the same call to provideClientHydration(), which is a contradiction.`** Cause: exactly what
it says, usually because a half-finished v22 upgrade added the opt-out next to a line nobody
removed. Fix: delete both — the default is what the deprecated opt-in wanted anyway. ⚠️ Dev-mode
only.

**★ Symptom: `Configuration error: found both withHttpTransferCacheOptions() and withNoHttpTransferCache() in the same call to provideClientHydration(), which is a contradiction.`** Cause: one person
configured the cache and another disabled it, in the same array — commonly after a merge. Fix:
decide which, and prefer the options form with a per-request callback, which usually expresses what
the person who added the opt-out actually wanted. See [11d](11d-the-http-transfer-cache.md).

**★ Symptom: `NG5001` in a log and you cannot tell which contradiction it was.** Cause: both checks
share the code. Fix: read the message, not the number — the two strings are quoted verbatim above,
and each names its own pair of functions.

**★ Symptom: the contradiction throws in `ng serve` and the identical configuration ships silently.**
Cause: both checks are inside `if (ngDevMode)`. Fix: this is the framework's behaviour and you
cannot change it; what you can change is whether anything exercises a dev build before release. The
practical mitigation is a CI step that runs the development build, which is what catches the whole
family of `ngDevMode`-guarded configuration errors at once rather than one at a time.

**★ Symptom: you added a config-validating unit test and it passes against a production build.**
Cause: same reason — `ngDevMode` is falsy there, so no throw. Fix: assert against a development
build, or assert the *effect* rather than the throw. Testing that hydration behaves as configured is
mode-independent; testing that a bad config throws is not.

**★ Symptom: you expected a contradiction error for two features that clearly conflict and got
nothing.** Cause: only two pairs are checked. There is no check for, say, `withEventReplay()`
alongside `withNoIncrementalHydration()` — which is a *sensible* combination — nor for anything
involving `withI18nSupport()`. Fix: do not read the absence of an error as approval; the validation
covers exactly the two pairs quoted above and nothing else.

**★ Symptom: `NG0508` appears and nothing you search finds an explanation.** Cause:
`MISCONFIGURED_INCREMENTAL_HYDRATION`, a different code from the contradiction checks. Fix: search
the core error enum for that identifier and read the throw site. ⚠️ This page deliberately does not
reproduce its message, because it was not read from source.

## Interview questions

**★ Why does `provideClientHydration()` validate contradictory features while `provideRouter()` does
not?**
Because hydration's contradictory pairs write opposite values for a single behaviour flag, so there
is no coherent meaning to both being present, while the router's features mostly own distinct tokens
and compose. The check is possible at all because features carry a `ɵkind` — the validation reads
the `Set` of kinds and never inspects what each feature provided, which is also why a feature that
contributes zero providers can still take part in it.

**★ Both hydration contradiction checks are inside `if (ngDevMode)`. What does that mean for a
production build?**
That the guard is a development-time guarantee only: the identical configuration builds and ships
without complaint. It is the same pattern as the `checkNoChanges` guard and the XSRF contradiction
elsewhere in this topic, and the practical consequence is that a configuration mistake is caught
only if something exercises a development build — in CI, or by a developer running `ng serve`
against that config. A production-only config path nobody serves locally is unguarded.

**★ Two different error conditions share the code `NG5001`. Is that a bug?**
Not exactly, but it is a departure from the framework's usual convention of one code per condition,
and it has a cost: the code is no longer sufficient to identify what went wrong, so tooling that
keys on the number — a log aggregator's alert rule, say — cannot distinguish the two. The
justification is that they are the same *kind* of error, "you passed contradictory hydration
features", and the message names the specific pair. It is a reasonable design; it just means you
must read messages rather than codes here.

**★ If you shipped `provideClientHydration(withIncrementalHydration(), withNoIncrementalHydration())`
to production, what would happen?**
No throw, because the check is dev-only. The default ternary tests only for the opt-out's kind, so
the default `ɵwithIncrementalHydration()` call is skipped — but the deprecated opt-in's own
providers are pushed by the feature loop regardless, so those providers are registered anyway.
Net effect: incremental hydration is on, arriving from the feature you thought you had disabled. It
is worth being able to reason to that answer from the source rather than guessing, because the
guess most people make — "the opt-out wins" — is the wrong one.

---

← Prev: [The HTTP transfer cache](11d-the-http-transfer-cache.md) · Index: [Topic index](README.md) · Next → [11f · Animations are deprecated](11f-animations-are-deprecated.md)
