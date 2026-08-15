---
title: "02 · Code splitting in practice"
sidebar_label: "02 · Code splitting"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`import()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import), [`<link rel="modulepreload">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/modulepreload), [`<link rel="preload">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preload), [`import.meta`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta), [`navigator.connection`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection), [`Window: error` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/error_event) — and ECMAScript [§ `import` calls](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-import-calls). Documentation-validated; **no timings, no console blocks**.

Dynamic `import()` is the language feature. **Code splitting is what a bundler does with it** —
and the two only meet if the bundler can see what you meant.

## The static-analysis rule

A bundler decides at build time which modules become which chunk. It does that by reading your
`import()` calls literally, so:

```js
await import('./editor.js');                     // ✅ one chunk, obvious
await import(`./locales/${lang}.js`);            // ✅ a chunk PER FILE matching that pattern
await import(userSuppliedPath);                  // 🔴 unanalysable — nothing is bundled
```

🔴 **A fully dynamic specifier defeats the bundler.** It cannot know what to emit, so either the
build warns and leaves a bare runtime import that 404s in production, or it conservatively
bundles far more than you wanted. The template-literal form with a **static prefix and
extension** is the supported middle ground — build tools use exactly those two anchors to glob
the candidates.

**When the set is small and known, an explicit map beats cleverness:**

```js
const loaders = {
  en: () => import('./locales/en.js'),
  fr: () => import('./locales/fr.js'),
};
const messages = await (loaders[lang] ?? loaders.en)();
```

Every specifier is a literal, so the build is exact, unused locales are separate chunks, and an
unknown `lang` cannot produce a request for an arbitrary path. **That last point is a security
property**, not just tidiness — a specifier built from user input is a request you did not
intend.

## Split where the user's attention already is

Splitting is not free: each chunk is a request, and a request made at the wrong moment is worse
than no split at all. The boundaries that pay:

| Split at | Why |
|---|---|
| **Route boundaries** | the user is already waiting for a navigation |
| **A modal, editor or chart opened by a click** | the interaction gives you cover |
| **Large, rarely used dependencies** | a PDF renderer, a diagram library, a date-picker locale set |
| **Polyfills behind a feature test** | modern browsers never download them |

**Do not split** what is needed for the first render, or dependencies shared by everything —
that just adds a round trip to the critical path.

```js
// ✅ a polyfill nobody modern pays for
if (!('anchorName' in document.documentElement.style)) {
  await import('./polyfills/anchor-positioning.js');
}
```

## The waterfall, and preloading

🔴 **A dynamic import inside a dynamically imported module is a second round trip that starts
only when the first finishes.** Chains of these are how a "fast, code-split" application ends up
slower than the bundle it replaced — the network sits idle between hops.

Two fixes, and they are complementary:

**Start the load before you need it.** `import()` is an expression, so nothing forces you to
await it where you call it:

```js
const chartModule = import('./chart.js');        // 🔴 starts NOW, on hover
button.addEventListener('click', async () => {
  const { render } = await chartModule;          // usually already resolved
  render(data);
});
```

⚠️ **A promise created and not awaited is a floating promise** — if it rejects before anyone
attaches a handler you get an `unhandledrejection`
([Phase 7 · 11 · Floating promises](../../phase-7-async/11-anti-patterns/02-floating-promises.md)).
Attach a `.catch(() => {})` deliberately, or await it in a handler that runs regardless.

**Tell the browser earlier still.** `<link rel="modulepreload">` fetches a module *and its
dependency graph* at high priority without executing it, which is what makes it different from
`rel="preload"`:

```html
<link rel="modulepreload" href="/assets/editor-a1b2c3.js">
```

Most bundlers emit these for you; the judgement is *which* chunks deserve one. Preloading
everything reinstates the monolith with extra steps.

## Chunk-load failures are their own error class

After a deploy, a page still open in a browser holds references to the **old** chunk filenames.
Those files may no longer exist, so a lazy import that has worked all day suddenly rejects — for
one user, on one build, and nowhere in your tests.

```js
async function loadFeature() {
  try {
    return await import('./feature.js');
  } catch (err) {
    if (sessionStorage.getItem('reloaded-for-chunk')) throw err;   // 🔴 reload ONCE
    sessionStorage.setItem('reloaded-for-chunk', '1');
    location.reload();                                             // fetch the new index
    return new Promise(() => {});                                  // never settles; page is going
  }
}
```

🔴 **Reloading, not retrying, is the fix** — the module registry has cached the failure and the
file is genuinely gone; only a fresh document picks up the new asset names. And **guard against
the reload loop**: a persistent failure with no flag reloads forever.

**Report it separately.** These are not application errors; grouping them with real exceptions
buries both — **10 · Global error handling** *(not written yet)*.

## Loading state is part of the feature

An `import()` behind a click has a duration, and the user is looking at the button:

```js
button.addEventListener('click', async () => {
  button.disabled = true;
  const spinner = showSpinner();
  try {
    const { open } = await import('./dialog.js');
    open();
  } catch {
    toast('Could not load. Check your connection.');
  } finally {
    spinner.remove();
    button.disabled = false;
  }
});
```

Three things that page gets right: **feedback** during the wait, **a message** when the load
fails rather than a dead button, and **restored state** in `finally` so the button works on the
next attempt. The double-click hazard in the middle is
[Phase 7 · 17 · Double submit](../../phase-7-async/17-race-conditions-ui/02-the-other-races.md).

## Server-side and Node

The same expression, different pressures:

- **Startup cost, not download cost.** `await import()` in a CLI defers parsing and evaluating a
  heavy dependency until the subcommand that needs it — often the largest single win in start-up
  time.
- **It is the bridge from CommonJS to ESM.** `require()` cannot load an ES module in older Node
  versions, but `await import()` can, which makes it the standard interop escape hatch
  (**15 · CommonJS in a modern world** *(not written yet)*).
- **No waterfall concern, but real caching consequences** — the module registry is per process,
  so a dynamically imported module stays loaded for the life of it.

## Gotchas

**Symptom: the dynamic import 404s in production and works in development.**
Cause — a non-analysable specifier; the dev server resolves at runtime, the build emitted no chunk.
Fix — a literal, or a template with a static prefix and extension; better, an explicit map.

**Symptom: code splitting made the page slower.**
Cause — a chained waterfall, or splitting something on the critical path.
Fix — split at interaction and route boundaries; start the load early; `modulepreload` the ones
that matter.

**Symptom: lazy features break for users who had the page open during a deploy.**
Cause — the old chunk filenames no longer exist.
Fix — catch the failure and reload once, guarded by a flag; report these separately.

**Symptom: an `unhandledrejection` from a preloaded module nobody awaited yet.**
Cause — a floating promise created to warm the load.
Fix — attach a deliberate `.catch(() => {})` at creation.

**Symptom: a reload loop after a chunk failure.**
Cause — the reload path has no memory of having reloaded.
Fix — a `sessionStorage` flag, cleared on success.

**Symptom: `import(userInput)` fetches unexpected paths.**
Cause — a specifier built from untrusted input.
Fix — a fixed map of literal loaders; never interpolate user data into a specifier.

**Symptom: a CLI is slow to start even for `--help`.**
Cause — heavy dependencies imported statically at the top level.
Fix — `await import()` inside the subcommand that needs them.

## Interview questions

**★ Why does a bundler need your specifier to be statically analysable?**
Because it decides at build time which modules become which chunk. A fully dynamic specifier
gives it nothing to emit, so the import fails at runtime or the build over-includes.

**★ Where should you split?**
At route and interaction boundaries, and around large rarely used dependencies — places where the
user is already waiting. Not on the critical path, and not so deep that chunks load in a chain.

**★ How do you avoid the waterfall?**
Start the load before it is needed — `import()` returns a promise you can hold — and use
`<link rel="modulepreload">` for chunks you know are coming; it fetches the module and its
dependencies without executing them.

**★ A user's lazy feature breaks after you deploy. Why, and what do you do?**
Their page references the previous build's chunk names, which no longer exist. Catch the rejection
and reload the page once, guarded against a loop; retrying the import cannot work.

**★ What is wrong with `import(pathFromUser)`?**
It is unanalysable *and* it lets input choose what code gets fetched. Use a fixed map of literal
loaders.

**★ What does dynamic import buy you on the server?**
Deferred start-up cost — a CLI or worker only parses the heavy dependency when the path that
needs it runs — and it is the supported way to load an ES module from CommonJS.

**Why `modulepreload` rather than `preload`?**
It fetches the module *and its dependency graph*, and prepares it as a module, without executing
it.

---

← [01 · The expression](./01-the-expression.md) · [Topic index](./README.md)
