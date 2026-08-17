---
title: "`preserve` and the Node family"
sidebar_label: "03 · `preserve` and the Node family"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*
> (the `preserve` and `node16`/`node18`/`node20`/`nodenext` sections), the
> **5.8 release notes** (`--module node18`, `require()` of ECMAScript modules)
> and the **5.9 release notes** (`--module node20`). The implied `target` values
> were read out of the compiler's **computed-option table** in the installed
> **5.9.3** build. **No sandbox, no console block.**

[Chunk 02](./02-every-module-value.md) covered the whole-program values. These
are the two rungs of the granularity ladder that actually matter today: the
family that decides format **per file**, and the one value that decides it **per
statement**.

## `preserve`, and why it exists

Added in **TypeScript 5.4**, and it is the only value whose granularity is the
statement:

> In `--module preserve`, ECMAScript imports and exports written in input files
> are preserved in the output, and CommonJS-style `import x = require("...")` and
> `export = ...` statements are emitted as CommonJS `require` and
> `module.exports`. In other words, the format of each individual import or
> export statement is preserved, rather than being coerced into a single format
> for the whole compilation (or even a whole file).

`preserve` exists for the bundler world, where `import` and `require` can coexist
in one file and the bundler sorts it out. Before 5.4 the honest configuration for
that world was `esnext`, which is a lie in one specific way: it claims the output
is an ES module even when the source deliberately used `require` for something a
bundler will handle.

It carries two implications the compiler applies for you, both stated in the
reference:

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
the error and not the behaviour. That is a genuinely disorienting experience if
you do not know it in advance, because every other context has taught you that
`esModuleInterop` is an emit flag.

⚠️ **`preserve` still enforces the file's format.** Preserving statements is not
the same as ignoring what kind of file they are in — the compiler will still
tell you `TS1293: ECMAScript module syntax is not allowed in a CommonJS module
when 'module' is set to 'preserve'.` The value relaxes *coercion*, not the
format model.

## `node16` vs `node18` vs `node20` vs `nodenext`

All four are the same family: format detected per file, Node's rules applied.
They differ in which Node behaviours are frozen into them, and that is the entire
point of having four rather than one.

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

**`require(esm)` is the reason the split happened**, also 5.8:

> Node.js 22 relaxes some of these restrictions and permits `require("esm")`
> calls from CommonJS modules to ECMAScript modules. Node.js still does not
> permit `require()` on ESM files that contain a top-level `await`, but most
> other ESM files are now consumable from CommonJS files.

and, with unusual candour about the versioning problem this created:

> Because this feature may be back-ported to older versions of Node.js, there is
> currently no stable `--module nodeXXXX` option that enables this behavior;
> however, we predict future versions of TypeScript may be able to stabilize the
> feature under `node20`.

**`node20` duly arrived in TypeScript 5.9.** It is `nodenext` frozen at Node 20's
behaviour, and it carries one difference that shows up in your emit rather than
your errors, confirmed in the compiler's computed-option table:

| `module` | implied `target` |
|---|---|
| `node16` | `es2022` |
| `node18` | `es2022` |
| **`node20`** | **`es2023`** |
| `nodenext` | `esnext` (floating) |

🔴 That table is read out of the compiler, not from documentation, and it is the
concrete reason a "harmless" `node18` → `node20` change alters downlevelling
behaviour: one array method's worth of `target` moved with it.
[Chunk 07](./07-the-defaults-you-did-not-set.md) reads the whole computed chain.

## Choosing between the four

| You are | Use |
|---|---|
| Building an app you deploy and control the Node version of | `nodenext` |
| Publishing a library that must work on old and new Node | `node18` or `node20` — pin the **oldest** you support |
| Pinned to one Node version by policy and want reproducible emit across TypeScript upgrades | the matching `nodeNN` |
| Migrating a CommonJS project and not ready to decide anything | `nodenext` — it will emit CommonJS and start telling you the truth |
| Unsure | `nodenext` |

⚠️ **`nodenext` is deliberately a moving target.** Upgrading TypeScript can
change what it accepts and what it emits — that is the contract, not a
regression. A library with a wide support range wants a pinned `nodeNN` for
exactly that reason, and the handbook's own library recommendation uses `node18`.

📌 **The counter-intuitive one is the migration row.** People assume `nodenext`
is the "advanced" setting to graduate to. It is the opposite: it is the safest
setting to *start* from, because it produces the same CommonJS output the project
already had while switching on the checks that reveal what is wrong with it.

## The four-line summary

