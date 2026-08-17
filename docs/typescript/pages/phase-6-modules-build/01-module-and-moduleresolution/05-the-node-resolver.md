---
title: "The Node resolver — `node16` and `nodenext`"
sidebar_label: "05 · The Node resolver"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*
> (the `node16`/`nodenext` section and its supported-feature table,
> *Extensionless relative paths*, *Directory modules*, *Relative file path
> resolution*). `TS2834` and `TS2835` are verbatim from the compiler's message
> table in the installed **5.9.3** build. **No sandbox, no console block.**

[Chunk 04](./04-every-resolution-strategy.md) covered the two strategies that
cannot read a modern `package.json`. This is the first of the two that can — and
it is the only one that models **two algorithms at once**.

## Why this mode is different in kind

> These modes reflect the module resolution behavior of Node.js v12 and later.
> (`node16` and `nodenext` are currently identical, but if Node.js makes
> significant changes to its module system in the future, `node16` will be frozen
> while `nodenext` will be updated to reflect the new behavior.) In Node.js, the
> resolution algorithm for ECMAScript imports is significantly different from the
> algorithm for CommonJS `require` calls.

That last sentence is the whole design. Every other strategy is one algorithm.
This one is two, and which you get depends on how the **importing** file is
loaded — a fact established per file by format detection
([chunk 08](./08-format-detection.md)).

The handbook gives it as a two-column table, and it is the most useful table in
the modules reference:

| Feature | under `import` | under `require` |
|---|---|---|
| `paths` | ✅ | ✅ |
| `baseUrl` | ✅ | ✅ |
| `node_modules` lookups | ✅ | ✅ |
| `"exports"` | ✅ matches `types`, `node`, `import` | ✅ matches `types`, `node`, `require` |
| `"imports"` / self-name | ✅ matches `types`, `node`, `import` | ✅ matches `types`, `node`, `require` |
| `"typesVersions"` | ✅ | ✅ |
| Package-relative paths | ✅ when `exports` absent | ✅ when `exports` absent |
| Full relative paths | ✅ | ✅ |
| **Extensionless relative paths** | ❌ | ✅ |
| **Directory modules** | ❌ | ✅ |

Two rows differ. Both are ergonomics you have relied on for years, and both are
gone in ESM.

## The two ❌ rows are what people actually feel

```ts
// In a CommonJS file — fine.
import { q } from "./db";        // resolves ./db.ts
import { User } from "./models"; // resolves ./models/index.ts
```

The identical two lines in an ESM file are both errors:

```text
TS2834  Relative import paths need explicit file extensions in ECMAScript
        imports when '--moduleResolution' is 'node16' or 'nodenext'. Consider
        adding an extension to the import path.

TS2835  Relative import paths need explicit file extensions in ECMAScript
        imports when '--moduleResolution' is 'node16' or 'nodenext'. Did you
        mean '{0}'?
```

The fix is to write the extension the **runtime** wants, which is `.js` even
though the file on disk is `.ts`:

```ts
import { q } from "./db.js";
import { User } from "./models/index.js";
```

⚠️ **That is not a typo and it is not a hack.** The specifier is emitted as
written ([chunk 01](./01-the-two-questions.md)), so the string has to be the one
Node will resolve *after* compilation — and after compilation, `db.ts` is
`db.js`. TypeScript then applies extension substitution to find `db.ts` for type
purposes. `TS2835` even hands you the corrected string.

📌 A reframe that makes this stop feeling wrong: under `node16`/`nodenext` you
are not writing paths to your source files. You are writing paths to your
**output** files, and the compiler maps them back. Everyone finds it strange for
about a week and then never thinks about it again.

There is a limit in the other direction that surprises people too:

> TypeScript currently never supports omitting a `.mjs`/`.mts` or `.cjs`/`.cts`
> file extension, even though some runtimes and bundlers do.

So the extension rule is not "ESM is strict, CJS is loose" — it is per-extension,
and the explicit ones are always explicit.

## Directory modules are a legacy feature, and Node says so

> Note that directory modules are not the same as `node_modules` packages and
> only support a subset of the features available to packages, and are not
> supported at all in some contexts. Node.js considers them a legacy feature.

So `import { x } from "./models"` resolving to `models/index.ts` is not a
TypeScript convenience being withdrawn — it is a CommonJS-era Node behaviour that
ESM never adopted. The Node family models that faithfully.

📌 Worth knowing: a directory module may itself carry a `package.json`, and its
`"main"`, `"types"` and `"typesVersions"` fields are honoured and take precedence
over the `index.js` lookup. That is how a `src/models/package.json` can redirect
an import you thought was resolving to `index.ts`.

## `node16` and `nodenext` are identical *today*

