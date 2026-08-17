---
title: "Wiring the checks in"
sidebar_label: "08 · Wiring the checks in"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **publint's published rule list** on publint.dev
> (rule names and descriptions quoted exactly), the **`arethetypeswrong` CLI
> documentation** for `--pack` and `--profile`, and the **TSConfig reference**
> for the compiler options named. **No sandbox, no console blocks** — no tool was
> run here, and no output is reproduced.

[Chunk 07](./07-the-problem-catalogue.md) is what can be wrong. This is how you
find out, and — more importantly — how you arrange never to have to remember to.

## The two tools answer different questions

They are complementary, not alternatives, and running only one leaves a real gap.

| | `arethetypeswrong` (`attw`) | `publint` |
|---|---|---|
| **Question** | *"Can a consumer resolve and use your types, from every resolution mode?"* | *"Is this `package.json` correct and complete?"* |
| **Method** | Resolves your entrypoints as a consumer would, under each mode | Lints the manifest and the published file tree |
| **Catches** | The masquerades, the export-form mismatches, resolution failures | Condition ordering, missing and unpublished files, format contradictions |
| **Misses** | A manifest that is malformed but self-consistent | Anything requiring actual resolution |

```bash
npx @arethetypeswrong/cli --pack .
npx publint
```

### 🔴 `--pack` is not optional

It runs `npm pack` first, so the analysis is of the **tarball** — exactly what a
consumer receives. Without it you are checking your working tree, which contains
files the published package will not.

That is the only way to catch a `types` target excluded by `files` or
`.npmignore`, which [chunk 03](./03-exports-and-the-types-condition.md) flagged
as indistinguishable from a typo. `publint` reports the same class separately as
`FILE_NOT_PUBLISHED` — *"File exists locally but won't be included in npm
package"* — and the fact that both tools have a dedicated answer for it tells you
how often it happens.

### `--profile node16` is how you record a decision

If you have decided not to support `moduleResolution: node10`
([chunk 07](./07-the-problem-catalogue.md)), this ignores the issues that only
affect it.

📌 **Prefer it to silencing rows one at a time.** A profile flag in a script is a
scope decision anyone can read; a list of suppressed cells is a list nobody
revisits.

## `publint`'s rules, mapped to this topic

Several of its **error** rules are the earlier chunks mechanised — which is a
good sign that those chunks are describing real constraints rather than
preferences:

| Rule | What it enforces | Chunk |
|---|---|---|
| `EXPORTS_TYPES_SHOULD_BE_FIRST` | *"Types condition must be the first condition in exports"* | [03](./03-exports-and-the-types-condition.md) |
| `EXPORTS_DEFAULT_SHOULD_BE_LAST` | The other half of condition ordering | [03](./03-exports-and-the-types-condition.md) |
| `EXPORTS_TYPES_INVALID_FORMAT` | *"Type files must match their context (ESM vs CJS) via extension or package.json"* | [01](./01-the-one-rule.md), [04](./04-dual-esm-cjs.md) |
| `TYPES_NOT_EXPORTED` | *"TypeScript cannot locate types for exported modules"* | [02](./02-how-a-consumer-finds-your-types.md) |
| `FILE_DOES_NOT_EXIST` | A `types` target that is not there | [03](./03-exports-and-the-types-condition.md) |
| `FILE_NOT_PUBLISHED` | The `files`/`.npmignore` trap | this chunk |
| `FILE_INVALID_EXPLICIT_FORMAT` | *"File format contradicts its extension (.mjs/.cjs)"* | [04](./04-dual-esm-cjs.md) |
| `EXPORTS_VALUE_INVALID` | Values must start with `./` | [03](./03-exports-and-the-types-condition.md) |
| `NESTED_PACKAGE_JSON_FIELD_IGNORED` | ⚠️ `exports`/`imports` in a nested manifest are **ignored by Node** | [04](./04-dual-esm-cjs.md) |
| `EXPORTS_MISSING_ROOT_ENTRYPOINT` | Root entrypoint missing while `main`/`module` exist | [02](./02-how-a-consumer-finds-your-types.md) |

