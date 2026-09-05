---
title: "Build-time data fetching survives the move almost unchanged and gains two things it never had: a per-fetch revalidate window, and a path enumeration that can finally live on a layout"
sidebar_label: "02c · Translating build-time data"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How to migrate from Pages to the App Router](https://nextjs.org/docs/app/guides/migrating/app-router-migration) (`version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified; **no sandbox run**.

**`getStaticProps` and `getStaticPaths` are the easy half of a migration, and the two ways they change are both improvements you should exploit rather than merely survive. `revalidate` moves from the page to the individual `fetch`, so one route can hold a sixty-second feed beside a daily category list. `generateStaticParams` may live on a layout, which `getStaticPaths` could not — collapsing the path enumeration that every leaf under a `[locale]` or `[tenant]` segment used to duplicate. The one thing to watch is `fallback`, which loses a mode and takes `router.isFallback` with it, leaving dead loading branches in every component that had one. The two APIs with no clean successor are in [02d](02d-the-two-apis-with-no-clean-successor.md).**

## `getStaticProps` → the same body, a different cache decision

```jsx
// ❌ pages/index.js
export async function getStaticProps() {
  const res = await fetch(`https://api.example.com/projects`);
  const projects = await res.json();

  return { props: { projects } };
}

export default function Index({ projects }) {
  return projects.map((project) => <div key={project.id}>{project.name}</div>);
}
```

```tsx
// ✅ app/page.tsx
type Project = { id: string; name: string };

async function getProjects(): Promise<Project[]> {
  const res = await fetch(`https://api.example.com/projects`, { cache: 'force-cache' });
  return res.json();
}

export default async function Index() {
  const projects = await getProjects();
  return projects.map((project) => <div key={project.id}>{project.name}</div>);
}
```

The guide's own sentence for this row:

> *"In the `app` directory, data fetching with [`fetch()`] will default to `cache: 'force-cache'`, which will cache the request data until manually invalidated. This is similar to `getStaticProps` in the `pages` directory."*

⚠️ **Quoted, not endorsed.** That sentence is contradicted by a code comment on the same page at the same `lastUpdated`, which says the uncached behaviour is *"the default fetch behavior."* [02b](02b-translating-the-data-fetching-contracts.md) covers the contradiction and [ch4 · 03c](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) settles the real behaviour. The reason it does not matter for the code above is that the option is written explicitly — which is the entire argument for writing it explicitly.

## ISR: `revalidate` moves from the page to the fetch

```jsx
// ❌ pages/index.js
export async function getStaticProps() {
  const res = await fetch(`https://api.example.com/posts`);
  const posts = await res.json();
  return { props: { posts }, revalidate: 60 };
}
```

```tsx
// ✅ app/page.tsx
async function getPosts() {
  const res = await fetch(`https://api.example.com/posts`, { next: { revalidate: 60 } });
  const data = await res.json();
  return data.posts;
}

export default async function PostList() {
  const posts = await getPosts();
  return posts.map((post) => <div key={post.id}>{post.name}</div>);
}
```

**That is an expressiveness change, not syntax.** In `pages/`, `revalidate` was a property of the *page* — one number governing everything it fetched, so a route with a fast-moving price and a slow-moving category tree had to be tuned to the faster one. In `app/` it is a property of each request:

```tsx
// One route, three freshness contracts — impossible under getStaticProps.
const API = 'https://api.example.com';

export default async function ProductPage() {
  const [price, categories, legal] = await Promise.all([
    fetch(`${API}/price`, { next: { revalidate: 60 } }).then((r) => r.json()),
    fetch(`${API}/categories`, { next: { revalidate: 86400 } }).then((r) => r.json()),
    fetch(`${API}/legal-copy`, { cache: 'force-cache' }).then((r) => r.json()),
  ]);

  return <article>{price.amount} · {categories.length} · {legal.text}</article>;
}
```

The corollary, and it is the reason migrations produce stale-page tickets: **freshness is no longer readable from one place.** You have to read every fetch in the subtree, including ones inside components you did not touch, which is why the diagnosis in [ch4 · 03c](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) starts from what the build decided rather than from what you configured.

## `getStaticPaths` → `generateStaticParams`

```jsx
// ❌ pages/posts/[id].js
import PostLayout from '@/components/post-layout';

