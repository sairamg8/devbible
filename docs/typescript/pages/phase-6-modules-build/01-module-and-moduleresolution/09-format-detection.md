---
title: "Format detection, file by file"
sidebar_label: "09 · Format detection"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Theory*
> (*Module format detection*) and *Modules — Reference*. The `moduleDetection`
> option record, its `defaultValueDescription` and its `computeValue` were read
> out of the installed **TypeScript 5.9.3** build; `TS1458`–`TS1461` and
> `TS1480`–`TS1483` are quoted verbatim from the same build's diagnostic table.
> **No sandbox, no console block** — the message texts below are the compiler's
> own strings, read from its tables, not output from a run.

Under `node16`, `node18`, `node20` and `nodenext`, **every file gets its own
answer** to "am I ESM or CommonJS?" This chunk is how that answer is computed,
what it changes, and — the part almost nobody knows — how to make the compiler
tell you why.

## The algorithm, in two steps

The handbook states Node's rule first, then says TypeScript applies the same one:

> Node.js understands both ES modules and CJS modules, but the format of each
> file is determined by its file extension and the `type` field of the first
> `package.json` file found in a search of the file's directory and all ancestor
> directories:
>
> - `.mjs` and `.cjs` files are always interpreted as ES modules and CJS modules,
>   respectively.
> - `.js` files are interpreted as ES modules if the nearest `package.json` file
>   contains a `type` field with the value `"module"`. If there is no
>   `package.json` file, or if the `type` field is missing or has any other
>   value, `.js` files are interpreted as CJS modules.

> When the `module` compiler option is set to `node16`, `node18`, or `nodenext`,
> TypeScript applies this same algorithm to the project's *input* files to
> determine the module kind of each corresponding *output* file.

In TypeScript's own extensions:

| Extension | Format | Decided by |
|---|---|---|
| `.mts` / `.mjs` / `.d.mts` | **Always ESM** | the extension |
| `.cts` / `.cjs` / `.d.cts` | **Always CommonJS** | the extension |
| `.ts` / `.tsx` / `.js` / `.jsx` / `.d.ts` | **Either** | nearest ancestor `package.json` `"type"` |

And the consequence that decides your whole build:

> The detected module format of input `.ts`/`.tsx`/`.mts`/`.cts` files determines
> the module format of the emitted JavaScript files. So, for example, a project
> consisting entirely of `.ts` files will emit all CommonJS modules by default
> under `--module nodenext`, and can be made to emit all ES modules by adding
> `"type": "module"` to the project package.json.

🔴 **The single most consequential line in a TypeScript project is not in
`tsconfig.json` at all.** It is `"type": "module"` in `package.json`.

## "Nearest ancestor" is literal

The search stops at the *first* `package.json` walking upward — not the project
root, not the one with a `"name"`, not the one git tracks. The first one.

```text
repo/
├── package.json              { "type": "module" }
├── src/
│   ├── server.ts             → ESM
│   └── legacy/
│       ├── package.json      { "type": "commonjs" }   ← stops the search here
│       └── shim.ts           → CommonJS
```

That is a **legitimate technique**, not an accident: a one-line
`{"type": "commonjs"}` in a directory of old scripts inside an ESM project makes
exactly those files CommonJS, with no `.cts` renames. It is also an excellent way
to be extremely confused about why one folder behaves differently, so if you use
it, say so in a comment.

## `moduleDetection` — the other half of the question

Format detection answers *ESM or CJS*. There is a second, prior question: **is
this file a module at all, or a script?** That is `moduleDetection`.

Three values, from the option record:

| Value | Meaning |
|---|---|
| `legacy` | Only files with a top-level `import`/`export` are modules |
| `auto` | The default heuristic — see below |
| `force` | **Every** non-declaration file is a module, regardless of content |

The compiler's own description of `auto` is the clearest statement of the
heuristic there is, and it is sitting in the option's `defaultValueDescription`:

> `auto`: Treat files with imports, exports, `import.meta`, jsx (with jsx:
> react-jsx), or esm format (with module: node16+) as modules.

🔴 **And the default is not `auto` everywhere.** Read from `computeValue`:

```js
moduleDetection: {
  dependencies: ["module", "target"],
  computeValue: (compilerOptions) => {
    if (compilerOptions.moduleDetection !== void 0) return compilerOptions.moduleDetection;
    const moduleKind = _computedOptions.module.computeValue(compilerOptions);
    return 100 /* Node16 */ <= moduleKind && moduleKind <= 199 /* NodeNext */
      ? 3 /* Force */
      : 2 /* Auto */;
  }
}
```

