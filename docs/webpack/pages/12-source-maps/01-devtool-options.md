---
title: "Source Maps: The `devtool` Speed/Quality/Production Tradeoff"
sidebar_label: "Source Maps"
sidebar_position: 1
---

# ⚙️ Source Maps: The `devtool` Speed/Quality/Production Tradeoff

## 1. Under-The-Hood Mechanics

A source map is a JSON file mapping positions in the **transformed, bundled** output back to positions in the **original, authored** source — without one, a runtime error's stack trace points at minified/bundled line 1, column 48291, useless for debugging.

`devtool` is not one setting but a **combination of independent flags** encoded in a single string, each trading build/rebuild speed against source map fidelity:

```
devtool: 'eval-cheap-module-source-map'
             │      │      │       │
             │      │      │       └── 'source-map' — a full, separate .map file (most accurate)
             │      │      └── 'module' — maps back through LOADER transforms too (e.g. Babel's output), not just bundling
             │      └── 'cheap' — line-only mapping (no column info) — faster to generate, less precise
             └── 'eval' — wraps each module in eval() with an inline //# sourceURL comment — fastest rebuild,
                             but the sourcemap itself is INLINE per-module rather than one combined file
```

### Common Choices by Environment
- **Development**: `'eval-cheap-module-source-map'` — prioritizes rebuild speed (via `eval`) while still mapping through loader transforms (`module`) so a Babel/TS-transpiled line points at genuinely correct original source.
- **Production, debugging needed**: `'source-map'` — a real, separate, fully-accurate `.map` file. Slowest to generate, but highest fidelity — typically **not** served publicly; instead uploaded directly to an error-tracking service (Sentry, Bugsnag).
- **Production, hiding source from the public**: `'hidden-source-map'` — generates the `.map` file (for internal error-tracking upload) but does **not** emit the `//# sourceMappingURL` comment in the bundle, so browsers never fetch/expose it to end users inspecting the deployed site.

---

## 2. Real-World Engineering Scenario

**Scenario**: Production Error Tracking Without Exposing Proprietary Source Code Publicly.
A SaaS company wants Sentry to show fully-demangled, original-TypeScript stack traces for production errors, but doesn't want competitors opening browser dev tools on the live site and reading un-minified source via a public source map. `devtool: 'hidden-source-map'` generates the `.map` files during the production build; a CI step uploads them directly to Sentry's API (associating them with that release's build hash) and then **deletes them before deployment** — the live site serves fully minified JS with no `sourceMappingURL` reference at all, while Sentry's dashboard still shows perfectly readable original-source stack traces for any error that occurs.

---

## 3. Production-Grade Code Example

```javascript
// webpack.config.js
const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  devtool: isProd ? 'hidden-source-map' : 'eval-cheap-module-source-map',
};
```

```yaml
# .github/workflows/deploy.yml — upload-then-delete pattern for hidden-source-map
- run: yarn build   # emits dist/*.js and dist/*.js.map (no sourceMappingURL reference in the .js files)
- run: npx sentry-cli releases files "$RELEASE" upload-sourcemaps ./dist --url-prefix '~/static'
- run: find ./dist -name "*.map" -delete   # strip maps before the deploy step publishes the folder
- run: aws s3 sync ./dist s3://acme-static-assets/
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Shipping `eval`-Based Devtools to Production
```javascript
// ❌ WRONG: 'eval' variants wrap modules in eval() calls — a real CSP (Content-Security-Policy)
// violation risk in production (eval is often blocked), and inline source maps bloat the shipped bundle
devtool: 'eval-source-map', // fine for dev, NEVER for a production build

// ✅ CORRECT: production uses a real separate .map file, never eval-based inline maps
devtool: 'hidden-source-map',
```

### ⚠️ Pitfall 2: Publicly Serving Full `source-map` in Production
```javascript
// ❌ RISKY: plain 'source-map' emits a `//# sourceMappingURL=app.js.map` comment IN the bundle —
// anyone opening browser dev tools can now read fully de-minified, original source
devtool: 'source-map',

// ✅ CORRECT: hidden-source-map generates the same accurate map file for internal upload,
// WITHOUT the public-facing comment that invites browsers to fetch and expose it
devtool: 'hidden-source-map',
```

### ⚠️ Pitfall 3: Forgetting to Delete `.map` Files Before Deploying Static Assets
Even with `hidden-source-map` (no `sourceMappingURL` comment), if the `.map` files themselves are still deployed alongside the `.js` files, anyone who guesses or discovers the URL pattern (`app.[hash].js.map` sitting right next to `app.[hash].js`) can fetch and read it directly — the "hidden" in `hidden-source-map` only hides the *reference*, not the file's existence. The map must be deleted or excluded from the deployed asset folder entirely, as shown in the CI example above.
