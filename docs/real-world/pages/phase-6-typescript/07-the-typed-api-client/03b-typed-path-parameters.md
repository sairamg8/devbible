---
title: "A template literal type takes the path apart at compile time so the parameters a URL needs become a required argument, and the one thing the map still cannot promise is that the server has the route at all"
sidebar_label: "03b · Typed path parameters"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript handbook on
> [template literal types](https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html)
> and
> [conditional types with `infer`](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html),
> the TypeScript **4.1** release note introducing
> [template literal types and key remapping](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-1.html),
> and the **zod 4.4.3** `core.input` declaration read in this repo. MDN on
> [`encodeURIComponent`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent)
> and [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams).
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**`client.get('/products/:slug', {})` should not compile, and making it not
compile is a type that reads the path string.** The route map from
[the previous chunk](03-the-route-map.md) already carries the paths as literal
types; a template literal type can pull `:slug` out of `'/products/:slug'` and
turn it into a required property of the options object. This chunk builds that,
types the query and body arguments the same way, and then states plainly the
one guarantee the whole apparatus still does not provide.

## Extracting parameters from a path literal

```ts
// packages/client/src/path.ts
export type PathParams<P extends string> =
  P extends `${string}:${infer Param}/${infer Rest}`
    ? {[K in Param]: string} & PathParams<Rest>
    : P extends `${string}:${infer Param}`
      ? {[K in Param]: string}
      : {};
```

```ts
type A = PathParams<'/cart'>;                        // {}
type B = PathParams<'/products/:slug'>;              // {slug: string}
type C = PathParams<'/products/:slug/reviews'>;      // {slug: string}
type D = PathParams<'/admin/orders/:id/status'>;     // {id: string}
type E = PathParams<'/a/:x/b/:y'>;                   // {x: string} & {y: string}
```

Two conditional branches, in this order and not the other:

- **The recursive branch first.** `` `${string}:${infer Param}/${infer Rest}` ``
  matches when a parameter is followed by more path, binding `Param` to the
  segment name and `Rest` to everything after the slash, then recursing.
- **The terminal branch second**, for a parameter at the end of the path.
- **`{}` last**, for a path with no parameters.

Swap the first two and `'/products/:slug/reviews'` matches the terminal branch
with `Param` inferred as `'slug/reviews'`, producing a property whose name is a
path fragment. The order *is* the algorithm.

📌 **Every parameter is `string`, and that is not a limitation you can type
away.** A URL segment is text. `PathParams<'/orders/:id'>` giving
`{id: string}` and not `{id: number}` is correct: the caller must decide how to
serialise, and a branded `OrderId`
([chapter 02·05b](../02-zod-as-the-source-of-truth/05b-composition-and-branded-ids.md))
does not survive the trip either. `String(orderId)` at the call site is the
honest conversion.

## The options object, assembled per route

```ts
type QueryOf<R> = R extends {query: infer S extends z.ZodType}
  ? {query: z.input<S>}
  : {query?: never};

type BodyOf<R> = R extends {body: infer S extends z.ZodType}
  ? {body: z.input<S>}
  : {body?: never};

export type GetOptions<P extends GetPath> =
  PathParams<P> & QueryOf<Routes['get'][P]>;

export type PostOptions<P extends PostPath> =
  PathParams<P> & BodyOf<Routes['post'][P]>;
```

```ts
await client.get('/products/:slug', {slug});                  // ✓
await client.get('/products/:slug', {});                      // ✗ 'slug' is missing
await client.get('/cart', {slug: 'x'});                       // ✗ 'slug' does not exist
await client.get('/products', {query: {sort: 'price_asc'}});  // ✓ z.input of the query schema
await client.post('/checkout', {body: {address, card_token}}); // ✓ z.input of the body schema
```

🔴 **`z.input`, not `z.output`, on the way out.** The caller *constructs* the
request, and construction is the input side — which for a schema with a
`.default()` means the caller may omit the field the server will fill in. This
is the direction [chapter 02·02](../02-zod-as-the-source-of-truth/02-input-versus-output.md)
established, arriving at the one place the client actually builds a payload.

