---
title: "The CommonJS caveat"
sidebar_label: "05 · The CommonJS caveat"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** — the CommonJS
> caveat and both input/output examples are quoted verbatim. `TS1286`, `TS1295`,
> `TS1287`, `TS1541`, `TS1542`, `TS1453`, `TS1463`, `TS1464` and the code actions
> `TS95196`/`TS95197` were read out of the compiler's message table in the
> installed **TypeScript 5.9.3** build. **No sandbox, no console block.**

Everything so far assumed your file emits ES modules. In a file detected as
CommonJS ([topic 01, chunk 09](../01-module-and-moduleresolution/09-format-detection.md)),
`verbatimModuleSyntax` behaves in a way that catches people out — and the reason
is entirely consistent once you see it.

## The rule, and why it follows

> That does have some implications when it comes to module interop though. Under
> this flag, ECMAScript `import`s and `export`s won't be rewritten to `require`
> calls when your settings or file extension implied a different module system.
> Instead, you'll get an error.

🔴 **This is the flag keeping its promise, not breaking it.** "Verbatim" means the
statements you write are the statements you get. Rewriting `import` into
`require` is the largest rewrite the compiler performs. If the flag allowed it,
the guarantee would be worthless.

So in a CommonJS file:

```text
TS1286  ECMAScript imports and exports cannot be written in a CommonJS file
        under 'verbatimModuleSyntax'.

TS1295  ECMAScript imports and exports cannot be written in a CommonJS file
        under 'verbatimModuleSyntax'. Adjust the 'type' field in the nearest
        'package.json' to make this file an ECMAScript module, or adjust your
        'verbatimModuleSyntax', 'module', and 'moduleResolution' settings in
        TypeScript.
```

📌 **Two codes for one condition, differing only in whether advice is attached.**
`TS1295` is the same error with the fix spelled out, and its advice is unusually
specific — it names `package.json`'s `"type"` field *first*, because that is
usually the right lever, and only then the three TypeScript settings. If you ever
wondered which of those four things to change, the compiler has an opinion.

And the third, about declarations rather than imports:

```text
TS1287  A top-level 'export' modifier cannot be used on value declarations in a
        CommonJS module when 'verbatimModuleSyntax' is enabled.
```

That is `export const x = 1` and `export function f() {}` — the modifier form
rather than the statement form. Same reason: it would have to become
`exports.x = 1`.

## What you write instead

The release notes give the pre-ES2015 syntax, with its emit:

> If you need to emit code that uses `require` and `module.exports`, you'll have
> to use TypeScript's module syntax that predates ES2015:
>
> **Input TypeScript:**
> ```ts
> import foo = require("foo");
> ```
>
> **Output JavaScript:**
> ```js
> const foo = require("foo");
> ```
>
> **Input TypeScript:**
> ```ts
> function foo() {}
> function bar() {}
> function baz() {}
> export = {
>     foo,
>     bar,
>     baz
> };
> ```
>
> **Output JavaScript:**
> ```js
> function foo() {}
> function bar() {}
> function baz() {}
> module.exports = {
>     foo,
>     bar,
>     baz
> };
> ```

⚠️ **`import x = require()` and `export =` are TypeScript syntax, not JavaScript.**
They are erasable in the sense that they have a direct CommonJS translation, but
they are not standard — which is why `erasableSyntaxOnly` (TypeScript 5.8)
rejects them, and why Node's type stripper cannot run a file containing them.
That is a genuine tension: the syntax `verbatimModuleSyntax` requires in a
CommonJS file is syntax the strip-only runtimes forbid. **The resolution is not
to pick a side — it is to stop having CommonJS files**, which is what the
handbook's recipes assume.

📌 Recall from [chunk 04](./04-re-exports.md) that `export =` must reference a
real value (`TS1282`/`TS1283`), so this escape hatch is still checked.

## The `.d.ts` problem: `resolution-mode`

There is one place where a CommonJS file must reason about an ES module and
cannot avoid it — a declaration file describing a package that is ESM-only:

```text
TS1541  Type-only import of an ECMAScript module from a CommonJS module must
        have a 'resolution-mode' attribute.

TS1542  Type import of an ECMAScript module from a CommonJS module must have a
        'resolution-mode' attribute.
```

The syntax, and the rules around it:

```ts
import type { Options } from "esm-only-pkg" with { "resolution-mode": "import" };
```

```text
TS1453  `resolution-mode` should be either `require` or `import`.
TS1463  'resolution-mode' is the only valid key for type import attributes.
TS1464  Type import attributes should have exactly one key - 'resolution-mode' -
        with value 'import' or 'require'.
```

🔴 **This is the only mechanism in the language for saying "resolve this
specifier under a different module system than my own".** It exists because the
`import`/`require` resolution split ([topic 01, chunk 05](../01-module-and-moduleresolution/05-the-node-resolver.md))
means a CommonJS file's `require`-flavoured resolution may not find an ESM-only
package's types at all — even though nothing is being loaded at runtime, because
the import is type-only.

📌 It is restricted to type-only imports precisely because it is a *type
resolution* instruction. Asking a real `require` to resolve under ESM rules would
be a lie about what happens at runtime; asking the type system to is not.

The compiler ships bulk fixes for it, which tells you it expects this to arrive
in quantity:

```text
TS95196  Add 'resolution-mode' import attribute
TS95197  Add 'resolution-mode' import attribute to all type-only imports that
         need it
```

