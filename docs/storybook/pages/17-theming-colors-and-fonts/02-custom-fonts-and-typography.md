---
title: "Storybook Custom Fonts & Typography"
sidebar_label: "Storybook Custom Fonts & Typography"
sidebar_position: 2
---

# 🔤 Storybook Custom Fonts & Typography

> **Goal:** Storybook loads the **same font files and font stacks** as production so layout, truncation, and Chromatic diffs match the app.  
> Pairs with [Storybook colors & themes](./01-global-colors-themes-and-tokens.md) and CSS typography.

## 1. Under-The-Hood Mechanics

Fonts fail in Storybook for three different reasons:

| Failure | Symptom | Fix |
|---|---|---|
| **File not served** | Fallback system font; 404 on `.woff2` | `staticDirs` or bundler import |
| **CSS never loaded** | No `@font-face` at all | Import font CSS in `preview` |
| **Stack differs from app** | Slight metric/layout drift | Shared `--font-sans` token + same stack |

### Two valid loading strategies

**A. Public / staticDirs (matches Vite `public/`)**  
Files live at `/fonts/Inter.woff2` in both app and Storybook.

```
public/fonts/Inter.var.woff2
.storybook/main.ts → staticDirs: ['../public']
CSS: url("/fonts/Inter.var.woff2")
```

**B. Bundler-imported fonts**  
`import inter from './Inter.woff2'` or `url()` relative to a CSS module processed by Vite/Webpack — Storybook’s builder resolves them like the app.

```
src/assets/fonts/Inter.var.woff2
@font-face { src: url('../assets/fonts/Inter.var.woff2') format('woff2'); }
```

Use **one** strategy consistently with the app to avoid “works in app, 404 in Storybook.”

### Font metrics & visual tests
Custom fonts change **text width**, wrapping, and button sizes. If Chromatic baselines were captured with a fallback font, enabling the real font later produces noisy diffs. Load production fonts **before** locking visual baselines.

### `font-display`
`swap` / `optional` affect first paint. In Storybook, FOIT is less critical than **stable metrics** for visual tests — many teams use `font-display: block` only in Storybook (optional override) so snapshots wait for glyphs; others accept `swap` and use consistent network. Prefer matching production, then stabilize Chromatic with consistent CI font loading.

---

## 2. Real-World Engineering Scenario

**Scenario:** Marketing `Display` font looks correct in Next.js but Storybook headings reflow and Chromatic fails every PR.
The app used `next/font/google` (self-hosted at build into `/_next/static/media/...`). Storybook never ran `next/font`, so it fell back to `Georgia`. Fix: extract a shared `fonts.css` with `@font-face` pointing at files in `public/fonts` (or import the same woff2 in both), set `--font-display` on `:root`, import in `.storybook/preview`, and add a Typography story that asserts computed `font-family` contains the custom name.

---

## 3. Production-Grade Examples

### 3.1 File layout

```text
public/
  fonts/
    Inter.var.woff2
    Inter-Italic.var.woff2
    Fraunces.var.woff2          # display
src/
  styles/
    fonts.css                   # @font-face only
    tokens.css                  # --font-sans, --font-display
    global.css
.storybook/
  main.ts                       # staticDirs
  preview.tsx                   # import fonts + tokens
```

### 3.2 `staticDirs` in main

```ts
// .storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  // Serves public/ at "/" so url("/fonts/...") works like the app
  staticDirs: ["../public"],
};

export default config;
```

If fonts live outside `public/`:

```ts
staticDirs: [
  { from: "../src/assets/fonts", to: "/fonts" },
  "../public",
],
```

### 3.3 Shared `@font-face` + tokens

```css
/* src/styles/fonts.css */
@font-face {
  font-family: "InterVar";
  src: url("/fonts/Inter.var.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA,
    U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193,
    U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: "InterVar";
  src: url("/fonts/Inter-Italic.var.woff2") format("woff2");
  font-weight: 100 900;
  font-style: italic;
  font-display: swap;
}

@font-face {
  font-family: "FrauncesVar";
  src: url("/fonts/Fraunces.var.woff2") format("woff2");
  font-weight: 300 900;
  font-style: normal;
  font-display: swap;
}
```

```css
/* src/styles/tokens.css — fragment */
:root {
  --font-sans: "InterVar", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-display: "FrauncesVar", Georgia, "Times New Roman", serif;
  --font-mono: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;

  --text-step-0: 1rem;
  --text-step-1: clamp(1.25rem, 1.1rem + 0.6vw, 1.75rem);
  --text-step-2: clamp(1.5rem, 1.2rem + 1vw, 2.25rem);
  --leading-body: 1.5;
  --leading-tight: 1.2;
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-step-0);
  line-height: var(--leading-body);
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
.display {
  font-family: var(--font-display);
  line-height: var(--leading-tight);
  text-wrap: balance;
}
```

