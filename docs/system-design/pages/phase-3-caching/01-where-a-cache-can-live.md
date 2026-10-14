---
title: "A cache can live in six places between the user and the disk, each trades reach against control and freshness against latency differently, and a design uses three or four of them because each layer absorbs what the one in front of it could not"
sidebar_label: "01 · Where a cache can live"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. The two protocol definitions quoted are
> [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) §1.2 and §1.3 (what a cache is; shared
> versus private) and §4.2.3 (age). The six-layer taxonomy, the stacked-staleness arithmetic and
> the placement rules are common practice stated as mechanism, not cited. Latency ordering
> follows the ladder of [phase 0](../phase-0-the-interview/05-the-latency-ladder.md); this page
> prints no latency, hit-ratio or memory figure. **No sandbox run.**

**A cache is not a product you add; it is a place you choose, and the place decides who can
read it, who can empty it, how far the request travelled before it hit, and how many copies of
the truth exist at once.** The same product page can be cached in the user's browser, at a CDN
edge, at the gateway, in the memory of each application instance, in a shared Redis, and in the
database's own buffers — six copies of one row, each with its own age, its own owner and its
own way of going wrong. The interview question behind "where would you cache this" is not
"name a cache". It is: which layer, why that one, what does it cost you in staleness and in
control, and what does the layer behind it see when this one is cold.

[Phase 2](../phase-2-request-path/README.md) walked the request through the hops. This page
re-reads the same hops as places that *store*, and gives the rule for choosing among them. The
population strategies (who fills the cache) and invalidation (who empties it) are separate
pages in this phase; here the question is only **where**. The continuation —
[01b](01b-stacking-layers-and-the-arithmetic-of-staleness.md) — is how layers compose: the
staleness that adds up, the hit-ratio arithmetic, and the storefront's map.

## What RFC 9111 says a cache is

Everything below is an instance of one definition, and the definition has two halves that
designs forget.

> *"An HTTP 'cache' is a local store of response messages and the subsystem that controls storage, retrieval, and deletion of messages in it."* — RFC 9111 §1.2

A store **and** a subsystem that controls storage, retrieval *and deletion*. A Redis instance
with no eviction policy and no TTL is a store, not yet a cache. And the split that matters for
placement:

> *"A 'shared cache' is a cache that stores responses for reuse by more than one user; shared caches are usually (but not always) deployed as a part of an intermediary. A 'private cache', in contrast, is dedicated to a single user; often, they are deployed as a component of a user agent."* — RFC 9111 §1.3

That is the first axis: **whose requests does a hit serve**. A private cache cannot leak one
user's data to another and cannot save another user's request. A shared cache saves work for
everyone and can leak. The RFC speaks about HTTP, but the axis generalises: an in-process map is
private to one instance; a Redis is shared by all of them.

## The six places

Ordered by distance from the user. The "who can empty it" column is the one that decides how
you will survive a bad deploy.

| Layer | Where the bytes sit | Reach (who a hit serves) | Who can empty it | What it stores well |
|---|---|---|---|---|
| **Browser** | the user's device — HTTP cache, `localStorage`, a service worker's cache | one user, one device | the user; you only by expiry or a changed URL | static assets, immutable bundles, a user's own recent reads |
| **CDN edge** | a point of presence near the user | everyone routed to that edge | you, by purge API, in seconds across the fleet | public bytes — images, bundles, anonymous pages |
| **Gateway / reverse proxy** | in front of the origin, in your own network | every client of that proxy instance | you, directly | small hot public responses, idempotent GETs shared across tenants |
| **In-process** | the heap of each application instance | the requests that instance serves | you, but only that instance — there is no fleet-wide purge | hot immutable lookups, config, compiled templates, small reference data |
| **Distributed cache** | Redis or Memcached, over the network | every instance of every service | you, by key | computed results, sessions, rows and aggregates shared across instances |
| **Database buffers** | the DBMS's page cache plus the operating system's | every query on that database | nobody on purpose; eviction by pressure | the hot pages the database reads anyway |

