---
title: "Dev Server Mechanics: Native ESM Serving, HMR & Dependency Pre-Bundling"
sidebar_label: "Dev Server Mechanics"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-06 against the Vite documentation — [HMR API](https://vite.dev/guide/api-hmr), [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# ⚡ Dev Server Mechanics: Native ESM Serving, HMR & Dependency Pre-Bundling

## 1. Under-The-Hood Mechanics

The dev server's core loop: the browser requests a module by URL, Vite intercepts that request, transforms the corresponding source file on the fly, and returns valid ESM — repeated per file, per request, with no whole-app bundling step ever occurring.

```text
Browser: import('./App.tsx')
        │
        ▼
Vite dev server intercepts the request for /src/App.tsx
        │
        ▼
Transforms App.tsx (JSX → JS, TS stripped) ON DEMAND — only because THIS specific file was requested
        │
        ▼
Returns valid ESM to the browser, which then requests App.tsx's OWN imports the same way, recursively
```

### Module Graph Invalidation on File Change
Vite maintains an in-memory module graph tracking which modules import which — when a file changes, only the **affected subgraph** (that module and everything that transitively imports it, up to an HMR boundary) is invalidated and re-transformed; completely unrelated modules elsewhere in the app are untouched, keeping rebuild time proportional to the size of the actual change, not the whole app.

### The HMR API: `import.meta.hot`
```javascript
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // called when THIS module (or a dependency) updates — decide how to apply the new module
  });
  import.meta.hot.dispose(() => {
    // cleanup BEFORE the module is replaced — clear timers, remove listeners, etc.
  });
}
```
Framework integrations (`@vitejs/plugin-react`'s Fast Refresh, Vue's SFC hot reload) wire this API automatically for components specifically — most application code never needs to call `import.meta.hot` directly, but understanding it demystifies what Fast Refresh is actually doing under the hood (the same accept/dispose boundary mechanic covered generally in the [Webpack HMR doc](../../../webpack/pages/09-dev-server-and-hmr/01-dev-server-and-hot-module-replacement.md)).

### `optimizeDeps`: When Pre-Bundling Re-Triggers
Vite automatically re-runs pre-bundling when it detects that the inputs it fingerprints have changed since the last cached run. The documentation names the cache location and the triggers exactly:

> *"Vite caches the pre-bundled dependencies in `node_modules/.vite`."* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

The re-run triggers are **package manager lockfile content**, **patches folder modification time**, **relevant fields in your `vite.config.js`**, and the **`NODE_ENV` value**. A stale or corrupted cache is the most common root cause of "my new dependency isn't working" reports, and the docs give exactly two ways to clear it:

> *"start the dev server with the `--force` command line option, or manually delete the `node_modules/.vite` cache directory."* — [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling)

🔴 **On Vite 8 the pre-bundler is Rolldown, not esbuild** — *"The pre-bundling is performed with Rolldown."* and *"Rolldown is now used for dependency optimization instead of esbuild."* ([Migration from v7](https://vite.dev/guide/migration)). The cache path, the triggers and the `--force` escape hatch are unchanged; only the engine moved.

---

## 2. Real-World Engineering Scenario

**Scenario**: A New npm Dependency Not Taking Effect Despite Being Correctly Installed and Imported.
After adding and importing a new dependency, an engineer saw stale/missing behavior — the dependency appeared correctly in `node_modules` and was imported correctly in source, but Vite's dev server was still serving an outdated pre-bundled version from its `.vite/deps` cache, since the automatic cache-invalidation heuristic (based on lockfile hash) hadn't triggered for this specific change pattern. Deleting `node_modules/.vite` (or restarting with `vite --force`) forced a fresh pre-bundle, resolving the issue immediately — a routine troubleshooting step for exactly this class of stale-pre-bundle symptom.

---

## 3. Production-Grade Code Example

```javascript
// Manual HMR boundary for a non-framework-integrated module (most app code never needs this
// directly — Fast Refresh / Vue SFC hot reload handle component-level HMR automatically)
//
// 🔴 A module-scope `export let count = 0` does NOT survive a hot update: the new instance of
// the module is evaluated from scratch, so the initialiser runs again and the value resets.
// The ONE thing Vite persists is import.meta.hot.data — "The object is persisted across
// successive instances of the same module during HMR."
const state = import.meta.hot ? import.meta.hot.data : {};
state.count ??= 0; // mutate properties — "re-assignment of `data` itself is not supported"

export function increment() {
  state.count++;
  render();
}

function render() {
  document.getElementById('count').textContent = String(state.count);
}

render(); // runs again on every hot update, redrawing from the preserved state

if (import.meta.hot) {
  // Self-accepting: this module handles its own update, so the edit stops here
  // instead of propagating upward and becoming a full page reload.
  import.meta.hot.accept();

  import.meta.hot.dispose(() => {
    // Tear down side effects owned by THIS instance — timers, listeners, observers.
    // Do NOT clear `state`: it is hot.data, and persisting it is the entire point.
  });
}
```

⚠️ **The previous version of this example did not work.** It reassigned `count = count` (a
no-op) and called `newModule.render?.()` on a function the module never exported, then
claimed the result preserved state across the update. It did not. The version above is built
on the mechanism the HMR API documentation actually provides for that job.

```typescript
// vite.config.ts — tuning dependency pre-bundling explicitly
export default defineConfig({
  optimizeDeps: {
    include: ['deeply-nested-esm-package/utils'], // force-include a submodule Vite's scanner might miss
    exclude: ['@my-org/local-workspace-package'], // exclude a monorepo-linked package meant to be served as source, unbundled
  },
});
```

```bash
# The two documented ways to force a completely fresh dependency pre-bundle
vite --force               # the flag the docs name first
rm -rf node_modules/.vite  # the same effect, by hand — the docs name this second
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming HMR "Just Works" for Every Kind of Module Without a Boundary
```javascript
// ❌ WRONG: a plain module with no import.meta.hot.accept() and no framework HMR integration
// falls back to a FULL PAGE RELOAD on change — not a bug, just the correct fallback behavior
// when nothing has claimed responsibility for accepting the update in-place
export const config = { theme: 'dark' };
// editing this file reloads the whole page — expected, since nothing calls accept()

// ✅ AWARENESS: this is fine for most simple modules; reserve manual accept()/dispose()
// for cases where preserving in-memory state across an edit genuinely matters
```

### ⚠️ Pitfall 2: A Monorepo-Linked Local Package Getting Unnecessarily Pre-Bundled
```typescript
// ❌ SUBOPTIMAL: a locally-linked workspace package gets swept into optimizeDeps'
// pre-bundling by default, meaning edits to that package's source require a FULL
// pre-bundle re-run to take effect, rather than Vite's fast per-file dev serving
// (no exclude configured)

// ✅ CORRECT: exclude local, actively-edited workspace packages so they're served
// as unbundled source with instant HMR, same as the app's own first-party code
export default defineConfig({
  optimizeDeps: { exclude: ['@my-org/shared-ui'] },
});
```

### ⚠️ Pitfall 3: Not Clearing `node_modules/.vite` Before Assuming a Real Bug Exists
A surprising number of "Vite is behaving incorrectly" reports trace back to a stale pre-bundle cache rather than an actual bug in application code or Vite itself — clearing `node_modules/.vite`, or restarting with `--force`, is a cheap, fast first troubleshooting step worth trying before spending significant time debugging what looks like inexplicable dependency-related behavior.

---

## Gotchas

**★ Symptom: a counter, a WebSocket, or a cache resets to its initial value on every save, despite `import.meta.hot.accept()` being present.** Cause: accepting an update does not preserve anything. Vite evaluates a **new instance** of the module, so every module-scope initialiser runs again. Fix: move the state onto `import.meta.hot.data`, which is the only thing that crosses the boundary — *"Vite creates one `import.meta.hot.data` object for each module path. The object is persisted across successive instances of the same module during HMR."*

**★ Symptom: you assign `import.meta.hot.data = { count: 0 }` and the state stops persisting.** Cause: the docs are explicit that this is not supported — *"re-assignment of `data` itself is not supported. Instead, you should mutate properties."* Fix: `data.count ??= 0`, never `data = {...}`. The failure is silent: the assignment appears to work within the current instance and simply does not survive the next update, so it reads as "HMR is flaky" rather than "I used the API wrong".

**★ Symptom: module A re-exports from module B, B self-accepts, and A's importers keep seeing the old value.** Cause: accepting makes a module an **HMR boundary**, and the update stops at the boundary — *"importers up the chain from the boundary module will not be notified of the change."* Fix: a module that re-exports its dependencies' bindings is a bad place to self-accept, because the whole point of it is that other modules read through it. Either do not accept there, or call `import.meta.hot.invalidate()` when you detect you cannot actually handle the update in place.

**★ Symptom: you accepted an update but at runtime discover the new module is incompatible with live state.** Cause: `accept()` is a promise you make ahead of time, before you can see what changed. Fix: `import.meta.hot.invalidate()` is the retraction — *"the HMR server will invalidate the importers of the caller, as if the caller wasn't self-accepting."* Calling it inside the accept callback converts a self-accepted update into a propagating one, which is how you get a correct full reload instead of a subtly wrong hot patch.

**★ Symptom: production bundle contains HMR bookkeeping code.** Cause: HMR calls that are not inside a static `if (import.meta.hot)` block cannot be eliminated. The docs open the API reference with exactly this instruction — *"First of all, make sure to guard all HMR API usage with a conditional block so that the code can be tree-shaken in production"*. Fix: keep every `accept`, `dispose`, `invalidate` and `on` call inside the guard, and prefer `import.meta.hot ? … : …` at the top for reading `data` rather than sprinkling optional chaining through the module body.

**★ Symptom: you go looking for `.vite/deps` and it is not where an older article said it was.** Cause: the documented cache location is the directory, not a subpath — *"Vite caches the pre-bundled dependencies in `node_modules/.vite`."* Fix: clear the whole `node_modules/.vite` directory. Targeting a subdirectory you inferred from a blog post is how "I cleared the cache and it still misbehaves" happens.

**★ Symptom: a dependency change is not picked up and none of the four triggers fired.** Cause: the invalidation heuristic fingerprints **package manager lockfile content, patches folder modification time, relevant fields in `vite.config.js`, and `NODE_ENV`** — all cheap proxies for "the dependency graph probably moved". Editing a file inside `node_modules` directly, or changing a package reached through a symlink, moves none of them. Fix: this is precisely the `--force` case, and it is why the fix feels magical: nothing was broken, the cache was simply correct about inputs that did not change.

**★ Symptom: editing a linked monorepo package requires a full pre-bundle before the change shows up.** Cause: it is being treated as a dependency and pre-bundled. Fix: `optimizeDeps.exclude` it, so it is served as unbundled source through the normal dev pipeline with per-file HMR. The mirror-image mistake is also common — a genuinely third-party CommonJS package placed in `exclude` will not be converted to ESM and the browser will fail to import it.

**★ Symptom: a plain config module with no `accept()` triggers a full page reload on every edit.** Cause: nothing claimed responsibility for the update, so it propagated to the root. Fix: this is correct behaviour, not a bug, and usually the right behaviour — a full reload is always safe, whereas a hot patch is only safe if someone wrote code that makes it safe. Reach for a manual boundary only where preserving in-memory state across an edit genuinely earns the complexity.

**★ Symptom: advice you found says esbuild pre-bundles your dependencies.** Cause: that was true through Vite 7. Fix: on Vite 8, *"The pre-bundling is performed with Rolldown."* The observable behaviour — the cache path, the triggers, `--force`, `include`/`exclude` — is unchanged, so the stale advice mostly still *works*; it is only wrong about the reason, which matters the moment you go looking for an esbuild-specific option to tune.

## Interview questions

**★ Exactly what survives a hot module update, and what does not?**
`import.meta.hot.data` survives, and essentially nothing else does. Vite evaluates a fresh instance of the updated module, so every module-scope binding is re-initialised from its initialiser — an `export let count = 0` is `0` again, a `new Map()` is empty again, a module-scope `setInterval` handle is a different handle. The docs give `data` as the persistence mechanism: one object per module path, persisted across successive instances, mutated rather than reassigned. The corollary people miss is that `dispose` exists precisely because the *old* instance's side effects do not disappear on their own — the new instance replaces the module, not the timers and listeners the old one installed on the document.

**★ What does it mean for a module to be an HMR boundary, and what is the cost?**
A module becomes a boundary by calling `import.meta.hot.accept()`. From then on, an update to it stops there rather than propagating up to its importers and ultimately to a page reload. The cost is stated in the docs: *"importers up the chain from the boundary module will not be notified of the change."* So if a boundary module re-exports bindings that its importers hold references to, those importers are now holding stale references and nobody will tell them. This is why framework integrations put the boundary at the component level — a component's importers hold a reference the framework itself re-reads on render, so the framework can make the guarantee that plain modules cannot. `import.meta.hot.invalidate()` is the documented way out when a module discovers at runtime that it should not have accepted.

**★ Why is Vite's rebuild time proportional to the size of the change rather than the size of the app?**
Because the dev server keeps an in-memory module graph of which module imports which, and a file change invalidates only that module and the transitive importers between it and the nearest HMR boundary. Nothing outside that subgraph is re-read or re-transformed. Contrast a bundler-based dev server, whose unit of work is a bundle: even with incremental compilation, the graph it must reason about to emit a correct bundle is the whole graph. The architectural point is that Vite made the browser's own module loader do the graph walking, which lets the server treat every module as independently addressable.

**★ Why is "delete `node_modules/.vite` and restart" such a reliably effective fix?**
Because it removes the only piece of state the dev server carries between runs. Pre-bundling is cached against four fingerprints — lockfile content, patches folder mtime, relevant `vite.config.js` fields, and `NODE_ENV` — and any dependency change that does not move one of those leaves a correct-looking cache that is wrong. That covers editing inside `node_modules`, symlinked and workspace packages, and installs that produced no lockfile delta. Deleting the directory (or `vite --force`, which does the same thing) is not a superstition; it is invalidating a cache whose invalidation heuristic is deliberately cheap.

**★ When would you put a package in `optimizeDeps.exclude`, and what breaks if you get it wrong?**
Exclude packages you are actively editing — a linked workspace package in a monorepo — so they are served as source through the normal per-file dev pipeline and get instant HMR instead of a full pre-bundle round trip on every edit. Getting it wrong in the other direction is the expensive mistake: a genuine third-party dependency shipped as CommonJS, excluded from pre-bundling, is never converted to ESM, and the browser cannot `import` it at all. So the rule of thumb is "exclude things whose source you own and edit; include things the scanner cannot see", and the two lists are not symmetric in how badly they fail.

**Why must HMR calls be wrapped in `if (import.meta.hot)` rather than optional-chained?**
Because the guard is what makes the block statically eliminable. The docs' first instruction on the HMR API page is to guard all usage *"so that the code can be tree-shaken in production"*. `import.meta.hot?.accept(...)` is an expression the bundler has to keep unless it can prove `import.meta.hot` is undefined, whereas `if (import.meta.hot) { … }` collapses to nothing once `import.meta.hot` is substituted as a falsy constant in the production build. It is the same reason `if (process.env.NODE_ENV !== 'production')` is the conventional shape in libraries: the pattern is chosen for what a bundler can delete, not for what reads best.

---

← [Configuration](../03-configuration/01-vite-config-file.md) · [Vite overview](../../README.md) · Next → [Build System](../05-build-system-rollup/01-build-options.md)
