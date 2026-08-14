---
title: "Manager UI, Builder Hooks (`viteFinal` / `webpackFinal`), Env & CI"
sidebar_label: "Manager UI, Builder Hooks (`viteFinal` / `"
sidebar_position: 3
---

# 🛠️ Manager UI, Builder Hooks (`viteFinal` / `webpackFinal`), Env & CI

> **Companion to:** [Advanced main & preview customization](./02-advanced-main-and-preview-customization.md).  
> **Aliases bootstrap:** [Existing app recipe](../16-real-world-workflows-and-recipes/01-bootstrapping-into-an-existing-app.md).

This page covers **everything outside the story canvas** that teams customize in depth: the **manager shell**, **bundler alignment** with the real app, **environment variables**, and **dev/CI server** behavior.

## 1. Under-The-Hood Mechanics

### Manager vs preview (again)

| Surface | What users see | Customize with |
|---|---|---|
| **Manager** | Sidebar, search, addon panels, toolbar chrome, brand | `manager.ts`, `manager-head.html`, addons, theme |
| **Preview** | Component iframe | `preview.ts(x)`, `preview-head.html`, stories |
| **Builder** | How JS/CSS is compiled for preview (and manager assets) | `framework`, `viteFinal` / `webpackFinal` |

Manager code **must not** import app components that assume browser-only preview APIs casually — keep manager theming thin.

### `viteFinal` / `webpackFinal` lifecycle

```
Storybook creates a base Vite/Webpack config for the chosen framework
        │
        ▼
Your viteFinal(config, options) receives that config
        │
        ▼
You merge aliases, plugins, CSS preprocessors, define, optimizeDeps, …
        │
        ▼
Dev server or production build uses the returned config
```

**Rule:** mutate carefully and **return** the config. Prefer spreading previous values over replacing entire `resolve` / `plugins` arrays blindly (you can drop Storybook’s own plugins).

### Env variable model

- Variables prefixed for Storybook (commonly `STORYBOOK_*`) are embedded into the **preview** bundle at build time.  
- `main.ts` runs in Node and can read `process.env` freely.  
- Never put secrets in `STORYBOOK_*` — they ship to the browser in static builds.

---

## 2. Real-World Engineering Scenario

**Scenario:** Designers complained Storybook “didn’t look like our brand,” and engineers had `Cannot resolve '@/components/Button'` only inside Storybook.  
Two separate customizations fixed it: (1) `manager.ts` brand theme + logo for the shell, (2) `viteFinal` alias `@` → `src` matching `vite.config.ts`. A third issue — dark mode flapping in CI — was fixed by pinning `STORYBOOK_THEME=light` for unit interaction tests and explicit story `globals` for Chromatic dark baselines.

---

## 3. Production-Grade Examples

### 3.1 Manager UI theming & branding (`manager.ts`)

```ts
// .storybook/manager.ts
import { addons } from "@storybook/manager-api";
import { create } from "@storybook/theming/create";
// In Storybook 8.x packages may be `@storybook/manager-api` + `@storybook/theming`

const brandTheme = create({
  base: "dark", // or 'light' — manager chrome, NOT your component theme
  brandTitle: "Acme Design System",
  brandUrl: "https://acme.example.com",
  brandImage: "/brand/acme-logo.svg", // served via staticDirs/public
  brandTarget: "_self",

  // Colors (manager UI)
  colorPrimary: "#6d5efc",
  colorSecondary: "#6d5efc",

  // UI
  appBg: "#0f0f12",
  appContentBg: "#15151a",
  appPreviewBg: "#15151a",
  appBorderColor: "#2a2a32",
  appBorderRadius: 8,

  // Typography
  fontBase: '"Inter", system-ui, sans-serif',
  fontCode: "ui-monospace, SFMono-Regular, Menlo, monospace",

  // Text
  textColor: "#f5f5f7",
  textInverseColor: "#0f0f12",
  textMutedColor: "#a1a1aa",

  // Toolbar
  barTextColor: "#a1a1aa",
  barSelectedColor: "#6d5efc",
  barHoverColor: "#8b7ff5",
  barBg: "#0f0f12",

  // Forms
  inputBg: "#1c1c22",
  inputBorder: "#2a2a32",
  inputTextColor: "#f5f5f7",
  inputBorderRadius: 6,
});

addons.setConfig({
  theme: brandTheme,
  // Sidebar / layout
  sidebar: {
    showRoots: true, // show top-level roots as collapsible sections
    collapsedRoots: ["Deprecated"],
    // filters can be provided in newer versions — check docs for your major
  },
  toolbar: {
    // hide built-in tools you never use (keys vary by version)
    // zoom: { hidden: true },
    // eject: { hidden: true },
    // copy: { hidden: true },
    // fullscreen: { hidden: true },
  },
  panelPosition: "bottom", // 'bottom' | 'right'
  enableShortcuts: true,
  showToolbar: true,
  initialActive: "sidebar", // or 'canvas' | 'addons' depending on version
});
```

