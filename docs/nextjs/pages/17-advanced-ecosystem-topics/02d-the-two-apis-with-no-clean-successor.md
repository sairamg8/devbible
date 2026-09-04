---
title: "`getInitialProps` is the one Pages Router API the 16.3.4 migration guide names as replaced and then never explains, and `pages/api` is the one you are explicitly allowed never to migrate — the two outliers pull a schedule in opposite directions"
sidebar_label: "02d · The two APIs with no clean successor"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to migrate from Pages to the App Router](https://nextjs.org/docs/app/guides/migrating/app-router-migration) (`version: 16.3.4`, `lastUpdated: 2026-08-25`). The claim that the guide contains no `getInitialProps` recipe is a statement about that page's full contents, checked, not inferred.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified; **no sandbox run**.

**Two APIs break the pattern of the translation tables, in opposite directions. `getInitialProps` is listed once in the guide as replaced and then given no section, no example and no recipe — because its defining behaviour, running on the server *and* in the browser, has no counterpart in a model where a Server Component only ever runs on the server. It is the single largest unpriced item in most legacy migrations, and in `_app.js` it has no equivalent at all. `pages/api` is the opposite: the guide states plainly that API Routes keep working unchanged, which makes the entire endpoint surface something you can legitimately schedule for never. Getting these two right is what turns a migration estimate from fiction into a plan.**

## `getInitialProps` — the successor the documentation does not name

It appears exactly once in the 16.3.4 migration guide, in a list:

> *"[Data fetching] has changed in `app`. `getServerSideProps`, `getStaticProps` and `getInitialProps` have been replaced with a simpler API."*

⚠️ **And then never again.** `getServerSideProps` gets a section with before/after code. `getStaticProps` gets one. `getStaticPaths` gets one. `getInitialProps` gets no section, no example and no recipe anywhere on the page. That is a documented silence, reported here as a silence rather than filled in with an invented mapping.

What can be said without inventing anything: `getInitialProps` ran on the server for the first request and **in the browser** for subsequent client-side navigations — that is why its `context` had a `req` that was `undefined` half the time. That shape has no counterpart in a model where a Server Component runs only on the server. So there is no line-for-line translation; the function has to be split by where each half actually needs to run.

```jsx
// ❌ pages/product/[sku].js — one function, two environments
function Product({ product, viewerCurrency }) {
  return <h1>{product.name} — {viewerCurrency}</h1>;
}

Product.getInitialProps = async ({ query, req }) => {
  // `req` exists on the server pass and is undefined on client navigations.
  const currency = req ? req.headers['x-currency'] : window.localStorage.getItem('currency');
  const res = await fetch(`https://api.example.com/products/${query.sku}`);
  const product = await res.json();
  return { product, viewerCurrency: currency ?? 'USD' };
};

export default Product;
```

```tsx
// ✅ app/product/[sku]/page.tsx — the server half
import { headers } from 'next/headers';
import { CurrencyLabel } from './currency-label';

async function getProduct(sku: string) {
  const res = await fetch(`https://api.example.com/products/${sku}`);
  return res.json();
}

export default async function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = await params;
  const product = await getProduct(sku);
  const headerCurrency = (await headers()).get('x-currency');

  return (
    <h1>
      {product.name} — <CurrencyLabel fallback={headerCurrency ?? 'USD'} />
    </h1>
  );
}
```

```tsx
// ✅ app/product/[sku]/currency-label.tsx — the browser half, explicitly
'use client';
import { useEffect, useState } from 'react';

