---
title: "What a Hook Filter Actually Matches: Three Hooks, a Fixed Set of Keys, AND/OR Rules That Are Not Obvious — and the Vite Ids That Defeat a Correct-Looking Regex"
sidebar_label: "Filter Utilities & Ids"
sidebar_position: 38
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Hook Filters](https://vite.dev/guide/api-plugin), [§ Filtering, include/exclude pattern](https://vite.dev/guide/api-plugin), [§ Rolldown Hooks](https://vite.dev/guide/api-plugin), [§ Path Normalization](https://vite.dev/guide/api-plugin); the per-hook key list and the composition rules are quoted from [Rolldown § Plugin Hook Filters](https://rolldown.rs/apis/plugin-api/hook-filters), the page Vite links to for this feature. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Filter Utilities & the Ids You Match

**[Hook filters](01r-hook-filters.md) explain *why* the `{ filter, handler }` shape exists. This
page is the other half: which hooks accept a filter at all, what each one can filter on, what
happens when you combine two conditions, and — the part that actually costs people an afternoon —
what a Vite module id looks like when your regex meets it. A filter is a pattern matched against a
string you did not choose the shape of. Most "my filter does nothing" reports are not regex bugs;
they are a wrong mental model of that string.**

---

## 1. Under-The-Hood Mechanics

### Which hooks, and which keys

Filtering belongs to the per-module Rolldown hooks. Vite's list of the hooks *"called on each
incoming module request"* is `resolveId`, `load` and `transform` — the same three, which is why
they are the ones worth filtering. Rolldown's hook-filters page states what each accepts:

> *"The following properties are supported by each hook: `resolveId` hook: `id`; `load` hook:
> `id`; `transform` hook: `id`, `moduleType`, `code`"*

| Hook | Filter keys | Matches against |
|---|---|---|
| `resolveId` | `id` | the **unresolved** specifier, as written in the import |
| `load` | `id` | the **resolved** id — including a `\0` prefix if a plugin added one |
| `transform` | `id`, `moduleType`, `code` | the resolved id, the module type, and the source text |

🔴 **`resolveId` and `load` filter different strings.** This is the single most common reason a
virtual-module plugin half-works: `resolveId` sees `virtual:my-module` and `load` sees
`\0virtual:my-module`. Filtering both on the same value guarantees one of them never fires.

Rolldown's page also notes that in the resolve hook the `id` filter must be a `RegExp` and strings
are not allowed. The Vite documentation never shows a string filter anywhere, so the regex form is
the one to write. ⚠️ Vite's own page does not restate this restriction — it is Rolldown's rule,
quoted here from Rolldown's docs.

### The composition rules

Three sentences from the same page decide what a two-part filter means, and none of them is the
default guess:

> *"If multiple values are passed to `include`, the filter matches if **any** of them match."*
> *"If a filter has both `include` and `exclude`, `exclude` takes precedence."*
> *"If multiple filter properties are specified, the filter matches when all of the specified
> properties match."*

So: **OR inside one property's `include`, AND across properties, and `exclude` beats `include`.**
Adding a property always narrows. If you wanted "`.ts` or `.tsx`", that is two values on one
property; if you write `id` and `moduleType`, both must hold.

### `exactRegex` and `prefixRegex`

> *"[`@rolldown/pluginutils`](https://www.npmjs.com/package/@rolldown/pluginutils) exports some
> utilities for hook filters like `exactRegex` and `prefixRegex`. These are also re-exported from
> `rolldown/filter` for convenience."*

The docs name them but never define their expansion. Their use in the documentation's own
virtual-module example — `filter: { id: exactRegex(virtualModuleId) }` — settles the intent:
`exactRegex(x)` means *the id is exactly `x`*, `prefixRegex(x)` means *the id starts with `x`*.
⚠️ **Whether they escape regex metacharacters in their input is not documented and I could not
confirm it** — do not feed either one a user-supplied string and assume it is inert.

Rolldown's hook-filters page additionally documents composable helpers (`and`, `id`, `include`,
`moduleType`) for expressing a filter as an expression rather than an object. Vite's page does not
mention them, so treat them as Rolldown surface you may use rather than Vite-documented API.

