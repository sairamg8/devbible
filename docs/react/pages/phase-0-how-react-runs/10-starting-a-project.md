---
title: "Starting a React project in 2026"
sidebar_label: "10 · Starting a project"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. The scaffold, the install and the build below were really
> executed by `sandbox/react-p0/ex10-starting-a-project.mjs` — the file tree,
> pinned versions and byte counts are its output, not a description of it.

**Create React App is sunset. In 2026 you pick between a Vite SPA, a
React-Router framework app, and Next.js — and the choice is about the server,
not about React.**

## What `npm create vite` actually gives you

```console
$ npm create vite@latest shop -- --template react-ts
```

```console
  what you get:
  eslint.config.js …
  index.html
  package.json
  public/
  src/
    App.css
    App.tsx
    assets/
    index.css
    main.tsx
  tsconfig.app.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
```

```console
=== the dependencies it pins ===
  react                 ^19.2.8
  react-dom             ^19.2.8
  --- dev ---
  @types/node           ^24.13.3
  @types/react          ^19.2.17
  @types/react-dom      ^19.2.3
  @vitejs/plugin-react  ^6.0.4
  oxlint                ^1.75.0
  typescript            ~6.0.2
  vite                  ^8.2.0
```

Two things in that list are more current than most tutorials: the template now
ships **oxlint**, not ESLint, and it pins **TypeScript 6.0**, not 7. Neither is a
React decision — it is the template tracking its own ecosystem, and it is a good
reminder that "the React starter" is really "somebody's opinion about eight
other tools".

Ten files. No server, no routing, no data layer — those are yours to add.

## It builds in under a second

```console
=== installing and building for real ===
  vite v8.2.1 building client environment for production...
  transforming...✓ 20 modules transformed.
  rendering chunks...
  computing gzip size...
  dist/index.html                   0.45 kB │ gzip:  0.29 kB
  dist/assets/index-D64VDMd1.css    4.10 kB │ gzip:  1.47 kB
  dist/assets/index-CIXt1mP8.js   193.27 kB │ gzip: 60.62 kB
  ✓ built in 306ms
```

**193 kB raw, 61 kB gzipped, for an app that renders one screen.** Almost all of
that is React itself. That is the floor you start from, and it is the honest
number to weigh against "should this page be React at all".

Always verify a production build is actually a production build:

```console
=== is the production build really production? ===
  bundle                           index-CIXt1mP8.js
  occurrences of "Warning:"        0
  contains react-devtools message  false
  verdict                          production build
```

A production bundle contains no React warning strings. A non-zero count means
`process.env.NODE_ENV` was wrong and you are shipping the 1.1 MB development
build — see [StrictMode](07-strictmode.md) for the size difference.

## Create React App

```console
=== what does create-react-app do now? ===
  version 5.1.0, last published 2025-05-07
```

The sunset was announced on 14 February 2025. The package still exists on npm
and is **not** flagged as deprecated in its metadata, which is exactly why it
keeps appearing in tutorials and course material. It has not had a feature
release in years and its dependency tree is old enough to fail audits.

**Do not start anything with it.** If you inherit a CRA app, the migration
target is Vite, and it is usually a day of work: move `public/index.html` to the
root with a `<script type="module" src="/src/main.tsx">`, rename `.js` files
containing JSX to `.jsx`, and swap `process.env.REACT_APP_*` for
`import.meta.env.VITE_*`.

## The three real choices

| | **Vite SPA** | **React Router (framework)** | **Next.js** |
|---|---|---|---|
| Renders where | Browser only | Server + browser | Server + browser |
| Server Components | No | Yes | Yes |
| Hosting | Any static host | Node (or an adapter) | Node, or Vercel |
| Routing | You add it | Built in | File-based, built in |
| SEO on first paint | Poor without extra work | Good | Good |
| Learning surface | Smallest | Medium | Largest |
| Best when | You already have an Express/PERN API and ship a dashboard or an authenticated app | You want SSR and data loading without adopting a whole platform | Content-heavy or SEO-critical, and you want the ecosystem's default |

