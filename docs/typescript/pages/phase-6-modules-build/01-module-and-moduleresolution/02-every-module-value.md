---
title: "Every `module` value"
sidebar_label: "02 · Every `module` value"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08. The accepted values and their internal numbering were read
> out of the `module` **option record** in the installed **TypeScript 5.9.3**
> build (`name: "module"`, its `type` map, and `defaultValueDescription`).
> Descriptions are verbatim from the **TypeScript handbook**, *Modules —
> Reference*. `node18` is from the **5.8 release notes**, `node20` from the
> **5.9** release notes. **No sandbox, no console block.**

`module` accepts **fourteen spellings for twelve distinct behaviours.** Most of
them you will never set on purpose. Knowing which is which takes about ten
minutes and saves the recurring argument about whether `es2022` is "more modern"
than `nodenext` (it is not; it is a different axis entirely).

## The complete table

Read straight out of the compiler's option record, in the order the compiler
lists them:

| Value | Internal | What it emits | Verdict |
|---|---|---|---|
| `none` | 0 | Module syntax is an error | Scripts only. Vanishingly rare |
| `commonjs` | 1 | `require` / `exports`, whole program | Legacy. See below |
| `amd` | 2 | AMD `define(…)`, whole program | Dead |
| `umd` | 3 | UMD wrapper, whole program | Dead |
| `system` | 4 | SystemJS `System.register`, whole program | Dead |
| `es6` / `es2015` | 5 | ESM, whole program | Superseded |
| `es2020` | 6 | ESM + `import.meta` | Superseded |
| `es2022` | 7 | ESM + top-level `await` | Superseded by `esnext`/`preserve` |
| `esnext` | 99 | ESM, moving target | ✅ For bundlers |
| `node16` | 100 | **Per file**: CJS or ESM, Node v16 rules | ✅ Pinned Node 16 |
| `node18` | 101 | **Per file**, Node v18 rules | ✅ Pinned Node 18 (5.8+) |
| `node20` | 102 | **Per file**, Node v20 rules | ✅ Pinned Node 20 (5.9+) |
| `nodenext` | 199 | **Per file**, latest Node rules | ✅ The default answer for Node |
| `preserve` | 200 | **Per statement**: leaves what you wrote | ✅ For bundlers, since 5.4 |

📌 The numbering is not cosmetic. `node16` = 100 through `nodenext` = 199 is a
contiguous block the compiler tests as a range — `100 <= moduleKind <= 199` is
literally how it asks "is this a Node-family setting?" before enforcing the
matching `moduleResolution`. `preserve` = 200 sits deliberately outside it.

## The one family that behaves differently

Everything above the `node16` line forces **one format for the whole
compilation**. The handbook is explicit that this is the distinguishing property
of the Node family:

> `node16`, `node18`, and `nodenext` describe the full range of behavior for
> Node.js's dual-format module system, and **emit files in either CommonJS or ESM
> format**. This is different from every other `module` option, which are
> runtime-agnostic and force all output files into a single format, leaving it to
> the user to ensure the output is valid for their runtime.

And it pre-empts the misreading everybody makes:

> A common misconception is that `node16`—`nodenext` only emit ES modules. In
> reality, these modes describe versions of Node.js that *support* ES modules,
> not just projects that *use* ES modules. Both ESM and CommonJS emit are
> supported, based on the detected module format of each file.

🔴 **This is the single most useful correction in the topic.** `nodenext` is not
"the ESM setting". It is the *obey-Node* setting, and it is the right answer for
a project that emits nothing but CommonJS. How the per-file decision is made is
chunk 05.

## What the handbook says to do with the legacy values

The reference page does not hedge, so neither will this page.

**`commonjs`:**

> You probably shouldn't use this. Use `node16`, `node18`, or `nodenext` to emit
> CommonJS modules for Node.js.

That reads as a contradiction until you have chunk 05: `nodenext` on a project
without `"type": "module"` emits CommonJS *anyway*, and additionally enforces the
rules Node applies to CommonJS files. You get the same output plus the checking.
`"module": "commonjs"` is strictly less information for the same artefact.

**`amd`:** *"Designed for AMD loaders like RequireJS. You probably shouldn't use
this. Use a bundler instead."*
**`umd`:** *"Does not expose a global variable like most other UMD wrappers. You
probably shouldn't use this. Use a bundler instead."*
**`system`:** *"Designed for use with the SystemJS module loader."*

⚠️ The `umd` note is worth a second look, because it is the failure mode: people
reach for `"module": "umd"` expecting the classic UMD build that attaches a
global for a `<script>` tag, and TypeScript's UMD emit does not do that. If you
want a global-attaching bundle, you want a bundler, not this flag.

**`es2015`/`es2020`/`es2022`/`esnext`**, quoted in full because the guidance is
buried in the middle:

> Use `esnext` with `--moduleResolution bundler` for bundlers, Bun, and tsx. **Do
> not use for Node.js.** Use `node16`, `node18`, or `nodenext` with
> `"type": "module"` in package.json to emit ES modules for Node.js.

