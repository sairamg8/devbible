---
title: "Advanced Customization: `.storybook/main` & `preview` In Depth"
sidebar_label: "Advanced Customization"
sidebar_position: 2
---

# ⚙️ Advanced Customization: `.storybook/main` & `preview` In Depth

> **Prerequisites:** [main.js basics](./01-storybook-main.md).  
> **Companion:** [Manager UI, viteFinal/webpackFinal, env & CI](./03-manager-ui-builder-hooks-and-env.md).  
> **Theming:** [Colors & themes](../17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md) · [Fonts](../17-theming-colors-and-fonts/02-custom-fonts-and-typography.md).

This page is the **in-depth customization map** for the two files that control almost all product Storybook behavior: **`main.ts`** (build-time / Node) and **`preview.ts(x)`** (runtime / iframe).

## 1. Under-The-Hood Mechanics

### Two processes, two configs

```
┌─────────────────────────────────────────────────────────────┐
│  MANAGER (outer shell: sidebar, addons UI, toolbar)         │
│  configured by: main.ts + manager.ts + manager-head.html    │
└───────────────────────────┬─────────────────────────────────┘
                            │ embeds
┌───────────────────────────▼─────────────────────────────────┐
│  PREVIEW (iframe: your components + decorators + CSS)       │
│  configured by: preview.ts(x) + preview-head.html + stories │
└─────────────────────────────────────────────────────────────┘
         ▲
         │ built by Vite/Webpack from main.ts (framework, viteFinal, …)
```

| File | Runs in | When | Controls |
|---|---|---|---|
| **`main.ts`** | Node (Storybook CLI) | Startup / build | Story discovery, addons, framework, builder hooks, staticDirs, docs defaults, typescript, features, refs |
| **`preview.ts(x)`** | Browser **iframe** | Every story render | Decorators, global parameters, globalTypes (toolbar), loaders, initialGlobals, argTypes defaults |
| **Story CSF** | Browser iframe | That story | Overrides meta/preview via inheritance |

### Parameter inheritance (critical mental model)

```
preview.parameters  <  meta.parameters  <  story.parameters
     (global)            (component)         (one story)

Later levels SHALLOW-MERGE / override earlier ones per-addon rules.
Decorators: global wrap OUTSIDE story-level (see decorators doc).
```

### `main` is not hot-reloaded the same way
Changing `stories` globs, `addons`, or `viteFinal` usually needs a **Storybook restart**. `preview` and story files hot-reload more freely.

---

## 2. Real-World Engineering Scenario

**Scenario:** A monorepo design system needed: (1) stories only from `packages/ui`, (2) autodocs on by default, (3) sidebar sorted Design System → Components → Deprecated, (4) every story centered unless fullscreen modals opt out, (5) Controls matching `background*` props as color pickers.
All of that is **config**, not component code: `main.stories` + `main.docs` + `preview.parameters.options.storySort` + `preview.parameters.layout` + `controls.matchers`. Without understanding inheritance, engineers overrode layout on every story instead of setting a global default once.

---

## 3. Production-Grade Customization Reference

### 3.1 Full-featured `main.ts` (annotated)

