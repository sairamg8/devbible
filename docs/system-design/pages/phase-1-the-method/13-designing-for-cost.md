---
title: "\"What does this cost?\" is answered without a price list — by ranking the bill's lines, naming the design decision that drives each, and saying the lever that would halve it; the lines that surprise are traffic, not compute: egress, cross-zone chatter, the NAT gateway, and a database sized for an hour a quarter"
sidebar_label: "13 · Designing for cost"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method. **No prices are quoted anywhere on this page** — they change
> quarterly and differ by provider and region; what is stable, and what the page describes, is the
> *billing dimensions* every major cloud shares (compute-hours, stored gigabytes by tier, bytes
> transferred by direction and boundary, managed-service capacity units). Check a provider's own
> calculator for a figure. The one quoted sentence on cost is the Google SRE book,
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/) (verbatim). The storefront's
> numbers are [03](03-back-of-the-envelope-estimation.md)'s. **No sandbox run.**

**Seniors are asked "what does this cost?" because cost is the constraint that decides which of
two correct designs ships, and because the bill is where a design's hidden decisions surface.**
The answer is never a number — nobody in the room has the price list, and a figure said from
memory is wrong by the time it is checked. The answer is a *shape*: the three or four lines that
dominate this system's bill, in order, the design decision that drives each, and the lever that
would halve it. That shape can be produced from the estimation numbers already on the board,
because a bill is those numbers multiplied by a rate, and the rates' relative sizes are stable
even when their absolute values are not: bytes leaving the provider's network cost more than
bytes entering, which usually cost nothing; bytes crossing a zone or region boundary cost where
bytes inside a zone do not; a managed database is billed for the capacity it is *sized* for, not
the capacity it uses; storage is billed by tier, and the cheap tiers charge to read. The lines
that embarrass a design are almost never compute. This page is the bill's shape, the four traffic
lines that surprise, the storage-tier and over-provisioning traps, the storefront's bill ranked,
and the form of the answer in the round.

## The bill's shape

| Line | Billed by | The design decision that drives it | The trap |
|---|---|---|---|
| **Compute** | instance-hours (or requests and duration, serverless) | replica count, and whether replicas idle between peaks | a fleet sized for the sale-day peak, idle for the quarter |
| **Managed database** | instance size, provisioned storage and IOPS, replicas, backups | the primary's size, the replica count, the retention | sized for the peak hour; every replica is another full instance |
| **Storage** | gigabytes per month, *by tier*, plus requests and retrievals | what is kept, for how long, and in which tier | everything in the hot tier forever; no lifecycle policy |
| **Data transfer** | bytes, *by direction and boundary* | where the bytes go — internet, another zone, another region, through a NAT | the four lines below; each is invisible on the diagram |
| **Managed queue or log** | throughput units, partitions, retention, broker-hours | partition count and retention days | seven days of retention on a stream nobody replays |
| **Cache** | node size and count | the hot set, and the replica for failover | a cache sized for the whole catalogue instead of the hot fifth |
| **CDN** | egress bytes and requests, by region | payload size and cache-hit ratio | images served at full resolution; a low hit ratio pushing egress to origin *and* the CDN |
| **Observability** | ingested log bytes, metric series, trace spans | log level, label cardinality, sampling | debug logging in production; a per-user label on a metric |

Every line's driver is a decision the round already made, which is why the question is fair:
"what does this cost" is "which of your decisions are expensive, and did you know?"

## The four traffic lines that surprise

Traffic is the line candidates cannot see, because arrows on a diagram do not carry a price.
Four of them do:

**Egress to the internet.** Bytes leaving the provider's network are billed; bytes entering
usually are not. The storefront's images — fifty to a hundred kilobytes each, several per product
page, a thousand pages a second at a sale — are the largest single flow in the system, and every
byte of it is egress from somewhere. The design decision is the CDN's hit ratio and the image
sizing; the lever is serving resized variants and caching them at the edge, so that origin egress
is the miss rate times the payload rather than the whole thing.