### `createFilter` — a different layer, not an alternative

> *"Vite exposes [`@rollup/pluginutils`'s `createFilter`](https://github.com/rollup/plugins/tree/master/packages/pluginutils#createfilter)
> function to encourage Vite specific plugins and integrations to use the standard include/exclude
> filtering pattern, which is also used in Vite core itself."*

| | Hook `filter` | `createFilter` |
|---|---|---|
| Written by | the plugin author | the plugin's **user**, via options |
| Evaluated | before the handler is invoked | in JavaScript, inside the handler |
| Granularity | coarse — "is this even my file type" | fine — the user's `include`/`exclude` globs |
| Purpose | avoid the boundary crossing | honour the standard option surface |

A serious plugin has both. The full treatment of `createFilter`, including the Windows path trap
that makes it silently match nothing, is
[Path Normalization & `createFilter`](01u-path-normalization-and-filters.md).

### The ids you are actually matching

Three shapes defeat an end-anchored extension regex:

1. **A `\0` prefix.** A plugin-owned virtual id is `\0virtual:thing`, so `/\.js$/` and
   `/^virtual:/` both miss it. See [Virtual Modules](01s-virtual-modules.md).
2. **A query suffix.** Vite's own feature set produces ids with trailing queries. ⚠️ The Plugin
   API page does not discuss how hook filters interact with query suffixes, so the defensive
   pattern below is stated as practice, not as a documented rule.
3. **A Windows volume.** *"Vite normalizes paths while resolving ids to use POSIX separators
   ( / ) while preserving the volume in Windows"* — so ids use `/`, but an absolute id starts
   `C:/…`, and a `/^\/src\//` test fails on Windows for a reason that has nothing to do with
   separators.

---

## 2. Real-World Engineering Scenario

A team adds a plugin that instruments every `.ts` module with a coverage shim. The filter is
`{ id: /\.ts$/ }`. In the app it works. In the design-system package it appears to skip about a
fifth of the files, and nobody can see a pattern in *which* fifth.

The pattern is in the ids, not the files. The skipped modules are the ones imported by another
plugin with a query suffix attached, plus two files reached through a virtual entry that carries a
`\0` prefix. The regex is correct about extensions and wrong about ids. Widening it to
`/\.ts($|\?)/` recovers the first group; the second group is not a filter problem at all — those
modules are owned by another plugin and the coverage shim should not be touching them.

The lesson that survives the incident: **before widening a regex, look at the id it failed to match.** Half the time the correct action is to widen the pattern, and half the time the correct action is to accept that the module is not yours.

---

## 3. Production-Grade Code Example

A plugin with all three layers wired: a hook filter that stops the crossing, the backward-compatible
guard, and the user's `include`/`exclude`. It also filters a `resolveId` with `exactRegex`, which
is the only place a filter can be exact rather than approximate.

```js
// vite-plugin-icons/index.js
import { createFilter, normalizePath } from 'vite'
import { exactRegex } from '@rolldown/pluginutils'
import { compileSvgToComponent } from './compile.js'

// Query-tolerant: an id may carry a suffix, and `$` alone would miss it.
const ICON_RE = /\.icon\.svg($|\?)/
const MANIFEST_ID = 'virtual:icon-manifest'

export default function icons(options = {}) {
  const userFilter = createFilter(options.include, options.exclude)

  return {
    name: 'vite-plugin-icons',

    // Exact, because a bare /virtual:icon-manifest/ would also catch
    // 'virtual:icon-manifest/extra' and the \0-prefixed resolved form.
    resolveId: {
      filter: { id: exactRegex(MANIFEST_ID) },
      handler(id) {
        if (id !== MANIFEST_ID) return null // backward compatibility
        return '\0' + MANIFEST_ID
      },
    },

    transform: {
      filter: { id: ICON_RE },
      handler(code, id) {
        // Required below Rollup 4.38.0 / Vite 6.3.0, where `filter` is ignored.
        if (!ICON_RE.test(id)) return null

        // The user's scope. Normalize the id before a glob comparison —
        // see 01u for why this line is not optional on Windows.
        if (!userFilter(normalizePath(id))) return null

        return { code: compileSvgToComponent(code, { id }), map: null }
      },
    },
  }
}
```

