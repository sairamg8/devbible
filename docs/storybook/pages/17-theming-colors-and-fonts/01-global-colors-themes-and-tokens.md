---
title: "Storybook Colors: Global Tokens, Themes & Live Switching"
sidebar_label: "Storybook Colors"
sidebar_position: 1
---

# 🎨 Storybook Colors: Global Tokens, Themes & Live Switching

> **Goal:** Storybook canvas uses the **same color system as the production app** — semantic CSS variables, light/dark, and brand — not one-off hex in stories.  
> App-level token model: CSS — Global color system.  
> Fullstack strategy: §5 Color strategy.

## 1. Under-The-Hood Mechanics

Storybook renders each story inside an **iframe** (the canvas). That iframe does **not** automatically inherit your app’s `index.html` theme bootstrap, global CSS, or providers. You must explicitly:

1. **Import the same token CSS** the app uses (or regenerate it).  
2. **Wrap stories** in the same theme surface (`data-theme`, `ThemeProvider`, Tailwind dark class).  
3. Optionally expose a **toolbar control** so designers/devs can flip light/dark/brand without editing code.  
4. Document the palette with **token stories** that read real tokens (never hard-coded swatches).

```
App entry                         Storybook preview iframe
─────────                         ────────────────────────
import './styles/tokens.css'  →   preview.ts imports same file
<html data-theme="dark">      →   decorator sets data-theme on body/root
ThemeProvider / Tailwind      →   global decorator mirrors app tree
```

### Three color layers in Storybook

| Layer | Where | Purpose |
|---|---|---|
| **Tokens** | Shared CSS (`tokens.css`) | `--color-primary`, `--color-surface`, … |
| **Theme application** | Global decorator / `parameters` | `data-theme`, `class="dark"`, MUI/Chakra theme |
| **Story chrome** | Backgrounds addon / Docs | Canvas backdrop only — not a substitute for real theme tokens |

### Backgrounds addon vs real theme
`parameters.backgrounds` only paints the **canvas behind** the story. It does **not** reassign `--color-surface` or re-render components for dark mode. Use it for quick contrast checks; use a **theme decorator** for real product colors.

### Toolbar globals → decorator
Storybook **globals** (toolbar dropdowns) flow into decorators via `context.globals`. Pattern:

```text
Toolbar "Theme" = light | dark | system
  → decorator reads context.globals.theme
  → sets document.documentElement.dataset.theme
  → CSS variables recompute → components update
```

---

## 2. Real-World Engineering Scenario

**Scenario:** Design system stories look perfect in Storybook light mode, but QA files bugs that “only happen in dark mode in the app.”
Root cause: Storybook never imported the app’s dark token overrides and never set `data-theme`. Stories used hard-coded `background: #fff` in a few places. Fix: single `tokens.css` shared by app + Storybook; global decorator driven by a Theme toolbar; forbid raw hex in components; add a `Design System/Colors` story that maps over semantic tokens so dark mode is visible in the docs themselves.

---

## 3. Production-Grade Examples

### 3.1 Shared token file (app + Storybook)

```css
/* src/styles/tokens.css — single source of truth */
:root {
  color-scheme: light dark;
  --color-primary: oklch(0.55 0.18 255);
  --color-primary-hover: oklch(0.48 0.16 255);
  --color-primary-fg: oklch(1 0 0);
  --color-surface: oklch(0.99 0 0);
  --color-surface-raised: oklch(1 0 0);
  --color-text: oklch(0.22 0.02 255);
  --color-text-muted: color-mix(in oklch, var(--color-text) 65%, transparent);
  --color-border: color-mix(in oklch, var(--color-text) 14%, transparent);
  --color-focus: oklch(0.62 0.18 255);
  --color-danger: oklch(0.6 0.2 25);
  --font-sans: "Inter", system-ui, sans-serif; /* see fonts doc */
}

[data-theme="dark"] {
  color-scheme: dark;
  --color-primary: oklch(0.68 0.16 255);
  --color-primary-hover: oklch(0.75 0.14 255);
  --color-primary-fg: oklch(0.16 0.02 255);
  --color-surface: oklch(0.18 0.02 255);
  --color-surface-raised: oklch(0.24 0.02 255);
  --color-text: oklch(0.96 0.01 255);
  --color-text-muted: color-mix(in oklch, var(--color-text) 65%, transparent);
  --color-border: color-mix(in oklch, var(--color-text) 16%, transparent);
}

[data-brand="lime"] {
  --color-primary: oklch(0.62 0.18 140);
  --color-primary-hover: oklch(0.55 0.16 140);
  --color-focus: oklch(0.62 0.18 140);
}
```

### 3.2 Import tokens + global CSS in `preview`

