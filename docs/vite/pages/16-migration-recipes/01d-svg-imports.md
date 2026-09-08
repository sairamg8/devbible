---
title: "A plain import of an SVG still compiles under Vite after a CRA migration, which is exactly the problem — it silently returns a URL string where CRA's built-in transform returned a component, and the failure surfaces at render time, not at build time"
sidebar_label: "01d · SVG imports"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Static Asset Handling](https://vite.dev/guide/assets.html), and the [`vite-plugin-svgr`](https://github.com/pd4d10/vite-plugin-svgr) README. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ SVG imports: CRA's component transform was built in; Vite's needs a plugin, and the breakage is silent

**This is the one migration item in this topic where the code keeps compiling and the failure shows up as a React error at render time instead of at build time.** Every other item so far — the entry script, the env var rename, JSX in `.js` — fails loudly, at the dev server or at build. A CRA app's SVG-as-component imports do not: a bare `import Logo from './logo.svg'` is syntactically valid and successfully resolves under both tools, but it resolves to two structurally different values, and only one of them is a React component.

## CRA's built-in shape: two exports, two different values

CRA bundled SVGR (the SVG-to-React-component transform) directly into `react-scripts`, exposing both a named and a default export from the same file:

```javascript
// CRA — react-scripts >= 2.0.0, react >= 16.3.0
import { ReactComponent as Logo } from './logo.svg'; // a React component
import logoUrl from './logo.svg';                     // the asset's URL string

function Header() {
  return (
    <header>
      <Logo />                        {/* renders the SVG inline, as markup */}
      <img src={logoUrl} alt="Acme" /> {/* renders it as an <img> */}
    </header>
  );
}
```

Nothing in the import statement itself distinguishes "give me a component" from "give me a URL" beyond which export name you destructure — `ReactComponent` versus the default. This is entirely `react-scripts`' own convention; there is no equivalent standard on the platform.

## Vite's default: SVG is just an asset, and that default alone is not the problem

Vite treats `.svg` as a static asset out of the box, the same as any image type:

> *"Importing a static asset will return the resolved public URL when it is served"* — [Static Asset Handling](https://vite.dev/guide/assets.html)

```javascript
// Vite, no plugin needed — this already works, unmodified, after the migration
import logoUrl from './logo.svg';
// logoUrl is "/src/assets/logo.svg" in dev, "/assets/logo.a1b2c3.svg" after build
```

This much is *not* the bug — the CRA app's `<img src={logoUrl}>` usage, and any other plain-URL usage, keeps working unchanged. The problem is exactly the other import shape: `import { ReactComponent as Logo } from './logo.svg'` under Vite resolves to `undefined` (no named export exists on a default asset import), and CRA's default-export URL string has no direct one-line replacement without a plugin, because Vite's default asset handling gives you a URL, not a component, from a bare import at all.

## The fix: `vite-plugin-svgr`, and a different export shape than CRA's

```bash
npm install --save-dev vite-plugin-svgr
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  plugins: [react(), svgr()],
});
```

```typescript
// vite-env.d.ts — TypeScript needs to be told the ?react suffix produces a component
/// <reference types="vite-plugin-svgr/client" />
```

The import shape is **not** the same as CRA's — this is the detail that breaks a naive find-and-replace. `vite-plugin-svgr`'s current major uses a `?react` query suffix, and the component is the **default** export at that suffix, not a named `ReactComponent` export:

```javascript
// BEFORE (CRA)
import { ReactComponent as Logo } from './logo.svg';

// AFTER (Vite + vite-plugin-svgr) — default export, ?react suffix, DIFFERENT SHAPE
import Logo from './logo.svg?react';

// The plain URL import is completely unaffected by any of this — leave it as-is
import logoUrl from './logo.svg';
```

```javascript
// Header.jsx, fully migrated
import Logo from './logo.svg?react';
import logoUrl from './logo.svg';

function Header() {
  return (
    <header>
      <Logo />
      <img src={logoUrl} alt="Acme" />
    </header>
  );
}
```

⚠️ **A note for anyone copying an older blog post or Stack Overflow answer about `vite-plugin-svgr`:** earlier majors of the plugin (before its v4) used a named `ReactComponent` export closer to CRA's own shape, with no `?react` suffix required. If a snippet you're following shows `import { ReactComponent } from './logo.svg'` with `vite-plugin-svgr` already installed, it is describing an older major; check the installed version against the plugin's own current README before assuming that shape still applies.

## The silent failure this chunk exists to name

The dangerous version of this migration is not "the plugin isn't installed" — that fails loudly, the first time a `?react`-suffixed import is used with no matching plugin, because the specifier itself doesn't resolve to anything sensible. The dangerous version is a **partial** rename: a developer updates the import path mechanically but does not add the plugin, or updates the plugin but leaves an old-style bare `import { ReactComponent as Logo } from './logo.svg'` unrenamed:

```javascript
// This still "compiles" and imports successfully under Vite — .svg is a valid
// default-export asset import — but ReactComponent is not a real export on it.
import { ReactComponent as Logo } from './logo.svg'; // Logo is undefined
```

```jsx
// The failure surfaces here, at render, not at the import line:
<Logo />
// React: "Element type is invalid: expected a string (for built-in components)
// or a class/function (for composite components) but got: undefined."
```

That error message is React's own, generic "you rendered something that isn't a component" message — it does not mention SVG, `vite-plugin-svgr`, or the import line at all, so it reads like an unrelated bug unless you already know to check every renamed SVG import specifically.

## Gotchas

**★ Symptom: `<Logo />` throws React's generic "Element type is invalid… got: undefined" error, with no SVG-specific detail in the message.** Cause: `import { ReactComponent as Logo } from './logo.svg'` resolves under Vite's default asset handling, which has no `ReactComponent` named export — `Logo` is `undefined`, and the error only surfaces once you try to render it. Fix: install `vite-plugin-svgr`, add it to `plugins`, and switch the import to the `?react` suffix with a default export.
```javascript
import Logo from './logo.svg?react';
```

**★ Symptom: after installing `vite-plugin-svgr` and updating one import to the `?react` suffix, TypeScript reports "Cannot find module './logo.svg?react' or its corresponding type declarations."** Cause: the plugin's type declarations are not loaded automatically; TypeScript needs the triple-slash reference to know what a `?react`-suffixed import resolves to. Fix: add the reference to `vite-env.d.ts`.
```typescript
/// <reference types="vite-plugin-svgr/client" />
```

**★ Symptom: a blog post's `vite-plugin-svgr` example uses `import { ReactComponent } from './logo.svg'` with no `?react` suffix, and following it produces the exact same `undefined`-component error this chunk is about.** Cause: the snippet is describing an older major of the plugin (pre-v4), which used a named export shape closer to CRA's; the currently-installed version's README documents the `?react`-suffixed default export instead. Fix: check the installed `vite-plugin-svgr` version against its own current README rather than trusting the shape shown in an undated blog post.

**★ Symptom: only some SVG-as-component usages break after the migration; plain `<img src={logoUrl}>` usages of the same files work fine.** Cause: this is expected, not a partial failure — Vite's default asset handling already gives every `.svg` import a working URL string, so only the component-shaped imports (the ones destructuring `ReactComponent`) need the plugin and the syntax change at all. Fix: grep specifically for `ReactComponent` across the codebase; a plain default-export SVG import needs no change.
```bash
grep -rn 'ReactComponent' src/
```

**★ Symptom: a component that both renders an SVG inline and passes its URL to a `<link rel="preload">` tag needs both forms, and someone tries to derive one from the other.** Cause: there is no conversion between the two — `?react` and the bare import are two separate module requests to the same file, resolved by two different code paths inside the plugin/Vite pipeline, not two views of one imported value. Fix: import the file twice, once with each specifier, exactly as CRA required two separate export bindings from the one import statement.
```javascript
import Logo from './logo.svg?react';
import logoUrl from './logo.svg';
```

## Interview questions

**★ Why does a broken SVG-as-component migration fail at render time instead of at build time, unlike every other item in this migration topic?**
Because the bare import `import { ReactComponent as Logo } from './logo.svg'` is syntactically valid and does successfully resolve under Vite's default asset handling — `.svg` is a recognised static asset type, so the module exists and the import statement executes without error. What's missing is only the *named* `ReactComponent` binding on that module's exports, which JavaScript resolves to `undefined` rather than a resolution error, per the language's own named-import semantics for a missing export. The failure is deferred until something tries to actually use that `undefined` value as a component, which for React specifically only happens at render, inside `createElement`, by which point the stack trace has nothing left pointing back at the SVG import line.

**★ Why is `vite-plugin-svgr`'s `?react`-suffix, default-export shape a meaningfully different migration than "just install the equivalent plugin," compared to something like the env var rename?**
Because the env var rename is a pure find-and-replace — same shape, new prefix, same semantics on both sides. The SVG migration changes both the *specifier* (a `?react` suffix appended to the path) and the *export kind* (default instead of named) in the same change, so a script that only handles one half — renaming `ReactComponent` references without adding `?react`, or adding `?react` without switching from a named to a default import — produces code that still parses and still imports successfully, just resolving to the wrong value. That combination (syntactically fine, semantically wrong, no build-time signal) is what makes this the item in the migration most worth a dedicated grep-and-review pass rather than a mechanical script.

**★ A teammate proposes writing a codemod that finds every `import { ReactComponent as X } from '*.svg'` and mechanically rewrites it to `import X from '*.svg?react'`. Is that safe, and what's the one thing it needs to check first?**
It's the right approach in general — the transformation is mechanical once you know the target shape — but it needs to verify the *installed* `vite-plugin-svgr` major first, because the target shape itself changed across the plugin's own versions (older majors used a named `ReactComponent` export with no `?react` suffix, closer to what CRA had). A codemod written against the current plugin's shape, run against a codebase that has an older plugin major pinned in `package.json`, produces imports that don't match what the installed plugin actually exports — so the codemod is safe conditional on confirming the plugin version first, not safe by construction.

---

← [01c · Absolute imports and aliases](01c-absolute-imports-and-path-aliases.md) · [Vite overview](../../README.md) · Next → [01e · Proxy, tests, PWA](01e-dev-proxy-tests-and-pwa.md)
