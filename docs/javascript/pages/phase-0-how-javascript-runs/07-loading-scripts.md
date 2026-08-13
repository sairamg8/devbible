---
title: "07 · Loading scripts"
sidebar_label: "07 · Loading scripts"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> **Not verified — browser host.** This page describes HTML-spec behaviour that
> Node cannot execute. It carries no console transcript, because none was
> produced. See the [verification policy](../README.md#how-these-pages-are-verified).
>
> {/* VERIFY: run the four-script ordering harness in a real browser and paste the real order */}

**Where you put a `<script>` and which attribute you give it decides when your
code runs relative to the HTML being parsed.** Get it wrong and you get either a
blank first paint or `Cannot read properties of null` on a element that does not
exist yet.

## The four options

| Form | Downloads | Executes | Blocks HTML parsing? | Order guaranteed? |
|---|---|---|---|---|
| `<script>` | immediately | immediately, **parser stops** | **Yes** | Yes — document order |
| `<script defer>` | in parallel | after HTML is parsed, before `DOMContentLoaded` | No | **Yes** — document order |
| `<script async>` | in parallel | **the moment it arrives** | No (but execution pauses the parser) | **No** — whoever lands first |
| `<script type="module">` | in parallel | after parsing, like `defer` | No | Yes — with dependencies first |

## What each one is for

**Plain `<script>` in `<head>` — almost always wrong.** The parser stops, fetches,
executes, then resumes. Nothing renders during that time. This is the classic
"why is my page blank for 800 ms".

**`<script defer>` — the safe default for a classic script.** Downloads in
parallel with parsing, runs after the document is parsed, in document order. The
DOM is complete when it runs, so no `DOMContentLoaded` wrapper is needed.

**`<script async>` — only for independent third-party code.** Analytics, error
reporting. It runs whenever it arrives, so it must not depend on your code, your
DOM, or another `async` script. Two `async` scripts have **no defined order**
relative to each other.

**`<script type="module">` — the modern default.** Deferred automatically,
strict mode automatically ([04 · Strict mode](./04-strict-mode.md)), and it can
`import`. The module graph is resolved first, so dependencies always execute
before their importers.

```html
<!doctype html>
<html>
  <head>
    <!-- analytics: independent, order-irrelevant -->
    <script async src="/analytics.js"></script>

    <!-- app code: needs the DOM, needs deterministic order -->
    <script type="module" src="/main.js"></script>

    <!-- legacy library that is not a module -->
    <script defer src="/legacy-widget.js"></script>
  </head>
  <body>
    <div id="product-grid"></div>
  </body>
</html>
```

## Why `type="module"` is deferred and what that costs

A module must be fetched, parsed, and have **its whole import graph** fetched and
parsed before anything executes. That cannot happen synchronously mid-parse, so
modules are deferred by definition.

The cost is a request waterfall: `main.js` must be read before the browser learns
it imports `cart.js`, which imports `format.js`. Three round trips before
anything runs. The two fixes:

- **`<link rel="modulepreload">`** for the modules you know you need, so they
  fetch in parallel with the top of the graph.
- **Bundling**, which flattens the graph into one request. This is the main
  reason bundlers are still standard in 2026 despite native ESM being universal.

`<script type="module" async>` is legal and overrides the deferral — the module
runs as soon as its graph is ready. Use it only for genuinely independent
modules, for the same reason as `async` generally.

## The old advice, and why it changed

"Put your scripts at the bottom of `<body>`" was correct in the era before
`defer`. It works because the parser has already built the DOM by the time it
reaches the tag.

`defer` is strictly better: the download starts when the `<head>` is parsed,
rather than after the entire body. Same execution timing, earlier fetch. Use
`defer` or `type="module"`; leave scripts at the bottom of `<body>` in code you
inherit, but do not write new ones that way.

## `nomodule` and the two-bundle pattern

```html
<script type="module" src="/app.modern.js"></script>
<script nomodule defer src="/app.legacy.js"></script>
```

A browser that understands modules ignores `nomodule`; one that does not ignores
`type="module"`. Exactly one runs. Modern browsers get untranspiled code and
legacy browsers get the fallback.

In 2026 this is mostly historical — every browser in a realistic `browserslist`
supports modules — but you will still meet it in existing builds.

## Gotchas

**Symptom:** `Cannot read properties of null (reading 'addEventListener')` on an
element that is clearly in the HTML.
**Cause:** the script ran before the parser reached that element — a plain
`<script>` in `<head>`.
**Fix:** add `defer`, or use `type="module"`. Both guarantee the DOM is parsed.

**Symptom:** two scripts work individually, and break when both are present.
**Cause:** they are `async`, so execution order is undefined and the dependent
one sometimes wins the race.
**Fix:** `defer` for anything order-dependent. Reserve `async` for code with no
dependencies at all.

**Symptom:** `Uncaught SyntaxError: Cannot use import statement outside a module`.
**Cause:** an `import` in a script without `type="module"`.
**Fix:** add `type="module"` — and remember it also makes the file strict, which
can surface separate errors.

**Symptom:** a `type="module"` script fails locally with a CORS error when opened
via `file://`.
**Cause:** modules are always fetched with CORS rules; `file://` has no origin.
**Fix:** serve over HTTP, even locally.

**Symptom:** first paint is slow and the waterfall shows sequential module
requests.
**Cause:** a deep import graph discovered one level at a time.
**Fix:** `<link rel="modulepreload">` for known dependencies, or bundle.

## Interview questions

**★ What is the difference between `defer` and `async`?**
Both download in parallel without blocking the parser. `defer` waits until the
document is fully parsed and runs scripts in **document order**; `async` runs
each script the instant it arrives, in **no guaranteed order**. Use `defer` for
your own code and `async` only for independent third-party scripts.

**★ Why does `type="module"` behave like `defer`?**
Because a module's entire import graph must be fetched and parsed before it can
execute, which cannot be done synchronously mid-parse. Deferral is a consequence
of the module system, not a separate feature. `async` can be added to override
it.

**Is "scripts at the bottom of `<body>`" still good advice?**
It works, but `defer` is better: the download begins as soon as the `<head>` is
parsed rather than after the whole body, while execution timing is the same.
Prefer `defer` or `type="module"`.

**What does `nomodule` do?**
It marks a fallback script for browsers that do not support modules. Module-aware
browsers ignore `nomodule` tags; older ones ignore `type="module"`. Exactly one
of the pair executes. Largely historical now.

**Why might native ESM be slower than a bundle in production?**
Because each module is a separate request and the graph is discovered
progressively, producing a waterfall. `modulepreload` mitigates it; bundling
removes it. That trade-off is why bundlers remain standard despite universal ESM
support.

---

← [06 · Hosts and globals](./06-hosts-and-globals.md) · [Phase index](./) · Next: [08 · Running and inspecting code](./08-running-and-inspecting.md) →
