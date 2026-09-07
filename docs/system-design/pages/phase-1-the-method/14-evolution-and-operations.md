---
title: "A design is graded on how it is deployed, watched and changed, not only on how it is drawn — so say what ships in week one, what year one adds and the symptom that adds it, and what you deliberately do not build yet; a system that arrives complete has never been operated"
sidebar_label: "14 · Evolution and operations"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method; the SLI definition and the "reality of what you offer" sentence
> are the Google SRE book, [*Service Level Objectives*](https://sre.google/sre-book/service-level-objectives/)
> (verbatim). The four "golden signals" — latency, traffic, errors, saturation — are the SRE book's
> monitoring chapter, **named, not quoted** (that chapter was not fetched). Deployment and
> migration patterns are described as common practice, not attributed to a standard. The record
> of decisions is the subject of **17 · The same method in writing** *(not written yet)*. **No sandbox run.**

**The diagram on the board is the year-one system. What ships in week one is smaller, and the
gap between the two is the evolution story: each box arrives when a symptom demands it, each
arrival is a migration with a step back, and the whole thing is deployed in small rolling steps
and watched by a handful of signals that say whether users are being served.** Interviewers ask
about evolution because it is where design meets operation: a candidate who can say "one
deployable and one database in week one; the log arrives when the second consumer does; the
cache when the read ratio says so; the second region never, on these numbers" has shown that the
boxes are decisions with triggers, not furniture. And a candidate who can say how a column is
renamed without downtime, what alert fires first when checkout breaks, and what is *deliberately*
not built yet has operated something. This page is the week-one / year-one split on the
storefront, the deploy story, the signals worth watching, the migration patterns that keep every
change reversible, and the list of things a senior declines to build.

## Week one, quarter one, year one

| | Week one | Quarter one | Year one |
|---|---|---|---|
| **Deployables** | one service, one database, one deploy | the outbox publisher and workers split out; the app still one deployable | services split by scaling profile — catalogue, order, payment adapter — only where the profile differs |
| **Data** | one PostgreSQL primary, nightly snapshot | a failover replica; tested restore | read replica for analytics or a nightly export; lifecycle policies on object storage |
| **Async** | none — email sent inline, retried on failure | outbox and a managed queue; one consumer | a log with several consumers; the search indexer; compacted snapshots |
| **Caching** | none beyond the CDN for images | a product cache when database CPU says so | zone-aware cache replicas; invalidation from the outbox |
| **Traffic** | a managed balancer, two replicas | autoscaling with a reserved floor | admission for sale day; a reservation counter |
| **Watching** | request rate, error rate, p99 latency, database CPU; one alert on the error rate | SLOs on checkout and catalogue; dashboards per journey; on-call rotation | error budgets driving release pace; capacity review quarterly |
| **Change** | migrations run before deploy; rolling deploy | expand/contract migrations as a rule; feature flags | canary releases; a strangler for each service split |

The arrows between the columns are the point: each cell in a later column has a symptom in the
earlier one. The log arrives when the second consumer does; the cache when the database's CPU is
the same reads; the service split when two parts scale on different axes and one deploy holds
the other back. Saying the trigger is what makes the year-one column a plan rather than a wish.

## What you deliberately do not build yet

The senior sentence in this part of the round is "not yet, and here is the trigger":

| Not built | Trigger that would build it | Why not now |
|---|---|---|
| **Sharding** | tens of thousands of writes a second, or backups that cannot finish | fifty writes a second at the worst hour; sharding's cost is permanent ([12](12-the-scaling-walk.md)) |
| **A second region** | a distant market, or an availability target above one region's | doubles the bill, adds a recovery point ([13](13-designing-for-cost.md)) |
| **Microservices from day one** | two parts that scale on different axes and block each other's releases | a six-person team; every boundary is a network hop, a contract, and a deploy |
| **A self-run queue or log** | a managed one's ceiling or bill | operating a cluster is a job; the managed one's ceiling is far above the estimate |
| **A data warehouse** | analytics queries slowing the primary; a second consumer for the data | a nightly export and a replica cover the first year |
| **A custom ID generator, a service mesh, a config service** | a measured need — hot-spotting on IDs, a fleet too large to configure by hand | each is a system to run; the default works until a number says otherwise |
| **Multi-tenancy in the schema** | a second tenant | a tenant column added later costs a migration; added now it costs every query, forever |

The list is as long as the diagram, and it is where the interviewer learns whether you know the
cost of a box. "We'd add it when…" turns each omission into a decision.

## How it is deployed

The deploy story is short and it has to be there:

1. **One artifact, promoted.** The same build goes to staging and production; configuration and
   secrets come from the environment, never from the build. A build that differs between
   environments has not been tested.
2. **Rolling, behind health checks.** Replicas are replaced a few at a time; the balancer routes
   to a new replica only after its health check passes, and the health check tests a real
   dependency — the database connection — not just that the process is up.
3. **Migrations before code, and compatible with both.** The schema change ships first, in a form
   the *old* code tolerates; the new code ships second. This is the expand/contract rule below,
   and it is what makes rolling deploys safe: for a few minutes both versions run against one
   schema.
4. **Canary for the risky ones.** One replica takes a slice of traffic on the new build; its
   error rate and latency are compared to the fleet's before the rollout continues. The
   comparison needs the signals below to exist.
5. **Flags for behaviour, deploys for code.** A feature behind a flag ships dark and is turned on
   for a percentage of users; turning it off is a config change, not a rollback. The flag's
   removal is scheduled when it is added, or the code fills with dead branches.
6. **Rollback is a deploy of the previous artifact.** It must be practised, and it is only
   possible when step 3 was followed — a migration that dropped a column the previous build reads
   has made rollback impossible.

Said in the round: "rolling deploys behind health checks, migrations expand-then-contract so both
versions run, canary on payment changes, flags for behaviour, rollback rehearsed."

## What to watch

The SRE book's definition is the one to use, because it fixes the unit of measurement:

> *"An SLI is a service level indicator—a carefully defined quantitative measure of some aspect
> of the level of service that is provided."* — SRE book, *Service Level Objectives*

Four signals per service are the standing set — the SRE book's monitoring chapter calls them the
golden signals: **latency** (p50 and p99, of successful requests, separately from failed ones),
**traffic** (requests a second, by journey), **errors** (rate, by class — 5xx, timeouts,
rejected by admission), and **saturation** (how full the constrained resource is — database CPU,
connection pool, queue depth, cache memory). For the storefront, the first alert is on checkout's
error rate against its SLO from [02](02-non-functional-requirements.md), not on any cause;
alerts fire on symptoms users feel, and dashboards show causes. Two things beyond the four:
**consumer lag** on the log, because a stuck fulfilment worker is invisible to every synchronous
signal; and **business counters** — orders per minute against the same hour last week — because
a bug that returns 200 with an empty cart shows up nowhere else.

> *"Users build on the reality of what you offer, rather than what you say you'll supply,
> particularly for infrastructure services."* — SRE book, *Service Level Objectives*

Which is the reason to publish the SLO internally and hold the release pace to its error budget:
a service that has been at four nines for a year will be depended on at four nines whatever the
document says.

## How it is migrated

Every change to a schema or a store follows one rule: **at every step, the previous step's code
still works.** The patterns:

**Expand, migrate, contract.** To rename `orders.total` to `orders.total_cents`: add the new
column (expand); deploy code that writes both and reads the new one, backfill the old rows in
batches; then drop the old column (contract) one release later, when no running code reads it.
Three deploys, each reversible, no downtime. A single `ALTER TABLE … RENAME` is one deploy and
a guaranteed window in which the old code fails.

**Backfill in batches, idempotently.** A backfill over a hundred million rows runs in chunks by
primary-key range, commits each chunk, records its position, and can be re-run from that position
after a failure. One long transaction locks the table and is the outage the migration was meant
to avoid.

**Dual-write, then switch the read.** Moving the cart from PostgreSQL to Redis: write to both,
read from the old; compare in the background; switch reads to the new; stop writing the old.
Each step is a flag; each is reversible until the last.

**The strangler.** Splitting the catalogue out of the monolith: the new service takes one
endpoint at a time behind the gateway's routing, with the monolith still serving the rest; the
old code path is deleted when the last endpoint moves. The monolith is never rewritten; it is
hollowed.

**The data version.** Every event on the log carries a schema version; consumers accept the
previous version for as long as the retention window, because a replay will hand them old
events. Contract changes are additive — new optional fields — for the same reason.

## The storefront in week one, honestly

One Node service, one PostgreSQL primary with a nightly snapshot, a managed balancer with two
replicas, the CDN for images, email sent inline with a retry, four signals on a dashboard and one
alert on checkout errors, rolling deploys, migrations expand-then-contract from the first one. No
cache, no queue, no replica, no admission — each named with its trigger. It handles a hundred
reads a second and half an order a second with nothing to operate but backups and deploys, and
every box on the year-one diagram has a sentence that says when it arrives.

## Gotchas

**★ Symptom: "how would you ship this?" and a pause.** Cause: the design was drawn as a finished
object; deployment was never part of it. Fix: the six-line deploy story — one artifact, rolling
behind health checks, migrations first and compatible, canary, flags, rehearsed rollback.

**★ Symptom: the year-one diagram presented as week one.** Cause: no evolution story; every box
arrives at once. Fix: name the week-one system and the trigger that adds each later box; the
not-yet list with its triggers.

**Symptom: a column renamed in one migration.** Cause: expand/contract unknown. Fix: add the new
column, write both and read new, backfill in batches, drop the old a release later.

**Symptom: rollback impossible after a deploy.** Cause: the migration dropped or changed
something the previous build reads. Fix: contract only after the release that stopped reading it
is stable; rollback is a deploy of the previous artifact, and it is rehearsed.

**Symptom: the first alert is "database CPU above 80 %".** Cause: alerting on a cause. Fix: alert
on the symptom users feel — checkout error rate or latency against its SLO — and put CPU on the
dashboard that explains it.

**Symptom: a stuck worker discovered by a customer's email.** Cause: only synchronous signals
watched. Fix: consumer lag as a first-class signal with an alert, and a business counter — orders
per minute against last week — that catches the silent failures.

**Symptom: a backfill that locked the orders table.** Cause: one transaction over all rows. Fix:
batches by key range, committed each, position recorded, re-runnable.

**Symptom: the health check passes while the database is down.** Cause: it tests the process, not
a dependency. Fix: the check touches the database with a cheap query and reports unhealthy when
it cannot; the balancer then stops routing.

**Symptom: flags never removed; the code is a thicket of dead branches.** Cause: no removal
scheduled. Fix: the flag's removal ticket is created when the flag is; a flag older than a quarter
is a bug.

**Symptom: microservices in week one for a team of six.** Cause: the year-one boundary drawn as
the starting point. Fix: one deployable until two parts scale on different axes or block each
other's releases; then a strangler, one endpoint at a time.

## Interview questions

**★ What ships in week one, and what triggers each later box?**
One service, one primary with a nightly snapshot, a managed balancer with two replicas, the CDN
for images, inline email with a retry, four signals and one alert on checkout errors, rolling
deploys with expand/contract migrations. Then: a failover replica when a tested restore shows the
recovery time is too long; the outbox and a queue when the second consumer or the checkout
latency arrives; the cache when database CPU is the same reads; admission when the first sale
day's numbers are known; a service split when two parts scale differently; a second region on a
distant market or a higher availability target — and sharding not at all on these numbers.

**★ How do you rename a column without downtime?**
Expand, migrate, contract. Add the new column; deploy code that writes both and reads the new,
backfill the old rows in batches by key range with the position recorded; then, one release
later when no running code reads the old column, drop it. Three deploys, each reversible, both
versions of the code correct at every step — which is also what makes a rolling deploy and a
rollback safe.

**What do you watch, and what fires the first alert?**
Per service, the four golden signals — latency by percentile for successful requests, traffic by
journey, errors by class, saturation of the constrained resource — plus consumer lag on the log
and a business counter such as orders per minute against the same hour last week. The first
alert is on checkout's error rate or latency against its SLO, because alerts fire on symptoms
users feel; the causes — database CPU, pool exhaustion, queue depth — are on the dashboard that
explains the alert.

**What would you deliberately not build, and why?**
Sharding, until tens of thousands of writes a second or an operational wall; a second region,
until distance or the availability target demands it; microservices, until two parts scale on
different axes; a self-run log, a warehouse, a custom ID generator, a service mesh — each is a
system to operate, and the managed or default version holds until a number says otherwise. Each
omission is stated with its trigger, so it reads as a decision rather than a gap.

**How do you move the cart from PostgreSQL to Redis while the site is live?**
Dual-write behind a flag — every cart write goes to both stores, reads stay on PostgreSQL; a
background comparison checks the two agree; reads switch to Redis for a percentage of users,
then all; writes to PostgreSQL stop one release later. Each step is a flag flip and reversible
until the last; the old table is dropped only after a stable release with no reads.

**Why is the health check part of the design?**
Because the balancer's routing during a rolling deploy and a failure depends on it. A check
that reports the process is up will route traffic to a replica that cannot reach the database;
a check that runs a cheap query against a real dependency reports unhealthy, the balancer stops
routing, and the failure walk's "the balancer stops routing to the dead one" actually happens.

---

← Prev: [13 · Designing for cost](13-designing-for-cost.md) · Index: [Phase 1 — The method](README.md) · Next → [15 · Time management in 45 minutes](15-time-management.md)