One pattern constant per concern, used by both the filter and the guard. Two copies of a regex drift, and the drift is silent: the filter admits a module the handler then rejects.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Adding a filter to a Vite-specific hook
Filtering is a Rolldown module-hook feature. `config`, `configResolved`, `configureServer` and `transformIndexHtml` are Vite's own hooks and are outside the documented filter surface; scope those with `apply`, `enforce`, or an ordinary conditional inside the hook.

### ⚠️ Pitfall 2 — Expecting a spread to add a filter
The docs show augmenting a third-party plugin by spreading it and adding Vite-only properties. That copies whatever hook shape the original had — spreading cannot add a filter to a bare-function hook, and cannot remove one from an object hook.

### ⚠️ Pitfall 3 — A string filter on `resolveId`
Rolldown's page states the resolve hook's `id` filter must be a `RegExp`. Use `exactRegex(specifier)` rather than inventing a string form and assuming it is compared for equality.

### ⚠️ Pitfall 4 — Using `code` as a cheap content filter
`transform` accepts a `code` filter, and "files containing `useTranslation`" is a tempting condition. Remember the AND rule: adding `code` to an existing `id` filter narrows it, and a module that stops containing the marker silently stops being transformed — with no error, because not matching a filter is the normal case.

### ⚠️ Pitfall 5 — Filtering on the same string in `resolveId` and `load`
`resolveId` matches the specifier; `load` matches the resolved id. For a virtual module those two strings differ by the `\0` prefix, so one of the two hooks will never fire.

---

## Gotchas

**★ Symptom: `filter: { id: /\.js$/ }` never matches `main.js?worker`.** Cause: an id may carry a query suffix, and `$` anchors at end of string. ⚠️ Stated as defensive practice — the Plugin API page does not document filter/query interaction. Fix: tolerate the query.

```js
filter: { id: /\.js($|\?)/ }
```

**★ Symptom: a `transform` filter never fires for your own virtual module.** Cause: the resolved id is `\0`-prefixed, so an extension-shaped or `virtual:`-anchored regex cannot match it. Fix: filter on the resolved form.

```js
filter: { id: exactRegex('\0virtual:my-module') }
```

**★ Symptom: `load` never runs although `resolveId` clearly returned an id.** Cause: both hooks were filtered on the same specifier, but `load` receives the resolved id. Fix: two constants, two filters — the unresolved one for `resolveId`, the `\0`-prefixed one for `load`.

**★ Symptom: a hand-written `filter: { id: /virtual:my-module/ }` also captures `virtual:my-module/sub` and the `\0` form.** Cause: an unanchored regex is a substring test. Fix: `exactRegex(virtualModuleId)` — which is precisely why the utility exists.

**★ Symptom: adding a second filter property makes the hook stop firing entirely.** Cause: *"If multiple filter properties are specified, the filter matches when all of the specified properties match."* Fix: if you meant OR, pass multiple values to `include` on one property, which ORs.

**★ Symptom: an `exclude` added "just in case" disables the plugin completely.** Cause: *"If a filter has both `include` and `exclude`, `exclude` takes precedence."* Fix: narrow the `exclude`; widening the `include` cannot rescue it.

**★ Symptom: a `filter` on `transformIndexHtml` or `configResolved` has no effect.** Cause: those are Vite-specific hooks, not Rolldown module hooks — the documented filter surface is `resolveId`, `load`, `transform`. Fix: use `apply` for the command and a conditional inside the hook.

```js
apply: 'build',
transformIndexHtml(html, ctx) {
  if (!ctx.filename.endsWith('index.html')) return
  return html
}
```

