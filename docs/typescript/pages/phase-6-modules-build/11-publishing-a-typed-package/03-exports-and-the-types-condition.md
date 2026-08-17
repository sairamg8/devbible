---
title: "`exports` and the `types` condition"
sidebar_label: "03 · exports and the types condition"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** — *Modules → Reference*,
> whose statements about which conditions TypeScript matches, the ordering rule
> and the `types@{selector}` form are quoted verbatim, along with its
> `exports` example. The `--traceResolution` message text is read from the
> compiler's own diagnostic table in the installed **TypeScript 5.9.3** build.
> **No sandbox, no console blocks.**

`exports` is the authoritative step from
[chunk 02](./02-how-a-consumer-finds-your-types.md). This chunk is what
TypeScript does inside it, which is narrower and stricter than most people
assume.

## The two conditions TypeScript always matches

> *"TypeScript always matches the `"types"` and `"default"` conditions if
> present."*

That is the whole of TypeScript's condition vocabulary for finding declarations.
It does **not** invent a condition of its own, it does not match `node`, and it
does not match `browser` — those are matched or not by whoever is doing the
resolution around it. What TypeScript adds is `types`, and it takes `default` as
the fallback.

Plus one more form:

> *"TypeScript matches versioned types conditions in the form
> `"types@{selector}"` according to `"typesVersions"`-compatible version-matching
> rules."*

So `"types@>=5.0"` is legal and is matched by the same semver machinery as
`typesVersions` — which [chunk 06](./06-typesversions.md) covers, including why
the condition form is the better one.

## 🔴 The ordering rule

> *"The `"types"` condition should be listed first in the conditions object to
> take precedence."*

Conditional exports are matched **in object key order**, first match wins. So
`types` listed after `default` never matches, because `default` matches
everything.

```jsonc
// ❌ types never wins
{ "exports": { ".": {
    "default": "./index.js",
    "types": "./index.d.ts"          // unreachable
} } }

// ✅
{ "exports": { ".": {
    "types": "./index.d.ts",
    "default": "./index.js"
} } }
```

⚠️ **This is a silent failure, not an error.** The package resolves fine, the
consumer gets the `.js` file, and TypeScript falls back to extension
substitution — which may even find the right `.d.ts` and mask the mistake
entirely until the day it does not.

## The nesting, and why it is the shape it is

[Chunk 01](./01-the-one-rule.md) ended on the fixed dual-package map. Here it is
again, because this chunk is about reading it precisely:

```json
{
  "name": "pkg",
  "exports": {
    "./subpath": {
      "import": {
        "types": "./types/subpath/index.d.mts",
        "default": "./es/subpath/index.mjs"
      },
      "require": {
        "types": "./types/subpath/index.d.cts",
        "default": "./cjs/subpath/index.cjs"
      }
    }
  }
}
```

Read it as a decision tree the resolver walks:

1. Is this an `import` or a `require`? — that branch is chosen by the *consumer's*
   syntax, not by anything you control.
2. Inside the chosen branch, `types` first: the declaration file **for that
   format**.
3. `default`: the implementation.

🔴 **The nesting is the golden rule expressed as JSON.** One `types` per format
branch, because one declaration file per JavaScript file. A `types` hoisted to
the top level is one declaration file claiming both branches — which is exactly
[chunk 01](./01-the-one-rule.md)'s "Masquerading as ESM".

## When a single top-level `types` *is* correct

Be precise, because over-correcting produces cargo-cult nesting:

```json
{
  "exports": { ".": {
    "types": "./dist/index.d.ts",
    "browser": "./dist/index.browser.js",
    "default": "./dist/index.js"
  } }
}
```

This is **fine**. `browser` and `default` here are two builds of the *same module
format* with the same API — so one declaration file genuinely does represent both
accurately enough, and there is no format claim to get wrong.

> **The test is not "how many conditions?" It is "do any two of them resolve to
> files of different module formats?"** If no, one `types` is correct and simpler.

## No extension substitution after a `types` match

From [chunk 02](./02-how-a-consumer-finds-your-types.md), restated because it
bites hardest here:

> *"When the `"types"` condition is matched, TypeScript returns that path
> directly."*

So the path must be exact — right extension, right file, present in the published
tarball. There is no forgiving second lookup. A `types` entry pointing at
`./dist/index.d.ts` in a package that publishes `./dist/index.d.mts` fails
outright.

📌 That makes `files`/`.npmignore` part of this topic's surface: a `types` target
excluded from the tarball is indistinguishable, to a consumer, from a typo.
[Chunk 08](./08-wiring-the-checks-in.md) is how you catch it.

## Reading a failure with `--traceResolution`

The compiler narrates `exports` resolution, and the messages are specific enough
to diagnose from directly:

| Code | Message |
|---|---|
| **6276** | *"Export specifier '{0}' does not exist in package.json scope at path '{1}'."* |
| **6271** | *"Import specifier '{0}' does not exist in package.json scope at path '{1}'."* |
| **6273** | *"package.json scope '{0}' has no imports defined."* |
| **6274** | *"package.json scope '{0}' explicitly maps specifier '{1}' to null."* |
| **6275** | *"package.json scope '{0}' has invalid type for target of specifier '{1}'"* |
| **6272** | *"Invalid import specifier '{0}' has no possible resolutions."* |
| **6270** | *"Directory '{0}' has no containing package.json scope. Imports will not resolve."* |

