---
title: "Reading the symptom"
sidebar_label: "01 · Reading the symptom"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 — every diagnostic below is read out of the compiler's own
> message table (installed **TypeScript 5.9.3**). 🔴 Two behaviours are read from
> the checker source rather than recalled: the **`TS7016` suppression condition**
> (`getAllowJSCompilerOption(options) || !getStrictOptionValue(options,
> "noImplicitAny")`) and the **hardcoded name→suggestion table** in
> `getCannotFindNameDiagnosticForName`, which picks its message on
> `compilerOptions.types`. **No sandbox, no console blocks.**

Before you write a single line of declaration, read the error properly. Three
different failures produce three different codes here, and they need three
different fixes — but they all *look* like "TypeScript does not know about this
package".

## The three codes, and what separates them

| Code | Message | What it means |
|---|---|---|
| **TS2307** | *"Cannot find module '{0}' or its corresponding type declarations."* | Nothing resolved. There is **no file** — not the JavaScript, not the types |
| **TS7016** | *"Could not find a declaration file for module '{0}'. '{1}' implicitly has an 'any' type."* | The **JavaScript resolved**; only the types are missing. `{1}` is the path to the real `.js` file it found |
| **TS2688** | *"Cannot find type definition file for '{0}'."* | A name in your `types` array (or a `/// <reference types>`) does not resolve to a types package |

🔴 **The distinction that matters is TS2307 versus TS7016.**

- **TS7016 names a file path.** That path is proof the package is installed and
  the module specifier is right — this topic's problem, and a declaration file
  fixes it.
- **TS2307 names nothing.** The package is not installed, the specifier is
  wrong, or `moduleResolution` is modelling the wrong algorithm. Writing a shim
  for it is treating the wrong illness: you will silence the error and then get
  a runtime `ERR_MODULE_NOT_FOUND`, because a `.d.ts` does not make a module
  exist.

⚠️ There is a fourth, and it is a resolution problem wearing this one's clothes:

> **TS2792:** *"Cannot find module '{0}'. Did you mean to set the
> 'moduleResolution' option to 'nodenext', or to add aliases to the 'paths'
> option?"*

That one belongs to **01 · `module` and `moduleResolution`** *(not written
yet)*. If you see it, stop — no declaration file will help.

## 🔴 `TS7016` is conditional, and two flags switch it off

From the compiler source, the diagnostic is chosen like this:

```js
return getAllowJSCompilerOption(options) || !getStrictOptionValue(options, "noImplicitAny")
  ? void 0
  : Diagnostics.Could_not_find_a_declaration_file_for_module_0_1_implicitly_has_an_any_type;
```

Read literally: **the error is not produced at all if `allowJs` is on, or if
`noImplicitAny` is off.**

Two consequences people meet without connecting them to this:

1. **`noImplicitAny: false` hides it.** The untyped import still resolves to
   `any` — you have simply agreed not to be told. This is why a codebase that
   has never enabled `strict` appears to have no untyped-dependency problem
   right up until the day it does.
2. 🔴 **Turning on `allowJs` silences it too**, and that surprises people,
   because `allowJs` looks unrelated. The reasoning is coherent: with `allowJs`
   the compiler will read the package's own JavaScript and infer *something*, so
   the import is not implicitly `any` in the same way. What you get is inferred
   types of unknown quality rather than the package's intended API.

📌 **And `maxNodeModuleJsDepth` is the knob for how far that reading goes** —
*"Specify the maximum folder depth used for checking JavaScript files from
node_modules. Only applicable with `allowJs`"*, and its **default is `0`**, so by
default the compiler does not descend into `node_modules` JavaScript at all.

## The compiler already knows some of the answers

For *globals* rather than modules — a bare `process`, `describe`, `$` — the
checker has a **hardcoded suggestion table**. Worth knowing it exists, because
the message you get is unusually specific and people assume it is inferred
cleverness:

