---
title: "Hook Filters Are a Rust↔JavaScript Boundary Optimisation, Which Is Why `{ filter, handler }` Is Now the Documented Hook Shape — and Why the Redundant In-Handler Check Is Still Correct"
sidebar_label: "Hook Filters"
sidebar_position: 37
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Hook Filters](https://vite.dev/guide/api-plugin), [§ Transforming Custom File Types](https://vite.dev/guide/api-plugin), [§ Rolldown Hooks](https://vite.dev/guide/api-plugin), [§ Plugin Ordering](https://vite.dev/guide/api-plugin); cross-checked against [Rolldown § Plugin Hook Filters](https://rolldown.rs/apis/plugin-api/hook-filters). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Hook Filters

**The first plugin anyone copies out of the Vite docs — "Transforming Custom File Types" — no
longer shows `transform(code, id)`. It shows `transform: { filter, handler }`. That is not a
cosmetic rewrite of an example. In Vite 8 the bundler is Rolldown, Rolldown is Rust, your plugin
is JavaScript, and an unfiltered `transform` buys a crossing of that boundary for every module in
the graph. The filter exists so the crossing does not happen. And the docs then tell you to run
the same test *again* inside the handler — which looks like sloppy copy-paste and is in fact the
only thing keeping your plugin correct on the hosts that ignore the filter.**

---

## 1. Under-The-Hood Mechanics

### The documented shape changed

This is the docs' own "Transforming Custom File Types" example, reproduced faithfully:

```js
const fileRegex = /\.(my-file-ext)$/

export default function myPlugin() {
  return {
    name: 'transform-file',

    transform: {
      filter: {
        id: fileRegex,
      },
      handler(src, id) {
        return {
          code: compileFileToJS(src),
          map: null, // provide source map if available
        }
      },
    },
  }
}
```

A hook is now an **object hook**: a `filter` describing when to call, and a `handler` doing the
work. The bare-function form still works — Vite 8 extends Rolldown's plugin interface, and
Rolldown accepts a function where an object hook is expected — but it is no longer what the
documentation demonstrates for the hooks that support filtering.

### Why the shape changed: the boundary

> *"Rolldown introduced a hook filter feature to reduce the communication overhead between the
> Rust and JavaScript runtimes. This feature allows plugins to specify patterns that determine
> when hooks should be called, improving performance by avoiding unnecessary hook invocations."*

Read that as a cost model, not a feature note. Rolldown's graph, resolver and codegen are Rust;
your `transform` is JavaScript. Every invocation is a crossing: the module id and its source are
marshalled out of the Rust runtime into the JS one, your handler runs, and the result is
marshalled back. In a project with a few thousand modules, an unfiltered `transform` pays one such
crossing per module — including every module it was never going to touch.

⚠️ **The docs state the purpose, not the implementation.** They say the feature exists to reduce
Rust↔JS communication overhead *"by avoiding unnecessary hook invocations"*; they do not say where
the pattern is evaluated. The stated purpose only makes sense if the decision is taken *before*
the crossing, but treat the exact evaluation site as unspecified — and never quote a number for
what it saves. There is no published benchmark here and this page does not invent one.

### Contrast with the legacy guard

```js
// Legacy shape: the guard is real, but it runs AFTER the crossing.
transform(code, id) {
  if (!id.endsWith('.my-file-ext')) return null
  return { code: compileFileToJS(code), map: null }
}
```

Both forms skip the *work* for a non-matching module. Only the filter form skips the *call*. That
is the whole difference, and it is why "I already return early" is not an argument against
adopting `filter` — the early return is on the wrong side of the boundary.

### 🔴 The backward-compatibility instruction, and why the redundancy is correct

> *"This is also supported by Rollup 4.38.0+ and Vite 6.3.0+. To make your plugin backward
> compatible with older versions, make sure to also run the filter inside the hook handlers."*

The docs' own example carries both, and the comments in it are the docs':

```js
export default function myPlugin() {
  const jsFileRegex = /\.js$/

  return {
    name: 'my-plugin',
    // Example: only call transform for .js files
    transform: {
      filter: {
        id: jsFileRegex,
      },
      handler(code, id) {
        // Additional check for backward compatibility
        if (!jsFileRegex.test(id)) return null

        return {
          code: transformCode(code),
          map: null,
        }
      },
    },
  }
}
```

**Why this is not sloppiness.** The object-hook form predates the filter feature. A host that
understands object hooks but not `filter` does the only thing it can with an unrecognised key: it
ignores it and calls `handler` for **every** module. The filter then narrows nothing, and without
the in-handler test your "only `.js` files" plugin rewrites every module in the graph. The docs do
not spell out that failure mode; it is the only reading under which their instruction is
necessary, and it is the reading to design for.

**The version boundary is a support matrix, not a warning.** The filter is honoured from Rollup 4.38.0 and Vite 6.3.0. If your plugin's `peerDependencies` range reaches below either number, the redundant check is load-bearing production code — delete it and you ship a plugin that is correct on your machine and wrong on your users'.

⚠️ One more reason to keep it, which the docs leave open: on the dev side the page says only that
*"During dev, the Vite dev server creates a plugin container that invokes Rolldown Build Hooks the
same way Rolldown does it."* It does not separately state that the dev plugin container evaluates
hook filters identically to a build. The in-handler check makes that question moot.

---

## 2. Real-World Engineering Scenario

A design-system team ships `vite-plugin-icons`, which compiles `*.icon.svg` into components. The
first version used a bare `transform(code, id)` with an `endsWith` guard. It worked. Then the
consuming app grew past a few thousand modules and someone asked why a plugin that touches forty
icons shows up in every profile of the dev server.

The answer is structural, not algorithmic: the guard rejects a module *after* the module has
already been handed across the Rust↔JS boundary. Forty icons, thousands of crossings. Rewriting
the hook as `{ filter: { id: /\.icon\.svg$/ }, handler }` removes the crossings for everything
that is not an icon — which is the entire point of the feature per its own documentation.

Then the plugin is published, and the second half of the story starts. Its `peerDependencies` say
`vite: "^5 || ^6 || ^8"`. A consumer on Vite 6.0 gets a host that does not honour `filter`; the
handler is called for every module, and without the in-handler test it now compiles `.ts` files
as SVG. The bug reproduces on none of the maintainers' machines. **This is the failure the docs'
"additional check" prevents**, and it is exactly the line a reviewer deletes as redundant.

---

## 3. Production-Grade Code Example

The mechanism, complete, with the two things that keep the redundancy from being deleted: one
shared pattern constant, and the docs' comment kept as the reason.

```js
// vite-plugin-icons/index.js
import { compileSvgToComponent } from './compile.js'

// One definition, used by both the filter and the guard. Two copies drift,
// and the drift is silent: the filter admits what the handler rejects.
const ICON_RE = /\.icon\.svg$/

export default function icons() {
  return {
    name: 'vite-plugin-icons',

    transform: {
      // Honoured by Rollup 4.38.0+ / Vite 6.3.0+ — no boundary crossing
      // for a module that does not match.
      filter: {
        id: ICON_RE,
      },
      handler(code, id) {
        // Additional check for backward compatibility: on an older host the
        // `filter` key above is ignored and this runs for every module.
        if (!ICON_RE.test(id)) return null

        return {
          code: compileSvgToComponent(code, { id }),
          map: null,
        }
      },
    },
  }
}
```

The user-facing `include`/`exclude` layer that belongs on top of this — and the id shapes that make `ICON_RE` itself the interesting part — are in [Filter Utilities & the Ids You Match](01ra-filter-utilities-and-ids.md).

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Deleting the in-handler check because "the filter already does that"
It is the most reviewable-looking line in the file and the one that must survive. Keep the docs'
own comment — `// Additional check for backward compatibility` — so the next reviewer sees the
reason instead of an apparently dead branch.

### ⚠️ Pitfall 2 — Believing a filter changes ordering
It does not. Ordering is `enforce` at the plugin level and `order` at the hook level:
*"Note that this is separate from hooks ordering, those are still separately subject to their
`order` attribute as usual for Rolldown hooks."* A filter decides **whether**, never **when**.

### ⚠️ Pitfall 3 — Measuring the change to justify it
There is no sanctioned benchmark for what a filter saves, the saving depends entirely on graph
size and hook cost, and a dev-server wall-clock reading is dominated by everything else Vite is
doing. Adopt the filter because it is the documented shape and it removes calls that were never
going to do work — not because you produced a number.

---

## Gotchas

**★ Symptom: a plugin with a correct-looking `filter` transforms every module in the graph.** Cause: the host is older than Rollup 4.38.0 / Vite 6.3.0 and ignores the unrecognised `filter` key, calling `handler` unconditionally. Fix: keep the docs' redundant test inside the handler.

```js
handler(code, id) {
  if (!jsFileRegex.test(id)) return null
  return { code: transformCode(code), map: null }
}
```

**★ Symptom: the hook never runs at all after converting it to the object form.** Cause: the function was left under a key other than `handler` — `transform: { filter, transform() {} }` is an object with two ignored keys, not an object hook. Fix: the callable must be named `handler`.

**★ Symptom: two plugins both filter on the same extension and one appears to win.** Cause: filters do not order anything; you are seeing `enforce` and hook `order`. Fix: set the ordering explicitly and stop reasoning about it through filters.

```js
transform: { filter: { id: /\.md$/ }, order: 'pre', handler(code, id) { /* … */ } }
```

**★ Symptom: you cannot tell whether the filter is doing anything.** Cause: nothing in the plugin API reports filter hits or misses, and there is no documented counter to read. Fix: the docs' own recommendation — *"When learning, debugging, or authoring plugins, we suggest including [vite-plugin-inspect](https://github.com/antfu/vite-plugin-inspect) in your project"* — inspect which modules actually reached your transform rather than inferring it from a wall-clock number.

**★ Symptom: a reviewer "simplifies" the object hook back to `transform(code, id)` and every test still passes.** Cause: on a current host the two forms are functionally identical — the only difference is calls that no longer happen, and no test asserts on a call that does not happen. Fix: treat the hook shape as API surface in review, and keep the filter and the guard adjacent so the pair reads as one deliberate decision rather than two redundant ones.

---

## Interview questions

**★ Why is a hook filter not simply sugar for `if (!id.endsWith('.svg')) return null`?**
Because the two guards sit on opposite sides of a runtime boundary. Vite 8 extends Rolldown's
plugin interface, and Rolldown is Rust while your plugin is JavaScript, so calling `transform`
means marshalling the id and source across runtimes and marshalling a result back. The docs state
the feature exists *"to reduce the communication overhead between the Rust and JavaScript
runtimes… by avoiding unnecessary hook invocations."* The early return still runs — after the
crossing has already been paid. The filter is the only one of the two that can prevent the call.

**★ The documentation tells you to repeat the filter test inside the handler. Isn't that dead code?**
Only on a host that honours the filter. The docs are explicit: *"This is also supported by Rollup
4.38.0+ and Vite 6.3.0+. To make your plugin backward compatible with older versions, make sure to
also run the filter inside the hook handlers."* An older host that understands object hooks but
not `filter` ignores the unknown key and calls the handler for every module, so on that host the
in-handler test *is* the filter. Whether it is dead code is therefore decided by your
`peerDependencies` range, not by your local dev server — and deleting it produces a bug that
reproduces on nobody's machine on the team that shipped it.

**★ Vite 8 extends Rolldown's plugin interface rather than Rollup's. Name one thing that changes for a plugin author.**
The filter feature is the clearest one: it exists because Rolldown's core is Rust, so a hook call
is a cross-runtime call rather than a function call, and the API grew a way to avoid making it.
The knock-on effects are conventions as well as code — the docs now recommend the
`rolldown-plugin-` prefix for plugins that use no Vite-specific hooks, point at Rolldown's plugin
documentation as prerequisite reading, and route the virtual-module convention through Rolldown's
docs. A plugin written against Rollup still works when it meets the compatibility criteria, but
the shape the documentation teaches is Rolldown's.

**★ A colleague adds a filter to fix a plugin-ordering bug. What do you tell them?**
That filters answer *whether*, and never *when*. Ordering is two separate mechanisms: `enforce` at
the plugin level, which slots the plugin into Vite's fixed resolution order, and the hook's own
`order` attribute — *"Note that this is separate from hooks ordering, those are still separately
subject to their `order` attribute as usual for Rolldown hooks."* Narrowing a filter can make an
ordering bug *appear* to go away by removing one of the two plugins from the contested module,
which is worse than not fixing it, because the bug returns the moment the filter widens again.

---

← [Four Ways to Make a Plugin Conditional](01qa-four-ways-to-make-a-plugin-conditional.md) · [Vite overview](../../README.md) · Next → [Filter Utilities & Ids](01ra-filter-utilities-and-ids.md)
