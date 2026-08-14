---
title: "Deployment Considerations: `base`, `vite preview` & Cache Header Strategy"
sidebar_label: "Deployment Considerations"
sidebar_position: 1
---

# ⚡ Deployment Considerations: `base`, `vite preview` & Cache Header Strategy

## 1. Under-The-Hood Mechanics

Shipping a Vite-built app correctly requires aligning three things: the configured `base` path, the actual hosting sub-path, and the HTTP cache headers served for hashed vs unhashed assets.

```
build.outDir (default: dist/)
        │
        ▼
Deployed to: https://example.com/                OR      https://example.com/my-app/  (sub-path)
        │                                                          │
   base: '/'                                              base: '/my-app/'  ── MUST MATCH the actual deploy path,
        │                                                          │             or every asset reference 404s
        ▼                                                          ▼
index.html references assets as /assets/...        index.html references assets as /my-app/assets/...
```

### `base`: Must Exactly Match the Deployment Sub-Path
Every asset reference Vite generates in the built `index.html` and JS chunks is prefixed with `base` — deploying to a sub-path (a common pattern for GitHub Pages, or hosting multiple apps under one domain) without setting `base` to match produces a build where every single asset request resolves against the wrong URL, typically manifesting as a blank page with a console full of 404s for JS/CSS files.

### Long-Term Cache Header Strategy
Vite's production build already produces content-hashed filenames for JS/CSS/most assets (`index-a1b2c3.js`) — the deployment's job is applying the **correct HTTP cache headers** to match that hashing strategy: hashed asset files can be cached essentially forever (`Cache-Control: public, max-age=31536000, immutable`, mirroring the exact same strategy covered in the [Webpack caching doc](../../../webpack/pages/10-caching-strategies/01-long-term-caching.md)), while `index.html` itself (unhashed, and the entry point referencing the current hashes) must **never** be cached long-term (`Cache-Control: no-cache`), or users would keep loading a stale `index.html` pointing at asset hashes from a previous, no-longer-existing deploy.

### `vite preview` as the Final Local Sanity Check
As covered in the [CLI doc](../02-cli-and-scaffolding/01-commands-and-templates.md), `vite preview` serves the actual built `dist/` output locally — the last opportunity to catch a `base`-path misconfiguration or any other production-only issue before an actual deploy.

---

## 2. Real-World Engineering Scenario

**Scenario**: A GitHub Pages Deployment Showing a Blank Page Despite a "Successful" Build.
A team deployed their Vite app to GitHub Pages under `https://team.github.io/project-name/` — the build completed without errors, but the live site showed a completely blank page. The root cause: `base` was left at its default (`/`), so every asset reference in the built `index.html` pointed at `https://team.github.io/assets/...` instead of the actual `https://team.github.io/project-name/assets/...` — every single JS/CSS request 404'd, and with no JS ever executing, the page rendered nothing. Setting `base: '/project-name/'` (matching the GitHub Pages repository sub-path exactly) resolved the blank page immediately.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — base configured for a GitHub Pages sub-path deployment
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/project-name/', // MUST exactly match the actual GitHub Pages repository path
});
```

```nginx
# nginx.conf — correct cache header strategy for a Vite build's output
location /assets/ {
    # Hashed filenames (index-a1b2c3.js) — safe to cache essentially forever
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location = /index.html {
    # UNHASHED, references the CURRENT deploy's asset hashes — must always be revalidated
    add_header Cache-Control "no-cache";
}
```

```bash
# The pre-deploy sanity check that would have caught the GitHub Pages misconfiguration locally
vite build
vite preview --base /project-name/  # simulates the ACTUAL sub-path serving before deploying
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting `base` for a Sub-Path Deployment
```typescript
// ❌ WRONG: default base ('/') on a sub-path deployment breaks EVERY asset reference
export default defineConfig({ /* base defaults to '/' */ });

// ✅ CORRECT: base must match the ACTUAL deployment sub-path exactly, including trailing slash
export default defineConfig({ base: '/project-name/' });
```

### ⚠️ Pitfall 2: Applying Long-Term Caching to `index.html`
```
❌ WRONG: Cache-Control: public, max-age=31536000, immutable applied to index.html means
users keep loading a STALE index.html (referencing asset hashes from an OLD deploy) for
up to a full year, even though a brand new version has been deployed — new deploys become
invisible to returning users until their browser cache naturally expires

✅ CORRECT: index.html gets no-cache (or a very short max-age) specifically, while ONLY
the hashed asset files underneath /assets/ get the long-term immutable caching treatment
```

### ⚠️ Pitfall 3: Never Testing With `vite preview` Before an Actual Deploy
As covered in the CLI doc, skipping straight from `vite` (dev server) to a live deploy means base-path misconfigurations, and any other production-build-only issues, are discovered by actual users in production rather than by the team locally — `vite build && vite preview` (ideally with the `--base` flag matching the real deployment path) is a cheap, fast check that catches this exact class of mistake before it ever reaches a live URL.
