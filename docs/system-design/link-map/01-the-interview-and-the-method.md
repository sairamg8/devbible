---
title: "Link map · System design · Part 1 (phases 0–1)"
sidebar_label: "01 · the interview & the method"
sidebar_position: 1
---

# Link map · System design · Part 1 (phases 0–1)

Covers every topic row of phases 0 and 1 in `docs/system-design/syllabus/01-the-interview-and-the-method.md`: what design interviews test (T00-01 to T00-13) and the method from requirements to deep dives (T01-01 to T01-18). That is 31 rows. All of them have a written page of ours (`docs/system-design/pages` holds phases 0 to 3), so every block is marked written and its delta describes what our page or row says that the sources do not.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title or headings checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means the Google SRE book, vendor and standards documentation, the papers' own pages and the authors' own writing; interview-prep sites, blogs and courses count as beyond the docs. AWS Builders' Library addresses redirect to builder.aws.com, so the final address is given.

---

## Phase 0 — What system design interviews test

### T00-01 · What "design" means at each level — Master · ✅ written `docs/system-design/pages/phase-0-the-interview/01-what-design-means-at-each-level.md`
- **Read this:** [Staff archetypes](https://staffeng.com/guides/staff-archetypes/) · Will Larson, StaffEng · staff-plus is not one job: four archetypes (Tech Lead, Architect, Solver, Right Hand), each with a different scope of design ownership (*read*) · covers our angle: **partial** — describes staff scope, not what an interviewer expects at SDE-2 versus senior · fetched 2026-10-14
- **Also good:** [System Design Interview Guide](https://interviewing.io/guides/system-design-interview) · interviewing.io · how the round is run and how expectations shift with the level being hired (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [System design interview](https://www.techinterviewhandbook.org/system-design/) · Tech Interview Handbook · a candidate-side overview of what is graded and how to prepare (*headings only*) · fetched 2026-10-14
- **Our delta:** one question answered three ways, the SDE-2 component, the senior choice between designs with what each gives up, and the staff two-years-out failure point.

### T00-02 · The three rounds that carry the word "design" — Master · ✅ written `docs/system-design/pages/phase-0-the-interview/02-the-three-design-rounds.md`
- **Read this:** [System Design Interview Guide](https://interviewing.io/guides/system-design-interview) · interviewing.io · what a high-level design round looks like and how it is evaluated (*headings only*) · covers our angle: **partial** — high-level design only, nothing on low-level design or machine coding · fetched 2026-10-14
- **Also good:** [System design interview](https://www.techinterviewhandbook.org/system-design/) · Tech Interview Handbook · preparation advice for the whiteboard round (*headings only*) · fetched 2026-10-14
- **Our delta:** the three rounds side by side, what each grades, and why product companies run more than one.

### T00-03 · The rubric interviewers actually hold — Master · ✅ written `docs/system-design/pages/phase-0-the-interview/03-the-rubric.md`
- **Read this:** [System Design in a Hurry: Delivery](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery) · Hello Interview · a six-step delivery framework with time boxes: requirements about 5 minutes, core entities 2, API 5, optional data flow 5, high-level design 10 to 15, deep dives about 10 (*read*) · covers our angle: **partial** — a method, not the scoring rubric or the "correct but silent" failure · fetched 2026-10-14
- **Also good:** [A framework for system design interviews](https://bytebytego.com/courses/system-design-interview/a-framework-for-system-design-interviews) · ByteByteGo, from Alex Xu's book · a four-step process and what the interviewer is looking for at each step (*headings only*) · fetched 2026-10-14
- **Our delta:** the rubric as seven graded axes, with communication and unprompted trade-offs named as the two that silence fails.

### T00-04 · The vocabulary contract — Master · ✅ written `docs/system-design/pages/phase-0-the-interview/04-the-vocabulary-contract.md`
- **Read this:** [Please stop calling databases CP or AP](https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html) · Martin Kleppmann, 2015 · in the CAP proof "consistency" means linearizability, unrelated to the C in ACID, and "availability" means every non-failing node answers; the labels CP and AP hide real differences (*read*) · covers our angle: **partial** — consistency and availability only, not latency versus throughput, scalability versus performance or reliability versus resilience · fetched 2026-10-14
- **Also good:** [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) · Google SRE book · defines SLI, SLO and SLA, and prefers percentiles over averages because an average hides tail latency (*read*) · fetched 2026-10-14
- **Also good:** [PACELC theorem](https://en.wikipedia.org/wiki/PACELC_theorem) · Wikipedia · adds the latency versus consistency trade-off that exists even without a partition (*headings only*) · fetched 2026-10-14
- **Our delta:** five paired terms with the one-line test for each that stops loose use, in the interview register rather than the theorem's.

### T00-05 · The latency ladder — Master · ✅ written `docs/system-design/pages/phase-0-the-interview/05-the-latency-ladder.md`
- **Read this:** [Latency numbers every programmer should know](https://gist.github.com/jboner/2841832) · Jeff Dean's list, gist by Jonas Boner · about 2012 figures: L1 reference 0.5 ns, main memory 100 ns, random 4K SSD read 150 microseconds, same-datacentre round trip 500 microseconds, disk seek 10 ms, California to Netherlands and back 150 ms (*read*) · covers our angle: **partial** — the raw numbers are dated and given without the habit of reaching for them · fetched 2026-10-14
- **Also good:** [Latency numbers, interactive](https://colin-scott.github.io/personal_website/research/interactive_latency.html) · Colin Scott · the same ladder with year-by-year extrapolation (*headings only*) · fetched 2026-10-14
- **Also good:** [Response times: the 3 important limits](https://www.nngroup.com/articles/response-times-3-important-limits/) · Nielsen Norman Group · the human perception thresholds that turn a latency budget into a target (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Numbers everyone should know](https://highscalability.com/numbers-everyone-should-know/) · High Scalability · an older write-up of the same figures with capacity-planning use (*headings only*) · fetched 2026-10-14
- **Our delta:** the ladder as orders of magnitude only, with the practice of quoting a rung aloud when justifying a cache or a region choice.

### T00-06 · Reading the question — Master · ✅ written `docs/system-design/pages/phase-0-the-interview/06-reading-the-question.md`
- **Read this:** [System Design in a Hurry: Introduction](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) · Hello Interview · how the round is framed and why the prompt is deliberately open (*headings only*) · covers our angle: **partial** — general framing, no "which part, how many users, what freshness" drill · fetched 2026-10-14
- **Also good:** [A framework for system design interviews](https://bytebytego.com/courses/system-design-interview/a-framework-for-system-design-interviews) · ByteByteGo · step one is understanding the problem and asking clarifying questions before designing (*headings only*) · fetched 2026-10-14
- **Our delta:** "design Instagram" taken apart into the three questions to ask before the first box.

### T00-07 · The common ways to fail — Understand · ✅ written `docs/system-design/pages/phase-0-the-interview/07-the-common-ways-to-fail.md`
- **Read this:** [System design interview](https://www.techinterviewhandbook.org/system-design/) · Tech Interview Handbook · common mistakes and preparation advice for candidates (*headings only*) · covers our angle: **partial** — generic advice, not our list of six failures · fetched 2026-10-14
- **Also good:** [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html) · Martin Fowler · argues a monolith is faster to build and lets you find service boundaries before committing, which is the counter to jumping straight to microservices (*read*) · fetched 2026-10-14
- **Our delta:** six named failures, each with the sentence that exposes it, including the forgotten write path and the never-mentioned failure.

### T00-08 · Why a reasoned wrong answer beats a memorised right one — Understand · ✅ written `docs/system-design/pages/phase-0-the-interview/08-reasoned-wrong-beats-memorised-right.md`
- **Read this:** [System Design Interview Guide](https://interviewing.io/guides/system-design-interview) · interviewing.io · how interviewers probe with follow-ups (*headings only*) · covers our angle: **partial** — describes probing, does not argue the memorised-versus-reasoned point · fetched 2026-10-14
- **Our delta:** the "what if writes are 10 times reads" follow-up used as the demonstration that a memorised diagram cannot adapt.

### T00-09 · Communication mechanics — Understand · ✅ written `docs/system-design/pages/phase-0-the-interview/09-communication-mechanics.md`
- **Read this:** [System Design in a Hurry: Delivery](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery) · Hello Interview · the framework includes drawing the design one endpoint at a time and talking through each step (*read*) · covers our angle: **partial** — pacing yes, but not numbered flows or five-minute summaries · fetched 2026-10-14
- **Our delta:** think aloud, number the flows, summarise every five minutes, ask before diving, and treat the hint as the agenda.

### T00-10 · How to practise — Understand · ✅ written `docs/system-design/pages/phase-0-the-interview/10-how-to-practise.md`
- **Read this:** [System design interview](https://www.techinterviewhandbook.org/system-design/) · Tech Interview Handbook · study plan and practice resources for the round (*headings only*) · covers our angle: **partial** — resources, but no timed drills against a rubric or written post-mortems · fetched 2026-10-14
- **Also good:** [System Design in a Hurry: Introduction](https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction) · Hello Interview · how to structure preparation (*headings only*) · fetched 2026-10-14
- **Our delta:** timed drills on the canonical questions (Part 12, not written yet), peer mocks graded against the rubric, recordings and a post-mortem per session.

### T00-11 · Whiteboard and remote tooling — Know · ✅ written `docs/system-design/pages/phase-0-the-interview/11-whiteboard-and-remote-tooling.md`
- **Read this:** [Excalidraw](https://excalidraw.com/) · Excalidraw · a free browser whiteboard that needs no account, one of the tools candidates use remotely (*headings only*) · covers our angle: **partial** — a tool, not conventions · fetched 2026-10-14
- **Also good:** [Mermaid introduction](https://mermaid.js.org/intro/) · Mermaid · diagrams written as text, a fallback when drawing is slow (*headings only*) · fetched 2026-10-14
- **Our delta:** box-and-arrow conventions, one colour for data and one for control, and what to do when the shared board lags.

### T00-12 · Primary sources behind the folklore — Know · ✅ written `docs/system-design/pages/phase-0-the-interview/12-primary-sources.md`
- **Read this:** [Dynamo: Amazon's highly available key-value store](https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html) · Werner Vogels, 2007 · the author's page for the Dynamo paper, the source of the quorum, hinted-handoff and eventual-consistency vocabulary (*headings only*) · covers our angle: **partial** — one paper, and only the pointer to it · fetched 2026-10-14
- **Also good:** [Bigtable](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/) · Google Research · the paper's own page (*headings only*) · fetched 2026-10-14
- **Also good:** [Spanner](https://research.google/pubs/spanner-googles-globally-distributed-database/) · Google Research · the paper's own page (*headings only*) · fetched 2026-10-14
- **Also good:** [In Search of an Understandable Consensus Algorithm](https://raft.github.io/raft.pdf) · Ongaro and Ousterhout · the Raft paper (*headings only*) · fetched 2026-10-14
- **Also good:** [Kafka documentation](https://kafka.apache.org/documentation/) · Apache Kafka · the design section is the readable substitute for the original Kafka paper (*headings only*) · fetched 2026-10-14
- **Also good:** [Google SRE book, contents](https://sre.google/sre-book/table-of-contents/) · Google · the chapter list from which our page picks the ones worth reading (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Designing Data-Intensive Applications](https://dataintensive.net/) · Martin Kleppmann · the book that explains most of these papers side by side (*headings only*) · fetched 2026-10-14
- **Our delta:** which chapters of each source to actually read, and why a candidate who has read Dynamo explains quorums differently.

### T00-13 · How this track relates to the rest of the bible — Know · ✅ written `docs/system-design/pages/phase-0-the-interview/13-how-this-track-relates.md`
- **Read this:** [System design interview](https://www.techinterviewhandbook.org/system-design/) · Tech Interview Handbook · a generic prep track that is not tied to any one stack (*headings only*) · covers our angle: **partial** — nothing ties examples to a running app · fetched 2026-10-14
- **Our delta:** the PERN storefront as the running example, with the Node, Java, PostgreSQL, Redis, Docker and Nginx tracks as mechanics and this track as decisions. Nothing external says this; it is a statement about our own corpus.

---

## Phase 1 — The method: requirements to deep dives

### T01-01 · Functional requirements — Master · ✅ written `docs/system-design/pages/phase-1-the-method/01-functional-requirements.md`
- **Read this:** [System Design in a Hurry: Delivery](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery) · Hello Interview · requirements come first, about 5 minutes, functional then prioritised non-functional (*read*) · covers our angle: **partial** — no explicit out-of-scope list or actor list · fetched 2026-10-14
- **Also good:** [A framework for system design interviews](https://bytebytego.com/courses/system-design-interview/a-framework-for-system-design-interviews) · ByteByteGo · clarifying questions as step one (*headings only*) · fetched 2026-10-14
- **Our delta:** three to five journeys, an explicit out-of-scope list and named actors written on the board so the interviewer can redirect before design.

### T01-02 · Non-functional requirements — Master · ✅ written `docs/system-design/pages/phase-1-the-method/02-non-functional-requirements.md`
- **Read this:** [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) · Google SRE book · SLIs such as latency, error rate and throughput, SLOs as targets on them, and percentiles preferred because an average can hide a slow tail (*read*) · covers our angle: **partial** — targets and measurement, not per-journey consistency, retention or compliance · fetched 2026-10-14
- **Also good:** [Embracing Risk](https://sre.google/sre-book/embracing-risk/) · Google SRE book · availability targets as a cost decision rather than a maximum (*headings only*) · fetched 2026-10-14
- **Our delta:** scale, p50 and p99, availability, per-journey consistency, durability, retention and compliance as a checklist where each skipped item is a question you will be asked.

### T01-03 · Back-of-the-envelope estimation — Master · ✅ written `docs/system-design/pages/phase-1-the-method/03-back-of-the-envelope-estimation.md`
- **Read this:** [Back-of-the-envelope estimation](https://bytebytego.com/courses/system-design-interview/back-of-the-envelope-estimation) · ByteByteGo, from Alex Xu's book · round numbers, powers of two as thousand, million, billion, and a worked example giving about 3,500 posts per second, a peak of about 7,000 and about 30 TB per day of media (*read*) · covers our angle: **partial** — the arithmetic is there, but not cache sizing from a hot fraction or saying aloud that you are rounding · fetched 2026-10-14
- **Also good:** [Little's law](https://en.wikipedia.org/wiki/Little%27s_law) · Wikipedia · concurrency equals arrival rate times time in system, useful for turning QPS into connections or workers (*headings only*) · fetched 2026-10-14
- **Our delta:** QPS, storage, bandwidth and cache size as four formulas, with the habit of stating the rounding.

### T01-04 · Traffic shapes — Master · ✅ written `docs/system-design/pages/phase-1-the-method/04-traffic-shapes.md`
- **Read this:** [Using load shedding to avoid overload](https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload) · Amazon Builders' Library · why a service sheds excess load at its peak rather than provisioning for every spike (*headings only*) · covers our angle: **partial** — the shedding side, not steady versus diurnal versus spike shapes · fetched 2026-10-14
- **Also good:** [Handling Overload](https://sre.google/sre-book/handling-overload/) · Google SRE book · per-client limits, criticality and graceful degradation under overload (*headings only*) · fetched 2026-10-14
- **Our delta:** the three shapes, the peak-to-average ratio, and the difference between designing for the peak and shedding at it.

### T01-05 · The API sketch — Master · ✅ written `docs/system-design/pages/phase-1-the-method/05-the-api-sketch.md`
- **Read this:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe API reference · the client generates an Idempotency-Key of up to 255 characters, the server saves the first response and replays it on retries, keys can be pruned after 24 hours, and a reused key with different parameters is an error (*read*) · covers our angle: **partial** — idempotency only, not pagination or how a wrong API leaks into later boxes · fetched 2026-10-14
- **Also good:** [AIP-158: Pagination](https://aip.dev/158) · Google API Improvement Proposals · page tokens and page size for any list method (*headings only*) · fetched 2026-10-14
- **Also good:** [API Design Guide](https://cloud.google.com/apis/design) · Google Cloud · resource-oriented design and standard methods (*headings only*) · fetched 2026-10-14
- **Our delta:** one endpoint per journey, idempotency on anything that charges or creates, pagination on anything that lists, and the cost of a wrong API downstream.

### T01-06 · The data model from the access patterns — Master · ✅ written `docs/system-design/pages/phase-1-the-method/06-the-data-model-from-access-patterns.md`
- **Read this:** [System Design in a Hurry: Delivery](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery) · Hello Interview · lists core entities as an early step before the API and design (*read*) · covers our angle: **partial** — entities first, not access patterns first or choosing the store from them · fetched 2026-10-14
- **Also good:** [Designing Data-Intensive Applications](https://dataintensive.net/) · Martin Kleppmann · the chapters on data models and storage engines tie the model to how it is queried (*headings only*) · fetched 2026-10-14
- **Our delta:** keys and relationships written after listing how each journey reads and writes, so the primary store comes from the patterns and not from habit.

### T01-07 · The high-level diagram — Master · ✅ written `docs/system-design/pages/phase-1-the-method/07-the-high-level-diagram.md`
- **Read this:** [System Design in a Hurry: Delivery](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery) · Hello Interview · high-level design takes 10 to 15 minutes, built one endpoint at a time (*read*) · covers our angle: **partial** — no numbered flows or fixed box vocabulary · fetched 2026-10-14
- **Also good:** [C4 model](https://c4model.com/) · Simon Brown · zoom from context to containers to components (*headings only*) · fetched 2026-10-14
- **Our delta:** client, edge, gateway, services, stores and workers, numbered flows, one diagram first and then one zoom.

### T01-08 · Read path and write path, separately — Master · ✅ written `docs/system-design/pages/phase-1-the-method/08-read-path-and-write-path.md`
- **Read this:** [Eventually Consistent](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html) · Werner Vogels · why the read and write sides of a distributed store make different promises (*headings only*) · covers our angle: **partial** — consistency models, not caches and fan-out versus durability and ordering · fetched 2026-10-14
- **Also good:** [Designing Data-Intensive Applications](https://dataintensive.net/) · Martin Kleppmann · replication and derived data cover the two paths in depth (*headings only*) · fetched 2026-10-14
- **Our delta:** the walk of "the user taps Buy" end to end, box by box, with the read side and write side kept apart.

### T01-09 · Choosing the deep dives — Master · ✅ written `docs/system-design/pages/phase-1-the-method/09-choosing-the-deep-dives.md`
- **Read this:** [System Design in a Hurry: Delivery](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery) · Hello Interview · deep dives take about 10 minutes and harden the design against non-functional requirements, edge cases and bottlenecks (*read*) · covers our angle: **partial** — what a deep dive is, not how to choose one · fetched 2026-10-14
- **Our delta:** three selection tests: hardest scale, where the interviewer keeps returning, and what you can defend under three follow-ups.

### T01-10 · Trade-offs in one sentence — Master · ✅ written `docs/system-design/pages/phase-1-the-method/10-trade-offs-in-one-sentence.md`
- **Read this:** [PACELC theorem](https://en.wikipedia.org/wiki/PACELC_theorem) · Wikipedia · the trade-off framed as two-part: partition then availability or consistency, else latency or consistency (*headings only*) · covers our angle: **partial** — one trade-off pair, not the sentence template · fetched 2026-10-14
- **Also good:** [Please stop calling databases CP or AP](https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html) · Martin Kleppmann · advises reasoning about specific operations and consistency models rather than labels (*read*) · fetched 2026-10-14
- **Our delta:** "we chose X over Y because Z, and we pay for it with W", said unprompted.

### T01-11 · Bottlenecks and single points of failure — Master · ✅ written `docs/system-design/pages/phase-1-the-method/11-bottlenecks-and-single-points-of-failure.md`
- **Read this:** [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) · Google SRE book · how one overloaded component pushes load onto the rest and takes them down (*headings only*) · covers our angle: **partial** — failure propagation, not the SPOF checklist · fetched 2026-10-14
- **Also good:** [Static stability using Availability Zones](https://builder.aws.com/content/3K9SiqiJ369TGkkGzqPM95BuYWI/static-stability-using-availability-zones) · Amazon Builders' Library · keeping a system working when a zone or dependency fails (*headings only*) · fetched 2026-10-14
- **Our delta:** the walk "what if this box dies, what if this number doubles", with the five-item SPOF checklist of DNS, balancer, primary database, the one queue and the one region.

### T01-12 · The scaling walk — Understand · ✅ written `docs/system-design/pages/phase-1-the-method/12-the-scaling-walk.md`
- **Read this:** [Scale from zero to millions of users](https://bytebytego.com/courses/system-design-interview/scale-from-zero-to-millions-of-users) · ByteByteGo, from Alex Xu's book · builds one server up through balancer, replication, cache, CDN, stateless tier and sharding in sequence (*headings only*) · covers our angle: **partial** — the sequence is there, the symptom that forces each step is less central · fetched 2026-10-14
- **Also good:** [The Twelve-Factor App](https://12factor.net/) · Heroku · stateless processes as what makes horizontal scaling possible (*headings only*) · fetched 2026-10-14
- **Our delta:** each step paired with the symptom that forces it, presented as a sequence and not started at the end.

### T01-13 · Designing for cost — Understand · ✅ written `docs/system-design/pages/phase-1-the-method/13-designing-for-cost.md`
- **Read this:** [Cost optimization pillar](https://docs.aws.amazon.com/wellarchitected/latest/framework/cost-optimization.html) · AWS Well-Architected Framework · the cost principles and design questions for a workload (*headings only*) · covers our angle: **partial** — a vendor framework, not the egress, NAT and cross-zone items or answering without a price list · fetched 2026-10-14
- **Also good:** [Google Cloud Architecture Framework](https://docs.cloud.google.com/architecture/framework) · Google Cloud · the cost optimisation pillar alongside the others (*headings only*) · fetched 2026-10-14
- **Our delta:** where the money actually goes (egress, NAT, cross-zone, storage tiers, over-provisioned databases) and how to answer "what does this cost" without prices.

### T01-14 · Evolution and operations — Understand · ✅ written `docs/system-design/pages/phase-1-the-method/14-evolution-and-operations.md`
- **Read this:** [Monolith First](https://martinfowler.com/bliki/MonolithFirst.html) · Martin Fowler · start simple because boundaries are hard to find early and microservices carry a premium that slows learning (*read*) · covers our angle: **partial** — week one versus year one for architecture only, not deployment, monitoring or migration · fetched 2026-10-14
- **Also good:** [Strangler Fig Application](https://martinfowler.com/bliki/StranglerFigApplication.html) · Martin Fowler · replacing a system gradually behind the old one (*headings only*) · fetched 2026-10-14
- **Also good:** [Yagni](https://martinfowler.com/bliki/Yagni.html) · Martin Fowler · the argument for deliberately not building a feature yet (*headings only*) · fetched 2026-10-14
- **Our delta:** what to build in week one versus year one, how it is deployed, monitored and migrated, and what you choose not to build yet.

### T01-15 · Time management in 45 minutes — Understand · ✅ written `docs/system-design/pages/phase-1-the-method/15-time-management.md`
- **Read this:** [System Design in a Hurry: Delivery](https://www.hellointerview.com/learn/system-design/in-a-hurry/delivery) · Hello Interview · the time boxes: requirements 5, entities 2, API 5, optional data flow 5, high-level design 10 to 15, deep dives about 10 (*read*) · covers our angle: **partial** — a similar split, but no wrap-up slot and nothing on what to drop when behind · fetched 2026-10-14
- **Our delta:** 5 for requirements, 10 for estimation and API, 15 for the high-level design, 10 for deep dives, 5 for wrap-up, plus what to drop and when to stop talking.

### T01-16 · Estimation worked examples — Understand · ✅ written `docs/system-design/pages/phase-1-the-method/16-estimation-worked-examples.md`
- **Read this:** [Back-of-the-envelope estimation](https://bytebytego.com/courses/system-design-interview/back-of-the-envelope-estimation) · ByteByteGo · a worked social-feed example from monthly users to QPS, peak and five-year media storage (*read*) · covers our angle: **partial** — one example, none for checkout, chat storage, CDN egress or fan-out · fetched 2026-10-14
- **Also good:** [Latency numbers every programmer should know](https://gist.github.com/jboner/2841832) · Jonas Boner · the constants an estimate leans on (*read*) · fetched 2026-10-14
- **Our delta:** four rehearsed cases, the storefront's sale-day checkout, a year of chat storage, video CDN egress and notification fan-out.

### T01-17 · The same method in writing — Understand · ✅ written `docs/system-design/pages/phase-1-the-method/17-the-same-method-in-writing.md`
- **Read this:** [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/) · Malte Ubl · recommended sections are context and scope, goals and non-goals, the design, alternatives considered and cross-cutting concerns; a non-goal is something that could reasonably be a goal but is excluded (*read*) · covers our angle: **full** — matches our context, goals, options, decision and risks shape except for an explicit rollout section · fetched 2026-10-14
- **Also good:** [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) · Michael Nygard · an ADR has title, context, decision, status and consequences, kept short so it is read (*read*) · fetched 2026-10-14
- **Also good:** [Architectural Decision Records](https://adr.github.io/) · ADR GitHub organisation · templates and tooling for ADRs (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [RFCs and Design Docs](https://blog.pragmaticengineer.com/rfcs-and-design-docs/) · Gergely Orosz, The Pragmatic Engineer · how large engineering organisations actually run the process (*headings only*) · fetched 2026-10-14
- **Our delta:** the whiteboard method shown as the compressed version of the written one, with ADRs as the durable form.

### T01-18 · Diagrams that scale with the conversation — Know · ✅ written `docs/system-design/pages/phase-1-the-method/18-diagrams-that-scale.md`
- **Read this:** [C4 abstractions](https://c4model.com/abstractions) · Simon Brown · the four levels: software system, container, component, code (*read*) · covers our angle: **partial** — the levels, not when a sequence diagram beats boxes · fetched 2026-10-14
- **Also good:** [Mermaid introduction](https://mermaid.js.org/intro/) · Mermaid · text-based diagrams that live in the repository (*headings only*) · fetched 2026-10-14
- **Also good:** [Structurizr](https://structurizr.com/) · Simon Brown · diagrams-as-code for the C4 model (*headings only*) · fetched 2026-10-14
- **Also good:** [PlantUML](https://plantuml.com/) · PlantUML · sequence and component diagrams from text (*headings only*) · fetched 2026-10-14
- **Our delta:** context to containers to components as the zoom you do as the conversation deepens, when a sequence diagram beats boxes, and diagrams-as-code for the written version.
