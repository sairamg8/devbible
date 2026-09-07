---
title: "Part 1 — The interview and the method"
sidebar_label: "1 · The method"
sidebar_position: 1
---

> Phases 0–1 · What the design rounds actually grade, and the method that survives any question

Most candidates fail system design before touching a database: they design the wrong thing,
for the wrong scale, without saying what they gave up. This part is the difference between
"has read about Kafka" and "can be handed an ambiguous problem and a whiteboard". Everything
later in the track is a building block; this part is how you assemble them under a clock.

The running example throughout the track is the bible's own
[PERN storefront](../../real-world/README.md) — catalog, cart, checkout, orders, reviews —
because it is the app the reader is actually building, and because every classic interview
question (flash sale, search, notifications, payments) is one of its features at scale.

---

## Phase 0 — What system design interviews test

A design round is not a knowledge quiz. It grades judgement under ambiguity: whether you scope
before you build, reason from numbers, name trade-offs unprompted, and go deep on one thing
when asked. The same rubric is what a senior engineer is paid for at work — this phase is about
seeing the rubric so you can hit it on purpose.

| Topic | Tier |
|---|---|
| **What "design" means at each level** — an SDE-2 is asked to build one component correctly; a senior is asked to *choose* between designs and say what each gives up; a staff engineer is asked where the design breaks in two years. The same question, three different expected answers | <span className="db-tier t-master">Master</span> |
| **The three rounds that carry the word "design"** — high-level design (whiteboard, 45–60 minutes), low-level design (classes, interfaces, a runnable skeleton) and machine coding (a working program in a fixed window); what each one grades and why product companies run more than one | <span className="db-tier t-master">Master</span> |
| **The rubric interviewers actually hold** — requirements gathering, estimation, a coherent high-level design, depth on at least one component, handling of scale and failure, trade-offs stated without prompting, communication. "Correct but silent" fails the last two | <span className="db-tier t-master">Master</span> |
| **The vocabulary contract** — latency vs throughput, availability vs durability, consistency vs correctness, scalability vs performance, reliability vs resilience. Using these loosely is the fastest way to sound junior | <span className="db-tier t-master">Master</span> |
| **The latency ladder** — the relative cost of an L1 hit, a memory read, an SSD read, a same-datacentre round trip, a cross-region round trip and a disk seek; you do not need the exact nanoseconds, you need the orders of magnitude and the habit of reaching for them | <span className="db-tier t-master">Master</span> |
| **Reading the question** — the ambiguity is deliberate; "design Instagram" is a test of whether you ask *which part of Instagram, for how many users, with what freshness* before drawing a box | <span className="db-tier t-master">Master</span> |
| **The common ways to fail** — designing before scoping, jumping straight to microservices, "we'll use Kafka" with no stated reason, forgetting the write path, never mentioning failure, and answering a question the interviewer did not ask | <span className="db-tier t-understand">Understand</span> |
| **Why a reasoned wrong answer beats a memorised right one** — the follow-up ("what if writes are 10× reads?") is the real test, and a memorised diagram cannot answer it | <span className="db-tier t-understand">Understand</span> |
| **Communication mechanics** — think aloud, number the flows on the diagram, summarise every five minutes, ask before deep-diving, and treat the interviewer's hint as the agenda | <span className="db-tier t-understand">Understand</span> |
| **How to practise** — timed drills on the canonical questions (**Part 12** *(not written yet)*), mock interviews with a peer who grades against the rubric, recording yourself, and a written post-mortem per session | <span className="db-tier t-understand">Understand</span> |
| **Whiteboard and remote tooling** — box-and-arrow conventions, one colour for data flow and one for control, a diagramming tool you can drive without thinking, and what to do when the shared board lags | <span className="db-tier t-know">Know</span> |
| **Primary sources behind the folklore** — the Dynamo, Bigtable, Spanner, Kafka and Raft papers and the Google SRE book: which chapters to actually read, and why a candidate who has read Dynamo explains quorums differently | <span className="db-tier t-know">Know</span> |
| **How this track relates to the rest of the bible** — the storefront supplies the examples, [Node](../../nodejs/README.md), [Java](../../java/README.md), [PostgreSQL](../../postgresql/README.md), [Redis](../../redis/README.md), [Docker](../../docker/README.md) and [Nginx](../../nginx/README.md) supply the mechanics; this track adds the *decisions* | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain, in two minutes and without notes, what separates a
senior answer from an SDE-2 answer to "design a URL shortener" — and name the three things
the interviewer is listening for that a diagram alone cannot show.

---