**Cross-zone traffic.** Replicas placed in different availability zones for resilience — which the
failure walk of [11](11-bottlenecks-and-single-points-of-failure.md) asked for — talk to each
other across a billed boundary: the database replicating to its standby, the app fetching from a
cache in another zone, the log's brokers replicating partitions. The bytes are the same bytes
that were free inside one zone. The lever is zone-aware routing — an app replica prefers the cache
node and the read replica in its own zone — and knowing which flows must cross (replication) and
which need not (reads).

**The NAT gateway.** Services in private subnets reach the internet — the payment provider, the
email gateway, a package registry, the provider's own object storage unless a private endpoint is
configured — through a NAT gateway that is billed *per gigabyte processed* on top of hourly. The
classic surprise is a worker pulling large objects from object storage through the NAT, paying
per byte for traffic that a private endpoint would carry for nothing. The lever is a private
endpoint for every provider service the private subnet talks to, and the NAT reserved for the
genuinely external calls.

**Cross-region replication.** The second region of the scaling walk's last step
([12](12-the-scaling-walk.md)) replicates every write across a billed inter-region boundary, and
reads served from the wrong region cross it again. The lever is asynchronous replication of only
the data the second region serves, and routing users to their own region.

Said on the board: "the arrows that cost are the ones that leave — the network, the zone, the
region — and the NAT; everything inside a zone is free."

## Storage tiers, and the cost of reading the cheap one

Object and archival storage is priced by tier: a hot tier for frequent access, an infrequent
tier that is cheaper per gigabyte but charges per retrieval and per byte read, and an archive tier
that is cheapest to hold and slowest and most expensive to read, often with a minimum storage
duration. The design decisions are the *lifecycle policy* — after how many days an object moves
down a tier — and the honest access pattern for each kind of data:

| Data | Access pattern | Tier and policy |
|---|---|---|
| product images | read constantly | hot, behind the CDN |
| order records (relational) | read for a month, then rarely | the database for the live window; exported to object storage yearly |
| invoices and receipts | read once, kept seven years by law | hot for ninety days, then infrequent, then archive |
| application logs | read for a week when something breaks | hot for seven days, infrequent for thirty, then deleted or archived |
| the event log's history | replayed by a new consumer, occasionally | short retention on the log; compacted snapshots in object storage |
| database backups | read only in a restore | infrequent; the newest few in hot for a fast restore |

The trap runs both ways. Everything in the hot tier is the obvious waste; the subtler one is an
archive tier for data that is then read regularly — a compliance query across seven years of
archived invoices, paid for per byte retrieved, can cost more in a month than the hot tier would
have. "Keep everything forever" is a requirement that [01](01-functional-requirements.md) should
have caught and priced.

## The over-provisioned database

The database is usually the largest managed-service line, and it is sized wrong in a predictable
way: for the peak that [04](04-traffic-shapes.md) showed lasts an hour a quarter. The billing is
for the instance size chosen, twenty-four hours a day, plus provisioned IOPS whether used or not,
plus each replica as a full instance, plus backup storage past the free allowance. Four levers:

1. **Size for the average, shelter the peak.** Admission and the reservation counter of the
   sale-day design exist so that the primary does not have to be sized for the spike.
2. **Count the replicas honestly.** A replica for failover is one; a second for analytics is
   another full instance whose real driver is that analytics queries run on the primary. A
   nightly export to a warehouse may be cheaper than a replica held all day for it.
3. **Reserve what is steady.** Committed-use pricing is the provider's discount for predictability;
   the primary and its failover replica are steady, the app fleet's peak replicas are not. The
   trade is elasticity for a discount, and the sentence is "reserve the floor, pay on demand for
   the peak".
4. **Move the hot counter out.** The inventory row that forces the biggest primary is a single
   counter; a counter service on a cache-class store is a fraction of the database instance the
   row would otherwise justify.

The compute fleet has the same shape: replicas sized for the peak idle for the quarter, and
autoscaling that lags the spike by minutes so the fleet is over-provisioned for the ramp and
under-provisioned for the first minute. Serverless is the answer for the genuinely spiky and
low-volume — the outbox publisher, the nightly job — and the wrong answer for the steady
catalogue reads, where the per-request price exceeds an idle instance's.