export function CurrencyLabel({ fallback }: { fallback: string }) {
  const [currency, setCurrency] = useState(fallback);

  useEffect(() => {
    const stored = window.localStorage.getItem('currency');
    if (stored) setCurrency(stored);
  }, []);

  return <span>{currency}</span>;
}
```

**The migration *is* the split, and the split is the point.** `getInitialProps` let you avoid deciding where code ran; the App Router makes you decide. Every legacy `getInitialProps` that branches on `typeof window` or on the presence of `req` is a comment left by a previous engineer telling you exactly where the boundary belongs. Grep for those branches first — they are a free design document.

### `_app.getInitialProps` is the case with no equivalent at all

Two properties made it special, and neither survives:

1. **It ran for every route, on both the server pass and every client navigation.** There is nothing in `app/` that means *"run this before every render of every route, in both environments."* A root layout runs on the server, and it does not re-run on every client navigation the way `_app.getInitialProps` did.
2. **It disabled Automatic Static Optimization application-wide.** So a codebase with it has *never* had a statically optimized page, and removing it during migration can change the rendering strategy of routes nobody touched.

```tsx
// ❌ pseudo-code — there is no app/ equivalent of this, and porting it to the
// root layout produces something with different timing and different scope.
// MyApp.getInitialProps = async (ctx) => ({ session: await getSession(ctx.req) })
```

```tsx
// ✅ app/(dashboard)/page.tsx — read it per request, in the segment that needs it
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySession } from '@/lib/auth';
import { Dashboard } from './dashboard';

export default async function DashboardPage() {
  const token = (await cookies()).get('session')?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) redirect('/login');

  return <Dashboard user={session.user} />;
}
```

⚠️ **This is the item that blows up estimates.** A `_app.getInitialProps` fetching a session, feature flags or an experiment assignment for every route is not a file to migrate; it is a cross-cutting concern to re-home in every consumer. Price it separately from the route count, and do it before you migrate the routes that depend on it, not after.

## `pages/api` → Route Handlers, and they coexist too

> *"API Routes continue to work in the `pages/api` directory without any changes. However, they have been replaced by [Route Handlers] in the `app` directory."*

**That first sentence is a scheduling gift and it is routinely wasted.** `pages/api` is the one part of a legacy codebase you can leave entirely alone: a fully App-Router-rendered front end can call `pages/api` endpoints indefinitely, and nothing in the docs sets a deadline. Migrate pages first and the API surface last — or never. Teams that migrate endpoints in parallel with routes double the surface under change for no user-visible benefit.

```js
// ❌ pages/api/projects.js — Node req/res
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const projects = await findProjects({ owner: req.query.owner });
  res.status(200).json({ projects });
}
```

```ts
// ✅ app/api/projects/route.ts — Web Request/Response
import { findProjects } from '@/lib/projects';

export async function GET(request: Request) {
  const owner = new URL(request.url).searchParams.get('owner');
  const projects = await findProjects({ owner });

  return Response.json({ projects });
}
```

Four changes, all structural rather than cosmetic:

1. **The HTTP method is the export name.** The `if (req.method !== 'GET')` branch disappears; a request with an unexported method is handled by the framework rather than by your `405`.
2. **`req.query` is gone.** Query parameters come from `new URL(request.url).searchParams`; dynamic segments come from the handler's second argument.
3. **`res.status().json()` is gone.** You return a `Response`. `Response.json()` is the short form; status codes, custom headers and streams are constructed on the `Response` you return.
4. **The caching model differs and is version-sensitive.** Settled in [ch4 · Route Handlers and their caching model](../04-data-fetching-in-the-app-router/01d-route-handlers-and-their-caching-model.md). Read it before assuming a migrated endpoint behaves like the old one — this is one of the claims this track has already had to correct.

And the migration that beats a translation:

> *"**Good to know**: If you previously used API routes to call an external API from the client, you can now use [Server Components] instead to securely fetch data."*

An endpoint that exists only because a `useEffect` needed a same-origin proxy usually has no successor at all — the fetch moves into the Server Component and the endpoint is deleted. **Do that audit before you write a single Route Handler.** In most legacy codebases a meaningful fraction of `pages/api` is proxy-shaped and simply disappears, and the endpoints that remain are the ones that genuinely have external callers, webhooks or non-GET semantics.

## Gotchas

**★ Symptom: `_app.getInitialProps` was "ported" to the root layout and the session is now stale on client navigations, or was evaluated once at build.** Cause: `getInitialProps` in `_app` ran per navigation in both environments; a layout does not, and the docs give no equivalent. Fix: stop reconstructing a per-navigation global hook. Identify what it actually provided and read it where each consumer needs it, at request time.

```tsx
// ✅ each segment that needs the session reads it itself, per request
import { cookies } from 'next/headers';
import { verifySession } from '@/lib/auth';