**★ Symptom: `import { exactRegex } from 'rolldown/filter'` resolves in the repo that developed the plugin and not in a consumer's.** Cause: that specifier is documented as a convenience re-export; whether `rolldown` is resolvable depends on the consumer's install layout, which the docs do not guarantee. Fix: for a published plugin, depend on `@rolldown/pluginutils` directly so resolution does not rest on someone else's hoisting.

**★ Symptom: an `id` regex written with `\\` matches nothing on Windows.** Cause: *"Vite normalizes paths while resolving ids to use POSIX separators ( / ) while preserving the volume in Windows."* Fix: write `/` in the pattern, and normalize the *other* side of any comparison — see [Path Normalization & `createFilter`](01u-path-normalization-and-filters.md).

**★ Symptom: a filter and its in-handler guard disagree after a refactor.** Cause: the regex was duplicated rather than shared, and only one copy was updated. Fix: one module-scope constant referenced by both — the filter and the guard are two uses of one decision, not two decisions.

---

## Interview questions

**★ Which hooks accept a filter, and what can each one filter on?**
Per Rolldown's hook-filters page, `resolveId` and `load` filter on `id`, and `transform` filters on
`id`, `moduleType` and `code` — the three per-module hooks, which is the same set Vite lists as
*"called on each incoming module request"*. The subtlety worth naming is that `resolveId` matches
the unresolved specifier while `load` matches the resolved id, so for a virtual module the two
filters must use different strings. Everything else in a plugin — `config`, `configResolved`,
`configureServer`, `transformIndexHtml` — is a Vite-specific hook outside the filter surface.

**★ You add a `moduleType` condition to a filter that already has an `id`, and the hook stops firing. Why?**
Because properties AND: *"If multiple filter properties are specified, the filter matches when all
of the specified properties match."* Filters narrow monotonically — every property you add can only
remove modules from the matched set. OR lives one level down, inside a single property's `include`,
where *"if multiple values are passed to `include`, the filter matches if any of them match."* And
if both `include` and `exclude` are present, `exclude` wins, so an over-broad `exclude` can disable
a plugin that looks correctly configured.

**★ Why does `exactRegex` exist when you could write the regular expression yourself?**
Because the obvious hand-written form is wrong in a way that is hard to see.
`filter: { id: /virtual:my-module/ }` is a substring test: it matches the id you meant, and also
`virtual:my-module/icons`, and also the `\0`-prefixed resolved form. `exactRegex(virtualModuleId)`
states the intent directly, which is exactly how the documentation's own virtual-module example
uses it. It ships in `@rolldown/pluginutils` and is re-exported from `rolldown/filter`; a published
plugin should depend on the former so resolution does not depend on the consumer's layout.

**★ A colleague's plugin filters on `/\.ts$/` and a user reports it silently skips some TypeScript files. Where do you look?**
At the ids, not the regex. Query suffixes defeat an end-anchor, `\0`-prefixed virtual ids defeat
any extension pattern, and a Windows id carries a volume even after Vite normalises the separators.
The fastest way to see the real strings is `vite-plugin-inspect`, which the Vite docs recommend for
exactly this — *"It allows you to inspect the intermediate state of Vite plugins"* — because
`console.log` inside a handler that is never called tells you nothing. Then decide deliberately:
sometimes the pattern should widen, and sometimes the module belongs to another plugin.

**★ How would you justify converting a working plugin to the filter form, given you cannot benchmark it?**
On the mechanism, not a measurement. The documented purpose of the feature is to avoid unnecessary
hook invocations across the Rust↔JavaScript boundary, and an extension-scoped plugin is by
construction invoked for far more modules than it transforms, so the filter removes calls that
provably could not have done work. That is a behaviour-preserving change with a rationale from the
primary source. A wall-clock number would be *worse* evidence: a dev-server timing is dominated by
everything else in the pipeline and would not isolate the change.

---

← [Hook Filters](01r-hook-filters.md) · [Vite overview](../../README.md) · Next → [Virtual Modules](01s-virtual-modules.md)