🔴 **`TS6276` is the one you will meet most**, and it is precise: the subpath is
not in the map. That is the "adding `exports` is a breaking change" failure from
chunk 02, seen from the compiler's side.

📌 **`TS6274` deserves a note** — mapping a specifier to `null` is a deliberate
way to *block* a subpath, and the compiler reports it distinctly from "not
found". If you are pruning a legacy surface on purpose, `null` says so and the
diagnostic proves it was intentional.

⚠️ **Two more from the resolver, both `Message`-level, both about fallbacks:**
`TS6277` (*"Resolution of non-relative name failed; trying with modern Node
resolution features disabled…"*) and `TS6279` (the same for
`--moduleResolution bundler`). Seeing either in a trace means the compiler is
already in recovery mode — the honest read is that your map did not work, and it
is guessing.

## Gotchas

**Symptom:** `types` is in the `exports` map and the consumer still gets `any`.
**Cause:** It is listed after `default`, so it never matches.
**Fix:** Put `types` first in every conditions object. First match wins.

**Symptom:** Reordering to put `types` first changed nothing.
**Cause:** Extension substitution was already finding the right `.d.ts` from the
JavaScript path.
**Fix:** Still correct it — it was working by accident and will stop the moment
the file layout changes.

**Symptom:** A `types` condition points at a file that exists locally and fails
for consumers.
**Cause:** It is not in the published tarball.
**Fix:** Check `files`/`.npmignore`, and validate the packed artefact rather than
the working tree. Chunk 08.

**Symptom:** Every condition was given its own nested `types` and the map is
unreadable.
**Cause:** Over-applying the dual-package shape.
**Fix:** Nest only where two conditions resolve to *different module formats*.
Same format can share one `types`.

**Symptom:** `TS6276` in a `--traceResolution` log.
**Cause:** The subpath is not in the `exports` map.
**Fix:** Add it, or add a `"./*"` pattern. This is the breaking-change failure.

**Symptom:** A subpath is mapped to `null` and someone treats it as a bug.
**Cause:** `null` is the deliberate way to block a subpath, and `TS6274` reports
it as such.
**Fix:** Intentional. If it should not be blocked, remove the mapping.

**Symptom:** `TS6277` or `TS6279` appears and the resolution eventually succeeds.
**Cause:** The compiler fell back to a legacy or bundler algorithm after your map
failed.
**Fix:** It succeeded by luck. Fix the map — the fallback is diagnostic
generosity, not a supported path.

**Symptom:** `"types@>=5.0"` was written and someone flagged it as invalid JSON
key syntax.
**Cause:** It looks unusual but is a documented form.
**Fix:** It is matched by `typesVersions`-compatible rules. Chunk 06.

**Symptom:** The package works under `bundler` resolution and not under
`nodenext`.
**Cause:** Bundler resolution is more forgiving about conditions and extensions.
**Fix:** Validate under every resolution mode a consumer might use — which is
precisely what chunk 08's tooling automates.

## Interview questions

**★ Which `exports` conditions does TypeScript match?**
`types` and `default`, plus versioned `types@{selector}` forms matched by
`typesVersions`-compatible semver rules. It does not add a condition of its own
beyond `types`, and it does not decide `node`/`browser`/`import`/`require` — the
surrounding resolution does.

**★ Why must `types` be listed first?**
Conditions match in key order and first match wins, so anything after `default`
is unreachable. The failure is silent — the consumer just gets the JavaScript
path and whatever extension substitution finds.

**★ When does a dual package need a `types` inside each of `import` and
`require`?**
Whenever the two branches resolve to files of different module formats, which for
a real dual package they always do. A single top-level `types` then claims one
format for both and produces "Masquerading as ESM".

**★ Does every condition need its own nested `types`?**
No. The test is whether any two conditions resolve to *differently formatted*
files. A `browser`/`default` pair that are both ESM can share one declaration
file.

**What happens after TypeScript matches a `types` condition?**
It returns that path directly, with no extension substitution — so the path must
be exact and must be present in the published tarball.

**What does `TS6276` tell you?**
That the subpath being imported is not present in the package's `exports` map.
It is the compiler-side view of "adding `exports` blocked a subpath that used to
resolve".

**What does a `null` target in `exports` mean?**
A deliberate block. The compiler reports it as `TS6274` — *"explicitly maps
specifier to null"* — distinctly from "not found", so intent is visible in the
trace.

**You see `TS6277` in a resolution trace. What does that imply?**
That resolution failed under the modern algorithm and the compiler retried with
features disabled to produce a better error. Anything that resolves after that
point resolved in recovery mode, not through your map.

---

← Prev: [02 · How a consumer finds your types](./02-how-a-consumer-finds-your-types.md) · Next → [04 · Dual ESM/CJS](./04-dual-esm-cjs.md)
