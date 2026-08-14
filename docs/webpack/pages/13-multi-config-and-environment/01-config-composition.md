---
title: "Multi-Config & Environment: Composition, `--env`, and Multi-Compiler Builds"
sidebar_label: "Multi-Config & Environment"
sidebar_position: 1
---

# ⚙️ Multi-Config & Environment: Composition, `--env`, and Multi-Compiler Builds

## 1. Under-The-Hood Mechanics

Real-world Webpack configs almost never stay as one static object — they need to differ by environment (dev vs prod) and sometimes by **build target** (a client bundle vs a server bundle for SSR, built in the same command). Two independent mechanisms handle this.

### `webpack-merge`: Splitting Common/Dev/Prod Configs
Rather than one giant config with inline ternaries everywhere (`mode: isDev ? 'development' : 'production'` scattered through 200 lines), `webpack-merge` deep-merges a shared `common.js` base with environment-specific overrides — arrays concatenate, objects merge recursively, later values win for scalars.

```
common.config.js  ─┐
                     ├── webpackMerge() ──► final resolved config
dev.config.js     ─┘   (when NODE_ENV=development)
```

### `--env` Flag & Exporting a Config Function
Instead of a static config object, `module.exports` can be a **function** receiving `(env, argv)` — `env` carries custom `--env key=value` CLI flags, `argv` carries Webpack's own CLI flags (`--mode`, `--config`). This is how a single config file branches its behavior without needing entirely separate files for every permutation.

### Multi-Compiler Configs: An Array of Configs
`module.exports = [clientConfig, serverConfig]` runs **two independent compilations** in one `webpack` invocation — the standard pattern for SSR apps needing both a browser bundle (with DOM-targeted output) and a Node-targeted server bundle (with `target: 'node'`, different externals) built from largely the same source tree.

---

## 2. Real-World Engineering Scenario

**Scenario**: SSR App Needing Both a Browser Bundle and a Node-Targeted Server Bundle, Built Together.
An SSR React app needs a client bundle (hydration JS shipped to the browser) and a server bundle (Node-targeted, used to `require()` and call `renderToString` on the server) — both compiled from mostly the same component source, but with different `target`, different `output.libraryTarget` (the server bundle needs to be `require()`-able as CommonJS), and different `externals` (the server bundle shouldn't bundle `node_modules` at all, since Node can `require()` them directly at runtime). A multi-compiler array config runs both in one `webpack` command, sharing the same `resolve.alias`/loader rules via `webpack-merge` composition.

---

## 3. Production-Grade Code Example

```javascript
// webpack.common.js — shared base
module.exports = {
  module: { rules: [{ test: /\.tsx?$/, use: 'babel-loader', exclude: /node_modules/ }] },
  resolve: { extensions: ['.tsx', '.ts', '.js'], alias: { '@': require('path').resolve(__dirname, 'src') } },
};

// webpack.client.js
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = (env, argv) => merge(common, {
  name: 'client',
  target: 'web',
  entry: './src/client-entry.tsx',
  mode: argv.mode,
  output: { path: require('path').resolve(__dirname, 'dist/client'), filename: '[name].[contenthash:8].js' },
});

// webpack.server.js
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const nodeExternals = require('webpack-node-externals');

module.exports = (env, argv) => merge(common, {
  name: 'server',
  target: 'node', // don't polyfill Node core modules — this runs IN Node
  entry: './src/server-entry.tsx',
  mode: argv.mode,
  externals: [nodeExternals()], // node_modules are require()'d at runtime, not bundled
  output: {
    path: require('path').resolve(__dirname, 'dist/server'),
    filename: 'server.js',
    library: { type: 'commonjs2' },
  },
});

// webpack.config.js — the entry point webpack actually invokes: an array = multi-compiler build
module.exports = (env, argv) => [
  require('./webpack.client.js')(env, argv),
  require('./webpack.server.js')(env, argv),
];
```

```bash
webpack --env production --env apiUrl=https://api.acme.com
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `externals` on the Server Bundle
```javascript
// ❌ WRONG: bundling all of node_modules INTO the server bundle produces a bloated file and can
// break packages with native bindings or dynamic requires that don't survive being bundled at all
module.exports = { target: 'node', entry: './server-entry.tsx' }, // no externals!

// ✅ CORRECT: let Node require() node_modules directly at runtime — only bundle first-party source
module.exports = { target: 'node', externals: [require('webpack-node-externals')()] },
```

### ⚠️ Pitfall 2: `webpack-merge`'s Array Concatenation Surprising Plugin Lists
`webpack-merge` **concatenates** array-valued keys (like `plugins`) rather than replacing them — if `common.js` and `dev.js` both add a `DefinePlugin` instance, the merged config ends up with **two** `DefinePlugin` instances both trying to define the same keys, which can produce confusing "already defined" warnings or apply in an unexpected order. Use `webpack-merge`'s `mergeWithCustomize` with a strategy for keys that should replace rather than concatenate.

### ⚠️ Pitfall 3: A Multi-Compiler Config Where One Compiler's Slow Build Blocks the Other
By default, `webpack` CLI runs array-config compilers **sequentially** unless `parallelism`/a build orchestrator explicitly parallelizes them — a large client bundle compiling before a much smaller server bundle even starts means total build time is the sum, not the max, of both. For CI build-time-sensitive setups, consider running client/server builds as genuinely separate parallel CI steps instead of one combined array config, if wall-clock build time matters more than single-command convenience.
