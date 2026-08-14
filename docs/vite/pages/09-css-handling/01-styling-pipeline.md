---
title: "CSS Handling: Modules, PostCSS, Preprocessors & Lightning CSS"
sidebar_label: "CSS Handling"
sidebar_position: 1
---

# ⚡ CSS Handling: Modules, PostCSS, Preprocessors & Lightning CSS

## 1. Under-The-Hood Mechanics

Vite handles CSS with zero required configuration for the common cases — CSS Modules, PostCSS, and Sass/Less/Stylus are all auto-detected based on file naming conventions and the presence of config files/installed packages, not manual wiring.

```
import './Button.module.css'   ──► auto-detected as a CSS MODULE (the .module.css naming convention)
                                       — class names are scoped/hashed automatically, an object of
                                         { originalClassName: 'hashed-class-name' } is the import's default export

import './global.css'             ──► plain CSS — applied globally, no scoping

postcss.config.js present?           ──► AUTO-DETECTED, applied to ALL CSS automatically, no explicit
                                          Vite config needed to opt in

.scss/.less/.styl file?                 ──► the corresponding preprocessor is invoked automatically,
                                              IF the optional peer dependency (sass/less/stylus) is installed
```

### CSS Modules: Automatic Scoping via Naming Convention
Any file matching `*.module.css` (or `.scss`/`.less` equivalents) is automatically treated as a CSS Module — Vite generates locally-scoped class names (hashed, collision-free) and the JS import resolves to an object mapping original class names to their generated scoped equivalents. `css.modules.localsConvention` controls whether that object's keys are camelCase, kebab-case, or both.

### PostCSS: Zero-Config When a Config File Exists
Vite automatically picks up a `postcss.config.js` (or equivalent) in the project root and runs it against **every** CSS file processed — no explicit Vite-side wiring needed; this is how something like `autoprefixer` typically gets applied without any Vite-specific configuration at all.

### Lightning CSS: An Alternative, Rust-Based Transformer
`css.transformer: 'lightningcss'` swaps Vite's default CSS processing pipeline (which uses PostCSS under the hood) for Lightning CSS — a Rust-based transformer offering meaningfully faster processing for large stylesheets, at the cost of a still-maturing plugin ecosystem compared to PostCSS's long-established one.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Component Library Needing Guaranteed Style Isolation Across Many Independently-Developed Components.
A component library with dozens of components, built by different contributors, needed a guarantee that one component's `.button { ... }` class never accidentally collided with another's identically-named class — a real risk with plain global CSS at that scale. Adopting the `*.module.css` naming convention throughout meant every component's styles were automatically, uniquely scoped by Vite's CSS Modules handling, with zero manual namespacing/BEM-convention discipline required from each contributor — collisions became structurally impossible rather than merely discouraged by convention.

---

## 3. Production-Grade Code Example

```css
/* Button.module.css — auto-detected as a CSS Module via the .module.css naming convention */
.button {
  padding: 8px 16px;
  border-radius: 4px;
}
.primary {
  background: #0ea5e9;
}
```

```tsx
// Button.tsx — consuming the auto-scoped class names
import styles from './Button.module.css'; // resolves to { button: 'button_a1b2c3', primary: 'primary_d4e5f6' }

function Button({ variant }: { variant: 'primary' | 'secondary' }) {
  return <button className={`${styles.button} ${variant === 'primary' ? styles.primary : ''}`}>Click</button>;
}
```

```javascript
// postcss.config.js — auto-detected and applied to EVERY CSS file, zero Vite-specific config needed
module.exports = {
  plugins: {
    autoprefixer: {},
    'postcss-preset-env': { stage: 1 },
  },
};
```

```typescript
// vite.config.ts — opting into Lightning CSS for faster large-stylesheet processing
import { defineConfig } from 'vite';

export default defineConfig({
  css: {
    transformer: 'lightningcss', // swaps the default PostCSS-based pipeline for the Rust-based one
    modules: { localsConvention: 'camCaseOnly' }, // import styles.myClassName, not styles['my-class-name']
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Expecting a Plain `.css` Import to Be Automatically Scoped
```javascript
// ❌ WRONG: only the .module.css naming convention triggers CSS Modules scoping — a plain
// .css import applies GLOBALLY, with class names exactly as written, no isolation at all
import './Button.css'; // global — .button class here can collide with ANY other .button anywhere

// ✅ CORRECT: use the .module.css naming convention specifically when scoping/isolation is needed
import styles from './Button.module.css'; // scoped — styles.button is a unique, collision-free class name
```

### ⚠️ Pitfall 2: Installing a Preprocessor as a Regular Dependency Instead of a Dev Dependency
```bash
# ❌ SUBOPTIMAL: sass/less/stylus are BUILD-TIME tools — they don't need to ship in the
# production runtime dependency tree, bloating node_modules for anyone installing the built package
npm install sass

# ✅ CORRECT: install as a dev dependency — it's only ever needed during the build/dev-server process
npm install -D sass
```

### ⚠️ Pitfall 3: Switching to Lightning CSS Without Verifying Existing PostCSS Plugin Compatibility
```
❌ RISKY: Lightning CSS is a DIFFERENT transformer, not a drop-in PostCSS replacement —
existing postcss.config.js plugins (autoprefixer, postcss-preset-env, custom PostCSS plugins)
are NOT automatically ported over; some functionality needs Lightning CSS's own equivalent
config options instead, and some PostCSS plugins have no Lightning CSS equivalent at all

✅ CORRECT: audit existing PostCSS plugin usage BEFORE switching css.transformer,
and verify the build output is visually/functionally equivalent afterward
```
