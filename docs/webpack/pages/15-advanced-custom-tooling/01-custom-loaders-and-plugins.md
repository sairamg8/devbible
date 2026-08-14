---
title: "Advanced Tooling: Writing Custom Loaders & Plugins"
sidebar_label: "Advanced Tooling"
sidebar_position: 1
---

# ⚙️ Advanced Tooling: Writing Custom Loaders & Plugins

## 1. Under-The-Hood Mechanics

### Custom Loaders: The `this` Loader Context
A loader is a function receiving `source` and running with a special `this` context (the "loader context") exposing utilities beyond just the source string: `this.callback(err, content, sourceMap, meta)` for full control over the result, `this.resourcePath` (the file being processed), `this.emitFile()` (to emit an additional output file, e.g. an extracted asset), and `this.getOptions()` (validated against an optional JSON schema).

### Custom Plugins: `compiler` vs `compilation`, and Tapable Hook Timing
The **Compiler** object represents the entire Webpack environment and lifecycle (config, plugins, filesystem) — it exists once per `webpack()` invocation. The **Compilation** object represents one single **build** of the module graph (it's recreated on every rebuild in watch mode) — it holds the actual modules, chunks, and assets for that specific build pass.

```
compiler.hooks.<lifecycle>.tap('MyPlugin', (compiler) => { ... })   ──► compiler-level hooks fire ONCE per invocation
        │
        └── compiler.hooks.thisCompilation.tap(...) ──► gives access to the CURRENT compilation object
                    │
                    └── compilation.hooks.optimizeChunkAssets.tap(...) ──► fires PER REBUILD, once per compilation pass
```
Common hook timing:
- `compiler.hooks.emit` — fires once, synchronously, right before assets are written to disk — the standard place to inspect/modify the final `compilation.assets` map (e.g. injecting a generated manifest file).
- `compilation.hooks.optimizeChunkAssets` — fires during the optimization phase, before minification — appropriate for transformations that should happen before Terser runs.

---

## 2. Real-World Engineering Scenario

**Scenario**: Auto-Generating a `manifest.json` Mapping Logical Names to Hashed Chunk Filenames for a Micro-Frontend Host.
A host application needs to know, at runtime, which exact hashed filename corresponds to each of its dynamically-loaded remote chunks — but content hashes change every build. A custom plugin taps `compiler.hooks.emit`, reads the final `compilation.chunks`, and emits an additional `manifest.json` asset mapping `{ "checkout-widget": "checkout-widget.a1b2c3.js" }` — the host's server-side rendering layer reads this manifest to construct correct `<script>` tags without ever hardcoding a hash.

---

## 3. Production-Grade Code Example

```javascript
// plugins/manifest-plugin.js — custom plugin using compiler.hooks.emit
class ManifestPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('ManifestPlugin', (compilation, callback) => {
      const manifest = {};

      for (const chunk of compilation.chunks) {
        for (const file of chunk.files) {
          if (chunk.name) manifest[chunk.name] = file;
        }
      }

      const manifestJson = JSON.stringify(manifest, null, 2);

      // Adding a NEW asset to the compilation — this is how a plugin emits extra output files
      compilation.assets['manifest.json'] = {
        source: () => manifestJson,
        size: () => manifestJson.length,
      };

      callback();
    });
  }
}

module.exports = ManifestPlugin;
```

```javascript
// loaders/svg-title-loader.js — a custom loader using this.callback for full control, including a source map
module.exports = function svgTitleLoader(source, map, meta) {
  const { title } = this.getOptions();
  const titled = source.replace('<svg', `<svg data-title="${title}"`);

  this.callback(null, titled, map, meta); // pass the sourceMap through untouched — this loader doesn't affect line numbers
};
```

```javascript
// webpack.config.js
const ManifestPlugin = require('./plugins/manifest-plugin.js');

module.exports = {
  plugins: [new ManifestPlugin()],
  module: {
    rules: [
      { test: /\.svg$/, use: [{ loader: require.resolve('./loaders/svg-title-loader.js'), options: { title: 'icon' } }] },
    ],
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Using `compiler.hooks` When `compilation.hooks` Was Needed (or Vice Versa)
```javascript
// ❌ WRONG: compiler.hooks.compilation fires once per compilation START, but reading
// compilation.chunks/assets THIS early is premature — the module graph isn't built yet
compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
  console.log(compilation.chunks); // empty or incomplete at this point in the lifecycle
});

// ✅ CORRECT: compiler.hooks.emit fires once assets are fully computed, ready for inspection
compiler.hooks.emit.tapAsync('MyPlugin', (compilation, callback) => {
  console.log(compilation.chunks); // fully populated
  callback();
});
```

### ⚠️ Pitfall 2: A Loader Silently Dropping the Incoming Source Map
```javascript
// ❌ WRONG: calling the 2-argument callback form drops any source map produced by an EARLIER
// loader in the chain — subsequent devtools stack traces now point at THIS loader's output, not original source
this.callback(null, transformedSource);

// ✅ CORRECT: always forward `map` (and `meta`) through unless this loader deliberately invalidates it
this.callback(null, transformedSource, map, meta);
```

### ⚠️ Pitfall 3: A Custom Plugin Not Declaring `tapAsync`/`tapPromise` for Genuinely Async Work
Using the synchronous `.tap()` API inside a hook callback that then kicks off a Promise without awaiting it (e.g. an async file read) means Webpack proceeds to the next lifecycle stage believing this hook already finished — any assets that plugin meant to add arrive too late, silently missing from the actual emitted output. Async work inside a plugin hook requires `tapAsync` (callback-based) or `tapPromise` (returning a Promise), matching the hook's declared type (`AsyncSeriesHook` vs `SyncHook`) — check the hook's documented type before choosing which `tap*` variant to use.
