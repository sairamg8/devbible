---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 4 overview"
---

# ▲ Data Fetching in the App Router

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  



> **Source:** current-project backup remapped + improved for exact syllabus title

## 1. Under-The-Hood Mechanics

Next.js patches the global `fetch()` inside Server Components with extra, Next-specific options that hook directly into its caching architecture (see [caching architecture](../05-caching-ppr-and-cache-components/01-explanation.md)) — the same web-standard `fetch()` call, with semantics no other framework's `fetch` carries.

```typescript
fetch(url, {
  cache: 'force-cache' | 'no-store',     // opt into a cached response vs always-fresh, per-request data
  next: {
    revalidate: 3600,                       // time-based ISR — re-fetch in the background after N seconds
    tags: ['product-123'],                    // on-demand invalidation via revalidateTag('product-123')
  },
})
```

> **Next.js 15+ default changed:** `fetch()` requests are **uncached by default** (`no-store`-equivalent semantics) — this is a reversal of the Next 13/14 behavior, where `fetch()` was cached (`force-cache`) unless told otherwise. On Next 15+, caching is now something you **opt into** explicitly via `cache: 'force-cache'` or `next: { revalidate: ... }` (setting `revalidate` also opts a request into the Data Cache). Code written against pre-15 tutorials that assumes bare `fetch()` calls are cached will silently become fully dynamic on upgrade.

### Request Memoization: Automatic, Per-Render Deduplication
If the **exact same** `fetch()` call (same URL + options) is made from multiple components during a single render pass (e.g. both a layout and a nested page independently need the current user's profile), Next.js automatically deduplicates them into a **single** actual network request — this is why fetching the same data from multiple places in the component tree isn't a performance anti-pattern the way it would be in a client-only app; it's specifically designed to be safe.

### `generateStaticParams()`: Build-Time Path Pre-Rendering
The App Router's replacement for `getStaticPaths` — an exported async function returning an array of param objects, each one causing Next.js to pre-render that specific dynamic route at build time (e.g. every product ID known at build time gets its own static HTML page generated upfront).

### Parallel vs Sequential Fetching
```typescript
// Sequential (a waterfall) — the SECOND fetch cannot start until the FIRST resolves
const user = await getUser(id);
const posts = await getPostsByUser(user.id); // must wait for `user` first — INTENTIONAL here

// Parallel — BOTH fetches start immediately, total time ≈ max(fetchA, fetchB), not sum
const [user, settings] = await Promise.all([getUser(id), getSettings(id)]); // independent data
```
The distinction matters because an accidental sequential waterfall (awaiting one fetch before even *starting* an unrelated second one) doubles latency for data that never actually depended on each other.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Product Page Needing Both Product Details and Inventory Status, Independently.
Product details and inventory status come from two entirely separate backend services with no dependency between them — yet an earlier implementation awaited the product details fetch before even starting the inventory fetch, adding an unnecessary ~300ms of pure waterfall latency for data that could have been fetched concurrently. Restructuring to kick off both fetches via `Promise.all` before awaiting either cut the page's server-side data-fetching time roughly in half, since the two now overlap instead of stacking.

---

## 3. Production-Grade Code Example

```tsx
// app/products/[id]/page.tsx — parallel fetching, tag-based revalidation, and generateStaticParams
export async function generateStaticParams() {
  const products = await fetch('https://api.acme.com/products/ids').then((r) => r.json());
  return products.map((p: { id: string }) => ({ id: p.id })); // pre-renders EVERY product page at build time
}

async function getProduct(id: string) {
  const res = await fetch(`https://api.acme.com/products/${id}`, {
    next: { tags: [`product-${id}`], revalidate: 3600 }, // time-based AND tag-based revalidation together
  });
  return res.json();
}

async function getInventory(id: string) {
  const res = await fetch(`https://api.acme.com/inventory/${id}`, {
    cache: 'no-store', // always fresh — stock levels shouldn't be cached even briefly
  });
  return res.json();
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // PARALLEL: both requests fire immediately, neither depends on the other
  const [product, inventory] = await Promise.all([getProduct(id), getInventory(id)]);

  return <ProductView product={product} inStock={inventory.quantity > 0} />;
}
```

```tsx
// A layout ALSO fetching the same product data — automatically deduplicated with the page's fetch above
// app/products/[id]/layout.tsx
async function getProduct(id: string) {
  // IDENTICAL url + options as the page's call — Next.js coalesces these into ONE network request
  const res = await fetch(`https://api.acme.com/products/${id}`, {
    next: { tags: [`product-${id}`], revalidate: 3600 },
  });
  return res.json();
}

