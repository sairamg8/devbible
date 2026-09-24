---
name: research-vite-t18-microservices
description: Verbatim primary-source bank for devbible vite topic 18 (microservices architecture / micro-frontends) — server.proxy, backend-integration + manifest, Environment API, Module Federation on Vite, base + renderBuiltUrl, library mode, and the npm version spine. Fetched 2026-09-08. Write every chunk FROM this bank; do not re-fetch per chunk.
metadata:
  type: project
---

# Vite topic 18 research bank — fetched 2026-09-08, session vite-t18

🔴 **do not re-derive.** Six fetches bought this. Companion bank:
[[research-vite-v8-quotes]] (env/modes, `define`, `envDir`/`envPrefix`, `loadEnv`,
NODE_ENV-vs-mode, the v8 Rolldown/Oxc migration lines) — a chunk needing env facts reads
that file, not the network.

🔴 **vite.dev serves an LLM-optimised Markdown twin at `<path>.md`.** Fetch those.

## Version spine — `registry.npmjs.org`, 2026-09-08

| Package | latest | published |
|---|---|---|
| `vite` | **8.2.2** | 2026-08-20 |
| `rolldown` | 1.2.7 | 2026-09-02 |
| `@module-federation/vite` | **1.21.5** | **2026-09-07** |
| `@module-federation/enhanced` | 2.9.0 | 2026-08-24 |
| `webpack` | 5.110.3 | 2026-09-01 |
| `vite-plugin-federation` | 1.0.2 | 2026-06-04 |
| `@originjs/vite-plugin-federation` | **1.4.1** | 🔴 **2025-04-12 — nearly 17 months stale** |
| `single-spa` | 6.0.3 | 2024-09-29 |

🔴 **The stale-package trap, and it is the single most useful fact in this topic.**
`@originjs/vite-plugin-federation` is what most search results and tutorials still name, and
it has not published since **2025-04-12**. `@module-federation/vite` published **yesterday**
(2026-09-07). A team that finds the first one reasonably concludes Module Federation is a
reason to stay on webpack. Already stated on `16/01n-module-federation-migration.md` — keep
the two pages consistent and cross-link rather than restating the whole argument.

⚠️ `single-spa` 6.0.3 dates from 2024-09-29. That is its release cadence, **not** evidence of
abandonment — do not write it up as stale. State the date and stop.

---

## `server.proxy` — <https://vite.dev/config/server-options.md>

**Type:** `Record<string, string | ProxyOptions>`

> *"Configure custom proxy rules for the dev server. Expects an object of `{ key: options }` pairs."*

> *"Extends [`http-proxy-3`](https://github.com/sagemathinc/http-proxy-3#options)."*

- String form — `'/foo': 'http://localhost:4567'` — names the target directly.
- Object form takes `target`, `changeOrigin`, `rewrite` and the rest of `http-proxy-3`'s options.
- `changeOrigin` modifies the origin header on the proxied request.
- `rewrite` transforms the request path before forwarding.
- `configure` hands you the proxy instance for advanced customisation.
- Websockets / socket.io need **`ws: true`**.

🔴 Two security lines, verbatim — both belong on the proxy page:
> *"Exercise caution using `rewriteWsOrigin` as it can leave the proxying open to CSRF attacks."*
> *"Vite does not check the origin of WebSocket requests before proxying."*

### `server.cors` — `boolean | CorsOptions`
> *"Pass an [options object](https://github.com/expressjs/cors#configuration-options) to fine tune the behavior or `true` to allow any origin."*
Setting it to `true` is called out as a security risk.

### `server.origin` — `string`
> *"Defines the origin of the generated asset URLs during development."*

### `server.host` — `string | boolean`
> *"Set this to `0.0.0.0` or `true` to listen on all addresses, including LAN and public addresses."*

### `server.allowedHosts` — `string[] | true`
Hostnames Vite may respond to. A string starting with `.` allows that domain **and its
subdomains**.

### `server.hmr` — `boolean | { overlay?: boolean }`
> *"Set `server.hmr.overlay` to `false` to disable the server error overlay."*

---

## Backend integration + the manifest — <https://vite.dev/guide/backend-integration.md>

> *"If you want to serve the HTML using a traditional backend (e.g. Rails, Laravel) but use Vite for serving assets, check for existing integrations."*

- `build.manifest` — *"generate .vite/manifest.json in outDir"*. The manifest is a
  `Record<name, chunk>`; each entry is a `ManifestChunk` with `file`, `css`, `assets`,
  `isEntry`, `isDynamicEntry`, `imports`, `dynamicImports`.
- `server.origin` exists so *"generated asset URLs will be resolved using the back-end server
  URL instead of a relative path"* — needed when the backend, not Vite, serves the HTML and no
  proxy is configured.

**Dev requires these tags in the backend-rendered HTML:**
```html
<script type="module" src="http://localhost:5173/@vite/client"></script>
<script type="module" src="http://localhost:5173/main.js"></script>
```
For React, the refresh runtime is injected **before** these scripts.

**Production requires, in order:** CSS links for the entry chunk · CSS links for imported
chunks, recursively · the entry `<script>` · optional `modulepreload` links for imports.

⚠️ The page does **not** discuss `base`; `server.origin` is what it names for URL resolution
here. Do not assert otherwise.

---

## Environment API — <https://vite.dev/guide/api-environment.md>