```html
<!-- .storybook/manager-head.html -->
<link rel="icon" href="/brand/favicon.svg" />
<style>
  /* Rare: manager-only CSS. Prefer theming API above. */
</style>
```

**Note:** Manager `base: "dark"` does **not** set component `data-theme`. Component theme stays in **preview** decorators ([colors doc](../17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md)).

### 3.2 Deep `viteFinal` — align with the real Vite app

```ts
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
// import react from '@vitejs/plugin-react'; // only if you must re-add something Storybook missed

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  framework: { name: "@storybook/react-vite", options: {} },
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  staticDirs: ["../public"],

  async viteFinal(config, { configType }) {
    // configType: 'DEVELOPMENT' | 'PRODUCTION'
    return mergeConfig(config, {
      resolve: {
        alias: {
          "@": path.resolve(dirname, "../src"),
          "@components": path.resolve(dirname, "../src/components"),
          // Match vite.config.ts / tsconfig paths EXACTLY
        },
      },
      define: {
        // Mirror app defines if components depend on them
        __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.0.0"),
        "process.env.NODE_ENV": JSON.stringify(
          configType === "PRODUCTION" ? "production" : "development",
        ),
      },
      css: {
        preprocessorOptions: {
          scss: {
            // additionalData: `@use "@/styles/mixins" as *;`
          },
        },
        modules: {
          // localsConvention: 'camelCase',
        },
      },
      optimizeDeps: {
        include: [
          // Force prebundling of deps that blow up in Storybook only
          // 'some-cjs-lib',
        ],
        exclude: [],
      },
      server: {
        // fs: { allow: ['..'] }, // monorepo: allow reading files outside root
      },
      build: {
        // sourcemap: true,
      },
    });
  },
};

export default config;
```

#### Monorepo: allow parent workspace files

```ts
async viteFinal(config) {
  return mergeConfig(config, {
    server: {
      fs: {
        allow: [path.resolve(dirname, "../../")], // repo root
      },
    },
  });
},
```

#### SVG / special loaders

If the app uses `vite-plugin-svgr`:

```ts
import svgr from "vite-plugin-svgr";

async viteFinal(config) {
  return mergeConfig(config, {
    plugins: [svgr({ include: "**/*.svg?react" })],
  });
},
```

Without this, stories that `import Icon from './icon.svg?react'` fail only in Storybook.

### 3.3 `webpackFinal` (Webpack 5 framework)

```ts
// framework: { name: '@storybook/react-webpack5', options: {} }
async webpackFinal(config) {
  config.resolve = config.resolve ?? {};
  config.resolve.alias = {
    ...config.resolve.alias,
    "@": path.resolve(dirname, "../src"),
  };

  // Example: add a rule without wiping Storybook's JS rules
  config.module = config.module ?? { rules: [] };
  config.module.rules = [
    ...(config.module.rules ?? []),
    {
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    },
  ];

  return config;
},
```

**Prefer Vite** for new React Storybooks unless the app is locked to Webpack-specific loaders you must mirror.

### 3.4 Environment variables

#### Expose to the preview bundle

```ts
// .storybook/main.ts
const config: StorybookConfig = {
  // Storybook 7/8: env function merges into the define/env pipeline
  env: (config) => ({
    ...config,
    STORYBOOK_API_URL: process.env.STORYBOOK_API_URL ?? "http://localhost:4010",
    STORYBOOK_ENABLE_MOCKS: process.env.STORYBOOK_ENABLE_MOCKS ?? "true",
  }),
};
```