## Phase 1 — The method: requirements to deep dives

One method, applied to every question, so that the 45 minutes are spent designing rather than
deciding what to do next. It is the same method a design document at work follows —
context, goals and non-goals, options, decision, risks — compressed to a whiteboard.

| Topic | Tier |
|---|---|
| **Functional requirements** — the three to five user journeys in scope, the explicit out-of-scope list, the actors (guest, customer, admin, the payment provider); writing them on the board so the interviewer can redirect you *before* you design | <span className="db-tier t-master">Master</span> |
| **Non-functional requirements** — scale (daily active users, peak QPS, read/write ratio), latency targets at p50 and p99, availability target, consistency needs per journey, durability, data retention, compliance. Each one you skip is a question you will be asked | <span className="db-tier t-master">Master</span> |
| **Back-of-the-envelope estimation** — QPS from DAU and actions per user, storage from record size × rate × retention, bandwidth from payload × QPS, cache size from the hot fraction; rounding to powers of ten and *saying* that you are rounding | <span className="db-tier t-master">Master</span> |
| **Traffic shapes** — steady, diurnal, and spike (a flash sale, a match starting, a ticket window opening); peak-to-average ratio, and the difference between designing for the peak and shedding load at it | <span className="db-tier t-master">Master</span> |
| **The API sketch** — one endpoint or RPC per journey with request and response fields, idempotency on anything that charges or creates, pagination on anything that lists; how a wrong API leaks into every later box | <span className="db-tier t-master">Master</span> |
| **The data model from the access patterns** — entities, keys and relationships written *after* listing how each journey reads and writes them; choosing the primary store from those patterns rather than from habit | <span className="db-tier t-master">Master</span> |
| **The high-level diagram** — client, edge, gateway, services, stores, async workers; numbered flows for the main journeys; one diagram first, then zoom into one box | <span className="db-tier t-master">Master</span> |
| **Read path and write path, separately** — caches and fan-out on the read side, durability and ordering on the write side; tracing "what happens when the user taps Buy" end to end, box by box | <span className="db-tier t-master">Master</span> |
| **Choosing the deep dives** — the component with the hardest scale, the one the interviewer keeps returning to, and the one you can defend under three follow-ups; picking wrongly wastes the last twenty minutes | <span className="db-tier t-master">Master</span> |
| **Trade-offs in one sentence** — consistency vs availability, latency vs durability, simplicity vs flexibility, cost vs all of them; the "we chose X over Y because Z, and we pay for it with W" sentence, said unprompted | <span className="db-tier t-master">Master</span> |
| **Bottlenecks and single points of failure** — walking the diagram asking "what if this box dies" and "what if this number doubles"; the SPOF checklist (DNS, the load balancer, the primary database, the one queue, the one region) | <span className="db-tier t-master">Master</span> |
| **The scaling walk** — one server → stateless replicas behind a balancer → a cache → read replicas → sharding → asynchronous work → multi-region, and the symptom that forces each step; presenting it as a sequence rather than starting at the end | <span className="db-tier t-understand">Understand</span> |
| **Designing for cost** — egress, NAT and cross-zone traffic, storage tiers, over-provisioned databases; why seniors get asked "what does this cost" and how to answer without a price list | <span className="db-tier t-understand">Understand</span> |
| **Evolution and operations** — how the design is deployed, monitored and migrated; what you would build in week one versus year one, and what you would deliberately *not* build yet | <span className="db-tier t-understand">Understand</span> |
| **Time management in 45 minutes** — roughly five for requirements, ten for estimation and API, fifteen for the high-level design, ten for deep dives, five for wrap-up; what to drop when behind, and when to stop talking | <span className="db-tier t-understand">Understand</span> |
| **Estimation worked examples** — the storefront's sale-day checkout, a chat app's message storage for a year, a video service's CDN egress, a notification system's fan-out; the numbers rehearsed until the method is automatic | <span className="db-tier t-understand">Understand</span> |
| **The same method in writing** — design docs and RFCs: context, goals and non-goals, options considered with their costs, the decision, risks and rollout; architecture decision records as the durable form | <span className="db-tier t-understand">Understand</span> |
| **Diagrams that scale with the conversation** — the C4 idea (context → containers → components), when a sequence diagram beats boxes, and diagrams-as-code for the written version | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** given "design a ticket-booking service" cold, produce in twelve minutes
and without prompting: scoped functional and non-functional requirements, three estimated
numbers with the arithmetic shown, an API sketch, a first diagram with numbered flows — and
name the deep dive you would choose and why.

---

{/* NAV */}