### 3.4 Import order in preview (critical)

```ts
// .storybook/preview.tsx
import "../src/styles/fonts.css";   // 1. @font-face
import "../src/styles/tokens.css";  // 2. variables + stacks
import "../src/styles/global.css";  // 3. element defaults
// import "../src/index.css";       // Tailwind entry if used
```

Order matters: faces before families that reference them; tokens before components.

### 3.5 Decorator applying font stack (with theme)

```tsx
const withThemeAndType: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "light";

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
  }, [theme]);

  return (
    <div
      className="sb-theme-root"
      style={{
        fontFamily: "var(--font-sans)",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        minHeight: "100%",
        padding: 16,
      }}
    >
      <Story />
    </div>
  );
};
```

### 3.6 Next.js `next/font` bridge pattern

`next/font` does not run inside Storybook. **Extract** the same files:

```tsx
// app-only — Next
import { Inter, Fraunces } from "next/font/google";

export const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-display" });
```

```css
/* Storybook + non-Next surfaces use fonts.css @font-face
   and the SAME CSS variable names next/font would set: */
:root {
  --font-sans: "InterVar", system-ui, sans-serif;
  --font-display: "FrauncesVar", Georgia, serif;
}
```

```tsx
// App layout applies next/font variable class on <html>
// Storybook decorator sets the same variables via tokens.css
// Components always use: font-family: var(--font-sans)
```

**Rule:** Components never import `next/font` directly; they only consume CSS variables. Next and Storybook both define those variables.

### 3.7 Bundler-imported font (no public/)

```css
/* src/styles/fonts.bundled.css */
@font-face {
  font-family: "InterVar";
  src: url("../assets/fonts/Inter.var.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}
```

```ts
// preview.tsx
import "../src/styles/fonts.bundled.css";
```

Vite in Storybook hashes the file and rewrites `url(...)` — no `staticDirs` needed for that face.

### 3.8 Typography documentation stories

```tsx
// src/design-system/Typography.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Design System/Typography",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function Specimen({
  label,
  family,
  sample,
}: {
  label: string;
  family: string;
  sample: string;
}) {
  return (
    <section
      style={{
        marginBottom: 24,
        padding: 16,
        border: "1px solid var(--color-border)",
        borderRadius: 8,
        background: "var(--color-surface-raised)",
      }}
    >
      <header
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--color-text-muted)",
          marginBottom: 8,
        }}
      >
        {label} · {family}
      </header>
      <p style={{ fontFamily: family, fontSize: "var(--text-step-1)", margin: 0 }}>{sample}</p>
      <p
        style={{
          fontFamily: family,
          fontSize: "var(--text-step-0)",
          color: "var(--color-text-muted)",
          margin: "8px 0 0",
        }}
      >
        The quick brown fox jumps over the lazy dog. 0123456789
      </p>
    </section>
  );
}

export const Stacks: Story = {
  render: () => (
    <div>
      <Specimen
        label="Sans / body"
        family="var(--font-sans)"
        sample="Product UI — buttons, forms, tables"
      />
      <Specimen
        label="Display / headings"
        family="var(--font-display)"
        sample="Marketing headline & empty states"
      />
      <Specimen
        label="Mono / code"
        family="var(--font-mono)"
        sample="const token = 'var(--color-primary)'"
      />
    </div>
  ),
};

export const Scale: Story = {
  render: () => (
    <div style={{ fontFamily: "var(--font-sans)" }}>
      {[
        ["Display", "var(--text-step-2)", "var(--font-display)"],
        ["Title", "var(--text-step-1)", "var(--font-display)"],
        ["Body", "var(--text-step-0)", "var(--font-sans)"],
      ].map(([name, size, family]) => (
        <p
          key={name}
          style={{
            fontFamily: family as string,
            fontSize: size as string,
            lineHeight: name === "Body" ? "var(--leading-body)" : "var(--leading-tight)",
            margin: "0 0 12px",
          }}
        >
          {name} — Designing systems that scale with real product UI.
        </p>
      ))}
    </div>
  ),
};

/** Debug story: prove the custom face actually loaded */
export const ComputedFamily: Story = {
  render: () => {
    const probe = (
      <span
        ref={(el) => {
          if (!el) return;
          const loaded = getComputedStyle(el).fontFamily;
          el.setAttribute("data-computed-family", loaded);
          // eslint-disable-next-line no-console
          console.info("[typography] computed font-family:", loaded);
        }}
        style={{ fontFamily: "var(--font-sans)" }}
      >
        Font probe
      </span>
    );
    return (
      <div style={{ fontFamily: "var(--font-sans)" }}>
        {probe}
        <p style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
          Open canvas console — family should include InterVar (or your face name), not only system-ui.
        </p>
      </div>
    );
  },
};
```

