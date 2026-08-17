---
title: "Re-exports, the hardest case"
sidebar_label: "04 · Re-exports"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. `TS1289`, `TS1290`, `TS1291`, `TS1292`, `TS1448`, `TS1282`,
> `TS1283`, `TS1284`, `TS1285` and the code actions `TS1364`, `TS1365` are
> verbatim from the compiler's diagnostic table in the installed **TypeScript
> 5.9.3** build. The undecidability argument is quoted from the **TypeScript 5.0
> release notes**. **No sandbox, no console block.**

Importing a type is easy: the file that imports it can see how it is used.
**Re-exporting one is not**, and the compiler devotes more distinct diagnostics
to this case than to any other in the topic.

## Why re-export is harder than import

The 5.0 release notes name the problem directly:

> So it's not always clear whether code like the following
>
> ```ts
> export { Car } from "./car";
> ```
>
> should be preserved or dropped. If `Car` is declared with something like a
> `class`, then it can be preserved in the resulting JavaScript file. But if
> `Car` is only declared as a `type` alias or `interface`, then the JavaScript
> file shouldn't export `Car` at all.

An *import* is used somewhere in the importing file, so its nature is at least
observable locally. A *re-export* is used nowhere — the whole point is to pass it
along. The only evidence is the declaration in the other file, which is exactly
the evidence a single-file tool does not have.

🔴 **This is the case that made `verbatimModuleSyntax` necessary.** Everything
else in this topic could plausibly have been solved with better inference. This
could not.

## The barrel-file trap

The pattern that turns one mis-marked re-export into a project-wide problem:

```ts
// models/index.ts  — a "barrel"
export { User } from "./user.js";        // User is an interface
export { createUser } from "./user.js";  // a function
```

Under a single-file transpiler the first line is emitted as-is, so the output
tries to re-export a binding the JavaScript never had. And every file that
imports `User` from the barrel is now downstream of the mistake.

The correct spellings:

```ts
export type { User } from "./user.js";           // whole statement, type-only
export { type User, createUser } from "./user.js";  // inline, mixed
```

📌 The inline form is again the better one for a barrel, because barrels are
almost always mixed and splitting them doubles the file.

## The six re-export diagnostics

The compiler distinguishes cases most people would have collapsed into one
message. The distinctions are the useful part.

**Two axes: is it a type, or does it *resolve to* a type-only declaration; and is
it a named re-export or a default?**

```text
TS1291  '{0}' resolves to a type and must be marked type-only in this file before
        re-exporting when '{1}' is enabled. Consider using 'import type' where
        '{0}' is imported.

TS1289  '{0}' resolves to a type-only declaration and must be marked type-only in
        this file before re-exporting when '{1}' is enabled. Consider using
        'import type' where '{0}' is imported.

TS1292  '{0}' resolves to a type and must be marked type-only in this file before
        re-exporting when '{1}' is enabled. Consider using
        'export type { {0} as default }'.

TS1290  '{0}' resolves to a type-only declaration and must be marked type-only in
        this file before re-exporting when '{1}' is enabled. Consider using
        'export type { {0} as default }'.

TS1448  '{0}' resolves to a type-only declaration and must be re-exported using a
        type-only re-export when '{1}' is enabled.
```

🔴 **Every one of them tells you the fix, and the fix differs.** `TS1291`/`TS1289`
say *change the import* — because you imported it and then re-exported it, so the
`type` belongs on the import. `TS1292`/`TS1290` say `export type { X as default }`
— because a default re-export cannot carry an inline modifier and needs the
renaming form. `TS1448` covers the direct `export … from` re-export, where there
is no import to fix.

⚠️ **Note the `{1}`.** These messages take the *flag name* as a parameter, so the
same text serves `verbatimModuleSyntax` and `isolatedModules`. If you read one of
these errors and are not sure which flag caused it, the message literally tells
you — and people miss it because it looks like boilerplate.

📌 The compiler ships the bulk fixes too: `TS1364: "Convert to type-only export"`
and `TS1365: "Convert all re-exported types to type-only exports"`. A barrel file
is a single code action.

## `export =` and `export default` need a *value*

Four more, and these fail in the opposite direction — you exported something that
turned out not to be a runtime thing at all:

```text
TS1282  An 'export =' declaration must reference a value when
        'verbatimModuleSyntax' is enabled, but '{0}' only refers to a type.

TS1283  An 'export =' declaration must reference a real value when
        'verbatimModuleSyntax' is enabled, but '{0}' resolves to a type-only
        declaration.

TS1284  An 'export default' must reference a value when 'verbatimModuleSyntax'
        is enabled, but '{0}' only refers to a type.

TS1285  An 'export default' must reference a real value when
        'verbatimModuleSyntax' is enabled, but '{0}' resolves to a type-only
        declaration.
```

The same *is-a-type* versus *resolves-to-type-only* split, applied to the two
export forms that emit a runtime assignment. Without the flag, `export default
SomeInterface` would emit `exports.default = SomeInterface` against a binding
that does not exist.

🔴 **Ten diagnostics for one concept.** That is not the compiler being fussy — it
is a deliberate design where the message names both *what went wrong* and *which
edit fixes it*, and the two vary independently. It is worth treating as a model
for reading TypeScript errors generally: the wording differences are load-bearing.

## The summary table