export default async function ProductLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id); // deduplicated against the page's identical fetch, NOT a second request
  return (
    <div>
      <Breadcrumb category={product.category} />
      {children}
    </div>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Accidental Sequential Waterfalls From Independent Data
```tsx
// ❌ WRONG: getInventory doesn't depend on `product` at all, but awaiting sequentially still
// makes the total wait = getProduct's time + getInventory's time, needlessly
const product = await getProduct(id);
const inventory = await getInventory(id);

// ✅ CORRECT: start both immediately, total wait = max(both), not the sum
const [product, inventory] = await Promise.all([getProduct(id), getInventory(id)]);
```

### ⚠️ Pitfall 2: Assuming Request Memoization Applies Across Different Requests
Request memoization only dedupes identical `fetch()` calls **within a single render pass of a single incoming request** — it does NOT persist across different users' requests or different page loads (that's what the Data Cache, a separate layer, is for). Expecting one user's fetch to warm a memoization cache for a different user's subsequent request is a fundamental misunderstanding of which caching layer does what.

### ⚠️ Pitfall 3: Forgetting That Non-Identical Fetch Options Defeat Deduplication
```typescript
// ❌ WRONG: these look like "the same data" but differ in the options OBJECT's shape —
// Next.js compares the fetch call's actual serialized inputs, so these do NOT deduplicate
fetch(url, { next: { tags: ['product'] } });
fetch(url, { next: { tags: ['product'], revalidate: 3600 } }); // different options ⇒ treated as a DIFFERENT request

// ✅ CORRECT: keep fetch call signatures byte-for-byte identical across components that should share one request
```

### ⚠️ Pitfall 4: Assuming Bare `fetch()` Is Still Cached by Default (Next 15+)
```typescript
// ❌ WRONG on Next 15+: no cache option, no next.revalidate/tags — this is a fully DYNAMIC,
// per-request fetch now, not a cached/static one, even though it looks identical to old Next 13/14 code
async function getProduct(id: string) {
  const res = await fetch(`https://api.acme.com/products/${id}`);
  return res.json();
}

// ✅ CORRECT: caching is opt-in on Next 15+ — be explicit about which behavior you want
async function getProduct(id: string) {
  const res = await fetch(`https://api.acme.com/products/${id}`, {
    next: { revalidate: 3600, tags: [`product-${id}`] }, // explicitly opts into the Data Cache
  });
  return res.json();
}
```

---

## 1. Under-The-Hood Mechanics

A Server Action is a function marked `'use server'` that, despite being **defined** and **called** as if it were a normal JS function from client code, actually executes exclusively on the server — Next.js generates a hidden network endpoint for it under the hood, and calling it from the client is compiled into a `fetch` POST to that endpoint, serializing the arguments across the wire.

```
'use server'                              Client code calls:
async function addToCart(formData) {          addToCart(formData)
  // runs ONLY on the server                        │
}                                                    ▼
                                          Next.js compiles this into a POST request
                                          to an auto-generated server endpoint,
                                          serializing arguments, executing the
                                          function server-side, streaming the result back
