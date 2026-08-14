---
title: "JavaScript Bundle & Media Optimization"
sidebar_label: "JavaScript Bundle & Media Optimization"
sidebar_position: 1
---

# 🚀 JavaScript Bundle & Media Optimization

## 1. Under-The-Hood Mechanics

Two of the largest byte-weight categories in most sites — JS and images/media — respond to fundamentally different optimization levers, but both ultimately serve the same goal: shrink what must download before the page is usable.

### Shrinking Shipped JavaScript
- **Tree shaking** requires ESM syntax (static `import`/`export`) and a `"sideEffects": false` (or scoped) declaration to let bundlers prove a module can be safely dropped when unused — see the [Webpack optimization bible](../../../webpack/pages/08-optimization/01-production-optimizations.md) for the exact mechanics.
- **Dynamic imports** split rarely-used features (an admin panel, a rich-text editor, a settings page) out of the main bundle entirely, so the majority of visitors who never touch that feature never pay its byte cost.
- **Bundle analysis** (`source-map-explorer`, `webpack-bundle-analyzer`) is how bloat is actually *found*, rather than guessed at — visualizing which specific dependencies consume how much of the shipped payload.
- **Dependency auditing** — replacing a heavy, all-in-one library (`moment.js`, ~70kb with all locales) with a lighter, tree-shakeable, or native alternative (`date-fns`, or the built-in `Intl` API, which ships zero bytes since it's a browser built-in) is often the single highest-leverage bundle-size fix available, since it requires no architecture change — just a dependency swap.

### Media Delivery
- **Modern formats** (AVIF, WebP) compress meaningfully smaller than JPEG/PNG at equivalent visual quality — served via `<picture>` with format fallbacks for browsers lacking AVIF/WebP support.
- **Responsive images** (`srcset`/`sizes`) let the browser choose the *resolution-appropriate* image variant for the current viewport/device-pixel-ratio, instead of every device downloading one fixed, often oversized, image.
- **CDN transformation services** (`next/image`, Cloudinary, Imgix) generate correctly-sized, correctly-formatted variants on-the-fly from a single source asset, removing the need to manually pre-generate every size/format combination.

---

## 2. Real-World Engineering Scenario

**Scenario**: Replacing `moment.js` Cut 68kb From Every Page's Initial Bundle.
A bundle analysis session revealed `moment.js` (with all locale data bundled by default) consumed 68kb gzipped — used in exactly two places for simple date formatting that didn't need internationalization beyond the user's own browser locale. Replacing both call sites with the native `Intl.DateTimeFormat` API (zero additional bytes, since it ships built into every modern browser) removed the dependency entirely, a 68kb reduction with no loss of functionality and no new dependency to maintain going forward.

---

## 3. Production-Grade Code Example

```typescript
// ❌ Before: moment.js — 68kb of a dependency for what native Intl already provides
import moment from 'moment';
const formatted = moment(date).format('MMMM D, YYYY');

// ✅ After: zero additional bundle bytes — Intl is a browser built-in
const formatted = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(date);
```

```html
<!-- Responsive, modern-format image delivery with fallbacks -->
<picture>
  <source type="image/avif" srcset="/hero-400.avif 400w, /hero-800.avif 800w, /hero-1200.avif 1200w" sizes="100vw" />
  <source type="image/webp" srcset="/hero-400.webp 400w, /hero-800.webp 800w, /hero-1200.webp 1200w" sizes="100vw" />
  <img src="/hero-800.jpg" width="800" height="450" alt="Hero" loading="eager" fetchpriority="high" />
</picture>
```

```tsx
// next/image — automatic format negotiation, responsive sizing, and CDN transformation
import Image from 'next/image';

function ProductCard({ product }: { product: Product }) {
  return (
    <Image
      src={product.imageUrl}
      alt={product.name}
      width={400}
      height={300}
      sizes="(max-width: 768px) 100vw, 400px" // browser picks the right generated variant per viewport
    />
  );
}
```

```bash
# Bundle analysis to FIND bloat before deciding what to optimize
npx source-map-explorer 'dist/*.js'
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Replacing a Heavy Dependency Without Verifying Feature Parity
```typescript
// ❌ RISKY: date-fns and Intl don't support 100% the same formatting tokens/locale edge cases
// moment.js did — swapping without checking every actual format string used in the codebase
// can subtly change displayed dates for users in specific locales
const formatted = new Intl.DateTimeFormat(userLocale).format(date); // untested against ALL prior format strings

// ✅ CORRECT: audit every actual usage/format string in the codebase against the replacement's
// capabilities before removing the old dependency, not just the common cases
```

### ⚠️ Pitfall 2: Serving One Oversized Image to Every Device
```html
<!-- ❌ WRONG: a phone on a small screen downloads the SAME 1200px-wide image a 4K desktop needs -->
<img src="/hero-1200.jpg" alt="Hero" />

<!-- ✅ CORRECT: srcset lets the browser choose the resolution-appropriate variant for its own viewport -->
<img srcset="/hero-400.jpg 400w, /hero-800.jpg 800w, /hero-1200.jpg 1200w" sizes="100vw" src="/hero-800.jpg" alt="Hero" />
```

### ⚠️ Pitfall 3: Auditing Bundle Size Once, Never Again
A bundle analysis performed during initial launch doesn't catch the gradual creep of dependencies added over the following year — each individually small, collectively significant. Without a recurring or CI-enforced check (see the [performance budgets doc](../10-budgets-and-advanced-diagnostics/01-performance-budgets-and-deep-profiling.md)), bundle bloat reappears silently, one seemingly-reasonable `npm install` at a time.
