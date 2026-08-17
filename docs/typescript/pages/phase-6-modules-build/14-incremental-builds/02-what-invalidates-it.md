---
title: "What invalidates it"
sidebar_label: "02 · What invalidates it"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 — 🔴 `toIncrementalBuildInfoCompilerOptions`'s
> `affectsBuildInfo` filter is read from the compiler's own buildinfo serialiser
> in the installed **TypeScript 5.9.3** build. `TS6381` is quoted from the
> numbered message table. **No sandbox, no console blocks.**

Three things invalidate a `.tsbuildinfo`, and they are worth separating because
they have completely different costs and completely different fixes.

## 1. 🔴 A compiler option that `affectsBuildInfo`

Here is the filter, in full:

```js
function toIncrementalBuildInfoCompilerOptions(options) {
  let result;
  const { optionsNameMap } = getOptionsNameMap();
  for (const name of getOwnKeys(options).sort(compareStringsCaseSensitive)) {
    const optionInfo = optionsNameMap.get(name.toLowerCase());
    if (optionInfo?.affectsBuildInfo) {
      (result ||= {})[name] = toReusableCompilerOptionValue(optionInfo, options[name]);
    }
  }
  return result;
}
```

> 🔴 **Only options whose record carries `affectsBuildInfo: true` are written into
> the file** — and therefore only those can be compared on the next run.

That single line is the precise, checkable definition of *"what invalidates the
cache"*, and it makes the question answerable for any flag you care about:

```bash
grep -n -A14 'name: "<option>"' sandbox/ts-p0/node_modules/typescript5/lib/typescript.js
# look for affectsBuildInfo: true
```

**Options that carry it include** `skipLibCheck`, `skipDefaultLibCheck`,
`declaration`, `declarationMap`, `composite`, `tsBuildInfoFile`,
`esModuleInterop` and most of the strictness flags. **`skipLibCheck`'s own source
comment says why it is there** — *"We need to store these to determine whether
`lib` files need to be rechecked"* — and
[topic 10 chunk 07](../10-skiplibcheck/07-the-tsbuildinfo-interaction.md) is the
worked case, including the `!a === !b` truthiness comparison and the CI-thrash
trap it produces.

⚠️ **The corollary is the useful half:** an option *without* `affectsBuildInfo`
can change without invalidating anything. That is correct — such an option cannot
change what the compiler concluded — but it means "I changed a flag and nothing
rebuilt" is often the right outcome rather than a bug.

📌 **Options are stored sorted by name**, so the comparison is order-independent
and reordering your `tsconfig.json` invalidates nothing.

## 2. The compiler version

```text
TS6381: Project '{0}' is out of date because output for it was generated with
        version '{1}' that differs with current version '{2}'
```

Argued in
[topic 13 chunk 02](../13-project-references/02-the-up-to-date-check.md): a
TypeScript upgrade invalidates every project's output, wholesale. Not a bug —
the compiler correctly refuses to trust output it did not produce, and the
buildinfo format itself is not stable across versions.

🔴 **Plan for it in CI**: the first build after a TypeScript bump is a cold one,
and a cache keyed on lockfile content will already handle that correctly, which
is [chunk 03](./03-caching-it-in-ci.md)'s point.

## 3. File content — via `version`, then `signature`

The per-file mechanism from [chunk 01](./01-what-is-in-a-tsbuildinfo.md):

1. A file's `version` (text hash) differs → **that file** is reprocessed.
2. Its `signature` (declaration hash) also differs → everything that references
   it, through `referencedMap`, is reprocessed too.
3. Its `signature` is unchanged → **the cascade stops there.**

> **This is the whole reason incremental builds are fast, and the whole reason
> they sometimes are not.**

### What makes a signature change when you did not mean it to

A function body edit *should* be signature-neutral. It is not, when the public
type is inferred from the body:

```ts
// signature changes with the implementation — every dependent reprocesses
export function parse(input: string) {
  return { ok: true, value: input.trim() };
}

// signature is fixed by the annotation — the body is free to change
export function parse(input: string): ParseResult {
  return { ok: true, value: input.trim() };
}
```

🔴 **So explicit return types on a module's public surface are a build-time
optimisation, not only a style preference.** That is the same argument
[topic 13 chunk 02](../13-project-references/02-the-up-to-date-check.md) makes at
project granularity for `TS6354`, and it is the argument
[15 · `isolatedDeclarations`](../15-isolateddeclarations/README.md) takes to its conclusion.

