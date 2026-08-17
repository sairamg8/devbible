---
title: "What `import express from 'express'` is actually asking for"
sidebar_label: "01 · What a default import means"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Modules*; *Modules →
> Reference*) and the **TSConfig reference** for `esModuleInterop` and
> `allowSyntheticDefaultImports`. **No sandbox, no console blocks** — the emit
> shapes below are the documented forms, not captured output.

The single most-copied line of configuration in the TypeScript ecosystem exists
because of one mismatch, and almost nobody who sets the flag can state it. This
chunk is the mismatch.

## The two things `default` can mean

```ts
import express from 'express';
```

That line asks for **the `default` export of the module `express`**. In an ES
module, `default` is a real, named thing — a binding the module author declared:

```js
// an ES module
export default function createApp() { … }
```

But `express` is CommonJS. It has no exports in the ES sense at all. It has a
single mutable object:

```js
// what express actually does, roughly
module.exports = function createApplication() { … };
module.exports.Router = Router;
```

🔴 **There is no `default` property on that object.** So the honest reading of
`import express from 'express'` against real CommonJS is: *give me
`module.exports.default`* — which is `undefined`.

That is the whole problem. Everything else in this topic is the mechanics of
papering over it, and the flags decide **how honestly** the paper is applied.

## Why the "correct" spelling is unbearable

TypeScript has always had a spelling that is exactly right for this:

```ts
import express = require('express');
```

The handbook describes it as syntax that *"directly correlates to a CommonJS and
AMD `require`"* and that *"ensures you have a 1 to 1 match in your TypeScript
file with the CommonJS output"*. It is accurate, it needs no flag, and it works.

⚠️ **And it is not ES module syntax.** It cannot be used in a file that emits
ESM, every linter and style guide in the ecosystem prefers `import … from`, and
it looks alien in a codebase that uses ES syntax everywhere else. So the
ecosystem went the other way and made `import x from` work instead.

## The convention that made it work — `__esModule`

The bridge predates TypeScript's involvement. Babel, transpiling ES modules to
CommonJS, needed a way for the *output* to remember that the *input* was an ES
module. It settled on a marker property:

```js
// what a transpiled ES module's output looks like
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = createApp;
```

That gives a rule anything consuming CommonJS can follow:

| The object has… | Treat it as… | `import x from` gives you… |
|---|---|---|
| `__esModule: true` | a transpiled ES module | its `.default` property |
| no `__esModule` | genuine CommonJS | **the whole `module.exports` object** |

🔴 **That second row is the synthetic default.** It is not a property that
exists; it is a rule saying *"when there is no `default`, pretend the module
itself is the default"*. Both TypeScript flags in this topic are ways of opting
in to that rule — one for the type system, one for the type system *and* the
emitted JavaScript.

📌 **This is a convention, not a specification.** Node's own ESM-importing-CJS
behaviour and bundlers' interop each implement something close to it with their
own edge cases. That is why interop bugs are so often "works in the bundler,
fails in Node" rather than "does not compile".

## The other half — namespace imports

The same mismatch has a second face, and it is the one that catches people who
thought they had avoided the problem:

```ts
import * as express from 'express';
express();          // ← is this legal?
```

In real ES modules, `import * as ns` gives you a **module namespace object**. The
specification says a namespace object is not callable and not constructible —
so `express()` is meaningless, no matter what the runtime object happens to be.

Without interop, TypeScript modelled `import * as x` as "x is `module.exports`",
which made `express()` work and was *wrong about ESM*. With `esModuleInterop` on,
it models the namespace object properly — which is more correct and **breaks
exactly this code**:

> **TS2497:** *"This module can only be referenced with ECMAScript
> imports/exports by turning on the '{0}' flag and referencing its default
> export."*

⚠️ **So `esModuleInterop` is not purely permissive.** It *allows* a default
import that was previously an error, and it *forbids* calling a namespace import
that previously worked. Migrations feel confusing because the flag moves in both
directions at once — chunk 05.

## What the shim author has to decide

This topic sits directly behind
[topic 08 · chunk 03](../08-typing-an-untyped-dependency/03-the-shim.md), and the
connection is worth making explicit now:

- **The declaration describes the runtime.** If the package assigns
  `module.exports = fn`, the shim says `export =`. Full stop.