**Under the Node family, `moduleDetection` defaults to `force`.** Every file is a
module, even an empty one, even one with no import or export. That is why the
`export {}` trick — the standard fix for "my `const name` collides with the DOM's
global" — is unnecessary under `nodenext` and necessary under `esnext`. Same
codebase, different `module` value, different answer to a question you did not
know was being asked.

## How to make the compiler tell you why

When a file's format is not what you expected, you do not have to reason about
the directory tree. The compiler carries four messages whose entire job is to
explain the decision, attached as related information to format errors:

```text
TS1458  File is ECMAScript module because '{0}' has field "type" with value "module"
TS1459  File is CommonJS module because '{0}' has field "type" whose value is not "module"
TS1460  File is CommonJS module because '{0}' does not have field "type"
TS1461  File is CommonJS module because 'package.json' was not found
```

📌 **There are four of them and they distinguish three different ways of not
being ESM** — the field says something else, the field is absent, the file is
absent. That precision exists because the three have different fixes, and
because "I added `"type": "module"`" and "I added it to the *right*
`package.json`" are different claims. The `{0}` in the first three is the path of
the `package.json` that decided it, which is the piece of information you
actually wanted.

⚠️ Note what has **no** explain message: the extension-based cases. `.mts` and
`.cts` are unambiguous, so there is nothing to explain. If you are ever unsure
what a file's format is and cannot get an answer, renaming it to `.mts` or `.cts`
settles it by force.

And when the compiler thinks you wanted ESM, it offers the fix — tailored four
ways to the situation it found:

```text
TS1480  To convert this file to an ECMAScript module, change its file extension
        to '{0}' or create a local package.json file with `{ "type": "module" }`.
TS1481  To convert this file to an ECMAScript module, change its file extension
        to '{0}', or add the field `"type": "module"` to '{1}'.
TS1482  To convert this file to an ECMAScript module, add the field
        `"type": "module"` to '{0}'.
TS1483  To convert this file to an ECMAScript module, create a local package.json
        file with `{ "type": "module" }`.
```

Four variants, differing on whether a `package.json` already exists and whether
changing the extension is available. That is more care than most compilers take
over a suggestion, and it is worth reading closely when you get one: **which
variant you got tells you what the compiler found.**

## What the detected format actually changes

Not just the emit. Five things, and it is worth having the list because people
usually know one or two:

1. **The emitted format** — `import`/`export` or `require`/`exports`, per file.
2. **Which resolution algorithm applies** — extensionless paths and directory
   modules are legal under `require` and not under `import`
   ([chunk 05](./05-the-node-resolver.md)).
3. **Which `"exports"` conditions match** — `import` vs `require`.
4. **What syntax is legal** — `import.meta` (`TS1470`), top-level `await`
   (`TS1309`), `export =` (`TS1203`), ESM syntax under `preserve` (`TS1293`) and
   under `verbatimModuleSyntax` (`TS1295`).
5. **Whether a type-only import needs a `resolution-mode` attribute** —
   `TS1541`/`TS1542`: *"Type-only import of an ECMAScript module from a CommonJS
   module must have a 'resolution-mode' attribute."*

That fifth one is the deep end, and it exists precisely because a `.d.ts` has to
describe a module whose format the *importer's* format cannot determine. It is
argued properly in **Phase 6 · 02 · `import type` and `verbatimModuleSyntax`**
*(not written yet)*.

## Gotchas

**Adding `"type": "module"` changes every `.ts` file in the project at once.**
*Symptom:* one line in `package.json`, hundreds of new errors. *Cause:* it is a
project-wide format switch, not a hint. *Fix:* expect it, and do it deliberately
— it is the migration, not a step in it.

**The `package.json` that decides the format may not be the one you are looking
at.** *Symptom:* `"type": "module"` is set and files are still CommonJS. *Cause:*
a nearer ancestor `package.json` — often one generated in a build directory —
stopped the search first. *Fix:* read the `{0}` in `TS1459`/`TS1460`; it names
the deciding file.

