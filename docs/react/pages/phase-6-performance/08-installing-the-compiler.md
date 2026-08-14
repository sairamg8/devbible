---
title: "Installing and configuring the Compiler"
sidebar_label: "08 · Installing the Compiler"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **babel-plugin-react-compiler 1.0.0**, from
> documentation — react.dev
> [React Compiler · Installation](https://react.dev/learn/react-compiler/installation)
> and [React Compiler · Configuration](https://react.dev/reference/react-compiler/configuration).
> The measured "turning it on" walkthrough with real Babel output is
> [Phase 0 · 11](../phase-0-how-react-runs/11-the-compiler.md).
> No sandbox script backs this page.

**Four things decide whether it works: the package, the plugin order, the `target`,
and how you verify it did anything.**

## Install

```bash
npm install -D babel-plugin-react-compiler@latest
```

It is a **dev dependency** and a **Babel plugin** — not a React package, not
something you import. Nothing in your source changes.

## 🔴 It must run first

```js
module.exports = {
  plugins: [
    'babel-plugin-react-compiler', // must run first!
    // ... other plugins
  ],
};
```

> React Compiler must run **first** in your Babel plugin pipeline. **The compiler
> needs the original source information for proper analysis**, so it must process
> your code before other transformations.

This is the misconfiguration that produces the worst symptom: it appears installed,
the build succeeds, and it silently optimises less than it should — because another
plugin has already rewritten the code into something it can no longer analyse.
There is no error for this.

## Framework setup

**Vite:**

```js
// vite.config.js
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()]
    }),
  ],
});
```

**Next.js** has its own `reactCompiler` config option; the docs defer to the Next.js
documentation rather than restating it, and so does this page — that surface changes
faster than React's.

## 🔴 `target` — and the runtime for React 17/18

The option that catches teams not yet on 19:

> **`target`** — Specifies which React version you're using for code compatibility.
> Accepted values: **`'17'`, `'18'`, `'19'`**.

```js
{
  target: '18' // Also requires react-compiler-runtime package
}
```

**React 19 ships the runtime the compiled output needs.** On 17 or 18 it does not
exist, so you must install **`react-compiler-runtime`** as well — and getting this
wrong produces a runtime failure about a missing import, not a build error, which is
a bad place to find out.

So the Compiler is genuinely usable before you upgrade to 19. That is worth knowing:
it is not gated behind the migration.

## The other options

| Option | What it decides |
|---|---|
| **`compilationMode`** | which functions get compiled — `'annotation'` compiles only functions marked `"use memo"` |
| **`panicThreshold`** | whether a Rules-of-React violation **fails the build** or is skipped |
| **`logger`** | a callback per compilation event, e.g. `event.kind === 'CompileSuccess'` |
| **`gating`** | a runtime feature flag, for A/B testing or a gradual rollout |

Three of these are adoption tools rather than tuning knobs, and they map onto a
sensible rollout:

**`compilationMode: 'annotation'`** is opt-in per function. You mark a component
with `"use memo"` and only that gets compiled — the way to introduce the Compiler to
a large codebase without compiling everything on day one.

```js
{
  panicThreshold: 'none' // Skip components with errors instead of failing the build
}
```

**`panicThreshold: 'none'`** is what makes a bail-out silent rather than fatal, which
is the behaviour Phase 0 measured: *"Bailing out is per-function and silent, so the
failure mode is 'no speed-up here', never a broken build."*

**`gating`** puts the compiled output behind a flag you control at runtime:

```js
{
  gating: {
    source: 'my-feature-flags',
    importSpecifierName: 'isCompilerEnabled'
  }
}
```

Which is how you A/B test the Compiler in production and can turn it off without a
redeploy.

**`logger`** is the answer to "how much of my code is actually being compiled" at
build time — the complement to the DevTools badge below.

## Verifying it did something

> Components optimized by React Compiler will show a **"Memo ✨" badge in React
> DevTools**.

That badge is the check that matters, because everything about a misconfigured
Compiler looks like success: the install works, the build passes, the app runs. If
no component shows the badge, the plugin is not running or is not running first.

Between the badge and a `logger` that counts `CompileSuccess` events, you can answer
"is it on, and how much is it reaching?" — which you should, before drawing any
conclusion about whether it helped.

## Rollout order

1. **Run `eslint-plugin-react-hooks` first** ([topic 10](10-eslint-plugin-react-hooks.md)).
   Its findings are the same violations that make the Compiler bail out, so fixing
   them both improves the code and increases how much can be optimised.
2. **Install with `panicThreshold: 'none'`** so violations skip rather than break the
   build.
3. **Check the "Memo ✨" badge** and, if you want numbers, a `logger`.
4. **Measure** ([topic 05](05-measure-before-you-optimise.md)) — the Compiler's
   benefit is a claim like any other.
5. Leave existing memoization alone ([topic 11](11-do-you-still-write-usememo.md)).

## Gotchas

**Symptom:** installed and configured, and almost nothing shows the "Memo ✨"
badge.
**Cause:** the plugin is not first in the Babel pipeline, so another transform ran
before it and destroyed the source information it needs.
**Fix:** put `babel-plugin-react-compiler` first. There is no error for this.

**Symptom:** a runtime error about a missing import after enabling it on React 18.
**Cause:** `target: '18'` without the `react-compiler-runtime` package.
**Fix:** install it. React 19 ships this; 17 and 18 do not.

**Symptom:** the build fails on a component that breaks the Rules of React.
**Cause:** the default `panicThreshold`.
**Fix:** `panicThreshold: 'none'` to skip instead — then fix the violations properly.

**Symptom:** no way to tell how much of the codebase is being compiled.
**Cause:** relying on the DevTools badge alone, component by component.
**Fix:** a `logger` counting `CompileSuccess` events at build time.

**Symptom:** the team is unwilling to compile everything at once.
**Cause:** a large codebase with unknown rule compliance.
**Fix:** `compilationMode: 'annotation'` and mark functions `"use memo"`
incrementally — or `gating` behind a runtime flag.

**Symptom:** the Compiler is believed to require React 19.
**Cause:** an assumption.
**Fix:** `target` accepts `'17'`, `'18'` and `'19'`; older versions need
`react-compiler-runtime`.

## Interview questions

**★ What is the one configuration mistake with no error message?**
Not putting `babel-plugin-react-compiler` first in the Babel plugin pipeline. The
docs are explicit that it needs the original source information for proper analysis
and must process the code before other transformations. Get it wrong and everything
looks fine — install succeeds, build passes, app runs — while far less is optimised
than you think. The "Memo ✨" badge in React DevTools is how you catch it.

**★ Can you use the Compiler before upgrading to React 19?**
Yes. The `target` option accepts `'17'`, `'18'` and `'19'`. On 17 or 18 you must
also install `react-compiler-runtime`, because React 19 ships the runtime the
compiled output depends on and earlier versions do not. Missing it surfaces as a
runtime failure about a missing import rather than a build error.

**★ How would you roll it out to a large existing codebase?**
Run the linter first, since its findings are exactly the violations that make the
Compiler bail out. Then install with `panicThreshold: 'none'` so violations skip
rather than fail the build. Use `compilationMode: 'annotation'` to opt in function
by function, or `gating` to put the compiled output behind a runtime feature flag
you can turn off without a redeploy. Verify with the DevTools badge and a `logger`,
then measure.

**How do you verify the Compiler is actually working?**
Components it optimised show a "Memo ✨" badge in React DevTools. For a codebase-wide
answer, a `logger` callback counting `CompileSuccess` events at build time. Both are
worth doing before concluding anything about whether it improved performance, because
a misconfigured Compiler is indistinguishable from a working one at every other
level.

**What does `panicThreshold` control?**
Whether a component that breaks the Rules of React fails the build or is skipped.
Setting it to `'none'` makes bail-outs silent and per-function, which is the
behaviour you want during adoption — no speed-up on that component, never a broken
build.

---

← Prev: [The React Compiler v1.0](07-the-react-compiler.md) · Index: [Phase 6](README.md) · Next → [How the Compiler bails out](09-how-the-compiler-bails-out.md)
