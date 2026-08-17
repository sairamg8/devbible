---
title: "Look for types first"
sidebar_label: "02 · Look for types first"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Declaration Files →
> Find and Install Declaration Files* (quoted verbatim), and the **TSConfig
> reference** for `types` and `typeRoots`. 🔴 The scoped-package name mangling is
> read from the compiler source — `mangleScopedPackageName` and
> `mangledScopedPackageSeparator = "__"` in the installed **5.9.3** build.
> **No sandbox, no console blocks.**

Writing a shim is the third option, not the first. Two things are cheaper and
better, and both take a minute to check.

## Option one — the package already ships types

Look before you install anything. A modern package usually carries its own
`.d.ts`, and the handbook is explicit about what that means for you:

> It is worth noting that if the npm package already includes its declaration
> file as described in Publishing, downloading the corresponding `@types`
> package is not needed.

Three ways to check, in increasing order of effort:

```bash
ls node_modules/some-lib/*.d.ts                  # the obvious one
grep -E '"types"|"typings"|"exports"' node_modules/some-lib/package.json
npx tsc --traceResolution 2>&1 | grep some-lib   # what the compiler actually did
```

⚠️ **A package that ships types can still fail to expose them to *you*.** Its
`exports` map may publish types only for some conditions, or only for one module
format. That is a packaging fault on their side and its diagnosis belongs to
[11 · Publishing a typed package](../11-publishing-a-typed-package/README.md) — but the tell is that
`ls` finds a `.d.ts` and the compiler still reports `TS7016`.

📌 **Installing an `@types` package for a library that ships its own types is a
real mistake, not a harmless one.** You end up with two sets of declarations for
one package, usually of different vintages, and which one wins depends on
resolution order. Several long-lived `@types` packages exist only as stubs
saying exactly this.

## Option two — `@types`, and DefinitelyTyped

The handbook:

> Getting type declarations requires no tools apart than npm.

```bash
npm install --save-dev @types/lodash
```

> For the most part, type declaration packages should always have the same name
> as the package name on npm, but prefixed with `@types/`.

### 🔴 The scoped-package exception

*"For the most part"* is carrying weight. A scoped package cannot become
`@types/@scope/pkg` — that is not a valid npm name — so the compiler mangles it,
and the rule is exact:

```js
var mangledScopedPackageSeparator = "__";
function getTypesPackageName(packageName) {
  return `@types/${mangleScopedPackageName(packageName)}`;
}
```

The `/` becomes `__`:

| Package | Types package |
|---|---|
| `lodash` | `@types/lodash` |
| `@babel/core` | `@types/babel__core` |
| `@testing-library/react` | `@types/testing-library__react` |

**Two underscores, and the leading `@` of the scope is dropped.** This is worth
knowing by heart: searching npm for `@types/@babel/core` finds nothing and the
usual conclusion — *"there are no types, I'll write a shim"* — is wrong.

📌 **The compiler will tell you it is doing this** if you ask. With
`--traceResolution` it emits:

> **TS6182:** *"Scoped package detected, looking in '{0}'"*

## Where the compiler looks, and the two options that change it

An `@types` package is special: it is included **without being imported**. The
two options that govern that are worth reading in the compiler's own words:

| Option | Description (from its option record) |
|---|---|
| `typeRoots` | *"Specify multiple folders that act like `./node_modules/@types`."* |
| `types` | *"Specify type package names to be included without being referenced in a source file."* |

The behaviour that follows, and it catches people constantly:

- **By default, every package under every type root is included in the program**
  — you install `@types/node` and `process` is typed everywhere, with no import
  and no config.
- 🔴 **The moment you set `types`, that stops.** `"types": ["node"]` means *only*
  `node`, and every other installed `@types` package becomes invisible. It is
  not an addition to the default; it is a replacement for it.

That is the behaviour behind the `TS2591`-versus-`TS2580` pair in
[chunk 01](./01-reading-the-symptom.md): the compiler says *"and then add 'node'
to the types field in your tsconfig"* precisely when it can see that a `types`
array exists.

⚠️ **`types` is a real tool, not a trap** — it is how you stop a test runner's
globals leaking into production source, and how you keep `@types/node` out of a
browser bundle's type-checking. Just know that setting it once makes every future
`@types` install a two-step operation.

**A name in `types` that does not resolve is its own error:**

> **TS2688:** *"Cannot find type definition file for '{0}'."*

## Option three — and only now

If the package ships nothing, and `@types/<mangled-name>` does not exist, you
write the shim. [Chunk 03](./03-the-shim.md).

Before you do, one last check that is genuinely worth the thirty seconds: **is
the package still the right dependency?** An untyped package in 2026 is often an
unmaintained one, and the cost of a shim recurs forever while the cost of a
migration is paid once. This is a judgement call, not a rule — but it should be
made deliberately rather than skipped.