```ts
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const config: StorybookConfig = {
  /* ---------- Discovery ---------- */
  stories: [
    "../src/docs/**/*.mdx", // MDX docs pages first (optional)
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    // Exclude experimental / internal if needed:
    // "!../src/**/*.internal.stories.tsx",
  ],

  /* ---------- Addons (order can matter for overlapping hooks) ---------- */
  addons: [
    "@storybook/addon-essentials", // controls, actions, docs, viewport, backgrounds, toolbars, measure, outline
    "@storybook/addon-a11y",
    "@storybook/addon-interactions",
    "@storybook/addon-links",
    // "@chromatic-com/storybook",
  ],

  /* ---------- Renderer + builder ---------- */
  framework: {
    name: "@storybook/react-vite",
    options: {
      // builder options vary by version — keep empty unless you need strict mode overrides
    },
  },

  /* ---------- Static assets (fonts, favicon, mock JSON) ---------- */
  staticDirs: [
    "../public",
    // { from: "../src/assets/fonts", to: "/fonts" },
  ],

  /* ---------- Docs generation defaults ---------- */
  docs: {
    autodocs: "tag", // only components with tags: ['autodocs']
    // autodocs: true, // every component gets a Docs page (noisier)
    defaultName: "Documentation", // Docs tab title
  },

  /* ---------- TypeScript / Controls prop tables ---------- */
  typescript: {
    check: false, // true = slower startup; run tsc in CI instead
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      // Keep prop tables focused on YOUR props, not HTML noise
      shouldExtractLiteralValuesFromEnum: true,
      // Don't expand every React.HTMLAttributes prop into Controls
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
      compilerOptions: {
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
      },
    },
  },

  /* ---------- Feature flags (names evolve — check your Storybook major) ---------- */
  features: {
    // examples of flags teams commonly care about (verify against installed version):
    // argTypeTargetsV7: true,
    // legacyDecoratorFileOrder: false,
  },

  /* ---------- Core server / build knobs ---------- */
  core: {
    disableTelemetry: true, // common for enterprise
    // builder: '@storybook/builder-vite', // usually inferred from framework
  },

  /* ---------- Log noise ---------- */
  logLevel: "info", // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'

  /* ---------- Multi-project composition ---------- */
  // refs: {
  //   'design-system': {
  //     title: 'Design System',
  //     url: 'https://design-system.example.com/storybook/',
  //   },
  // },

  /* ---------- Env exposed to preview (see also env companion doc) ---------- */
  env: (config) => ({
    ...config,
    STORYBOOK_API_MOCK: "true",
  }),

  /* ---------- Builder customization — see doc 03 ---------- */
  async viteFinal(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias as object),
      "@": path.resolve(dirname, "../src"),
    };
    return config;
  },
};

export default config;
```

### 3.2 Story discovery patterns

```ts
// Multiple packages (monorepo)
stories: [
  {
    directory: "../packages/ui/src",
    files: "**/*.stories.tsx",
    titlePrefix: "UI", // sidebar: UI/Button/...
  },
  {
    directory: "../packages/charts/src",
    files: "**/*.stories.tsx",
    titlePrefix: "Charts",
  },
],
```

```ts
// CSF + MDX
stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
```

### 3.3 Full-featured `preview.tsx`

```tsx
// .storybook/preview.tsx
import type { Preview, Decorator, Loader } from "@storybook/react";
import React, { useEffect, Suspense } from "react";

import "../src/styles/fonts.css";
import "../src/styles/tokens.css";
import "../src/styles/global.css";
// import "../src/index.css";

/* ---------- Global decorator: theme shell ---------- */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "light";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div
      style={{
        minHeight: "100%",
        padding: context.parameters.layout === "fullscreen" ? 0 : 16,
        fontFamily: "var(--font-sans)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
      }}
    >
      <Suspense fallback={<div>Loading story…</div>}>
        <Story />
      </Suspense>
    </div>
  );
};

/* ---------- Optional loader: async data before render ---------- */
const withLocaleLoader: Loader = async (context) => {
  // Runs before the story; return values appear on context.loaded
  const locale = (context.globals.locale as string) ?? "en";
  const messages = await import(`../src/i18n/${locale}.json`).then((m) => m.default);
  return { messages, locale };
};

const preview: Preview = {
  /* Apply to every story */
  decorators: [withTheme],
  loaders: [withLocaleLoader],

  /* Toolbar controls → context.globals */
  globalTypes: {
    theme: {
      description: "Color theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: "i18n locale",
      defaultValue: "en",
      toolbar: {
        title: "Locale",
        icon: "globe",
        items: ["en", "es", "de", "ja"],
        dynamicTitle: true,
      },
    },
  },

  /* Initial toolbar state (can be overridden per-story via `globals`) */
  initialGlobals: {
    theme: "light",
    locale: "en",
    // viewport: { value: 'mobile1', isRotated: false }, // if using viewport addon API for your version
  },

  /* Defaults for Controls panel */
  argTypes: {
    // Example: hide noisy callback noise globally if desired
    // onClick: { action: 'clicked', table: { disable: true } },
  },

  parameters: {
    /* ----- Layout: centered | padded | fullscreen ----- */
    layout: "padded",

    /* ----- Actions: auto-detect on* handlers ----- */
    actions: { argTypesRegex: "^on[A-Z].*" },

    /* ----- Controls ----- */
    controls: {
      expanded: true, // show full prop description table
      sort: "requiredFirst", // 'none' | 'alpha' | 'requiredFirst'
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      exclude: ["asChild", "ref"], // never show these in Controls
    },

    /* ----- Docs ----- */
    docs: {
      toc: true, // table of contents on Docs pages
      // source: { type: 'code' }, // force code block style
      // canvas: { sourceState: 'shown' },
    },

    /* ----- Viewport (addon-essentials) ----- */
    viewport: {
      viewports: {
        // Mirror YOUR product breakpoints, not generic iPhone sizes only
        productSm: {
          name: "Product SM (640)",
          styles: { width: "640px", height: "900px" },
        },
        productMd: {
          name: "Product MD (768)",
          styles: { width: "768px", height: "900px" },
        },
        productLg: {
          name: "Product LG (1024)",
          styles: { width: "1024px", height: "900px" },
        },
        productXl: {
          name: "Product XL (1280)",
          styles: { width: "1280px", height: "900px" },
        },
      },
      // defaultViewport: 'productLg',
    },

    /* ----- Backgrounds: canvas chrome only (prefer CSS tokens for real theme) ----- */
    backgrounds: {
      disable: true, // recommended when using token-based theme decorator
      // default: 'light',
      // values: [
      //   { name: 'light', value: '#ffffff' },
      //   { name: 'dark', value: '#0a0a0a' },
      // ],
    },

    /* ----- Options: sidebar sorting & filtering ----- */
    options: {
      storySort: {
        method: "alphabetical",
        order: [
          "Introduction",
          "Design System",
          ["Colors", "Typography", "Spacing", "*"],
          "Components",
          "Patterns",
          "Deprecated",
          "*",
        ],
        locales: "en-US",
      },
    },

    /* ----- a11y ----- */
    a11y: {
      // test: 'todo' | 'error' | 'off' depending on addon version
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          // { id: 'region', enabled: false }, // only if you accept the risk globally
        ],
      },
    },

    /* ----- Chromatic (if used) ----- */
    // chromatic: { pauseAnimationAtEnd: true },
  },

  /* CSF tags defaults (Storybook 7.6+/8) */
  tags: ["autodocs"], // optional global — every story gets autodocs; or set per-meta only
};

export default preview;
```