export default async function BillingPage() {
  const token = (await cookies()).get('session')?.value;
  const session = token ? await verifySession(token) : null;
  return <section>{session?.user.email ?? 'signed out'}</section>;
}
```

**★ Symptom: removing `_app.getInitialProps` changes the rendering strategy of routes nobody migrated.** Cause: its presence disabled Automatic Static Optimization application-wide, so every `pages/` route was server-rendered whether or not it needed to be. Delete it and some of those routes become statically optimized — usually good, occasionally a correctness change if a page assumed per-request rendering. Fix: delete it as its own commit, separate from any route migration, and check the routes that previously relied on being server-rendered.

**★ Symptom: the migrated Route Handler answers `POST` requests the old API route rejected with 405.** Cause: the old handler's method guard was deleted (correctly) at the same time a `POST` export was added, or a wildcard was assumed. Fix: export only the methods you intend to serve — the allow-list is now the set of exported function names.

```ts
// app/api/projects/route.ts — GET only. No POST export means no POST handler.
export async function GET(request: Request) {
  return Response.json({ ok: true, url: request.url });
}
```

**★ Symptom: a migrated endpoint that read `req.body` now receives nothing.** Cause: `pages/api` parsed the body for you and handed it over as `req.body`; a Route Handler hands you a Web `Request` whose body must be consumed explicitly, and only once. Fix: await the parse, and store the result if more than one branch needs it.

```ts
export async function POST(request: Request) {
  const body = await request.json(); // consume once, reuse the value
  if (!body.email) {
    return Response.json({ error: 'email required' }, { status: 400 });
  }
  return Response.json({ ok: true, email: body.email });
}
```

**Symptom: reviewers argue over whether a new endpoint belongs in `pages/api` or `app/api`.** Cause: nobody wrote down that the coexistence is deliberate — *"API Routes continue to work in the `pages/api` directory without any changes."* Fix: record the policy so the split is a decision rather than drift. A one-line rule in the repo works: new endpoints in `app/api`; existing ones migrate only when they are already being changed for another reason.

**Symptom: a `getInitialProps` page was migrated and the client half silently stopped working, with no error.** Cause: the browser-only branch — `window.localStorage`, `document`, a browser API — was carried into the Server Component half, where it either throws during render or, if guarded by `typeof window === 'undefined'`, quietly takes the server path forever and never re-runs on the client. Fix: the browser half must be an actual Client Component with an effect, not a guard inside a Server Component.

```tsx
// ❌ the guard survives, the behaviour does not — this never runs in the browser
// const currency = typeof window === 'undefined' ? 'USD' : localStorage.getItem('currency');

// ✅ app/currency-label.tsx
'use client';
import { useEffect, useState } from 'react';