The CDN and gateway rows are owned by phase 2 — [CDNs](../phase-2-request-path/05-cdns.md) and
[reverse proxies and gateways](../phase-2-request-path/03-reverse-proxies-and-api-gateways.md)
cover the hop, and [07](07-http-caching-semantics.md) in this phase covers the protocol that
configures the browser, CDN and gateway rows. The rest of this page is what the rows have in
common and how to choose.

## The browser: the cache you cannot reach

The browser cache is the closest to the user and the only one where **a hit costs no network at
all**. It is also the one you can never purge. A response served with a long freshness lifetime
is on a device you do not control; the only ways to retire it are the lifetime running out, the
user clearing it, or you changing the URL so the old entry is never asked for again. That single
fact is why asset URLs carry a content hash, and why the HTML that names them must be short-lived
(the whole of [07](07-http-caching-semantics.md)).

The browser cache is private by construction, which makes it the safe home for per-user data —
and the wrong home for anything that must be consistent across a user's two devices. It also
caches *more than HTTP*: an SPA's in-memory query cache (React Query, SWR, Apollo) is a browser
cache with its own staleness rules and no relation to `Cache-Control`. A page can therefore have
two browser-side caches — the HTTP one the server configures and the library one the front-end
engineer configures — and an interview answer that mentions only the first has missed half the
layer.

## The CDN and the gateway: shared, near, and yours to purge

A CDN edge is a shared cache: one fill serves everyone routed there. It is the first layer where
**the hit ratio is a property of the traffic, not the user** — a product page that a thousand
visitors request is stored once per edge. It is also the first layer where a mistake becomes
someone else's data, because the cache is shared (the `Vary` and `private` failures of
[07](07-http-caching-semantics.md)).

The gateway or reverse proxy is the same idea inside your own boundary: it shortens the trip for
small, hot, public responses and shields the services behind it. It is also the layer people
forget is a cache at all. A proxy with caching switched on and the default key is a shared cache
whose rules you did not write; a default that ignores a header the response varies on is how a
reverse proxy leaks. Treat "do we have caching on at the proxy" as a question with an answer
written down, not an assumption.

## The in-process cache: fastest, and per-instance

An in-process cache is a data structure on the application's own heap — a bounded LRU map in
Node, a Caffeine instance on the JVM. A hit is a memory read in the same address space: no
serialisation, no network, no connection from a pool. It is the lowest-latency layer an
application controls, and it has three properties that the other layers do not.

1. **It is per-instance.** Ten instances hold ten caches, each with its own contents and its
   own age. A write that invalidates a key on the instance that served it leaves the key in the
   other nine. There is no "purge the fleet" call; propagating an invalidation needs a message
   bus or short TTLs.
2. **It competes with the application for memory.** The heap that holds the cache is the heap
   the request handlers allocate from. On the JVM an oversized cache is a garbage-collection
   problem; in Node it counts against the process's memory limit. A distributed cache's memory
   is somebody else's budget; this one is yours.
3. **It is cold after every restart and every deploy.** A rolling deploy replaces every
   instance's cache with an empty one, one instance at a time, and each empty cache sends its
   first requests to the next layer. The next layer must be sized for that, not for the
   steady-state miss rate.

What it is good for follows from those: **small, hot, rarely-changing data where being a few
seconds stale on one instance does not matter** — the category tree, feature flags, currency
conversion tables, a compiled template, the public key used to verify a token. What it is bad
for: anything that must be identical across instances right now, and anything large.
**In-process caches in Node and Java** *(not written yet)* is its own topic in this
phase; this page only places it.

## The distributed cache: shared, networked, a dependency

A Redis or Memcached cluster is the layer the application *shares with itself*: every instance
reads the same entry, so a write that invalidates a key is seen by all of them at once, and a
fill by one instance saves the work of all the others. Its price is the network. Every hit is a
round trip and a serialisation, and the cache is now a **dependency of the request path** — a
component that can be down, slow, partitioned, full or evicting. The design questions the other
pages in this phase answer — stampede, hot keys, eviction, what happens when it is cold —
largely exist because of this layer. The mechanics (data types, persistence, clustering) are the
[Redis track](../../../redis/README.md); the decision about what to put in it, for how long, and
what the application does when it is unreachable is this phase.

