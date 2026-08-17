---
title: "When the shipped types are wrong"
sidebar_label: "05 · When shipped types are wrong"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Files →
> Declaration Merging*; *Modules*) and the compiler's diagnostic table for
> `TS2305`, `TS2551`, `TS2613`, `TS2614`, `TS2665`, `TS2724` and `TS2739`, read
> out of the installed **5.9.3** message table. **No sandbox, no console
> blocks.**

The harder version of this topic. A missing declaration announces itself; a
**wrong** one does not. The build is green, the editor autocompletes confidently,
and the failure arrives at runtime — which is worse than no types at all,
because no types at least made you cautious.

## First: is it wrong, or are you resolving the wrong copy?

Four things produce "the types are wrong" and only one of them is actually wrong
types. Check in this order:

1. **Version skew between the package and its `@types`.** They are separate
   packages on separate release cycles ([chunk 02](./02-look-for-types-first.md)).
   `@types/foo@2` describing `foo@3` is confidently wrong about a real API.
2. **Two copies installed.** A transitive dependency pulled a second version;
   your import resolves to one and your types to another. `npm ls foo` /
   `pnpm why foo`.
3. **Both the package's own types *and* an `@types` package are present.** One
   wins by resolution order and it may not be the one you assume. The handbook
   is explicit that the `@types` package is *not needed* when the library ships
   its own.
4. **The types are genuinely wrong or incomplete.** Only now does the rest of
   this chunk apply.

🔴 **`tsc --traceResolution` settles 1–3 in one run.** It names the file each
specifier resolved to. Guessing at this stage is how people end up "fixing" a
correct declaration.

## Reading the error for what it tells you

The compiler's suggestion-carrying diagnostics are informative here, because a
suggestion means the name nearly matched something real:

> **TS2305:** *"Module '{0}' has no exported member '{1}'."*
> **TS2724:** *"'{0}' has no exported member named '{1}'. Did you mean '{2}'?"*
> **TS2551:** *"Property '{0}' does not exist on type '{1}'. Did you mean
> '{2}'?"*
> **TS2613:** *"Module '{0}' has no default export. Did you mean to use
> `import { {1} } from {0}` instead?"*
> **TS2614:** *"Module '{0}' has no exported member '{1}'. Did you mean to use
> `import {1} from {0}` instead?"*

📌 **`TS2613` and `TS2614` are a mirror pair and they are usually an interop
question, not a wrongness question.** You asked for a default and the types
describe named exports, or the reverse. Before patching anything, check whether
`esModuleInterop` explains it — **09 · `esModuleInterop` and default imports**
*(not written yet)*.

**A bare `TS2305` with no suggestion is the interesting one:** nothing close
exists, so either the export is genuinely undeclared, or you are on a copy from
before it was added.

## Fix one — augment, when something is missing

If the types are *right but incomplete*, add to them. This is
[Phase 4 · Module augmentation](../../phase-4-classes-declarations/01-module-augmentation/README.md)
and it is the correct tool, because it composes with the package's own types
rather than replacing them.

```ts
// src/types/some-lib-augment.d.ts
import 'some-lib';                       // ← REQUIRED: makes this file a module

declare module 'some-lib' {
  interface RenderOptions {              // merges with theirs
    experimentalFlag?: boolean;
  }
  export function undocumentedHelper(x: string): number;
}
```

🔴 **Note the import, and note that it is the exact opposite of a shim.** A shim
must live in a *script* file; an augmentation must live in a *module* file. Same
syntax, opposite requirement — which is why the two get confused and why
`TS2664`/`TS2665` mention "augmentation" in both directions
([chunk 03](./03-the-shim.md)).

**What augmentation can and cannot do:**

| | |
|---|---|
| ✅ Add members to an existing `interface` | Interfaces merge |
| ✅ Add new exports to the module | A new declaration in the block |
| ⛔ **Change** an existing member's type | Two declarations of one member conflict; they do not override |
| ⛔ Add to an exported `type` alias | Type aliases do not merge ([topic 07 · chunk 03](../07-authoring-d-ts-files/03-the-three-spaces.md)) |