🔴 **`NESTED_PACKAGE_JSON_FIELD_IGNORED` is a genuine trap for
[chunk 04](./04-dual-esm-cjs.md)'s answer 1.** The nested `dist/cjs/package.json`
marker is legitimate and necessary — but it may carry **only** `"type"`. Putting
`exports` in it does nothing at all, silently, and this rule is the only thing
that will tell you.

📌 **Two more error rules worth knowing** even though they are not type-specific:
`EXPORTS_MODULE_SHOULD_PRECEDE_REQUIRE` (ordering again) and `LOCAL_DEPENDENCY`
— *"Dependencies using file: or link: protocols will fail for end-users"*, which
is the classic "worked in the monorepo" publish failure.

### Its suggestions are worth one read

Not correctness issues, but each removes an ambiguity a consumer would otherwise
have to guess at: `USE_TYPE` (declare your module format explicitly rather than
letting it be inferred), `USE_FILES` (ship only what you mean to),
`USE_ENGINES_NODE`, and `USE_SIDE_EFFECTS` (let bundlers tree-shake).

`USE_TYPE` in particular is cheap insurance for everything in
[chunk 04](./04-dual-esm-cjs.md) — an explicit `"type"` means nobody has to work
out what your bare `.js` and `.d.ts` files are.

## Wire it into `prepublishOnly`, not into your memory

```jsonc
// package.json
{
  "scripts": {
    "build":         "tsc -p tsconfig.esm.json && tsc -p tsconfig.cjs.json",
    "check:types":   "tsc --noEmit -p tsconfig.build.json",
    "check:package": "attw --pack . && publint",
    "prepublishOnly": "npm run build && npm run check:types && npm run check:package"
  }
}
```

🔴 **The two checks are not redundant, and the order is the argument:**

1. **`check:types`** runs with `skipLibCheck: false`
   ([topic 10 chunk 08](../10-skiplibcheck/08-choosing-it.md)) so **your own
   declarations** are validated — the artefact the flag would otherwise exclude.
2. **`check:package`** validates that a consumer can **reach** them.

Chunk 07's "internal resolution error" is precisely the failure that step 1
catches early and step 2 catches late. Neither substitutes for the other, and a
package that runs only step 2 is trusting declarations nothing has checked.

⚠️ **`prepublishOnly` rather than a CI-only step**, because this is exactly the
class of mistake made on the run where somebody was in a hurry. A check that
blocks the publish is worth more than one that annotates a build.

📌 **CI should run them too**, on pull requests — a `prepublishOnly` failure is a
bad moment to discover a regression that landed three weeks ago.

## The manual check, when you want to see it yourself

The tools are better and faster. Building this once is still worth ten minutes,
because it makes the rest of the topic concrete:

```
/scratch/consumer-esm/     package.json   { "type": "module" }
                           tsconfig.json  { "module": "nodenext",
                                            "moduleResolution": "nodenext" }
                           index.ts       import x from 'your-pkg'

/scratch/consumer-cjs/     package.json   { "type": "commonjs" }
                           tsconfig.json  same
                           index.ts       import x = require('your-pkg')
```

🔴 **Install the packed tarball, never a link:**

```bash
npm pack                                  # → your-pkg-1.0.0.tgz
cd /scratch/consumer-esm && npm i ../../your-pkg-1.0.0.tgz && npx tsc --noEmit
```

`npm link` and workspace links resolve through the **source** layout, so they
bypass `exports`, `files` and the built output — every mechanism this topic is
about. A linked package that works tells you nothing.

📌 Add a third consumer with `"moduleResolution": "node10"` if you support that
audience. It is the cheapest way to see what chunk 07's `node10` column is
actually reporting.

## Gotchas

