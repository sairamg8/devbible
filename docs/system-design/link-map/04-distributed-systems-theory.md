---
title: "Link map · System design · Part 4 (phases 6–7)"
sidebar_label: "04 · distributed theory"
sidebar_position: 4
---

# Link map · System design · Part 4 (phases 6–7)

Covers every topic row of phases 6 and 7 in `docs/system-design/syllabus/04-distributed-systems-theory.md`: consistency, clocks and consensus (T06-01 to T06-18) and distributed transactions, IDs and the probabilistic toolkit (T07-01 to T07-17). That is 35 rows. Two have a written page of ours (retries and distributed counters, both in phase 2); `docs/system-design/pages` holds phases 0 to 3 only, so the rest are marked not written and their delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title or headings checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means specifications, papers, vendor and project documentation and Wikipedia articles that cite the papers; blogs count as beyond the docs.

---

## Phase 6 — Consistency, clocks and consensus

### T06-01 · The fallacies of distributed computing — Master · 🔲 not written
- **Read this:** [Fallacies of distributed computing](https://en.wikipedia.org/wiki/Fallacies_of_distributed_computing) · Wikipedia · the eight assertions L Peter Deutsch and others at Sun Microsystems described: the network is reliable, latency is zero, bandwidth is infinite, the network is secure, topology does not change, there is one administrator, transport cost is zero, the network is homogeneous (*read*) · covers our angle: **partial** — the list and history, but no bug-you-already-shipped framing · fetched 2026-10-14
- **Beyond the docs:** [Distributed systems theory for the distributed systems engineer](https://www.the-paper-trail.org/post/2014-08-09-distributed-systems-theory-for-the-distributed-systems-engineer/) · Henry Robinson, the-paper-trail · a reading list that opens its foundational section with the eight fallacies, then the papers that follow from them (*read*) · fetched 2026-10-14
- **Our delta:** each fallacy read as a bug already shipped in the storefront, not as a list to recite.

### T06-02 · CAP as used vs CAP as written — Master · 🔲 not written
- **Read this:** [CAP theorem](https://en.wikipedia.org/wiki/CAP_theorem) · Wikipedia · defines the three properties, says that without a partition both consistency and availability can be had, cites Gilbert and Lynch's 2002 proof and introduces PACELC (*read*) · covers our angle: **partial** — the statement, not the per-journey choice · fetched 2026-10-14
- **Also good:** [PACELC design principle](https://en.wikipedia.org/wiki/PACELC_design_principle) · Wikipedia · else (no partition), the choice is between latency and consistency (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Please stop calling databases CP or AP](https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html) · Martin Kleppmann, 11 May 2015 · argues for more precise terms than CP and AP, showing many systems are neither linearizable nor CAP-available, which is the "as used vs as written" gap (*read*) · fetched 2026-10-14
- **Our delta:** per-journey choice under a partition, and why PACELC is the model to quote in an interview.

### T06-03 · Consistency models — Master · 🔲 not written
- **Read this:** [Consistency Models](https://jepsen.io/consistency/models) · Jepsen · the clickable map: linearizable implies sequential implies causal, which implies PRAM and so monotonic reads, monotonic writes and read your writes, coloured by how available each model can be (*read*) · covers our angle: **partial** — a precise hierarchy, no per-user-journey guidance · fetched 2026-10-14
- **Also good:** [Eventually Consistent](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html) · Werner Vogels · defines causal, read-your-writes and the other client-side guarantees (*read*) · covers our angle: **partial** — session guarantees, not linearizable or sequential · fetched 2026-10-14
- **Beyond the docs:** [Highly Available Transactions: Virtues and Limitations](https://www.bailis.org/papers/hat-vldb2014.pdf) · Bailis et al., VLDB 2014 · which isolation and session guarantees are achievable with high availability and which are not (*read*) · fetched 2026-10-14
- **Our delta:** pick the model per user journey (checkout, order history, profile) rather than per system.

### T06-04 · Time in a distributed system — Master · 🔲 not written
- **Read this:** [Time, Clocks, and the Ordering of Events in a Distributed System](https://lamport.azurewebsites.net/pubs/time-clocks.pdf) · Leslie Lamport · defines "happened before" as a partial ordering and logical clocks, then specialises the algorithm to synchronising physical clocks that drift (*read*) · covers our angle: **partial** — no NTP, hybrid or bounded-uncertainty clocks · fetched 2026-10-14
- **Also good:** [Vector clock](https://en.wikipedia.org/wiki/Vector_clock) · Wikipedia · determines the partial ordering of events and detects causality violations (*read*) · fetched 2026-10-14
- **Also good:** [Logical Physical Clocks and Consistent Snapshots](https://cse.buffalo.edu/tech-reports/2014-04.pdf) · Kulkarni et al. · proposes HLC, a hybrid logical clock that stays close to the NTP clock (*read*) · fetched 2026-10-14
- **Also good:** [TrueTime and external consistency](https://docs.cloud.google.com/spanner/docs/true-time-external-consistency) · Google Cloud · bounded-uncertainty clocks in production (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Living without atomic clocks](https://www.cockroachlabs.com/blog/living-without-atomic-clocks/) · Cockroach Labs · TrueTime bounds clock offset at about 7 ms against 100 to 250 ms for NTP, and the "wait out the uncertainty" idea works without atomic clocks (*read*) · fetched 2026-10-14
- **Our delta:** why timestamps cannot order events across machines, then the four fixes in order of cost.

### T06-05 · Raft in detail — Master · 🔲 not written
- **Read this:** [In Search of an Understandable Consensus Algorithm](https://raft.github.io/raft.pdf) · Ongaro and Ousterhout · the Raft paper: leader election, log replication, safety and membership changes using overlapping majorities (*read*) · covers our angle: **partial** — the algorithm, not etcd, Consul or the Kafka controller as deployments · fetched 2026-10-14
- **Also good:** [Raft Consensus Algorithm](https://raft.github.io/) · raft.github.io · the visualisation and the list of implementations (*read*) · fetched 2026-10-14
- **Also good:** [KRaft](https://kafka.apache.org/43/operations/kraft/) · Apache Kafka 4.3 · servers selected as controllers form the metadata quorum, one active and the rest hot standby (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Raft: Understandable Distributed Consensus](http://thesecretlivesofdata.com/raft/) · thesecretlivesofdata · step-by-step animation of election and replication (*headings only*) · fetched 2026-10-14
- **Our delta:** the commit index and membership change told through etcd, Consul and Kafka rather than the paper alone.

### T06-06 · Quorums and majorities — Master · 🔲 not written
- **Read this:** [etcd FAQ](https://etcd.io/docs/v3.6/faq/) · etcd · quorum is (n/2)+1; the cluster-size, majority and failure-tolerance table shows 4 tolerates one failure like 3, and an odd size guarantees a majority side in a partition (*read*) · covers our angle: **partial** — sizing, not quorum intersection as the proof · fetched 2026-10-14
- **Also good:** [Quorum (distributed computing)](https://en.wikipedia.org/wiki/Quorum_(distributed_computing)) · Wikipedia · vote-based read and write quorums and the rules that make a read quorum contain the newest version (*read*) · fetched 2026-10-14
- **Our delta:** why 3 or 5 and never 4, and what losing the majority actually stops.

### T06-07 · Leases and fencing tokens — Master · 🔲 not written
- **Read this:** [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) · Martin Kleppmann, 8 Feb 2016 · says a fencing token is a number that increases every time a client acquires the lock and must be sent with every write to the storage service, which rejects older ones (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Leases and the Kubernetes Lease API](https://kubernetes.io/docs/concepts/architecture/leases/) · Kubernetes · leases for node heartbeats and leader election (*read*) · fetched 2026-10-14
- **Our delta:** the paused-process story with the two-line fix, checked at the resource.

### T06-08 · Distributed locks — Master · 🔲 not written
- **Read this:** [Distributed Locks with Redis](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) · Redis · the Redlock algorithm, framed by safety and liveness guarantees (*read*) · covers our angle: **partial** — the algorithm, not the unique-constraint alternative · fetched 2026-10-14
- **Beyond the docs:** [Is Redlock safe?](https://antirez.com/news/101) · Salvatore Sanfilippo · the reply to Kleppmann; it quotes the fencing-token passage, argues a store that can check tokens could use Redlock's random token for check-and-set, and agrees to move Redis to the monotonic time API (*read*) · fetched 2026-10-14
- **Also good:** [Explicit Locking, advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html) · PostgreSQL · application-controlled locks in the database you already run (*read*) · fetched 2026-10-14
- **Also good:** [ZooKeeper recipes](https://zookeeper.apache.org/doc/current/recipes.html) · Apache ZooKeeper · lock, shared-lock and leader-election recipes built on sequential ephemeral nodes (*read*) · fetched 2026-10-14
- **Our delta:** the many cases where a unique constraint or idempotency removes the lock, ending with why checkout needs none.

### T06-09 · Idempotency — Master · 🔲 not written
- **Read this:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe · an idempotency key lets you safely repeat a request after a connection error without creating a second object (*read*) · covers our angle: **partial** — the key contract, not dedupe tables or the exactly-once argument · fetched 2026-10-14
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach · atomic phases and recovery points around a key, in Postgres (*read*) · fetched 2026-10-14
- **Our delta:** exactly-once delivery stated as at-least-once plus idempotent handling, with the double charge as the story.

### T06-10 · Retries, backoff, jitter and deadlines — Master · ✅ written `docs/system-design/pages/phase-2-request-path/08-timeouts-retries-and-budgets.md`
- **Read this:** [Exponential Backoff And Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/) · AWS Architecture Blog · compares Full, Equal and Decorrelated Jitter against un-jittered backoff, and finds Equal Jitter the loser (*read*) · covers our angle: **partial** — jitter only, no budgets or deadlines · fetched 2026-10-14
- **Also good:** [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) · Amazon Builders' Library · the fuller treatment, including limiting retries locally with a token bucket (*read*) · fetched 2026-10-14
- **Also good:** [Deadlines](https://grpc.io/docs/guides/deadlines/) · gRPC · has a Deadline Propagation section for deadlines carried across hops (*read*) · fetched 2026-10-14
- **Our delta:** the page already covers deadline propagation, jitter, retry budgets, the idempotency check and the slow dependency that became an outage; this phase only ties retries back to idempotency (T06-09).

### T06-11 · Happens-before and ordering — Understand · 🔲 not written
- **Read this:** [Happened-before](https://en.wikipedia.org/wiki/Happened-before) · Wikipedia · the least strict partial order on events, formulated by Lamport (*read*) · covers our angle: **partial** — causal order, not total order or ordering keys · fetched 2026-10-14
- **Also good:** [Lamport timestamp](https://en.wikipedia.org/wiki/Lamport_timestamp) · Wikipedia · a total order built by breaking ties arbitrarily, for example by process ID, with the caveat that the order is artificial (*read*) · fetched 2026-10-14
- **Our delta:** why a total order needs a coordinator or one partition, and the ordering key as the partial order you can afford.

### T06-12 · Consensus, the problem — Understand · 🔲 not written
- **Read this:** [Impossibility of Distributed Consensus with One Faulty Process](https://groups.csail.mit.edu/tds/papers/Lynch/jacm85.pdf) · Fischer, Lynch and Paterson · every protocol has the possibility of nontermination with only one faulty process in an asynchronous system (*read*) · covers our angle: **partial** — the impossibility, not the reductions · fetched 2026-10-14
- **Also good:** [Consensus (computer science)](https://en.wikipedia.org/wiki/Consensus_(computer_science)) · Wikipedia · problem statement, the FLP result for asynchronous deterministic consensus and the equivalence of agreement problems (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [A Brief Tour of FLP Impossibility](https://www.the-paper-trail.org/post/2008-08-13-a-brief-tour-of-flp-impossibility/) · Henry Robinson, the-paper-trail · walks through the notation, bivalent configurations and the paper's two main lemmas (*read*) · fetched 2026-10-14
- **Our delta:** what FLP actually forbids, and why election, configuration and locks all reduce to consensus.

### T06-13 · Failure detection — Understand · 🔲 not written
- **Read this:** [Failure detector](https://en.wikipedia.org/wiki/Failure_detector) · Wikipedia · classes failure detectors by completeness and accuracy (*read*) · covers our angle: **partial** — theory only, no heartbeats, timeouts or phi-accrual · fetched 2026-10-14
- **Also good:** [Dynamo, Cassandra architecture](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) · Apache Cassandra · liveness shared by gossip, each node bumping its heartbeat version every second, judged by a Phi Accrual Failure Detector (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Gray Failures](https://www.the-paper-trail.org/post/2020-04-19-gray-failures/) · Henry Robinson, 18 Apr 2020 · on the HotOS 2017 gray-failure paper: the gap between what failure detectors see and what clients see, such as a stuck request thread behind a healthy heartbeat thread (*read*) · fetched 2026-10-14
- **Our delta:** the slow node that cannot be told from the dead one, and gray failures.

### T06-14 · CRDTs and conflict resolution — Understand · 🔲 not written
- **Read this:** [Conflict-free replicated data type](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type) · Wikipedia · replicas may differ at a point in time but are guaranteed to eventually converge; formally defined in 2011, motivated by collaborative editing (*read*) · covers our angle: **partial** — describes the LWW-Element-Set, not what last-writer-wins silently drops · fetched 2026-10-14
- **Also good:** [CRDT.tech](https://crdt.tech/) · crdt.tech · what a CRDT is, with examples from sync apps to collaboration software, plus papers and implementations (*read*) · fetched 2026-10-14
- **Our delta:** what last-writer-wins silently drops, and the hand-off to collaborative editing in Part 12 (not written yet).

### T06-15 · Paxos and ZAB — Know · 🔲 not written
- **Read this:** [Paxos Made Simple](https://lamport.azurewebsites.net/pubs/paxos-simple.pdf) · Leslie Lamport · opens with "The Paxos algorithm, when presented in plain English, is very simple" (*read*) · covers our angle: **partial** — Paxos only, no ZAB · fetched 2026-10-14
- **Also good:** [ZooKeeper Internals](https://zookeeper.apache.org/doc/current/zookeeperInternals.html) · Apache ZooKeeper · the atomic broadcast at ZooKeeper's core (the protocol known as Zab): guarantees, leader activation, active messaging, quorums (*read*) · fetched 2026-10-14
- **Also good:** [Paxos (computer science)](https://en.wikipedia.org/wiki/Paxos_(computer_science)) · Wikipedia · roles and variants, with failure walk-throughs of basic Paxos (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Paxos vs Raft: Have we reached consensus on distributed consensus?](https://arxiv.org/abs/2004.05074) · Heidi Howard and Richard Mortier, 2020 · describes a simplified Paxos in Raft's terms to show exactly how the two differ (*read*, abstract) · fetched 2026-10-14
- **Our delta:** why Raft won on understandability and where ZooKeeper still runs.

### T06-16 · Gossip protocols — Know · 🔲 not written
- **Read this:** [Gossip protocol](https://en.wikipedia.org/wiki/Gossip_protocol) · Wikipedia · a procedure of peer-to-peer communication based on the way epidemics spread (*read*) · covers our angle: **partial** — general, no Cassandra detail · fetched 2026-10-14
- **Also good:** [Dynamo, Cassandra architecture](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) · Apache Cassandra · every second each node gossips with a random peer, probabilistically with unreachable nodes and with a seed, carrying versioned membership state (*read*) · fetched 2026-10-14
- **Our delta:** membership and failure news spreading with no coordinator.

### T06-17 · Byzantine vs crash faults — Know · 🔲 not written
- **Read this:** [Byzantine fault](https://en.wikipedia.org/wiki/Byzantine_fault) · Wikipedia · contrasts fail-stop with Byzantine failures, where a failed node can produce arbitrary data (*read*) · covers our angle: **partial** — lists applications, including blockchains and their caveat, but not why your services do not need it · fetched 2026-10-14
- **Also good:** [The Byzantine Generals Problem](https://lamport.azurewebsites.net/pubs/byz.pdf) · Lamport, Shostak and Pease · the original paper (*headings only*) · fetched 2026-10-14
- **Our delta:** why almost nothing tolerates lying nodes, and the few places that must.

### T06-18 · The end-to-end argument — Know · 🔲 not written
- **Read this:** [End-to-End Arguments in System Design](https://web.mit.edu/Saltzer/www/publications/endtoend/endtoend.pdf) · Saltzer, Reed and Clark · the original argument; its oldest form is the delivery acknowledgement a network can return without the application knowing the message was acted on (*read*) · covers our angle: **full** for the principle · fetched 2026-10-14
- **Our delta:** tied to the application-level acknowledgement a reliable transport still needs.

---

## Phase 7 — Distributed transactions, IDs and the probabilistic toolkit

### T07-01 · Two-phase commit — Master · 🔲 not written
- **Read this:** [Two-phase commit protocol](https://en.wikipedia.org/wiki/Two-phase_commit_protocol) · Wikipedia · calls it a blocking protocol: if the coordinator fails permanently, some participants never resolve their transactions (*read*) · covers our angle: **partial** — no cloud-native alternatives · fetched 2026-10-14
- **Also good:** [X/Open XA](https://en.wikipedia.org/wiki/X/Open_XA) · Wikipedia · XA uses 2PC across databases, queues and application servers, and inherits its blocking (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Consensus protocols: two-phase commit](https://www.the-paper-trail.org/post/2008-11-27-consensus-protocols-two-phase-commit/) · Henry Robinson · walks every protocol state and what happens if the coordinator or a participant crashes in it (*read*) · fetched 2026-10-14
- **Our delta:** the participant blocked forever, and why cloud-native systems avoid XA.

### T07-02 · Sagas — Master · 🔲 not written
- **Read this:** [Pattern: Saga](https://microservices.io/patterns/data/saga.html) · microservices.io · a saga runs compensating transactions when a local one fails, coordinated by choreography or orchestration (*read*) · covers our angle: **partial** — no checkout walk-through · fetched 2026-10-14
- **Also good:** [Saga design pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) · Microsoft Azure Architecture Center · compensable, pivot and retryable transactions, and the data anomalies sagas allow (*read*) · fetched 2026-10-14
- **Our delta:** the storefront checkout saga step by step with each compensation.

### T07-03 · Compensation design — Master · 🔲 not written
- **Read this:** [Compensating Transaction pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/compensating-transaction) · Microsoft Azure Architecture Center · undoing completed steps of an eventually consistent operation, where you cannot simply roll the data back (*read*) · covers our angle: **partial** — no pivot step · fetched 2026-10-14
- **Also good:** [Saga design pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) · Microsoft Azure Architecture Center · the pivot transaction as the point of no return, compensable steps before it and idempotent retryable steps after it (*read*) · fetched 2026-10-14
- **Also good:** [Life beyond distributed transactions](https://ics.uci.edu/~cs223/papers/cidr07p15.pdf) · Pat Helland · why entities and messages replace distributed transactions (*headings only*) · fetched 2026-10-14
- **Our delta:** pivot step, retryable versus compensatable, and the compensation that itself fails.

### T07-04 · The outbox pattern — Master · 🔲 not written
- **Read this:** [Pattern: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) · microservices.io · the dual-write problem, why 2PC across database and broker is not viable, and the outbox table with its relay (*headings only*) · covers our angle: **partial** — no Node implementation · fetched 2026-10-14
- **Also good:** [Reliable Microservices Data Exchange With the Outbox Pattern](https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/) · Debezium · relaying the outbox from the database log (*headings only*) · fetched 2026-10-14
- **Our delta:** publish-once-in-effect, with pointers to Node's background-work phase and the storefront services.

### T07-05 · The inbox pattern and idempotent consumers — Master · 🔲 not written
- **Read this:** [Pattern: Idempotent Consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html) · microservices.io · at-least-once brokers deliver duplicates, so the consumer must dedupe (*read*) · covers our angle: **partial** — no ordering caveat · fetched 2026-10-14
- **Our delta:** the processed-messages table and the out-of-order same-key caveat.

### T07-06 · Distributed ID generation — Master · 🔲 not written
- **Read this:** [RFC 9562, Universally Unique IDentifiers](https://www.rfc-editor.org/rfc/rfc9562.html) · IETF · defines the time-ordered UUIDv7 alongside v4, and notes that non-time-ordered UUIDs have poor database-index locality (*read*) · covers our angle: **partial** — UUIDs only · fetched 2026-10-14
- **Also good:** [Snowflake ID](https://en.wikipedia.org/wiki/Snowflake_ID) · Wikipedia · 64 bits: 41 of millisecond timestamp, 10 of machine ID, then a sequence (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Ticket Servers](https://code.flickr.net/2010/02/08/ticket-servers-distributed-unique-primary-keys-on-the-cheap/) · Flickr Engineering, 8 Feb 2010 · centralised auto-increments on MySQL REPLACE INTO (*read*) · fetched 2026-10-14
- **Our delta:** index locality, and why random keys bloat a B-tree.

### T07-07 · Bloom and cuckoo filters — Master · 🔲 not written
- **Read this:** [Bloom filter](https://en.wikipedia.org/wiki/Bloom_filter) · Wikipedia · false-positive probability, optimal hash count, cache filtering of one-hit-wonders, and Bigtable, HBase and Cassandra cutting disk lookups (*read*) · covers our angle: **partial** — no cuckoo · fetched 2026-10-14
- **Also good:** [Cuckoo Filter: Practically Better Than Bloom](https://www.cs.cmu.edu/~binfan/papers/conext14_cuckoofilter.pdf) · Fan et al. · supports deletion, which Bloom filters do not, at lower space for low false-positive rates (*read*) · fetched 2026-10-14
- **Our delta:** sizing from the false-positive rate, and where filters sit in front of caches and inside LSM engines.

### T07-08 · Exactly-once end to end in the storefront — Master · 🔲 not written
- **Read this:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe · the API-edge layer of the chain (*read*) · covers our angle: **partial** — one of three layers · fetched 2026-10-14
- **Also good:** [Pattern: Idempotent Consumer](https://microservices.io/patterns/communication-style/idempotent-consumer.html) · microservices.io · the consumer-side layer (*read*) · fetched 2026-10-14
- **Our delta:** the idempotency key, outbox and inbox placed in one order flow, naming where each duplicate stops.

### T07-09 · TCC, try, confirm, cancel — Understand · 🔲 not written
- **Read this:** [TCC Mode](https://seata.apache.org/docs/user/mode/tcc/) · Apache Seata · Try checks and reserves resources, Confirm commits, Cancel releases the reservation; an intrusive mode every participant must implement (*read*) · covers our angle: **partial** — one framework, no saga comparison · fetched 2026-10-14
- **Also good:** [Atomic Distributed Transactions: a RESTful Design](https://archives.iw3c2.org/www2014/proceedings/companion/p943.pdf) · Pardon and Pautasso, WWW 2014 companion · TCC across RESTful services, with flight reservations as the example (*read*) · fetched 2026-10-14
- **Also good:** [Life beyond distributed transactions](https://ics.uci.edu/~cs223/papers/cidr07p15.pdf) · Pat Helland · the section on tentative operations, confirmation and cancellation, the idea behind TCC (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Introduction to TCC Theory and Design Implementation Guide](https://seata.apache.org/blog/tcc-mode-design-principle/) · zhangthen, Seata blog, 26 Mar 2019 · freezing funds in Try, empty rollback when Cancel arrives before Try, and refusing the late Try (*read*) · fetched 2026-10-14
- **Our delta:** reservations as the try phase, when it beats a saga and what it demands of every participant.

### T07-10 · Distributed counters and rate limits — Understand · ✅ written `docs/system-design/pages/phase-2-request-path/07-rate-limiting.md`
- **Read this:** [How we built rate limiting capable of scaling to millions of domains](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/) · Cloudflare, 7 Jun 2017 · a sliding-window approximation from two counters on memcache (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [INCR](https://redis.io/docs/latest/commands/incr/) · Redis · atomic increments, with counter and rate-limiter patterns (*read*) · fetched 2026-10-14
- **Also good:** [Distributed counters](https://firebase.google.com/docs/firestore/solutions/counters) · Firebase · a counter as a set of shards summed on read, write throughput rising with shard count (*read*) · fetched 2026-10-14
- **Our delta:** the page covers the atomic Redis counter with expiry and the approximate sliding counter; this phase adds sharded counters.

### T07-11 · HyperLogLog, count-min sketch and top-k — Understand · 🔲 not written
- **Read this:** [HyperLogLog](https://redis.io/docs/latest/develop/data-types/probabilistic/hyperloglogs/) · Redis · up to 12 KB of memory with a standard error of 0.81% (*read*) · covers our angle: **partial** — cardinality only · fetched 2026-10-14
- **Also good:** [Count-min sketch](https://redis.io/docs/latest/develop/data-types/probabilistic/count-min-sketch/) · Redis · estimates the frequency of an element in a stream (*read*) · fetched 2026-10-14
- **Also good:** [Top-K](https://redis.io/docs/latest/develop/data-types/probabilistic/top-k/) · Redis · finds the most frequent items in a stream, with sizing guidance (*read*) · fetched 2026-10-14
- **Our delta:** unique visitors, trending products and heavy hitters as one family.

### T07-12 · Geospatial indexing — Understand · 🔲 not written
- **Read this:** [Geohash](https://en.wikipedia.org/wiki/Geohash) · Wikipedia · hierarchical cell encoding, with an edge-cases section on close points that share no prefix across the equator or a meridian (*read*) · covers our angle: **partial** — the boundary problem, not the fix · fetched 2026-10-14
- **Also good:** [S2 Geometry](https://s2geometry.io/) · Google · data on a sphere, regions approximated as collections of discrete cells for spatial indexing (*read*) · fetched 2026-10-14
- **Also good:** [ST_DWithin](https://postgis.net/docs/ST_DWithin.html) · PostGIS · distance test that uses any available spatial index, the boring relational answer (*read*) · fetched 2026-10-14
- **Our delta:** the cell-boundary problem and the spatial extension as the default.

### T07-13 · Distributed scheduling — Understand · 🔲 not written
- **Read this:** [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) · Kubernetes · suspended executions count as missed jobs, startingDeadlineSeconds bounds a late start, and more than 100 missed schedules stops the job (*read*) · covers our angle: **partial** — one scheduler's missed-run policy · fetched 2026-10-14
- **Our delta:** leader-elected cron, a job store and at-least-once with idempotent jobs.

### T07-14 · Leader election in practice — Understand · 🔲 not written
- **Read this:** [Leases](https://kubernetes.io/docs/concepts/architecture/leases/) · Kubernetes · the Lease API used for component leader election (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Coordinated leader election](https://kubernetes.io/docs/concepts/cluster-administration/coordinated-leader-election/) · Kubernetes · the newer mechanism, beta behind the CoordinatedLeaderElection feature gate (*read*) · fetched 2026-10-14
- **Also good:** [Leader election in distributed systems](https://builder.aws.com/content/3Ev0vH0hfkcUizISUWYTvHibtcp/leader-election-in-distributed-systems) · Amazon Builders' Library · leases as the most used mechanism at Amazon, relying on local elapsed time rather than synchronised clocks (*read*) · fetched 2026-10-14
- **Our delta:** the split-brain drill to run before trusting any of them.

### T07-15 · Change data capture as a primitive — Understand · 🔲 not written
- **Read this:** [Debezium architecture](https://debezium.io/documentation/reference/stable/architecture.html) · Debezium · source connectors on Kafka Connect, or Debezium Server, streaming change events from the database (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** feeding caches, search and the warehouse without dual writes; detailed in Part 5 (not written yet).

### T07-16 · Durable execution and workflow engines — Know · 🔲 not written
- **Read this:** [Workflow Execution overview](https://docs.temporal.io/workflow-execution) · Temporal · replay checks commands against the Event History so execution resumes after a failure; commands and awaitables (*read*) · covers our angle: **partial** — no operating cost · fetched 2026-10-14
- **Our delta:** when it replaces a hand-written saga and what it costs to run.

### T07-17 · Three-phase commit — Know · 🔲 not written
- **Read this:** [Three-phase commit protocol](https://en.wikipedia.org/wiki/Three-phase_commit_protocol) · Wikipedia · stalls under a network partition without being able to make progress; E3PC refines it (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Consensus protocols: three-phase commit](https://www.the-paper-trail.org/post/2008-11-29-consensus-protocols-three-phase-commit/) · Henry Robinson · the extra phase and where it still fails (*headings only*) · fetched 2026-10-14
- **Our delta:** what it tried to fix in 2PC and why it did not survive real networks.