```

### `<form action={serverAction}>`: Progressive Enhancement, For Free
Binding a Server Action directly as a `<form>`'s `action` means the form **works even before JavaScript has hydrated** (or if JS fails to load entirely) — the browser's native form submission POSTs to the action's underlying endpoint exactly as it would for a traditional server-rendered form, with React only layering enhanced behavior (no full page reload, optimistic UI) on top once hydrated.

### Revalidation After a Mutation
A Server Action that changes data has no effect on already-cached pages unless it explicitly invalidates them: `revalidatePath('/products/123')` purges the Full Route Cache entry for that specific path; `revalidateTag('product-123')` purges every Data Cache entry (across potentially many different routes) tagged with that string — the tag-based approach is what lets one mutation correctly refresh several *different* pages that all happened to depend on the same underlying data.

### React 19 Hooks Wired Into the Action Lifecycle
- **`useActionState`** — tracks a Server Action's pending/result state directly, replacing manual `useState` + `useTransition` boilerplate for "is this submitting, what did it return."
- **`useFormStatus`** — reads the **parent `<form>`'s** submission status from a child component, without prop drilling — critical for a reusable `<SubmitButton>` that needs to know if *its* form is submitting, without the form needing to pass that state down manually.
- **`useOptimistic`** — renders an assumed-successful UI state **immediately** on submission, before the server has actually responded, automatically reverting if the action ultimately fails.

---

## 2. Real-World Engineering Scenario

**Scenario**: An Instant-Feeling "Add to Cart" That Still Works Without JavaScript.
A checkout flow needs "add to cart" to feel instantaneous (the cart badge count should update the moment a user clicks, not after a network round-trip) while also being resilient to JS failing to load (a slow 3G connection, a corporate proxy blocking a script) — a real e-commerce reliability requirement. Binding the mutation to a `<form action={addToCart}>` provides the no-JS fallback for free via native form submission; layering `useOptimistic` on top gives the instant visual feedback for the common case where JS has loaded, with automatic rollback if the server ultimately rejects the mutation (e.g. out of stock).

---

## 3. Production-Grade Code Example

```tsx
// app/cart/actions.ts — the Server Action
'use server';
import { revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';

export async function addToCart(prevState: unknown, formData: FormData) {
  const productId = formData.get('productId') as string;
  const quantity = Number(formData.get('quantity'));

  const res = await fetch('https://api.acme.com/cart/add', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  });

  if (!res.ok) {
    return { success: false, error: 'Out of stock' }; // returned to useActionState below
  }

  revalidateTag('cart'); // refresh any cached view of the cart, wherever it's rendered
  return { success: true, error: null };
}
```

```tsx
// components/AddToCartForm.tsx — useActionState + useOptimistic + useFormStatus together
'use client';
import { useActionState, useOptimistic, useFormStatus } from 'react';
import { addToCart } from '../app/cart/actions';

function SubmitButton() {
  const { pending } = useFormStatus(); // reads the ENCLOSING form's status — no prop drilling
  return <button disabled={pending}>{pending ? 'Adding…' : 'Add to Cart'}</button>;
}

export function AddToCartForm({ productId, cartCount }: { productId: string; cartCount: number }) {
  const [state, formAction] = useActionState(addToCart, { success: null, error: null });
  const [optimisticCount, setOptimisticCount] = useOptimistic(cartCount);

  return (
    <form
      action={async (formData) => {
        setOptimisticCount((c) => c + 1); // shown INSTANTLY, before the server responds
        await formAction(formData);          // reverts automatically if the action ultimately fails
      }}
    >
      <input type="hidden" name="productId" value={productId} />
      <input type="number" name="quantity" defaultValue={1} min={1} />
      <span>Cart: {optimisticCount}</span>
      <SubmitButton />
      {state.error && <p className="text-rose-400">{state.error}</p>}
    </form>
  );
}
```

```tsx
// Programmatic invocation — calling a Server Action from an onClick, not a form submission
'use client';
import { startTransition } from 'react';
import { addToCart } from '../app/cart/actions';