```ts
// .storybook/preview.ts
import type { Preview } from "@storybook/react";
import "../src/styles/tokens.css";
import "../src/styles/global.css"; // base element styles, resets if app uses them

// If the app uses Tailwind:
import "../src/index.css"; // must include @tailwind + any @theme / CSS var bridge
```

### 3.3 Theme + brand toolbar with decorator (React)

```tsx
// .storybook/preview.tsx
import type { Preview, Decorator } from "@storybook/react";
import React, { useEffect } from "react";
import "../src/styles/tokens.css";
import "../src/styles/global.css";

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "light";
  const brand = (context.globals.brand as string) ?? "default";

  useEffect(() => {
    const root = document.documentElement; // preview iframe html
    if (theme === "system") {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "dark" : "light";
    } else {
      root.dataset.theme = theme;
    }

    if (brand === "default") root.removeAttribute("data-brand");
    else root.dataset.brand = brand;

    // Tailwind darkMode: ['selector', '[data-theme="dark"]'] — no extra class needed
    // If you use class strategy: root.classList.toggle('dark', root.dataset.theme === 'dark')
  }, [theme, brand]);

  return (
    <div
      style={{
        minHeight: "100%",
        padding: "1rem",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        fontFamily: "var(--font-sans)",
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
      description: "Global color theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
          { value: "system", title: "System", icon: "browser" },
        ],
        dynamicTitle: true,
      },
    },
    brand: {
      description: "White-label brand hue set",
      defaultValue: "default",
      toolbar: {
        title: "Brand",
        icon: "paintbrush",
        items: [
          { value: "default", title: "Default" },
          { value: "lime", title: "Lime" },
          { value: "rose", title: "Rose" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    // Canvas chrome only — does NOT replace token theme
    backgrounds: {
      disable: true, // prefer real --color-surface from decorator
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
};

export default preview;
```

### 3.4 Component that consumes tokens (correct)

```tsx
// src/components/Button.tsx
import styles from "./Button.module.css";

type Props = {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
};

export function Button({ children, variant = "primary" }: Props) {
  return (
    <button type="button" className={`${styles.root} ${styles[variant]}`}>
      {children}
    </button>
  );
}
```

```css
/* Button.module.css — NO hex */
.root {
  font: inherit;
  font-family: var(--font-sans);
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid transparent;
  cursor: pointer;
}
.primary {
  background: var(--color-primary);
  color: var(--color-primary-fg);
}
.primary:hover {
  background: var(--color-primary-hover);
}
.ghost {
  background: transparent;
  color: var(--color-primary);
  border-color: var(--color-border);
}
.danger {
  background: var(--color-danger);
  color: var(--color-primary-fg);
}
.root:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
```

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "Save changes" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = { args: { variant: "primary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Danger: Story = { args: { variant: "danger" } };

/** Force dark for Chromatic / visual baselines without relying on toolbar */
export const PrimaryDark: Story = {
  args: { variant: "primary" },
  globals: { theme: "dark" }, // Storybook 7.6+ / 8: story-level globals
};
```

### 3.5 Tailwind path (semantic utilities)

```js
// tailwind.config.js
module.exports = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}", "./.storybook/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        surface: "var(--color-surface)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        border: "var(--color-border)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
    },
  },
};
```

```tsx
// Card.stories.tsx
export const Default = {
  render: () => (
    <div className="rounded-lg border border-border bg-surface p-4 text-text">
      <h3 className="font-sans text-lg">Billing</h3>
      <p className="text-muted">Colors follow Storybook theme toolbar.</p>
      <button className="mt-3 rounded bg-primary px-3 py-1.5 text-white">Upgrade</button>
    </div>
  ),
};
```

### 3.6 Design-system color token story (living docs)

```tsx
// src/design-system/Colors.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";

/** Resolve live CSS variables from the preview document */
function readCssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const SEMANTIC = [
  "--color-primary",
  "--color-primary-hover",
  "--color-surface",
  "--color-surface-raised",
  "--color-text",
  "--color-text-muted",
  "--color-border",
  "--color-focus",
  "--color-danger",
] as const;

function Swatch({ token }: { token: string }) {
  const value = readCssVar(token);
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--color-surface-raised)",
      }}
    >
      <div style={{ height: 72, background: `var(${token})` }} />
      <div style={{ padding: 8, fontFamily: "var(--font-sans)", fontSize: 12 }}>
        <div style={{ fontWeight: 600 }}>{token}</div>
        <code style={{ color: "var(--color-text-muted)" }}>{value || "(empty)"}</code>
      </div>
    </div>
  );
}

const meta = {
  title: "Design System/Colors",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const SemanticTokens: Story = {
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 12,
      }}
    >
      {SEMANTIC.map((token) => (
        <Swatch key={token} token={token} />
      ))}
    </div>
  ),
};

