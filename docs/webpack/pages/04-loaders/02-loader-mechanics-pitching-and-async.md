---
title: "Loader Mechanics: Pitching Phase, Async Loaders & Options"
sidebar_label: "Loader Mechanics"
sidebar_position: 2
---

# ⚙️ Loader Mechanics: Pitching Phase, Async Loaders & Options

## 1. Under-The-Hood Mechanics

Every loader chain actually runs in **two passes**, not one: the **pitching phase** (left-to-right) followed by the **normal phase** (right-to-left, covered in the previous doc). Most loaders never define a `pitch` function and are invisible in this phase — but the pitching phase exists specifically so a loader can **short-circuit** the rest of the chain.

```
use: [loaderA, loaderB, loaderC]

PITCHING PHASE (left-to-right):
  loaderA.pitch() ──► loaderB.pitch() ──► loaderC.pitch()
        │                                       │
        └── if any pitch() returns a value ──────┘── chain stops HERE, skips remaining pitches
                                                     AND skips the entire normal phase entirely,
                                                     using the returned value as the module's result

NORMAL PHASE (right-to-left, only if no pitch short-circuited):
  loaderC(source) ──► loaderB(result) ──► loaderA(result) ──► final module source
```
`style-loader` actually uses the pitching phase internally: its `pitch` function returns early, injecting a small runtime shim, without needing `css-loader`'s output to have been computed yet at that point in some configurations — an implementation detail most consumers never see directly, but that explains why loader authoring guides always mention the two-phase model.

### Synchronous vs Asynchronous Loaders
A loader can call `this.callback(err, content, sourceMap, meta)` or return a value directly (sync), or call `this.async()` to get a callback and return control **later** (e.g. after an `await fetch()` or reading another file):

```javascript
module.exports = function (source) {
  const callback = this.async(); // signals "I'll finish later" — Webpack won't block on this call returning
  someAsyncTransform(source).then(
    (result) => callback(null, result),
    (err) => callback(err)
  );
};
```

### Loader Options: Query Params vs `rules[].use.options`
Legacy syntax passed options via URL-style query strings (`'css-loader?modules=true'`); the modern, type-safe form is `{ loader: 'css-loader', options: { modules: true } }` in a rule's `use` array — the object form is preferred everywhere except quick one-off debugging.

---

## 2. Real-World Engineering Scenario

**Scenario**: Custom Loader Fetching Translation Strings From a Remote CMS at Build Time.
A custom `i18n-loader` needs to read a `.i18n` marker file, make an async HTTP request to a translations CMS, and inject the resolved strings as a JS module — none of this can happen synchronously. `this.async()` lets the loader function return immediately (not blocking Webpack's single-threaded compilation loop) while the network request resolves in the background, then completes the module transform once the CMS response arrives via the async callback.

---

## 3. Production-Grade Code Example

```javascript
// loaders/i18n-loader.js — a custom async loader
const fetchTranslations = require('../lib/cms-client');

module.exports = function i18nLoader(source) {
  const callback = this.async();
  const options = this.getOptions(); // reads rules[].use.options object

  const localeKey = source.match(/@i18n-key:\s*(\S+)/)?.[1];

  fetchTranslations(localeKey, options.locale)
    .then((strings) => {
      const moduleSource = `export default ${JSON.stringify(strings)};`;
      callback(null, moduleSource);
    })
    .catch((err) => callback(err));
};
```

```javascript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.i18n$/,
        use: [{ loader: require.resolve('./loaders/i18n-loader.js'), options: { locale: 'en-US' } }],
      },
    ],
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting to Call `this.async()` Before Doing Async Work
```javascript
// ❌ WRONG: the loader function returns undefined immediately (synchronously), while the Promise
// resolves later with NOTHING listening — Webpack treats the module as having empty/undefined content
module.exports = function (source) {
  fetchTranslations().then((result) => { /* too late — nobody's listening */ });
};

// ✅ CORRECT: grab the async callback FIRST, before starting any async operation
module.exports = function (source) {
  const callback = this.async();
  fetchTranslations().then((result) => callback(null, result));
};
```

### ⚠️ Pitfall 2: Non-Deterministic Loader Output Breaking the Filesystem Cache
A loader whose output depends on `Date.now()`, random IDs, or external state that changes between identical builds defeats Webpack's persistent filesystem cache (`cache: { type: 'filesystem' }`) — the cache key is partly derived from loader output determinism assumptions, and non-deterministic loaders force full re-transformation on every build even when the source file itself hasn't changed.

### ⚠️ Pitfall 3: A Loader Mutating Global State Instead of Staying Pure
Loaders run in Webpack's compilation process and can, in theory, be invoked multiple times per file (across multi-compiler configs, or cache invalidation reruns) — a loader that mutates a shared module-level variable to track state between invocations produces build results that depend on invocation order, an extremely hard class of bug to reproduce. Keep loader functions pure: all needed context should come from `this` (the loader context) or `this.getOptions()`, not module-level mutable state.