- **Whether a consumer may write `import x from` against that is a *flag*
  question, decided in the consumer's `tsconfig.json`** — not something the shim
  should try to accommodate by declaring a `default` that does not exist.

🔴 **Writing `export default` in a shim to make a consumer's import compile is
the single worst outcome in this whole area**: the build goes green, the flags
appear unnecessary, and the value is `undefined` at runtime with nothing pointing
at the cause.

## The four questions the rest of this topic answers

1. **Which flag, and what is the difference?** One changes types only; the other
   changes types *and* emitted JavaScript. [Chunk 02](./02-the-two-flags.md).
2. **What does the emit actually look like?** `__importDefault`, `__importStar`,
   and what they cost. [Chunk 03](./03-the-emit.md).
3. **What is each error asking for?** Six diagnostics that all mean roughly this,
   and differ in what they will accept. [Chunk 04](./04-the-errors.md).
4. **Should I turn it on, and what breaks?** Including the case where it is
   already on and you did not set it. [Chunk 05](./05-choosing-and-migrating.md).

## Gotchas

**Symptom:** `import pkg from 'some-cjs-lib'` is `undefined` at runtime.
**Cause:** The package has no `default` property; the import asked for one.
**Fix:** Turn on the interop flag so the emit performs the synthetic-default
dance, or use `import pkg = require('some-cjs-lib')`.

**Symptom:** It works in the bundler and fails under Node.
**Cause:** `__esModule` is a convention, and bundlers, Node's ESM/CJS interop and
TypeScript's emit each implement something close to it with different edges.
**Fix:** Test the runtime you actually ship on. A green `tsc` says nothing about
which of those you are running under.

**Symptom:** `import * as express from 'express'; express()` stopped compiling.
**Cause:** With interop on, a namespace import is modelled as a real module
namespace object, which is not callable.
**Fix:** `import express from 'express'`. The old behaviour was convenient and
incorrect.

**Symptom:** Somebody "fixed" a consumer's import error by adding
`export default` to a shim.
**Cause:** It makes the error go away.
**Fix:** Revert it. The declaration must describe the runtime; the import form is
the consumer's flag question. This produces a green build and `undefined`.

**Symptom:** `import x = require('y')` is rejected in an ESM file.
**Cause:** It is CommonJS syntax and cannot be emitted as ESM.
**Fix:** Use a default import with interop, or a dynamic `import()`.

**Symptom:** A package works with `import * as x` and not with `import x from`,
or the reverse, and neither seems principled.
**Cause:** Whether it sets `__esModule` — that is the whole difference, and it
depends on how the package was built rather than on anything visible in its
source.
**Fix:** Look at the built entry point, not the repository.

## Interview questions

**★ Why does `import express from 'express'` need a flag at all?**
Because `express` is CommonJS and has no `default` export — the ES-module import
is asking for `module.exports.default`, which is `undefined`. The flag opts into
the convention that a module *without* an `__esModule` marker should be treated
as its own default.

**★ What is `__esModule`?**
A marker property Babel introduced so that CommonJS *output* could remember it
came from ES-module *input*. Anything consuming CommonJS uses it as the test:
marker present → take `.default`; absent → treat the whole `module.exports` as
the default. It is a convention, not a specification, which is why interop edges
differ between Node and bundlers.

**★ What is the "correct" import for a CommonJS package, and why is it not used?**
`import express = require('express')` — the handbook's own 1-to-1 correlation
with `require`. It needs no flag and is accurate. It is avoided because it is not
ES syntax, cannot appear in a file emitting ESM, and clashes with every modern
style guide.

**★ Why does `esModuleInterop` break `import * as x from 'cjs'; x()`?**
Because with the flag on, a namespace import is modelled as a real ES module
namespace object, which the specification says is neither callable nor
constructible. The previous behaviour — treating it as `module.exports` — was
convenient and wrong about ESM.

**Should a shim ever declare `export default` for a CommonJS package?**
No. The declaration describes the runtime; if the package assigns
`module.exports`, that is `export =`. Declaring a `default` that does not exist
makes the consumer's build green and their value `undefined`, with nothing to
point at.

**Two packages behave differently under the same flags. What explains it?**
Whether their built output sets `__esModule`. That is decided by how each was
transpiled and bundled, and it is invisible in the source repository — so check
the entry point the package actually ships.

---

Next → [02 · The two flags](./02-the-two-flags.md)
