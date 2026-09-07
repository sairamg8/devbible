---
title: "The folklore has primary sources — Dynamo, Bigtable, Spanner, Raft, the Kafka design doc and the SRE book — and a candidate who has read Dynamo explains quorums differently from one who has read a summary of it"
sidebar_label: "12 · Primary sources"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07 against the sources themselves —
> [Dynamo](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) (SOSP 2007),
> [Bigtable](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/) (OSDI 2006),
> [Spanner](https://research.google/pubs/spanner-googles-globally-distributed-database-2/) (OSDI 2012),
> [Raft, extended version](https://raft.github.io/raft.pdf), the
> [Kafka design documentation](https://kafka.apache.org/documentation/#design) (cited, not quoted —
> the page could not be fetched as text here), and the Google SRE book chapters
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/) and
> [*Service Level Objectives*](https://sre.google/sre-book/service-level-objectives/).
> Quotes are verbatim from those documents. **No sandbox run.**

**Most of what circulates as system-design folklore — quorums, eventual consistency, wide-column
stores, consensus, the log as the storage abstraction, error budgets — is a summary of five or six
documents, and the summaries lose the part that matters: the requirement each design was derived
from.** Reading the sources is not about citing them in the round. It is that a candidate who has
read Dynamo explains R + W over N as a *tunable trade between latency and consistency that each
service sets for itself*, because that is how the paper presents it, while a candidate who read a
summary explains it as a rule. The difference is audible, and it is exactly the reasoned-versus-
memorised difference from [08](08-reasoned-wrong-beats-memorised-right.md). This page says which
parts of each source to read, and what each one changes about how you talk.

## Dynamo (DeCandia et al., SOSP 2007)

**Read:** §2 (requirements and design considerations), §4.5 (the quorum), §4.6 (sloppy quorum and
hinted handoff). Skip the evaluation on a first pass.

**What it changes.** The paper is the cleanest example of a design derived from a requirement,
and it says which requirement in one sentence:

> *"For a number of Amazon services, rejecting customer updates could result in a poor customer
> experience. For instance, the shopping cart service must allow customers to add and remove items
> from their shopping cart even amidst network and server failures. This requirement forces us to
> push the complexity of conflict resolution to the reads in order to ensure that writes are never
> rejected."* — §2.3

A reader of that paragraph explains eventual consistency as a *consequence* — writes must never be
rejected, therefore conflicts are resolved on read — and can say what the design would be if the
requirement were different. The quorum section is the second thing that changes how you talk:

> *"Setting R and W such that R + W > N yields a quorum-like system. In this model, the latency of
> a get (or put) operation is dictated by the slowest of the R (or W) replicas. For this reason, R
> and W are usually configured to be less than N, to provide better latency."* — §4.5

The summary version is "R + W > N gives consistency". The source version is that R and W are
*knobs*, that the latency cost is the slowest of the chosen replicas, and that services tune them
— which is why a candidate who has read it answers "how would you configure the quorum for the
cart versus for orders?" with two different settings and a reason. §4.6's sloppy quorum is the
third: the paper explains why a strict quorum would be unavailable during partitions and what it
trades for availability, which is the failure walk of a leaderless store in one paragraph.

## Bigtable (Chang et al., OSDI 2006)

**Read:** §2 (the data model — rows, column families, timestamps), §5 (the implementation —
tablets, the log, SSTables, compactions). The abstract states the scale claim:

> *"Bigtable is a distributed storage system for managing structured data that is designed to
> scale to a very large size: petabytes of data across thousands of commodity servers."*

**What it changes.** Every wide-column store descends from this data model, and every LSM-based
engine descends from its write path — a commit log, an in-memory table, immutable sorted files on
disk, compaction. A reader explains "why are writes fast and reads sometimes slow in this kind of
store" from the mechanism rather than from a slogan, and can draw the write path of a
Cassandra-style or RocksDB-style engine because it is Bigtable's §5. It is also the source for
"design the row key from the access pattern": the paper's own examples of row-key design for
locality are the origin of the advice.

## Spanner (Corbett et al., OSDI 2012)

**Read:** §1 (what it is and why), §3 (TrueTime), §4.1 (how external consistency is achieved).
The abstract names the trick:

> *"Spanner is Google's scalable, multi-version, globally-distributed, and synchronously-replicated
> database. It is the first system to distribute data at global scale and support
> externally-consistent distributed transactions. This paper describes how Spanner is structured,
> its feature set, the rationale underlying various design decisions, and a novel time API that
> exposes clock uncertainty."*

**What it changes.** The folklore says "you can't have strong consistency at global scale."
Spanner is the existence proof that you can — at the price of *exposing clock uncertainty* as an
interval and waiting it out on commit. A reader explains the trade precisely: synchronous
replication across regions costs the cross-continent rung of the [ladder](05-the-latency-ladder.md)
on every write, and external consistency additionally costs a commit-wait bounded by the clock
error. That is the answer to "why doesn't everyone do this?" — and it is the source of the
distinction between physical and logical time that phase 6 of this track builds on.

## Raft (Ongaro and Ousterhout, extended version)

**Read:** §2 (what a replicated state machine is), §5 in full (the algorithm), and Figure 3 (the
safety properties). It is written to be readable; the abstract explains why:

> *"In order to enhance understandability, Raft separates the key elements of consensus, such as
> leader election, log replication, and safety, and it enforces a stronger degree of coherency to
> reduce the number of states that must be considered."*

**What it changes.** "Consensus" stops being a word and becomes three subproblems — leader
election, log replication, safety — each with a mechanism you can describe. The paper's own
framing of what a consensus cluster buys you is the sentence to have ready:

> *"They are fully functional (available) as long as any majority of the servers are operational
> and can communicate with each other and with clients. Thus, a typical cluster of five servers can
> tolerate the failure of any two servers."* — §2

And Figure 3 is the list of guarantees a candidate can name when asked "what does Raft actually
promise?" — election safety (at most one leader per term), leader append-only, log matching,
leader completeness, state-machine safety — each with a one-line definition in the figure. This is
the source behind etcd, and therefore behind Kubernetes' control plane, and behind most
leader-elected components a design interview mentions.

## The Kafka design documentation

**Read:** the *Design* section of the Kafka documentation — motivation, persistence ("don't fear
the filesystem"), efficiency, the producer and consumer sections, message delivery semantics, and
replication. It is not a paper, but it is the primary statement of the log-as-storage idea in the
form most engineers meet it. (The page could not be fetched as text for this bible, so it is cited
here and not quoted; read it directly.)

**What it changes.** "Kafka is a queue" becomes "Kafka is a partitioned, replicated log with
consumers that own their offsets", which is the mental model that answers every Kafka follow-up:
why ordering is per partition, why consumers can replay, why a consumer group is the unit of
parallelism, why at-least-once is the default and what exactly-once within Kafka means. Phase 9
of this track is built on that section.

## The Google SRE book

**Read:** chapter 3, *Embracing Risk*, and chapter 4, *Service Level Objectives*, first; chapter
6 (*Monitoring Distributed Systems*) and the postmortem chapter after that.

**What it changes.** Three things a candidate who has read the two chapters says differently.
Availability becomes a formula with a stated form — request-based or time-based — rather than an
adjective:

> *"instead of using metrics around uptime, we define availability in terms of the request
> success rate."* · *"Availability = Successful Requests / Total Requests"* — ch. 3

Reliability targets become something you argue *down* as well as up, because the cost curve is
known:

> *"an incremental improvement in reliability may cost 100x more than the previous increment."*
> — ch. 3

And requirements become SLIs and SLOs, with the warning that users depend on what you deliver,
not what you promise:

> *"Users build on the reality of what you offer, rather than what you say you'll supply,
> particularly for infrastructure services."* — ch. 4

Phase 15 of this track is built on these chapters; the [vocabulary page](04-the-vocabulary-contract.md)
in this phase already leans on them.

## What to read them for

Not to cite. Interviewers do not award points for "as the Dynamo paper says". They award points
for the behaviours the reading produces:

| Source | The behaviour it produces |
|---|---|
| Dynamo | deriving consistency from a requirement; treating R and W as knobs with a latency cost |
| Bigtable | explaining an LSM write path from mechanism; designing row keys from access patterns |
| Spanner | stating precisely what global strong consistency costs, and why most designs decline it |
| Raft | naming the three subproblems and the guarantees; explaining what a majority buys |
| Kafka design | reasoning about ordering, replay and parallelism from the log model |
| SRE book | availability as a formula; reliability targets argued from cost; requirements as SLOs |

Read one per week, the relevant sections only, and after each one re-run a drill on the system it
underpins ([10](10-how-to-practise.md)) — the difference in how you explain it is the point.

## Gotchas

**★ Symptom: "R plus W greater than N" recited, and the follow-up "so what would you set for the
cart?" stalls.** Cause: the rule was learned from a summary; the paper's framing — knobs, tuned
per service, with a latency cost — was not. Fix: read Dynamo §4.5 and §4.6 and answer with two
settings and a reason: write-heavy and availability-first for the cart, read-heavy and consistent
for the catalogue.

**Symptom: "you can't have strong consistency at global scale" stated as a law.** Cause: the
folklore without its exception. Fix: Spanner is the existence proof; the honest statement is that
global external consistency is possible at the price of a cross-continent round trip per write
plus a commit-wait bounded by clock uncertainty, and most designs decline to pay.

**Symptom: "consensus" used as a single word with no mechanism behind it.** Cause: Raft never
read. Fix: §5 and Figure 3 — three subproblems and five guarantees, each nameable in a sentence.

**Symptom: Kafka explained as a queue.** Cause: the design doc never read. Fix: the log model —
partitions, offsets owned by consumers, replay — from the *Design* section; every Kafka follow-up
is answered from it.

**Symptom: reading the papers cover to cover and stalling after the first.** Cause: the
evaluation sections and related-work sections read as if they were the point. Fix: the sections
named above, one source a week, followed by a drill on the system it underpins.

**Symptom: citing the paper in the round and getting a blank look.** Cause: reading treated as
credential rather than as behaviour. Fix: never cite; derive. The interviewer notices that the
explanation came from mechanism, not that it came from a paper.

## Interview questions

**★ How does having read the Dynamo paper change the way you explain quorums?**
The summary version is a rule: R + W over N gives consistency. The paper's version is that R and
W are knobs set per service, that the latency of an operation is the slowest of the chosen
replicas, so they are usually set below N for latency, and that a strict quorum would be
unavailable during partitions, which is why Dynamo uses a sloppy quorum with hinted handoff. A
reader therefore answers "configure the quorum for the cart and for orders" with two different
settings and the trade each makes, and explains eventual consistency as the consequence of the
requirement that writes are never rejected.

**★ What does Spanner prove, and what does it cost?**
That externally consistent, synchronously replicated transactions at global scale are possible —
the folklore that they are not is wrong as a law. The cost is the cross-continent rung of the
latency ladder on every write, plus a commit-wait bounded by the clock uncertainty that its time
API exposes as an interval. That is the precise answer to "why doesn't everyone do this", and it
is the origin of the physical-versus-logical-time distinction the consensus phase relies on.

**What are Raft's three subproblems and five guarantees?**
Leader election, log replication and safety. The guarantees, from the paper's Figure 3: election
safety (at most one leader per term), leader append-only (a leader never overwrites or deletes its
log entries), log matching (two logs with an entry of the same index and term are identical up to
that index), leader completeness (a committed entry is present in every later leader's log), and
state-machine safety (no two servers apply different entries at the same index). A five-server
cluster tolerates two failures because a majority is what the algorithm needs.

**Which sections of the SRE book matter for design rounds, and what do they change?**
*Embracing Risk* and *Service Level Objectives*. They turn availability into a formula with a
stated form — request-based or uptime-based — make reliability a target argued from its cost
curve, where an increment may cost a hundred times the last, and turn requirements into
indicators and objectives with the warning that users build on what you actually deliver. A
candidate who has read them states targets as SLOs and argues for less reliability where users
cannot perceive more.

**Why read primary sources if you should never cite them in the round?**
Because the reading produces behaviours the round grades and the citation does not: deriving a
consistency model from a requirement, explaining a write path from its mechanism, stating the
cost of global consistency precisely, naming what a majority buys, reasoning about ordering from
the log model. Interviewers notice explanations that come from mechanism; they do not award points
for naming the paper the mechanism came from.

---

← Prev: [11 · Whiteboard and remote tooling](11-whiteboard-and-remote-tooling.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → [13 · How this track relates](13-how-this-track-relates.md)