The parenthetical in the quote above is a promise, not a description. Right now
the two resolution modes behave the same. The moment Node changes its resolution
algorithm again, `node16` freezes and `nodenext` moves. Choosing between them is
therefore a choice about **which future you want**, and it costs nothing today.

⚠️ Do not confuse this with the `module` values of the same names, which already
differ today ([chunk 03](./03-preserve-and-the-node-family.md) —
`require(esm)`, import assertions, implied `target`). Same words, two settings,
different amounts of divergence.

## Gotchas

**`TS2834` arrives in a wave and looks like a disaster.** *Symptom:* switching to
`nodenext` produces hundreds of errors on relative imports. *Cause:* ESM files
may not omit extensions. *Fix:* they are mechanical — `TS2835` supplies the
replacement string, and most editors apply it as a project-wide quick fix. Budget
an afternoon, not a rewrite.

**`.js` in a `.ts` import looks wrong to every reviewer at least once.**
*Symptom:* a review comment asking you to "fix the extension". *Cause:* the
specifier names the output file, not the source. *Fix:* the comment, not the
code — and a one-line note in the repo's contributing guide saves it recurring.

**Extensionless imports keep working in your CommonJS files, which hides the
problem.** *Symptom:* a project migrates to `nodenext` cleanly, then breaks the
day someone adds `"type": "module"`. *Cause:* under `require` the extensionless
form is legal, so nothing complained until the files became ESM. *Fix:* write
extensions everywhere from the start; the explicit form is correct under both.

**A directory import that "works" may be resolving through a `package.json` you
forgot about.** *Symptom:* editing `models/index.ts` has no effect. *Cause:* a
`models/package.json` with a `"main"` or `"types"` field takes precedence.
*Fix:* look for the file. It is easy to add for a legitimate reason and then
impossible to remember.

**`node16`/`nodenext` is not a drop-in replacement for `node10`.** *Symptom:* the
`TS2834` wave above. *Cause:* the Node family enforces ESM's rules, which
`node10` never modelled. *Fix:* if you want modern package resolution without
that constraint — because a bundler loads your code — `bundler` is the right
target instead ([chunk 06](./06-the-bundler-resolver.md)).

**`.mts` does not save you from writing extensions.** *Symptom:* renaming a file
to `.mts` and still getting `TS2834` on its imports. *Cause:* the extension makes
the file ESM, which is what *causes* the rule. *Fix:* write the extensions. The
rename made the problem visible, not worse.

**Two files, one specifier, two answers.** *Symptom:* `import x from "pkg"` gives
different types in two files in the same project. *Cause:* one file is CJS and
one is ESM, so `"exports"` matched `require` in one and `import` in the other.
*Fix:* nothing — that is the mode working. But it means "what type is `pkg`?" is
not a well-formed question without naming the importing file.

## Interview questions

**Why does `node16` resolution behave differently in two files in the same
project?**
Because Node's resolution algorithm for `import` is genuinely different from its
algorithm for `require`, and `node16`/`nodenext` model both. The importing file's
detected format selects which applies, so extensionless paths and directory
modules are legal in a CommonJS file and errors in an ESM file, in one
compilation.

**Why must you write `./db.js` when the file is `db.ts`?**
Because the module specifier is emitted as written, so it has to be the string
Node will resolve after compilation — where the file is `db.js`. TypeScript then
substitutes extensions to find `db.ts` for type information. You are writing a
path to the output, not to the source.

**What is the difference between `moduleResolution: node16` and
`moduleResolution: nodenext` today?**
Nothing. They are currently identical. The distinction is a promise about the
future: if Node changes its resolution algorithm, `node16` will be frozen at the
old behaviour and `nodenext` will move. Note this is *not* true of the `module`
values with the same names, which already differ.

**Why did ESM drop extensionless imports and directory modules?**
Because both require the loader to probe the filesystem — try `./a.js`, then
`./a/index.js`, and so on — which is incompatible with a resolution algorithm
that has to work over URLs and be statically analysable. Node considers directory
modules a legacy feature even in CommonJS.

**Someone proposes `"allowImportingTsExtensions"` so they can write `./db.ts`.
What do you say?**
That it solves a different problem. It requires `noEmit` or `emitDeclarationOnly`
— the compiler refuses to emit a specifier it knows the runtime cannot resolve —
so it suits a check-only setup where something else does the running, not a `tsc`
build. The details are **Phase 6 · 06 · File extensions** *(not written yet)*.

**How would you make the `TS2834` migration cheap?**
Let the compiler drive it. `TS2835` carries the corrected specifier in the
message, editors expose it as a fix-all quick fix, and the change is purely
mechanical and reviewable in one pass. The expensive part is not the edit, it is
convincing the team that `.js` in a `.ts` file is correct.

---

← [04 · The two that cannot](./04-every-resolution-strategy.md) · Next → [06 · The bundler resolver](./06-the-bundler-resolver.md)