## The decision this chunk forces

If your project has CommonJS files and you want `verbatimModuleSyntax`, you have
three options and they are not equal:

| Option | Consequence |
|---|---|
| Convert the files to ESM (`"type": "module"` or `.mts`) | The intended path. All the ES syntax works |
| Rewrite them in `import x = require()` / `export =` | Legal, checked, and incompatible with `erasableSyntaxOnly` and type stripping |
| Leave `verbatimModuleSyntax` off | Keeps whole-program elision, and its bugs |

⚠️ The second option is a real answer for a small number of genuinely-CommonJS
files — a config file a CLI `require`s, an interop shim — and a bad answer for a
whole codebase.

## Gotchas

**`TS1286`/`TS1295` appear in files you thought were ESM.** *Symptom:* the error
in a project with `"type": "module"` set. *Cause:* a nearer ancestor
`package.json`, or a `.cts` extension. *Fix:* `TS1458`–`TS1461` name the deciding
file ([topic 01, chunk 09](../01-module-and-moduleresolution/09-format-detection.md)).

**`TS1295`'s advice names four things and the first one is usually right.**
*Symptom:* people change `module` and `moduleResolution` when the answer was
`package.json`. *Cause:* the settings feel more "TypeScript". *Fix:* read the
order in the message; it is deliberate.

**`verbatimModuleSyntax` and `erasableSyntaxOnly` pull in opposite directions in
a CommonJS file.** *Symptom:* an unresolvable pair of errors — one flag demands
`import x = require()`, the other forbids it. *Cause:* both are correct about
their own concern. *Fix:* the file has to become ESM; there is no configuration
that satisfies both otherwise.

**`export const x` fails but `export { x }` may not.** *Symptom:* confusing
inconsistency in a CommonJS file. *Cause:* `TS1287` is specifically about the
top-level `export` *modifier* on value declarations. *Fix:* neither is really
available in a CommonJS file under this flag; `export =` is the answer.

**`resolution-mode` on a non-type import fails with a message about type-only
imports.** *Symptom:* `TS1454`. *Cause:* it is a type-resolution instruction and
cannot describe a runtime load. *Fix:* if you need the value at runtime from a
CommonJS file, that is `await import()`, not an attribute.

**Getting the `resolution-mode` value wrong is three different errors.**
*Symptom:* `TS1453`, `TS1463` or `TS1464`. *Cause:* wrong value, wrong key, or
wrong number of keys. *Fix:* exactly one key, exactly `resolution-mode`, exactly
`"import"` or `"require"`. The bulk code action `TS95197` writes it correctly.

**A `.cts` file in an otherwise-ESM project is a deliberate landmine for the next
person.** *Symptom:* one file where none of the project's conventions apply.
*Cause:* someone needed CommonJS for one interop reason. *Fix:* it is legitimate,
but it wants a comment saying why — the extension is the only signal, and it is
one character.

## Interview questions

**Why does `verbatimModuleSyntax` refuse ES import syntax in a CommonJS file?**
Because rewriting `import` into `require` is exactly the transformation the flag
promises not to do. Allowing it would make "what you see is what you get" false
in the one case where the rewrite is largest. `TS1286`/`TS1295` are the flag
keeping its guarantee.

**What do you write instead in a genuinely CommonJS file?**
`import x = require("x")` and `export = …` — TypeScript's pre-ES2015 module
syntax, which emits `const x = require("x")` and `module.exports = …`. They are
still checked: `export =` must reference a real value, per `TS1282`/`TS1283`.

**What is the tension between `verbatimModuleSyntax` and `erasableSyntaxOnly`?**
In a CommonJS file the first requires `import x = require()` / `export =`, and
the second forbids them because they are TypeScript syntax with no JavaScript
equivalent — so a strip-only runtime cannot run the file. There is no
configuration that satisfies both; the file has to become an ES module.

**What is `resolution-mode` and why is it restricted to type-only imports?**
It tells the compiler to resolve a specifier as if the importing file were ESM
(or CommonJS) — needed when a CommonJS file must reference the types of an
ESM-only package, because the `import` and `require` resolution algorithms differ.
It is restricted to type-only imports because it is a claim about type
resolution; applying it to a runtime import would misdescribe what actually
happens at load time.

**Three different errors exist for a malformed `resolution-mode`. Why?**
Because there are three distinct mistakes: a wrong value (`TS1453`), a key that
is not `resolution-mode` (`TS1463`), and the wrong number of keys (`TS1464`). As
with the re-export family, the message identifies which edit is needed rather
than reporting a generic parse failure.

**Why are there two error codes, `TS1286` and `TS1295`, for the same condition?**
They differ only in whether the fix is attached. `TS1295` spells out the four
things you might change and names `package.json`'s `"type"` field first — which
is genuinely the usual answer, and a useful ordering to notice.

**A team wants `verbatimModuleSyntax` but has thirty CommonJS files. What do you
advise?**
Convert them, unless there is a specific interop reason not to. Rewriting thirty
files in `import x = require()` is legal but locks them out of type-stripping
runtimes and leaves the codebase with two module dialects. If a handful genuinely
must stay CommonJS — a config file something `require`s — `.cts` plus a comment
is the honest way to isolate them.

---

← [04 · Re-exports](./04-re-exports.md) · Next → [06 · Adopting it](./06-adopting-it.md)
