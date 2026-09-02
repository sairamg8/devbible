---
title: "The one assertion this client permits itself sits in the function that parses an error body, because looking a schema up by the code you just parsed is a relationship the compiler cannot follow"
sidebar_label: "04c · Parsing and rendering API errors"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations read in this repo
> (`ZodSafeParseResult`, `_enum`), the TypeScript handbook on
> [type assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)
> and [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html),
> and the contract-test requirement stated in
> [chapter 05·03c](../05-typed-express-handlers/03c-the-typed-error-handler.md).
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**[The type](04b-narrowing-errorbody-by-code.md) is worthless without a parse
that produces it, and that parse contains the only `as` in the client.** It is
worth looking at closely, because it is a good example of the shape a
defensible assertion has: both inputs already validated at run time, one line,
inside a function whose entire job is the conversion. Around it sit the panel
that consumes the union and the contract test that is the only thing connecting
the client's extras table to the server's untyped `Record<string, unknown>`.

## The runtime half

```ts
// packages/client/src/error.ts
export function parseApiError(body: unknown): ApiError | null {
  const base = ErrorBody.safeParse(body);
  if (!base.success) return null;                 // not our contract → 'malformed'

  const code = base.data.code;
  const extras = code in ERROR_EXTRAS
    ? ERROR_EXTRAS[code as keyof typeof ERROR_EXTRAS].safeParse(body)
    : null;

  if (extras && !extras.success) return null;     // documented extras missing → contract bug
  return {...base.data, ...(extras?.data ?? {})} as ApiError;
}
```

⚠️ **The `as ApiError` at the end is a real assertion and it is the honest
place for one.** The compiler cannot follow "we parsed `ErrorBody`, then looked
up the extras schema *by the code we just parsed*, so the merged object matches
the member for that code" — that is a relationship between a runtime value and
a type-level map. The assertion is confined to one line in one function whose
inputs are both parsed, which is the standard this corpus applies to every
cast: **not that it never happens, but that it happens once, next to the
evidence.**

📌 **Two `safeParse` calls, both against the whole `body`.** The extras schema
is not `.strict()`, so parsing the full body against `z.object({product_ids:
…})` picks out the one field and ignores the rest. Parsing `base.data` instead
would fail, because `ErrorBody`'s catchall keeps the extras but the object
spread order then matters — parsing the original is simpler and has one fewer
thing to get wrong.

## Narrowing, at the only place it matters

```tsx
// apps/web/src/components/ApiErrorPanel.tsx
export function ApiErrorPanel({error, onRetry}: {error: ApiError; onRetry: () => void}) {
  switch (error.code) {
    case 'OUT_OF_STOCK':
      return <OutOfStockList productIds={error.product_ids} />;
      //                                       ^^^^^^^^^^^ number[]
    case 'PAYMENT_DECLINED':
      return <DeclineMessage declineCode={error.decline_code} />;
    case 'STALE_STATUS':
      return <StaleStatus current={error.current} onRefresh={onRetry} />;
      //                                 ^^^^^^^ OrderStatus, five values
    case 'RATE_LIMITED':
      return <TooFast retryAfter={error.retry_after_seconds} onRetry={onRetry} />;
    case 'VALIDATION':
      return <FieldIssues issues={error.issues} />;
    default:
      return <Message title={error.title} />;
  }
}
```

🔴 **This is the one switch in the app that keeps its `default:`, and the
reason is worth stating.** Sixteen codes carry no extras and render identically
from `title`; enumerating them to satisfy `assertNever` would be sixteen case
labels that all do the same thing, and the next code added would need a
seventeenth. The exhaustiveness that matters here is over the *five codes with
extras*.