```text
preserve   →  per statement.  Bundlers. Implies bundler resolution + interop
                              (type-checking only). Never coerces.
nodenext   →  per file.       Latest Node. Moving. Allows require(esm).
node20     →  per file.       Node 20, frozen. target es2023.
node18     →  per file.       Node 18, frozen. No require(esm). Allows assertions.
node16     →  per file.       Node 16, frozen. target es2022.
```

## Gotchas

**`node16`, `node18` and `node20` are not "older" than `nodenext` in capability
order.** *Symptom:* someone "modernises" a library by moving `node18` →
`nodenext` and the published output starts requiring a newer Node. *Cause:*
`nodenext` implies `target: esnext` and permits `require(esm)`. *Fix:* for a
library, pin to the oldest supported Node; `nodenext` is an app setting.

**`node18` → `node20` silently changes `target`.** *Symptom:* emitted syntax
changes in a commit that only touched `module`. *Cause:* the implied `target`
goes `es2022` → `es2023`. *Fix:* if you need the old downlevelling, set `target`
explicitly — an explicit value always wins over the implied one.

**`preserve` will not let you write ESM in a CommonJS file.** *Symptom:*
`TS1293`. *Cause:* under `preserve` the file's detected format still constrains
its contents; only *coercion* is relaxed. *Fix:* the file needs to be a module of
the right kind — extension or `"type"` field — not a different `module` setting.

**Toggling `esModuleInterop` under `preserve` moves the error and not the
behaviour.** *Symptom:* an interop error disappears when the flag is flipped and
production behaves identically either way. *Cause:* under `preserve` only its
type-checking half is live. *Fix:* fix the import shape, not the flag — and
recognise that the flag is no longer telling you anything about the output.

**A `nodenext` project can regress on a TypeScript upgrade and that is by
design.** *Symptom:* CI breaks on `tsc` 5.x → 5.y with no source change. *Cause:*
`nodenext` tracks the newest Node semantics, including newly *disallowed* things
like import assertions. *Fix:* either accept it (an app) or pin to `nodeNN` (a
library). This is one of the few cases where "we pinned the compiler version" is
not the whole answer.

**Import assertions vs import attributes catch people mid-migration.**
*Symptom:* `assert { type: "json" }` compiles under `node18` and is rejected
under `nodenext`. *Cause:* assertions are deprecated in favour of attributes, and
`nodenext` has already dropped them. *Fix:* `with { type: "json" }`.

**`preserve` plus `"type": "module"` is discouraged, and the reason is not
obvious.** *Symptom:* subtle interop differences between your bundler and the
compiler. *Cause:* the handbook's bundler guidance says *"it's also recommended
not to set `{ "type": "module" }` or use `.mts` files in bundler projects for
now. Some bundlers adopt different ESM/CJS interop behavior under these
circumstances, which TypeScript cannot currently analyze."* *Fix:* leave the
`"type"` field off in bundler projects.

## Interview questions

**What does `preserve` preserve, exactly?**
The format of each individual import and export *statement*. ESM syntax stays ESM
syntax in the output; `import x = require(…)` and `export =` become CommonJS. It
is the only value whose granularity is the statement rather than the file or the
program, and it exists because bundlers genuinely allow both in one file.

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

**If `esModuleInterop` is implied by `preserve`, why does toggling it change
nothing in the output?**
Because under `preserve` imports are never transformed into `require` calls, and
`esModuleInterop`'s emit half is entirely about generating the `__importDefault`
/ `__importStar` helpers for that transformation. Under `preserve` only its
type-checking half is live — what a default import from a CommonJS module is
allowed to mean.

**You are starting a migration of a large CommonJS codebase. Which `module`
value do you set first, and why?**
`nodenext`. It emits the same CommonJS artefact the project already produces —
because no `"type": "module"` is present — while switching on Node's real dual-
format rules, so the compiler starts reporting the CJS/ESM mistakes that were
previously invisible. It is a diagnostic change before it is an output change,
which makes it a safe first step.

**A library maintainer asks whether to use `nodenext`. What do you tell them?**
No — pin to the oldest Node version they support, `node18` or `node20`. A library
compiled under `nodenext` inherits a floating `target` and the newest Node
semantics, so a routine TypeScript upgrade can change the published output's
runtime requirements without a single source change.

**What breaks if you set `preserve` and `"type": "module"` together in a bundler
project?**
Nothing loudly, which is the problem. The handbook advises against the
combination because some bundlers change their ESM/CJS interop behaviour when a
package is marked ESM, and TypeScript cannot model that under `moduleResolution:
bundler`. You end up with a compiler whose interop assumptions quietly disagree
with your bundler's.

---

← [02 · Every `module` value](./02-every-module-value.md) · Next → [04 · Every resolution strategy](./04-every-resolution-strategy.md)