The failure-mode question to attach to this layer is not "what if it is slow" but "**what is the
database's load if every key in it vanished at once**" — because a flushed or restarted
distributed cache is the only layer that, when cold, sends the *entire* read workload to the
database in one step. A hit ratio is a property of the cache when warm; the survival of the
system is a property of the origin when cold.

## The database's own buffers: the cache you did not build

The database caches. A relational engine keeps recently-read pages in a buffer pool in its own
memory, and the operating system keeps another cache of file pages beneath that. A query for a
product row that was just read does not touch the disk, and nobody wrote any application code for
it. Two consequences matter for design.

First, **this layer exists whether you want it or not**, and it is why "the database is slow"
is often really "the working set does not fit in the database's memory". Adding an application
cache in front of a database whose problem is an undersized buffer pool moves the symptom
without fixing it, and sizing the database's memory to the hot set is sometimes the cheaper
cache.

Second, **it is invisible to the application and has no staleness at all**. The buffer holds
the pages the database itself is serving, with the database's own consistency; a read through it
is never stale. That makes it the one layer that is free in correctness terms. It also makes it
the layer a large scan can wreck: a report that reads a whole table can displace the hot pages
the product-page queries were hitting, so a nightly job slows the morning's reads. The remedy
is operational — run the scan on a replica — not an application cache.

## The single rule for choosing a layer

Put the entry in **the nearest layer that is allowed to hold it** — and "allowed" is three
questions asked in order:

1. **Is the data the same for everyone?** If not, a shared cache may only hold it if the key
   includes whatever it varies on. Per-user data lives in a private layer (browser, or a
   distributed cache keyed by user) and never in a shared cache without that key.
2. **How stale may it be, and can you reach it to empty it?** If the answer is "not at all, and
   I cannot reach the layer", the layer is wrong. A price that must change at once cannot sit in
   a long-lived browser entry; a hashed bundle can sit there for a year.
3. **How large is it, how many are there, and how often does the hit repeat?** A cache layer
   pays only for entries that are read more than once while they are fresh. A one-off report
   cached in memory is a cost with no hit.

The nearest layer that passes all three is the answer, and the layer behind it stays as the net
for when the nearest one misses. The next page shows why that net is not optional.

## Gotchas

**★ Symptom: the entry was invalidated and users still see the old value for minutes.** Cause:
the copy is in a layer you cannot reach — a browser entry with a long lifetime, or one of ten
in-process caches that received no message. Invalidating the distributed cache does nothing for
the layers in front of it. Fix: decide which layer each entry may live in *based on whether you
can empty it*; give entries that must change a short lifetime or a changed key, and send
in-process invalidations over a bus or keep their TTL short.

**★ Symptom: after a deploy or a Redis restart, the database falls over although the hit ratio
was fine all week.** Cause: every cache in the path was empty at once and the whole read workload
landed on the origin, which is sized for the miss rate of a warm system. Fix: size and test the
origin for the cold case; warm before cutting traffic; roll instances so the caches do not empty
simultaneously; the stampede page of this phase (**04 · Stampede and thundering herd** *(not
written yet)*) is the follow-on.

**★ Symptom: a logged-in user's data appears for another user.** Cause: per-user data placed in
a shared layer — a CDN edge, a proxy, a distributed cache key without the user in it — under a
key that does not distinguish users. Fix: personalised responses are `private` in HTTP terms and
carry the user (or tenant) in the key anywhere else; the check is "what is in the key" before
"what is the TTL".

**★ Symptom: adding Redis in front of a slow query did not help.** Cause: the query was slow
because the database's buffer pool did not hold its working set, or because it was reading far
more rows than needed; the cache covers the symptom for the keys that hit and leaves the miss
path exactly as slow. Fix: measure whether misses dominate the latency percentile you care about
(the measuring page of this phase), and fix the query or the memory the database has.

**Symptom: the in-process cache grows until the JVM spends its time in garbage collection, or
Node is killed for memory.** Cause: no bound — a plain `Map` or an unbounded cache keyed by
something with unbounded cardinality. Fix: every in-process cache has a maximum size and an
eviction policy, chosen before it ships.

