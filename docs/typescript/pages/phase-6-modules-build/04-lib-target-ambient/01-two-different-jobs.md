---
title: "01 — Two different jobs"
sidebar_label: "01 · Two different jobs"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TSConfig reference** (`target`, `lib`) and the
> option records read out of the installed **TypeScript 5.9.3** build
> (`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`). **No sandbox, no
> console blocks.**

`target` and `lib` are set on the same line of the same file, they take
overlapping values (`"es2020"` is legal in both), and one silently changes the
other. That is enough for most people to treat them as one setting with two
spellings.

They are not. They answer two different questions, and the questions are not even
about the same phase of the compiler.

## The two questions

| | `target` | `lib` |
|---|---|---|
| Question | **What syntax may the emitted JavaScript use?** | **What globals may the source code assume exist?** |
| Phase | Emit | Checking |
| Effect if wrong | Output the runtime cannot parse, or output downlevelled for no reason | Errors on code that works, or silence on code that crashes |
| Failure shows up | At load time, usually as a `SyntaxError` | At type-check time, or **not at all** |

`target` is about **output**. `lib` is about **input**.

## `target` — the syntax level of the output

`target` tells the emitter which JavaScript version it is allowed to produce. If
you write a class field, an `async` function, or optional chaining, `target`
decides whether that construct survives into the output or gets rewritten into
something older.

```ts
class Counter {
  count = 0;               // class field — ES2022 syntax
  bump = async () => { this.count++; };
}
```

- `"target": "es2022"` — the class field is emitted as a class field. Roughly
  what you wrote.
- `"target": "es5"` — no class fields, no `async`, no arrow functions. The
  emitter rewrites all three: the field becomes an assignment in a synthesized
  constructor, `async` becomes a state machine, the arrow becomes a `function`
  with a captured `this`.

Both are *correct*. One is a much larger file that is much harder to debug.

**`target` never changes what type-checks.** Downlevelling is a rewrite of code
the checker has already accepted.

## `lib` — the declarations that describe the environment

`lib` tells the checker which bundled `.d.ts` files describe the world your code
runs in. It has no effect on emit whatsoever.

```ts
const ids = new Set<string>();          // needs the ES2015 lib
document.querySelector("#app");         // needs the DOM lib
process.env.NODE_ENV;                   // needs neither — needs @types/node
```

Each of those three lines fails for a different reason when the environment is
wrong, and only the third has nothing to do with `lib` at all. Chunk 05 is about
that third line.

## The link between them, and why it hides the distinction

**`lib` defaults from `target`.** If you never write `lib`, the compiler derives
one from `target` — and the derivation is not the obvious one. Chunk 03 is
entirely about it, because it is where most of the surprises in this topic come
from.

That default is why the two settings feel like one. Bump `target` from `es2017`
to `es2022`, and `Array.prototype.at` starts type-checking — not because `target`
changed anything about checking, but because the *derived* `lib` moved with it.
The moment you write `lib` explicitly, that coupling is gone, and people are
routinely surprised by what stops working.

## Why "the ambient environment" is the better name

`lib` is a poor name for what the setting does. It does not load a library. It
declares an **ambient environment**: a set of names that exist in every file
without being imported.

That is a genuinely different mechanism from the one the rest of this phase is
about. Everywhere else, a name gets into your file because you wrote an `import`
and the resolver found a file. Ambient declarations get in because they are in
the program at all.

| | Module scope | Ambient (global) scope |
|---|---|---|
| How a name arrives | you imported it | it was declared globally somewhere in the program |
| Where it comes from | `moduleResolution` finding a file | `lib`, `types`, and any non-module `.d.ts` in the program |
| Collisions | impossible — each module has its own scope | **possible, and silent** |
| Removing it | delete the import | there is nothing local to delete |

The last row is the practical one. A global you did not want is not attached to
any line of your code, so there is nothing to delete to get rid of it. You have
to change the *program*, which means `lib`, `types`, or which packages are
installed.

## The rule to carry through the rest of this topic

**`target` decides what the runtime has to be able to parse. `lib` decides what
the compiler believes the runtime already has.** Neither is checked against
reality, and nothing verifies that the two agree with each other or with the
machine that will actually run the code.

That last sentence is the whole topic. `lib` is a **promise you make to the
compiler**, and the compiler believes it. `"lib": ["esnext"]` on Node 12 compiles
perfectly and throws at runtime; `"lib": ["es5"]` on modern Node reports errors
about code that would have worked. In both cases the config is the thing that is
wrong, and in neither case does anything tell you so.

## Gotchas

**Symptom:** bumping `target` "fixed a type error".
**Cause:** it did not; it changed the *implied* `lib`, which fixed the type
error. Nothing about emit was relevant.
**Fix:** know which one you meant to change. If you wanted newer APIs, set
`lib`. If you wanted newer output syntax, set `target`.

**Symptom:** you set `"lib": ["es2022"]` to get `Array.prototype.at`, and
`document` stopped resolving.
**Cause:** writing `lib` explicitly replaces the default entirely, and the
default included the DOM. See chunk 03 — this is the single most common trap in
the topic.
**Fix:** `"lib": ["es2022", "dom"]`, or do not write `lib` at all.

**Symptom:** `target: "es5"` in a project that only ever runs on Node 22.
**Cause:** a `tsconfig.json` copied from a tutorial written before 2018. `es5`
was the compiler default for a decade and is still what a bare `tsc --init`
comment set implies if you delete the line.
**Fix:** set it to the syntax level the runtime actually supports. Phase 7 · 01
argues the Node case specifically.

**Symptom:** two projects in a monorepo disagree about whether `structuredClone`
exists.
**Cause:** different `lib`/`types` between them, not different TypeScript
versions.
**Fix:** compare the *resolved* environment, not the version numbers. Chunk 05.

**Symptom:** a `.d.ts` you wrote references `Buffer` and it resolves in one
package and not another.
**Cause:** ambient scope is per-program, and `@types/node` may be in one
program's `types` and not the other's.
**Fix:** chunk 05's `types` section.

## Interview questions

**Does `target` affect type checking?**
Only indirectly. It changes what the emitter produces, and it changes the
*implied* `lib` when `lib` is not set. Set `lib` explicitly and `target` has no
effect on which names resolve.

**Does `lib` affect the emitted JavaScript?**
No. Not one byte. It is a set of declaration files, and declaration files emit
nothing.

**If `lib` emits nothing, why can setting it wrong break production?**
Because it decides which calls the checker *permits*. Promising `esnext` on a
runtime that does not have those APIs means the compiler approves calls that will
throw `TypeError: x.at is not a function`. The error is in the config; the
crash is in production.

**Can you set `target` and `lib` to different versions?**
Yes, and it is often correct. `"target": "es2018", "lib": ["es2022"]` says
"emit older syntax, but the runtime does have the newer APIs" — the right answer
when a polyfill provides the APIs but you still need old syntax.

**What is the ambient environment?**
The set of names available in every file without an import: whatever `lib`
pulls in, whatever `types` pulls in, and any non-module `.d.ts` in the program.

**Why is a wrong global harder to remove than a wrong import?**
Because it is not attached to a line of your code. There is no import statement
to delete — you have to change `lib`, `types`, or the installed packages.

---

← [Topic index](./README.md) · Next → [02 · What a lib file actually is](./02-what-a-lib-file-is.md)
