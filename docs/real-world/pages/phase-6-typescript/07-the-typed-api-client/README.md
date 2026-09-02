---
title: "The typed API client"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations read directly in this
> repo (`ZodSafeParseResult`, `core.input`/`core.output`, `toJSONSchema`'s
> `target` and `io` parameters), `json(): Promise<any>` in `lib.dom.d.ts`
> (`typescript@6.0.3`) against `readonly json: () => Promise<unknown>` in this
> repo's `undici-types/fetch.d.ts`, the
> [zod JSON Schema documentation](https://zod.dev/json-schema), and MDN on
> [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch).
> Target: **TypeScript 7.0.2** (the phase spine; TypeScript is not installed in
> this checkout), zod **4.4.3**, React **19.2.8**, Node **24.20.0**.
> Documentation-validated; **no console blocks, no timings**.

**`Response.json()` is declared `Promise<any>`, and that single declaration is
the reason this chapter exists.** Every type in
[chapter 06](../06-typing-the-custom-hooks/README.md) — `AsyncState<T>`, the
narrowed component, the reducer's payloads — rests on `T` being true, and `T`
enters the program through a function whose return type checks nothing. A
client that closes that hole once, from the same zod schemas the server
validates with, is the difference between types that describe the app and types
that describe an intention. [Chapter 05·03c](../05-typed-express-handlers/03c-the-typed-error-handler.md)
promised this chapter would be where errors get narrowed by `code`; it is.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The `fetch` hole](01-the-fetch-hole.md)** | 🔴 `json(): Promise<any>` in the DOM lib versus `Promise<unknown>` in undici — the same call, two types, decided by `tsconfig`; `fetch` not rejecting on 4xx; what `RequestInit` does and does not check |
| 2 | **[Parsing the response](02-parsing-the-response.md)** | `safeParse` at the boundary and why the server's types are not evidence; `z.input` / `z.output` / `z.infer` on the client side; what parsing costs and the three places to skip it |
| 3 | **[The route map](03-the-route-map.md)** | One object keyed by path so `client.get('/products')` infers its response; 🔴 the annotation that destroys every inference the map exists for; `ResponseOf` and constrained `infer` |
| 3b | **[Typed path parameters](03b-typed-path-parameters.md)** | `PathParams<P>` from template literal types, and why the branch order *is* the algorithm; `{query?: never}` versus `{}`; what the map buys, and the parity test that closes what it does not |
| 4 | **[Errors as a result](04-errors-as-a-result.md)** | `Result<T>` and the six failure kinds, each earning its place by rendering differently; `Result<never>`; the panel switch that cannot be incomplete |
| 4b | **[Narrowing `ErrorBody` by code](04b-narrowing-errorbody-by-code.md)** | Chapter 05's promise: the extras table, and `{[C in ErrorCode]: …}[ErrorCode]` turning catchall unknowns into `product_ids: number[]` |
| 4c | **[Parsing and rendering API errors](04c-parsing-and-rendering-api-errors.md)** | The one defensible `as` in the client; the panel that keeps its `default:` and the helper that restores exhaustiveness; the contract test |
| 4d | **[Throwing on purpose](04d-throwing-on-purpose.md)** | Programmer errors; the `unwrap` bridge and exactly what it costs; `useAsyncResult`, the hook that does not need it |
| 5 | **[Signals and timeouts](05-signals-timeouts-and-retries.md)** | A required positional `signal` as the only available check; `AbortSignal.any` with `AbortSignal.timeout`, and why `TimeoutError` versus `AbortError` matters |
| 5b | **[Typing the retry wrapper](05b-typing-the-retry-wrapper.md)** | `T` inferred from the operation; `isRetryable` as an exhaustive switch; a `delay` that honours the signal; 🔴 the idempotency key that belongs to the attempt, not the request |
| 6 | **[Emitting the contract](06-emitting-the-contract.md)** | 🔴 `target: 'draft-2020-12'`, and why `'openapi-3.1'` compiles but is not a target; `({} & string)`; `io: 'input'` for requests; `unrepresentable` |
| 6b | **[Emitting from the route map](06b-emitting-from-the-route-map.md)** | The loop, the registry and `$defs`; the four shapes OpenAPI wants that zod does not emit; regenerate-and-diff in CI |

## The four sentences to keep

1. **`res.json()` is `any` (or `unknown`), so every type downstream of it is a
   claim about data nobody checked.** The parse is what turns the claim into a
   fact.
2. **The server's types are not evidence on the client.** They are a different
   compilation, deployed separately, and the wire between them carries JSON.
3. **Errors are values.** A failure with a `code` you narrow beats an exception
   you `instanceof`, because the compiler can check that you handled every code
   and cannot check that you caught every throw.
4. **One route map, and the call sites stop being strings.**
   `client.get('/products/:slug', {slug})` is checked against the same map the
   server's routes are registered from.

## Phase gate

You are done with this topic when you can say what `res.json()` returns under
each of the two lib configurations and why it matters for a client shared with
a script; write the client's parse boundary and justify what it costs; explain
what a route map buys that six hand-written functions do not; narrow an
`ErrorBody` by `code` to reach a per-code extra; and emit a JSON Schema from a
zod schema with the right target and the right `io` direction.

## Where this connects

Backwards to
[chapter 02 · zod as the source of truth](../02-zod-as-the-source-of-truth/README.md),
whose schemas this client re-uses on the far side of the wire, and to
[chapter 05·03c](../05-typed-express-handlers/03c-the-typed-error-handler.md),
which produced the `ErrorBody` this chapter narrows. Forwards to
**chapter 08 · Utility types in app code** *(not written yet)*,
whose `Record`, template-literal and `satisfies` material the route map leans
on. Sideways to
[chapter 06](../06-typing-the-custom-hooks/README.md), which consumes every
type this client produces.

---

Phase index: [Phase 6 — TypeScript across the stack](../README.md) ·
← Prev chapter: [Typing the custom hooks](../06-typing-the-custom-hooks/README.md) ·
Next chapter → **Utility types in app code** *(not written yet)*
