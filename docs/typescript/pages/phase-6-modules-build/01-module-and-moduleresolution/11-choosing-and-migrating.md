---
title: "Choosing, and migrating"
sidebar_label: "11 · Choosing and migrating"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Choosing
> Compiler Options* — the bundler, Node.js and library recipes and their stated
> rationale are quoted verbatim. Implied options and the `node18`/`node20`
> distinctions are from *Modules — Reference* and the **5.8**/**5.9** release
> notes; the computed defaults are read from the installed **5.9.3** build's
> option table. **No sandbox, no console block.**

Ten chunks of mechanism. This is the part you act on.

## The decision, in one question

**What loads your code?** Not what you write, not how modern the codebase feels
— what physically resolves the specifiers at runtime.

```text
Node runs the output           →  module: nodenext
Node runs it, pinned version   →  module: node18 / node20
A bundler runs it              →  module: preserve   (or esnext + bundler)
Something else runs .ts direct →  module: preserve / esnext + bundler, noEmit
You are publishing a package   →  module: node18 or node20 — the OLDEST you support
```

Everything else — `moduleResolution`, `target`, `esModuleInterop` — follows from
that one line, except in the bundler case where you set two
([chunk 07](./07-the-defaults-you-did-not-set.md)).

## The doc-backed recipes

These are the handbook's own, quoted rather than invented.

### Compiling and running the output in Node.js

```jsonc
{
  "compilerOptions": {
    "module": "nodenext",
    "verbatimModuleSyntax": true
  }
}
```

> Remember to set `"type": "module"` or use `.mts` files if you intend to emit ES
> modules.

That config implies `moduleResolution: nodenext`, `esModuleInterop: true` and
`target: esnext`. **Two lines.** Every additional module-related line in a Node
config is either redundant or a mistake.

### Using a bundler

```jsonc
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "customConditions": ["module"],
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "allowArbitraryExtensions": true,
    "verbatimModuleSyntax": true
  }
}
```

with a caveat that is easy to skip and expensive to rediscover:

> it's also recommended *not* to set `{ "type": "module" }` or use `.mts` files in
> bundler projects for now. Some bundlers adopt different ESM/CJS interop
> behavior under these circumstances, which TypeScript cannot currently analyze
> with `"moduleResolution": "bundler"`.

📌 `"noEmit": true` is the load-bearing line. Under a bundler, `tsc` is a type
checker; the bundler produces the JavaScript. That is what makes
`allowImportingTsExtensions` available at all.

### Writing a library

```jsonc
{
  "compilerOptions": {
    "module": "node18",
    "target": "es2020",
    "strict": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true,
    "declarationMap": true,
    "rootDir": "src",
    "outDir": "dist"
  }
}
```

The handbook's reasons, verbatim, because each answers an argument you will
actually have:

- **`module: "node18"`** — *"When a codebase is compatible with Node.js's module
  system, it almost always works in bundlers as well."*
- **`target: "es2020"`** — *"Setting this value to the lowest ECMAScript version
  that you intend to support ensures the emitted code will not use language
  features introduced in a later version."*
- **`strict: true`** — *"Without this, you may write type-level code that ends up
  in your output `.d.ts` files and errors when a consumer compiles with `strict`
  enabled."*
- **`verbatimModuleSyntax: true`** — *"it prevents writing any import statements
  that could be interpreted ambiguously based on the user's value of
  `esModuleInterop` or `allowSyntheticDefaultImports`."*
- **`rootDir` / `outDir`** — *"it's necessary for libraries that publish their
  input files. Otherwise, extension substitution will cause the library's
  consumers to load the library's `.ts` files instead of `.d.ts` files."*

🔴 **Note the direction of the library advice: the Node setting, not the bundler
setting.** A library compiled for Node's rules works under bundlers; the reverse
is not true, because bundlers permit specifiers Node rejects. Compile for the
stricter host and you satisfy both.

## The migration order

Changing these settings on a live codebase in the wrong order produces a wall of
errors you cannot triage. This order keeps each step diagnosable.

**1. Fix `moduleResolution` first, alone.** Move `node`/`node10` → `bundler` or
the Node family. Change nothing else. The errors you get are `TS2307`, `TS6278`,
`TS6280` and `TS2834`, and each is a real latent defect — a specifier your loader
would not have resolved, or a private subpath you should not have imported.

**2. Then set `module` to match the host.** If the two disagree you will be told
(`TS5109`/`TS5110`), which is why this step is cheap after step 1.

**3. Then, and only then, decide about `"type": "module"`.** This is the
irreversible-feeling one, because it flips every ambiguous-extension file in the
project at once ([chunk 09](./09-format-detection.md)). Doing it before steps 1
and 2 mixes format errors with resolution errors and makes both harder to read.

**4. Write extensions on relative imports.** `TS2835` supplies the corrected
string, so this is mechanical and fix-all-able. Do it even if you are not
adopting ESM — `./db.js` is correct under every strategy
([chunk 06](./06-the-bundler-resolver.md)).

**5. Run the built artefact in CI.** One `node dist/index.js` catches the entire
class of failures type checking cannot see
([chunk 10](./10-when-the-model-is-wrong.md)).

⚠️ **Steps 1 and 3 are the ones people combine, and it is the single most common
way a module migration stalls.** Two hundred errors from one commit are a
rollback; sixty errors from a commit that only changed the resolver are an
afternoon.

## The two-minute audit

For any `tsconfig.json` you inherit:

| Question | Where the answer is |
|---|---|
| What is `moduleResolution`, **including if unset**? | [Chunk 07](./07-the-defaults-you-did-not-set.md)'s table |
| Does that match what loads the code? | Chunk 11, the decision above |
| Does the emitted output say `require(` or `import`? | Open one file in `dist/` |
| Is `"type": "module"` present, and does the `module` value even read it? | Only `node16`–`nodenext` do |
| Do relative imports carry extensions? | If not, the project cannot become ESM without a sweep |

Five questions. Most legacy projects fail the first two, and the fix is one line.

## Gotchas

**Migrating `module` and `moduleResolution` in one commit doubles the errors and
halves the diagnosability.** *Symptom:* an unreviewable diff. *Cause:* format
errors and resolution errors interleaved. *Fix:* resolution first, alone.

**"We'll adopt ESM later" is a decision with a cost that accrues.** *Symptom:*
every new file adds another extensionless import. *Cause:* nothing forbids them
under CommonJS. *Fix:* write extensions now regardless — they are correct under
every strategy, and they are the bulk of the eventual migration.

**A library compiled with `bundler` resolution can ship broken types.**
*Symptom:* consumers on Node report unresolved subpaths. *Cause:* `bundler`
permitted extensionless and directory specifiers in the emitted `.d.ts` that
Node's ESM resolver rejects. *Fix:* compile libraries under the Node family, per
the handbook's own recipe.

**Publishing `.ts` files without `rootDir`/`outDir` makes consumers compile your
source.** *Symptom:* consumers see your internal types and your compile errors.
*Cause:* extension substitution finds `.ts` before `.d.ts`. *Fix:* the two
options are in the library recipe for exactly this reason.

**`target: "esnext"` in a published library is a downstream problem.**
*Symptom:* consumers on older runtimes get syntax errors. *Cause:* `nodenext`
implies a floating `target`. *Fix:* pin `target` to the lowest version you
support — the handbook's `es2020` is a deliberate floor, not a default.

**Nobody re-audits after a compiler upgrade.** *Symptom:* behaviour drift across
a TypeScript bump. *Cause:* `nodenext` and `esnext` are moving targets, so the
implied values can change. *Fix:* the five-question audit is two minutes; run it
at each major upgrade.

**A monorepo can need two different answers and usually pretends it needs one.**
*Symptom:* endless argument about the shared base config. *Cause:* the API is
loaded by Node and the web app by a bundler, so `nodenext` and `bundler` are both
correct — for different packages. *Fix:* let the base config carry `strict` and
nothing about modules; each package sets its own `module`.

**`verbatimModuleSyntax` appears in all three recipes and is usually left out.**
*Symptom:* imports whose meaning depends on flags the consumer controls.
*Cause:* it is the one module-adjacent flag with no downside in a new project.
*Fix:* set it. Topic 02 — **Phase 6 · 02 · `import type` and
`verbatimModuleSyntax`** *(not written yet)* — is the argument in full.

## Interview questions

**How do you choose a `module` value for a new project?**
By asking what physically loads the output. Node running the built files means
`nodenext`, or a pinned `nodeNN` if the Node version is fixed. A bundler means
`preserve`, or `esnext` with `moduleResolution: bundler`. A published library
means the oldest Node you support. Nothing else about the project changes the
answer.

**Why does the handbook recommend the Node setting for libraries even if
consumers use bundlers?**
Because compatibility runs one way: *"When a codebase is compatible with Node.js's
module system, it almost always works in bundlers as well."* Bundlers accept
specifiers Node rejects, so compiling under Node's stricter rules satisfies both,
while compiling under `bundler` can ship a `.d.ts` full of specifiers Node cannot
resolve.

**What order would you migrate a legacy `tsconfig.json` in?**
`moduleResolution` first and alone, so the errors are all resolution errors and
each is a real latent defect. Then `module`, which the compiler will tell you
about if it disagrees. Then `"type": "module"` if ESM output is wanted, since
that flips every file at once. Then extensions on relative imports. Then run the
artefact in CI.

**Why is `"noEmit": true` in the bundler recipe?**
Because the bundler produces the JavaScript, so `tsc` has no emit job — it is a
type checker. It is also the precondition for `allowImportingTsExtensions`, which
the compiler refuses outside `noEmit`/`emitDeclarationOnly` because a `.ts`
specifier in emitted JavaScript would not resolve.

**Your monorepo has an Express API and a Vite app. One base config or two?**
One base config for `strict` and the other non-module settings, and per-package
`module` values — `nodenext` for the API, `preserve` or `esnext`+`bundler` for the
app. They are loaded by different things, so a single module setting is wrong for
one of them by construction.

**What are the five questions you would ask of an inherited `tsconfig.json`?**
What `moduleResolution` resolves to including when unset; whether that matches
the loader; whether the emitted output is actually `require` or `import`; whether
`"type": "module"` is present *and* whether the `module` value even reads it; and
whether relative imports carry extensions. The first two are wrong in most
legacy projects and the fix is one line.

**Why write extensions on relative imports even in a CommonJS project?**
Because `./db.js` is the only relative-import spelling correct under all four
resolution strategies and both Node formats, and because it is the bulk of the
work in any future ESM migration. Deferring it means every new file adds to the
eventual sweep.

**What would make you *not* move to `nodenext`?**
Publishing a library with a wide support range. `nodenext` tracks the newest Node
semantics and implies a floating `target`, so a routine compiler upgrade can
change the published output's runtime requirements. A pinned `node18` or `node20`
gives reproducible emit, which is what a library needs and an app does not.

---

← [10 · When the model is wrong](./10-when-the-model-is-wrong.md) · Back to [the topic index](./README.md) · Next topic → **02 · `import type` and `verbatimModuleSyntax`** *(not written yet)*