⚠️ **That is a deliberate exception to
[chapter 04·03's rule](../04-discriminated-unions/03-exhaustiveness-in-the-ui-and-on-the-wire.md),
and it is only defensible with the helper that restores the check** — which is
the "show the fix" half people skip:

```tsx
// exhaustive over the five codes that carry extras; no default clause
type WithExtras = Extract<ApiError, {code: keyof typeof ERROR_EXTRAS}>;

function extrasPanel(error: WithExtras, onRetry: () => void) {
  switch (error.code) {
    case 'OUT_OF_STOCK':     return <OutOfStockList productIds={error.product_ids} />;
    case 'PAYMENT_DECLINED': return <DeclineMessage declineCode={error.decline_code} />;
    case 'STALE_STATUS':     return <StaleStatus current={error.current} onRefresh={onRetry} />;
    case 'RATE_LIMITED':     return <TooFast retryAfter={error.retry_after_seconds} onRetry={onRetry} />;
    case 'VALIDATION':       return <FieldIssues issues={error.issues} />;
  }
  return assertNever(error, 'extrasPanel');
}

export function ApiErrorPanel({error, onRetry}: {error: ApiError; onRetry: () => void}) {
  return hasExtras(error)
    ? extrasPanel(error, onRetry)
    : <Message title={error.title} />;
}

function hasExtras(e: ApiError): e is WithExtras {
  return e.code in ERROR_EXTRAS;
}
```

Adding a sixth entry to `ERROR_EXTRAS` now widens `WithExtras` and breaks
`extrasPanel` at build time, while an unmodelled code still degrades to the
plain message. `Extract` is
[chapter 08·05](../08-utility-types-in-app-code/05-exclude-extract-and-distributivity.md).

## The contract test

```ts
// apps/web/test/error-contract.test.ts
import {parseApiError} from '../src/lib/error.js';

const real = await postCheckoutWithSoldOutItem();   // hits the real API in CI
const body: unknown = await real.json();

const error = parseApiError(body);
expect(error?.code).toBe('OUT_OF_STOCK');
expect(error && 'product_ids' in error).toBe(true);
```

Chapter 05·03c said *"a contract test parses a real `OUT_OF_STOCK` response
through it"*, and this is the shape of it: a real response from a real handler,
through the client's own parser. **Neither side's types can check this** — the
server attaches extras through `Record<string, unknown>` and the client
declares them in a table — so the only thing connecting them is a test that
runs both. One case per entry in `ERROR_EXTRAS` is the coverage bar, and the
table itself is the checklist: iterate `Object.keys(ERROR_EXTRAS)` in the test
and fail on a code with no fixture.

## Gotchas

**★ A code the client does not know must not fail the parse.** `z.enum(
ERROR_CODES)` rejects a code added by a newer server, so `parseApiError`
returns `null` and the failure becomes `malformed` — which is arguably right
(the client genuinely cannot describe it) and arguably a regression from just
showing `title`. If you prefer the latter, widen the schema's `code` to
`z.string()` and keep `ApiError` as the *narrowed* type, with an `isKnownCode`
guard doing the conversion. Decide once; do not leave it to whoever adds the
twenty-second code.

**★ The extras are unchecked on the server, so the table can drift.** The
server attaches `extra` as `Record<string, unknown>`, meaning a handler can
send `product_ids: 'oops'` and compile. The client's `safeParse` of the extras
catches it — as a `null` return and therefore a `malformed` failure, which
reads as "the proxy broke" rather than "the API sent a bad payload". Logging
the extras parse failure separately is worth the extra branch.

**★ `code in ERROR_EXTRAS` narrows the *value* and not the index type.**
`ERROR_EXTRAS[code]` after an `in` check still errors, because `code` is typed
`ErrorCode` and the table's keys are five of them — hence the
`code as keyof typeof ERROR_EXTRAS` inside the lookup. The predicate `hasExtras`
above is the version that narrows properly, and it is the one to prefer when
the narrowed value is used more than once.

**★ Two `status` values, still.** `ApiError.status` is the number in the body
and `failure.status` is the HTTP status.
[Chapter 05·03c](../05-typed-express-handlers/03c-the-typed-error-handler.md)
established that nothing on the server relates them. Render the body's; decide
retries on the HTTP one.

**★ Rendering `error.title` straight into the DOM is the right call only
because the server controls it.** `title` is written by the API's classify
table, never by a user, so it is safe text. The moment a code's `title`
includes user input — a duplicate email, a rejected slug — that decision needs
revisiting, and no type marks the difference between server-authored and
user-derived strings.

**★ The `VALIDATION` extras and the client's own form errors are different
shapes.** The server's `issues` are the API's field paths; `useForm`'s errors
are zod issues from the client's own parse
([chapter 06·08c](../06-typing-the-custom-hooks/08c-useform-typed-from-the-schema.md)).
Mapping server issues onto form fields is a per-form decision and requires the
paths to agree, which nothing checks — a shared request schema on both sides is
what makes them agree in practice.

**★ `parseApiError` returning `null` for two very different reasons is a small
lie.** "Not our contract at all" and "our contract with broken extras" both
produce `null` and therefore `malformed`. If the distinction matters
operationally — and it does, because the second is a server bug and the first
is an intermediary — return a small union from the parser instead of `null`,
and let `request` map it to two different failure kinds.

## Interview questions

**★ There is an `as ApiError` in `parseApiError`. Defend it.**
It bridges a relationship the compiler cannot follow: the extras schema was
looked up *by the code that was just parsed*, so the merged object does match
the union member for that code — but that fact lives in the control flow, not
in a type. The assertion is confined to one line, in one function, whose two
inputs are both `safeParse` results, and every value it produces has been
validated at run time. The rule is not "never cast"; it is "cast once, next to
the evidence, in a function whose whole job is the conversion".

**★ This panel keeps its `default:` clause. Does that not destroy
exhaustiveness?**
Over the twenty-one codes, yes, deliberately: sixteen render identically from
`title`, so enumerating them would be sixteen identical case labels and a
seventeenth next quarter. The exhaustiveness that matters is over the five
codes with extras, and it is restored by a helper typed
`Extract<ApiError, {code: keyof typeof ERROR_EXTRAS}>` with no `default:`,
reached through a type predicate. Adding an extras schema without a case then
fails to compile, while an unmodelled code degrades to the plain message.

**★ What happens when the server adds a code the client has never heard of?**
`z.enum(ERROR_CODES)` rejects it, `parseApiError` returns `null`, and the
failure is reported as `malformed` — the client says "something between us
broke" for what is really "the API is newer than I am". The alternative is to
parse `code` as `z.string()` and narrow to `ErrorCode` with a guard, keeping
the title-only render for unknown codes. Both are defensible; what is not
defensible is discovering which one you chose during an incident.

**★ Why does the contract test have to hit a real response?**
Because the two sides of this contract are connected by nothing else. The
server attaches extras as `Record<string, unknown>` — it cannot check them —
and the client declares them in a table it wrote by reading the server's code.
A fixture the client authored proves only that the client agrees with itself.
The test has to run the handler that produces an `OUT_OF_STOCK` and put that
body through `parseApiError`, once per entry in the extras table.

**★ How would you know if the extras table has an entry the server never
sends?**
You would not, from types. Iterating `Object.keys(ERROR_EXTRAS)` in the
contract test and requiring a fixture per key is the check — a code in the
table with no way to produce it is either dead configuration or an endpoint
nobody tested. That is the same idea as the route-parity test one chunk
earlier: when a relationship spans two deployables, the assertion is a test
that runs both.

---

← Prev: [Narrowing `ErrorBody` by code](04b-narrowing-errorbody-by-code.md) ·
[Overview](README.md) ·
Next → [Throwing on purpose](04d-throwing-on-purpose.md)