Measured versions today: **React Router 8.3.0**, **Next.js 16.3.0**,
`@vitejs/plugin-react` **6.0.5**.

**For this bible's MERN/PERN stack, the default is a Vite SPA.** You already have
an Express API doing auth, validation and database work; a second server that
also renders React adds a deployment target and a set of duplicated concerns for
a benefit — first-paint SEO — that an authenticated app does not have.

Choose a framework when the pages must be indexable, when first paint on a slow
connection is a business requirement, or when you specifically want Server
Components ([Phase 10](../../syllabus/03-concurrent-and-server.md)).

## A sensible starting configuration

```bash
npm create vite@latest shop -- --template react-ts
cd shop && npm install
npm install --save-dev --save-exact babel-plugin-react-compiler@latest
npm install --save-dev eslint-plugin-react-hooks
```

```js
// vite.config.ts
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({babel: {plugins: [['babel-plugin-react-compiler', {}]]}})],
  server: {
    // Talk to the Express API in development without CORS.
    proxy: {'/api': {target: 'http://localhost:3000', changeOrigin: true}},
  },
  build: {sourcemap: true},
});
```

The proxy line is the one people wish they had known: it makes `/api/...` calls
from the dev server hit your Express app, so you never configure CORS for
development and your fetch URLs match production.

## Gotchas

**Symptom:** `npx create-react-app my-app` still appears in a 2026 tutorial.
**Cause:** CRA is unmaintained but not marked deprecated on npm, so nothing
warns you.
**Fix:** use Vite. Treat the rest of that tutorial as equally dated.

**Symptom:** the production bundle is over a megabyte and full of warnings.
**Cause:** the build did not set `NODE_ENV=production`.
**Fix:** use the bundler's build command; verify by grepping for `Warning:`.

**Symptom:** `process is not defined` in the browser after migrating from CRA.
**Cause:** Vite does not shim Node globals; `process.env.REACT_APP_X` has no
meaning.
**Fix:** `import.meta.env.VITE_X`, and remember the `VITE_` prefix is what makes
a variable public.

**Symptom:** a direct visit to `/orders/42` returns 404 in production but works
in development.
**Cause:** the dev server rewrites unknown paths to `index.html`; your static
host does not.
**Fix:** configure the SPA fallback — `try_files $uri /index.html;` in Nginx.

**Symptom:** CORS errors calling your own API in development.
**Cause:** the Vite dev server and Express are different origins.
**Fix:** the `server.proxy` config above, rather than loosening CORS on the API.

## Interview questions

**★ What do you use to start a React project in 2026, and why not CRA?**
Vite for an SPA, or a framework (React Router or Next.js) if you need server
rendering. CRA was sunset in February 2025, is unmaintained, and is slow — but it
is not marked deprecated on npm, so it still shows up in tutorials.

**★ When would you choose a framework over a Vite SPA?**
When first paint and SEO matter, when you want Server Components, or when
server-side data loading and route-level code splitting are worth a second
deployment target. For an authenticated dashboard behind an existing Express
API, an SPA is usually the simpler correct answer.

**How big is a "hello world" React app?**
Measured here: 193 kB raw, 61 kB gzipped, for a one-screen Vite app. That is
essentially React's own floor.

**How do you know your production build is really a production build?**
Grep the output for React warning strings — a production bundle has none. The
development build is roughly 1.1 MB against 195 kB.

**How do you talk to an Express API from a Vite dev server?**
`server.proxy` in `vite.config.ts`, so `/api` requests are forwarded to the API's
port. Same-origin in development, so no CORS configuration and no URL differences
between environments.

---

← Prev: [What changed in React 19](09-what-changed-in-19.md) · Index: [Phase 0](README.md) · Next → [The React Compiler](11-the-compiler.md)
