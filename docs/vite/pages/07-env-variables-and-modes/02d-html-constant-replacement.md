---
title: "HTML `%VAR%` Replacement: the One Env Failure a User Sees Before a Test Does"
sidebar_label: "HTML `%VAR%` Replacement"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [`transformIndexHtml`](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ HTML `%VAR%` Replacement

Every other env mistake in this topic produces `undefined`, which is a value your code can check and
your tests can assert on. This one produces **visible text on the page**, and it is the only one
whose first observer is a user.

---

## 1. Under-The-Hood Mechanics

> *"Vite also supports replacing constants in HTML files. Any properties in `import.meta.env` can be used in HTML files with a special `%CONST_NAME%` syntax"* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

```html
<h1>Vite is running in %MODE%</h1>
<p>Using data from %VITE_API_URL%</p>
```

Two constraints follow from *"any properties in `import.meta.env`"*, and both catch people:

- **The prefix filter applies.** `%DB_PASSWORD%` is not replaced, because `DB_PASSWORD` never
  reached `import.meta.env` in the first place. This is the correct behaviour and a useful safety
  property — the HTML channel cannot expose more than the JS channel.
- **`define` keys are not available.** `define` adds globals to your JavaScript; it does not add
  properties to `import.meta.env` unless you explicitly defined the key
  `'import.meta.env.X'`. `%SOME_DEFINE%` is therefore not replaced.

### 🔴 The failure mode is inverted

> *"If the env doesn't exist in `import.meta.env`, e.g. `%NON_EXISTENT%`, it will be ignored and not replaced, unlike `import.meta.env.NON_EXISTENT` in JS where it's replaced as `undefined`."*

```
JS:    import.meta.env.MISSING   →  undefined
                                    a value. `if (!x) throw` catches it.
                                    A unit test catches it. A type catches it.

HTML:  %MISSING%                 →  the literal text "%MISSING%"
                                    nothing catches it. It renders.
```

This asymmetry is deliberate — silently emitting `undefined` into an HTML attribute would be worse —
but it means the HTML channel has **no runtime failure at all**, and therefore no place for a guard.
The only possible check is on the built output.

### It is substitution, and nothing more

> *"Given that Vite is used by many frameworks, it is intentionally unopinionated about complex replacements like conditionals. Vite can be extended using an existing userland plugin or a custom plugin that implements the `transformIndexHtml` hook."*

There is no conditional, no loop, no default value and no escaping directive. `%VAR%` is a
find-and-replace over the document, and the extension point for anything more is
`transformIndexHtml`. That limitation is a design choice about being a shared substrate, not a gap
waiting to be filled — plan for a plugin rather than for a future feature.

⚠️ **Escaping is not documented.** The docs do not state whether a replaced value is HTML-escaped
before insertion. **Do not put user- or third-party-controlled data through `%VAR%`**, and do not
assume either behaviour; I did not verify it, and the safe assumption is the unsafe one.

---

## 2. Real-World Engineering Scenario

**`%VITE_SENTRY_DSN%` in a meta tag, live for a month, one character wrong.**

A team wired their error-tracking DSN into `index.html` so a small inline script could initialise
before the app bundle loaded:

```html
<meta name="sentry-dsn" content="%VITE_SENTRY_DSN%" />
```

The `.env.production` key was `VITE_SENTRY_DNS`. A transposition — DNS instead of DSN — of exactly
the kind that survives review because both are real acronyms.

What happened next is the whole point of this page:

- **The build succeeded.** Unreplaced constants are *"ignored and not replaced"*, so nothing warned.
- **The page rendered.** The meta tag's content was the literal string `%VITE_SENTRY_DSN%`.
- **The inline script did not throw.** It read a non-empty string and passed it to the SDK, which
  failed to parse it and — as SDKs generally do — logged a warning and disabled itself rather than
  crashing the page.
- **No test could see it.** There is no unit test for "the HTML has a real DSN", and an end-to-end
  test asserts on behaviour, not on a meta tag nobody renders.

Error reporting was silently off for a month. It was noticed when someone asked why a known
production bug had no events.

The fix was one character. The durable fix is four lines of CI that grep the built HTML for anything
still matching `%[A-Z0-9_]+%` — because this is a class of defect with **no runtime signal at all**,
and the only place it is observable is the artefact.

---

## 3. Production-Grade Code Example

```html
<!-- index.html — %VAR% reads import.meta.env, so only prefixed names work. -->
<title>Acme — %MODE%</title>
<meta name="api-base" content="%VITE_API_URL%" />
<meta name="build-mode" content="%MODE%" />

<!-- ⛔ Not replaced — DB_PASSWORD never reached import.meta.env (no prefix).
     This is the safety property working, not a bug. -->
<!-- <meta name="x" content="%DB_PASSWORD%" /> -->

<!-- ⛔ Not replaced — __BUILD_SHA__ is a `define`, which adds a JS global,
     not an import.meta.env property. -->
<!-- <meta name="sha" content="%BUILD_SHA%" /> -->
```

```bash
# CI — the only place this class of bug is observable.
# Runs against the ARTEFACT, because there is no runtime signal to assert on.
- run: yarn build
- name: Fail on any unreplaced HTML constant
  run: |
    if leftover=$(grep -ohE '%[A-Z][A-Z0-9_]*%' dist/**/*.html 2>/dev/null); then
      echo "::error::unreplaced HTML constants:"; echo "$leftover" | sort -u
      exit 1
    fi
```

```typescript
// vite.config.ts — a plugin, for anything %VAR% deliberately will not do:
// conditionals, defaults, or injecting a value that is not an env variable.
import { defineConfig, type Plugin } from 'vite';

function htmlEnv(vars: Record<string, string>): Plugin {
  return {
    name: 'html-env',
    // The documented extension point for "complex replacements".
    transformIndexHtml: {
      order: 'pre',
      handler: (html) =>
        html.replace(/<!--#if (\w+)-->([\s\S]*?)<!--#endif-->/g, (_, key, body) =>
          vars[key] ? body : '',
        ),
    },
  };
}

export default defineConfig({ plugins: [htmlEnv({ CANARY: process.env.CHANNEL === 'canary' ? '1' : '' })] });
```

```typescript
// The alternative to putting config in HTML at all: read it in JS, where a
// missing value is `undefined` and therefore checkable.
const dsn = import.meta.env.VITE_SENTRY_DSN;
if (!dsn) throw new Error('VITE_SENTRY_DSN is required');   // ← impossible in HTML
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Assuming `%VAR%` and `import.meta.env` fail the same way

They fail in opposite directions. JS gives `undefined`, which a runtime check catches. HTML leaves
the literal `%VAR%` text in the document, where nothing catches it.

### ⚠️ Pitfall 2 — Expecting conditionals

`%VAR%` is a straight substitution. *"Vite … is intentionally unopinionated about complex
replacements like conditionals."* Anything more needs a `transformIndexHtml` plugin.

### ⚠️ Pitfall 3 — Reaching for `%VAR%` when JS would do

Putting a value in HTML costs you the only failure signal available. If an inline script is not
genuinely required — if the value can be read after the bundle loads — read it in JS, where a
missing value is `undefined` and a guard is possible.

### ⚠️ Pitfall 4 — Putting untrusted data through `%VAR%`

Escaping behaviour is not documented, so a value containing markup may or may not be escaped before
insertion. Treat `%VAR%` as suitable only for values you control and can review.

### ⚠️ Pitfall 5 — Expecting a `define` key to work in HTML

`define` adds JavaScript globals. HTML replacement reads `import.meta.env`. The two channels do not
share a namespace unless you defined the literal key `'import.meta.env.X'`.

---

## Gotchas

**★ Symptom: the literal text `%VITE_API_URL%` appears on the rendered page.** Cause: the name is not in `import.meta.env` — a typo, a missing prefix, or a `define` key rather than an env key — and *"it will be ignored and not replaced."* Fix: grep the built HTML in CI; this failure is visible to users and to nothing else.

```bash
grep -ohE '%[A-Z][A-Z0-9_]*%' dist/**/*.html && exit 1
```

**★ Symptom: a value read from a meta tag is a non-empty string and still wrong.** Cause: the unreplaced `%NAME%` text *is* a non-empty string, so every truthiness guard passes. Fix: guards on HTML-sourced values must validate shape, not presence — a URL parse, a prefix check, a length range.

**★ Symptom: an SDK initialised from a meta tag silently disables itself.** Cause: it received `%VITE_X%` as its configuration, failed to parse it, and degraded rather than throwing — which most SDKs do deliberately. Fix: the CI grep, plus a smoke assertion that the SDK actually initialised, since "it did not crash" is not evidence it worked.

**★ Symptom: `%SOME_DEFINE%` in HTML is never replaced.** Cause: HTML replacement reads `import.meta.env`, and `define` does not add keys there unless you defined `'import.meta.env.X'` explicitly. Fix: use a prefixed env variable, or `define` the full `import.meta.env.X` expression as the key.

**★ Symptom: `%DB_PASSWORD%` is not replaced and someone files it as a bug.** Cause: the prefix filter applies to HTML too, so the HTML channel cannot expose more than the JS channel. Fix: it is working correctly. If the value genuinely belongs in the page it needs a prefix — and if it needs a prefix it is public, which for a password it is not.

**★ Symptom: a conditional in `index.html` does nothing.** Cause: `%VAR%` is a substitution, not a template language. Fix: a plugin implementing `transformIndexHtml`, or move the decision into application code.

**★ Symptom: the same env change works in dev and shows raw `%VAR%` after a build.** Cause: a typo whose key happens to exist in `.env.local` (loaded in every mode) but not in `.env.production`. Fix: the CI grep runs on the built artefact for exactly this reason — mode-dependent env gaps are invisible in dev.

**★ Symptom: a value containing `&` or a quote renders oddly in an attribute.** Cause: escaping behaviour for replaced values is **not documented**, and this page does not assert it either way. Fix: do not put values needing escaping through `%VAR%`. Use a `transformIndexHtml` plugin where you control the encoding, or pass the value in JS.

---

## Interview questions

**★ How does HTML `%VAR%` replacement differ from `import.meta.env` in JS?**
Two ways, and both matter. It reads `import.meta.env`, so only names that survived the prefix filter
are available — a `define` key is not, and an unprefixed variable is not. And it fails in the
opposite direction: *"If the env doesn't exist in `import.meta.env` … it will be ignored and not
replaced, unlike `import.meta.env.NON_EXISTENT` in JS where it's replaced as `undefined`."* A JS
typo yields `undefined`, which a runtime check catches and a test asserts on. An HTML typo yields
the literal text `%VITE_API_URL%` in the rendered page, where the first observer is a user. That
asymmetry is the entire argument for a CI grep over the built HTML.

**★ Why is the HTML failure mode arguably the most dangerous one in this whole topic?**
Because it has **no runtime signal**. Every other env mistake produces `undefined` somewhere — a
value you can guard on, assert on, or type. An unreplaced `%VAR%` is a non-empty string, so every
truthiness check passes, every "is it configured" guard passes, and any consumer that degrades
gracefully on bad input — which is most SDKs — disables itself quietly. The defect is therefore
invisible to unit tests, to integration tests, and to production error rates, and observable only in
the artefact. That is the specific reason a build-output grep belongs in CI rather than in a review
checklist.

**★ Why is Vite deliberately unwilling to support conditionals in `index.html`?**
Because it is a shared substrate: *"Given that Vite is used by many frameworks, it is intentionally
unopinionated about complex replacements like conditionals."* Every template syntax it adopted would
be one more thing a framework has to work around or reimplement, and templating is precisely where
frameworks differ most. So Vite ships the smallest useful primitive and exposes `transformIndexHtml`
for anyone who needs more. The practical consequence is that `%VAR%` will never grow the feature you
want, so the right move is to write the plugin rather than wait.

**★ When should a value go into `index.html` at all, rather than being read in JS?**
Only when something must run before the application bundle loads — an error-tracking SDK that needs
to catch load-time failures, a feature-detection script, a theme applied before first paint to avoid
a flash. Everything else should be read in JS, because that is where a missing value is `undefined`
and a guard is possible. The trade is explicit: putting a value in HTML buys you earlier
availability and costs you the only failure signal you had. Teams routinely pay that price without
noticing they paid it.

**★ Is a value inserted by `%VAR%` HTML-escaped?**
The documentation does not say, and that is the honest answer — I have not verified it either way.
The safe posture follows from the uncertainty rather than from the answer: treat `%VAR%` as suitable
only for values you control and review, never for anything user- or third-party-supplied. If a value
genuinely needs encoding guarantees, use a `transformIndexHtml` plugin where the encoding is yours
to perform, because then the guarantee comes from your code rather than from an undocumented
behaviour that could change.

---

← [`define`](02c-define-and-html-replacement.md) · [Vite overview](../../README.md) · Next → [Typing `import.meta.env`](02e-typing-import-meta-env.md)
