---
title: "The React Compiler"
sidebar_label: "11 · The React Compiler"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **babel-plugin-react-compiler 1.0.0** (stable since
> 7 Oct 2025) with **@babel/core 7.29.7**. Every transform below is the real
> output of `sandbox/react-p0/ex11-compiler.mjs`.

**The React Compiler is a build step that memoizes your components
automatically. It is stable, it is opt-in, and it changes what "well-optimised
React" looks like.**

This page is orientation — enough to decide whether to turn it on, and to read
its output when you meet it. Memoization as a discipline is Phase 6.

## What it does to your code

You write this:

```jsx
function ProductRow({product, onAdd}) {
  const price = formatPrice(product.cents);
  const handleClick = () => onAdd(product.id);
  return <li onClick={handleClick}>{product.name} — {price}</li>;
}
```

The compiler emits this:

```console
$ node ex11-compiler.mjs
=== the compiler emits ===
  import { c as _c } from "react/compiler-runtime";
  function ProductRow(t0) {
    const $ = _c(9);
    const { product, onAdd } = t0;
    let t1;
    if ($[0] !== product.cents) {
      t1 = formatPrice(product.cents);
      $[0] = product.cents;
      $[1] = t1;
    } else {
      t1 = $[1];
    }
    const price = t1;
    let t2;
    if ($[2] !== onAdd || $[3] !== product.id) {
      t2 = () => onAdd(product.id);
      $[2] = onAdd;
      $[3] = product.id;
      $[4] = t2;
    } else {
      t2 = $[4];
    }
    const handleClick = t2;
    let t3;
    if ($[5] !== handleClick || $[6] !== price || $[7] !== product.name) {
      t3 = <li onClick={handleClick}>{product.name} — {price}</li>;
      $[5] = handleClick;
      $[6] = price;
      $[7] = product.name;
      $[8] = t3;
    } else {
      t3 = $[8];
    }
    return t3;
  }
```

`_c(9)` allocates a nine-slot cache on the fiber. Each value gets slots for its
inputs and its result, and is recomputed only when an input actually changed.

Three things worth noticing:

1. **It memoizes the JSX itself** (`t3`), not just the values. That is something
   `useMemo` and `useCallback` never did for you by hand.
2. **It tracks fine-grained dependencies** — `product.cents`, not `product`. A
   change to `product.name` does not recompute `price`.
3. **It is not `useMemo`.** There is no hook call; it is a compiler-managed
   cache array, so the Rules of Hooks do not constrain it.

## What it will and will not touch

```console
=== which functions does it treat as compilable at all? ===
  component (capitalised, returns JSX)   2 slots
  hook that calls useState               8 slots
  hook that calls useMemo                5 slots
  use-prefixed fn calling NO hooks       not compiled
  plain function, no use prefix          not compiled
```

It compiles **components** and **hooks that actually call hooks**. A
`use`-prefixed helper that calls no hooks is treated as a plain function and
left alone — which is correct, since it has no fiber to hang a cache on, but
surprises people who assume every `useX` gets optimised.

Ordinary functions are never touched, so your utility modules are unchanged.

## It is not a linter

The most important thing to understand before switching it on:

```console
=== a component it CANNOT safely memoize (mutates a prop) ===
  function Broken({items}) {
    items.push('mutated during render');
    return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
  }

  compiled?  yes, 4 cache slots
  note       the mutation is NOT reported here; the linter is what flags it
```

A component that mutates a prop during render breaks the Rules of React. The
compiler **compiled it anyway**, into four cache slots, and said nothing.

Do not read that as "the compiler validates my code". It applies its analysis and
emits a cache; catching rule violations is the **linter's** job, and the linter
is where you should expect the error. The pairing matters: compiler for speed,
`eslint-plugin-react-hooks` for correctness.

It does refuse when it cannot analyse the function at all:

```console
=== so what DOES make it bail out? ===
  conditional hook  bailed out — left as written
```

A component with a hook inside an `if` is left exactly as written. Bailing out
is per-function and silent, so the failure mode is "no speed-up here", never a
broken build.