> *"Until Vite 5, there were two implicit Environments (`client`, and optionally `ssr`). The new Environment API allows users and framework authors to create as many environments as needed to map the way their apps work in production."*

The API *formalises the concept of environments in Vite 6*.

```js
export default {
  build: {
    sourcemap: false,
  },
  optimizeDeps: {
    include: ['lib'],
  },
  environments: {
    server: {},
    edge: {
      resolve: {
        noExternal: true,
      },
    },
  },
}
```

```ts
interface EnvironmentOptions {
  define?: Record<string, any>
  resolve?: EnvironmentResolveOptions
  optimizeDeps: DepOptimizationOptions
  consumer?: 'client' | 'server'
  dev: DevOptions
  build: BuildOptions
}
```

> *"The `client` and a server environment named `ssr` are always present during dev."*
During **build**, only `client` is always present; `ssr` appears only when explicitly configured.

🔴 Stability, verbatim — every page touching this API must carry it:
> *"The Environment API is generally in the release candidate phase. We'll maintain stability in the APIs between major releases…"* … *"note that some specific APIs are still considered experimental."*

---

## Module Federation on Vite — <https://module-federation.io/integrations/build-tool/vite.html>

Package: **`@module-federation/vite`**. Install:
```sh
npm add @module-federation/vite --save
```

```ts
import { federation } from '@module-federation/vite';
import mfConfig from './module-federation.config';

module.exports = {
  server: {
    origin: 'http://localhost:2000',
    port: 2000,
  },
  base: 'http://localhost:2000',
  plugins: [federation(mfConfig)],
  build: {
    target: 'chrome89',
  },
};
```

The federation config takes `name`, `filename`, `exposes`, `remotes`, `shared`.

🔴 **The Vite-specific limitations, and they are the whole page:**
> *"Except for the dev option, all options are supported"*
- `build.target` must be **`'chrome89'` or higher** — top-level await.
- > *"You can use 'vite-plugin-top-level-await' plugin"* to support lower browser versions.
- **Dev-mode hot updates for remote modules are on the roadmap and are not supported today.**

⚠️ Note in the example: `base` and `server.origin` are both set to the **absolute origin the
remote is served from**, not a path. That is not decoration — a remote's `remoteEntry.js`
loaded into a host on another origin must emit absolute chunk URLs or the host resolves them
against *its own* origin and 404s. The doc shows it; the doc does not explain it. Say so.

---

## `base`, `renderBuiltUrl`, MPA and library mode — <https://vite.dev/guide/build.md>

### Public base path
> *"If you are deploying your project under a nested public path, simply specify the `base` config option and all asset paths will be rewritten accordingly."*

Asset URLs are rewritten automatically; **dynamic concatenation needs
`import.meta.env.BASE_URL`.** For fully relative output, `{ "base": "./" }` —
> *"This will make all generated URLs to be relative to each file."*

### Advanced base options — 🔴 explicitly experimental
```ts
experimental: {
  renderBuiltUrl(filename, { hostType }) {
    if (hostType === 'js') {
      return { runtime: `window.__toCdnUrl(${JSON.stringify(filename)})` }
    } else {
      return { relative: true }
    }
  },
}
```
> *"The `filename` passed is a decoded URL, and if the function returns a URL string, it should also be decoded."*

### Multi-page app
```js
export default defineConfig({
  input: {
    main: resolve(import.meta.dirname, 'index.html'),
    nested: resolve(import.meta.dirname, 'nested/index.html'),
  },
})
```

### Library mode
> *"When it is time to bundle your library for distribution, use the `build.lib` config option."*
```js
build: {
  lib: {
    entry: resolve(import.meta.dirname, 'lib/main.js'),
    name: 'MyLib',
    fileName: 'my-lib',
  },
  rolldownOptions: {
    external: ['vue'],
    output: {
      globals: {
        vue: 'Vue',
      },
    },
  },
}
```
Output: `es` + `umd` for a single entry, `es` + `cjs` for multiple entries.

### Chunking
> *"You can configure how chunks are split using `build.rolldownOptions.output.codeSplitting`."*
🔴 From [[research-vite-v8-quotes]]: in Vite 8 `output.manualChunks`'s **object form is removed**
and the function form is **deprecated**; `build.rollupOptions` is an alias for
`build.rolldownOptions`.

---

## 🔴 Claims the sources did NOT settle — write these as uncertain or leave them out

1. **Whether `@module-federation/vite` supports Vite 8 / Rolldown specifically.** The
   integration page names no Vite version range, and nothing was probed. Do **not** assert
   "works on Vite 8". State the plugin version and its publish date and say the supported Vite
   range is not documented on the integration page.
2. **How `shared` singleton resolution behaves under Vite's pre-bundling** (`optimizeDeps`).
   Not documented on the integration page. The failure mode (two React copies → broken context
   identity) is a general Module Federation property and may be stated as such; the *Vite
   interaction* may not.
3. **Whether the Environment API can host a federation remote as its own environment.** No
   source connects them. Do not connect them.
4. **`server.proxy` ordering / first-match-wins semantics.** The page does not state it.
5. **Cookie/`SameSite` behaviour through the dev proxy.** `changeOrigin` is documented as
   changing the *origin header*; nothing documents `Set-Cookie` domain rewriting. Describe the
   mechanism from `http-proxy-3`'s documented options only, and mark the rest unspecified.

Related: [[research-vite-v8-quotes]] · [[cursor-vite]] · [[devbible-locks]]
