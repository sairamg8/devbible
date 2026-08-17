---
title: "08 — Choosing"
sidebar_label: "08 · Choosing"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** for every flag named, and
> against the lib composition and option defaults read from the installed
> **TypeScript 5.9.3** build in the previous chunks. **No sandbox, no console
> blocks.**

Everything so far has been mechanism. This chunk is the decision, and it comes
down to two questions you can answer without looking anything up.

## The two questions

1. **What will parse this code?** → `target`
2. **What will this code find at runtime?** → `lib` + `types`

Answer them about the *deployment target*, not about your laptop, not about the
version of Node in your terminal, and not about what the previous config said.

## The recipes

Four shapes cover almost everything. Each is a starting point, not a decree —
but each is defensible, and each says something true.

### A Node service

```jsonc
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023"],
    "types": ["node"]
  }
}
```

The whole point is the **absence** of `dom`. This config says: this is a server,
there is no `document`, and if you reach for one the compiler will say so.

⚠️ **Doing this to an existing Node project is a genuinely useful audit.** Every
error it produces is either a browser API that has no business being there, or a
web API you should be getting from `@types/node` instead. Neither is noise.

Match `target` to the Node version you deploy. Phase 7 · 01 argues the concrete
numbers, including why `"es5"` is the tell of a config nobody has read.

### A browser application

```jsonc
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022", "dom", "dom.iterable"]
  }
}
```

`dom.iterable` is the one people forget, and its absence produces confusing
errors about `NodeList` and `FormData` not being iterable rather than anything
mentioning `lib`.

Note there is no `types`. A browser app that lists `types` has to keep the list
current for every `@types` package it uses, and the auto-inclusion default is
usually fine here — the leakage that `types` protects against matters most on the
server.

⚠️ **`target` in a bundled app is often the wrong lever anyway.** If esbuild,
SWC or Babel is doing the downlevelling, `tsc`'s `target` affects only type
checking's view of the world, and the bundler's own target is what ships. Say
that out loud in the config's comments, because two settings that look like the
same knob and are not is exactly how a project ends up shipping ES2022 syntax to
a browser matrix that promised ES2017.

### A web worker

```jsonc
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022", "webworker"]
  }
}
```

**No `dom`.** They are alternatives, not companions — chunk 04 shows the two
conflicting `self` declarations that prove it. A codebase with both workers and
page code needs **two configs over two file sets**, not one config with both
libs.

### A published library

```jsonc
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["es2020"],
    "types": []
  }
}
```

Three deliberate choices, and all three are about the *consumer*:

- **A numbered `lib`, never `esnext`.** `lib.esnext.d.ts` grows every TypeScript
  release, so `esnext` in a library means the APIs you are allowed to call depend
  on which compiler happened to build it.
- **A conservative `target`**, because consumers may downlevel further and cannot
  raise what you shipped.
- **`"types": []`**, so the package cannot silently depend on an ambient global
  that its consumers do not have. Anything from Node gets an explicit
  `import … from "node:…"`.

🔴 **The `types: []` line is the one that catches real bugs.** Without it, a
library that uses `Buffer` compiles fine on the author's machine — `@types/node`
is in the tree because something else pulled it in — and fails for a consumer in
a browser. The failure is not a type error at your build; it is a runtime
`ReferenceError` at theirs.

## When to set `lib` explicitly at all

**Set it** when the answer to "what runs this?" is anything other than "a modern
browser":

- a server, where the DOM is a lie
- a worker, where the DOM is the wrong lie
- a published library, where `esnext` is not a promise you can keep
- a runtime with a known API floor — an embedded engine, an older Electron, a
  device browser

**Leave it unset** when the project is a browser app on evergreen browsers and
`target` alone is an honest description. That is the one case where the `.full`
default is exactly right, and adding `lib` buys nothing but a chance to get
chunk 03's trap wrong.

## The polyfill case, done honestly

A polyfill is the one situation where `lib` and `target` *should* disagree, and
the by-feature libs are what make it expressible:

```jsonc
{
  "compilerOptions": {
    "target": "es2019",          // the runtime's syntax floor
    "lib": ["es2019", "es2022.error", "dom"]   // …plus one API we polyfill
  }
}
```

That config says something precise and true: *emit ES2019 syntax, and by the way
`Error.cause` exists because we shipped a shim for it.*

