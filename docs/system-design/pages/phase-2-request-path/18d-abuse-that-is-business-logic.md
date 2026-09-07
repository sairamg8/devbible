---
title: "Credential stuffing, price scraping, sale-day hoarding and id enumeration arrive one individually valid request at a time from many addresses, so a per-IP limit sees nothing and a pattern rule has nothing to match — the defences are counters keyed by account and by resource, an ownership check only your code can make, a cost cap on the uncacheable endpoints, and an invariant enforced at the database rather than at the edge"
sidebar_label: "18d · Abuse that is business logic"
sidebar_position: 18.6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07. **Method and common practice** — no primary source defines credential
> stuffing defences, scraping economics or checkout hoarding, and no vendor documentation was
> fetched, so this page names no product, no library and no figure. The 429 and 503 contracts it
> relies on are quoted verbatim from [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) §4
> and [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.6.4 in
> [18](18-abuse-at-the-edge.md); the limiter algorithms are [07](07-rate-limiting.md).
> Authentication, authorization and password storage in depth are
> [Part 9](../../syllabus/09-security-and-compliance.md). **No sandbox run; no measurement.**

**Four abuse patterns defeat every control on the previous three pages, and they defeat it the
same way: each individual request is exactly what a legitimate client sends.** A login attempt
with a real email address and a wrong password is a valid login attempt. A `GET` on a product page
is a product page view. A checkout for one unit of a popular item is a sale. A `GET
/api/orders/1234` with a valid token is a customer looking at an order. There is no shape to match
and, when the source addresses are many and the rate per address is low, no volume to limit. The
harm lives in the *aggregate* and in *who* the caller is with respect to the data — both of which
only your service can see. This page is those four patterns, what each one actually costs you, and
the defence for each shown as code or as a rule rather than named: per-account counters and an
ordering that puts the expensive step last, a cost cap on the uncacheable endpoints, an invariant
enforced in the database, and an ownership check on every read.

## Why a per-IP limit sees nothing

| | Credential stuffing | Scraping | Sale-day hoarding | Id enumeration |
|---|---|---|---|---|
| the request | a valid `POST /login` | a valid `GET /products/…` | a valid checkout | a valid `GET /api/orders/{id}` |
| rate per source | low | low, or polite | one or two | low |
| what per-IP sees | nothing | nothing | nothing | nothing |
| the real key | the **account**, and the fleet-wide failure ratio | the **cost** of the endpoint | the **resource** — one product row | the **caller's identity** against the row |
| who can decide | your service | your cache design | your database | your service |

Four properties recur, and naming them is the insight the page exists for: the source is
distributed, the rate per source is below any limit you dare set, each request is individually
valid, and **the value to the abuser is in the aggregate**. Any control that keys on the source
address is therefore keyed on the one thing that is cheap to vary. The defences that work key on
something the abuser cannot change: the account being attacked, the resource being consumed, the
cost of the endpoint, and the caller's relationship to the row.

## Credential stuffing

Passwords reused from elsewhere are tried against your login. Every attempt is a well-formed
request; the signal is not in any one of them but in the *failure ratio* — per account, and across
the whole fleet. So the counters are keyed accordingly, and the expensive work happens last:

```ts
// the ORDER of these steps is the defence: nothing expensive runs before an admission decision
async function login(email: string, password: string, ip: string) {
  const acct = hashEmail(email);                                  // key by account, never by IP alone
  if (!(await limiter.allow(`login:acct:${acct}`, 10, '15m')))    // per-account: the attacked thing
    return tooManyRequests();                                     // 429 + Retry-After (07)
  if (!(await limiter.allow(`login:ip:${ip}`, 100, '15m')))       // generous: an office shares one address
    return tooManyRequests();

  const user = await users.findByEmail(email);
  const hash = user?.passwordHash ?? DUMMY_HASH;                  // always hash, so an unknown address
  const ok   = await verifySlowHash(password, hash);              // costs the same time and shape
  if (!ok) { await counters.recordFailure(acct); return invalidCredentials(); }  // one message for both cases
  if (await risk.isUnusual(user, ip)) return stepUp(user);        // step up, do not lock
  return issueSession(user);
}
```

Four decisions in that shape are worth saying aloud. **The per-account counter is the one that
works**, because the attacker chooses the source address but not which account they want.
**The slow hash runs after admission**, otherwise the protection you added for stolen databases
becomes the way to exhaust your own CPU — an expensive operation reachable by an unauthenticated
caller is a resource-consumption bug regardless of its purpose. **A failure is a step-up, not a
lock**: a hard lockout keyed by account lets anyone deny service to any account they can name, so
the ladder is increasing delay, then a second factor, then an owner notification, with a hard lock
reserved for confirmed compromise and always paired with a recovery path. And **the response is
identical for an unknown address and a wrong password**, in text and in timing, because a
different answer turns the login into a directory of your customers.

The detection signal is fleet-wide: the ratio of failed to successful logins across all accounts,
which moves long before any single account's counter does. Password storage, rotation, breached-
credential checks and multi-factor design belong to
[Part 9](../../syllabus/09-security-and-compliance.md).

## Scraping

A competitor reading your prices sends exactly what a browser sends. Accept that you cannot
identify them reliably and design on cost instead — which produces a much better answer than
trying to win an identification contest:

- **The catalogue is cached, so scraping it is nearly free to you.** A scraper hitting edge-cached
  product pages costs one edge hit and no origin request ([05](05-cdns.md)). Being relaxed about
  that is a *design position*, not a concession.
- **The expensive variants are the uncacheable ones**, and they are what to cap: search with
  arbitrary filter combinations, deep pagination, sort options that defeat an index, export
  endpoints, and any query whose cache key is effectively unique. Cap the depth, cap the
  combinations, require authentication for the bulk shapes, and put a per-route limit on them
  ([07](07-rate-limiting.md)).
- **Offer the cheap path deliberately.** A documented feed or bulk endpoint, rate-limited and
  authenticated, is served from a file or a materialised view for a fraction of the cost of the
  same data scraped page by page. Making the sanctioned path the cheapest path is the only
  mechanism here that scales.
- **Watch the aggregate**: cache-miss share, deep-pagination share, and the ratio of catalogue
  reads to sessions. Those move when the pattern changes; no per-request signal does.

The thing to say in the round is the honest one: *"I cannot tell a scraper from a browser, so I
make the cheap access pattern cheap and the expensive one bounded, and I do not pretend a rule
will identify them."*

## Sale-day hoarding

One person, or one script, taking the whole stock. Every request is a legitimate checkout, and the
per-user limits of [07](07-rate-limiting.md) bound each caller without bounding the *sum*. Four
layers, and only the last one is a guarantee:

1. **Reservation with a TTL.** A cart hold that never expires sells the stock to nobody: the
   reservation carries an expiry and a background job releases it, so an abandoned hold returns to
   inventory.
2. **Per-account and per-order limits** — a quantity cap per account, and the business rules that
   go with it (one order per account per drop, address and payment-instrument checks) — which are
   business decisions, not edge rules.
3. **Admission on the hot resource** — the gateway or service lets through as many checkouts per
   second as the row can serve, and queues or sheds the rest with 503 and `Retry-After`
   ([08](08-timeouts-retries-and-budgets.md), [18e](18e-degrading-instead-of-falling-over.md)). This protects the database; it does not protect the
   stock.
4. **The invariant, in the database.** Everything above shapes arrival; only this decides
   correctness:

```sql
-- the only line here that cannot oversell: the condition and the decrement are one statement
UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock >= 1;
-- 0 rows affected  →  sold out; the order row is written only when this affected exactly one row
```

Read-then-write in application code — check stock, then insert the order — is the classic oversell
under concurrency, and no rate limit, WAF rule or queue removes it, because the two winning
requests were both perfectly legitimate.

## Enumeration of sequential ids

`GET /api/orders/1234` with a valid token is a customer looking at an order; the same request with
a different number is a customer looking at *someone else's* order, and nothing in the request
shape distinguishes them. The edge cannot decide it, and this is the single clearest example of
why "we have a WAF" does not answer an authorization question
([18b](18b-the-waf-and-its-false-positives.md)).

```ts
// the fix, in the only place that can make it: the service, on every read, without exception
const order = await orders.findById(id);
if (!order || order.customerId !== auth.customerId) return notFound();  // 404, not 403 — do not
// ...                                                                 // confirm the row exists
```

Three supporting measures, in order of how much they actually buy: **ownership checked on every
read** is the control; **404 rather than 403** for a row the caller may not see, so the response
does not confirm existence; and **opaque, non-sequential identifiers** as defence in depth, which
make a walk impractical but are not a substitute for the check — a design that relies on
unguessable ids has no authorization at all. A per-account read-volume budget catches the walk
after the fact, and object-level authorization in general belongs to
[Part 9](../../syllabus/09-security-and-compliance.md).

## The storefront

```text
catalogue scraped     /products is edge-cached, so a scraper costs one edge hit per object per TTL
                      and the origin never learns of it — that is the design, not a loss.
                      /search is not: cap filters and sort options, page depth ≤ 20, per-route
                      limit 10/s per user (07), and a documented, authenticated feed for partners.
                      Watched as: cache-miss share and deep-pagination share, not per-IP rate.
login stuffed         counters keyed by ACCOUNT (10 per 15 min) with a generous per-IP limit for
                      floods only; the slow hash runs after admission, never before; identical
                      response and timing for unknown address and wrong password; step-up on
                      unusual sign-in rather than a lockout; alarm on the fleet-wide failure ratio.
sale-day hoarding     reservation TTL of 10 minutes with a release job; quantity cap per account;
                      admission on the hot product row at the gateway (503 + Retry-After above it);
                      and the decrement as one conditional UPDATE — the only oversell guarantee.
order enumeration     ownership checked on every read, 404 for rows the caller does not own, ULIDs
                      instead of sequential ids as depth, per-account read-volume budget as detection.
```

Every row keys on something the abuser cannot vary — the account, the endpoint's cost, the product
row, the caller's identity — and not one of them keys on the source address. That is the sentence
to leave the round with.

## Gotchas

**★ Symptom: logins are failing across many accounts and the per-IP limiter never fired.** Cause:
distributed, low-rate attempts against many accounts; the limiter is keyed on the one attribute
that is cheap to vary. Fix: count failures per account and fleet-wide, alarm on the failure ratio,
and keep the per-IP limit only as a flood shield.

**★ Symptom: adding a deliberately slow password hash made the login endpoint the thing that fell
over.** Cause: an expensive operation reachable by an unauthenticated caller before any admission
decision. Fix: check the per-account and per-IP counters first and hash last; the slow hash is the
final step of the request, never the first.

**★ Symptom: an account lockout after N failures let anyone lock any account by name.** Cause: a
hard lock keyed by account is itself a denial-of-service primitive. Fix: increasing delays, then a
second factor, then an owner notification; a hard lock only for confirmed compromise, always with
a recovery path.

**★ Symptom: the sale sold more units than existed, though every layer was rate-limited.** Cause:
read-then-write in application code — two legitimate requests both read the same stock. Fix: one
conditional statement, `UPDATE … SET stock = stock - 1 WHERE id = ? AND stock >= 1`, and write the
order only if it affected a row. Rate limits shape arrival; only this enforces the invariant.

**Symptom: an unauthenticated endpoint let a client walk every order by incrementing an id.**
Cause: no ownership check; sequential ids made the walk trivial. Fix: check ownership on every
read, return 404 rather than 403 for rows the caller may not see, and use opaque ids as depth
rather than as the control.

**Symptom: the scraper cost nothing on the catalogue and everything on search.** Cause: cacheable
versus uncacheable, which is the only distinction that matters for cost. Fix: cap the uncacheable
variants — pagination depth, filter combinations, sort options, export size — and publish an
authenticated feed so the bulk case takes the cheap path.

**Symptom: carts held the entire stock and the sale sold out to nobody.** Cause: reservations with
no expiry. Fix: a reservation TTL with a background release, plus per-account quantity limits.

**Symptom: the login form said "no such account" for unknown addresses.** Cause: a helpful error
message that is also a customer directory. Fix: one message and one timing for both cases — hash a
dummy value when the account does not exist so the work is the same.

**Symptom: everything was limited per IP and a household or office was locked out during the
sale.** Cause: the key again — many customers share one address behind a NAT
([07](07-rate-limiting.md)). Fix: per-account limits once authenticated, with the IP limit
generous and reserved for floods.

## Interview questions

**★ Why does a per-IP rate limit not stop credential stuffing, and what does?**
Because the attempts come from many addresses at a low rate each, and every request is a valid
login. Per-IP counting is keyed on the attribute that is cheapest for the attacker to vary and most
expensive for you to get wrong, since offices and carrier networks share addresses. What works is
keying on what is actually under attack: a per-account failure counter, a fleet-wide failed-to-
successful login ratio as the detection signal, and a response that steps up — increasing delay,
then a second factor, then notifying the owner — rather than locking, because a hard lock keyed by
account lets anyone deny service to any account they can name. Add uniform responses and timing for
unknown addresses and wrong passwords, and make sure the expensive password hash runs after the
admission check rather than before it.

**★ Sale day: how do you stop one person taking all the stock?**
In layers, and I would name which layer is a guarantee and which is only shaping. Reservations
carry a TTL with a release job, so abandoned carts return stock. Per-account quantity and order
limits are business rules enforced in the service. Admission control on the hot product row lets
through as many checkouts per second as the row can serve and sheds the rest with 503 and
`Retry-After`, which protects the database. But the only thing that prevents overselling is the
decrement being conditional in a single statement — subtract one where stock is at least one, and
write the order only if a row was affected — because the two requests that would oversell are both
perfectly legitimate, and no edge control can tell them apart.

**★ How do you stop your catalogue being scraped?**
Honestly, I mostly do not, and I would say why: the request is identical to a browser's, so any
identification attempt has a false-positive rate that costs real customers, and the catalogue is
edge-cached anyway, so a scraper reading it costs one edge hit per object per TTL and never touches
the origin. What I do defend is cost. The uncacheable shapes — search with arbitrary filters, deep
pagination, sorts that defeat an index, exports — get caps and per-route limits, and the bulk case
gets a documented, authenticated feed served from a materialised view so the sanctioned path is
also the cheapest one. Then I watch aggregates: cache-miss share and deep-pagination share, which
move when the pattern changes, rather than per-IP rates, which do not.

**★ A `GET /api/orders/1234` with a valid token returns someone else's order. Where is the fix?**
In the service, on every read, and nowhere else — this is the clearest case where the edge cannot
help, because the request is perfectly shaped and the caller is properly authenticated; the only
thing wrong with it is a relationship between the token and the row, which only your data can
settle. Load the row, compare its owner to the authenticated caller, and return 404 rather than
403 when they differ so the response does not confirm the row exists. Opaque, non-sequential ids
are worth having as defence in depth, because they make a walk impractical, but a design that
relies on ids being unguessable has no authorization at all. A per-account read-volume budget is
the detection layer behind the check.

**Why is the order of operations in a login handler a security control?**
Because everything expensive that runs before an admission decision is reachable by anyone. A
deliberately slow password hash is correct for protecting a stolen database and is, by
construction, a costly operation an unauthenticated caller can trigger — so if it runs first, the
protection becomes the exhaustion path. The order is: cheap counter check keyed by account, cheap
counter check keyed by address, load the user, then hash — and hash a dummy value when the account
does not exist, so that the work and the response shape stay identical. The same principle applies
to any unauthenticated endpoint that does real work: image processing, PDF generation, report
building, an unbounded search. Admission first, cost second.

**What do these four abuse patterns have in common, and what does that tell you about where
defences live?**
The source is distributed, the rate per source is below any limit you would dare set, every
request is individually valid, and the value is in the aggregate. So every control keyed on the
source address sees nothing, and every control that matches on request shape has nothing to match.
The defences that work key on things the abuser cannot vary: the account under attack, the cost of
the endpoint, the resource being consumed, and the caller's relationship to the row. All four of
those are facts only your service holds, which is why this class of abuse is designed against in
the application and the database, with the edge doing what it is good at — absorbing volume and
shape — and the two never substituting for one another.

← Prev: [18c · Bots, challenges and the ladder](18c-bots-challenges-and-the-ladder.md) · Index: [Phase 2 — The request path](README.md) · Next → [18e · Degrading instead of falling over](18e-degrading-instead-of-falling-over.md)