export const OnSurfaces: Story = {
  name: "Text & primary on surfaces",
  render: () => (
    <div style={{ display: "grid", gap: 16 }}>
      {(["light", "dark"] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme}
          style={{
            padding: 16,
            borderRadius: 8,
            background: "var(--color-surface)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            fontFamily: "var(--font-sans)",
          }}
        >
          <strong>{theme}</strong>
          <p style={{ color: "var(--color-text-muted)" }}>Muted body copy for contrast check.</p>
          <button
            type="button"
            style={{
              background: "var(--color-primary)",
              color: "var(--color-primary-fg)",
              border: 0,
              borderRadius: 6,
              padding: "8px 12px",
            }}
          >
            Primary action
          </button>
        </div>
      ))}
    </div>
  ),
};
```

### 3.7 React context ThemeProvider (if app is not pure CSS vars)

```tsx
// src/theme/ThemeProvider.tsx
import React, { createContext, useContext, useMemo } from "react";

type Mode = "light" | "dark";
const ThemeCtx = createContext<{ mode: Mode }>({ mode: "light" });

export function ThemeProvider({
  mode,
  children,
}: {
  mode: Mode;
  children: React.ReactNode;
}) {
  // Bridge context → CSS variables (best of both worlds)
  const style = useMemo(
    () =>
      ({
        // consumers can still use context; DOM gets data-theme for CSS
      }) as React.CSSProperties,
    [mode],
  );

  return (
    <ThemeCtx.Provider value={{ mode }}>
      <div data-theme={mode} style={style}>
        {children}
      </div>
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
```

```tsx
// .storybook/preview.tsx decorator fragment
const withThemeProvider: Decorator = (Story, context) => {
  const mode = context.globals.theme === "dark" ? "dark" : "light";
  return (
    <ThemeProvider mode={mode}>
      <Story />
    </ThemeProvider>
  );
};
```

### 3.8 Story-level override (single story dark)

```tsx
export const ModalOnDark: Story = {
  globals: { theme: "dark" },
  parameters: {
    layout: "fullscreen",
  },
};
```

### 3.9 Optional: Backgrounds addon (canvas only)

```ts
// Only if you still want neutral chrome behind unstyled examples
parameters: {
  backgrounds: {
    default: "surface",
    values: [
      { name: "surface", value: "var(--color-surface)" }, // may not resolve in addon UI in all versions — prefer solid fallbacks
      { name: "light gray", value: "#f4f4f5" },
      { name: "dark", value: "#09090b" },
    ],
  },
}
```

Prefer the **decorator surface** (`background: var(--color-surface)`) over backgrounds for product components.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Importing tokens only in the app entry
Storybook never loads `src/main.tsx`. Always import tokens in **`.storybook/preview`**.

### ⚠️ Pitfall 2: Setting theme on `window.parent` document
Decorators run in the **iframe**. Theme `document.documentElement` inside the preview iframe, not the manager shell.

### ⚠️ Pitfall 3: Using Backgrounds as “dark mode”
Components still use light token values → false confidence. Use toolbar globals + CSS variables.

### ⚠️ Pitfall 4: Hard-coded colors in stories “for clarity”
```tsx
// ❌ drifts from design system
<div style={{ background: "#0f172a", color: "white" }} />

// ✅
<div style={{ background: "var(--color-surface)", color: "var(--color-text)" }} />
```

### ⚠️ Pitfall 5: Tailwind `content` omitting `.storybook`
Stories using class names only in `.stories.tsx` get purged → missing utilities in Storybook only.

### ⚠️ Pitfall 6: Chromatic snapshots flapping with `theme: system`
Pin explicit `light`/`dark` globals on visual-critical stories for stable baselines.

### ⚠️ Pitfall 7: Two theme systems (MUI palette + CSS vars) out of sync
Bridge once: when toolbar changes, update both CSS `data-theme` and the library theme object from the **same** mode flag.

### ⚠️ Pitfall 8: Color contrast only tested in light
Enable a11y addon and run key stories under `globals: { theme: "dark" }` in test-runner / CI.

### ⚠️ Pitfall 9: Docs pages not wrapped the same as canvas
Ensure Docs use the same global decorators (default) so autodocs examples are themed too.

---

## Related

- [Custom fonts in Storybook](./02-custom-fonts-and-typography.md)  
- [Decorators](../09-decorators/01-wrapping-stories.md)  
- [Design system hub](../10-composition-and-design-systems/01-storybook-as-a-design-system-hub.md)  
- [main.ts / staticDirs](../13-build-and-configuration/01-storybook-main.md)  
- [Bootstrap existing app](../16-real-world-workflows-and-recipes/01-bootstrapping-into-an-existing-app.md)  