## The storefront's bill, ranked

Without a price list, the ranking is done from the numbers and the relative rates. The
storefront's, largest first, with the driver and the lever:

1. **Image egress via the CDN** — a thousand pages a second at peak, several images each; driven
   by payload size and hit ratio. Lever: resized variants, long cache lifetimes, a hit ratio in
   the high nineties.
2. **The database** — a primary sized with headroom, one failover replica, backups; driven by the
   replica count and the sale-day sizing. Lever: size for the average, counter service for
   inventory, one replica.
3. **Compute** — three to five app replicas steady, more at a sale; driven by the peak. Lever:
   autoscaling with a reserved floor.
4. **The log cluster** — brokers and retention; driven by partitions and days retained. Lever:
   short retention, snapshots in object storage.
5. **Observability** — logs at the request rate; driven by log level and cardinality. Lever:
   sampling and structured logs at info.
6. **Cross-zone and NAT traffic** — replication and provider calls; driven by placement. Lever:
   zone-aware reads, private endpoints.
7. **Object storage** — images and exports, a few hundred gigabytes; driven by tiering. Lever:
   lifecycle policies. Small, but the one that grows forever.

The ranking is arguable — which is the point. An interviewer who disagrees about whether the
database or egress is first is having the conversation the question was asking for.

## Cost as a non-functional requirement

Cost belongs on the board with the other non-functionals from
[02](02-non-functional-requirements.md), and it trades against every one of them —
[10](10-trade-offs-in-one-sentence.md)'s fourth axis. The SRE book's version, for reliability:

> *"experience shows that as we build systems, cost does not increase linearly as reliability
> increments—an incremental improvement in reliability may cost 100x more than the previous
> increment."* — SRE book, *Embracing Risk*

The same curve holds for latency (a cache tier, then a second region), for durability
(synchronous replication, then cross-region), and for the peak (a fleet for the hour a quarter).
The senior move is to express cost **per unit** rather than in total — cost per order, per
thousand page views, per gigabyte stored per month — because a per-unit figure survives growth
and makes the trade legible: "synchronous cross-region replication roughly doubles the database
line; per order that is a fraction of a cent, and the business decides whether a lost order is
worth more than that."

## The answer in the round

The form, in under a minute, with no number in it:

1. **Rank** — "three lines dominate: image egress, the database, compute; the log and
   observability are next; storage is small but grows."
2. **Drive** — "egress is driven by image payload and the CDN hit ratio; the database by the
   replica count and the sale-day sizing; compute by the peak."
3. **Lever** — "to halve it: resized images and a higher hit ratio for egress; size the primary
   for the average and shelter the peak with admission; reserve the compute floor and scale the
   rest on demand."
4. **The hidden lines** — "and the ones I'd check on the first bill: cross-zone replication,
   the NAT gateway for the provider calls, and log volume."
5. **Per unit** — "cost per order is what I'd report, so that growth doesn't hide a regression."

Then the follow-up, which is usually "what would you cut if the budget halved?" — the reversal
clause of [10](10-trade-offs-in-one-sentence.md), answered from the ranking: the second region
first, then the analytics replica, then the observability retention; never the failover replica.

## Gotchas

**★ Symptom: a price quoted from memory, and the interviewer's eyebrows.** Cause: a number where
a shape was wanted; the figure is wrong or unverifiable. Fix: rank the lines, name the drivers and
the levers, express per unit; offer to compute with the provider's calculator as the next step.

**★ Symptom: "compute is the main cost" for a system that serves images.** Cause: the arrows on
the diagram carry no price, so egress is invisible. Fix: multiply the estimation's bandwidth line
by the direction — every byte to the internet is billed — and rank egress first when the payload
is media.

**Symptom: replicas in three zones drawn for resilience, cross-zone traffic never mentioned.**
Cause: a free arrow assumed. Fix: name the flows that cross zones — replication must, reads need
not — and zone-aware routing as the lever.

