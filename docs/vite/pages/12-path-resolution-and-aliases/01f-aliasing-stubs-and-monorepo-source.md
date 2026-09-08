---
title: "resolve.alias is a general specifier rewrite, so the same mechanism that maps '@' to 'src' can swap a real dependency for a stub or point a monorepo package at its own uncompiled source — and each use invites a different failure mode"
sidebar_label: "01f · Aliasing to stubs & monorepo source"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [Shared Options](https://vite.dev/config/shared-options), [Configuring Vite](https://vite.dev/config/), [Dependency Pre-Bundling](https://vite.dev/guide/dep-pre-bundling). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Aliasing to stubs & monorepo source

**`resolve.alias` never asked what the replacement file has to look like — it just substitutes a specifier for a string and hands the result to the resolver.** Everything in this page is that one primitive applied to two purposes the documentation never singles out by name: swapping a real package for a lightweight stand-in (a stub, a mock, a no-op), and pointing an alias at another package's uncompiled source instead of its published, built output. Both are legitimate, both are common, and both trade a documented convenience for a cost that is easy to forget once the alias is working and nobody looks at it again.

## Aliasing a dependency to a stub or shim

Nothing about `resolve.alias` restricts the replacement to "another location of the same package" — the object and array forms shown in [01](01-resolve-options.md) accept any specifier-to-path mapping, including one where the target is a hand-written file that shares only an import surface with the thing it replaces.

```typescript
// vite.config.ts — swap a heavy analytics SDK for a no-op in every environment
// except the one production build variant that actually wants it
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      '@acme/analytics':
        mode === 'production-with-telemetry'
          ? '@acme/analytics' // real package — no rewrite when the key equals itself would be a no-op; see below
          : path.resolve(import.meta.dirname, 'src/stubs/analytics-noop.ts'),
    },
  },
}));
```

```typescript
// src/stubs/analytics-noop.ts — the stub's whole job is to satisfy the same
// import surface the real package exposes, with none of the real behavior
export function track(_eventName: string, _payload?: Record<string, unknown>): void {
  // intentionally empty — every call site imports this exactly like the real SDK
}

export function identify(_userId: string): void {
  // intentionally empty
}
```

That commented-out branch above is worth calling out directly: aliasing a key to *itself* is not a safe way to express "don't alias in this case," because the alias table still substitutes the key for the given replacement string and then hands the result to the resolver — writing `'@acme/analytics': '@acme/analytics'` produces a specifier that must now resolve through the *same table again*, which either loops or, more likely, is caught and treated as resolving to the real package by virtue of not actually being a distinct rewrite. The safe way to express "alias in some modes, not others" is to only add the key to the `alias` object when the stub should apply, and omit it entirely otherwise:

```typescript
// vite.config.ts — the safe conditional form: the key is only present when it
// should rewrite; when the condition is false, resolve.alias has no entry for
// '@acme/analytics' at all, and normal node_modules resolution takes over
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      ...(mode === 'production-with-telemetry'
        ? {}
        : { '@acme/analytics': path.resolve(import.meta.dirname, 'src/stubs/analytics-noop.ts') }),
    },
  },
}));
```

Because `resolve.*` options are not documented as dev-only the way pre-bundling explicitly is — *"Dependency pre-bundling only applies in development mode"* — a stub aliased in `vite.config.ts` applies uniformly to the dev server and to `vite build`. That uniformity is exactly what makes this pattern reliable for excluding a real, possibly Node-only or credentials-requiring SDK from a build variant that should never ship it: there's no separate "and remember to also exclude it from build" step.

## Aliasing to another package's source in a monorepo

The same mechanism, pointed at a sibling package's `src/` directory instead of its built output, is the standard way to get instant HMR across a monorepo package boundary during development — no watch-and-rebuild step for the shared package, because there's no build in the loop at all:

```typescript
// vite.config.ts — app package aliases a monorepo sibling straight to source
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@acme/ui-kit': path.resolve(import.meta.dirname, '../../packages/ui-kit/src'),
    },
    // if ui-kit and the app both depend on react, this pairing is doing double duty:
    dedupe: ['react', 'react-dom'],
  },
});
```

```typescript
// src/App.tsx — imports the SAME package name a published consumer would use;
// only the config decides whether that name means "npm install" or "sibling src"
import { Button } from '@acme/ui-kit';
```

This is exactly the pattern the seed content on this topic reached for, and it works — with three costs that are easy to lose track of once it's set up and quietly working.

**Cost one — a published consumer resolves a different tree than a monorepo consumer does.** Anyone installing `@acme/ui-kit` from a registry gets its built `dist/`, going through whatever `main`/`module`/`exports` fields the package declares. The app aliased to `src` bypasses all of that and imports raw, uncompiled source directly. A bug that only manifests in the built output — a bundler-specific transform, a missing polyfill the build step normally injects, an `exports` map entry the source-aliased path never goes through — is invisible from inside the monorepo and only surfaces for a real external consumer.

**Cost two — the alias needs the same tsconfig mirroring covered in [01a](01a-tsconfig-paths-and-vite-alias.md).** `resolve.alias` pointing `@acme/ui-kit` at source tells Vite's resolver where the files are; it tells TypeScript nothing. Without a matching `tsconfig.json` `paths` entry (or `resolve.tsconfigPaths`/`vite-tsconfig-paths` covering it), the type-checker resolves `@acme/ui-kit` through its own `node_modules` lookup — which may point at a stale, previously-built copy, or fail outright if the package was never actually published and only ever exists as monorepo source.

**Cost three — a shared runtime dependency needs `resolve.dedupe`, not just the alias.** Aliasing straight to source means the sibling package's imports of `react` are now resolved as part of the *app's* module graph rather than through the sibling's own, separately-installed `node_modules/react` — exactly the shape covered in [01d](01d-resolve-dedupe.md) as the setup for a two-instances bug. The `dedupe` line in the example above is not optional decoration; without it, the source-aliased package and the app can end up on two different `react` resolutions the moment hoisting doesn't unify them.

```typescript
// tsconfig.json — the mirroring 01a requires, specifically for the source alias
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@acme/ui-kit": ["../../packages/ui-kit/src/index.ts"]
    }
  }
}
```

## Combining both patterns: a stubbed monorepo package for one build variant

The two techniques compose directly, because they're the same primitive with different targets — a stub for a Storybook-only build that should never pull in a sibling package's real, heavier implementation:

```typescript
// vite.config.ts — Storybook build config: the real design-system package is
// aliased to source for normal apps, but Storybook itself gets a stub for the
// one component that pulls in a native dependency Storybook's environment lacks
import { defineConfig } from 'vite';
import path from 'node:path';

const isStorybook = process.env.STORYBOOK === 'true';

export default defineConfig({
  resolve: {
    alias: {
      '@acme/native-charts': isStorybook
        ? path.resolve(import.meta.dirname, 'src/stubs/native-charts-stub.tsx')
        : path.resolve(import.meta.dirname, '../../packages/native-charts/src'),
    },
    dedupe: ['react', 'react-dom'],
  },
});
```

## Gotchas

**★ Symptom: an alias meant to conditionally apply a stub ("alias to the real package in this one mode") produces a resolution loop or silently resolves to something unexpected.** Cause: aliasing a key to itself (`'@acme/analytics': '@acme/analytics'`) is not a documented no-op — the substituted specifier is the same string, which still has to go through the alias table and the resolver again, rather than being recognized as "skip aliasing here." Fix: only include the key in the `alias` map when the stub should actually apply; omit the key entirely for the branch where the real package should resolve normally.

**★ Symptom: a bug appears only in a real, separately-installed consumer of a monorepo package, never inside the monorepo itself, and the code paths look identical.** Cause: the monorepo app aliases the package straight to `src/`, bypassing the package's own build step (and whatever `main`/`module`/`exports` resolution a real installer would go through); the built `dist/` a real consumer receives is a genuinely different artifact than the source the monorepo imports directly. Fix: periodically test against the actual built package (e.g. by installing the real published or packed tarball in a throwaway consumer), rather than trusting that "it works in the monorepo" is equivalent to "it works when installed."

**★ Symptom: aliasing a monorepo package to source works at runtime, but the editor reports `Cannot find module '@acme/ui-kit'` or resolves it to a stale, previously-published version's types.** Cause: `resolve.alias` never touches TypeScript's own resolution — this is the same two-resolvers gap covered in [01a](01a-tsconfig-paths-and-vite-alias.md), and it applies identically whether the alias target is a `src/` folder or an ordinary directory. Fix: mirror the alias into `tsconfig.json`'s `paths`, or enable `resolve.tsconfigPaths`/`vite-tsconfig-paths` so one file drives both resolvers.

**★ Symptom: a component from a source-aliased monorepo sibling throws "Invalid hook call" the moment `react` versions in the two packages drift even slightly during a dependency bump.** Cause: source-aliasing routes the sibling's imports through the *app's* module graph, meaning the sibling's `react` import is now resolved as part of the app's own resolution rather than through its own separately-installed copy — precisely the setup [01d](01d-resolve-dedupe.md) describes as the precondition for the two-instances bug. Fix: add the shared runtime dependency to `resolve.dedupe` alongside the source alias; it is not an optional accompaniment, it is what keeps the source-aliasing pattern from reintroducing the bug it otherwise has no defense against.

**★ Symptom: a stub aliased for tests/Storybook accidentally ships in the real production build, because a mode string was typo'd or the condition was inverted.** Cause: `resolve.alias` applies uniformly across dev and build — there's no separate build-time confirmation step, so a wrong condition doesn't fail loudly, it just silently ships the stub (or, worse, ships the real heavy dependency in a variant meant to exclude it). Fix: make the condition an explicit, narrow allowlist for the branch that wants the *real* package (as shown above), rather than a broad negative condition for the stub — a missing or mistyped mode value then defaults to the safer, stubbed behavior instead of silently shipping the real one.

## Interview questions

**★ Why doesn't `resolve.alias: { pkg: pkg }` work as a way to say "resolve this normally, no override"?**
Because the alias table doesn't special-case a replacement value that happens to equal its own key — it substitutes exactly what was written and hands the result to the resolver, the same as any other entry. Writing the key at all means "there is a rule for this specifier," and the correct way to say "no rule applies here" is to not include the key in the map for that branch of the config, not to write a self-referential entry and hope it's treated as a pass-through.

**★ A team aliases a shared design-system package straight to its `src/` directory for fast local development. What does that alias skip, and why does it matter?**
It skips the package's own build step and whatever module-resolution fields (`main`, `module`, `exports`) a real installed consumer would go through — the app importing the alias sees raw, uncompiled source, not the artifact anyone outside the monorepo actually receives. It matters because a defect specific to the build transform, or a resolution difference between the built entry point and the raw source entry, is invisible from inside the monorepo and only shows up once someone actually installs the published package — often much later, and much harder to attribute back to "the alias hid this."

**★ Why does aliasing a monorepo package to source make `resolve.dedupe` more important, not less?**
Because the alias moves the sibling package's dependency resolution *into* the app's own module graph rather than leaving it as a self-contained, separately-installed tree. Before the alias, the sibling package's `react` import was resolved inside its own `node_modules`, wherever that landed; after the alias, that same import is resolved as if it were written inside the app, using the app's resolution rules. If the app and the sibling's own declared `react` versions don't hoist to one copy, that's the exact precondition for the two-React-instances bug — so a source alias to a package that itself depends on a shared runtime library should be treated as needing `resolve.dedupe` by default, not as an optional afterthought.

**★ What's the actual difference between "aliasing to a stub" and "aliasing to source," given that both are the same `resolve.alias` mechanism?**
Only the intent, and correspondingly, the cost each one hides. A stub deliberately breaks behavioral fidelity with the real package to remove weight, side effects, or an environment dependency — its risk is shipping the fake version somewhere the real one was needed, usually from a wrong or missing condition. A source alias preserves full behavioral fidelity but breaks build fidelity — its risk is that the monorepo's dev experience diverges from what a real installed consumer gets, because the built artifact and the raw source are not guaranteed identical. Both are the identical config primitive; the failure modes come entirely from what's on the other end of the substitution.

---

← [01e · preserveSymlinks & linked packages](01e-preserve-symlinks-and-linked-packages.md) · [Vite overview](../../README.md) · Next → [01g · The exports field](01g-the-exports-and-imports-fields.md)