```ts
// In a story or preview helper (Vite-style)
const apiUrl = import.meta.env.STORYBOOK_API_URL;
// or depending on version/setup:
// const apiUrl = process.env.STORYBOOK_API_URL;
```

#### `.env` files

```bash
# .env.storybook  (or .env with STORYBOOK_ prefix)
STORYBOOK_API_URL=https://api.staging.example.com
STORYBOOK_ENABLE_MOCKS=true
```

Load strategy depends on major version and builder:

- Prefer documenting **`STORYBOOK_` prefix only** for client-visible values.  
- For Node-only secrets (Chromatic project token), use CI env **without** `STORYBOOK_` prefix and only reference them in `main`/scripts, never in preview code.

```bash
# CI — OK (not shipped to browser)
CHROMATIC_PROJECT_TOKEN=...

# CI — will be embedded if read into preview
STORYBOOK_PUBLIC_X=...
```

#### Runtime feature flags in preview

```tsx
// preview.tsx
const mocksEnabled = String(import.meta.env.STORYBOOK_ENABLE_MOCKS) !== "false";

const withMSW: Decorator = (Story) => {
  // start worker only when mocks enabled
  return <Story />;
};
```

### 3.5 Dev server: host, port, HTTPS, CI

```json
// package.json
{
  "scripts": {
    "storybook": "storybook dev -p 6006 --no-open",
    "storybook:host": "storybook dev -p 6006 --host 0.0.0.0",
    "build-storybook": "storybook build -o storybook-static",
    "test-storybook": "test-storybook --url http://127.0.0.1:6006"
  }
}
```

| Flag / need | Example | Why |
|---|---|---|
| Port | `-p 6006` | Avoid clashes with app `5173`/`3000` |
| Host | `--host 0.0.0.0` | Docker / remote VM access |
| CI | `--ci` / `--no-open` | Non-interactive |
| Smoke test | `storybook dev --smoke-test` | Exit after successful boot (CI config validation) |
| Debug builder | `storybook dev --debug-webpack` (webpack) | Inspect final config |

```yaml
# .github/workflows/storybook.yml (sketch)
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "yarn" }
      - run: yarn install --frozen-lockfile
      - run: yarn build-storybook
      - uses: actions/upload-artifact@v4
        with:
          name: storybook-static
          path: storybook-static
```

### 3.6 Aligning TypeScript paths with the builder

```json
// tsconfig.json paths
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

```ts
// viteFinal MUST mirror paths — Storybook does not always auto-read tsconfig paths
alias: { "@": path.resolve(dirname, "../src") }
```

Optional helper libraries (`vite-tsconfig-paths`) can reduce drift:

```ts
import tsconfigPaths from "vite-tsconfig-paths";

async viteFinal(config) {
  return mergeConfig(config, {
    plugins: [tsconfigPaths({ root: path.resolve(dirname, "..") })],
  });
},
```

### 3.7 Proxying an API during Storybook dev

```ts
async viteFinal(config) {
  return mergeConfig(config, {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:4010",
          changeOrigin: true,
        },
      },
    },
  });
},
```

Prefer **MSW** for component isolation; use proxy when stories intentionally hit a local BFF.

### 3.8 Custom absolute public path for deployed Storybook

```ts
// When Storybook is hosted at https://cdn.example.com/design-system/
async viteFinal(config, { configType }) {
  if (configType === "PRODUCTION") {
    config.base = "/design-system/";
  }
  return config;
},
```

Also set hosting rewrites so SPA fallback serves `index.html` for manager routes.

### 3.9 Composition refs (multi-team customization)

```ts
// main.ts
refs: {
  "core-ui": {
    title: "Core UI",
    url: process.env.CORE_UI_STORYBOOK_URL ?? "http://localhost:6007",
    expanded: false,
  },
},
```

Disable a ref offline:

```ts
refs: {
  "core-ui": {
    title: "Core UI",
    url: "...",
    disable: process.env.CI ? false : true,
  },
},
```

### 3.10 Programmatic config export patterns

```ts
// Keep main readable: split viteFinal
// .storybook/vite-final.ts
import type { UserConfig } from "vite";
import { mergeConfig } from "vite";
import path from "node:path";

