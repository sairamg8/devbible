---
title: "One object keyed by path, declared with satisfies rather than an annotation, is what lets client.get('/products') infer its own response type — and an annotation on that object destroys the entire mechanism"
sidebar_label: "03 · The route map"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript handbook on
> [indexed access types](https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html),
> [`keyof`](https://www.typescriptlang.org/docs/handbook/2/keyof-types.html) and
> [generic constraints](https://www.typescriptlang.org/docs/handbook/2/generics.html),
> the TypeScript **4.9** release note on
> [`satisfies`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html),
> and the **zod 4.4.3** `core.output` declaration read in this repo.
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**`request(path, schema, init)` from [the previous chunk](02-parsing-the-response.md)
has a hole in the middle of it: nothing relates the path to the schema.**
`request('/products', OrderSchema)` compiles, parses a product page against an
order, and fails at run time with a contract error blaming the server. The fix
is to stop passing the two things separately and declare the relationship once,
in an object the compiler can read — and the single decision that makes it work
is writing `satisfies` where every instinct says to write a type annotation.

## The map

```ts
// packages/shared/src/routes.ts
import {z} from 'zod';

export interface RouteSpec {
  response: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}
export type ApiMap = {
  get:    Record<string, RouteSpec>;
  post:   Record<string, RouteSpec>;
  put:    Record<string, RouteSpec>;
  patch:  Record<string, RouteSpec>;
  delete: Record<string, RouteSpec>;
};

export const routes = {
  get: {
    '/products':                 {query: ListProductsRequest, response: ProductPage},
    '/products/:slug':           {response: ProductDetail},
    '/products/:slug/reviews':   {query: PageRequest, response: ReviewPage},
    '/cart':                     {response: Cart},
    '/orders':                   {query: PageRequest, response: OrderPage},
    '/orders/:id':               {response: Order},
  },
  post: {
    '/checkout':                 {body: CheckoutRequest, response: Order},
    '/cart/items':               {body: AddItemRequest,  response: Cart},
    '/reviews':                  {body: ReviewRequest,   response: Review},
  },
  put: {
    '/cart/items/:productId':    {body: SetQuantityRequest, response: Cart},
  },
  patch: {
    '/admin/orders/:id/status':  {body: SetStatusRequest, response: Order},
  },
  delete: {
    '/cart/items/:productId':    {response: z.null()},
  },
} as const satisfies ApiMap;
```

## 🔴 `satisfies`, not an annotation — and this is the whole chunk

```ts
const routes: ApiMap = { … };          // ✗ every path inference is now dead
const routes = { … } satisfies ApiMap; // ✓
```

With the annotation, the declared type of `routes` **is** `ApiMap`, and
`ApiMap.get` is `Record<string, RouteSpec>` — so `keyof typeof routes.get` is
`string`, `typeof routes.get['/products']` is `RouteSpec`, and
`routes.get['/prodcuts']` type-checks. Every property of the map that the
client needs has been erased by the very declaration that was supposed to
describe it.

With `satisfies`, the declared type is the **literal object type** — keys are
the exact path strings, each value's `response` is the specific schema — and
the map is *checked against* `ApiMap` as well. The 4.9 release note's framing
is the one to hold on to:

> *"TypeScript developers are often faced with a dilemma: we want to ensure
> that some expression matches some type, but also want to keep the most
> specific type of that expression for inference purposes."*

`as const` on top makes the map deeply `readonly`, which is free here and stops
a wrapper from mutating the registry. This is
[chapter 02·04's](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md)
"`as const satisfies` keeps the information a plain annotation destroys",
applied to the largest table in the client.

## The client, inferring from the map

```ts
// packages/client/src/client.ts
import {routes} from '@storefront/shared';
import {z} from 'zod';

type Routes  = typeof routes;
type GetPath = Extract<keyof Routes['get'], string>;

type ResponseOf<R> = R extends {response: infer S extends z.ZodType} ? z.output<S> : never;

export function get<P extends GetPath>(
  path: P,
  opts: GetOptions<P>,
  signal?: AbortSignal,
): Promise<Result<ResponseOf<Routes['get'][P]>>> {
  const spec = routes.get[path];
  return request(interpolate(path, opts), spec.response, {method: 'GET', signal});
}
```

```ts
const cart = await client.get('/cart', {});
//    ^ Result<Cart>                        — from routes.get['/cart'].response

const page = await client.get('/products', {query: {sort: 'price_asc', limit: 24}});
//    ^ Result<ProductPage>

await client.get('/prodcuts', {});
//               ^^^^^^^^^^^ not assignable to GetPath
```

Three type-level moves, all ordinary:

- **`P extends GetPath`** constrains the argument to the map's keys and keeps
  the *literal* path as `P`, rather than widening it to the union.
- **`Routes['get'][P]`** is an indexed access — the exact spec for that one
  path.
- **`ResponseOf<R>`** pulls the schema out with `infer` and applies
  `z.output`, so a route whose `response` is `ProductPage` gives
  `z.output<typeof ProductPage>` and one whose response is `z.null()` gives
  `null`.

📌 **`infer S extends z.ZodType`** — the constrained `infer` — is what lets
`z.output<S>` be applied without a second conditional to prove `S` is a schema.
It is a small, load-bearing convenience.

## Gotchas

**★ 🔴 Annotating the map with `: ApiMap` deletes every inference the map
exists to provide.** `keyof` collapses to `string`, the indexed access gives
the index signature's `RouteSpec`, and `ResponseOf` yields `z.output<z.ZodType>`
— which is `unknown` — for every route. The call sites still compile, which is
the worst part: the client goes from precise to useless with no error anywhere.

**★ `satisfies` without `as const` is fine; `as const` without `satisfies` is
not.** `satisfies` alone gives you the literal keys and the specific schemas —
everything the client needs — and leaves the map mutable. `as const` alone
gives literal types and no check that each entry has a `response`, so a route
missing one fails later inside `ResponseOf` with a `never`.

**★ Two methods on the same path need two entries, and forgetting one is
silent.** `/cart/items/:productId` appears under `put` and `delete`. Nothing
relates them, and nothing warns if only one is declared — which is correct
(they *are* different endpoints) and worth stating, because a reader expects a
"route" to be a path.

**★ Splitting the map by method means the method is not part of the key, and
that is deliberate.** A single map keyed `'PUT /cart/items/:productId'` works
too and makes the key a string containing a space, which every template-literal
type over paths then has to parse past. One object per method keeps the path
strings clean for
[chunk 03b](03b-typed-path-parameters.md), which takes them apart at the type
level.

**★ `ResponseOf` returning `never` is the failure mode you will actually
hit.** It happens when a route entry is missing `response`, when the map was
annotated, or when `P` widened to the full union of paths because the caller
passed a `string` variable rather than a literal. `never` propagating into
`Result<never>` produces errors at the *consumer*, so debug it at the map.

**★ Passing a computed path defeats the constraint.** `const p = cond ?
'/cart' : '/orders'; client.get(p, {})` gives `P` as the union of the two, and
the response type becomes `Cart | OrderPage` — which is honest and usually not
what the caller wanted. Two calls, or a narrowing switch, keep the response
type precise.

**★ The map lives in the shared package, so it must not import anything
server-only.** It imports schemas, which import zod, which runs in the browser.
The moment someone adds `import {pool} from '../db.js'` to a schema module for
convenience, [chapter 01's boundary](../01-the-shared-types-package/01-why-a-package.md)
is breached and the client bundle grows a database driver.

**★ `z.null()` for a 204 route is a claim about a body that does not exist.**
`DELETE /cart/items/:productId` returns 204 with no body, and `request` special
cases the status before parsing. Declaring the response `z.null()` documents
"no meaningful body" and is never actually run against anything. It is a
readable lie; `z.void()` is another. Pick one and be consistent, and know that
the parse never happens either way.

## Interview questions

**★ Why is the route map declared with `satisfies` instead of a type
annotation?**
Because the annotation replaces the map's literal type with `ApiMap`, whose
values are index signatures — so `keyof typeof routes.get` becomes `string`,
the indexed access returns the generic `RouteSpec`, and every response type
collapses to `unknown`. `satisfies` checks the map against `ApiMap` while
leaving its declared type as the literal object, which is what the path
constraint and the response inference both read. The 4.9 release note describes
exactly this dilemma: match a type, but keep the specific type for inference.

**★ How does `client.get('/products')` know its response type?**
Through two indexed accesses and a conditional. The path parameter is
constrained `P extends Extract<keyof Routes['get'], string>`, so `P` is the
literal `'/products'`; `Routes['get'][P]` is that route's spec object; and
`ResponseOf<R> = R extends {response: infer S extends z.ZodType} ? z.output<S>
: never` extracts the schema and applies zod's output projection. Nothing is
generated and nothing is asserted — it is ordinary inference over a literal
object type.

**★ A caller passes a variable instead of a literal path and the response type
gets worse. Why?**
Because `P` is inferred from the argument, and a variable holding
`'/cart' | '/orders'` makes `P` that union — so `Routes['get'][P]` is the union
of both specs and the response is `Cart | OrderPage`. That is a correct and
faithful answer to the question asked; it is just rarely the question the caller
meant. Narrow before the call, or make two calls.

**★ Why is the map split by method rather than keyed `'GET /products'`?**
Because a key containing a space is a key every type-level operation over paths
has to parse past — and the next chunk does real work on those strings,
extracting parameters from them with template literal types. Splitting by
method keeps each key a clean path, and it costs one extra level of nesting in
an object that is written once.

---

← Prev: [Parsing the response](02-parsing-the-response.md) ·
[Overview](README.md) ·
Next → [Typed path parameters](03b-typed-path-parameters.md)