export async function getStaticPaths() {
  return {
    paths: [{ params: { id: '1' } }, { params: { id: '2' } }],
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const res = await fetch(`https://api.example.com/posts/${params.id}`);
  const post = await res.json();
  return { props: { post } };
}

export default function Post({ post }) {
  return <PostLayout post={post} />;
}
```

```tsx
// ✅ app/posts/[id]/page.tsx
import PostLayout from '@/components/post-layout';

export const dynamicParams = false;

export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }];
}

async function getPost(id: string) {
  const res = await fetch(`https://api.example.com/posts/${id}`);
  return res.json();
}

export default async function Post({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPost(id);

  return <PostLayout post={post} />;
}
```

> *"[`generateStaticParams`] behaves similarly to `getStaticPaths`, but has a simplified API for returning route parameters and **can be used inside [layouts]**. The return shape of `generateStaticParams` is an array of segments instead of an array of nested `param` objects or a string of resolved paths."*

> *"Using the name `generateStaticParams` is more appropriate than `getStaticPaths` for the new model in the `app` directory. The `get` prefix is replaced with a more descriptive `generate`, which sits better alone now that `getStaticProps` and `getServerSideProps` are no longer necessary. The `Paths` suffix is replaced by `Params`, which is more appropriate for nested routing with multiple dynamic segments."*

**"Can be used inside layouts" is the sentence that changes how you sequence**, because `getStaticPaths` could not. A `[locale]` or `[tenant]` segment that forced every leaf to re-declare the same set of paths declares them once and the leaves inherit it.

## `fallback` → `dynamicParams`, and one mode disappears

| `getStaticPaths` | `app/` |
|---|---|
| `fallback: false` | `export const dynamicParams = false` |
| `fallback: true` | `export const dynamicParams = true` (the default) |
| `fallback: 'blocking'` | `export const dynamicParams = true` — **no separate mode** |

> *"**`true`**: (default) Dynamic segments not included in `generateStaticParams` are generated on demand."* · *"**`false`**: Dynamic segments not included in `generateStaticParams` will return a 404."*
> *"This replaces the `fallback: true | false | 'blocking'` option of `getStaticPaths` in the `pages` directory. The `fallback: 'blocking'` option is not included in `dynamicParams` because the difference between `'blocking'` and `true` is negligible with streaming."*
> *"With [`dynamicParams`] set to `true` (the default), when a route segment is requested that hasn't been generated, it will be server-rendered and cached."*

🔴 **`fallback: true` and `dynamicParams: true` are not behaviourally identical, and the docs explain why that stopped mattering.** Under `fallback: true` the page rendered immediately with no data and `router.isFallback === true`, so your component carried a branch for it. Streaming now covers that gap and the flag is gone — *"`isFallback` has been removed because `fallback` has been replaced."* Every `if (router.isFallback) return <Skeleton />` in a legacy component is dead code; its job belongs to `loading.tsx` or a Suspense boundary.

## Gotchas

**★ Symptom: the skeleton never renders after migrating a `fallback: true` route — users see a blank frame instead.** Cause: `router.isFallback` no longer exists, so the branch that rendered the skeleton is unreachable, and nothing replaced it. Fix: delete the branch and express the pending state as `loading.tsx` for the segment.

```tsx
// ❌ dead code after migration — isFallback was removed
// if (router.isFallback) return <Skeleton />;

// ✅ app/posts/[id]/loading.tsx
export default function Loading() {
  return <div className="skeleton" aria-busy="true" />;
}
```

**★ Symptom: `generateStaticParams` prerenders nothing and every path is generated on demand.** Cause: the nested `getStaticPaths` return shape was carried over. The wrong shape produces no usable params rather than an error, so the build succeeds and only the traffic pattern tells you. Fix: return a flat array of segment objects.

```tsx
// ❌ the getStaticPaths shape
return { paths: [{ params: { id: '1' } }], fallback: false };

// ✅ generateStaticParams
export const dynamicParams = false;
export async function generateStaticParams() {
  return [{ id: '1' }, { id: '2' }];
}
```

**★ Symptom: a page's revalidate window silently changed after migration.** Cause: `getStaticProps` returned one `revalidate` for the whole page; the App Router attaches it per `fetch`. A page with three fetches, two of them unannotated, no longer has a single freshness contract. Fix: audit every fetch in the migrated subtree, not only the one you translated.

```tsx
const [products, categories, banner] = await Promise.all([
  fetch(`${API}/products`, { next: { revalidate: 60 } }).then((r) => r.json()),
  fetch(`${API}/categories`, { next: { revalidate: 86400 } }).then((r) => r.json()),
  fetch(`${API}/banner`, { cache: 'no-store' }).then((r) => r.json()),
]);
```

**Symptom: a `[locale]` route was migrated leaf-by-leaf and each leaf still re-enumerates every locale.** Cause: the `getStaticPaths` duplication was ported faithfully instead of collapsed, because `getStaticPaths` could not live on a layout and `generateStaticParams` can. Fix: hoist the enumeration to the segment's layout and delete it from the leaves.

```tsx
// app/[locale]/layout.tsx
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'de' }, { locale: 'ja' }];
}

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