The version-numbered members differ only in which module-adjacent syntax they
permit: `es2020` adds `import.meta`, `es2022` adds top-level `await`, `esnext`
tracks Stage 3 proposals. There is no reason to pick `es2020` over `esnext` for a
bundled app — the bundler, not this flag, decides what the browser receives.

## `preserve`, and why it exists

Added in **TypeScript 5.4**, and it is the only value whose granularity is the
*statement*:

> In `--module preserve`, ECMAScript imports and exports written in input files
> are preserved in the output, and CommonJS-style `import x = require("...")` and
> `export = ...` statements are emitted as CommonJS `require` and
> `module.exports`. In other words, the format of each individual import or
> export statement is preserved, rather than being coerced into a single format
> for the whole compilation (or even a whole file).

So the granularity ladder, which is the clean way to hold all of this:

```text
whole program   ──►  commonjs, amd, umd, system, es2015…esnext
per file        ──►  node16, node18, node20, nodenext
per statement   ──►  preserve
```

`preserve` exists for the bundler world, where `import` and `require` can coexist
in one file and the bundler sorts it out. It carries two implications the
compiler applies for you, both stated in the reference:

> `--module preserve` implies `--moduleResolution bundler`.

> `--module preserve` implies `--esModuleInterop`.

with a caveat that is easy to misread as a bug:

> The option `--esModuleInterop` is enabled by default in `--module preserve`
> only for its type checking behavior. Since imports never transform into require
> calls in `--module preserve`, `--esModuleInterop` does not affect the emitted
> JavaScript.

📌 In other words: under `preserve`, `esModuleInterop` changes what the *checker*
believes about default imports and changes **nothing** about the output. If you
are debugging an interop problem under `preserve`, toggling that flag will move
the error and not the behaviour.

## `node16` vs `node18` vs `node20` vs `nodenext`

All four are the same family. They differ in which Node behaviours are frozen
into them, and that is the entire point of having four.

**`node18`, from the 5.8 release notes:**

> TypeScript 5.8 introduces a stable `--module node18` flag. For users who are
> fixed on using Node.js 18, this flag provides a stable point of reference that
> does not incorporate certain behaviors that are in `--module nodenext`.
> Specifically:
>
> - `require()` of ECMAScript modules is disallowed under `node18`, but allowed
>   under `nodenext`
> - import assertions (deprecated in favor of import attributes) are allowed
>   under `node18`, but are disallowed under `nodenext`

**`require(esm)`, the reason the split happened**, also 5.8:

> Node.js 22 relaxes some of these restrictions and permits `require("esm")`
> calls from CommonJS modules to ECMAScript modules. Node.js still does not
> permit `require()` on ESM files that contain a top-level `await`, but most
> other ESM files are now consumable from CommonJS files.

and, with unusual candour about the versioning problem:

> Because this feature may be back-ported to older versions of Node.js, there is
> currently no stable `--module nodeXXXX` option that enables this behavior;
> however, we predict future versions of TypeScript may be able to stabilize the
> feature under `node20`.

**`node20` duly arrived in TypeScript 5.9**, and it carries one difference that
is easy to miss and shows up in your emit: `node20` implies `target: es2023`,
whereas `nodenext` implies the floating `target: esnext`. That is confirmed in
the compiler's own computed-option table, which chunk 04 reads out in full.

**How to choose between them:**

| You are | Use |
|---|---|
| Building an app you deploy and control the Node version of | `nodenext` |
| Publishing a library that must work on old and new Node | `node18` or `node20` — pin the *oldest* you support |
| Pinned to one Node version by policy and want reproducible emit across TS upgrades | the matching `nodeNN` |
| Unsure | `nodenext` |

⚠️ **`nodenext` is deliberately a moving target.** Upgrading TypeScript can
change what it accepts and what it emits — that is the contract, not a
regression. A library with a wide support range wants a pinned `nodeNN` for
exactly that reason; the handbook's own library recommendation uses `node18`.

## Gotchas

**`"module": "esnext"` with no `moduleResolution` gives you `classic`.**
*Symptom:* `TS2307: Cannot find module 'lodash' or its corresponding type
declarations.` for a package that is unmistakably installed. *Cause:* the implied
`moduleResolution` for every non-Node, non-`preserve` value is `classic`, which
does not search `node_modules` at all. *Fix:* set
`"moduleResolution": "bundler"`. This is chunk 04's headline and it catches
people every year.

**`node16` and `node20` are not "older" than `nodenext` in capability order.**
*Symptom:* someone "modernises" a library by moving `node18` → `nodenext` and the
published output starts requiring a newer Node. *Cause:* `nodenext` implies
`target: esnext` and permits `require(esm)`. *Fix:* for a library, pin to the
oldest supported Node; `nodenext` is an app setting.

