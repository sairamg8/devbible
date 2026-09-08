---
title: "CRA's absolute imports worked from a single baseUrl with no alias map at all, which is a narrower feature than what Vite's resolve.alias or resolve.tsconfigPaths replace it with, and the mismatch is where the migration goes wrong"
sidebar_label: "01c · Absolute imports and aliases"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Create React App documentation — [Importing a Component](https://create-react-app.dev/docs/importing-a-component/), and the Vite documentation — [Shared Options](https://vite.dev/config/shared-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Absolute imports: CRA had one root, Vite's replacements support a real alias map

**CRA's "absolute imports" feature is narrower than what most teams assume it is once they start configuring Vite's equivalent.** CRA supports exactly one thing: a `baseUrl` that lets `src/components/Button` be written as `components/Button` from anywhere in the project. There is no alias *map* — no `@/` shorthand, no per-package alias, no way to point one specifier at a directory outside `src/`. Vite's ecosystem offers three different mechanisms with three different scopes, and picking the wrong one for what the CRA app actually had is the most common mistake in this part of the migration.

## What CRA actually provided — and what it used to provide

Current CRA docs describe exactly one mechanism, `baseUrl` in a `jsconfig.json` or `tsconfig.json`:

> *"You can configure your application to support importing modules using absolute paths. This can be done by configuring a `jsconfig.json` or `tsconfig.json` file in the root of your project."* — [Importing a Component](https://create-react-app.dev/docs/importing-a-component/)

```json
// jsconfig.json (JS projects) or tsconfig.json (TS projects) — CRA's ENTIRE mechanism
{
  "compilerOptions": {
    "baseUrl": "src"
  },
  "include": ["src"]
}
```

```javascript
// BEFORE this file existed
import Button from '../../../components/Button';

// AFTER — resolved relative to baseUrl ("src"), from ANY file, at ANY depth
import Button from 'components/Button';
```

There is no `paths` map in this shape — CRA's own docs example uses `baseUrl` alone. An older CRA generation supported this via a `NODE_PATH=src` entry in `.env` instead; that mechanism was removed in favour of `baseUrl`, which is the only one current CRA documents. If you find `NODE_PATH` in an old CRA app's `.env`, it maps to the same `baseUrl: "src"` idea, not to anything richer.

## Why "just add `resolve.alias`" under-delivers, and why "just flip on `tsconfigPaths`" can over-deliver

A CRA app with only `baseUrl: "src"` has no alias *names* to carry over — every unprefixed bare import resolves against `src/` as a fallback root. Vite's `resolve.alias` is the wrong tool for this specifically, because `resolve.alias` matches literal prefixes you name one at a time; it does not implement "fall back to this whole directory for any bare specifier that isn't a real package." That behaviour — a `baseUrl` with no `paths` map — is what `vite-tsconfig-paths` documents explicitly, already quoted in full detail in **[12 · tsconfig paths vs resolve.alias](../12-path-resolution-and-aliases/01a-tsconfig-paths-and-vite-alias.md)**:

> *"If the `baseUrl` is defined, it gets prepended to all bare imports, and its resolution will take precedence over `node_modules`."* — [`vite-tsconfig-paths`](https://github.com/aleclarson/vite-tsconfig-paths)

That is the CRA behaviour, reproduced faithfully — but it comes with the same warning that chunk gives for any project: a `baseUrl` this broad reroutes *every* bare import, not just the ones you meant to shorten, so a source file named `utils.ts` or `types.ts` at the project root can shadow a same-named `node_modules` package. CRA had this exact risk the whole time; it is not new to Vite, but it is easy to mistake for a Vite-specific footgun during the migration.

Vite 8's first-party `resolve.tsconfigPaths` is a **narrower** tool than the plugin — it reads `tsconfig.json`'s `paths` map specifically, and does not implement the plugin's "any bare import falls back to `baseUrl`" behaviour on its own. A CRA app whose `tsconfig.json` has only `baseUrl` and no `paths` gets nothing from turning on `resolve.tsconfigPaths` alone, because there is no `paths` entry for it to read.

## Three shapes, matched to what the CRA app actually had

```typescript
// A — CRA had baseUrl only, no paths map. Reproduce it with vite-tsconfig-paths,
// which is the one option that implements the "any bare import falls back to
// baseUrl" behaviour CRA relied on.
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
});
```

```json
// tsconfig.json — unchanged from what CRA already had; nothing to add here
{
  "compilerOptions": {
    "baseUrl": "src"
  },
  "include": ["src"]
}
```

```typescript
// B — the CRA app also had a real paths map (added post-CRA, or hand-maintained
// alongside baseUrl for a `@/` shorthand). resolve.tsconfigPaths reads it directly,
// no extra dependency.
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
});
```

```json
// tsconfig.json — an explicit paths map, not just baseUrl
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

```typescript
// C — a hand-rolled resolve.alias, kept in sync with tsconfig.json by hand.
// Only ever a deliberate starting point, never the end state — see the
// two-independent-resolvers problem in full at 12/01a.
// vite.config.ts
resolve: {
  alias: { '@': path.resolve(import.meta.dirname, 'src') },
},
```

**Full treatment of the drift risk between `resolve.alias` and `tsconfig.json`'s `paths`, the `resolve.tsconfigPaths` flag's exact semantics (including that it does not apply inside `.less` files), and when to reach for `vite-tsconfig-paths` over the native option — all already written, do not re-derive:** **[12 · tsconfig paths vs resolve.alias](../12-path-resolution-and-aliases/01a-tsconfig-paths-and-vite-alias.md)**.

## Gotchas

**★ Symptom: a CRA app had `baseUrl: "src"` and no `paths` map; after adding `resolve.tsconfigPaths: true` to `vite.config.ts`, every previously-working absolute import (`import Button from 'components/Button'`) fails to resolve.** Cause: `resolve.tsconfigPaths` reads `tsconfig.json`'s `paths` map — with no `paths` entries, there is nothing for it to read, so `baseUrl`-only resolution is not reproduced at all. Fix: use `vite-tsconfig-paths` instead, which implements the `baseUrl`-as-fallback-root behaviour the native flag does not.
```typescript
plugins: [react(), tsconfigPaths()],
```

**★ Symptom: after switching from CRA to a `baseUrl`-reproducing plugin, a bare import of a real npm package suddenly resolves to a same-named file in `src/` instead.** Cause: a broad `baseUrl` (`"."` or `"src"` pointed at the project root rather than scoped tightly) reroutes *every* bare import through it ahead of `node_modules` — this is documented plugin behaviour, not a bug, and CRA had the identical exposure the whole time, just with fewer people noticing because CRA apps rarely name a source file after a well-known package. Fix: scope `baseUrl` tightly, or rename the colliding source file.

**★ Symptom: a teammate copied a `resolve.alias` snippet from a blog post that also has a matching `tsconfig.json` `paths` entry, and now the editor and the dev server disagree about whether an alias resolves.** Cause: this is the two-independent-resolvers problem, not specific to the migration — `resolve.alias` and `tsconfig.json`'s `paths` are read by two different programs that do not consult each other. Fix: see **[12 · tsconfig paths vs resolve.alias](../12-path-resolution-and-aliases/01a-tsconfig-paths-and-vite-alias.md)** for both drift directions and their fixes; do not maintain both files by hand once either `resolve.tsconfigPaths` or `vite-tsconfig-paths` is an option.

**★ Symptom: `NODE_PATH=src` still sits in an old CRA app's `.env`, and it has no effect at all under Vite — no error, just silent non-resolution.** Cause: `NODE_PATH` was CRA's older, now-removed mechanism for the same `baseUrl` behaviour; Vite never read `NODE_PATH` for module resolution and CRA itself stopped supporting it in favour of `baseUrl` in `jsconfig.json`/`tsconfig.json`. Fix: check whether the app also has a `jsconfig.json`/`tsconfig.json` with `baseUrl` set (the actual CRA mechanism in effect) and migrate that; a bare `NODE_PATH` line with nothing else is dead configuration to delete, not migrate.

## Interview questions

**★ Why does turning on `resolve.tsconfigPaths` sometimes do nothing at all for a migrated CRA app, even though the app clearly had absolute imports working under CRA?**
Because `resolve.tsconfigPaths` specifically reads `tsconfig.json`'s `paths` map, and CRA's own documented mechanism is `baseUrl` alone, with no `paths` map required or even mentioned in CRA's docs. A `tsconfig.json` with `baseUrl: "src"` and no `paths` key gives the native Vite flag nothing to act on. The behaviour CRA actually implements — "any bare import that isn't a real package falls back to this directory" — is closer to what `vite-tsconfig-paths` documents about its own `baseUrl` handling than to what the native, `paths`-only flag does, which is the reason the plugin, not the native option, is usually the correct like-for-like replacement for a CRA app's absolute imports specifically.

**★ A CRA app's `baseUrl` was set to `"."` (the repo root) rather than `"src"`. Why is that worth flagging as a problem to fix during the migration, not just carrying over as-is?**
Because a root-scoped `baseUrl` reroutes every bare import in the project through the repository root before falling back to `node_modules`, which means any source file at the root sharing a name with an installed package — `config.ts`, `types.ts`, `utils.ts` are all common enough — silently shadows that package for every bare import in the codebase. This was already true under CRA if it used the same mechanism, but a migration is the natural point to audit it, since you are already touching every resolution-related config file in the same pass; narrowing `baseUrl` to `"./src"` removes the entire class of collision without changing any import statement.

**★ What's the fastest way to tell whether a CRA app's absolute-import setup needs `vite-tsconfig-paths`, `resolve.tsconfigPaths`, or a plain `resolve.alias`, before writing any Vite config at all?**
Open the existing `jsconfig.json` or `tsconfig.json` and check for a `paths` key. No `paths`, `baseUrl` only → `vite-tsconfig-paths` (the plugin implements the fallback-root behaviour the native flag does not). A real `paths` map present → `resolve.tsconfigPaths: true` is sufficient and is the smaller dependency footprint. Neither file exists, and the app used some other, non-standard resolution trick (a webpack alias added via CRACO, covered in **[01f](01f-eject-and-craco-codebases.md)**) → read what that trick actually did before choosing any of the three, because none of them reproduce an arbitrary webpack `resolve.alias` block automatically.

---

← [01b · File extensions](01b-file-extensions-and-the-jsx-transform.md) · [Vite overview](../../README.md) · Next → [01d · SVG imports](01d-svg-imports.md)