**Symptom: a route that used `fallback: false` to serve 404s for unknown slugs now generates them on demand.** Cause: `dynamicParams` defaults to `true`, so omitting the export inverts the old behaviour silently — the route stops 404ing and starts rendering. On a content site with user-supplied slugs that turns a closed set into an open one. Fix: port `fallback: false` explicitly; never let it default.

```tsx
// app/posts/[id]/page.tsx — the old fallback: false, stated
export const dynamicParams = false;
```

**Symptom: a build that used to take four minutes now takes forty after migrating a large `[slug]` route.** Cause: `generateStaticParams` on a layout applies to everything beneath it, so hoisting an enumeration of ten thousand tenants can multiply the prerender set across every leaf in that section rather than one page. Fix: hoist the enumeration only where the leaves genuinely all need prerendering; where they do not, keep `generateStaticParams` on the specific leaf and let the rest use `dynamicParams`.

## Interview questions

**★ `fallback: true` versus `dynamicParams: true` — same thing?**
Not quite, and the docs say why the difference stopped mattering. Both generate unlisted paths on demand. But `fallback: true` rendered your component immediately with no data and `router.isFallback === true`, so every such page carried a loading branch. In the App Router `isFallback` has been removed and the pending state is handled by streaming — `loading.tsx` or a Suspense boundary — rather than by a router flag. The docs also fold `'blocking'` into `true`, stating the difference *"is negligible with streaming."* So: same generation behaviour, different way of expressing the pending UI, and the old `isFallback` branch is dead code you must delete rather than leave unreachable.

**★ A page had `getStaticProps` with `revalidate: 300` and three fetches. What is the migrated freshness contract?**
Whatever you set on each of the three fetches — there is no page-level number any more. That is more expressive, since each source gets its own window, and considerably easier to get wrong, because a fetch you forgot to annotate is governed by the framework default rather than the 300 you had in mind, and the migration guide states that default inconsistently. The habit that survives production is to annotate every fetch explicitly during migration, then verify what the build actually decided rather than what you intended.

**★ Why does "`generateStaticParams` can be used inside layouts" change how you sequence a migration?**
Because it collapses duplication that legacy codebases accumulate around a top-level dynamic segment. With `getStaticPaths`, a `[tenant]` or `[locale]` prefix meant every leaf under it re-enumerated the same set, and any change had to be applied in every file. In the App Router the enumeration lives once on the segment's layout and the leaves inherit it. When you spot that pattern in a `pages/` tree it is a strong argument for migrating that section as a unit rather than leaf-by-leaf — one of the few cases where the leaves-before-layouts rule from [02](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md) bends. It also has a cost: an enumeration on a layout applies to every leaf beneath it, so hoisting a large set can multiply build time.

**Which of the two build-time defaults is the dangerous one to inherit, `dynamicParams` or the fetch cache?**
`dynamicParams`, because its default inverts a security-adjacent behaviour rather than a performance one. Omitting a `cache:` option gives you a freshness bug, which is visible and recoverable. Omitting `dynamicParams = false` on a route that previously used `fallback: false` turns a closed set of slugs into an open one: URLs that used to 404 now render, which on a multi-tenant or user-content route can mean rendering something that should not exist. Both should be explicit during a migration, but that one has the sharper failure.

---

← [Translating request-time data](02b-translating-the-data-fetching-contracts.md) · [Chapter index](01-explanation.md) · Next → [The two APIs with no clean successor](02d-the-two-apis-with-no-clean-successor.md)
