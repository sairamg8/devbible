---
title: "A stateless service keeps nothing between requests that another replica could not reconstruct — sessions go to a store or a signed cookie, uploads to object storage, nothing to local disk — and horizontal scaling, safe restarts and rolling deploys are consequences of that discipline, not features bolted on later"
sidebar_label: "04 · Stateless services, and where the state went"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method; the one quoted premise is the Kubernetes documentation on
> [Services](https://kubernetes.io/docs/concepts/services-networking/service/) — *"Pods are
> ephemeral resources"* (verbatim below). Signed-cookie mechanics, sticky sessions and
> object-storage uploads are described as common practice without library or vendor claims.
> The scaling walk this page serves is [phase 1's](../phase-1-the-method/12-the-scaling-walk.md).
> **No sandbox run.**

**"Stateless" does not mean the system has no state; it means the *service process* holds none
that matters — anything a request needs that a previous request produced lives somewhere every
replica can reach.** The test is a single question: *if this process were killed between two
requests and a different replica received the second one, would the user notice?* Session data
in process memory fails the test; an uploaded file on local disk fails it; an in-memory cache of
"the user's cart" fails it; a background job's progress in a local variable fails it. Each has a
home — a session store or a signed cookie, object storage, a shared cache, a queue or a job
table — and the move is not an optimisation but the precondition for everything the scaling walk
promised: a balancer that can send any request anywhere, replicas that can be added and removed
at will, a deploy that kills processes without asking, a restart that loses nothing. This page
is the test, the five kinds of state that hide in a process and where each one goes, the
sticky-session escape hatch and why it is a debt, what "stateless" costs, and the storefront's
service audited.

## The premise: the process is disposable

The platform's own documentation says it plainly:

> *"Pods are ephemeral resources (you should not expect that an individual Pod is reliable and
> durable)"* — Kubernetes, *Service*

Every orchestrator, autoscaler and rolling deploy assumes the same thing: a process can be
stopped at any moment and another started elsewhere, and the system must not care. A service
that keeps state in the process is making the platform's assumption false, and the symptoms —
users logged out on deploy, uploads that vanish, a "lost" cart — are the platform behaving as
designed against a service that is not.

## The test, and the five places state hides

| Where it hides | The tell | Where it goes instead | The trade |
|---|---|---|---|
| **Session in memory** | login lost on restart; sticky sessions "needed" | a session store (Redis, a table) keyed by a session ID in a cookie; or a **signed cookie** carrying the claims | a store round trip per request, or a cookie the client can read (not alter) and that cannot be revoked before expiry |
| **Files on local disk** | uploads vanish; "works on one pod" | object storage, written directly by the client via a signed URL or streamed through the service and never kept | a URL to hand out; eventual consistency of listings on some stores |
| **In-memory cache of user data** | different answers from different replicas | a shared cache (Redis) or no cache; per-process caches only for data that is *global and immutable-ish* — config, a product catalogue with a short TTL | a network hop instead of a memory read; invalidation |
| **Background work in the process** | a job half done when the pod dies | a queue with acknowledgement, or a job table with a lease; the worker is a consumer that can be replaced mid-job | idempotent jobs, because a replacement may redo work |
| **Connections and sockets** | a WebSocket's user can only be reached via one pod | the connection stays on the pod by nature; the *routing* of messages to it goes through a shared registry or pub/sub (**06 · Long-lived connections** *(not written yet)*) | a registry to keep current; a fan-out hop |

A sixth, subtler one: **counters and rate limits kept per process** — a limit of a hundred a
second enforced in each of ten replicas is a limit of a thousand. Counters go to the store,
exactly as the gateway of [03](03-reverse-proxies-and-api-gateways.md) keeps them.

## Sessions: the store or the cookie

Two honest designs, and the choice is a trade-off sentence:

**A session store.** The cookie carries an opaque session ID; the service looks the session up
in Redis or a table on each request. Revocable instantly — delete the row — and the client
learns nothing; costs a round trip per request (sub-millisecond in-region) and a store on the
failure walk whose death logs everyone out.

**A signed cookie, or a signed token.** The cookie carries the claims — user ID, roles, expiry
— with a signature the service verifies locally; no store, no round trip, any replica. The
client can read the claims (so nothing secret goes in), cannot alter them, and the token cannot
be revoked before it expires except by a denylist — which is a store again, consulted only for
the rare revocation. Short expiry with a refresh is the standard compromise.

```ts
// a signed session cookie: claims + HMAC, verified locally by any replica — no store on the hot path
import { createHmac, timingSafeEqual } from 'node:crypto';

type Claims = { sub: string; roles: string[]; exp: number };

export function sign(claims: Claims, secret: string): string {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verify(cookie: string, secret: string, now = Date.now()): Claims | null {
  const [body, mac] = cookie.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as Claims;
  return claims.exp * 1000 > now ? claims : null;   // expiry is the only revocation without a store
}
```

The secret is the one piece of shared state the design still has: every replica holds the same
key, loaded from the environment, rotated with an overlap window — the same discipline as the
gateway's verification key.

## Uploads: never through the disk

An upload that lands on a pod's disk is on one pod. Two designs keep the service stateless:

1. **Direct-to-storage with a signed URL.** The service issues a short-lived signed URL for
   object storage; the client uploads there directly; the service is told the key. The bytes
   never touch the service, which is the scalable answer for anything large — images, video,
   exports.
2. **Streamed through the service.** The service pipes the request body to object storage
   without buffering to disk, and records the key. Simpler client, service CPU and bandwidth
   spent on relay; fine for small files and for cases where the service must inspect the bytes.

Either way the *reference* — the object key — is what goes in the database, and any replica can
serve the download by redirecting to a signed read URL or by streaming from storage. The
storefront's product images follow design 1 from the admin tool and are served from the CDN.

## The sticky-session escape hatch, and why it is debt

A balancer can pin a user to a replica — cookie or IP hashing ([02](02-load-balancing-layer-4-vs-layer-7.md))
— so that in-process state keeps working. It is a real feature and a legitimate bridge for a
legacy application, and it is debt, because every promise of statelessness is now broken in a
smaller way: the replica's death logs out its users; scaling down loses sessions; a deploy must
drain for as long as the longest session; load is uneven because users are not. The sentence in
a round: *"I'd avoid sticky sessions; if the application forces them, they're a bridge while the
session moves to a store, not the design."*

## What stateless buys, and what it costs

The consequences are the point, and they are the scaling walk's steps 2 and onward:

- **Any request anywhere.** The balancer needs no memory; round robin works.
- **Scale by count.** Add a replica and it serves the next request; remove one and nothing is
  lost. Autoscaling is a number, not a migration.
- **Kill freely.** Rolling deploys, spot instances, node drains, crash-and-restart — all are
  safe because nothing in the process needed saving. Readiness and a drain
  ([02](02-load-balancing-layer-4-vs-layer-7.md)) finish in-flight requests; nothing else is owed.
- **Reason locally.** A request's behaviour depends on the request and the stores, not on which
  replica or what it did before — which is what makes bugs reproducible.

The costs, said as trade-offs: a store round trip where a memory read was (sub-millisecond
in-region, and the store is a new box on the failure walk); a session that cannot be revoked
instantly if it is a signed token; idempotent jobs, because a replaceable worker may repeat work;
and the discipline itself — a developer who "just caches it in a map" has reintroduced state, and
nothing fails until the second replica exists.

## The storefront's service, audited

| State | Where it was tempting to keep it | Where it lives |
|---|---|---|
| the login session | process memory | a signed cookie with a 15-minute expiry and a refresh; a denylist in Redis for logout-everywhere |
| the cart | process memory, or a per-process cache | Redis, keyed by user or by an anonymous cart ID in a cookie |
| product images from the admin tool | the pod's `/tmp` | object storage via a signed upload URL; served from the CDN |
| the product catalogue cache | a per-process map with no expiry | a per-process map **with a short TTL**, allowed because the data is global and staleness is bounded — plus the shared cache in front of the database |
| the rate-limit counters | a per-process counter | the gateway's store |
| the outbox publisher's position | a local variable | the outbox table itself, with a lease row |
| the payment provider's callback correlation | "the same pod that started the checkout" | the order row — the callback can arrive at any replica and finds the order by ID |

The last row is the one that catches designs: a checkout started on replica A and a callback
that lands on replica B works only because the order's state is in the database, not in A. That
is the test, applied to a flow rather than a value.

## Gotchas

**★ Symptom: users logged out on every deploy.** Cause: sessions in process memory. Fix: a session
store keyed by cookie, or a signed cookie verified locally — and a drain, so in-flight requests
finish.

**★ Symptom: an uploaded image works on one pod and 404s on the others.** Cause: the file on
local disk. Fix: object storage — direct with a signed URL, or streamed through — and the key in
the database.

**★ Symptom: "we need sticky sessions."** Cause: state on the pod, discovered at the balancer.
Fix: name it as a bridge and move the state; stickiness loses sessions on scale-down and deploy
and makes load uneven.

**Symptom: a per-user cache in each replica gives different answers per request.** Cause:
process-local cache of user data. Fix: a shared cache, or none; process-local caches only for
global data with a TTL.

**Symptom: the rate limit is ten times what was configured.** Cause: per-process counters
across ten replicas. Fix: counters in the store.

**Symptom: a background job restarts from zero after a deploy — or runs twice.** Cause:
progress in a local variable; or a replacement worker with a non-idempotent job. Fix: a queue
with acknowledgement or a job table with a lease; idempotent job steps.

**Symptom: the payment callback "can't find the checkout".** Cause: checkout state held in the
pod that started it. Fix: the order row is the state; any replica resolves the callback by
order ID.

**Symptom: a signed session cannot be revoked after a password change.** Cause: no store, no
revocation. Fix: short expiry with refresh, and a denylist consulted only on the rare
revocation path — or a session store if instant revocation is a requirement.

**Symptom: a "stateless" service that reads a config file at startup and never again.** Cause:
configuration treated as code, which is fine — until it must change without a deploy. Fix:
loaded at startup is stateless; if it must change live, a config store with a refresh, and the
failure mode of that store named.

**Symptom: the WebSocket service declared stateless and messages lost on deploy.** Cause:
connections are state by nature. Fix: accept that the connection lives on a pod; put the
*routing* in a shared registry or pub/sub, and drain long enough for clients to reconnect.

## Interview questions

**★ What does "stateless service" mean, and how do you check a service is one?**
That the process holds nothing between requests that another replica could not reconstruct;
all state a request depends on lives in a store every replica can reach. The check is a
question: if the process were killed between two requests and a different replica served the
second, would the user notice? Sessions in memory, files on disk, per-user caches,
in-progress jobs and per-process counters all fail it, and each has a home — a session store
or signed cookie, object storage, a shared cache, a queue or job table, the store.

**★ Session store or signed cookie — how do you choose?**
A store gives instant revocation and hides everything from the client at the cost of a
sub-millisecond round trip per request and a store on the failure walk whose death logs
everyone out. A signed cookie or token is verified locally by any replica with no round trip,
at the cost of claims the client can read, no revocation before expiry except via a denylist,
and a shared signing key to rotate. The usual answer is a short-lived signed token with a
refresh, plus a denylist for the rare revocation — and a store if instant, guaranteed
revocation is a stated requirement.

**★ Why are horizontal scaling and safe restarts consequences of statelessness?**
Because with no state in the process, any replica can serve any request: the balancer needs no
memory, adding a replica is a count, removing one loses nothing, and killing one — deploy,
crash, spot reclaim — costs at most the in-flight requests a drain protects. Every one of those
operations on a stateful process is a migration: sessions to move, files to copy, jobs to hand
over. The platform already assumes the process is disposable; statelessness is making that
assumption true.

**Where do uploads go, and why not through the service's disk?**
To object storage, either directly from the client via a short-lived signed URL — the bytes
never touch the service, which is the answer for anything large — or streamed through the
service without buffering to disk for small files that need inspection. The object key goes in
the database; any replica serves the download by redirect or stream. A file on a pod's disk is
on one pod: it vanishes on restart and 404s from every other replica.

**When are sticky sessions acceptable?**
As a bridge for an application that keeps state in process and cannot be changed yet — and
named as debt when proposed: a pinned replica's death loses its users' sessions, scale-down
loses sessions, deploys must drain for the longest session, and load follows users rather
than requests. The design answer is to move the state to a store or a signed cookie and remove
the stickiness; the interim answer is cookie-based rather than IP-based, so that users behind
one NAT are not all on one replica.

**The payment provider's callback arrives at a different replica from the one that started
the checkout. Does that work?**
Only if the checkout's state is in the database rather than the pod — which is the
statelessness test applied to a flow. The order row, written in the transaction before the
provider call, carries everything the callback needs: the callback finds it by order ID,
updates its status in a second transaction, and it does not matter which replica handled
either half. A design where the callback must reach "the same pod" has hidden state in the
process and fails the moment there are two replicas.

---

← Prev: [03 · Reverse proxies and API gateways](03-reverse-proxies-and-api-gateways.md) · Index: [Phase 2 — The request path](README.md) · Next → **CDNs** *(not written yet)*
