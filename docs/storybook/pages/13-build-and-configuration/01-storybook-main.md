---
title: "Build & Configuration: `.storybook/main.js` Deep Dive"
sidebar_label: "Build & Configuration"
sidebar_position: 1
---

# 📖 Build & Configuration: `.storybook/main.js` Deep Dive

> **In-depth customization (main + preview + manager + viteFinal + env):**  
> [Advanced main & preview](./02-advanced-main-and-preview-customization.md) ·  
> [Manager UI, builder hooks & env](./03-manager-ui-builder-hooks-and-env.md)

## 1. Under-The-Hood Mechanics

`.storybook/main.js` (or `.ts`) is Storybook's central configuration file, controlling story discovery, addon registration, the framework/builder pairing, and static asset serving — read once at Storybook startup, before any story is ever loaded.

```typescript
const config = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],   // GLOB PATTERNS — which files are discovered as stories
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'], // registers installed addons
  framework: { name: '@storybook/react-vite', options: {} },           // renderer + builder pairing
  staticDirs: ['../public'],                                             // serves static assets (fonts, images) verbatim
};
export default config;
```

### `stories`: Glob Patterns Determine What's Discovered
The `stories` glob pattern is the single source of truth for which files Storybook treats as story files — a component with a `.stories.tsx` file that doesn't match the configured glob (wrong directory, wrong extension) simply won't appear in Storybook at all, with no error, just a silently-missing component in the sidebar navigation.

### `addons`: Order Can Matter for Some Addons
Most addons are order-independent, but a few (particularly ones that hook into the same lifecycle events, like accessibility scanning combined with a custom theme-switching addon) can have subtly different behavior depending on registration order — worth being aware of when combining several addons with overlapping concerns.

### `staticDirs`: Serving Assets Storybook Itself Doesn't Process
Fonts, favicon, or other static assets a component's stories reference by a fixed URL path (rather than importing through the bundler) need to be explicitly served via `staticDirs` — mirroring the same "verbatim, unprocessed" role as a bundler's `public/` directory (covered in the [Vite asset handling doc](../../../vite/pages/06-asset-handling/01-static-asset-imports.md)).

---

## 2. Real-World Engineering Scenario

**Scenario**: A Newly-Added Component's Stories Silently Missing From Storybook's Sidebar, Traced to a Glob Pattern Mismatch.
A new component was added under `src/features/checkout/CheckoutButton.stories.tsx` — but the project's `stories` glob was configured as `['../src/components/**/*.stories.tsx']`, scoped only to a `components/` subdirectory, not the newly-introduced `features/` directory structure. The story file existed, was syntactically correct, and would have worked perfectly — but Storybook never discovered it at all, since it fell outside the configured glob pattern, with no error or warning indicating why the component simply didn't appear anywhere in the sidebar. Widening the glob to `['../src/**/*.stories.tsx']` (matching the actual, evolved project structure) resolved it immediately.

---

## 3. Production-Grade Code Example

```typescript
// .storybook/main.ts — a complete, real-world configuration
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx|mdx)'], // broad enough to match the actual project structure
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    '@storybook/addon-interactions',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  staticDirs: ['../public'], // serves fonts/favicon verbatim, matching the app's own public/ convention
  typescript: {
    reactDocgen: 'react-docgen-typescript', // powers the auto-generated Controls/props tables
  },
};

export default config;
```

```typescript
// .storybook/preview.ts — the companion file: GLOBAL parameters/decorators applied to every story
import type { Preview } from '@storybook/react';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { config: { rules: [] } },
  },
  decorators: [/* global decorators — see the decorators doc */],
};

export default preview;
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: A `stories` Glob That Doesn't Match the Actual, Evolved Project Structure
```typescript
// ❌ SILENT FAILURE: as the project structure grows beyond what the glob was originally
// scoped to, new stories placed OUTSIDE that scope are silently never discovered —
// no error, just a component missing from the sidebar
stories: ['../src/components/**/*.stories.tsx'], // doesn't match src/features/**, src/pages/**, etc.

// ✅ CORRECT: use a broad enough glob to match the project's ACTUAL, evolving structure
stories: ['../src/**/*.stories.@(ts|tsx|mdx)'],
```

### ⚠️ Pitfall 2: Forgetting `staticDirs` for Assets Referenced by Fixed Path
```tsx
// ❌ WRONG: a story referencing a font/image by a fixed URL path that ISN'T served via
// staticDirs (and isn't imported through the bundler either) 404s inside Storybook,
// even though the exact same path works fine in the actual deployed app
<link rel="stylesheet" href="/fonts/custom-font.css" /> {/* 404s in Storybook without staticDirs */}

// ✅ CORRECT: mirror the app's own static-asset serving via staticDirs
staticDirs: ['../public'], // matches whatever the actual app serves at that same fixed path
```

### ⚠️ Pitfall 3: Registering Conflicting Addons Without Understanding Their Interaction
```typescript
// ❌ RISKY: two addons that both hook into the SAME lifecycle event (e.g. two different
// theme-switching addons, or overlapping a11y-related addons) can produce confusing,
// hard-to-debug interaction effects depending on registration order
addons: ['addon-theme-switcher-a', 'addon-theme-switcher-b'], // both trying to control the SAME concern

// ✅ CORRECT: audit the addon set for genuinely overlapping responsibilities before adding
// a new one, rather than assuming all addons compose cleanly regardless of what they each do
```