## The things that invalidate it *accidentally*

These are not real invalidation — they are the check being misled, and the
distinction matters because the fix is different:

- **Timestamps out of order** after a checkout, a cache restore, or an
  `rsync`-style copy that preserves mtimes. Covered in
  [topic 13 chunk 02](../13-project-references/02-the-up-to-date-check.md).
- **A moved `outDir` or config filename**, which changes the derived buildinfo
  path, so the old file is simply not found.
- **Two configs sharing one buildinfo path**, each invalidating the other's
  declaration diagnostics on every run — the CI thrash from topic 10 chunk 07,
  reported as `TS6377` under `tsc -b`.

⚠️ **For all three, `--force` hides the symptom and `--clean` removes the
inconsistent state.** Topic 13 chunk 02 makes the case for treating a `--force`
in CI as a defect marker.

## Gotchas

**Symptom:** A flag changed and nothing rebuilt.
**Cause:** It has no `affectsBuildInfo`, so it is not recorded and cannot be
compared.
**Fix:** Usually correct — that flag cannot change what the compiler concluded.
Check its option record if you are unsure.

**Symptom:** Toggling `skipLibCheck` slows every alternating build.
**Cause:** It has `affectsBuildInfo`, so the declaration-file diagnostics are
invalidated each time.
**Fix:** One buildinfo path per option set — topic 10 chunk 07.

**Symptom:** Everything rebuilds after a TypeScript upgrade.
**Cause:** `TS6381`. The version is recorded and output from another is not
trusted.
**Fix:** Expected. Key the CI cache on the lockfile so it invalidates with the
bump.

**Symptom:** A one-line body change reprocesses half the repo.
**Cause:** The public type is inferred from the body, so the signature moved.
**Fix:** Annotate the exported function's return type.

**Symptom:** Reordering `tsconfig.json` triggered a rebuild.
**Cause:** It should not — options are stored sorted by name.
**Fix:** Something else changed. Compare `tsc --showConfig` before and after.

**Symptom:** The buildinfo is ignored after moving `outDir`.
**Cause:** The default path is derived from `outDir` and the config name.
**Fix:** Expected. Set `tsBuildInfoFile` explicitly if you want it stable.

**Symptom:** A cache restore leaves the build convinced nothing changed.
**Cause:** Restored sources with timestamps older than the outputs.
**Fix:** Restore outputs and buildinfo together, or clean. Chunk 03.

**Symptom:** Someone adds `--force` to make invalidation problems go away.
**Cause:** It bypasses the check entirely.
**Fix:** It also bypasses the benefit, every run. `--clean` once instead.

## Interview questions

**★ What decides whether a compiler option invalidates the incremental cache?**
Whether its option record carries `affectsBuildInfo: true`. The serialiser filters
on exactly that when writing the `options` field, so only those options are stored
and only those can be compared next run.

**★ Give an example and its consequence.**
`skipLibCheck` has it — its source comment says *"We need to store these to
determine whether `lib` files need to be rechecked"* — so flipping it invalidates
the cached declaration-file diagnostics. Two configs that differ on it and share
one buildinfo path invalidate each other on every run.

**★ Why does a TypeScript upgrade invalidate everything?**
`TS6381` — the version is recorded and output generated by a different version is
not trusted. The buildinfo format is not stable across versions either.

**★ What is the difference between `version` and `signature` invalidating?**
A changed `version` reprocesses that file. A changed `signature` reprocesses
everything that references it. If the signature is unchanged, the cascade stops —
which is why an inferred public return type is a build-time cost.

**Does reordering `tsconfig.json` invalidate the cache?**
No. Options are written sorted by name, so the comparison is order-independent.

**A flag changed and nothing rebuilt. Bug?**
Usually not — an option without `affectsBuildInfo` cannot change what the
compiler concluded, so there is nothing to invalidate.

**What are the accidental invalidations, and how do they differ from real ones?**
Out-of-order timestamps, a moved buildinfo path, and two configs sharing one
path. They are the check being misled rather than a genuine change — so
`--clean` once is the fix, not `--force` forever.

---

← Prev: [01 · What is in a `.tsbuildinfo`](./01-what-is-in-a-tsbuildinfo.md) · Next → [03 · Caching it in CI](./03-caching-it-in-ci.md)
