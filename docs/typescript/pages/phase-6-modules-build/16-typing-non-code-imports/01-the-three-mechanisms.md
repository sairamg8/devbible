---
title: "The three mechanisms"
sidebar_label: "01 · The three mechanisms"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — the `resolveJsonModule` and `allowArbitraryExtensions`
> option records and the `TS6262`, `TS6263` and `TS2732` message text are read
> out of the compiler's own tables in the installed **TypeScript 5.9.3** build.
> The `declare module` wildcard behaviour is
> [topic 07 chunk 07](../07-authoring-d-ts-files/07-declare-module-and-choosing.md)'s.
> **No sandbox, no console blocks.**

`import styles from './Button.module.css'` is not a TypeScript import. There is
no `.css` file the compiler can read a type from, and yet bundlers have made this
ordinary. TypeScript has **three** different answers, they are not
interchangeable, and picking the wrong one is why this area feels arbitrary.

## The one thing they have in common

🔴 **None of them makes the import work at runtime.** Every one of these is a way
of telling the type system *"something else will handle this specifier"* — a
bundler, a loader, a runtime hook. If nothing does, you get a green build and a
runtime failure.

That is the same shape as
[topic 03's `paths`](../03-path-aliases/README.md) and
[topic 09's `allowSyntheticDefaultImports`](../09-esmoduleinterop-and-default-imports/02-the-two-flags.md):
a type-level assertion about somebody else's behaviour.

## 1. Wildcard `declare module` — the general answer

```ts
// src/globals.d.ts
declare module '*.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.svg' {
  const src: string;
  export default src;
}
```

**What it is:** an ambient module declaration with a wildcard specifier, exactly
as [topic 07 chunk 07](../07-authoring-d-ts-files/07-declare-module-and-choosing.md)
describes. The compiler matches the specifier pattern and uses the declared shape
without looking for a file at all.

⚠️ **Two conditions from topic 07 apply here and are the usual cause of "my
`declare module` does nothing":**

- The declaring file must be a **script**, not a module — no top-level `import`
  or `export` in it, or the declaration is scoped rather than ambient.
- It must be **included in the program**, so `include` has to cover it.

📌 **This is the mechanism most projects use**, because it needs no compiler flag
and works for any extension. Its weakness is precision: every `.css` file in the
project gets the same type, so a CSS-modules setup that generates per-file class
names cannot be represented.

## 2. `allowArbitraryExtensions` — the precise answer

```js
{
  name: "allowArbitraryExtensions",
  type: "boolean",
  affectsProgramStructure: true,
  category: Diagnostics.Modules,
  description: Diagnostics
    .Enable_importing_files_with_any_extension_provided_a_declaration_file_is_present,
  defaultValueDescription: false
}
```

*"Enable importing files with any extension, **provided a declaration file is
present**."* — and the naming convention is the interesting part:

> **For `foo.css`, the compiler looks for `foo.d.css.ts`.**

The compiler narrates it:

```text
TS6262: File name '{0}' has a '{1}' extension - looking up '{2}' instead.
TS6263: Module '{0}' was resolved to '{1}', but '--allowArbitraryExtensions' is
        not set.
```

🔴 **`TS6263` is the useful one** — it means the file was *found* and the flag is
missing, which is a one-line fix. It is a completely different situation from
`TS2307` (nothing found at all).

**Why this beats the wildcard:** the declaration is **per file**, so a CSS-modules
generator can emit `Button.d.css.ts` containing the actual class names:

```ts
// Button.d.css.ts — generated
declare const styles: { readonly button: string; readonly primary: string };
export default styles;
```

Now `styles.buton` is a typo the compiler catches, where the wildcard's
`Record<string, string>` accepts anything.

⚠️ **The cost is that something must generate those files** and keep them
current — which is a build step, and a generated artefact to gitignore or commit.
That trade is [chunk 03](./03-choosing.md)'s.

## 3. `resolveJsonModule` — JSON only

```js
{
  name: "resolveJsonModule",
  type: "boolean",
  affectsModuleResolution: true,
  category: Diagnostics.Modules,
  description: Diagnostics.Enable_importing_json_files,
  defaultValueDescription: false
}
```

JSON is special-cased because TypeScript can do something for it that it cannot
do for CSS: **read the file and infer a type from its contents**.
[Chunk 02](./02-json.md) is entirely about that, including what it costs.

The diagnostic that points at it:

```text
TS2732: Cannot find module '{0}'. Consider using '--resolveJsonModule' to import
        module with '.json' extension.
```

📌 **Note that TypeScript names the flag for you here**, which it does not for
CSS or images — because for those there is no single right answer, and for JSON
there is.

## Which one you want

| Situation | Mechanism |
|---|---|
| Images, fonts, `.txt`, anything opaque | **Wildcard `declare module`** — one shape for all of them is correct |
| CSS modules where class names matter | **`allowArbitraryExtensions`** + a generator |
| CSS imported only for its side effect | **Wildcard**, or nothing at all |
| JSON | **`resolveJsonModule`** |
| A bundler suffix (`?raw`, `?url`) | Wildcard — [chunk 03](./03-choosing.md) |

🔴 **The deciding question is whether the *contents* of the file should affect
the type.** If no — an image URL is a `string` whatever the image is — the
wildcard is right and simpler. If yes, you need per-file declarations.

## Gotchas

**Symptom:** A `declare module '*.css'` has no effect.
**Cause:** The declaring file is a module (it has a top-level `import`/`export`),
so the declaration is not ambient — or it is not in the program.
**Fix:** Remove the top-level import/export; check `include`. Topic 07 chunk 07.

**Symptom:** `TS6263`.
**Cause:** The declaration file exists and the flag is not set.
**Fix:** `allowArbitraryExtensions: true`. This is the good error — the file was
found.

**Symptom:** `TS2732` on a `.json` import.
**Cause:** `resolveJsonModule` is off.
**Fix:** Turn it on. TypeScript names the flag because JSON has one right answer.

**Symptom:** `styles.buton` type-checks.
**Cause:** The wildcard declares `Record<string, string>`, which accepts any key.
**Fix:** Per-file declarations via `allowArbitraryExtensions`, if the class names
matter enough.

**Symptom:** The build is green and the import is `undefined` at runtime.
**Cause:** None of these mechanisms makes the import work — they only describe
it.
**Fix:** Make sure the bundler or loader actually handles the specifier.

**Symptom:** `allowArbitraryExtensions` was enabled and nothing changed.
**Cause:** No `.d.<ext>.ts` files exist — the flag enables the lookup, it does not
create declarations.
**Fix:** Generate them, or use the wildcard instead.

**Symptom:** A generated `.d.css.ts` is stale and the class names are wrong.
**Cause:** Generation is a build step that has to be kept current.
**Fix:** Wire it into the same command that builds; that is the cost of
precision.

**Symptom:** Every non-code import is handled by one giant `globals.d.ts` nobody
maintains.
**Cause:** The wildcard is easy and accretes.
**Fix:** Fine for opaque assets; review it when a shape actually matters.

## Interview questions

**★ What are the three ways to type a non-code import?**
A wildcard `declare module '*.css'`, `allowArbitraryExtensions` with per-file
`foo.d.css.ts` declarations, and `resolveJsonModule` for JSON specifically. They
are not interchangeable — the first gives one shape to every matching file, the
second gives a shape per file, and the third is special-cased because TypeScript
can read the file.

**★ What do all three have in common?**
🔴 None of them makes the import work at runtime. Each is a type-level assertion
that a bundler or loader will handle the specifier. If nothing does, you get a
green build and a runtime failure.

**★ What file does `allowArbitraryExtensions` look for?**
For `foo.css`, it looks for `foo.d.css.ts` — the compiler even narrates the
substitution with `TS6262`. `TS6263` means the file was found but the flag is not
set, which is a one-line fix and quite different from `TS2307`.

**★ When is the wildcard the right answer despite being less precise?**
When the file's contents should not affect the type — an image URL is a `string`
whatever the image is. Per-file declarations only earn their keep when the
contents matter, as with CSS-module class names.

**Why does TypeScript name the flag in `TS2732` but not for CSS?**
Because JSON has one right answer and TypeScript can read the file itself. For
CSS or images there is no single correct shape, so it cannot suggest one.

**Why does a `declare module` sometimes do nothing?**
Because the declaring file is a module rather than a script, or it is not
included in the program — the two conditions topic 07 chunk 07 establishes.

**What does `allowArbitraryExtensions` not do?**
Create declarations. It enables the lookup; something else has to generate the
`.d.<ext>.ts` files and keep them current.

---

← [Topic index](./README.md) · Next → [02 · JSON](./02-json.md)