| The name you used | What the compiler suggests |
|---|---|
| `document`, `console` | *"Do you need to change your target library? Try changing the `lib` compiler option to include 'dom'."* |
| `$` | `npm i --save-dev @types/jquery` |
| `describe`, `suite`, `it`, `test` | `@types/jest` **or** `@types/mocha` |
| `process`, `require`, `Buffer`, `module` | `npm i --save-dev @types/node` |
| `Bun` | `npm i --save-dev @types/bun` |
| `Map`, `Set`, `Promise`, `Symbol`, `WeakMap`, `WeakSet`, `Iterator`, `AsyncIterator`, `SharedArrayBuffer`, `Atomics`, `BigInt`, `Reflect`, `BigInt64Array`, … | *"Do you need to change your target library? Try changing the `lib` compiler option to '{1}' or later."* |
| `await` in a call position | *"Did you mean to write this in an async function?"* |

🔴 **And the message you get tells you whether `types` is configured.** For each
package suggestion there are *two* diagnostics, and the checker picks between
them on `compilerOptions.types`:

> **TS2580:** *"Cannot find name '{0}'. Do you need to install type definitions
> for node? Try `npm i --save-dev @types/node`."*
> **TS2591:** *"…Try `npm i --save-dev @types/node` **and then add 'node' to the
> types field in your tsconfig**."*

Same for jQuery (**TS2581** / **TS2592**) and the test runners (**TS2582** and
its `types`-field variant). So if you are reading the longer message, somebody
has set a `types` array — which means **automatic inclusion of `@types` packages
is off**, and installing the package alone will not be enough. That is
[chunk 02](./02-look-for-types-first.md).

⚠️ **The last row of the table is not this topic's problem.** `Map` and `Promise`
missing is a `lib`/`target` question — **04 · `lib`, `target` and the ambient
environment** *(not written yet)* — and no declaration file will fix it.

## The other implicit-`any` codes you will see alongside

Once the module is `any`, everything downstream of it goes quiet in ways that
have their own codes. Recognising them keeps you from chasing symptoms:

> **TS7006:** *"Parameter '{0}' implicitly has an '{1}' type."*
> **TS7005:** *"Variable '{0}' implicitly has an '{1}' type."*
> **TS7034:** *"Variable '{0}' implicitly has type '{1}' in some locations where
> its type cannot be determined."*
> **TS7009:** *"'new' expression, whose target lacks a construct signature,
> implicitly has an 'any' type."*
> **TS7043:** *"Variable '{0}' implicitly has an '{1}' type, but a better type may
> be inferred from usage."*

**TS7009 is the useful one here.** It means you called `new` on something the
compiler cannot see a constructor for — usually a shim that declared the export
as a value rather than a class. That is exactly the `declare class` versus
`declare const` distinction from
[topic 07 · chunk 02](../07-authoring-d-ts-files/02-declaration-forms.md).

## One more, worth recognising immediately

> **TS6137:** *"Cannot import type declaration files. Consider importing '{0}'
> instead of '{1}'."*

You wrote `import … from './types/legacy-lib.d'`. You never import a `.d.ts`
directly — it is found by inclusion or by resolution, never by path. If your
instinct was to import the shim to "activate" it, that instinct is the bug, and
[chunk 03](./03-the-shim.md) covers where the file actually has to live.

## The decision this chunk produces

```
TS2307  → the package or the specifier is wrong. Fix the install or the
          resolution. Do NOT write a declaration.
TS2792  → moduleResolution is wrong. Topic 01. Do NOT write a declaration.
TS2688  → a name in `types` / a reference directive does not resolve. Chunk 02.
TS7016  → the JavaScript is there, the types are not. Continue:
            1. does an @types package exist?      → chunk 02
            2. no @types package                  → chunk 03, write a shim
```

## Gotchas

**Symptom:** `TS2307: Cannot find module 'x' or its corresponding type
declarations.` and a shim did not help.
**Cause:** Nothing resolved at all — the package is not installed, or the
specifier is wrong.
**Fix:** Install it, or fix the specifier. A `.d.ts` cannot make a module exist,
and silencing this one buys you a runtime failure instead.

**Symptom:** `TS7016` names a path inside `node_modules`.
**Cause:** That is the diagnostic working correctly — the path is the real
JavaScript it found.
**Fix:** Read the path. It confirms the install and the specifier are fine, so
only types are missing.

**Symptom:** Untyped imports produce no errors at all.
**Cause:** `noImplicitAny` is off, or `allowJs` is on — either suppresses
`TS7016` outright.
**Fix:** Nothing is fixed by the silence; the imports are still `any`. Turn
`noImplicitAny` on to see the real inventory before deciding what to shim.