📌 **`{query?: never}` rather than `{}` for a route with no query.** With
`{}`, passing `{query: {…}}` to a route that has none is accepted — an object
literal with extra properties intersected with `{}` is still an object.
`{query?: never}` makes the extra property a type error, which is the whole
reason to bother writing the false branch.

## Interpolation, and what the type cannot check

```ts
// packages/client/src/path.ts
export function interpolate(path: string, opts: Record<string, unknown>): string {
  const url = path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) =>
    encodeURIComponent(String(opts[key])));
  const query = 'query' in opts && opts.query
    ? `?${new URLSearchParams(
        Object.entries(opts.query as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      )}`
    : '';
  return url + query;
}
```

⚠️ **`interpolate` takes `Record<string, unknown>` and loses every type the
call site had.** The precision lives in the *signature* of `get`; the
implementation is stringly-typed by necessity, because it walks the path at run
time. That is the correct place for the boundary — one small untyped function
that all the typed call sites funnel through — and it is worth saying out loud
so nobody "fixes" it by making the public signature match the implementation.

⚠️ **Nothing makes you call `encodeURIComponent`.** A slug containing a slash
without it produces a URL with an extra path segment, which is a routing bug
and, on a `DELETE`, potentially a destructive one. It is inside `interpolate`
here precisely so no call site has to remember.

## What the map buys over six hand-written functions

Hand-written wrappers (`getProducts`, `getProduct`, `getCart`, …) give the same
call-site types. The map gives four things they do not:

1. **One place a route exists.** Adding an endpoint is one line, and the
   client, the type of every call, and the contract emission all follow from
   it.
2. **`keyof` over the paths.** The set of endpoints becomes a *type* —
   available to a test, to a mock server, to a generated client, and to the
   OpenAPI emission that [chapter 07·06](06-emitting-the-contract.md) builds.
3. **Uniform behaviour.** Parsing, aborting, retrying, the idempotency header:
   implemented once in `request`, not repeated in six wrappers where one
   forgets the signal.
4. **A hand-written wrapper can drift from the endpoint it calls.** The map
   entry *is* the endpoint's description, so drift requires editing the
   description.

⚠️ **And it does not buy agreement with the server.** The map is a client-side
declaration of what the server offers. Nothing checks that
`/products/:slug/reviews` is registered on the Express router or that its
response really matches `ReviewPage`; that is a *test*, exactly as
[chapter 02·05's](../02-zod-as-the-source-of-truth/05-the-status-enum-four-ways.md)
Postgres enum needed a test rather than a type.

```ts
// apps/api/test/route-parity.test.ts — the shape of the check
import {routes} from '@storefront/shared';
import {app} from '../src/app.js';

const declared = Object.entries(routes).flatMap(
  ([method, paths]) => Object.keys(paths).map((p) => `${method.toUpperCase()} ${p}`),
);
const registered = listExpressRoutes(app);          // walks the router stack
// assert the two sets are equal, both directions
```

**Both directions matters.** A route on the server and not in the map is an
endpoint the client cannot call — usually fine, occasionally a forgotten
feature. A route in the map and not on the server is a 404 the types approved
of.

## Gotchas

**★ Getting the two conditional branches in the wrong order silently produces
a parameter named after half the path.** With the terminal branch first,
`'/products/:slug/reviews'` yields `{'slug/reviews': string}` — a valid type,
a property nobody will ever pass, and an error message at the call site about
a missing property with a slash in its name. Recursive branch first, always.

**★ A path parameter is `string` and a branded id is not.** `PathParams` cannot
produce `{id: OrderId}`, because the segment is text and the brand exists only
in the type system. `String(orderId)` at the call site is the conversion, and
it is the point at which the brand is deliberately discarded — which is fine,
because the value is leaving the program.

**★ `{}` as the "no query" branch accepts a query anyway.** Intersecting with
`{}` constrains nothing, so a route with no query schema silently accepts one
and `interpolate` appends it to the URL. `{query?: never}` turns that into a
compile error. The same applies to `body`.

**★ `interpolate` is untyped inside and that is deliberate.** It reads the path
at run time and indexes the options by a string key, so its parameter is
`Record<string, unknown>`. Do not push that looseness up into `get`'s
signature; the entire design is a precise public signature over one small
imprecise implementation.

**★ A missing parameter becomes the string `"undefined"` in the URL.**
`String(opts[key])` on an absent key produces `'undefined'`, so a bug that the
types would normally catch — if it slips through a cast or a spread — becomes a
request for `/products/undefined` rather than a thrown error. Throwing on a
missing key inside `interpolate` costs three lines and turns a confusing 404
into a clear failure.

**★ `URLSearchParams` stringifies everything, including `undefined` and
`null`.** `{sort: undefined}` becomes `sort=undefined` unless filtered, and the
server's coercing query schema will then reject a value the client thought it
had omitted. The `.filter(([, v]) => v !== undefined)` above is not optional
tidiness.

**★ Arrays in a query string have no canonical encoding, and no type will pick
one for you.** `{tags: ['a','b']}` can be `tags=a&tags=b`, `tags=a,b` or
`tags[]=a&tags[]=b`, and the server's parser must agree. The client and the
API's query schema have to make the same choice; the type only says `string[]`.

**★ A route present in the map and absent on the server is a 404 the types
approve of.** The map is one side's opinion. Without the parity test, the
client's inference confidently describes an endpoint nobody deployed — and the
failure surfaces as a `not_found` in the UI rather than as a build error.

**★ The parity test needs the Express router walked, which is not a public
API.** Listing registered routes means reaching into the router stack, which is
implementation detail and can change between Express versions. That is a real
cost of the test and the reason many teams skip it; the cheaper substitute is a
smoke test that calls every declared route once against a running app and
asserts nothing 404s.

## Interview questions

**★ How does `PathParams<'/products/:slug'>` produce `{slug: string}`?**
By matching the literal against two template literal patterns in order. The
first, `` `${string}:${infer Param}/${infer Rest}` ``, matches a parameter
followed by more path and recurses on the remainder; the second,
`` `${string}:${infer Param}` ``, matches a trailing parameter and produces
`{[K in Param]: string}`; the fallback is `{}`. Order is critical — with the
terminal pattern first, `'/products/:slug/reviews'` would infer a parameter
named `'slug/reviews'`.

**★ Why is every path parameter typed `string`?**
Because a URL path segment is text, and the conversion has to happen
somewhere. Typing it `number` would mean the client type-checks a value it must
then stringify anyway, and a branded `OrderId` cannot survive the trip at all —
brands are a compile-time construct with no runtime representation. Making the
caller write `String(orderId)` puts the lossy step where it is visible.

**★ Why `{query?: never}` rather than `{}` for a route with no query schema?**
Because intersecting with `{}` constrains nothing: a caller can pass
`{query: {...}}` to a route that has none, the compiler accepts it, and
`interpolate` cheerfully appends it to the URL. `{query?: never}` makes the
property's presence a type error, which is the only reason to write the false
branch of the conditional at all.

**★ `interpolate` takes `Record<string, unknown>`. Is that a failure of the
design?**
No — it is the design. The function reads the path string at run time and
indexes the options by a computed key, so it cannot be precisely typed without
duplicating the whole `PathParams` machinery in a form the implementation could
use. The value of the approach is a precise *public* signature funnelling every
call site through one small imprecise implementation, which is exactly where an
untyped step belongs.

**★ What does the route map still not guarantee, and what closes the gap?**
That the server has those routes. A path typo is caught, but a path the API
never registered, a method mismatch, or a response schema that no longer
matches the handler are all invisible to the compiler, because the map is one
side's declaration. A parity test that enumerates the map's entries and the
Express router's registered routes and asserts set equality *in both
directions* is the only check — the same shape of test the Postgres enum
needed, for the same reason.

**★ Why assert the parity in both directions rather than just "every mapped
route exists"?**
Because the other direction catches a different bug. A route on the server that
the map does not list is usually harmless and occasionally a feature the client
was supposed to use and nobody wired up; a route in the map that the server
does not have is a runtime 404 wearing a fully-inferred response type. The
first is a gap in coverage, the second is a broken screen, and only the
two-directional assertion finds both.

---

← Prev: [The route map](03-the-route-map.md) ·
[Overview](README.md) ·
Next → [Errors as a result](04-errors-as-a-result.md)