## And the option after that

The handbook closes its consumption page with it:

> if the declaration file you are searching for is not present, you can always
> contribute one back and help out the next developer looking for it.

That is [chunk 06](./06-the-upstream-fix.md), and it is not an afterthought: a
shim you keep is maintenance you own, and a shim you upstream is maintenance you
hand to the ecosystem.

## Gotchas

**Symptom:** `npm i --save-dev @types/@babel/core` fails, and you conclude no
types exist.
**Cause:** Scoped packages are mangled — the `/` becomes `__` and the leading
`@` is dropped.
**Fix:** `@types/babel__core`. Same for `@types/testing-library__react`.

**Symptom:** You installed an `@types` package and now see duplicate or
conflicting types.
**Cause:** The package already shipped its own declarations, so there are two
sets.
**Fix:** Uninstall the `@types` package. The handbook says explicitly that it is
not needed when the package includes its own.

**Symptom:** You installed `@types/foo` and nothing changed.
**Cause:** `compilerOptions.types` is set, so automatic inclusion is off and
`foo` is not listed.
**Fix:** Add it to the array — which is what `TS2591`'s longer wording is telling
you.

**Symptom:** Adding one entry to `types` broke every other `@types` package.
**Cause:** `types` replaces the default inclusion; it does not add to it.
**Fix:** List everything you need, or remove the option and control scope another
way.

**Symptom:** `TS2688: Cannot find type definition file for 'foo'.`
**Cause:** A name in `types` (or a `/// <reference types="foo" />`) resolves to
nothing.
**Fix:** Install `@types/foo`, correct the name, or drop the entry.

**Symptom:** `ls node_modules/lib/*.d.ts` finds declarations and `TS7016` still
fires.
**Cause:** The package's `exports` map does not expose types for the condition
or module format you are resolving under.
**Fix:** A packaging fault upstream. Confirm with `--traceResolution`; the
workaround is topic 11's territory, not a shim.

**Symptom:** A test runner's globals (`describe`, `it`) are visible in production
source files.
**Cause:** Default inclusion — every `@types` package under every type root is in
the program.
**Fix:** That is what `types` is for. Scope it deliberately, accepting the
two-step cost on future installs.

**Symptom:** `@types/foo` is installed but its version does not match `foo`.
**Cause:** They are separate packages on separate release cycles.
**Fix:** Check the `@types` package's supported range. A mismatch produces types
that describe an API the installed version does not have — which type-checks and
fails at runtime.

**Symptom:** You wrote a shim and later discovered `@types` existed all along.
**Cause:** The mangled name, or searching npm rather than checking what the
compiler looks for.
**Fix:** Delete the shim. Run `--traceResolution` next time — it names every
directory it tried.

## Interview questions

**★ What is the `@types` package for `@babel/core`?**
`@types/babel__core`. Scoped packages are mangled: the leading `@` is dropped and
the `/` becomes a double underscore, because `@types/@babel/core` is not a valid
npm name. Not knowing this is a common route to writing an unnecessary shim.

**★ What does setting `compilerOptions.types` actually do?**
It **replaces** the default, which is "include every package under every type
root without an import". Once set, only the listed packages are included, so
every future `@types` install becomes a two-step operation. It is the right tool
for keeping a test runner's globals out of production source.

**★ How do you check whether a package already ships its own types?**
Look for `.d.ts` files in the package, check `types`/`typings`/`exports` in its
`package.json`, and if it is still unclear run `tsc --traceResolution` and read
what the compiler tried. The handbook is explicit that an `@types` package is not
needed when the library includes its own.

**★ Why is installing `@types/x` for a package that ships types a problem?**
You end up with two sets of declarations for one package, usually of different
ages, and which wins depends on resolution order. Several `@types` packages exist
purely as stubs telling people not to install them.

**What order do you try things in when a dependency has no types?**
Check whether it ships its own; then check `@types/<mangled name>`; then write a
shim; then consider upstreaming it. A shim is the third option, and each earlier
one is cheaper and less to maintain.

**What is `TS2688` telling you?**
That a name in your `types` array or a `/// <reference types="…" />` does not
resolve to a type definition file. It is a configuration error — a name that
points at nothing — not a missing shim.

**Why might an `@types` package be worse than no types at all?**
Because it is versioned separately from the library. An `@types` package that
describes a different major version produces confident, wrong types: the build
is green and the runtime disagrees. Check the supported range before trusting it.

**What is `--traceResolution` good for here?**
It prints every directory the compiler tried, including *"Scoped package
detected, looking in '…'"* (`TS6182`). When you cannot work out why types are or
are not being found, it replaces guessing with the compiler's own account.

---

← Prev: [01 · Reading the symptom](./01-reading-the-symptom.md) · Next → [03 · The shim](./03-the-shim.md)
