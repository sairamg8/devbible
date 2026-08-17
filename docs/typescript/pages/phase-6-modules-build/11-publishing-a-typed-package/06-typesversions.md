---
title: "`typesVersions` — and why you probably want the condition instead"
sidebar_label: "06 · typesVersions"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Declaration Files →
> Publishing*, whose two `typesVersions` examples and semver-matching statement
> are quoted verbatim, and *Modules → Reference* for the `types@{selector}`
> condition. The four `--traceResolution` messages and the version-matching code
> path are read from the compiler's own diagnostic table and resolver in the
> installed **TypeScript 5.9.3** build. **No sandbox, no console blocks.**

`typesVersions` ships *different declaration files to different TypeScript
versions*. It is the mechanism DefinitelyTyped uses at scale, it is almost
always the wrong reach for a first-party package, and when you do meet it you
need to be able to read it.

## The two forms

**Redirect a whole directory**, from the handbook verbatim:

```json
{
  "name": "package-name",
  "version": "1.0.0",
  "types": "./index.d.ts",
  "typesVersions": {
    ">=3.1": { "*": ["ts3.1/*"] }
  }
}
```

> *"TypeScript will read from the `ts3.1` folder for TypeScript 3.1+, falling
> back to the `types` field for earlier versions."*

**Or redirect a single file:**

```json
{
  "name": "package-name",
  "version": "1.0.0",
  "types": "./index.d.ts",
  "typesVersions": {
    "<4.0": { "index.d.ts": ["index.v3.d.ts"] }
  }
}
```

Note the shape: **keys are semver ranges, values are `paths`-style maps.** The
mapping syntax is the same `*` substitution you know from
[topic 03 · path aliases](../03-path-aliases/README.md), which is worth knowing
because the failure modes are the same too.

## The matching rules, precisely

> *"TypeScript decides version matches using Node's semver ranges. Order matters
> when fields overlap — the first matching field applies."*

Three consequences, and the compiler reports each of them:

| Code | Message | What it means |
|---|---|---|
| **6206** | *"'package.json' has a 'typesVersions' field with version-specific path mappings."* | The field was found and will be used |
| **6208** | *"'package.json' has a 'typesVersions' entry '{0}' that matches compiler version '{1}', looking for a pattern to match module name '{2}'."* | 🔴 Names the **winning range**, the compiler version, and the specifier |
| **6207** | *"'package.json' does not have a 'typesVersions' entry that matches version '{0}'."* | No range matched — falls back to `types` |
| **6209** | *"'package.json' has a 'typesVersions' entry '{0}' that is not a valid semver range."* | A typo'd key, silently ignored otherwise |

🔴 **`TS6209` is the one that costs people days.** An unparseable range key does
not fail the build — it is skipped, and the package silently serves whatever the
next matching entry or the `types` fallback provides. The only way to see it is
`--traceResolution`. The compiler literally checks `!VersionRange.tryParse(key)`
and traces.

📌 **The version compared against is the compiler's `major.minor`** — the
resolver matches on `versionMajorMinor`, not the full patch version. So a range
like `>=5.9.3` is not more precise than `>=5.9`; it is a range whose behaviour
you have to think about with the patch component absent.

## 🔴 Prefer `types@{selector}` inside `exports`

From [chunk 03](./03-exports-and-the-types-condition.md):

> *"TypeScript matches versioned types conditions in the form `"types@{selector}"`
> according to `"typesVersions"`-compatible version-matching rules."*

Same matching machinery, better placement:

```json
{
  "exports": {
    ".": {
      "import": {
        "types@>=5.0": "./dist/modern/index.d.mts",
        "types": "./dist/legacy/index.d.mts",
        "default": "./dist/index.mjs"
      }
    }
  }
}
```

**Why this is better than `typesVersions`:**

- It lives **inside the condition it applies to**, so a dual package can version
  its ESM and CJS declarations independently. `typesVersions` is a single
  top-level rewrite and cannot express that.
- It composes with everything else in the map rather than sitting beside it as a
  second, older resolution mechanism that only some consumers read.
- Ordering is the ordinary conditions ordering — **most specific first** — which
  is one rule instead of two.

⚠️ **`typesVersions` is still required for `node10` consumers**, who read neither
`exports` nor its conditions. If you support them, you may need both, and then
you have two version tables to keep consistent — which is itself an argument for
dropping `node10` support.

## When you actually need this

Honestly: rarely, for a first-party package.

**Good reasons:**

- You use a type-system feature from a recent TypeScript and want older
  compilers to get a degraded but working declaration rather than a syntax
  error. `const` type parameters, `satisfies`, `NoInfer`, variance annotations —
  each of these makes a `.d.ts` unparseable to compilers older than the feature.
- You are on DefinitelyTyped, where supporting a wide version range is the
  explicit contract.