| You wrote | The thing is | Error | The fix the compiler names |
|---|---|---|---|
| `export { X }` (imported above) | a type | `TS1291` | `import type` on the import |
| `export { X }` (imported above) | type-only via re-export | `TS1289` | `import type` on the import |
| `export { X as default }` | a type | `TS1292` | `export type { X as default }` |
| `export { X as default }` | type-only via re-export | `TS1290` | `export type { X as default }` |
| `export { X } from "m"` | type-only via re-export | `TS1448` | a type-only re-export |
| `export = X` | a type | `TS1282` | export a value instead |
| `export = X` | type-only via re-export | `TS1283` | export a value instead |
| `export default X` | a type | `TS1284` | export a value instead |
| `export default X` | type-only via re-export | `TS1285` | export a value instead |

## Gotchas

**One mis-marked re-export in a barrel breaks every consumer.** *Symptom:*
`TS1485` in a dozen unrelated files. *Cause:* the barrel re-exported a value with
`export type`, so from downstream it is now type-only. *Fix:* the barrel, not the
consumers. Chase `TS1485` upstream before adding modifiers locally.

**`export { X as default }` cannot take an inline `type`.** *Symptom:* an attempt
at `export { type X as default }` that does not help. *Cause:* the default
re-export needs the statement-level form. *Fix:* `export type { X as default }`,
which is precisely what `TS1290`/`TS1292` suggest.

**`export type { X }` from a barrel hides a value from your consumers.**
*Symptom:* consumers cannot call something they can see the type of. *Cause:*
over-applying the fix — someone marked a class type-only to silence an error.
*Fix:* check what the thing actually is. `TS1291` says *"resolves to a type"*; if
it is a class, the error was about something else.

**These errors name the flag in `{1}` and people read past it.** *Symptom:*
turning off `verbatimModuleSyntax` does not remove the error. *Cause:* it was
`isolatedModules` all along — the message text is shared. *Fix:* read the flag
name in the message.

**`export * from "./m"` has no type-only form to get wrong, and no protection
either.** *Symptom:* a star re-export quietly forwards types and values together.
*Cause:* there is nothing to mark, so the compiler cannot complain. *Fix:* it is
one of the reasons `export *` is worth avoiding in a barrel — named re-exports
are checkable and star ones are not.

**A code action fixes the file and not the design.** *Symptom:* "Convert all
re-exported types to type-only exports" produces a clean file whose barrel is
still doing something questionable. *Fix:* use it, then look at the result. A
barrel that is half `export type` is often two barrels.

**`export = ` errors read as being about `verbatimModuleSyntax` and are really
about CommonJS.** *Symptom:* `TS1282` in a file you thought was ESM. *Cause:*
`export =` is CommonJS-only syntax — see [chunk 05](./05-the-commonjs-caveat.md).
*Fix:* if the file should be ESM, the `export =` is the problem.

## Interview questions

**Why is re-exporting a type harder for the compiler than importing one?**
Because a re-exported name is not used anywhere in the re-exporting file — the
whole point is to pass it along — so there is no local evidence of whether it is a
value. The only evidence is its declaration in another file, which is exactly what
a single-file transpiler cannot see. This is the case that made an explicit
`type` modifier necessary rather than optional.

**What is the barrel-file trap?**
A `index.ts` that re-exports a mix of types and values with plain `export { … }`.
Under a single-file transpiler the type re-exports survive into the output, which
then tries to re-export bindings the JavaScript never had — and every consumer of
the barrel is downstream of the mistake.

**`TS1289` and `TS1291` look identical. What differs?**
The nature of the thing: `TS1291` says it *is* a type; `TS1289` says it *resolves
to a type-only declaration* — a real value somewhere, made type-only by a
re-export along the way. Both suggest fixing the import, but the second is a
signal that an upstream module may have marked something wrongly.

**Why does the default-export case get its own errors?**
Because the fix is different. A named re-export can take an inline `type`; a
default re-export cannot, and needs `export type { X as default }`. `TS1290` and
`TS1292` name that exact spelling, which is why they exist separately from
`TS1289`/`TS1291`.

**What do `TS1282`–`TS1285` have in common?**
They are the export forms that emit a runtime assignment — `export =` and
`export default` — refusing to be given something that is not a value. Without
the flag, `export default SomeInterface` would emit an assignment from a binding
that does not exist at runtime.

**These messages have a `{1}` parameter. What is in it?**
The flag name. The same text serves `verbatimModuleSyntax` and `isolatedModules`,
so the message tells you which flag produced it. It is easy to read past, and it
is the difference between fixing the right config line and the wrong one.

**Why avoid `export *` in a barrel?**
Partly for the usual reasons, but in this context specifically because there is no
type-only form of it to get right — and therefore no diagnostic when it forwards
types into the runtime output. Named re-exports are checkable; star re-exports
are not.

**You get `TS1485` in twelve files after enabling the flag. Where do you look?**
Upstream. `TS1485` means the name resolves to a type-only declaration, so
something between the original definition and your import marked it with
`export type`. Adding `type` to twelve imports makes the errors go away and may
be papering over one wrong line in a barrel.

---

← [03 · `verbatimModuleSyntax`](./03-verbatim-module-syntax.md) · Next → [05 · The CommonJS caveat](./05-the-commonjs-caveat.md)
