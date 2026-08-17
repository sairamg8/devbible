---
title: "What `paths` does, and what it does not"
sidebar_label: "01 · What `paths` does"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Modules — Reference*,
> the `paths` section — the description, the crash example and the `baseUrl`
> relationship are quoted verbatim. `TS6091` and `TS2792` are from the compiler's
> message table in the installed **5.9.3** build. **No sandbox, no console
> block.**

## What it is

> TypeScript offers a way to override the compiler's module resolution for bare
> specifiers with the `paths` compiler option. While the feature was originally
> designed to be used with the AMD module loader (a means of running modules in
> the browser before ESM existed or bundlers were widely used), it still has uses
> today when a runtime or bundler supports module resolution features that
> TypeScript does not model.

📌 **Note the stated purpose**, because it is narrower than how the feature is
actually used. `paths` exists so TypeScript can *follow* a runtime or bundler
that does something clever. It was never designed as a way to invent a mapping
nothing else implements — which is what a plain `@/*` alias in a `tsc`-built Node
project is.

## The syntax

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@app/*":   ["./src/*"],
      "@config":  ["./src/config/index.ts"],
      "shared/*": ["./packages/shared/src/*", "./packages/shared/dist/*"]
    }
  }
}
```

Three things the syntax tells you:

- **The key may contain at most one `*`**, and it matches the rest of the
  specifier. `@app/db/pool` matches `@app/*` with `*` = `db/pool`.
- **The value is an array**, tried in order. The `shared/*` entry above says
  "prefer the source, fall back to the build" — which is a real technique and a
  real source of editor-versus-build divergence.
- **A key with no `*` matches exactly one specifier**, which is how you alias a
  single module.

The compiler will tell you it is consulting them, in a trace message:

```text
TS6091  'paths' option is specified, looking for a pattern to match module
        name '{0}'.
```

📌 That message only appears under `--traceResolution`, which is the tool for
this whole topic: it shows the pattern being matched, the candidates tried, and
which one won.

## What it does not do — the sentence to memorise

> The `paths` option does *not* change the import path in the code emitted by
> TypeScript. Consequently, it's very easy to create path aliases that appear to
> work in TypeScript but will crash at runtime:
>
> ```json
> {
>   "compilerOptions": {
>     "module": "nodenext",
>     "paths": {
>       "node-has-no-idea-what-this-is": ["./oops.ts"]
>     }
>   }
> }
> ```
>
> ```ts
> // TypeScript: ✅
> // Node.js: 💥
> import {} from "node-has-no-idea-what-this-is";
> ```

🔴 **That example is in the official documentation, with those exact comments.**
The alias name is chosen to make the point unmissable, and it is worth noticing
that the config in it is otherwise perfectly ordinary — `module: nodenext`, one
alias. Nothing about it looks wrong.

This is [topic 01's rule](../01-module-and-moduleresolution/01-the-two-questions.md)
biting: the module specifier is emitted as written. The compiler rewrote its own
*lookup*; it did not rewrite your *string*.

```text
  source                  tsc                          dist/
  ──────                  ───                          ─────
  import {} from          resolves via `paths`         import {} from
    "@app/db"      ──►    → src/db.ts            ──►     "@app/db"   ← unchanged
                          (types: correct)               ↓
                                                       Node: what is "@app/db"?
```

## Where it *is* legitimate

Three cases, and they share a shape: **something else already implements the
mapping, and `paths` is teaching the compiler to agree.**

1. **A bundler with the same aliases configured.** Vite's `resolve.alias`,
   Webpack's `resolve.alias`, esbuild's `alias`. The bundler rewrites the
   specifier during the build, so the emitted bundle never contains it.
2. **`package.json` `"imports"`, mirrored.** Node resolves `#internal/*` natively;
   `paths` is not even needed here if `moduleResolution` supports `"imports"` —
   see [chunk 04](./04-subpath-imports.md).
3. **A runtime with a loader or alias mechanism** — a `tsconfig-paths`-style hook,
   or a framework that installs one. Real, but it means production depends on a
   resolution hook.

⚠️ **The illegitimate case is the common one:** `paths` in a project whose build
is plain `tsc` and whose runtime is plain Node, with nothing implementing the
alias. It works in the editor, it works in `tsc --noEmit`, it passes CI if CI only
type-checks, and it fails on `node dist/index.js`.

## The other direction — `paths` as a workaround

`TS2792` names `paths` as a *fix*, which is worth understanding:

```text
TS2792  Cannot find module '{0}'. Did you mean to set the 'moduleResolution'
        option to 'nodenext', or to add aliases to the 'paths' option?
```

This is the legitimate stopgap use: a dependency whose types the compiler cannot
reach — because its `"exports"` omits a `types` condition, say — can be pointed at
directly with `paths`.

```jsonc
"paths": {
  "broken-pkg/subpath": ["./node_modules/broken-pkg/dist/subpath.d.ts"]
}
```

🔴 **That is safe precisely because it aliases a *type* lookup for a specifier the
runtime already resolves on its own.** The emitted `require("broken-pkg/subpath")`
is untouched and Node handles it. Compare with `@app/db`, where the runtime has
nothing.

📌 The distinction is the whole topic in one line: **aliasing where the runtime
already works is a type fix; aliasing where it does not is a bug you have not met
yet.**

## Gotchas

**An alias that resolves in the editor proves nothing.** *Symptom:* confidence.
*Cause:* the editor uses `tsconfig.json`, which is exactly the thing the runtime
does not read. *Fix:* run the built artefact. This is the single check that
separates the legitimate uses from the broken one.

**`tsc --noEmit` in CI cannot catch it either.** *Symptom:* a green pipeline and a
failing deploy. *Cause:* type checking is the half that works. *Fix:* add one
`node dist/index.js` step, however trivial.

**The array form silently prefers whichever entry resolves first.** *Symptom:* the
editor shows source types and the build uses stale `dist` types, or vice versa.
*Cause:* `["./packages/shared/src/*", "./packages/shared/dist/*"]` resolves to
whichever exists. *Fix:* pick one. Two entries is a convenience that hides which
one you got.

**A `paths` entry survives into your published `.d.ts` and breaks consumers.**
*Symptom:* consumers get `TS2307` for `@app/...`. *Cause:* declaration emit
preserves the specifier, and consumers have no `tsconfig.json` of yours. *Fix:*
libraries should not use convenience aliases at all — see
[chunk 05](./05-the-decision.md).

**More than one `*` in a key is not allowed.** *Symptom:* the pattern never
matches. *Cause:* the key supports a single wildcard. *Fix:* restructure the
alias, or use several entries.

**`paths` is consulted before `node_modules`, so an alias can shadow a real
package.** *Symptom:* a dependency resolves to your source. *Cause:* an alias key
that collides with a package name. *Fix:* prefix aliases distinctively — `@app/`,
`#`, or something no npm package would use.

**The `TS2792` stopgap becomes permanent.** *Symptom:* a `paths` entry pointing
into `node_modules` two years later. *Cause:* it works, so nobody revisits it.
*Fix:* a comment naming the upstream issue, so the next person knows when it can
go.

**Deep-linking into `node_modules` with `paths` bypasses `"exports"`.**
*Symptom:* an import that works today and breaks on a patch release. *Cause:* you
aliased a path the package never promised. *Fix:* acceptable as a stopgap for
*types*; never for a runtime specifier.

## Interview questions

**What does `paths` actually change?**
Module resolution — which file the compiler looks at for a given bare specifier,
and therefore which types you get. It changes nothing about the emitted code: the
specifier string is written out exactly as you typed it.

**Why can a `paths` alias crash at runtime?**
Because the runtime never reads `tsconfig.json`. The compiler resolved
`@app/db` to `src/db.ts` and then emitted `require("@app/db")`, which Node cannot
resolve. The documentation's own example makes the point with an alias called
`node-has-no-idea-what-this-is` and the comments `TypeScript: ✅ / Node.js: 💥`.

**When is `paths` legitimate?**
When something else already implements the same mapping: a bundler with matching
aliases, `package.json` `"imports"` that the runtime resolves natively, or a
loader hook. Its documented purpose is to let TypeScript *follow* a runtime or
bundler that resolves in a way TypeScript does not model — not to invent a
mapping on its own.

**Is aliasing a broken package's types with `paths` the same mistake?**
No, and the difference is the key idea. Pointing `paths` at a `.d.ts` inside
`node_modules` fixes a *type* lookup for a specifier the runtime already resolves
by itself — the emitted `require` is untouched and Node handles it. `TS2792` even
suggests it. Aliasing `@app/db` is different: nothing resolves it at runtime.

**What is the risk of the array form, `["./src/*", "./dist/*"]`?**
Whichever exists wins, so the editor and the build can silently disagree about
whether you are getting source types or built ones. It is a common monorepo
pattern and a common source of "it compiles for me".

**How do you catch an alias bug in CI?**
Run the built artefact — even `node dist/index.js --version`. Type checking
cannot catch it by construction, because the mistake is in the output and the
loader, not in the types.

**Why must a library avoid `paths` aliases?**
Because declaration emit preserves the specifier, so the published `.d.ts` refers
to `@app/...`, and consumers have no `tsconfig.json` of yours that maps it. Every
consumer gets `TS2307`. The mapping must be resolved before publish, or never
introduced.

**An alias key collides with an npm package name. What happens?**
Yours wins — `paths` is consulted ahead of `node_modules` lookups — so the
dependency silently resolves to your source. It is an argument for prefixing
aliases with something no package would use.

---

← [Topic index](./README.md) · Next → [02 · `baseUrl`](./02-baseurl.md)