**Symptom: two instances of the same service return different answers to the same request.**
Cause: per-instance caches filled at different times with different ages; a load balancer
rotating between them makes the page flicker between old and new. Fix: accept and bound the
difference with a short TTL, or move the data to a shared layer if it cannot flicker.

**Symptom: the team added a cache at every layer and cannot say which one served a request.**
Cause: layers added one at a time with no record of what each holds. Fix: a one-line statement
per data type of the layer, key, lifetime and the way it is emptied — the deliverable the
phase's gate asks for — and a response header or log field recording which layer answered.

**Symptom: the front-end's data library shows stale data after a successful save although
`Cache-Control` is correct.** Cause: the second browser cache — a client-side query cache — has
its own staleness window unrelated to the HTTP headers. Fix: invalidate or update that cache on
mutation; treat it as a layer in the plan.

## Interview questions

**★ Where would you cache the storefront's product page, and why there?**
Start from the three questions. Is it the same for everyone? For the anonymous page, yes, which
allows a shared cache at the CDN edge keyed by path and currency. How stale may it be, and can I
empty that layer? A price is the hard field, so the edge entry gets a short lifetime plus a purge
driven by the price-change event, because the edge is a layer I *can* reach. How large and how
repeated? One entry per product, read many times, so it pays. Behind the edge, a distributed cache
holds the computed product view for the misses and for personalised variants, and the database's
buffers are the last net. The answer names the nearest layer that is allowed to hold the data
and the layer behind it for when it misses.

**★ Why does a design usually have three layers rather than one good one?**
Because each layer absorbs a different kind of miss and none of them can be the only one. The
browser and edge remove requests before they reach you but cannot be fully controlled; the
in-process layer removes the network but is per-instance and cold on deploy; the distributed
layer is shared and consistent but is a dependency whose loss moves the whole workload to the
database. The layers behind one another turn a cold or missing front layer into a bounded load on
the next one. The follow-up is the arithmetic in [01b](01b-stacking-layers-and-the-arithmetic-of-staleness.md).

**★ A user says they changed their address and the old one still appears. Where do you look?**
Walk the layers from the user inwards and ask of each: does it hold this response, and can I
empty it. The browser's HTTP entry (was the response cacheable, how long), a client-side query
cache (was it updated on the mutation), the CDN or proxy (was a personalised response stored
under a shared key), the in-process cache of the instance that served the read, the distributed
cache entry (was it deleted on write, or only updated on the instance that wrote), and finally a
read replica lagging behind the primary. Each is a copy with its own age. The failure is
usually a layer nobody listed.

**What is the difference between a private and a shared cache, and why does it matter for
placement?**
RFC 9111 defines a shared cache as one that *"stores responses for reuse by more than one user"*
and a private cache as *"dedicated to a single user"*. A hit in a shared cache saves work for
everyone and can leak data if the key omits what the response varies on; a private cache cannot
leak across users but only saves that user's own repeats. Per-user data therefore belongs in a
private layer or behind a key that includes the user; public data belongs in a shared one.

**What is special about the in-process cache compared to Redis?**
It has no network and no serialisation, so a hit is the cheapest a layer can be, but it is
per-instance: ten instances are ten caches with ten ages, there is no fleet-wide purge, it shares
the heap with the application, and it empties on every restart. It is for small, hot,
rarely-changing data where a few seconds of disagreement between instances does not matter;
anything that must be identical across instances belongs in the shared layer.

**Why is the database's buffer pool part of the answer to "where can a cache live"?**
Because it is a cache that exists without being asked for, it is never stale (it holds the pages
the database itself serves), and it can be damaged by a large scan displacing the hot pages. It
changes the decision: before adding an application cache, ask whether the database's memory holds
its working set, and keep long scans off the primary.

**What is the first question you ask before choosing a cache layer for a piece of data?**
Whether I can empty that layer when the data changes. The layer's reach and speed are secondary;
a long-lived entry in a layer I cannot reach is a stale value with a deadline I do not control.
That is why a hashed asset can live in the browser for a long time and a price cannot.

{/* FOOTER */}