**Bad reasons, and they are the common ones:**

- 🔴 *"To be safe."* Every range you add is a declaration set that must be built,
  tested and kept accurate. An unmaintained old branch is worse than no branch —
  it is wrong types delivered confidently.
- *"Our types use a new feature and CI failed on an old TypeScript."* Consider
  simply raising the package's stated minimum TypeScript version in
  `peerDependencies` or the README. That is honest, free, and one line.

> **The default position: state a minimum TypeScript version and ship one set of
> declarations.** Reach for versioned types when you have a concrete consumer on
> an older compiler you have decided to support.

## The failure mode to watch for

A `typesVersions` map that redirects `*` to a directory **replaces the whole
resolution**, so every subpath must exist under the new root. A package that adds
`{ ">=4.0": { "*": ["ts4/*"] } }` and forgets to copy one subpath's declarations
into `ts4/` serves *nothing* for that subpath on modern compilers, while
continuing to work on old ones.

📌 That is the same "the map does not cover everything the old layout did"
failure as chunk 02's `exports` breaking change, and it is caught the same way —
by resolving from outside the package rather than reading the map.

## Gotchas

**Symptom:** A `typesVersions` entry has no effect.
**Cause:** The range key does not parse as semver, so it is skipped silently.
**Fix:** `--traceResolution` and look for `TS6209`. Nothing else reports it.

**Symptom:** Two overlapping ranges and the wrong one wins.
**Cause:** First match applies, in key order.
**Fix:** Order most-specific first. `TS6208` names the entry that matched.

**Symptom:** `>=5.9.3` behaves like `>=5.9`.
**Cause:** Matching is against the compiler's `major.minor`.
**Fix:** Write ranges at minor granularity; patch components are not meaningful
here.

**Symptom:** A `"*": ["ts4/*"]` redirect broke one subpath.
**Cause:** The redirect replaces resolution wholesale — every subpath must exist
under the new root.
**Fix:** Copy them all, or map only the paths that differ.

**Symptom:** `typesVersions` works for some consumers and not others.
**Cause:** `exports` takes precedence where it applies, so a package with both
may never reach the `typesVersions` table.
**Fix:** Use `types@{selector}` conditions inside `exports` and keep
`typesVersions` only for the `node10` audience.

**Symptom:** A dual package cannot version its ESM and CJS declarations
separately.
**Cause:** `typesVersions` is a single top-level rewrite.
**Fix:** `types@{selector}` inside each condition — the reason to prefer it.

**Symptom:** An old TypeScript reports a syntax error inside your `.d.ts`.
**Cause:** You used a type-system feature newer than their compiler.
**Fix:** Either version the declarations, or raise the stated minimum. The second
is usually the right call.

**Symptom:** A versioned declaration set has drifted and now describes an old
API.
**Cause:** Nobody tests the old branch.
**Fix:** Delete it. Wrong types shipped confidently are worse than no versioned
types.

## Interview questions

**★ What does `typesVersions` do?**
Serves different declaration files to different TypeScript versions. Its keys are
semver ranges matched against the compiler's `major.minor`, and its values are
`paths`-style maps — so it can redirect a whole directory (`"*": ["ts3.1/*"]`) or
a single file.

**★ How does TypeScript choose between overlapping entries?**
First match in key order wins, using Node's semver range rules. `TS6208` names
the entry that matched, the compiler version and the specifier, which is the only
reliable way to see it.

**★ What happens if a range key is not valid semver?**
It is skipped silently and resolution falls through. The only signal is `TS6209`
under `--traceResolution` — the build does not fail, so this can go unnoticed
indefinitely.

**★ Why prefer `types@{selector}` conditions over `typesVersions`?**
Because they sit inside the `exports` condition they apply to, so a dual package
can version its ESM and CJS declarations independently — which a single
top-level `typesVersions` rewrite cannot express — and they use the ordinary
conditions ordering rather than a second mechanism.

**When do you still need `typesVersions`?**
For `moduleResolution: node10` consumers, who read neither `exports` nor its
conditions. Supporting both means two version tables to keep consistent.

**When is versioning declarations actually justified?**
When your `.d.ts` uses a type-system feature that older compilers cannot parse
and you have decided to support them. Otherwise, raising the stated minimum
TypeScript version is honest and free.

**What is the risk of adding a version branch defensively?**
It has to be built, tested and kept accurate. An unmaintained branch delivers
confidently wrong types to exactly the consumers least equipped to notice.

**What is the `"*": ["ts4/*"]` trap?**
It replaces resolution wholesale, so any subpath missing from `ts4/` resolves to
nothing on modern compilers while continuing to work on old ones — a failure
only visible from outside the package.

---

← Prev: [05 · `export =` vs `export default`](./05-export-equals-vs-default.md) · Next → [07 · Validating the result](./07-validating-the-result.md)
