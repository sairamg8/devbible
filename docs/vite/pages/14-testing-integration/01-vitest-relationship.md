---
title: "Testing Integration: Vitest's Shared Config & Transform Pipeline"
sidebar_label: "Testing Integration"
sidebar_position: 1
---

# ⚡ Testing Integration: Vitest's Shared Config & Transform Pipeline

## 1. Under-The-Hood Mechanics

Vitest (a test runner built specifically to pair with Vite) reuses **the exact same** `vite.config.ts` transform pipeline that powers the dev server and production build — meaning tests run through the identical module resolution, TypeScript/JSX stripping, path aliasing, and plugin transforms as the actual application, with zero separate test-specific transform configuration required.

```
vite.config.ts
        │
        ├── used by: vite (dev server)
        ├── used by: vite build (production build)
        └── used by: vitest (test runner) ──► SAME resolve.alias, SAME plugins, SAME esbuild transform settings
```

### Why This Matters: No Separate Jest-Style Transform Config to Maintain
A Jest-based setup typically requires its own, **separately maintained** transform configuration (`babel-jest`, `ts-jest`, module name mapping for aliases) that can drift out of sync with the actual app's real build configuration — a path alias added to `vite.config.ts` but forgotten in Jest's `moduleNameMapper`, for instance, works in the app but breaks in tests (or vice versa). Vitest eliminates this entire class of drift by reading the **same config file**, guaranteeing test-time module resolution and transforms are identical to the actual dev/build pipeline, by construction.

### Shared Plugin Ecosystem
Since Vitest processes files through the same Vite plugin pipeline, a custom Vite plugin (e.g. one handling a special import suffix, or transforming a non-standard file type) works identically whether the code is being served by the dev server or executed inside a test — no separate test-environment plugin equivalent needs to be written or maintained.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Path Alias Working in the App But Breaking in Tests, Diagnosed as a Jest/Vite Config Drift Problem — Then Solved Permanently by Switching to Vitest.
A team using Jest alongside Vite had to hand-maintain a separate `moduleNameMapper` entry in `jest.config.js` mirroring every `resolve.alias` entry in `vite.config.ts` — inevitably, a newly-added alias was updated in one config but forgotten in the other, causing tests to fail with "Cannot find module '@/newFeature'" despite the app itself working fine. Migrating the test runner to Vitest eliminated this drift risk entirely: since Vitest reads `vite.config.ts` directly, any alias added there is **immediately and automatically** available in tests too, with no second config file to remember to update.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — ONE config file, serving dev server, build, AND test runner
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }, // automatically available in Vitest too, zero extra config
  },
  test: {
    // Vitest-specific options, layered into the SAME config file
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
});
```

```typescript
// A test file — the '@' alias just works, resolved identically to how the app resolves it
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/Button'; // SAME alias as vite.config.ts's resolve.alias, automatically

test('renders button label', () => {
  render(<Button label="Click me" />);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});
```

```bash
# package.json scripts — vitest reuses vite.config.ts automatically, no --config flag needed
npm run test        # "vitest"
npm run test:watch  # "vitest watch"
npm run test:ui      # "vitest --ui" — Vitest's own browser-based test UI
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Maintaining a Separate Test Config File "Just in Case," Reintroducing Drift
```typescript
// ❌ COUNTERPRODUCTIVE: creating a separate vitest.config.ts that DUPLICATES (rather than
// extends) vite.config.ts's resolve/plugins config reintroduces the exact same drift risk
// Vitest's shared-config design was meant to eliminate
// vitest.config.ts (separate, hand-duplicated alias config)
export default defineConfig({ resolve: { alias: { '@': './src' } } }); // now TWO places to keep in sync

// ✅ CORRECT: if test-specific options are genuinely needed, use mergeConfig to EXTEND
// the real vite.config.ts, not duplicate its resolve/plugin settings from scratch
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';
export default mergeConfig(viteConfig, defineConfig({ test: { environment: 'jsdom' } }));
```

### ⚠️ Pitfall 2: Assuming a Vite-Specific Plugin's Dev-Only Behavior (`apply: 'serve'`) Applies to Tests Correctly
Since Vitest goes through the same plugin pipeline, a plugin scoped with `apply: 'serve'` (dev-server-only, as covered in the [plugin system doc](../08-plugin-system/01-plugin-api.md)) may or may not run under Vitest depending on how Vitest's own execution context maps to Vite's `command`/`mode` — a plugin author relying on dev-only behavior should explicitly verify (and if necessary, test) how it behaves specifically under Vitest, rather than assuming `apply: 'serve'` cleanly maps to "runs in tests" or "doesn't run in tests" without checking.

### ⚠️ Pitfall 3: Forgetting Test Environment (`jsdom`/`node`) Is a Vitest-Specific Concern, Not Something Vite Itself Configures
`environment: 'jsdom'` (simulating a DOM for component tests) is entirely a Vitest concept — Vite itself has no notion of a "test environment," since it's not a test runner. Forgetting to set this for a component-testing project results in tests failing with `document is not defined`-style errors, since Vitest defaults to a plain Node environment unless configured otherwise.