**A missing `package.json` is not the same as one without `"type"`.** *Symptom:*
confusion about which of `TS1460` and `TS1461` you got. *Cause:* they are
genuinely different situations — no file at all, versus a file that is silent.
*Fix:* the messages distinguish them; the fixes differ (`TS1483` creates one,
`TS1482` edits one).

**`export {}` is needed under `esnext` and pointless under `nodenext`.**
*Symptom:* a lint rule or convention that makes no sense in half your repos.
*Cause:* `moduleDetection` defaults to `force` for the Node family and `auto`
otherwise. *Fix:* set `moduleDetection` explicitly if you want one rule across
projects with different `module` values.

**`.d.ts` files are exempt from `force`.** *Symptom:* a declaration file with no
import/export still behaves as a global script. *Cause:* the `force` setting is
described as covering non-declaration files. *Fix:* that is usually what you
want — a global `.d.ts` is how ambient declarations work — but it means the
module/script distinction still applies to declaration files and still bites.

**A `package.json` in `dist/` can change the format of the *next* build's
inputs.** *Symptom:* the build behaves differently after one successful run.
*Cause:* a generated `package.json` becomes a nearer ancestor for anything under
it. *Fix:* keep generated `package.json` files out of any directory that contains
inputs, and check `rootDir`/`outDir` do not overlap.

**Changing a file's extension to `.mts` fixes the format and creates four new
errors.** *Symptom:* the format error is replaced by extension errors on its
imports. *Cause:* the file is now ESM, so `TS2834` applies to its relative
imports. *Fix:* both changes belong in the same commit; they are one migration.

**Under `module: esnext` the whole detection mechanism is switched off.**
*Symptom:* `"type": "module"` appears to do nothing. *Cause:* only the Node family
detects format per file; every other value forces one format for the program.
*Fix:* if you want `package.json` to matter, you need a `module` value that reads
it.

## Interview questions

**How does TypeScript decide whether a file is an ES module or CommonJS?**
By extension first — `.mts`/`.mjs` are always ESM, `.cts`/`.cjs` always CommonJS —
and, for the ambiguous extensions, by the `"type"` field of the nearest ancestor
`package.json`. `"module"` means ESM; anything else, or no field, or no file,
means CommonJS. It is Node's own algorithm, applied to the input files.

**Which single line most changes what a TypeScript project emits?**
`"type": "module"` in `package.json`, under a `node16`–`nodenext` `module`
setting. It flips every ambiguous-extension file in the project from CommonJS
emit to ESM emit, along with the resolution rules and the legal syntax for each.

**What does `moduleDetection` do, and what is its default?**
It decides whether a file counts as a module or a script. `auto` — the default
outside the Node family — treats a file as a module if it has imports, exports,
`import.meta`, JSX under `react-jsx`, or is ESM-format under `node16`+. Under the
Node family the default is `force`: every non-declaration file is a module
regardless of content.

**Why does `export {}` fix a "cannot redeclare block-scoped variable" error?**
Because it makes the file a module, so its top-level declarations get module
scope instead of global scope and stop colliding with `lib.dom.d.ts`. Under
`moduleDetection: force` — the Node-family default — it is unnecessary, because
every file is already a module.

**A file is CommonJS and you expected ESM. How do you find out why without
guessing?**
Read the compiler's explain message. `TS1458`–`TS1461` state the reason and, in
three of the four, name the exact `package.json` that decided it — including
distinguishing "the field says something else" from "there is no field" from
"there is no file".

**Why are there four different "To convert this file to an ECMAScript module"
messages?**
Because the available fixes depend on what the compiler found: whether a
`package.json` exists to edit or must be created, and whether changing the
extension is an option. The variant you receive is itself diagnostic
information.

**Name three things besides emit format that a file's detected format changes.**
Which resolution algorithm applies to its imports (extensionless paths and
directory modules are `require`-only); which `"exports"` conditions match
(`import` vs `require`); and what syntax is legal in it — `import.meta`,
top-level `await`, `export =` are each gated on the file's format, not on the
project's settings.

**Is it reasonable to put a `package.json` inside `src/`?**
Yes, and it is a real technique — `{"type": "commonjs"}` in a legacy
subdirectory of an ESM project makes exactly those files CommonJS without
renaming anything. It is also invisible to anyone reading only the root config,
so it wants a comment and a mention in the README.

---

← [08 · Implied, enforced, and incompatible](./08-implied-and-enforced.md) · Next → [10 · When the model is wrong](./10-when-the-model-is-wrong.md)