**Symptom: a worker pulls objects from the provider's storage through the NAT.** Cause: private
subnet, no private endpoint; the NAT bills per gigabyte for traffic that never leaves the
provider. Fix: a private endpoint for object storage and every provider service the subnet uses;
the NAT reserved for the payment provider and the email gateway.

**Symptom: the database sized for the sale.** Cause: the peak treated as the capacity target.
Fix: size for the average, shelter the peak with admission and the counter service, reserve the
floor.

**Symptom: seven years of invoices in the archive tier, queried monthly.** Cause: the cheapest
tier chosen by storage price alone. Fix: tier by *access pattern*; the retrieval fee on a regular
query exceeds the storage saved.

**Symptom: an observability bill nobody predicted.** Cause: debug logging, or a metric labelled
by user ID. Fix: info level in production with sampling on the hot paths; bounded label sets.

**Symptom: a total cost with no denominator.** Cause: growth hides regressions in a total. Fix:
per order, per thousand requests, per gigabyte-month; report the unit cost and its trend.

**Symptom: "what would you cut?" answered with the failover replica.** Cause: cutting by size
rather than by value. Fix: cut what buys the least — the second region before the analytics
replica before retention — and never the mechanism that meets the availability target.

## Interview questions

**★ What does this system cost — answer without a price list.**
By shape: three lines dominate — image egress through the CDN, driven by payload size and hit
ratio; the database, driven by the replica count and sizing for the sale-day peak; and compute,
driven by the peak fleet. Next are the log cluster and observability; storage is small but grows
forever. The levers are resized images and a high hit ratio, sizing the primary for the average
with admission sheltering the peak, and a reserved compute floor with on-demand replicas above
it. The hidden lines to check on the first bill are cross-zone replication, the NAT gateway, and
log volume. Reported per order, so growth cannot hide a regression.

**★ Which traffic costs money, and where does it hide on the diagram?**
Bytes leaving the provider's network, bytes crossing a zone or region boundary, and bytes passing
through a NAT gateway; bytes inside a zone and bytes entering are typically free. They hide in
arrows that look identical: the image response to a browser is egress; the primary's replication
to a standby in another zone is cross-zone; a worker fetching from object storage without a
private endpoint is NAT-billed; the second region's replication is inter-region. The levers are
the CDN's hit ratio, zone-aware routing, private endpoints and asynchronous regional replication.

**Why is the database usually over-provisioned, and what are the levers?**
Because it is sized for a peak that lasts an hour a quarter and billed for that size all day,
with every replica a full instance and IOPS provisioned whether used or not. The levers: size for
the average and shelter the peak with admission and a counter service for the hot row; count
replicas honestly, replacing an analytics replica with a nightly export where that suffices;
reserve the steady floor for the committed-use discount; and keep the hot counter off the
primary altogether.

**When is the archive tier the wrong choice?**
When the data is read regularly. Archive tiers are cheapest to hold and charge per retrieval and
per byte read, often with a minimum storage duration; a monthly compliance query across seven
years of archived invoices can cost more than keeping the recent years in the infrequent tier. Tier
by access pattern — hot for constant reads, infrequent for the occasional, archive for the almost
never — and set the lifecycle policy on the board.

**What is the budget-halved answer?**
Cut by value, not by size, from the ranking: the second region first, because it buys survival of
an event the availability target may not require; then the analytics replica, replaced by an
export; then observability retention and log volume; then compute headroom. Never the failover
replica or the backups, because they are what meets the availability and durability targets,
and a cheaper system that misses its targets is not cheaper.

**Why express cost per unit rather than in total?**
Because a total rises with success and hides regressions — a bill that doubled while orders
tripled is a win, one that doubled while orders rose by half is a problem, and the total says
the same thing in both cases. Cost per order, per thousand page views or per gigabyte-month
makes trade-offs legible to the business: synchronous replication that adds a fraction of a cent
per order is a decision about lost orders, not about a large monthly number.

---

← Prev: [12 · The scaling walk](12-the-scaling-walk.md) · Index: [Phase 1 — The method](README.md) · Next → [14 · Evolution and operations](14-evolution-and-operations.md)