**That third row is the wall.** Augmentation is additive only. If the package
says `render(x: string): void` and it really returns a `Buffer`, no augmentation
will fix it.

## Fix two — replace their types entirely

When augmentation cannot reach it, you redirect the *types* for that specifier to
a file you own, using `paths`:

```json
{
  "compilerOptions": {
    "paths": {
      "some-lib": ["./src/types/some-lib.d.ts"]
    }
  }
}
```

Then write the declaration as a normal module `.d.ts` — the whole surface you
use, from scratch, as in chunk 03.

⚠️ **Three costs, and they are real:**

1. **You now own the whole surface.** Not the delta — everything, including the
   parts that were correct. It drifts on every upgrade of the package.
2. **`paths` affects the compiler only.** The runtime still loads the real
   package. That is fine here (you *want* the real code with different types) but
   it is the same lever that causes runtime failures when misused for module
   resolution — **03 · Path aliases** *(not written yet)*.
3. **It is invisible at the call site.** Nobody reading the import knows the
   types came from your file. Leave a comment in the declaration saying which
   package version it shadows and why.

📌 **This is also the fix for `TS2665`** (*"resolves to an untyped module … which
cannot be augmented"*) from chunk 03: the block was losing to the untyped
resolution, and `paths` is how your declarations win instead.

## Fix three — the call site, when it is one call

Sometimes it is one function in one place and the machinery above is
disproportionate.

```ts
// their types say `void`; it returns a Buffer. Filed upstream: <link>
const out = render(html) as unknown as Buffer;
```

🔴 **`as unknown as X` is the honest spelling here**, and its verbosity is the
feature: a direct `as Buffer` would be rejected as a non-overlapping conversion,
and going through `unknown` is you stating plainly that you are overruling the
compiler. **Always leave the comment and the upstream link** — an assertion
without a reason is indistinguishable from a mistake six months later.

⚠️ **An assertion is a claim with nothing behind it.** If the value crosses into
the rest of your codebase, wrap it and add the runtime check
([chunk 04](./04-growing-the-shim.md)) rather than asserting at forty call sites.

## What is *not* the fix

**`skipLibCheck`.** The distinction is precise and worth holding:

- ✅ **It helps when *their* `.d.ts` does not compile** — an internal error inside
  the declaration file, often a dependency-version mismatch inside `node_modules`
  that has nothing to do with your code.
- ⛔ **It does nothing when their types are wrong *about the API*.** It skips
  checking *inside* `.d.ts` files; it cannot change assignability at your call
  sites.

[Phase 10 · The suppression tiers](../../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md)
settles that it is not a suppression mechanism at all, and **10 · `skipLibCheck`**
*(not written yet)* is the full account of what you are agreeing not to see.

**Editing `node_modules`.** It works until the next install. If you genuinely
need a patched dependency, the tooling for that is `patch-package` or
`pnpm patch`, which at least records the change in your repository.

## Gotchas

**Symptom:** The package's types describe an API that does not exist.
**Cause:** Most often version skew — the `@types` package is on a different major
than the library.
**Fix:** Check the `@types` package's supported range before assuming the
declarations are wrong. This is the first thing to rule out, not the last.

**Symptom:** `npm ls foo` shows two copies.
**Cause:** A transitive dependency pinned a different version.
**Fix:** Deduplicate. Your import and your types may currently be resolving to
different copies.

**Symptom:** Both the package's own types and an `@types` package are installed.
**Cause:** Somebody installed `@types` for a library that ships declarations.
**Fix:** Remove the `@types` package — the handbook says it is not needed. Which
one was winning was decided by resolution order, not by intent.

**Symptom:** `TS2664: Invalid module name in augmentation…` on an augmentation.
**Cause:** The file is a script, so there is no module context — or the package
name is wrong.
**Fix:** Add `import 'some-lib';` at the top. An augmentation needs a module
file; a shim needs a script file.

**Symptom:** An augmentation compiles and appears to do nothing.
**Cause:** It is in a script file, so it augmented the global scope rather than
the module.
**Fix:** Same — make the file a module.

**Symptom:** You tried to augment an exported `type` alias.
**Cause:** Type aliases do not merge; only interfaces do.
**Fix:** Intersect at the use site, or replace the types via `paths`.

**Symptom:** You augmented a member's type and both declarations are now in
effect.
**Cause:** Augmentation is additive — it cannot override an existing member.
**Fix:** `paths`, or an assertion at the call site.

**Symptom:** After a `paths` override, the build works and consumers of your
package see the original (wrong) types.
**Cause:** `paths` is a compiler-side redirect in *your* project. It is not
published.
**Fix:** If you ship types that expose the dependency's types, the fix has to be
upstream, or you must stop leaking them across your API.

**Symptom:** `as Buffer` is rejected outright.
**Cause:** A non-overlapping conversion; the compiler will not go from `void` to
`Buffer` directly.
**Fix:** `as unknown as Buffer` — and treat having to write it as the signal to
leave a comment and file the bug.

**Symptom:** `skipLibCheck: true` did not fix the wrong types.
**Cause:** It skips checking *inside* `.d.ts` files; it cannot affect
assignability where you call the API.
**Fix:** It was never the right tool. Augment, override, or assert.

**Symptom:** Somebody fixed it by editing `node_modules`.
**Cause:** It works, right up until `npm ci`.
**Fix:** `patch-package` or `pnpm patch`, so the change is in the repository and
survives an install.

## Interview questions

**★ The types for a dependency look wrong. What do you check first?**
Whether they *are* wrong, or you are looking at the wrong copy: version skew
between the library and its `@types` package, two installed copies of the
library, or both shipped types and an `@types` package present at once.
`tsc --traceResolution` names the file each specifier actually resolved to.

**★ What can module augmentation fix, and what can it not?**
It can add members to an existing interface and add new exports. It cannot
**change** an existing member's type — declarations merge, they do not override —
and it cannot add to a `type` alias, because aliases do not merge. When you need
to change something, augmentation is the wrong tool.

**★ How do you replace a package's types entirely, and what does it cost?**
Point `paths` for that specifier at a declaration file you own. The cost is that
you now maintain the *whole* surface, not the delta, and it drifts on every
upgrade — plus the redirect is compiler-only and invisible at the call site, so
it needs a comment explaining which version it shadows.

**★ Why is a shim a script file and an augmentation a module file?**
Because `declare module 'x'` means "declare" when `x` does not resolve and
"augment" when it does, and augmentation needs a module context to attach to. Same
syntax, opposite file requirement — which is exactly why `TS2664` says
"augmentation" to people who were not augmenting.

**★ Does `skipLibCheck` help with wrong types?**
Only if *their* `.d.ts` fails to compile internally. It skips checking inside
declaration files and cannot change assignability at your call sites, so it does
nothing about types that are wrong *about* the API — a common wrong suggestion.

**Why write `as unknown as X` rather than `as X`?**
Because the direct conversion is rejected as non-overlapping. Routing through
`unknown` is the compiler making you say plainly that you are overruling it, and
the verbosity is worth keeping — along with a comment and a link to the upstream
issue.

**What does `TS2613` usually mean?**
That you imported a default from a module whose types describe named exports.
More often an `esModuleInterop`/module-format question than a wrong-types
question, so check that before patching anything.

**Somebody fixed a bad declaration by editing `node_modules`. What do you say?**
That it survives until the next clean install and is invisible in review.
`patch-package` or `pnpm patch` does the same thing with a committed record —
and it should still be accompanied by an upstream issue.

---

← Prev: [04 · Growing the shim](./04-growing-the-shim.md) · Next → [06 · The upstream fix](./06-the-upstream-fix.md)