### 3.9 Interaction test: font applied

```tsx
// Typography.stories.tsx — add play if using @storybook/test
import { expect, within } from "@storybook/test";

export const SansIsCustom: Story = {
  render: () => (
    <p data-testid="body-copy" style={{ fontFamily: "var(--font-sans)" }}>
      Hello Storybook
    </p>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const el = canvas.getByTestId("body-copy");
    const family = getComputedStyle(el).fontFamily;
    // Adjust string to your @font-face family name
    await expect(family.toLowerCase()).toContain("inter");
  },
};
```

### 3.10 Tailwind fontFamily bridge

```js
// tailwind.config.js
theme: {
  extend: {
    fontFamily: {
      sans: ["var(--font-sans)"],
      display: ["var(--font-display)"],
      mono: ["var(--font-mono)"],
    },
  },
},
```

```tsx
export const TailwindType = {
  render: () => (
    <div>
      <h1 className="font-display text-3xl text-text">Display heading</h1>
      <p className="font-sans text-base text-muted">Body with muted token color.</p>
    </div>
  ),
};
```

### 3.11 Icon fonts / variable font axes (advanced)

```css
@font-face {
  font-family: "InterVar";
  src: url("/fonts/Inter.var.woff2") format("woff2");
  font-weight: 100 900;
  font-display: swap;
}

.display-tight {
  font-family: var(--font-display);
  font-variation-settings: "SOFT" 50, "WONK" 0;
  font-weight: 600;
}
```

Document axes in a story grid (weight 400/600/800 × italic on/off) so designers can review without Figma.

### 3.12 Preload in manager? (usually no)
Font preloads belong on the **preview** document. Adding `<link rel="preload">` via `preview-head.html`:

```html
<!-- .storybook/preview-head.html -->
<link
  rel="preload"
  href="/fonts/Inter.var.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
```

Use when first story paint must match production LCP font behavior more closely.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: `@font-face` url without `staticDirs`
```css
/* ❌ 404 in Storybook if file only lives in public/ and staticDirs omitted */
src: url("/fonts/Inter.var.woff2");
```

### ⚠️ Pitfall 2: Absolute CDN fonts offline / flaky Chromatic
Prefer self-hosted files in-repo for CI determinism. If using Google Fonts CDN, Chromatic network can flake or differ by region.

### ⚠️ Pitfall 3: Different font stacks in app vs Storybook
Even 1px average glyph width skews screenshots. Share `tokens.css` stacks.

### ⚠️ Pitfall 4: `next/font` only in App Router layout
Storybook never sees it. Always dual-define CSS variables (Next className + Storybook tokens).

### ⚠️ Pitfall 5: Forgetting italic/bold faces
Browser synthesizes oblique/bold → visual QA “font looks off.” Declare real italic and weight ranges (variable font `100 900`).

### ⚠️ Pitfall 6: CORS / `crossorigin` on font preload
Preloaded fonts need `crossorigin` even for same-origin in many browsers or the preload is wasted.

### ⚠️ Pitfall 7: Licensing
Some webfonts disallow bundling in public Storybook deploys. Confirm license before `build-storybook` on a public URL.

### ⚠️ Pitfall 8: Subsetting mismatch
App subsets Latin-only; Storybook loads full face (or vice versa) → different metrics for accented copy. Align `unicode-range` / subset files.

### ⚠️ Pitfall 9: Testing before font load completes
`play` functions asserting layout may run mid-swap. Use `document.fonts.ready`:

```ts
await document.fonts.ready;
await expect(getComputedStyle(el).fontFamily).toContain("Inter");
```

---

## Checklist: Storybook fonts matching production

```text
[ ] Font files available via staticDirs OR bundler import
[ ] fonts.css imported in preview (before tokens/global)
[ ] --font-sans / --font-display shared with app
[ ] Components use var(--font-*) or Tailwind font-sans bridge — not ad-hoc families
[ ] Typography story exists under Design System/
[ ] Chromatic baselines captured WITH custom fonts loaded
[ ] Optional: document.fonts.ready in interaction tests
```

---

## Related

- [Storybook colors & themes](./01-global-colors-themes-and-tokens.md)  
- [main.ts staticDirs](../13-build-and-configuration/01-storybook-main.md)  
- CSS typography bible  
- [Bootstrap into existing app](../16-real-world-workflows-and-recipes/01-bootstrapping-into-an-existing-app.md)  