**Switching `commonjs` → `nodenext` can change your emit format wholesale.**
*Symptom:* `dist/` suddenly contains `import` statements and Node throws
`Cannot use import statement outside a module`. *Cause:* the project has
`"type": "module"` in `package.json`, which `commonjs` ignored and `nodenext`
obeys. *Fix:* decide which you meant. `"type": "module"` is now load-bearing and
was previously inert.

**`preserve` will not stop you writing ESM in a CommonJS file — but the checker
will.** *Symptom:* `TS1293: ECMAScript module syntax is not allowed in a CommonJS
module when 'module' is set to 'preserve'.` *Cause:* under `preserve` the file's
detected format still constrains its contents. *Fix:* the file needs to be a
module of the right kind — extension or `"type"` field — not a different `module`
setting.

**`import.meta` is gated on `module`, not on `target`.**
*Symptom:* `TS1343: The 'import.meta' meta-property is only allowed when the
'--module' option is 'es2020', 'es2022', 'esnext', 'system', 'node16', 'node18',
'node20', or 'nodenext'.` *Cause:* you raised `target` and left `module` at
`commonjs`. *Fix:* raise `module`. Note the message text is the compiler's own
enumeration of which values support it — a useful list to have quoted.

**`import.meta` is *also* gated on the file's detected format.**
*Symptom:* `TS1470: The 'import.meta' meta-property is not allowed in files which
will build into CommonJS output.` under `nodenext`, where `TS1343` says the
setting is fine. *Cause:* two different checks — one on the setting, one on the
file. *Fix:* make the file ESM.

**`es6` and `es2015` are the same value.** *Symptom:* a code review argument.
*Cause:* both map to internal `5`. *Fix:* neither is more correct; prefer neither
and use `esnext` or the Node family.

**Named imports from JSON are format-dependent.** *Symptom:* `TS1544: Named
imports from a JSON file into an ECMAScript module are not allowed when 'module'
is set to '{0}'.` *Cause:* under Node's ESM rules a JSON module has only a
default export. *Fix:* `import data from "./x.json" with { type: "json" }` and
destructure afterwards. Covered properly in **Phase 6 · 16 · Typing non-code
imports** *(not written yet)*.

## Interview questions

**Which `module` values would you actually consider in 2026, and for what?**
Four: `nodenext` for an app running on Node you control; a pinned `node18`/
`node20` for a published library or a policy-pinned runtime; `esnext` with
`moduleResolution: bundler` for a bundled front end; `preserve` for a bundled
project that mixes `import` and `require` in the same file. Everything else is
legacy or dead.

**Is `"module": "nodenext"` the ESM setting?**
No, and this is the most common misconception in the area. It is the
*obey-Node.js* setting. It emits CommonJS for files Node would treat as CommonJS
and ESM for files Node would treat as ESM, per file. A project with no
`"type": "module"` and only `.ts` files emits 100% CommonJS under `nodenext`.

**What does `preserve` preserve, exactly?**
The format of each individual import and export *statement*. ESM syntax stays ESM
syntax in the output; `import x = require(…)` and `export =` become CommonJS.
It is the only value whose granularity is the statement rather than the file or
the program.

**Why did TypeScript add `node18` and `node20` when `nodenext` already existed?**
Because `nodenext` is a moving target by design, and two behaviours diverged
across Node versions: `require()` of an ES module (allowed from Node 22, so
allowed under `nodenext`, disallowed under `node18`) and import assertions
(allowed under `node18`, disallowed under `nodenext`). A pinned value gives
reproducible emit and diagnostics across TypeScript upgrades — which is what a
published library needs.

**What is the practical difference between `node20` and `nodenext` today?**
`node20` is frozen and implies `target: es2023`; `nodenext` tracks the newest
Node behaviour and implies the floating `target: esnext`. A TypeScript upgrade
can change what `nodenext` accepts and emits; it cannot change `node20`.

**Your team sets `"module": "es2022"` for a Node service. What do you say?**
That it forces every output file to ESM regardless of what `package.json` says,
so the compiler is no longer modelling Node's dual-format rules and cannot warn
you about CJS/ESM interop mistakes — and that the handbook's guidance for these
values is explicitly *"Do not use for Node.js"*. The replacement is `nodenext`,
plus `"type": "module"` if ESM output is genuinely wanted.

**If `esModuleInterop` is implied by `preserve`, why does toggling it change
nothing in the output?**
Because under `preserve` imports are never transformed into `require` calls, and
`esModuleInterop`'s emit half is entirely about generating the `__importDefault`
/ `__importStar` helpers for that transformation. Under `preserve` only its
*type-checking* half is live — what a default import from a CommonJS module is
allowed to mean.

**How does the compiler decide whether a `module` setting is "in the Node
family"?**
By numeric range: the Node values occupy 100–199 (`node16` = 100, `node18` = 101,
`node20` = 102, `nodenext` = 199) and the compiler tests `100 <= module <= 199`
before enforcing a matching `moduleResolution`. `preserve` = 200 sits outside the
range on purpose.

---

← [01 · The two questions](./01-the-two-questions.md) · Next → [03 · Every resolution strategy](./03-every-resolution-strategy.md)