export function applyAppViteDefaults(
  config: UserConfig,
  rootDir: string,
): UserConfig {
  return mergeConfig(config, {
    resolve: {
      alias: { "@": path.resolve(rootDir, "src") },
    },
  });
}
```

```ts
// main.ts
import { applyAppViteDefaults } from "./vite-final";

async viteFinal(config) {
  return applyAppViteDefaults(config, path.resolve(dirname, ".."));
},
```

### 3.11 Yarn PnP / monorepo resolution (common pain)

```ts
async viteFinal(config) {
  return mergeConfig(config, {
    resolve: {
      // dedupe React if multiple copies break hooks
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
  });
},
```

If PnP breaks Storybook, teams often switch Storybook’s package to `node_modules` linker for that workspace or add package extensions — treat as infra, not story code.

### 3.12 Webpack→Vite migration customization checklist

```text
[ ] framework name → @storybook/react-vite
[ ] Remove webpack-only rules; re-express as Vite plugins
[ ] Re-add path aliases in viteFinal
[ ] Re-add SVG/MDX/graphql plugins the app uses
[ ] Confirm CSS Modules class names still match snapshots
[ ] Confirm env: import.meta.env vs process.env
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Replacing `config.plugins` entirely in `viteFinal`
```ts
// ❌ Drops Storybook's React/MDX plugins → blank/broken preview
return { ...config, plugins: [myPlugin()] };

// ✅
return mergeConfig(config, { plugins: [myPlugin()] });
```

### ⚠️ Pitfall 2: Manager brand image 404
`brandImage: "/logo.svg"` requires `staticDirs` to include that file’s folder.

### ⚠️ Pitfall 3: Confusing manager theme with component theme
Dark manager + light components is normal. Wire component theme in **preview**.

### ⚠️ Pitfall 4: Secrets in `STORYBOOK_*`
Static Storybook hosts expose them in JS bundles. Use server-side CI secrets only.

### ⚠️ Pitfall 5: Alias works in app, not Storybook
Always dual-maintain `vite.config`/`tsconfig` paths and `viteFinal` (or shared helper).

### ⚠️ Pitfall 6: `base` path wrong in nested deploy
Asset 404s for manager and fonts. Set Vite `base` and host path consistently.

### ⚠️ Pitfall 7: Proxy hides missing mocks
Stories pass in dev with proxy, fail in static Chromatic builds without network. Prefer MSW for pure UI stories.

### ⚠️ Pitfall 8: Different Node versions in CI vs laptop
Builder plugin resolution differs. Pin Node in `engines` / CI.

### ⚠️ Pitfall 9: Telemetry / enterprise firewall noise
`core.disableTelemetry: true` in main for locked-down networks.

### ⚠️ Pitfall 10: Assuming `manager.ts` hot reloads reliably
Restart Storybook after manager/theme changes.

---

## End-to-end customization map

```text
Want to customize…                    Edit…
─────────────────────────────────────────────────────────
Story discovery / packages            main.stories
Addons                                main.addons
Docs autodocs policy                  main.docs + story tags
Prop tables / Controls noise          main.typescript.*
Static fonts/images                   main.staticDirs + public/
Path aliases / SVG / SCSS             main.viteFinal / webpackFinal
Env flags for stories                 main.env + STORYBOOK_* 
Sidebar order                         preview.parameters.options.storySort
Default layout / viewports            preview.parameters
Toolbar theme/locale                  preview.globalTypes + decorators
Global CSS / providers                preview imports + decorators
iframe <head> / portals               preview-head.html / preview-body.html
Shell logo / manager colors           manager.ts + manager-head.html
Hosted multi-team libraries           main.refs
CI build artifact                     storybook build -o …
```

---

## Related

- [main basics](./01-storybook-main.md)  
- [Advanced main & preview](./02-advanced-main-and-preview-customization.md)  
- [Publish static Storybook](../14-publishing-and-deployment/01-shipping-a-static-storybook.md)  
- [Test runner](../11-testing-integration/01-test-runner.md)  
- [Colors toolbars](../17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md)  