**Symptom:** Validation passes and the published package is broken.
**Cause:** You validated the working tree, not the tarball.
**Fix:** `--pack`, always.

**Symptom:** `npm link` was used to test and everything worked.
**Cause:** A link resolves through the source layout, bypassing `exports`,
`files` and the build output.
**Fix:** Install the packed tarball into a scratch consumer.

**Symptom:** `exports` was added to a nested `dist/*/package.json` and has no
effect.
**Cause:** Node ignores `exports`/`imports` in nested manifests.
**Fix:** Only `"type"` belongs there — `NESTED_PACKAGE_JSON_FIELD_IGNORED`.

**Symptom:** CI runs both tools and nobody reads the output.
**Cause:** They were added as an informational step.
**Fix:** `prepublishOnly`, so a failure blocks the publish.

**Symptom:** `publint` passes and `attw` fails.
**Cause:** A self-consistent manifest that still does not resolve to the right
declarations. They ask different questions.
**Fix:** Run both. Neither is a superset.

**Symptom:** `attw` passes and consumers report errors inside your `.d.ts`.
**Cause:** `attw` checks that types are *reachable*, not that they are
*internally correct*.
**Fix:** That is `check:types` with `skipLibCheck: false`. Step 1, not step 2.

**Symptom:** A published package fails for end users with a `file:` dependency
error.
**Cause:** `LOCAL_DEPENDENCY` — a `file:`/`link:` protocol dependency left in
from monorepo development.
**Fix:** Real version ranges before publishing.

**Symptom:** `node10` issues are noisy and get individually ignored.
**Cause:** Suppressing cells rather than declaring scope.
**Fix:** `--profile node16`, which states the decision once and readably.

**Symptom:** A regression is found at publish time and nobody knows when it
landed.
**Cause:** The checks run only in `prepublishOnly`.
**Fix:** Run them on pull requests as well. `prepublishOnly` is the backstop, not
the feedback loop.

## Interview questions

**★ What do `arethetypeswrong` and `publint` each check, and why run both?**
`attw` resolves your entrypoints as a consumer would under every resolution mode
and reports mismatches between what the types imply and what resolves. `publint`
lints the manifest and the published tree — condition ordering, missing or
unpublished files, format contradictions. Neither is a superset: a manifest can
lint clean and still fail to resolve, and vice versa.

**★ Why must you pass `--pack`?**
Because it packs the tarball first, so the analysis covers exactly what consumers
receive. Otherwise you are checking your working tree, and a `types` target
excluded by `files` or `.npmignore` is invisible.

**★ Why does testing with `npm link` fail to reproduce packaging bugs?**
Because a link resolves through the source layout rather than the published one,
bypassing `exports`, `files` and the built output — which is every mechanism that
can be wrong here.

**★ You run `attw` and it passes. What has it not told you?**
That your declarations are internally correct. It checks reachability. Whether
the `.d.ts` files themselves type-check is a separate build with
`skipLibCheck: false` — and that is the check that catches "internal resolution
error" early.

**Why put the checks in `prepublishOnly` rather than only in CI?**
Because a failing publish is the failure mode you want; a failing CI annotation
gets merged past. Run them in CI too, so regressions are found when they land
rather than at release.

**What belongs in a nested `dist/*/package.json`?**
Only `"type"`. Node ignores `exports` and `imports` in nested manifests, and
`publint` reports it as `NESTED_PACKAGE_JSON_FIELD_IGNORED` — otherwise the
mistake is silent.

**What is `LOCAL_DEPENDENCY` and why does it matter at publish time?**
A dependency using the `file:` or `link:` protocol, left over from local
development. It resolves for you and fails for every end user.

**How do you record a decision not to support `node10`?**
`--profile node16` on the CLI, in the script, so the scope decision is visible
and revisitable — rather than suppressing individual cells nobody will look at
again.

---

← Prev: [07 · The problem catalogue](./07-the-problem-catalogue.md) · Next → [09 · The checklist](./09-the-checklist.md)
