# Topic 04 · Sync vs async as the coupling decision — chunk plan

Tier: **Master**. Read `../_PHASE-NOTES.md` first.

## Boundary

Owns **coupling as a decision**: what a synchronous hop costs in availability, in latency
budget and in obligations the caller inherits; what the async shapes actually decouple and
what they do not; and the honest table of which interactions must be synchronous.

- 🔴 **Phase 15 owns the brokers.** No RabbitMQ or Kafka mechanics, no Spring Cloud Stream,
  no outbox implementation, no saga orchestration here. Name the problem, hand off.
- 🔴 **Phase 16 owns Resilience4j.** Circuit breaking is named as a *consequence* of a
  synchronous hop and pointed at; it is not taught.
- **03 owns the data consequence** (lost joins, API composition, CQRS read models). 04 owns
  the *availability and latency* consequence of the calls those patterns make.
- **05 owns change over the wire** (tolerant reader, DTO versioning, OpenFeign). 04 owns
  timeouts only as *the caller's inherited obligation*, not as REST client technique.
- **10 owns correlation.** 04 names the observability bill async runs up and points there.
- **12 owns the distributed monolith.** 04 supplies the arithmetic 12 argues from.

## The one number rule

`0.99^n` is **arithmetic**, not measurement — a calculation the reader can redo on paper.
Every page that uses it says so. **No latency figure, p99, hop count or throughput number is
ever presented as observed.** Worked numbers taken from a source (Google's SRE book, the
Amazon Builders' Library) are attributed to that source by name.

## Chunks (a PLAN, not a budget)

| # | File | What it argues |
|---|---|---|
| 1 | `01-coupling-is-the-decision.md` | You are not choosing a protocol; you are choosing who has to be up |
| 2 | `02-design-time-and-runtime-coupling.md` | Two independent axes, and only one of them pages you at 3am |
| 3 | `02b-temporal-coupling.md` | "Up right now" is the property, and it survives a message broker |
| 4 | `02c-the-five-things-coupling-means.md` | Location, schema, semantic, temporal, capacity — argued as one word |
| 5 | `03-availability-multiplication.md` | `0.99^n`, done on paper, with Fowler's sentence for it |
| 6 | `03b-what-it-does-to-an-slo.md` | Your 99.9% target priced against your dependency graph |
| 7 | `03c-chains-fan-out-and-composition.md` | A serial chain and a parallel fan-out multiply identically |
| 8 | `03d-where-the-arithmetic-lies.md` | It assumes independence, and correlated failure is the norm |
| 9 | `03e-hard-and-soft-dependencies.md` | A dependency you can degrade past is not in the product |
| 10 | `04-the-latency-budget.md` | The budget is set once at the edge and spent, never per hop |
| 11 | `04b-deadline-propagation.md` | An absolute deadline, decremented; HTTP has no standard for it |
| 12 | `04c-timeouts-in-spring.md` | `spring.http.clients.*`, per-group timeouts, and no default |
| 13 | `04d-the-timeout-that-is-not-a-timeout.md` | Connect vs read vs whole call vs pool acquire |
| 14 | `04e-bimodal-latency-and-exhaustion.md` | A long deadline turns a 5% fault into a total outage |
| 15 | `04f-tail-latency-under-fan-out.md` | Fan out to n and you sample the tail n times |
| 16 | `05-the-five-interaction-styles.md` | The one-to-one / one-to-many × sync / async grid |
| 17 | `05b-fire-and-forget.md` | You give up the result, and that is the whole point |
| 18 | `05c-request-reply.md` | The default shape, and the two obligations it creates |
| 19 | `05d-request-reply-over-messaging.md` | Still synchronous in spirit — the broker did not decouple you |
| 20 | `05e-event-notification.md` | Thin events, and the callback that re-couples you |
| 21 | `05f-event-carried-state-transfer.md` | The read becomes local; you pay in copies and staleness |
| 22 | `05g-choosing-a-coupling-shape.md` | The shapes side by side, by what each one removes |
| 23 | `06-what-must-be-synchronous.md` | The honest table, and the three genuine cases |
| 24 | `06b-the-decision-that-gates-a-write.md` | Validation that must be true *before* the write commits |
| 25 | `06c-the-read-that-could-have-been-a-copy.md` | The single largest available win, and its staleness budget |
| 26 | `06d-synchronous-out-of-habit.md` | Enrichment, audit, notify, analytics, "does the customer exist" |
| 27 | `06e-the-user-who-is-waiting.md` | `202 Accepted` per RFC 9110, and when it is worse UX |
| 28 | `06f-self-contained-services.md` | Partial outcome now, completion later — Richardson's definition |
| 29 | `07-what-the-caller-inherits.md` | Five obligations that arrive with the first synchronous hop |
| 30 | `07b-retries-and-amplification.md` | Multi-layer retries multiply; the 243x and 4^3 calculations |
| 31 | `07c-backoff-jitter-and-budgets.md` | Capped exponential backoff, jitter, token bucket, retry budget |
| 32 | `07d-idempotency-on-the-wire.md` | RFC 9110's definition, and the key you have to invent yourself |
| 33 | `07e-idempotent-consumers.md` | At-least-once delivery makes dedup the consumer's job |
| 34 | `07f-the-unknown-outcome.md` | A timeout is three outcomes wearing one exception |
| 35 | `07g-circuit-breaking-as-a-consequence.md` | Named, priced, and handed to phase 16 |
| 36 | `07h-backpressure-and-load-shedding.md` | 503 and `Retry-After` as a contract, not a failure |
| 37 | `08-async-is-not-free.md` | The bill: consistency, ordering, duplicates, debugging, ops |
| 38 | `08b-eventual-consistency-reaches-the-ui.md` | Read-your-writes is a product decision, not a database one |
| 39 | `08c-duplicates-and-ordering.md` | The guarantees you lose, and which ones you can buy back |
| 40 | `08d-the-broker-is-a-dependency-too.md` | And in-process async events are not durable at all |
| 41 | `08e-async-does-not-fix-a-bad-boundary.md` | A chatty event chain is still a distributed monolith |
| 42 | `09-a-synchronous-hop-in-spring.md` | `RestClient` and HTTP interface clients on Boot 4.1 |
| 43 | `09b-the-client-property-trap.md` | `spring.http.client.*` became `spring.http.clients.*` |
| 44 | `09c-blocking-cost-and-virtual-threads.md` | JDK 25 changes which resource runs out, not the arithmetic |
| 45 | `09d-degrading-instead-of-failing.md` | The fallback in code, and Brooker's warning about fallbacks |
| 46 | `09e-the-local-copy-in-practice.md` | Reading your own replica, and who owns its correctness |
| 47 | `10-the-decision-procedure.md` | Seven questions, in order, per interaction |
| 48 | `10b-the-interaction-inventory.md` | The table you fill in for a whole system |
| 49 | `11-the-checklist.md` | Reading a design doc or a pull request for coupling |

## Verify, do not assume

- ✅ `RestTemplate` deprecation status in Spring Framework 7.0 — quoted verbatim from the
  reference, not from the phase notes. It is **deprecated, not removed**.
- 🔴 **Corrected 2026-09-01, mid-run.** The dispatch said "Spring Cloud Netflix 5.0 removed
  `RestTemplate` support — use `RestClient`/`WebClient`". That overstates it, and
  `_PHASE-NOTES.md` fact 5 has been corrected on disk. What was deprecated is the **Eureka
  client's own HTTP transport** (`RestTemplateTransportClientFactory`) — topic 08's business.
  `@LoadBalanced RestTemplate` still works: Spring Cloud LoadBalancer (Commons 5.0.x) still
  serves `RestTemplate`, `RestClient`, `WebClient` and HTTP Service Clients. **No page in this
  topic says `RestTemplate` was removed or stopped working.** Examples use `RestClient`
  because it is the better choice for new code on Boot 4.1, and the pages say that on the
  merits.
- ✅ The Boot 4.x HTTP client property prefix. **Checked all three appendices**: Boot 3.5 is
  `spring.http.client.*`, Boot 4.0 and 4.1 are `spring.http.clients.*`. Say so.
- ✅ Whether Boot documents a *default* connect/read timeout — the appendix lists none.
- ✅ Fowler's "multiplicative effect of downtime" sentence — quoted verbatim.
- ✅ Richardson's definitions of runtime coupling and self-contained service — verbatim.
- ✅ RFC 9110 §9.2.2 (idempotent methods) and §15.3.3 (`202 Accepted`) — verbatim.
- ✅ The `Idempotency-Key` header status — **draft-07, expired, never an RFC.** Say so.
- ⚠️ The AWS "Availability and Beyond" whitepaper's hard/soft-dependency formula could not be
  retrieved (JS-rendered page). **Not cited.** The equivalent argument is made from Fowler
  and from arithmetic the reader can redo.
- ⚠️ No claim about the *default* read timeout of any particular request factory unless the
  Spring documentation states it.