export function CurrencyLabel({ fallback }: { fallback: string }) {
  const [currency, setCurrency] = useState(fallback);
  useEffect(() => {
    const stored = window.localStorage.getItem('currency');
    if (stored) setCurrency(stored);
  }, []);
  return <span>{currency}</span>;
}
```

**Symptom: half the `pages/api` endpoints were faithfully migrated to Route Handlers and then deleted a sprint later.** Cause: the proxy audit was skipped. Endpoints that existed only to give a `useEffect` a same-origin URL have no successor — the fetch moves into a Server Component and the endpoint goes away — but that is invisible if you migrate endpoint-by-endpoint instead of asking who calls each one. Fix: run the audit first and classify every endpoint as *external callers*, *mutation*, or *proxy for our own client*. Only the first two get Route Handlers.

**Symptom: a migrated Route Handler works locally and returns the wrong cache behaviour in production.** Cause: assumptions carried over from `pages/api`, whose caching model is not the App Router's, plus a version-sensitive default this track has already had to correct once. Fix: do not reason about it from memory — read [ch4 · 01d](../04-data-fetching-in-the-app-router/01d-route-handlers-and-their-caching-model.md) and state the behaviour explicitly on the handler.

## Interview questions

**★ Why is `getInitialProps` the one function with no migration recipe in the docs?**
Because its defining property was running in *two* environments — on the server for the initial request and in the browser for client-side navigations — and the App Router's model is that a Server Component runs only on the server. No single successor can inherit that behaviour, so there is nothing to write a before/after example about. The 16.3.4 migration guide names it once in a list of replaced APIs and then gives it no section, no example and no recipe, unlike `getServerSideProps` and `getStaticProps`, which both get worked code. The practical answer is that you split it: the server half becomes the Server Component body, the browser half becomes a Client Component with an effect. Its `_app`-level use is worse — it also disabled static optimization globally and has no per-navigation equivalent — so that one is a redesign rather than a port.

**★ Can you finish migrating your pages without touching `pages/api`?**
Yes, and it is usually the right sequencing. The guide states plainly that *"API Routes continue to work in the `pages/api` directory without any changes."* Route Handlers and API Routes coexist, so a fully App-Router front end can keep calling legacy endpoints indefinitely, and nothing in the documentation sets a deadline. The one thing worth doing early is deleting rather than migrating: endpoints that exist only to give a `useEffect` a same-origin proxy usually disappear entirely once the fetch moves into a Server Component, and the guide points at exactly that.

**★ A codebase has `getInitialProps` in `_app.js` fetching feature flags. How do you price that?**
Separately from everything else, and first. Two things make it expensive. It ran on every navigation in both environments, so there is no single place in `app/` that reproduces its timing — the flags have to be read per request in each segment that consumes them, or passed down from a layout with the understanding that a layout does not re-run per client navigation. And its presence disabled Automatic Static Optimization application-wide, so removing it changes the rendering strategy of routes you never touched. I would land the flag re-homing as its own change, before any route migration, and verify the rendering strategy of the `pages/` routes afterwards.

**★ What breaks when you move a `pages/api` handler to a Route Handler and keep the same body?**
Four things, in rough order of how quietly they fail. The method guard becomes meaningless because the exported function name *is* the method, so a leftover `POST` export can start serving requests the old handler rejected. `req.query` no longer exists; parameters come from the request URL. `res.status().json()` no longer exists; you return a `Response`. And `req.body` is not pre-parsed — a Web `Request` body must be consumed explicitly and can only be consumed once, so code that read `req.body` in two branches now gets `undefined` in the second. The caching model also differs and is version-sensitive, which is the one that fails in production rather than in review.

**Why does a `typeof window` guard survive the migration syntactically but not semantically?**
Because in a Server Component the guard is not a branch, it is a constant. The component only ever executes on the server, so `typeof window === 'undefined'` is always true and the browser branch becomes unreachable code that TypeScript will happily compile and no test will flag. In `pages/`, the same guard was a genuine runtime branch because the same function executed in both places. So a faithful copy-paste of `getInitialProps` logic into a Server Component produces something that looks right, type-checks, renders, and silently never does the client-side half. The fix is structural — the browser half has to become a Client Component — which is why `getInitialProps` migrations should start by listing every environment branch in the function.

---

← [Translating build-time data](02c-translating-build-time-data.md) · [Chapter index](01-explanation.md) · Next → [The two routers and the client-side hooks](02e-the-two-routers-and-the-client-side-hooks.md)