## Turning it on

```bash
npm install --save-dev --save-exact babel-plugin-react-compiler@latest
```

```js
// vite.config.js
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      babel: {plugins: [['babel-plugin-react-compiler', {}]]},
    }),
  ],
});
```

Two notes from the run above:

- The plugin **requires a filename**. Calling Babel without one fails with
  `Expected a filename but found none.` Bundlers always pass it; a hand-rolled
  transform script may not.
- Output imports from `react/compiler-runtime`, which ships **inside React 19**.
  Only if you target React 17 or 18 do you also install
  `react-compiler-runtime` and set a `target` in the plugin options.

The lint rules ship separately, in `eslint-plugin-react-hooks@7.1.1`:

```js
// eslint.config.js
import reactHooks from 'eslint-plugin-react-hooks';

export default [reactHooks.configs.flat.recommended];
```

That preset now includes the compiler-powered rules and **does not require the
compiler to be installed**. Turning the linter on first, fixing what it reports,
and only then enabling the compiler is the low-risk order.

## Should you turn it on?

**For a new project: yes.** The cost is a build-time dependency and slightly
slower builds; the benefit is that a whole category of performance work stops
being manual.

**For an existing codebase:** run the linter first. Its findings are the same
violations that make the compiler bail out, so fixing them both improves the
code and increases how much the compiler can optimise.

**What about the `useMemo` and `useCallback` you already wrote?** Leave them.
They are still correct, the compiler works around them, and deleting them is a
large diff with no measurable payoff. Delete them opportunistically when you are
already editing the file — and never delete a `useMemo` that exists for
*referential identity* required by a dependency array without checking what
depends on it.

## Gotchas

**Symptom:** `Expected a filename but found none.`
**Cause:** Babel invoked without a `filename` option.
**Fix:** pass one. Bundler integrations do this for you.

**Symptom:** the compiler is enabled but a slow component did not get faster.
**Cause:** it bailed out on that function, silently and per-function.
**Fix:** run the ESLint rules to find the violation; check the DevTools badge
for which components were compiled.

**Symptom:** a `use`-prefixed helper was not optimised.
**Cause:** it calls no hooks, so it is not treated as a hook. Measured above.
**Fix:** none needed — the values it returns get cached by the component that
uses them.

**Symptom:** `Cannot find module 'react/compiler-runtime'`.
**Cause:** React older than 19 without `react-compiler-runtime` installed.
**Fix:** install it and set the plugin's `target` to `17` or `18`.

**Symptom:** the compiler is on and a bug appears that memoization would explain
— a stale value that never updates.
**Cause:** almost always a genuine Rules of React violation that was previously
harmless because nothing was cached.
**Fix:** the linter will name it. Do not "fix" it by disabling the compiler for
that file without reading what it found.

## Interview questions

**★ What does the React Compiler do?**
It rewrites components and hooks at build time to cache values, callbacks and
JSX in a per-fiber cache array, recomputing each only when its actual inputs
change. It is automatic memoization, finer-grained than hand-written `useMemo`.

**★ Does it replace `useMemo` and `useCallback`?**
For new code, largely yes. Existing ones stay correct and are not worth a
mass deletion. `useMemo` used for referential identity that something else
depends on still needs care.

**★ Does it validate the Rules of React?**
No. Measured above: it compiled a component that mutates a prop during render
without complaint. Validation is `eslint-plugin-react-hooks`'s job — the rules
ship in its `recommended` preset and do not require the compiler.

**What happens to a component it cannot analyse?**
It bails out for that function and leaves the code as written. Silent, per
function, never a build failure — so the symptom is a missing optimisation.

**Is it stable?**
Yes, `babel-plugin-react-compiler@1.0.0` since October 2025. It supports React
17 and up; for 17 and 18 you also need `react-compiler-runtime` and a `target`
option, because `react/compiler-runtime` ships inside React 19.

---

← Prev: [Starting a project](10-starting-a-project.md) · Index: [Phase 0](README.md) · Next → [DevTools and the Profiler](12-devtools-and-profiler.md)