### 3.4 Story / meta overrides (customization at the right level)

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered", // override global padded
    controls: { exclude: ["className"] },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "ghost", "danger"],
      description: "Visual emphasis",
      table: { defaultValue: { summary: "primary" } },
    },
    disabled: { control: "boolean" },
  },
  args: {
    children: "Continue",
    variant: "primary",
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const FullscreenDemo: Story = {
  parameters: { layout: "fullscreen" },
  globals: { theme: "dark" }, // force toolbar theme for this story
};

export const NoA11yRegionRule: Story = {
  parameters: {
    a11y: {
      config: { rules: [{ id: "region", enabled: false }] },
    },
  },
};
```

### 3.5 Custom story sort function (when order array isn’t enough)

```ts
// preview parameters.options.storySort as a function
storySort: (a, b) => {
  const order = ["Introduction", "Design System", "Components", "Deprecated"];
  const aTitle = a.title; // e.g. "Components/Button"
  const bTitle = b.title;
  const aRoot = aTitle.split("/")[0];
  const bRoot = bTitle.split("/")[0];
  const ai = order.indexOf(aRoot);
  const bi = order.indexOf(bRoot);
  if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return aTitle.localeCompare(bTitle, "en-US", { numeric: true });
},
```

### 3.6 `preview-body.html` / `preview-head.html` customization

```html
<!-- .storybook/preview-head.html — injected into iframe <head> -->
<link rel="preload" href="/fonts/Inter.var.woff2" as="font" type="font/woff2" crossorigin />
<meta name="color-scheme" content="light dark" />
<script>
  // Runs before React — useful for theme FOUC prevention
  (function () {
    try {
      var t = localStorage.getItem("sb-theme");
      if (t) document.documentElement.dataset.theme = t;
    } catch (e) {}
  })();
</script>
<style>
  /* Emergency reset only — prefer tokens.css */
  html, body, #storybook-root { height: 100%; }
</style>
```

```html
<!-- .storybook/preview-body.html — injected at start of <body> -->
<div id="portal-root"></div>
<!-- If your app portals modals to #portal-root, create it here so stories don't crash -->
```

### 3.7 Tags customization (autodocs, play, visual)

```tsx
// meta
tags: ["autodocs", "stable"],

// Disable autodocs for noisy internal stories
tags: ["!autodocs"],

// Storybook 8: tag-based filtering in sidebar depends on version/features —
// use titlePrefix + storySort for stable IA when tags UI is insufficient
```

### 3.8 Actions & Controls fine-tuning

```ts
parameters: {
  actions: {
    argTypesRegex: "^on[A-Z].*",
    handles: ["mouseover", "click .btn"], // DOM event listeners in Actions panel
  },
  controls: {
    include: ["variant", "size", "disabled", "children"], // allowlist mode
    // exclude: ['...'],
  },
},
```

### 3.9 Docs-only MDX page (custom documentation entry)

```mdx
{/* src/docs/Introduction.mdx */}
import { Meta } from "@storybook/blocks";

<Meta title="Introduction" />

# Design System Storybook

Use the **Theme** toolbar to switch light/dark. Tokens are the same as production.
```

Ensure `stories` glob includes `**/*.mdx`.

### 3.10 Environment-specific preview behavior

```ts
// preview.tsx
const isChromatic = Boolean(
  (import.meta as any).env?.STORYBOOK_CHROMATIC ||
    (window as any).navigator?.userAgent?.includes("Chromatic"),
);

parameters: {
  chromatic: isChromatic ? { pauseAnimationAtEnd: true } : undefined,
  // disable heavy animations in visual CI
},
```

(Exact env injection patterns: [doc 03](./03-manager-ui-builder-hooks-and-env.md).)

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Putting preview-only concerns in `main`
Decorators, theme, and CSS imports belong in **`preview`**. `main` never runs in the iframe — it cannot wrap React trees.

### ⚠️ Pitfall 2: Expecting deep merge of all parameters
Addon-specific parameters may replace objects wholesale. Always re-specify nested keys you still need when overriding at story level.

### ⚠️ Pitfall 3: `autodocs: true` on a huge codebase
Docs build time explodes; prefer `autodocs: "tag"` and opt-in.

### ⚠️ Pitfall 4: Prop tables flooded with native DOM props
Configure `propFilter` / use `react-docgen-typescript` options — otherwise Controls becomes unusable.

### ⚠️ Pitfall 5: Global `layout: "centered"` breaking full-page layouts
Shells, dashboards, and modals need `fullscreen` or `padded` per-story. Default to `padded`, center only for atoms.

### ⚠️ Pitfall 6: Toolbar `globalTypes` without reading `context.globals` in a decorator
Dropdown appears but changes nothing. Wire decorator side effects (or providers) explicitly.

### ⚠️ Pitfall 7: Story sort order fighting `title` strings
`title: "components/button"` vs `"Components/Button"` sorts differently. Standardize casing and use `order` roots.

### ⚠️ Pitfall 8: Restart not performed after `main` edits
“Config didn’t work” is often a stale server. Restart after `main` / addon changes.

### ⚠️ Pitfall 9: Hiding broken a11y rules globally
Scope disables to the specific story via `parameters.a11y`; global disables train teams to ignore real issues.

### ⚠️ Pitfall 10: Duplicating app providers only in some stories
Missing context becomes “flaky” stories. Prefer **one** global decorator tree matching production ([bootstrap recipe](../16-real-world-workflows-and-recipes/01-bootstrapping-into-an-existing-app.md)).

---

## Customization checklist

```text
[ ] stories globs cover real packages / exclude internals
[ ] addons list intentional; no duplicate theme/a11y managers
[ ] docs.autodocs policy chosen (tag vs true)
[ ] typescript propFilter keeps Controls usable
[ ] preview imports real CSS (fonts → tokens → global)
[ ] global layout + storySort match product IA
[ ] viewports match CSS breakpoints
[ ] globalTypes toolbars wired to decorators
[ ] staticDirs serve public fonts/assets
[ ] story-level overrides only where needed
```

---

## Related

- [main basics](./01-storybook-main.md)  
- [Manager UI, builder hooks, env](./03-manager-ui-builder-hooks-and-env.md)  
- [Decorators](../09-decorators/01-wrapping-stories.md)  
- [Story anatomy / parameters](../02-story-anatomy/01-file-structure.md)  
- [Addons parameters](../03-addons-ecosystem/01-essential-addons.md)  
