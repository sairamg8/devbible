---
title: "A failure returned as a value can be checked for exhaustively and a thrown one cannot, so the client returns a Result whose failure kinds are a union the error panel must switch over"
sidebar_label: "04 · Errors as a result"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the TypeScript handbook on
> [narrowing and exhaustiveness](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
> and the
> [`useUnknownInCatchVariables` compiler option](https://www.typescriptlang.org/tsconfig/#useUnknownInCatchVariables);
> the **zod 4.4.3** `ZodSafeParseResult` and `$ZodIssue` declarations read in
> this repo; MDN on
> [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)
> (rejects only on network failure) and
> [`AbortSignal.timeout()`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static).
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**A `throw` is invisible to the type system and a returned value is not.**
Nothing in a function's type says which exceptions it raises, `catch` gives you
`unknown`, and no compiler will tell you that the panel handling API errors
forgot the case for the new one. A failure returned as a value gets all the
machinery [chapter 04](../04-discriminated-unions/README.md) built for the
order state machine: a discriminant, an exhaustive `switch`, and a compile
error at every consumer when a member is added. That is the entire argument;
the rest of this chunk is the union, the code that produces it and the switch
that consumes it. The per-code narrowing is
[04b](04b-narrowing-errorbody-by-code.md) and
[04c](04c-parsing-and-rendering-api-errors.md); the two places this app still
throws on purpose are [04d](04d-throwing-on-purpose.md).

## `Result<T>` and the failure union

```ts
// packages/shared/src/result.ts
export type Result<T> =
  | {ok: true;  value: T}
  | {ok: false; failure: ApiFailure};
```

```ts
// packages/shared/src/failure.ts
import type {$ZodIssue} from 'zod/v4/core';

export type ApiFailure =
  | {kind: 'offline';   path: string}                                  // fetch rejected
  | {kind: 'timeout';   path: string; ms: number}                      // AbortSignal.timeout
  | {kind: 'cancelled'; path: string}                                  // our own abort
  | {kind: 'malformed'; path: string; status: number}                  // body was not JSON
  | {kind: 'contract';  path: string; issues: $ZodIssue[]}             // body did not match
  | {kind: 'api';       path: string; status: number; error: ApiError};// a real ErrorBody
```

**Six kinds, and each one exists because the UI does something different with
it.** That is the test for whether a member belongs: if two kinds always
produce the same screen and the same log line, they are one kind.

| Kind | What happened | Retry helps? | What the user sees |
|---|---|---|---|
| `offline` | `fetch` rejected — no response at all | Yes | "You appear to be offline" plus retry |
| `timeout` | the request outlived its budget | Yes | "That took too long" plus retry |
| `cancelled` | the effect's cleanup aborted it | N/A | nothing — the screen already moved on |
| `malformed` | a response that was not JSON, usually a proxy's HTML | No | generic error, and an alert to engineering |
| `contract` | JSON that did not match the schema | No | generic error, and an alert to engineering |
| `api` | the server said no, in the documented shape | Depends on the code | the message for that code — [04b](04b-narrowing-errorbody-by-code.md) |

🔴 **`cancelled` is a failure the UI must not render.** It is the normal
consequence of navigating away, and treating it as an error is how an app
starts flashing red panels during routine navigation. It is in the union so
that the consumer is *forced to decide*, which is exactly what the union is
for — leaving it out would mean cancellation arrives as some other kind and
gets rendered.

## Producing the failures

```ts
// packages/client/src/request.ts
export async function request<S extends z.ZodType>(
  path: string, schema: S, init: RequestInit & {timeoutMs?: number} = {},
): Promise<Result<z.output<S>>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {credentials: 'same-origin', ...init});
  } catch (e: unknown) {
    if (isTimeout(e))   return fail({kind: 'timeout',   path, ms: init.timeoutMs ?? 0});
    if (isUserAbort(e)) return fail({kind: 'cancelled', path});
    return fail({kind: 'offline', path});
  }

  if (res.status === 204) return {ok: true, value: undefined as z.output<S>};

  let body: unknown;
  try { body = await res.json(); }
  catch { return fail({kind: 'malformed', path, status: res.status}); }

  if (!res.ok) {
    const error = parseApiError(body);                 // 04b
    return error
      ? fail({kind: 'api', path, status: res.status, error})
      : fail({kind: 'malformed', path, status: res.status});
  }

  const parsed = schema.safeParse(body);
  return parsed.success
    ? {ok: true, value: parsed.data}
    : fail({kind: 'contract', path, issues: parsed.error.issues});
}

const fail = (failure: ApiFailure): Result<never> => ({ok: false, failure});
```

📌 **`fail` returns `Result<never>`**, which is assignable to `Result<T>` for
every `T` — the failure branch does not mention `T`, so `never` is the honest
type parameter and one helper serves every call site. It is the same reason
`assertNever` returns `never`.

📌 **The `catch (e: unknown)` is a narrowing site, not a rethrow site.** The
three guards (`isTimeout`, `isUserAbort`, and everything else) come from
[chapter 06·06b](../06-typing-the-custom-hooks/06b-abort-and-the-unknown-rejection.md),
and they are the reason each `DOMException` name becomes a different member of
the union rather than a string comparison at the render site.

## Consuming it: the switch that cannot be incomplete

```tsx
// apps/web/src/components/FailurePanel.tsx
import {assertNever} from '@storefront/shared';

export function FailurePanel({failure, onRetry}: {failure: ApiFailure; onRetry: () => void}) {
  switch (failure.kind) {
    case 'cancelled': return null;
    case 'offline':   return <Retryable title="You appear to be offline" onRetry={onRetry} />;
    case 'timeout':   return <Retryable title="That took too long" onRetry={onRetry} />;
    case 'malformed':
    case 'contract':  return <Unexpected reportId={report(failure)} />;
    case 'api':       return <ApiErrorPanel error={failure.error} onRetry={onRetry} />;
  }
  return assertNever(failure, 'FailurePanel');
}
```

Adding a seventh kind — `'rate_limited'` promoted out of `api`, say — breaks
this file and every other consumer at build time. **That is the property a
`throw` cannot have**, because there is no type that lists what a function
throws and no check that a `catch` handled all of it.

## Gotchas

**★ A `Result` you forget to check does not compile, and that is the point.**
`const cart = await client.get('/cart', {}); cart.items` fails — `items` is not
a property of the union. The equivalent throwing client compiles fine and
crashes at run time when the request 500s. The friction *is* the feature; a
codebase that finds it annoying is a codebase where the error path was never
handled.

**★ Two statuses, and they can disagree.** `failure.status` is the HTTP status
and `failure.error.status` is the number the server put *in the body*.
[Chapter 05·03c](../05-typed-express-handlers/03c-the-typed-error-handler.md)
noted that nothing on the server relates them, so nothing on the client can
either. Read the HTTP one for retry decisions and the body one for display, and
never assume they match.

**★ `malformed` is the bucket for "an intermediary answered", and it is more
common than it sounds.** A captive portal, an authenticating proxy, or a CDN
error page all return HTML with a 200 or a 502. It has to be a distinct kind
because its diagnosis is "something between us and the API", not "the API is
broken".

**★ `contract` must never be retried and must always be reported.** Retrying
re-fetches the same unreadable body; the only useful action is an alert, with
`issues` in the log. It is also the single most valuable failure in the union,
because it is the automatic detector for a client and an API that have drifted
out of agreement.

**★ Rendering `cancelled` is the bug this union exists to prevent, and it is
still possible.** A `default:`-less switch forces you to *handle* the case, not
to handle it *correctly* — `case 'cancelled': return <Unexpected/>` compiles.
Types stop omissions, not mistakes.

**★ `Result<never>` is what makes one `fail` helper work everywhere, and
reading it as an error is a common misstep.** `{ok: false; failure: …}` is
assignable to `Result<T>` for any `T` because the failure branch never mentions
`T`; `never` in the parameter position is therefore the most general thing the
helper can return, not the least.

## Interview questions

**★ Why return failures rather than throw them?**
Because the type system can check a returned value and cannot check a thrown
one. A function's type says nothing about what it throws, `catch` produces
`unknown` under `strict`, and no compiler will point at the panel that forgot
to handle a new error case. A discriminated failure union gets narrowing, an
exhaustive `switch` with `assertNever`, and a build error at every consumer
when a kind is added — the same machinery the order state machine uses, applied
to the error path.

**★ What decides whether something is a distinct failure kind?**
Whether the UI or the operator does something different with it. If two
conditions always produce the same screen and the same log line, they are one
kind with a field, not two kinds. `offline` and `timeout` are separate because
one says "check your connection" and the other says "the server is slow";
`malformed` and `contract` are separate because one blames an intermediary and
the other blames a deploy.

**★ Why is `cancelled` in the union rather than silently swallowed?**
Because swallowing it in the client means the consumer never learns that
nothing happened, and it will render a stale state or a spinner forever.
Putting it in the union forces every consumer to decide, and the correct
decision — render nothing — is one line. The alternative, filtering it inside
`request` and resolving with some placeholder, means inventing a value for a
request that produced none.

---

← Prev: [Typed path parameters](03b-typed-path-parameters.md) ·
[Overview](README.md) ·
Next → [Narrowing `ErrorBody` by code](04b-narrowing-errorbody-by-code.md)