**Symptom:** You enabled `allowJs` and a wave of untyped-module errors vanished.
**Cause:** The suppression condition above.
**Fix:** Understand what you bought — inferred types from the package's own
JavaScript, not its intended API. It is a reasonable interim state, not a fix.

**Symptom:** `allowJs` is on and the package's JavaScript still is not being
read.
**Cause:** `maxNodeModuleJsDepth` defaults to `0`.
**Fix:** Raise it if you really want that, but prefer real declarations —
inferring an API from minified or transpiled output rarely produces anything
worth having.

**Symptom:** The error suggests `@types/node` *"and then add 'node' to the types
field"*.
**Cause:** You are seeing `TS2591`, not `TS2580` — the checker picked the longer
message because `compilerOptions.types` is set.
**Fix:** Do both. With a `types` array present, installing the package is not
enough; it must be listed.

**Symptom:** `Promise`/`Map`/`Set` report as missing and installing `@types`
packages does nothing.
**Cause:** It is a `lib`/`target` problem, and the compiler says so — *"Try
changing the `lib` compiler option"*.
**Fix:** Raise `target` or add the `lib` entry. No package is involved.

**Symptom:** `TS7009: 'new' expression, whose target lacks a construct
signature…` against something you shimmed.
**Cause:** The shim declared it as a value or a function type, not a class.
**Fix:** `declare class`, or an interface with a `new` signature.

**Symptom:** `TS6137: Cannot import type declaration files.`
**Cause:** An `import` pointing at a `.d.ts` path.
**Fix:** Remove the import. Declaration files are included, not imported.

**Symptom:** `TS2688: Cannot find type definition file for 'foo'.`
**Cause:** `"types": ["foo"]` or `/// <reference types="foo" />` where no
`@types/foo` (or type root entry) resolves.
**Fix:** Install it, or remove the entry. This is a config error, not a missing
shim.

## Interview questions

**★ What is the difference between `TS2307` and `TS7016`?**
`TS2307` means nothing resolved — no JavaScript and no types, so the package is
missing or the specifier is wrong. `TS7016` means the JavaScript *did* resolve
and names its path; only the declarations are missing. Only the second one is
fixed by writing a declaration file.

**★ Why might an untyped dependency produce no error at all?**
Because `TS7016` is suppressed when `allowJs` is on or `noImplicitAny` is off —
that is the literal condition in the compiler. The import is still `any`; you
have only agreed not to hear about it.

**★ Why does turning on `allowJs` silence untyped-module errors?**
Because with `allowJs` the compiler will read the dependency's own JavaScript
and infer types from it, so the import is not implicitly `any` in the same way.
What you get is inference over shipped JavaScript, not the package's intended
API — and by default `maxNodeModuleJsDepth` is `0`, so it does not go far.

**★ The error suggests installing `@types/node` "and then add 'node' to the types
field". What does that tell you?**
That `compilerOptions.types` is set. The checker has two diagnostics for each
suggestion and picks the longer one when a `types` array exists — so automatic
inclusion of `@types` packages is off in this project and installing alone will
not be enough.

**Why can you not `import` a `.d.ts` file?**
Because declaration files enter the program by inclusion or resolution, not by
module specifier — `TS6137` says so and suggests importing the real module
instead. Importing the shim to "activate" it is the classic wrong instinct.

**`Promise` is reported as missing. Is that an untyped-dependency problem?**
No. The compiler's own suggestion is to change the `lib` option — it is a
`lib`/`target` question about the ambient environment, and no package or shim is
involved.

**What is `TS7009` usually telling you about a shim?**
That the shimmed export was declared as a value or function type when the code
calls `new` on it. The fix is `declare class`, or an interface carrying a `new`
signature — the same instance-side/static-side distinction as anywhere else.

**What is the first thing you check when a dependency has no types?**
Which code it is. `TS2307` and `TS2792` are resolution problems where a
declaration file is the wrong tool entirely; only `TS7016` means "the code is
there, the types are not", which is the problem this topic solves.

---

Next → [02 · Look for types first](./02-look-for-types-first.md)