function QuickAddButton({ productId }: { productId: string }) {
  return (
    <button
      onClick={() => {
        const formData = new FormData();
        formData.set('productId', productId);
        formData.set('quantity', '1');
        startTransition(() => { addToCart(null, formData); }); // wrapped in startTransition — low priority, interruptible
      }}
    >
      Quick Add
    </button>
  );
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Forgetting Revalidation After a Mutation
```typescript
// ❌ WRONG: the mutation succeeds, but every cached page showing this product's data
// (Full Route Cache, Data Cache) remains stale until its own time-based revalidate window elapses
'use server';
export async function addToCart(formData: FormData) {
  await fetch('https://api.acme.com/cart/add', { method: 'POST', body: formData });
  // missing revalidateTag/revalidatePath — cart badge elsewhere in the app shows OLD count
}

// ✅ CORRECT: explicitly invalidate every cache entry this mutation actually affects
revalidateTag('cart');
```

### ⚠️ Pitfall 2: Treating a Server Action Like an Ordinary Client-Side Function Call
A Server Action's arguments and return value are **serialized across the network** — passing a non-serializable value (a class instance, a function, a DOM element reference) as an argument silently fails or throws, unlike calling a normal in-memory JS function where any value works. Server Actions share the same serialization boundary constraints as RSC props.

### ⚠️ Pitfall 3: Skipping `useOptimistic`'s Rollback Path, Assuming the Mutation Always Succeeds
```tsx
// ❌ RISKY: no handling for the case where formAction ultimately returns an error —
// the optimistic +1 was shown, the mutation failed, but nothing tells the user their
// "successful" add actually didn't happen (React reverts the optimistic value automatically,
// but the UI needs its OWN visible error state too, as shown via `state.error` above)
setOptimisticCount((c) => c + 1);
await formAction(formData); // if this fails, the number reverts, but silently — surprising to the user

// ✅ CORRECT: always render the action's returned error state distinctly, even though
// useOptimistic already handles the numeric rollback automatically
{state.error && <p className="text-rose-400">{state.error}</p>}
```

---

## 1. Under-The-Hood Mechanics

A `route.ts` file exports functions named after HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`), each receiving a web-standard `NextRequest` and returning a web-standard `Response` (or `NextResponse`) — the App Router's direct replacement for Pages Router API routes, built on Web Fetch API primitives rather than Node's `req`/`res`.

```
app/api/products/route.ts
        │
        ├── export async function GET(request: NextRequest)   ──► handles GET /api/products
        ├── export async function POST(request: NextRequest)    ──► handles POST /api/products
        └── (PUT/DELETE/PATCH similarly — only define the verbs actually needed)

app/api/products/[id]/route.ts
        └── export async function GET(request, { params })    ──► params: Promise<{ id: string }>
```

### Static vs Dynamic Route Handler Caching
A `GET` Route Handler with **no** dynamic APIs used (no `request.nextUrl.searchParams` read, no `cookies()`/`headers()`) and no non-GET-verb siblings can be **statically evaluated at build time** and cached, just like a page — genuinely serving a fixed JSON response from cache rather than re-executing the function per request. The moment it reads a dynamic input (a search param, a cookie) or the segment also exports a `POST`/`PUT`/etc., it becomes dynamic — evaluated fresh, per request.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Public, Rarely-Changing Config Endpoint vs a Search Endpoint That Must Never Cache.
A `/api/feature-flags` endpoint returns the same JSON for every request until the next deploy — an ideal candidate for static Route Handler caching, since re-executing it per request is pure wasted compute for output that never varies. A `/api/search?q=...` endpoint, by contrast, must read `searchParams` and return genuinely per-query results — reading the dynamic search param automatically and correctly opts this handler into dynamic, per-request execution, with zero explicit configuration needed to achieve that correctness.

---

## 3. Production-Grade Code Example

```typescript
// app/api/feature-flags/route.ts — STATIC: no dynamic API usage, cached like a static page
export async function GET() {
  const flags = await fetch('https://config.acme.com/flags').then((r) => r.json());
  return Response.json(flags); // this whole handler's OUTPUT can be cached at build/ISR time
}
```

```typescript
// app/api/search/route.ts — DYNAMIC: reading searchParams forces per-request execution
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q'); // reading this ⇒ automatically dynamic
  if (!query) {
    return Response.json({ error: 'Missing query parameter "q"' }, { status: 400 });
  }
  const results = await searchDatabase(query);
  return Response.json(results);
}
```

```typescript
// app/api/products/[id]/route.ts — dynamic segment + multiple HTTP verbs in one file
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return new Response('Not Found', { status: 404 });
  return Response.json(product);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteProduct(id);
  return new Response(null, { status: 204 });
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming a Route Handler Executes Per-Request by Default
```typescript
// ❌ MISUNDERSTANDING: this GET handler has no dynamic API usage — it gets STATICALLY cached
// at build time. Any code implicitly relying on it re-running fresh every request (e.g. logging
// "handled a request" as a side effect for observability) will NOT actually fire on every hit
export async function GET() {
  console.log('handling request'); // only logs at BUILD time (or ISR revalidation), not per visitor!
  return Response.json({ status: 'ok' });
}

// ✅ CORRECT: if per-request execution is required, force it explicitly
export const dynamic = 'force-dynamic'; // or read a dynamic API (cookies/headers/searchParams)
```

### ⚠️ Pitfall 2: Forgetting `params` Is a Promise in Recent Next.js Versions
```typescript
// ❌ WRONG (breaks in current versions): treating params as a plain synchronous object
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id; // TypeError/incorrect typing — params is a Promise now
}

// ✅ CORRECT: await it, matching the Promise-based params contract
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

### ⚠️ Pitfall 3: Returning a Plain Object Instead of Using `Response.json()`/`NextResponse.json()`
```typescript
// ❌ WRONG: Route Handlers must return an actual Response object — a bare object isn't
// a valid return value and causes a runtime type error, unlike Pages Router's res.json(data)
export async function GET() {
  return { status: 'ok' }; // NOT a Response — invalid
}

// ✅ CORRECT: always construct a real Response (Response.json is the concise built-in helper)
export async function GET() {
  return Response.json({ status: 'ok' });
}
```
