---
title: "res.json() is Promise<any> in the browser lib and Promise<unknown> in Node's, so one shared client file has two different types depending on which app compiles it — and neither of them is the data"
sidebar_label: "01 · The fetch hole"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against `interface Body { … json(): Promise<any>; … }` in
> `lib.dom.d.ts` (`typescript@6.0.3`, the newest TypeScript on this machine;
> TypeScript is not installed in this checkout), and against this repo's
> `undici-types/fetch.d.ts` — `export class BodyMixin { … readonly json: () =>
> Promise<unknown>; readonly text: () => Promise<string>; }` and
> `export declare class Response extends BodyMixin { readonly ok: boolean;
> readonly status: number; … }` — plus `@types/node`'s
> `web-globals/fetch.d.ts`, whose `type _Response = typeof globalThis extends
> { onmessage: any } ? {} : undici.Response;` decides which of the two you get.
> MDN on [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)
> for the rejection behaviour.
> Target: **TypeScript 7.0.2** (phase spine), Node **24.20.0**.
> Documentation-validated; **no console blocks, no timings**.

**Everything in [chapter 06](../06-typing-the-custom-hooks/README.md) is
downstream of one function whose return type is a lie by design.** `AsyncState<Product>`
is only as true as the `Product` handed to it, that `Product` came from a
fetcher, and the fetcher's last statement was `res.json()`. In a browser build
that expression is `any`; in a Node build it is `unknown`; in neither case is
it a `Product`. This chunk is the hole, in the exact terms of the two
declarations that create it, before the next chunk fills it.

## The same call, two declarations

```ts
// lib.dom.d.ts — the browser
interface Body {
    readonly body: ReadableStream<Uint8Array<ArrayBuffer>> | null;
    readonly bodyUsed: boolean;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    bytes(): Promise<Uint8Array<ArrayBuffer>>;
    formData(): Promise<FormData>;
    json(): Promise<any>;          // ←
    text(): Promise<string>;
}
```

```ts
// undici-types/fetch.d.ts — what @types/node supplies for Node's global fetch
export class BodyMixin {
  readonly body: ReadableStream | null
  readonly bodyUsed: boolean
  readonly arrayBuffer: () => Promise<ArrayBuffer>
  readonly blob: () => Promise<Blob>
  readonly bytes: () => Promise<Uint8Array>
  readonly formData: () => Promise<FormData>
  readonly json: () => Promise<unknown>          // ←
  readonly text: () => Promise<string>
}
```

And the line that decides which one a given compilation sees, verbatim from
`@types/node`'s `web-globals/fetch.d.ts`:

```ts
type _Response = typeof globalThis extends { onmessage: any } ? {} : undici.Response;
interface Response extends _Response {}
```

📌 **Read that conditional.** If the DOM lib is in scope — `globalThis` has an
`onmessage` — Node's `Response` contributes `{}` and the DOM's declaration
wins, `any` and all. If it is not, `undici.Response` wins and `json()` is
`unknown`. **The same source file, imported by the React app and by a
back-office script, is type-checked against two different `Response`s.**

🔴 **`unknown` is the better one and it is still not the data.** `any` accepts
every operation and checks none; `unknown` accepts none until you narrow. A
client written against the browser's `any` compiles in the script's build only
because `unknown` cannot be assigned to anything without a check — which means
the script build is where the missing parse gets discovered, long after the
browser build shipped.

## How the `any` travels

```ts
// apps/web/src/lib/api.ts — phase 4's client, ported mechanically
export async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`/api${path}`, {credentials: 'same-origin', ...opts});
  if (res.status === 204) return null;
  const json = await res.json();      // any
  if (!res.ok) throw new ApiClientError(res.status, json);
  return json;                        // any — and the function's return type is now any
}
```

```ts
const state = useAsync((s) => api(`/products/${slug}`, {signal: s}), [slug]);
//    ^ UseAsync<any>
state.data.pirce_cents;               // compiles
state.data.reviews.map(r => r.rating) // compiles, even if reviews is absent
<ProductDetail product={state.data} /> // compiles, whatever ProductDetail wants
```

**An `any` at the boundary is not a hole in one function; it is a hole in every
type it flows into.** The component's props are checked against a value that
satisfies every check. Four layers of careful typing produce exactly the
guarantees of untyped JavaScript, and the compiler reports nothing at any of
them.

⚠️ **`noImplicitAny` does not help here.** The `any` is *explicit* — it is in
the declaration of `json()`. The flag that surfaces it is
`noUncheckedIndexedAccess`-style strictness that TypeScript does not have for
this case; the lint rules that do are `@typescript-eslint/no-unsafe-assignment`
and `no-unsafe-member-access`, which are off in most default configurations and
are the only automated way to see this happening.

## Four other things `fetch`'s types do not tell you

**1 · `fetch` does not reject on 4xx or 5xx.** MDN is explicit that the promise
resolves for any HTTP response, and rejects only on network failure. `res.ok`
is a `boolean` and `res.status` a `number`; nothing in the type system makes
you look at either. A client that forgets the `if (!res.ok)` branch returns a
parsed error body typed as a success.

**2 · `res.status` is `number`, not a union of the statuses you emit.**
Narrowing on `res.status === 409` works because `number` compares to a literal;
there is no exhaustiveness and no error for `res.status === 490`. The status
union that *is* checked lives in the error contract, not in `Response`.

