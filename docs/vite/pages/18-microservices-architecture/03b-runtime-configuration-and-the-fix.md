---
title: "The fix for baked-in service URLs is to build one artefact that reads its configuration from the environment it is running in at container start, not from a value vite build already deleted"
sidebar_label: "03b · Runtime configuration"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode.md), [Shared Options](https://vite.dev/config/shared-options.md), [Public Base Path](https://vite.dev/guide/build#public-base-path), [Migration from v7](https://vite.dev/guide/migration.md). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

# ⚡ Runtime Configuration and the Fix

**[03](03-service-urls-are-baked-in-at-build-time.md) establishes that `import.meta.env` is
gone by the time a bundle ships — this chunk is what to do about it: build one artefact with
no per-environment values inside it, and hand it its configuration from the environment it is
actually running in, at container start, not at `vite build` time.** Two concrete shapes for
that, a decision rule for when baking in is still fine, and the option that deletes the
problem outright when it applies.

## Option A — a `/config.json` fetched before the app renders

The container's entrypoint writes the file from real environment variables using `envsubst`,
after the image — built once — starts:

```bash
#!/bin/sh
# docker-entrypoint.sh — runs every time the container starts, never at
# `vite build` time. ORDERS_API_URL and PAYMENTS_API_URL are real container
# environment variables, injected by the orchestrator (Kubernetes Secret/
# ConfigMap, ECS task definition, etc.) — never .env files baked into the image.
set -eu

envsubst '${ORDERS_API_URL} ${PAYMENTS_API_URL}' \
  < /usr/share/nginx/html/config.template.json \
  > /usr/share/nginx/html/config.json

exec "$@"
```

`config.template.json`, shipped inside the image, never rewritten:

```json
{
  "ordersApiUrl": "${ORDERS_API_URL}",
  "paymentsApiUrl": "${PAYMENTS_API_URL}"
}
```

A typed accessor is what the application code imports — never `import.meta.env` directly,
outside this one module:

```ts
// src/config/runtime-config.ts
interface AppConfig {
  ordersApiUrl: string;
  paymentsApiUrl: string;
}

let cached: AppConfig | undefined;

export async function loadConfig(): Promise<AppConfig> {
  if (cached) return cached;

  if (import.meta.env.DEV) {
    // No container, no entrypoint, no /config.json in `vite dev` — fall
    // back to build-time values so local dev still boots. This is the one
    // place import.meta.env is allowed to leak through the accessor.
    cached = {
      ordersApiUrl: import.meta.env.VITE_ORDERS_API ?? 'http://localhost:4001',
      paymentsApiUrl: import.meta.env.VITE_PAYMENTS_API ?? 'http://localhost:4002',
    };
    return cached;
  }

  // BASE_URL, unlike the service URLs, is legitimately baked in — it is a
  // property of where this artefact is hosted, not of which backend it
  // talks to. Using it here means the fetch still works under a non-root base.
  const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`runtime config fetch failed with status ${res.status}`);
  }
  cached = (await res.json()) as AppConfig;
  return cached;
}
```

```ts
// src/main.tsx — the fetch happens before the app renders, so every
// component downstream can assume config is already resolved.
import { createRoot } from 'react-dom/client';
import { loadConfig } from './config/runtime-config';
import { App } from './App';

loadConfig().then((config) => {
  createRoot(document.getElementById('root')!).render(<App config={config} />);
});
```

## Option B — `window.__APP_CONFIG__` inlined into `index.html`

Same source, one fewer network round trip: the container inlines the config directly into the
served HTML instead of a sibling file.

```html
<!-- index.html, served by the container. This script tag's body is the one
     that config.template.json substituted into config.json above; here it
     is inlined directly instead of fetched. -->
<script>
  window.__APP_CONFIG__ = {
    "ordersApiUrl": "${ORDERS_API_URL}",
    "paymentsApiUrl": "${PAYMENTS_API_URL}"
  };
</script>
<script type="module" src="/assets/main.js"></script>
```

The accessor reads `window.__APP_CONFIG__` synchronously instead of `fetch`-ing, with the same
dev fallback to `import.meta.env`. The classic `<script>` tag runs before the `type="module"`
script that follows it, so the global is guaranteed to exist by the time the app's own code
runs — module scripts are deferred by default, classic ones are not.

## The decision rule

**Bake it in when the value is per-build**: a feature flag decided at compile time, `base`
(the deploy path is a property of *where this artefact is hosted*, decided once per build —
see [15 · base and the deploy path](../15-deployment-considerations/01-shipping-the-build.md)),
a build number, anything that is genuinely fixed for the life of that artefact.

**Inject it at runtime when the value is per-environment**: a service URL, a tenant id, a
region, anything that differs between the dev/staging/prod copies of what is otherwise the
same code. If promoting the same build to the next environment should not require a rebuild,
the value it depends on cannot be behind `import.meta.env`.

`define`'s object-copy behaviour is part of why it is the wrong tool here rather than a
smaller version of the same fix: Vite 8 states that

> *"`define` does not share reference for objects: When you pass an object as a value to
> `define`, each variable will have a separate copy of the object."* —
> [Migration from v7](https://vite.dev/guide/migration.md)

so `define` cannot even hold a single live, mutable configuration object under two names, let
alone one that changes after the build finished. A service-URL registry needs to be one object,
mutated or replaced once, visible everywhere it is read — `define` was never a candidate for
that; `fetch` plus a module-level singleton, or `window.__APP_CONFIG__`, are.

## Same-origin relative paths remove the problem entirely

The cleanest fix is not injecting the URL faster — it is not needing one. If a gateway or
reverse proxy fronts every backend service under the frontend's own origin, the frontend never
holds an absolute service URL at all:

```ts
// No VITE_ORDERS_API, no runtime config fetch, no per-environment value.
// The gateway routes /api/orders/* to the orders service in every
// environment identically — the frontend code is unaware anything changed.
const res = await fetch('/api/orders/current');
```

`/api/orders` resolves against whatever origin served the page, so the *same* bundle works
unmodified in dev (proxied by the dev server or a local gateway), staging and prod, provided
each environment's gateway routes that path to the right backend. This is usually the right
answer for a frontend-facing API surface precisely because it deletes the promotion problem
instead of engineering around it — see
[12 · resolve.alias fundamentals](../12-path-resolution-and-aliases/01-resolve-options.md) for
the equivalent bundler-side idea of substituting a specifier rather than carrying an absolute
one. It stops being available the moment the frontend and backend are not behind a shared
origin at all — a CDN-hosted SPA calling services in a different cloud account, a mobile
WebView with no reverse proxy in front of it, or a remote consumed cross-origin under Module
Federation. In those cases runtime configuration is not a fallback, it is the only option.

## Gotchas

**Symptom: two `define` keys were set to what looked like the same config object, and
mutating one at runtime silently does not affect the other.** Cause: Vite 8's `define` gives
each replacement a separate copy of an object value, never a shared reference — the same
limitation that rules `define` out as a runtime-config mechanism in the first place. Fix: do
not use `define` for anything that needs to be one live, mutable object; use the `fetch` or
`window.__APP_CONFIG__` pattern above instead.

**★ Symptom: a runtime `/config.json` is deployed with the correct new service URL, but the
running app keeps using the old one for hours.** Cause: the file was served with the same
long-lived cache headers as the hashed, immutable JS bundle — CDNs and browsers cache it
accordingly. Fix: serve `/config.json` with `Cache-Control: no-store` (the fetch above already
requests `cache: 'no-store'` client-side) or version its filename alongside a deploy.

**Symptom: `envsubst` corrupts unrelated `${...}` text elsewhere in `config.template.json` or
`index.html` — a real template literal, a CSS custom-property reference — that was never meant
to be substituted.** Cause: bare `envsubst` with no argument substitutes *every* shell-style
variable reference it finds in the input, not just the ones you defined. Fix: pass the
explicit variable list — `envsubst '${ORDERS_API_URL} ${PAYMENTS_API_URL}'` — so only those two
names are touched, as shown in the entrypoint script above.

**Symptom: `fetch('/config.json')` 404s once the app is deployed under a non-root `base`
(`/orders-ui/`).** Cause: the fetch used an absolute root-relative path, but the app and its
`config.json` are served under a sub-path. Fix: build the URL from
`import.meta.env.BASE_URL` (itself a legitimately baked-in, per-build value) rather than a
literal `/config.json`, as in the accessor above.

**★ Symptom: after migrating to runtime configuration, dev behaviour and prod behaviour of the
same code diverge in a way nobody can reproduce locally.** Cause: the migration was partial —
some call sites still read `import.meta.env.VITE_ORDERS_API` directly (build-time, works in
dev, frozen in prod) while others go through the new accessor (runtime, changes without a
rebuild). Fix: make the typed accessor the *only* import path for these values and lint
against direct `import.meta.env.VITE_*` access anywhere else in the codebase.

**Symptom: relative `/api/orders` calls 404 or hit CORS errors in one environment but not
another.** Cause: same-origin relative paths assume a gateway fronts every environment
identically; a CDN-hosted frontend calling a backend in a different origin (different domain,
different cloud account, a Module Federation remote consumed cross-origin) has no shared
origin to resolve against. Fix: confirm every environment actually has the gateway in front of
it before adopting relative paths as the fix — where it does not, use runtime configuration
instead.

## Interview questions

**What does Vite 8's `define` object-copy behaviour rule out for a runtime-config design?**
Using `define` to hand out one shared, mutable configuration object under multiple names.
Vite 8 states each `define` target gets its own separate copy of an object value, not a
reference to the same one, so mutating a value reached through one name will not be visible
through another. That requirement — one object, mutated once, visible everywhere — is itself
the signal that the value belongs in runtime configuration and not in `define`, which is
correct for scalar constants but not for a live shared object.

**When is it correct to bake a value in rather than inject it at runtime?**
When the value is a property of the build itself rather than of the environment it runs in —
a feature flag decided at compile time, a build identifier, `base` (which encodes where this
specific artefact is hosted). The test is whether the same artefact, unmodified, should be
able to run in the next environment with a different value for that setting. If yes, it
belongs in runtime configuration; if the value is genuinely fixed for the life of the build,
baking it in is fine and simpler.

**★ Why does the "same origin, relative path" approach remove this problem entirely instead
of just working around it?**
Because it never puts an absolute, environment-specific value into the bundle in the first
place — `/api/orders` resolves against whatever origin served the page, so the identical
bundle is correct in every environment as long as each environment's gateway routes that path
correctly. There is nothing to bake in and nothing to inject, because the bundler-level
per-environment problem this whole page describes never arises.

**★ Why fetch `/config.json` with `cache: 'no-store'` instead of letting the browser cache
it normally?**
Because the whole point of runtime configuration is that the value can change without a
rebuild — an orchestrator can roll out a new `ORDERS_API_URL` to running containers, but if the
browser or an intermediate CDN caches `config.json` the way it caches a hashed, immutable JS
chunk, clients keep the stale value until the cache expires. `no-store` (plus real
`Cache-Control` headers on the response) keeps the fetch honest about being per-request.

**Why does `envsubst` need an explicit variable list in the entrypoint script rather than
running unrestricted?**
Because unrestricted `envsubst` rewrites every `${...}`-shaped token in the input, not just the
ones the script intends to substitute — a real template literal or CSS custom property using
the same syntax would be silently corrupted. Passing the explicit list —
`envsubst '${ORDERS_API_URL} ${PAYMENTS_API_URL}'` — scopes the substitution to exactly the
names the container is meant to inject.

**Why does the accessor build the `/config.json` URL from `import.meta.env.BASE_URL` instead
of a literal `/config.json`?**
Because `base` — and therefore `BASE_URL` — is a legitimately per-build value under the
decision rule: it is baked in once, correctly, because it describes where this artefact is
hosted. A literal root-relative `/config.json` breaks the moment the app is deployed under a
non-root `base`; deriving the fetch path from `BASE_URL` keeps the two in sync automatically.

---

{/* FOOTER */}
