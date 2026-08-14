---
title: "Recipe: Wire App Colors + Custom Fonts Into Storybook \ud83d\udfe2 `[D]`"
sidebar_label: "Recipe"
sidebar_position: 2
---

# 🧩 Recipe: Wire App Colors + Custom Fonts Into Storybook 🟢 `[D]`

> **Priority:** 🟢 `[D]` Daily setup for any real product Storybook  
> Deep dives: [Colors & themes](../17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md) · [Fonts](../17-theming-colors-and-fonts/02-custom-fonts-and-typography.md)

---

## 1. Under-The-Hood Mechanics

Storybook’s preview iframe is a **separate document** from your app shell. Colors and fonts only appear if you:

1. Serve font files (`staticDirs` or bundler).  
2. Import the same CSS the app uses (`fonts` → `tokens` → `global` / Tailwind).  
3. Apply theme the same way (`data-theme` / class / provider) via a **global decorator**, ideally driven by toolbar globals.

```text
.storybook/main.ts      staticDirs → /fonts/*.woff2
.storybook/preview.tsx  import CSS + withTheme decorator + globalTypes
src/styles/*            single source of truth shared with app
```

---

## 2. Real-World Engineering Scenario

**Scenario:** Storybook init succeeded, but every component looks “wrong” — system font, no brand blue, no dark mode.
The team had tokens only imported from `src/main.tsx` and fonts only via `next/font` in `layout.tsx`. Wiring the three steps below made Storybook match production within one PR and unblocked Chromatic.

---

## 3. Production-Grade End-to-End Setup

### Step 1 — `main.ts`

```ts
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-a11y",
    "@storybook/addon-interactions",
  ],
  framework: { name: "@storybook/react-vite", options: {} },
  staticDirs: ["../public"], // public/fonts/...
};

export default config;
```

### Step 2 — Shared styles (app + Storybook)

```css
/* src/styles/fonts.css — @font-face → url("/fonts/....woff2") */
/* src/styles/tokens.css — --color-*, --font-*, [data-theme="dark"] */
/* src/styles/global.css — body { font-family: var(--font-sans); ... } */
```

### Step 3 — `preview.tsx`

```tsx
import type { Preview, Decorator } from "@storybook/react";
import React, { useEffect } from "react";

import "../src/styles/fonts.css";
import "../src/styles/tokens.css";
import "../src/styles/global.css";
// import "../src/index.css"; // Tailwind

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "light";
  const brand = (context.globals.brand as string) ?? "default";

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme === "dark" ? "dark" : "light";
    if (brand === "default") root.removeAttribute("data-brand");
    else root.dataset.brand = brand;
  }, [theme, brand]);

  return (
    <div
      style={{
        minHeight: "100%",
        padding: 16,
        fontFamily: "var(--font-sans)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        items: ["light", "dark"],
        dynamicTitle: true,
      },
    },
    brand: {
      defaultValue: "default",
      toolbar: {
        title: "Brand",
        items: ["default", "lime", "rose"],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    layout: "padded",
    backgrounds: { disable: true },
  },
};

export default preview;
```

### Step 4 — Verify with design-system stories

- `Design System/Colors` → semantic swatches (see colors doc)  
- `Design System/Typography` → stacks + `document.fonts.ready` check (see fonts doc)  
- Toggle **Theme** toolbar → surfaces, text, primary buttons must all flip  
- Network tab → `/fonts/*.woff2` returns **200**

### Step 5 — Component story smoke test

```tsx
export const Primary: Story = {
  args: { children: "Save", variant: "primary" },
};
export const PrimaryDark: Story = {
  args: { children: "Save", variant: "primary" },
  globals: { theme: "dark" },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Only fixing colors, forgetting fonts
Layout/Chromatic still drift. Always wire **both** in the same PR.

### ⚠️ Pitfall 2: Theme on wrong document
Must set `data-theme` on the **iframe** `document.documentElement`.

### ⚠️ Pitfall 3: Tailwind content paths
Include `./.storybook/**/*` and all story globs so utilities used only in stories survive.

### ⚠️ Pitfall 4: next/font without CSS variable bridge
Components must use `var(--font-sans)`; define that variable for Storybook via `tokens.css` / `fonts.css`.

---

## Done when

```text
[x] staticDirs serves fonts
[x] preview imports fonts → tokens → global
[x] toolbar theme flips real CSS variables
[x] Colors + Typography design-system stories exist
[x] Sample component story looks identical to app (light + dark)
```
