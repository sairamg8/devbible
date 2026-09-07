---
title: "Virtual Modules Pass Build-Time Information Into Source Files Through Normal ESM Imports, and the NUL-Prefix Convention Is Why DevTools Shows You `/@id/__x00__`"
sidebar_label: "Virtual Modules"
sidebar_position: 39
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Importing a Virtual File](https://vite.dev/guide/api-plugin), [§ Conventions](https://vite.dev/guide/api-plugin), [§ `handleHotUpdate`](https://vite.dev/guide/api-plugin); the convention itself is quoted from [Rolldown § Virtual Modules](https://rolldown.rs/apis/plugin-api#virtual-modules), which the Vite page links to twice. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Virtual Modules

**A virtual module is a module with no file. Your plugin claims a specifier, answers `load` with a
string, and the rest of the toolchain — imports, named exports, tree-shaking, HMR — treats the
result as ordinary code. The convention that makes it work is one character: a leading NUL on the
resolved id, which marks the module as owned by a plugin. That character is also why, the first
time you open the Network panel, you will see a request for something that looks corrupted —
`/@id/__x00__virtual:my-module` — and conclude you have a bug. You do not. That encoding is
documented, it happens only in the browser during dev, and no plugin hook ever sees it.**

---

## 1. Under-The-Hood Mechanics

### What they are for

> *"Virtual modules allow you to pass build time information to the source files using normal ESM
> import syntax."*

That sentence is the whole design goal. Build-time facts — a commit SHA, a generated route table, a feature-flag snapshot, an icon manifest — reach application code as a *module*, not as a string substitution, so everything downstream that understands modules keeps working.

### The two hooks, and the docs' example

Reproduced faithfully from the documentation:

```js
import { exactRegex } from '@rolldown/pluginutils'

export default function myPlugin() {
  const virtualModuleId = 'virtual:my-module'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'my-plugin', // required, will show up in warnings and errors
    resolveId: {
      filter: { id: exactRegex(virtualModuleId) },
      handler() {
        return resolvedVirtualModuleId
      },
    },
    load: {
      filter: { id: exactRegex(resolvedVirtualModuleId) },
      handler() {
        return `export const msg = "from virtual module"`
      },
    },
  }
}
```

Which allows importing the module in JavaScript:

```js
import { msg } from 'virtual:my-module'

console.log(msg)
```

🔴 **The two filters are deliberately different strings.** `resolveId` matches the specifier as
written in the import; `load` matches what `resolveId` returned — the NUL-prefixed form. Filtering
both on `virtualModuleId` is the most common way to build a plugin where `load` never runs. See
[Filter Utilities & Ids](01ra-filter-utilities-and-ids.md).

### Why the `\0` prefix exists

Vite defers the convention to Rolldown — it links *"See [Virtual Modules Convention](https://rolldown.rs/apis/plugin-api#virtual-modules)"*
twice on the same page, once from Conventions and once from this example. Rolldown states it:

> *"Internally, plugins that use virtual modules should prefix the module ID with `\0` while
> resolving the id, a convention from the Rollup ecosystem."*

> *"This prevents other plugins from trying to process the id (like node resolution), and core
> features like sourcemaps can use this info to differentiate between virtual modules and regular
> files."*

So the prefix is a **claim of ownership**, and it buys two things: other plugins and the resolver
leave the id alone, and tooling that must distinguish generated code from files on disk has a
cheap test. ⚠️ **Neither Vite's nor Rolldown's documentation enumerates which plugins actually
honour the convention** — it is described as an ecosystem convention, not an enforced rule, and I
could not confirm any list of conforming tools. Treat it as "the thing well-behaved plugins do",
not as a guarantee about third-party code.

### 🔴 The fact that costs an afternoon: `/@id/__x00__`

> *"In Vite, since `\0` is not a permitted char in import URLs, a `\0{id}` virtual id ends up
> encoded as `/@id/__x00__{id}` during dev in the browser. The id is decoded back before entering
> the plugins pipeline, so this is not seen by plugin hooks code."*

Unpack that, because every clause matters:

- **`\0` is not a permitted char in import URLs.** The dev server serves modules over HTTP, and the
  resolved id has to survive being a URL. NUL cannot.
- **It is encoded as `/@id/__x00__…` during dev in the browser.** So a network request, a
  `console.trace`, a source-tab file name and an error stack will all show you that string. It is
  the correct, documented representation — not corruption, not a double-encoding bug, and not
  something to "fix" by stripping the prefix in `resolveId`.
- **The id is decoded back before entering the plugins pipeline.** Your hooks receive
  `\0virtual:my-module`. A filter, a `startsWith`, a log line inside a hook — all see the NUL form.
  **Never write a hook that matches on `__x00__`**: the encoded form does not exist at that layer.
- **"during dev"** — this is a dev-server transport detail. It is not what the production build
  emits.

The practical consequence for debugging: the encoded string is your best search key when you are trying to work out *which plugin* owns a module you did not recognise, and simultaneously the worst possible string to code against.

### The exception: modules derived from a real file

Rolldown's page carves out a case that catches framework-plugin authors:

> *"Note that modules directly derived from a real file, as in the case of a script module in a
> Single File Component (like a `.vue` or `.svelte` SFC), don't need to follow this convention"*

> *"Using `\0` for these submodules would prevent sourcemaps from working correctly."*

The rule of thumb that follows: **if the content has a real file behind it, keep the real path** — typically with a query suffix identifying the sub-module. NUL is for content that exists nowhere on disk.

---

## 2. Real-World Engineering Scenario

A platform team needs the running app to display its commit SHA, build timestamp and the
feature-flag snapshot that was current at build time. The first implementation used `define` to
substitute globals. It worked, and then it accumulated problems: every consumer needed the global
declared in TypeScript, the values were injected into *every* module that mentioned the token, and
nothing tree-shook — a flag object referenced in one dead branch stayed in the bundle.

Re-cast as `virtual:build-info`, the same data becomes a module. It has named exports, so unused
exports are eligible for tree-shaking like any other module; it has one ambient declaration instead
of a global; and it is *imported*, so the dependency is visible in the module graph rather than
implied by textual substitution. The trade-off is real and worth naming: `define` is a compile-time
string replacement that works with zero plugin code, while a virtual module is a plugin with two
hooks and an id convention to get right. Choose the module when the data has shape — several
exports, a structure, something a consumer might import selectively.

---

## 3. Production-Grade Code Example

```js
// vite-plugin-build-info/index.js
import { execSync } from 'node:child_process'
import { exactRegex } from '@rolldown/pluginutils'

const VIRTUAL_ID = 'virtual:build-info'
const RESOLVED_ID = '\0' + VIRTUAL_ID

export default function buildInfo() {
  return {
    name: 'vite-plugin-build-info',

    resolveId: {
      filter: { id: exactRegex(VIRTUAL_ID) },
      handler(id) {
        if (id !== VIRTUAL_ID) return null // backward compatibility
        return RESOLVED_ID
      },
    },

    load: {
      // Note the DIFFERENT constant: load sees what resolveId returned.
      filter: { id: exactRegex(RESOLVED_ID) },
      handler(id) {
        if (id !== RESOLVED_ID) return null // backward compatibility

        const commit = execSync('git rev-parse --short HEAD').toString().trim()
        return [
          `export const commit = ${JSON.stringify(commit)}`,
          `export const builtAt = ${JSON.stringify(new Date().toISOString())}`,
        ].join('\n')
      },
    },
  }
}
```

Two things this file deliberately does not do — declare its own TypeScript types and keep itself
fresh when `flags.json` changes — are the subject of
[Shipping a Virtual Module](01sa-shipping-a-virtual-module.md).

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Filtering `load` on the unresolved id
The single most common virtual-module bug. `resolveId` fires, returns the NUL-prefixed id, and `load` is filtered on the plain specifier, so it never matches. Two constants, two filters.

### ⚠️ Pitfall 2 — Omitting the `\0` prefix entirely
Without it the id is an ordinary-looking specifier, and per Rolldown the prefix is what *"prevents other plugins from trying to process the id (like node resolution)"*. The failure is another plugin's, reported against yours.

### ⚠️ Pitfall 3 — Using `\0` for a sub-module of a real file
Rolldown is explicit that SFC-style derived modules *"don't need to follow this convention"* and that using it *"would prevent sourcemaps from working correctly"*. Keep the real path; distinguish with a query.

### ⚠️ Pitfall 4 — Treating `/@id/__x00__…` as a defect
It is the documented dev-time URL encoding of a NUL-prefixed id. Stripping the prefix to make the URL "look right" destroys the ownership marker the convention depends on.

### ⚠️ Pitfall 5 — Matching on the encoded form inside a hook
*"The id is decoded back before entering the plugins pipeline, so this is not seen by plugin hooks code."* A hook testing for `__x00__` matches nothing, in dev and in build alike.

---

## Gotchas

**★ Symptom: the Network panel requests `/@id/__x00__virtual:my-module` and it looks corrupted.** Cause: *"since `\0` is not a permitted char in import URLs, a `\0{id}` virtual id ends up encoded as `/@id/__x00__{id}` during dev in the browser."* Fix: nothing — this is correct and dev-only. Do not encode or decode it yourself.

**★ Symptom: `resolveId` clearly runs but `load` never does.** Cause: both hooks were filtered on the same string; `load` receives the resolved, NUL-prefixed id. Fix: two constants.

```js
const VIRTUAL_ID = 'virtual:my-module'
const RESOLVED_ID = '\0' + VIRTUAL_ID
// resolveId → exactRegex(VIRTUAL_ID)   load → exactRegex(RESOLVED_ID)
```

**★ Symptom: `Failed to resolve import "virtual:my-module"`.** Cause: `resolveId` returned nothing for it — the plugin is not in `plugins`, or `apply` excluded it from this command, or the filter does not match the specifier. Fix: confirm the plugin runs, then confirm the filter, then confirm the hook returns the resolved id rather than `undefined`.

**★ Symptom: another plugin rewrites or fails to resolve your virtual id.** Cause: the id was returned without the `\0` prefix, so nothing marks it as plugin-owned — the prefix *"prevents other plugins from trying to process the id (like node resolution)"*. Fix: prefix the id in `resolveId` and match the prefixed form everywhere after.

**★ Symptom: sourcemaps stop working for an SFC's script block after "following the convention".** Cause: the convention was applied to a module derived from a real file — *"Using `\0` for these submodules would prevent sourcemaps from working correctly."* Fix: keep the real path and distinguish the sub-module with a query suffix.

**★ Symptom: a `transform` hook in your own plugin never sees your virtual module.** Cause: the resolved id begins with NUL and has no extension, so an extension-anchored filter cannot match it. Fix: filter `transform` on the resolved id, or do the work in `load` where you already own the content.

**★ Symptom: a hook that logs or matches `__x00__` produces nothing.** Cause: *"The id is decoded back before entering the plugins pipeline, so this is not seen by plugin hooks code."* Fix: match `\0` — the encoded form exists only between the browser and the dev server.

---

## Interview questions

**★ Why does the `\0` prefix exist, and what breaks without it?**
It marks the resolved id as owned by a plugin. Rolldown states the effect precisely: it *"prevents
other plugins from trying to process the id (like node resolution), and core features like
sourcemaps can use this info to differentiate between virtual modules and regular files."* Without
it, your id is an ordinary-looking bare specifier, so the resolver and every other plugin are
entitled to try to interpret it — and the resulting failure surfaces inside somebody else's plugin,
which makes it expensive to diagnose. It is a convention rather than an enforced rule, and neither
Vite's nor Rolldown's docs enumerate which third-party tools honour it.

**★ You open DevTools and see a request for `/@id/__x00__virtual:app-config`. Is that a bug?**
No, and it is documented: *"since `\0` is not a permitted char in import URLs, a `\0{id}` virtual
id ends up encoded as `/@id/__x00__{id}` during dev in the browser."* NUL cannot travel in a URL,
so the dev server encodes it for transport. Two consequences follow. First, you will also meet the
string in stack traces and source-tab names, and it is not evidence of corruption. Second — the
part people get wrong — *"the id is decoded back before entering the plugins pipeline, so this is
not seen by plugin hooks code"*: a hook that tests for `__x00__` matches nothing, because at that
layer the id is the NUL form again.

**★ When would you use a virtual module rather than `define`?**
When the build-time data has shape. `define` is a textual substitution: cheap, no plugin, but it
produces a global that every consumer must declare, it is applied wherever the token appears, and
it does not participate in the module graph. A virtual module is real ESM — named exports, one
ambient type declaration, visible edges in the graph, and unused exports eligible for tree-shaking
like anything else. The documented purpose is exactly this: *"Virtual modules allow you to pass
build time information to the source files using normal ESM import syntax."* For a single boolean,
`define` is fine; for a manifest, a route table or a flag snapshot, the module wins.

**★ Which hooks implement a virtual module, and why do their filters differ?**
`resolveId` claims the specifier and returns the resolved id; `load` receives that resolved id and
returns the source text. They filter on different strings because they see different strings — the
docs' own example writes `exactRegex(virtualModuleId)` on one and
`exactRegex(resolvedVirtualModuleId)` on the other, differing by the NUL prefix. Getting this wrong
produces the signature symptom of the whole feature: `resolveId` demonstrably runs, `load` never
does, and the import fails with nothing obviously wrong in the code.

**★ Is there a case where a plugin should deliberately *not* use the `\0` convention?**
Yes — modules derived from a real file. Rolldown says so directly: *"modules directly derived from
a real file, as in the case of a script module in a Single File Component (like a `.vue` or
`.svelte` SFC), don't need to follow this convention"*, and warns that *"Using `\0` for these
submodules would prevent sourcemaps from working correctly."* The distinction is whether something
on disk backs the content. A generated manifest has no file and takes the prefix; an SFC's script
block has a file, and losing that association is what breaks the map back to the original source.

---

← [Filter Utilities & Ids](01ra-filter-utilities-and-ids.md) · [Vite overview](../../README.md) · Next → [Shipping a Virtual Module](01sa-shipping-a-virtual-module.md)
