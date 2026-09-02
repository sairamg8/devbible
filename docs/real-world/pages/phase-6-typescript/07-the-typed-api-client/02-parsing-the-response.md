---
title: "The server's types are a different compilation deployed on a different day, so the client parses what arrives — and safeParse at exactly one boundary is what turns every T downstream from a claim into a fact"
sidebar_label: "02 · Parsing the response"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations read in this repo —
> `export type ZodSafeParseResult<T> = ZodSafeParseSuccess<T> |
> ZodSafeParseError<T>;` with `ZodSafeParseSuccess<T> = {success: true; data: T;
> error?: never}` and `ZodSafeParseError<T> = {success: false; data?: never;
> error: ZodError<T>}` (`zod/v4/classic/parse.d.cts`);
> `export type input<T> = T extends {_zod: {input: any}} ? T["_zod"]["input"] :
> unknown;`, `export type output<T> = …` and `export type { output as infer };`
> (`zod/v4/core/core.d.cts`) — and the
> [zod basics documentation](https://zod.dev/basics) on `parse` versus
> `safeParse`.
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**The client and the server are two compilations that never see each other's
types, connected by JSON and separated by a deploy schedule.** A shared package
makes them *agree* about what an `Order` is; it does not make the bytes on the
wire an `Order`. Between the two sits a cache, a proxy, a service worker, a
mock server, an older API pod mid-rollout, and a user with devtools open. The
parse is the one line that converts "the server should have sent this" into
"this is what arrived", and it belongs in exactly one place.

## The boundary, in one function

```ts
// packages/client/src/request.ts
import {z} from 'zod';
import type {ApiFailure} from '@storefront/shared';

export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  init: RequestInit = {},
): Promise<Result<z.output<S>>> {
  const res = await fetch(`${BASE}${path}`, {credentials: 'same-origin', ...init});

  if (res.status === 204) return {ok: true, value: undefined as z.output<S>};

  let body: unknown;
  try {
    body = await res.json();          // any or unknown — pin it to unknown HERE
  } catch {
    return {ok: false, failure: {kind: 'malformed', path, status: res.status}};
  }

  if (!res.ok) return {ok: false, failure: classify(res.status, body, path)};

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, failure: {kind: 'contract', path, issues: parsed.error.issues}};
  }
  return {ok: true, value: parsed.data};
}
```

🔴 **`let body: unknown` is the load-bearing annotation.** In a browser build
`res.json()` is `any`, and assigning an `any` to an `unknown`-annotated
variable is the cheapest possible way to stop it spreading — from that line on,
nothing can be read off `body` without narrowing, and the `safeParse` below is
the narrowing. One word, and the whole file becomes checkable.

## `safeParse` returns a discriminated union, and zod built it for destructuring

```ts
export type ZodSafeParseResult<T> = ZodSafeParseSuccess<T> | ZodSafeParseError<T>;
export type ZodSafeParseSuccess<T> = { success: true;  data: T;      error?: never };
export type ZodSafeParseError<T>   = { success: false; data?: never; error: ZodError<T> };
```

The `?: never` on the absent members is deliberate — it is what makes
`const {success, data, error} = schema.safeParse(body)` legal and narrowable,
the trade
[chapter 06·01c](../06-typing-the-custom-hooks/01c-narrowing-asyncstate-at-the-call-site.md)
compared against `AsyncState`'s plainer shape.

📌 **`safeParse`, not `parse`, at a boundary.** `parse` throws a `ZodError`,
which turns a contract violation into an exception travelling through code that
was written for network failures. `safeParse` makes it a value, and the value
becomes an `ApiFailure` with its own `kind` — so the UI can say *"we received a
response we could not read"* rather than showing the generic retry panel for a
condition retrying will not fix.

## `z.input`, `z.output` and which one the client holds

```ts
export type input<T>  = T extends {_zod: {input: any}}  ? T["_zod"]["input"]  : unknown;
export type output<T> = T extends {_zod: {output: any}} ? T["_zod"]["output"] : unknown;
export type { output as infer };
```

**`z.infer` is `z.output`, by declaration** — the same type under two names, so
`z.infer<typeof OrderSchema>` and `z.output<typeof OrderSchema>` are never
different and there is nothing to choose between them but readability.

On the client the two projections split like this:

| Schema | `z.input` is | `z.output` is | The client holds |
|---|---|---|---|
| **Response** schema (`OrderSchema`) | the JSON the server sent | what your code gets after transforms | **`z.output`** — `request()` returns it |
| **Request** schema (`CheckoutRequest`) | the object you build | what the *server* has after its parse | **`z.input`** — you construct it |

🔴 **The direction flips between the two, and that is the whole reason both
names exist.** A response schema with a transform makes them genuinely
different types:

```ts
// packages/shared/src/order.ts
export const OrderSchema = z.object({
  id: z.number().int(),
  status: OrderStatusSchema,
  total_cents: z.number().int(),
  created_at: z.iso.datetime().transform((s) => new Date(s)),
});

type Wire   = z.input<typeof OrderSchema>;   // created_at: string
type InApp  = z.output<typeof OrderSchema>;  // created_at: Date
```

The React component receives `InApp` and can call `order.created_at.getFullYear()`.
Nothing on the server ever had that type. That asymmetry —
[chapter 02·04b's](../02-zod-as-the-source-of-truth/04b-wire-types-and-envelopes.md)
subject on the way out — is *earned* on the way in only because the parse
actually ran.

⚠️ **Do not build a request against `z.input` of a coerced schema.**
[Chapter 02·02](../02-zod-as-the-source-of-truth/02-input-versus-output.md)
established that `z.input` of a `z.coerce.number()` is `unknown`, which
type-checks every value you could pass. The client builds requests against the
dedicated request schemas in the shared package, which have no coercion because
they describe a JavaScript object rather than a query string.

## What the parse costs, and the three places this app skips it

The cost is real and has two parts: zod ships in the browser bundle, and every
response is walked field by field. Neither is free, and neither is measured
here — **measure it in your own app rather than trusting a number from a
page.** What *is* general is where the trade changes:

1. **A large list rendered as a virtualised table.** Two thousand admin rows,
   parsed per page fetch, in a screen that displays them and never reads a
   field. This app parses the *envelope* (`{items, next_cursor, has_more}`) and
   declares `items` as `z.array(z.unknown())` for that one endpoint, with the
   row schema applied lazily in the row renderer.
2. **An endpoint whose body is passed straight back to the server.** The
   idempotency replay path re-sends what it received; parsing it changes
   nothing and can only reject a payload the server itself produced.
3. **A response you already parsed.** A cached value read out of the client's
   own store is not a boundary; parsing it again on every read is a
   sizeable cost for no information.

Everything else is parsed, on the argument that a wrong render is worse than a
slow one, and that a `contract` failure is a bug report from production that
arrives *as a failure the app displays* rather than as a support ticket saying
"the page is blank".

## Gotchas

**★ `let body: unknown` before the parse is what stops the `any` spreading.**
Without the annotation, `const body = await res.json()` gives a browser build an
`any`, and every later line is unchecked — including the `if (!res.ok)` branch
that passes `body` to `classify`. One annotation, and the compiler starts
working again.

**★ zod objects strip unknown keys by default, so a field the server added
disappears silently.** That is the right default for forward compatibility —
an older client keeps working against a newer API — and it is confusing the
first time you inspect the network tab, see the field, and cannot find it in
your parsed value. Never put `.strict()` on a *response* schema: it turns every
additive server change into a client outage.

**★ A parse failure is not a network failure and must not share a code path.**
Retrying a `contract` failure re-fetches the same unreadable body. Give it its
own `kind`, render a different message, and report it — it is the only signal
you get that the deployed contract and the deployed client have diverged.

**★ `parsed.error.issues` is the useful payload, and it is not for users.**
The issue list names paths and expected types, which is precisely what a bug
report needs and precisely what a customer should never see. Log it; render
"something went wrong reading that response".

**★ The failure must carry the path.** `safeParse` knows nothing about which
endpoint produced the body, so a `contract` failure without `path` is a bug
report you cannot act on. Threading it through costs one field on the failure
type and is the difference between a fixable report and a mystery.

**★ `z.infer` and `z.output` are literally the same type.** The declaration is
`export type { output as infer };`. Mixing them in one codebase is harmless and
looks like a distinction the reader has to work out; pick `z.output` when the
input/output distinction is live in that file, and `z.infer` when it is not.

**★ Parsing on the client does not remove the parse on the server.** They
protect against different things: the server's parse defends against
attackers, the client's against a broken or out-of-date contract. Deleting
either because "the other one does it" is deleting a defence against a threat
the other never covered.

**★ A response schema that is also the database row schema will reject the
API's own output.** Row types have `internal_notes` and `cost_cents`; the API's
mapper strips them. If the client imports the row schema by mistake it will
either strip the fields it wants or fail against a body that never contained
the ones it requires. Response schemas are their own declarations —
[chapter 02·04](../02-zod-as-the-source-of-truth/04-response-schemas-and-mappers.md).

**★ A `204` has no body, and the generic `Promise<Result<z.output<S>>>` has no
way to say so.** The cast `undefined as z.output<S>` in the code above is a
real assertion and the honest fix is a route map whose `204` routes declare
their response as `z.void()` or `z.null()` — which is
**the next chunk** *(not written yet)*, and is the first of several reasons the
client ends up shaped as a map rather than a function.

**★ Parsing inside `useAsync`'s fetcher rather than inside the client puts it
in every call site.** It works, and it means one screen forgets. The parse is a
property of the *endpoint*, so it belongs where the endpoint is described.

## Interview questions

**★ The server and the client share a types package. Why parse at all?**
Because the package makes them agree about a type at compile time and the wire
carries JSON at run time. The two are separate compilations deployed
separately, so at any moment a client can be talking to an older or newer API
pod; in between sit caches, proxies, service workers and mock servers, any of
which can produce a body the type does not describe. The shared type is a
statement of intent on both sides; the parse is the only evidence.

**★ `parse` or `safeParse` at the client boundary, and why?**
`safeParse`. `parse` throws a `ZodError`, which converts a contract violation
into an exception flowing through code written for network errors, so it gets
retried, logged as a fetch failure, and rendered with a retry button that
cannot help. `safeParse` returns a discriminated union — with `?: never` on the
absent members so it destructures — which becomes a failure value with its own
`kind`, and the UI can then distinguish "the request failed" from "we could not
read the response".

**★ On the client, which of `z.input` and `z.output` do you hold?**
Both, on opposite schemas. For a *response* schema, the wire carries
`z.input` and your code receives `z.output`, because transforms run during the
parse — a `created_at` declared `z.iso.datetime().transform(s => new Date(s))`
is a string on the wire and a `Date` in the component. For a *request* schema,
you construct `z.input` and the server ends up with `z.output` after its own
parse. `z.infer` is an alias for `z.output`, by declaration.

**★ Where would you not parse?**
Three places: a large list whose rows are displayed but never read, where the
envelope is parsed and the rows are parsed lazily in the renderer; a body being
passed straight back to the server, where parsing can only reject what the
server produced; and a value already parsed and cached, which is not a boundary
at all. Everywhere else the trade is a wrong render versus a slow one, and the
wrong render is worse.

**★ Why must a parse failure not be retried like a network failure?**
Because retrying re-fetches the same unreadable body — the condition is a
contract divergence between the deployed client and the deployed API, and no
number of retries changes it. It needs its own failure kind, its own message,
and a report, because it is the only automatic signal that the two sides have
drifted.

**★ Why never `.strict()` on a response schema?**
Because zod strips unknown keys by default, which is what lets an older client
keep working when the API adds a field. `.strict()` inverts that: the next
additive, backwards-compatible server change becomes a client-side outage on
every screen that reads that endpoint. Strictness belongs on *request* schemas,
where an unexpected key is a client bug or an attack.

---

← Prev: [The `fetch` hole](01-the-fetch-hole.md) ·
[Overview](README.md) ·
Next → [The route map](03-the-route-map.md)