⚠️ **The dishonest version is `"lib": ["esnext"]` with a couple of polyfills
loaded.** It compiles, and it approves every call to every API TypeScript knows
about, most of which you did not polyfill. Chunk 01's rule again: `lib` is a
promise, and the compiler has no way to check it.

## Three things to check on any config you inherit

1. **Is `lib` absent?** Then the DOM is present. Ask whether that is true of the
   runtime.
2. **Is `types` set?** Then auto-inclusion is off, and a missing global may be an
   installed package that was excluded — the `TS2591` case.
3. **Is `target` `"es5"`?** Then it was almost certainly copied, not chosen. It
   was the default for a decade and is now correct for very little.

## Gotchas

**Symptom:** you set `"lib": ["es2023"]` on a Node service and a hundred errors
appeared.
**Cause:** working as intended — those hundred lines were relying on the DOM.
**Fix:** read them. Most are `console`/`setTimeout`/`fetch` needing
`@types/node`, and a few are genuine browser APIs in server code.

**Symptom:** a library works for you and throws `ReferenceError: Buffer is not
defined` for a consumer.
**Cause:** `@types/node` was ambiently available at your build and the code has
no import to prove it.
**Fix:** `"types": []` in the library's config. It turns that class of bug into a
compile error at the right time.

**Symptom:** `"target": "esnext"` in a published package.
**Cause:** it means "whatever this compiler thinks is newest", which is not a
property of your consumers' runtimes.
**Fix:** pick a number. Anything else is not a decision, it is a deferral.

**Symptom:** the bundler and `tsc` disagree about the output level.
**Cause:** two independent `target` settings. `tsc` may only be type-checking.
**Fix:** decide which tool owns emit, and set the other to match rather than
leaving it to chance.

**Symptom:** the worker config lists both `dom` and `webworker` "to be safe".
**Cause:** they conflict — see chunk 04's `self` declarations.
**Fix:** two configs over two file sets. There is no combined form.

**Symptom:** an app-wide `lib` was tightened, and the *tests* broke.
**Cause:** test files often legitimately need a different environment (jsdom,
`@types/jest`) than the source they exercise.
**Fix:** a separate test config with its own `lib` and `types`, restating every
value it needs — `extends` replaces arrays rather than merging them.

**Symptom:** `"lib": ["es2022"]` and a dependency's `.d.ts` still drags in DOM
types.
**Cause:** a `/// <reference lib="dom" />` in that dependency. Lib references are
additive and program-wide, and there is no way to remove one.
**Fix:** nothing local. Raise it upstream; the workaround is to accept it.

**Symptom:** two developers get different errors from the same commit.
**Cause:** different TypeScript versions with `"lib": ["esnext"]`, or different
installed `@types` with no `types` array.
**Fix:** pin the compiler, and set `types` in anything where reproducibility
matters.

## Interview questions

**How do you decide `target`?**
By the oldest runtime that must parse the output — not the newest one you test
on, and not the version of Node in your terminal. If a bundler owns emit, `tsc`'s
`target` is only the checker's view and should be documented as such.

**What is the right `lib` for a Node service?**
An ES version with no `dom`, plus `@types/node` via `types`. The absence of
`dom` is the whole point; it turns "browser API in server code" from a runtime
crash into a compile error.

**Why is `esnext` a bad `lib` for a published library?**
Because `lib.esnext.d.ts` grows with each TypeScript release, so what the library
is permitted to call depends on which compiler built it. Consumers on older
runtimes get approved calls that throw.

**Why would you set `"types": []`?**
To stop the package silently depending on ambient globals that consumers may not
have. It forces `import … from "node:…"` for anything from Node, which is a
statement the consumer can act on.

**When is it right for `target` and `lib` to disagree?**
When a polyfill genuinely provides the API. `"target": "es2019"` with
`"lib": ["es2019", "es2022.error"]` says exactly what is true and nothing more.

**Can one config serve page code and worker code?**
No. `dom` and `webworker` declare conflicting globals, so it takes two configs
over two file sets.

**What does an inherited `"target": "es5"` usually tell you?**
That the config was copied rather than chosen. It was the compiler default for a
decade, and it is correct for very little today.

**What should you check first in an unfamiliar `tsconfig.json`?**
Whether `lib` is absent — because if it is, the DOM is in the program regardless
of what the project actually runs on.

---

← [07 · The diagnostics, and why only some help](./07-the-diagnostics.md) · [Topic index](./README.md) · Next → **Topic 05 · `isolatedModules`** *(not written yet)*
