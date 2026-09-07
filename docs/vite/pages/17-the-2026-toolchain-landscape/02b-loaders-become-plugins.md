---
title: "Loaders Become Plugins: a Different Interface, and the Four Things a Hasty Port Drops"
sidebar_label: "Loaders → Plugins"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API](https://vite.dev/guide/api-plugin), [Migration from v7](https://vite.dev/guide/migration). Vite plugins use the Rollup plugin interface, which Rolldown mirrors — that compatibility is why Vite's plugin ecosystem survived the v8 engine swap. **No sandbox run, no timings.** Target: **Vite 8.2.2 · webpack 5.110.3**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Loaders Become Plugins

This is the fourth of the capabilities that do not transfer, and the one with the most surface area:
a config with forty loaders has forty decisions. Most are resolved by an existing community plugin.
The work is almost never *writing* one — it is **establishing that an existing one fits**, which is
slower than it sounds and is where migration schedules go wrong.

---

## 1. Under-The-Hood Mechanics

### Two interfaces that barely rhyme

```
webpack loader                       Vite / Rollup plugin
──────────────                       ────────────────────
a function: source → source          an object with named hooks
selected by a `test` regex           receives EVERY module id; filters itself
`this.callback(null, code, map)`     returns { code, map } or null
chained via `use: [a, b, c]`         ordered by array position + order: 'pre' | 'post'
`this` is the loader context         `this` is the plugin context (resolve, emitFile, …)
runs only on matched files           `transform` runs on everything you do not skip
```

🔴 **The third row is where ported loaders break.** webpack's `test` regex did the filtering for
you. A `transform` hook does not: it is called for every module in the graph, and returning a value
for one you did not mean to handle **silently replaces it**.

```ts
transform(code, id) {
  if (!id.endsWith('.graphql')) return null;   // 🔴 null = "not mine, pass through"
  return { code: compile(code), map: null };
}
```

`return null` is not optional politeness — it is the contract.

### The four things a hasty port drops

1. **Id filtering** — above. The loudest failure, and the easiest to fix once seen.
2. **Source maps.** A loader calling `this.callback(null, code, map)` was producing one. A ported
   `transform` returning `map: null` silently loses it, and the symptom appears weeks later as
   stack traces pointing at the wrong lines.
3. **HMR handling.** A loader had none to lose; a Vite plugin can implement `handleHotUpdate` and
   frequently should, or edits to that file type do a full reload.
4. **Ordering.** `use: ['style-loader', 'css-loader']` runs **right to left**. A plugin array runs in
   order, adjusted by `order: 'pre' | 'post'`. Porting a chain by preserving the array order
   reverses it.

### Where the plugin interface came from, and why that matters

Vite plugins are **Rollup plugins**, and Rolldown deliberately mirrors the Rollup plugin interface.
That is the reason the Vite 8 engine swap — *"Vite 8 uses Rolldown and Oxc based tools instead of
esbuild and Rollup"* — did not detonate the plugin ecosystem: the compatibility surface that
survived the rewrite was the **interface**, not the implementation.

The practical consequence for a migration is that your search space is larger than it looks. A
plugin written for Rollup, with no Vite in its name, frequently works — and the Rollup ecosystem is
older and deeper than Vite's.

### Estimating loader work honestly

```
find a candidate plugin        ~1 hour
read its source                ~2 hours
verify it matches YOUR inputs  the rest of the days
```

The verification is the work: does it produce the same output for the edge syntax the old loader
supported, possibly by accident, and that some file in your codebase relies on? "Find a plugin" is a
one-hour estimate for a multi-day task, and it is the single most common reason a loader-heavy
migration overruns.

---

## 2. Real-World Engineering Scenario

**One line of config, four days, and the answer was "yes".**

A team's webpack config had one line for a custom `.graphql` loader written in 2021. The migration
plan allotted half a day: "find the Vite plugin".

Finding it took an hour. Then:

- **Day 1** — read the plugin's source. It compiled documents differently: the old loader inlined
  imported fragments at build time, the plugin emitted an AST and resolved fragments at runtime.
  Same result for most files. Not obviously the same for all.
- **Day 2** — found the seventeen files using `#import` fragment syntax and checked each against
  both implementations.
- **Day 3** — found the one that differed: a fragment imported transitively through two files,
  which the old loader flattened and the plugin resolved lazily, changing when a validation error
  surfaced.
- **Day 4** — decided the new behaviour was acceptable, wrote it down, and moved on.

**The plugin fitted. Establishing that was the whole cost.** Nobody wrote a line of plugin code.

The generalisable point is that a loader is not a line of config — it is a **behaviour some code
depends on**, and the dependency is invisible until you diff two implementations against your actual
inputs. That is why `grep -c 'loader'` is the estimate and the line count is not.

---

## 3. Production-Grade Code Example

```typescript
// A webpack loader, rewritten as a Vite plugin. The shapes barely rhyme.

// ── BEFORE: webpack loader — a function from source to source ─────────────────
// module.exports = function (source) {
//   const map = this.sourceMap ? buildMap(source) : null;
//   this.callback(null, `export default ${JSON.stringify(parse(source))}`, map);
// };
// // ...selected by:  { test: /\.graphql$/, use: 'graphql-loader' }

// ── AFTER: Vite plugin — hooks on an object, filtered by module id ────────────
import type { Plugin } from 'vite';

export function graphqlPlugin(): Plugin {
  return {
    name: 'graphql',

    // 🔴 `transform` receives EVERY module. The `test` regex is now YOUR job,
    //    and `return null` means "not mine" — omit it and you replace the module.
    transform(code, id) {
      if (!id.endsWith('.graphql')) return null;
      const { code: out, map } = compile(code, id);
      return { code: out, map };            // ⚠️ map: null silently loses source maps
    },

    // The loader had no equivalent of this. Without it, editing a .graphql file
    // triggers a full page reload instead of an HMR update.
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.graphql')) return;
      server.ws.send({ type: 'full-reload' });   // or a targeted module invalidation
    },
  };
}
```

```typescript
// Ordering: a webpack `use` chain runs RIGHT TO LEFT. A plugin array does not.
// vite.config.ts
export default defineConfig({
  plugins: [
    // ❌ Preserving webpack's array order reverses the pipeline.
    // use: ['style-loader', 'css-loader']  ran css-loader FIRST.
    //
    // ✅ Order explicitly. `pre` runs before Vite's core transforms,
    //    `post` after — which is usually what a "final rewrite" loader wanted.
    { ...myPreprocessor(), enforce: 'pre' },
    react(),
    { ...myFinalRewrite(), enforce: 'post' },
  ],
});
```

```bash
# The loader audit. Each line is a decision, not a line of config.
grep -oE "use: *\[?'[^']+'" webpack.config.js | sort -u
grep -oE "loader: *'[^']+'" webpack.config.js | sort -u

# For each one, in order of decreasing likelihood:
#   1. Vite does it natively now      (babel/ts/css/sass/file/url — most of the list)
#   2. An official @vitejs plugin exists
#   3. A community VITE plugin exists
#   4. A community ROLLUP plugin exists — often overlooked, and usually works
#   5. Write one — budget the id filter, the source map, and handleHotUpdate
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — A `transform` hook with no id filter

webpack's `test` regex is gone and nothing replaced it. A hook that returns a value for every module
replaces every module, and the failure is spectacular rather than subtle — which is the good case.

### ⚠️ Pitfall 2 — Returning `map: null` because it compiled

The loader was producing a source map and the port stopped. Nothing fails; stack traces quietly
point at the wrong lines, and the connection to the migration is lost by the time anyone notices.

### ⚠️ Pitfall 3 — Estimating loader work as "find the plugin"

Finding takes an hour. Establishing that it matches your inputs takes days. This single mis-estimate
accounts for most loader-heavy migration overruns.

### ⚠️ Pitfall 4 — Preserving `use:` array order

webpack chains run right to left. Copying the order into a plugin array reverses the pipeline, and
the symptom is a transform applied to already-transformed output.

### ⚠️ Pitfall 5 — Searching only for "vite plugin"

Vite plugins *are* Rollup plugins. The Rollup ecosystem is older and deeper, and a plugin with no
Vite in its name frequently works unchanged.

### ⚠️ Pitfall 6 — Forgetting `handleHotUpdate`

A loader had no HMR to lose. A plugin that omits the hook turns every edit to that file type into a
full reload, which reads as "Vite's HMR is bad" rather than as a missing hook.

---

## Gotchas

**★ Symptom: a custom webpack loader has no Vite equivalent and the migration stalls.** Cause: Vite plugins use the Rollup plugin interface, so the loader is reimplemented rather than adapted. Fix: search for an existing plugin first — including Rollup plugins — and budget days for establishing that it fits.

**★ Symptom: a hand-written Vite plugin transforms every file, including ones it should ignore.** Cause: webpack's `test` regex did the filtering; a `transform` hook does not. Fix: filter on `id` yourself and `return null` for anything that is not yours.

```ts
transform(code, id) { if (!id.endsWith('.graphql')) return null; /* … */ }
```

**★ Symptom: a source map points at the wrong lines after a custom plugin lands.** Cause: the `transform` hook returned `map: null` or no map. Fix: return a real source map, or accept and document the loss — a webpack loader using `this.callback(null, code, map)` was producing one, and the port routinely drops it.

**★ Symptom: editing one file type always triggers a full page reload.** Cause: the plugin has no `handleHotUpdate`. Fix: implement it. The loader it replaced had no HMR at all, so nothing was lost in the port — but the expectation changed, and users read the gap as Vite being slow.

**★ Symptom: a transform runs on already-transformed output and produces nonsense.** Cause: a `use:` chain's right-to-left order was copied into a plugin array as-is. Fix: reverse it, and use `enforce: 'pre' | 'post'` where the intent was "before/after everything else" rather than a specific neighbour.

**★ Symptom: the plugin works in dev and its output is missing from the build.** Cause: a hook that only runs in one of the two pipelines, or an `apply: 'serve'` left from a template. Fix: check `apply`; a plugin restricted to `serve` or `build` is doing exactly what it was told.

**★ Symptom: no "vite plugin" exists for a file type and the team plans to write one.** Cause: searching the wrong ecosystem. Fix: search Rollup plugins too — Vite plugins are Rollup plugins, and that ecosystem is older and larger. This is the highest-value thirty minutes in a loader migration.

**★ Symptom: a plugin's transform is skipped for files inside `node_modules`.** Cause: dependency pre-bundling handles those on a different path, so a plugin expecting to see every module does not. Fix: check `optimizeDeps.exclude` for the package, and be explicit about whether the plugin is meant to touch dependencies at all — most are not.

**★ Symptom: two plugins fight and the outcome depends on the config file's formatting.** Cause: ordering is array position plus `enforce`, and neither was stated. Fix: set `enforce` deliberately on anything order-sensitive. Relying on array position is a convention that survives exactly until someone alphabetises the list.

---

## Interview questions

**★ How does a webpack loader differ from a Vite plugin, structurally?**
A loader is a function from source to source, selected by a `test` regex and chained through a `use`
array that runs right to left. A Vite plugin is an object of hooks — `resolveId`, `load`,
`transform`, `handleHotUpdate` — ordered by position in the plugin array and by an explicit
`enforce`, and `transform` receives every module id, so **the plugin does its own filtering**. That
last difference causes the most bugs in a port: a `transform` that forgets to `return null` for ids
it does not handle silently replaces modules it was never meant to touch. They also differ in what
they are expected to return — a loader's `this.callback` carried a source map that a hastily ported
`transform` usually drops.

**★ You have four days and a `.graphql` loader to replace. How do you spend them?**
Not writing a plugin. Searching first — including the Rollup ecosystem, since Vite plugins *are*
Rollup plugins — and then spending the bulk of the time on the question that actually decides it:
does the existing plugin produce the same output for *our* inputs, including the edge syntax the old
loader supported by accident and that some file relies on. That verification is the work, and it is
why "find a plugin" is a bad estimate: finding takes an hour and being confident takes days. If
nothing fits, a `transform` hook is genuinely small — but budget the parts that are easy to forget:
id filtering, the `null` pass-through, a real source map, and `handleHotUpdate`.

**★ Why did Vite's plugin ecosystem survive the Rolldown swap?**
Because the compatibility surface that was preserved is the **interface**, not the implementation.
Vite plugins are Rollup plugins, and Rolldown deliberately mirrors the Rollup plugin API — so
*"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup"* was an engine change
rather than an ecosystem reset. It is a genuinely instructive piece of design: a project replaced its
core in a different language and shipped it as a list of renamed options, because the thing everyone
had built against was a contract rather than a codebase. The same reasoning is why the v8 migration
guide is mostly renames.

**★ A plugin works in dev and its output is missing from the build. What are the candidates?**
Three, in order of likelihood. An `apply: 'serve'` restriction, often copied from a template, which
does exactly what it says. A hook that only participates in one pipeline — `configureServer` has no
build-time counterpart, and a plugin doing its real work there has nothing to contribute to a build.
Or dependency pre-bundling, if the modules in question live in `node_modules`, which are handled on
a different path and may never reach the plugin. All three are quick to check and all three present
identically, which is why it is worth having the list rather than debugging from first principles.

**★ Two plugins interact badly and the behaviour changes when the config is reformatted. What is wrong?**
Ordering is implicit. Plugin order is array position, adjusted by `enforce: 'pre' | 'post'`, so a
pipeline whose correctness depends on position is one alphabetisation away from breaking — and the
change that breaks it will look like formatting. The fix is to make the intent explicit with
`enforce` wherever order matters, and it generalises past Vite: any system where ordering is
semantic needs the ordering *stated*, because the next person's editor does not know it was load
bearing.

---

← [Three With No Equivalent](02a-the-four-that-do-not-transfer.md) · [Vite overview](../../README.md) · Next → [The Adjacent Toolchain](03-the-adjacent-toolchain.md)