**3 · `headers.get(name)` returns `string | null`, and the name is a plain
`string`.** A typo in `'idempotency-kee'` is a `null` at run time and nothing
at build time.

**4 · `RequestInit` accepts a `body: BodyInit | null` that has nothing to do
with your request schema.** `JSON.stringify(anything)` is a `string` and every
string is a legal body, so the request side has exactly the same hole as the
response side — with no `any` to blame, because `string` is the honest type of
a serialised payload. Typing the request means typing what goes *into*
`JSON.stringify`, which is [the route map's](03-the-route-map.md) job.

## Gotchas

**★ 🔴 `res.json()` is `Promise<any>` in the browser, and `any` disables
checking for everything downstream.** It is not "an untyped value you will
annotate later"; it is a value that satisfies every annotation you give it. A
`Product` annotation on an `any` is the same statement as a cast, made
invisibly.

**★ The same client file gets two different `Response` types in two builds.**
The DOM lib's `Response` and undici's are selected by
`typeof globalThis extends { onmessage: any }` in `@types/node`. Code that
compiles in the browser app can fail in a Node script — `unknown` refuses the
assignments `any` allowed — and the failure appears in whichever build is set
up second, which is usually the script nobody was watching.

**★ `lib` and `types` in `tsconfig` decide which declaration you get, and a
monorepo usually has three answers.** The web app's config has `"lib": ["DOM",
"ES2023"]`; the API's has `"types": ["node"]`; a shared package often has both
or neither. Put the client in a package whose config you have decided
deliberately, and state which `Response` it is written against in a comment
above the fetch.

**★ `fetch` resolving on a 500 means "no error was thrown" is not "it
worked".** The types encourage the mistake: `await fetch(...)` looks like every
other awaited call that throws on failure. The `if (!res.ok)` branch is
mandatory and unenforced.

**★ A 204 has no body and `res.json()` on it rejects.** The check is
`res.status === 204` before parsing, and no type tells you which endpoints
return 204 — the route map does, by declaring those responses `null`.

**★ `res.json()` rejects on invalid JSON, and that rejection is not an
`ApiFailure`.** An HTML error page from a proxy produces a `SyntaxError` from
the JSON parser, not an error with a `code`. Catch around the parse
specifically and classify it, or the panel renders "Unexpected token" to a
customer.

**★ `Content-Type` is not checked by `json()`.** It will parse a body labelled
`text/html` if the bytes happen to be JSON, and reject if they are not. If the
distinction matters — an authenticating proxy returning a login page with a
200 — check the header before parsing, because the status code will not tell
you.

**★ `credentials: 'same-origin'` is a string literal in a union, so a typo is
caught; `headers` keys are not.** `RequestInit` types the well-known options
(`method` is `string`, `credentials` is `RequestCredentials`, `cache` is
`RequestCache`), and leaves the header names entirely free. That asymmetry is
worth knowing before assuming "it type-checks" means "it is spelled right".

**★ The request body has the same hole as the response and no `any` to blame
it on.** `body: JSON.stringify(payload)` is a `string`, which is correct and
useless: nothing checks that `payload` matches what the endpoint expects. The
request type has to be attached to the *path*, which is why the client's shape
is a route map rather than a `post(url, body)` function.

## Interview questions

**★ What is the type of `await res.json()`, and why does the answer have two
parts?**
`any` under `lib.dom.d.ts`, `unknown` under the undici types that `@types/node`
supplies for Node's global `fetch`. Which one a compilation sees is decided by
a conditional in `@types/node` — `typeof globalThis extends { onmessage: any }
? {} : undici.Response` — so the DOM lib wins when it is present. A client
shared between a browser app and a Node script therefore type-checks against
two different declarations, and only one of them forces you to narrow.

**★ Why is `any` at this boundary worse than `unknown`?**
Because `any` is assignable to everything and everything is assignable to it,
so it silently satisfies every annotation downstream — the component prop, the
reducer payload, the state union — while checking nothing. `unknown` is
assignable to nothing without a narrowing step, so it forces the parse at the
point the data arrives. The practical difference is where you find out: `any`
tells you in production, `unknown` tells you at the first line that uses the
value.

**★ `fetch` resolved and you have a parsed body. What has the type system
guaranteed about the HTTP status?**
Nothing. `fetch` resolves for every HTTP response and rejects only on network
failure, so a 500 with a JSON error body flows through exactly like a 200 with
a product. `res.ok` and `res.status` are a `boolean` and a `number` — no
literal union, no exhaustiveness — so the `if (!res.ok)` branch is mandatory
discipline that nothing enforces.

**★ How would you notice, in review, that a client function is `any`-typed all
the way through?**
By its return type: an `async` function whose body ends in `return
res.json()` has an inferred return type of `Promise<any>`, and hovering it says
so. Automatically, the `@typescript-eslint` rules `no-unsafe-assignment`,
`no-unsafe-member-access` and `no-unsafe-return` are the only checks that fire,
and they are off in most default configurations — which is why this hole is
usually found by a bug rather than by tooling.

**★ Is the request side typed any better than the response side?**
No, and it has no `any` to blame. `RequestInit.body` is `BodyInit | null`, and
`JSON.stringify(anything)` produces a perfectly honest `string`, so nothing
relates the payload to the endpoint. Typing requests means attaching the
request type to the path itself, which is what turns "a `post` function" into
"a route map" and is the structural reason the client is shaped the way it is.

---

← [Overview](README.md) ·
Next → [Parsing the response](02-parsing-the-response.md)
