---
title: "The classic runtime and @jsxImportSource"
sidebar_label: "15 · The classic runtime"
sidebar_position: 15
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against **@babel/preset-react 7.29.7** and **react 19.2.8**.
> All compiler output is printed by `sandbox/react-p1/ex01-jsx-is-a-call.mjs`.

**Before React 17 there was one JSX transform, and it emitted
`React.createElement`. You will still meet it — in older repos, in tutorials, in
a misconfigured file — and one error message is its signature.**

## What it emits

```console
$ node ex01-jsx-is-a-call.mjs
=== 7. classic runtime — what React 16 and earlier emitted ===
const el = /*#__PURE__*/React.createElement("ul", null,
  /*#__PURE__*/React.createElement("li", null, "a"),
  /*#__PURE__*/React.createElement("li", null, "b"));
```

Three differences from the automatic runtime:

| | Classic | Automatic |
|---|---|---|
| Function | `React.createElement` | `jsx` / `jsxs` from `react/jsx-runtime` |
| Import | **you** must write `import React from 'react'` | injected by the compiler |
| Children | rest arguments after props | a `children` key inside props |
| Key | inside props, extracted at runtime | a separate third argument |
| Dev info | none | `jsxDEV` carries file, line, column |

The `React` in the output is an ordinary identifier that must be **in scope**.
That is the entire reason every React file used to start with an import it
never appeared to use — and why removing an "unused" import broke the file.

## The error that identifies it

```
ReferenceError: React is not defined
```

If you see that in a project where no other file imports React, the file was
compiled with the classic transform. It is a build configuration problem, not a
code problem — do not "fix" it by adding the import unless you intend to keep
the classic transform for that path.

The usual causes:

- a second Babel config (`.babelrc` in a subdirectory) that a monorepo picks up
- a bundler default that differs from the rest of the toolchain
- a `/** @jsx */` pragma left in a file
- a test runner transforming with different options from the build

## The pragmas

A pragma comment overrides the transform for a single file.

```console
=== 8. classic runtime with a custom pragma ===
/** @jsx h */
/** @jsxFrag Frag */
const el = h(Frag, null, h("a", null), h("b", null));
```

`@jsx` names the factory function, `@jsxFrag` names the fragment type. This is
how pre-17 codebases used Preact or hyperscript-style libraries.

The automatic runtime has its own:

```console
=== 9. automatic runtime pointed at another library ===
import { jsx as _jsx } from "preact/jsx-runtime";
/** @jsxImportSource preact */
const el = _jsx("h1", { className: "title", children: "Hello" });
```

`@jsxImportSource` changes the *package* the runtime is imported from — the
import is still injected, and the file still needs no `React`. This is the
modern mechanism, and it is what CSS-in-JS libraries with a custom `jsx` factory
use, as well as any non-React library that ships a `jsx-runtime` entry point.

Both forms exist as compiler options too, which is the right place for them —
per-file pragmas are for exceptions.

## Configuring the transform

The option is named `runtime` almost everywhere:

```jsonc
// Babel
["@babel/preset-react", {"runtime": "automatic"}]          // or "classic"
["@babel/preset-react", {"runtime": "automatic", "importSource": "preact"}]
```

```jsonc
// TypeScript — tsconfig.json
{"compilerOptions": {"jsx": "react-jsx",     // automatic
                     "jsxImportSource": "preact"}}
// "jsx": "react"     → classic
// "jsx": "react-jsxdev" → automatic, development (jsxDEV)
// "jsx": "preserve"  → leave JSX alone for another tool to handle
```

```jsonc
// esbuild
{"jsx": "automatic", "jsxImportSource": "preact", "jsxDev": true}
```

`"jsx": "preserve"` in TypeScript is worth recognising: it means "someone else
does this", and it is what you use when Babel, SWC or the bundler owns the
transform. A file compiled with `preserve` and then never passed to that other
tool ships literal JSX and fails at parse time.

## Is `createElement` deprecated?

No. It is still exported by React 19.2.8, still documented, and still the
correct answer when there is no build step:

```html
<script type="module">
  import React from 'https://esm.sh/react@19.2.8';
  import {createRoot} from 'https://esm.sh/react-dom@19.2.8/client';
  const e = React.createElement;
  createRoot(document.getElementById('root'))
    .render(e('h1', {className: 'title'}, 'Hello'));
</script>
```

What changed in React 19 is `createFactory`, which **was** removed, along with
`React.render`, `hydrate` and `unmountComponentAtNode` (see the
[Phase 0 page](../phase-0-how-react-runs/09-what-changed-in-19.md)).

## When you actually need this page

- **Reading an old codebase.** Every file starts with an unused-looking React
  import; that is the classic transform, not a style choice.
- **A migration.** Switching to the automatic runtime lets you delete those
  imports — there is a codemod, and the risk is a file with a stray pragma.
- **A library with a custom `jsx` factory.** Some CSS-in-JS libraries ship one;
  `jsxImportSource` is how it is wired.
- **Debugging a build.** "React is not defined" and "\_jsx is not defined" are
  the two symptoms, and they point in opposite directions.

## Gotchas

**Symptom:** `ReferenceError: React is not defined` in one file.
**Cause:** that file is compiled with the classic transform, and `React` is not
imported.
**Fix:** find the config or pragma that differs — a nested `.babelrc`, a
different test transform, a leftover `/** @jsx */`.

**Symptom:** `_jsx is not defined` or a JSX syntax error at runtime.
**Cause:** the opposite — the transform did not run at all. Often a `.js` file
the bundler does not treat as JSX, or `"jsx": "preserve"` with nothing
downstream.
**Fix:** rename to `.jsx`, or configure the loader for that path.

**Symptom:** removing an "unused" `import React` breaks the build.
**Cause:** classic transform. The identifier is used by the emitted code, which
the linter cannot see.
**Fix:** move to the automatic runtime, then remove the imports.

**Symptom:** a custom `jsx` factory works in the app but not in tests.
**Cause:** the test runner has its own transform config without
`jsxImportSource`.
**Fix:** set it in both places, or share one config.

**Symptom:** production error messages lost their file and line numbers.
**Cause:** production uses `jsx`, not `jsxDEV`. Not a misconfiguration.
**Fix:** nothing to fix; reproduce with a development build.

## Interview questions

**★ What is the difference between the classic and automatic JSX runtimes?**
Classic emits `React.createElement` and requires `React` to be in scope, with
children as rest arguments and `key` inside props. Automatic — the default since
React 17 — emits `jsx`/`jsxs` imported from `react/jsx-runtime` by the compiler,
puts children in the props object and `key` in a separate argument, and needs no
React import. Development builds use `jsxDEV`, which additionally carries the
file, line and column.

**Why did old React files always `import React` even when they never used it?**
Because the classic transform emitted `React.createElement`, so the identifier
had to be in scope. Linters could not see that use, which is why the import
looked unused.

**What does `@jsxImportSource` do?**
Changes which package the automatic runtime is imported from — `preact`, or a
CSS-in-JS library with its own `jsx` factory — as a per-file pragma or a
compiler option.

**Has `createElement` been removed?**
No. It is still exported in 19.2.8 and is the right API without a build step.
`createFactory` was removed in React 19, as were `ReactDOM.render`, `hydrate`
and `unmountComponentAtNode`.

**What does TypeScript's `"jsx": "preserve"` mean?**
Leave the JSX untransformed for another tool — Babel, SWC or the bundler — to
handle. A file compiled that way and never passed downstream ships literal JSX.

---

← Prev: [Whitespace and text](14-whitespace-and-text.md) · Index: [Phase 1](README.md)
