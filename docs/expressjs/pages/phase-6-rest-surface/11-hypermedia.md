---
title: "Hypermedia and HATEOAS"
sidebar_label: "11 · Hypermedia"
sidebar_position: 11
---

<span className="db-tier t-when">When Needed</span>

**Responses that carry links, so a client follows affordances instead of
constructing URLs. Genuinely useful in two or three situations, and overhead in
all the others — which is why this is the last page in the phase.**

> Verified: 2026-08-14 — **no sandbox run**. HATEOAS is a constraint of REST as
> defined in Roy Fielding's dissertation
> ([Architectural Styles and the Design of Network-based Software Architectures](https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm)),
> where hypermedia is *"the engine of application state"* — it is not something HTTP
> requires and not something Express provides. The `Link` header is standardised by
> [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html), and relation types are
> registered with IANA. Body-level link formats — **HAL**, **JSON:API**, **Siren** — are
> community specifications, not IETF standards, and none is dominant. The judgement about
> when it earns its cost is **this bible's**, and it is a judgement, not a fact.

## What it actually means

The idea: a response tells the client not just what the resource *is* but what it
can *do* next, as links. The client follows them rather than assembling URLs from
documentation.

```json
{
  "id": "ord_7",
  "status": "pending",
  "total": 4200,
  "_links": {
    "self":   {"href": "/orders/7"},
    "cancel": {"href": "/orders/7/cancel", "method": "POST"},
    "pay":    {"href": "/orders/7/payments", "method": "POST"}
  }
}
```

The interesting part is not the URLs — it is that **`cancel` disappears once the
order ships**. The server owns the state machine, and the client renders whatever
actions it is given rather than reimplementing the rules of when cancelling is
allowed.

That is the whole value proposition, and it is worth stating plainly because most
HATEOAS discussions never get past URL construction, which is the least
interesting benefit.

## Where it genuinely pays

Three situations, and they have something in common — **you do not control the
clients, or the rules change often**:

1. **The state machine is real and moves.** Orders, claims, approval workflows.
   Encoding "cancellable when pending or paid, but not shipped, unless the user is
   an admin" in every client means every client is wrong after the next rule change.
2. **Many clients you do not deploy.** Third-party integrations, several native
   apps at different versions. Links let the server change a rule without a
   coordinated release.
3. **Pagination and long collections.** This one is nearly universal and rarely
   called HATEOAS: `next` and `prev` links let clients page without knowing whether
   you use cursors or offsets, and let you change that later
   ([page 03](03-pagination/README.md)).

Point 3 is the version almost every API should adopt. The full-blown variety is
for points 1 and 2.

## Where it does not

- **A front end you ship with the API.** Both sides deploy together; the client can
  simply know the rules, and a link map is indirection with no payoff.
- **Simple CRUD.** `GET /users/42` has no interesting next actions. `self` links on
  every response are noise.
- **Anything performance-sensitive.** Links inflate payloads, and a client that
  discovers URLs by traversal makes more round trips than one that knows them.

The honest summary: **the discipline is right, the full form is rarely worth it,
and the partial form — links in pagination, and action links on genuine state
machines — captures most of the value for very little cost.**

## `Link` headers versus links in the body

Both exist and they are not interchangeable.

| | `Link` header (RFC 8288) | Links in the body |
|---|---|---|
| Read by | Caches, crawlers, generic HTTP clients | Your application code |
| Good for | Pagination, `self`, `alternate` — anything about the *response* | Actions and state — anything about the *resource* |
| Cost | Header size; awkward for many links | Payload size; must survive your envelope |

```http
Link: </orders?cursor=abc>; rel="next", </orders>; rel="first"
```

Pagination links belong in the header — that is what it is for, and generic tooling
understands it. Action affordances belong in the body, because only your client will
ever act on them.

## Pick a format, or invent a small one

HAL, JSON:API and Siren all solve this, all disagree, and all impose an envelope on
every response. **None of them is a standard**, so adopting one buys tooling and
familiarity, not interoperability.

For most APIs a small documented convention — an `_links` object, or an `actions`
array with `rel`, `href` and `method` — is enough and costs nothing. What matters is
that it is documented and consistent, and that **relation names are stable**: `rel`
values are a contract exactly like error codes ([Phase 5](../phase-5-errors/03-error-contract/README.md)).
Renaming `cancel` to `cancel-order` breaks every client that branches on it.

## Trade-off

Hypermedia moves the state machine to the server, where it already lives. Clients
stop duplicating business rules, rule changes stop requiring coordinated releases,
and URLs stop being a public contract you can never change.

It costs payload size on every response, a format to define and document, and
discipline to keep the links correct — a stale affordance is worse than none,
because the client renders a button that fails. And the promised benefit only
materialises if clients actually follow links rather than hard-coding the URLs they
saw once. **They usually hard-code them.** That is the practical objection, and it
is why full HATEOAS remains rare after twenty-five years.

**Adopt the parts that pay for themselves** — pagination links, action links on real
state machines — and skip the ceremony.

## Gotchas

**Symptom:** Clients hard-code URLs despite links being provided  
**Cause:** Nothing forces them to follow links, and hard-coding is easier  
**Fix:** Accept it, or make URLs genuinely opaque (signed, non-guessable). Otherwise the
links are documentation, not a mechanism

**Symptom:** A client shows a "Cancel" button that always fails  
**Cause:** Links generated from a template rather than from the resource's actual state  
**Fix:** Derive affordances from the same state machine the handler enforces — one
source, or they will disagree

**Symptom:** Responses doubled in size after adding links  
**Cause:** Full `_links` blocks on every item in every collection  
**Fix:** Links on items in collections are rarely read. Put them on the single-resource
representation and on the collection itself

**Symptom:** Renaming a link relation broke clients  
**Cause:** `rel` names are a contract, like error codes  
**Fix:** Treat a rel rename as a breaking change ([page 05](05-versioning.md))

**Symptom:** Links point at the wrong host behind a proxy  
**Cause:** URLs built from `req.host` or `req.protocol` without `trust proxy` configured  
**Fix:** Configure `trust proxy` ([Phase 9](../phase-9-hardening/README.md)), or build
links from a configured public base URL rather than from the request

## Interview questions

**★ What does HATEOAS mean, and what problem does it solve?**
Responses carry the links and actions available next, so the client follows
affordances rather than encoding the rules itself. The real benefit is that the state
machine stays on the server — "can this order be cancelled?" is answered by the
presence of a link, not by logic duplicated in every client.

**★ When is it worth the overhead?**
When you do not control the clients, or the rules change often — third-party
integrations, several app versions in the wild, genuine workflow state machines. And
pagination links, which nearly every API should have and which are HATEOAS whether or
not anyone calls them that.

**★ Why has full HATEOAS stayed rare?**
Because clients hard-code URLs anyway, so the promised decoupling never materialises,
while the payload cost and the format discipline are paid on every response. The
partial form captures most of the value for a fraction of the cost.

**Body links or `Link` headers?**
Headers for things about the response — pagination, `self`, `alternate` — because
generic tooling and caches understand RFC 8288. Body links for actions and state,
because only your own client will act on them.

**Is HAL or JSON:API a standard?**
No. They are community specifications and none is dominant. Adopting one buys tooling
and familiarity, not interoperability — a small documented convention of your own is
usually enough.

**What makes a link relation name a contract?**
Clients branch on `rel`, exactly as they branch on error codes. Renaming one is a
breaking change even though nothing in the schema appears to have moved.

---

← Prev: [PATCH and bulk](10-patch-and-bulk.md) · Index: [Phase 6](README.md)
