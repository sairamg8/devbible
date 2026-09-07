---
title: "The API sketch is one endpoint per journey with its request and response fields, idempotency on anything that charges or creates, pagination on anything that lists — and a wrong API leaks into every later box"
sidebar_label: "05 · The API sketch"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against [RFC 9110, HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
> §9.2.1 (safe methods) and §9.2.2 (idempotent methods), quoted verbatim. The idempotency-key
> mechanism is application-level — RFC 9110 does not define it, and no other standard is claimed
> for it here. Code is TypeScript targeting Node 24 (LTS), written to be runnable; **nothing was
> run**. The full REST treatment is phase 10 of this track.

**The API sketch is the first artefact that constrains every later box, and it is written in
about five minutes: one endpoint per functional journey, with the fields that go in and the
fields that come back.** Two rules carry most of its weight. Anything that charges or creates
gets an idempotency key, because HTTP's `POST` is neither safe nor idempotent by definition and
the client *will* retry a timed-out checkout. Anything that lists gets pagination with a stable
cursor, because "return all orders" is a design that works until the first customer with ten
thousand of them. The sketch also decides the shape of asynchrony — whether "place order"
returns a confirmed order or an accepted one that is confirmed later — and that single choice
propagates into the state machine, the callback endpoint, the read path and the deep dive. An
API sketched wrong is not a local mistake; it is the reason the data model and the diagram will
have to be redrawn at minute thirty.

## What HTTP gives you, and what it does not

RFC 9110 defines two properties a sketch leans on:

> *"A request method is considered 'safe' if its defined semantics are essentially read-only"* ·
> *"GET, HEAD, OPTIONS, and TRACE are defined as safe methods"* — RFC 9110 §9.2.1

> *"A request method is idempotent if the intended effect on the server of multiple identical
> requests with that method is the same as the effect for a single such request"* · *"PUT,
> DELETE, and the safe methods are idempotent"* — RFC 9110 §9.2.2

And it says why idempotency matters for the client:

> *"Clients may be able to automatically retry requests with idempotent methods following a
> connection failure, since the intended effect should be equivalent"* — RFC 9110 §9.2.2

`POST` is in neither list. Placing an order is a `POST`, a client whose connection dropped
after sending it does not know whether the order exists, and a retry may create a second one.
The fix is not in HTTP; it is an **idempotency key** the client generates and sends with the
request, and the server uses to return the first result on a repeat. That is an application
contract, and the sketch is where it is declared.

## The storefront's checkout, sketched

One endpoint per journey from [01 · Functional requirements](01-functional-requirements.md),
with request and response fields, in the shape it goes on the board:

```text
POST   /orders                     Idempotency-Key: <client uuid>
       { cartId, shippingAddressId, paymentMethodToken }
  →    201 { orderId, status: "PENDING_PAYMENT", total, items[] }        first time
  →    200 { same body }                                                  replay with the same key
  →    409 { error: "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY" }        same key, different request

GET    /orders/{orderId}
  →    200 { orderId, status, total, items[], paymentState, updatedAt }

GET    /orders?cursor=<opaque>&limit=20
  →    200 { items: [...], nextCursor }                                   stable order: createdAt desc, id desc

POST   /payments/callbacks/<provider>      X-Signature: <hmac>
       { providerPaymentId, orderId, outcome: "SUCCEEDED" | "FAILED", amount }
  →    200                                                                always 200 once verified; idempotent on providerPaymentId

PATCH  /admin/products/{productId}/stock  If-Match: <etag>
       { delta: -5, reason }
  →    200 { productId, available, version }
  →    412                                                                etag mismatch: someone else changed it first
```

Illustrative — the fields matter, not the exact spelling. Each line encodes a decision:

- **`POST /orders` returns `PENDING_PAYMENT`, not `PAID`.** The provider's confirmation is
  asynchronous, so the order is *accepted*, and the state machine has a pending state. A sketch
  that returns `PAID` has promised something the write path cannot deliver without holding a
  row lock across a network call.
- **The idempotency key is a header, client-generated, and the replay returns the original
  response.** Same key with a different body is an error, because silently returning the first
  order for a different cart is a correctness bug.
- **The list is cursor-paginated with a stable sort.** Offset pagination on a table that
  receives inserts skips or repeats rows; a cursor over `(createdAt, id)` does not.
- **The provider callback is signed and idempotent on the provider's id**, because callbacks
  are delivered at least once and can arrive twice or out of order.
- **The admin stock change carries a version**, because two admins — or an admin and the
  sale — can change the same row, and the last writer must not silently win.

## The sketch in types

The same contract as TypeScript, which is what the implementer and the test writer will read:

```ts
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED';

export interface CreateOrderRequest {
  cartId: string;
  shippingAddressId: string;
  paymentMethodToken: string;   // the provider's token — never a card number
}

export interface Order {
  orderId: string;
  status: OrderStatus;
  totalCents: number;           // integer minor units
  items: ReadonlyArray<{ productId: string; qty: number; unitPriceCents: number }>;
  paymentState?: { providerPaymentId: string; outcome: 'SUCCEEDED' | 'FAILED' };
  updatedAt: string;            // ISO-8601
}

export interface Page<T> {
  items: ReadonlyArray<T>;
  nextCursor: string | null;    // opaque; null means no more
}

export interface ProviderCallback {
  providerPaymentId: string;    // the idempotency key for this endpoint
  orderId: string;
  outcome: 'SUCCEEDED' | 'FAILED';
  amountCents: number;
}
```

Writing the types costs a minute and catches the decisions the prose hides: the money type,
the optional payment state (absent while pending), the opaque cursor, the callback's own
idempotency key.

## Idempotency keys, precisely

The contract, since it is the sketch's most-probed line:

1. The client generates a key per *intent* — one per checkout attempt, reused across retries
   of that attempt, never across a new attempt.
2. The server stores `(key, request hash, response)` for a retention window, keyed by the
   authenticated principal so one user's key cannot replay another's.
3. On a repeat with the same key and the same request hash: return the stored response, do
   not re-execute.
4. On a repeat with the same key and a different hash: reject, because the intent changed.
5. Concurrent repeats — two identical requests in flight at once — are serialised by a unique
   constraint on the key, so the second waits or fails rather than creating a second order.

Point 5 is the one interviewers probe: "what if both requests arrive at the same time?" The
answer is the unique index, not the check-then-insert.

## Pagination, precisely

Cursor over a stable sort key, opaque to the client, encoding the last row's `(createdAt,
id)`. The server queries `WHERE (created_at, id) < (cursor.createdAt, cursor.id) ORDER BY
created_at DESC, id DESC LIMIT n`, which is index-friendly and immune to inserts between pages.
Offset pagination — `?page=3` — is simpler and acceptable for an admin screen over a static
table, and wrong for a customer's order history, where inserts happen between pages. Say which
you chose and why; phase 10 has the full comparison.

## How a wrong API leaks

The sketch is upstream of everything, so its mistakes reappear as other boxes' problems:

| Sketch mistake | Where it surfaces later |
|---|---|
| `POST /orders` returns `PAID` | the write path holds a row lock across the provider call; the deep dive has to redesign it |
| no idempotency key | duplicate orders on retry; the "what if the client times out?" follow-up has no answer |
| `GET /orders` returns everything | the read path's latency target fails for heavy customers; the data model needs a cursor index it did not plan |
| callback not idempotent | double state transitions when the provider redelivers; a reconciliation job that cannot tell a duplicate from a second payment |
| stock change without a version | lost updates between the admin and the sale; the inventory deep dive discovers two writers late |
| money as a float in the response | rounding disputes; every later box that touches totals inherits it |

Each row is a minute in the sketch that saves ten in the deep dive.

## What the sketch is not

Not a full REST design. Versioning, error formats, filtering, rate-limit headers, conditional
requests and webhooks-as-a-product are phase 10's material and are out of scope for the five
minutes. What the sketch must have is the endpoint per journey, the fields, the asynchrony
decision, idempotency where money or creation is involved, and pagination where lists are.
Everything else is "we'd add that; it doesn't change the diagram."

## Gotchas

**★ Symptom: "what if the client times out after placing the order?" and no answer.** Cause:
no idempotency key in the sketch; `POST` is not idempotent and HTTP offers no retry safety for
it. Fix: a client-generated key per intent, stored with the request hash and the response, with
a unique constraint that serialises concurrent repeats.

**★ Symptom: `POST /orders` returns `PAID`, and the write-path deep dive has to hold a lock
across the provider call.** Cause: the asynchrony decision made wrong in the sketch. Fix:
return `PENDING_PAYMENT`; the provider's callback moves the order to `PAID` or `FAILED`; the
state machine has a pending state from the start.

**Symptom: the same idempotency key with a different cart returned the first order.** Cause:
the request hash not stored. Fix: store the hash; same key with a different body is rejected.

**Symptom: two identical requests arrived together and both created orders.** Cause:
check-then-insert on the key. Fix: a unique index on `(principal, key)`; the second insert
fails or waits.

**Symptom: page two repeated an order from page one.** Cause: offset pagination over a table
receiving inserts. Fix: a cursor over `(createdAt, id)` with a matching index.

**Symptom: the provider's callback arrived twice and the order was charged twice in the
ledger.** Cause: the callback endpoint not idempotent. Fix: idempotent on `providerPaymentId`;
verify the signature; return 200 on a repeat without re-applying.

**Symptom: an admin's stock correction vanished during the sale.** Cause: last writer wins.
Fix: a version or etag on the row; the write carries `If-Match` and fails with 412 on a
mismatch.

**Symptom: a card number in the request body.** Cause: the provider's tokenisation skipped.
Fix: the request carries the provider's token only; card data never enters the system.

**Symptom: five minutes on error formats and versioning, no time for the diagram.** Cause:
the sketch mistaken for the full API design. Fix: endpoints, fields, asynchrony, idempotency,
pagination — and "we'd add the rest; it doesn't change the diagram."

## Interview questions

**★ Sketch the API for checkout, and say which decisions it encodes.**
`POST /orders` with an idempotency-key header, taking the cart, address and the provider's
payment token, returning 201 with the order in `PENDING_PAYMENT`; `GET /orders/{id}`;
`GET /orders` cursor-paginated over a stable sort; a signed, idempotent provider callback that
moves the order to paid or failed; and an admin stock change carrying a version. It encodes
that placement is synchronous and confirmation asynchronous, that retries cannot create
duplicate orders, that the order list is safe under inserts, that callbacks may be redelivered,
and that inventory has two writers.

**★ Why does `POST /orders` need an idempotency key when `PUT` does not?**
Because RFC 9110 defines `PUT`, `DELETE` and the safe methods as idempotent — repeating them has
the same intended effect as sending once, so a client may retry after a connection failure —
and `POST` is not in that list. A checkout whose connection drops after the request was sent
leaves the client not knowing whether the order exists, and a plain retry may create a second
one. The key is an application-level contract: the client generates one per intent, the server
stores the request hash and the response against it, returns the stored response on a repeat,
rejects a repeat with a different body, and serialises concurrent repeats with a unique
constraint.

**Why cursor pagination for order history, and when is offset acceptable?**
A cursor encodes the last row's stable sort key — `(createdAt, id)` — so the next page is a
range query immune to inserts between pages and friendly to an index; offset pagination skips
or repeats rows when the table changes between requests and gets slower as the offset grows.
Offset is acceptable for an admin screen over a table that does not change during browsing;
a customer's order history changes, so it gets a cursor.

**What does the provider callback need, and why?**
A signature verified before anything else, because it arrives from the public internet
claiming to be the provider; idempotency on the provider's payment id, because callbacks are
delivered at least once and may arrive twice or out of order; a 200 on repeats without
re-applying the transition; and a reconciliation job for the case where it never arrives. The
callback is the asynchronous half of the order state machine, and its contract is part of the
sketch.

**How does a wrong API sketch surface later in the round?**
As other boxes' problems: a synchronous `PAID` response forces a lock across the provider call
in the write-path deep dive; a missing idempotency key leaves the timeout follow-up unanswered;
an unpaginated list breaks the read path's latency target for heavy customers; a non-idempotent
callback produces double transitions; an unversioned stock write loses updates between two
writers. Each is a minute in the sketch that would have saved ten minutes later.

---

← Prev: [04 · Traffic shapes](04-traffic-shapes.md) · Index: [Phase 1 — The method](README.md) · Next → **The data model from the access patterns** *(not written yet)*
