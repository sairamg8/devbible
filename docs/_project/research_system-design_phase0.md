---
name: research-system-design-phase0
description: Banked primary-source quotes for docs/system-design/pages/phase-0-the-interview/ (13 pages) — Norvig's latency table, the Google SRE book (SLO + Embracing Risk), the Dynamo paper, the Raft paper, Bigtable and Spanner abstracts, Jepsen's model hierarchy. Fetched once on 2026-09-07 by session 9602e64d. Do not re-derive; write every phase-0 page from this file.
metadata:
  type: reference
---

# Research bank — System Design phase 0 (fetched 2026-09-07, session `9602e64d`)

**Do not re-fetch.** Every load-bearing quote a phase-0 page needs is here, verbatim, with its URL.
Interview-format claims (what each level is asked, what a rubric holds) have **no primary source**
and are written as tendencies, never as statistics — per the brief §4.

## Norvig — "Teach Yourself Programming in Ten Years", the timing table
URL: https://norvig.com/21-days.html — intro sentence: *"Approximate timing for various operations on a typical PC:"*

| Operation | Time |
|---|---|
| execute typical instruction | 1/1,000,000,000 sec = 1 nanosec |
| fetch from L1 cache memory | 0.5 nanosec |
| branch misprediction | 5 nanosec |
| fetch from L2 cache memory | 7 nanosec |
| Mutex lock/unlock | 25 nanosec |
| fetch from main memory | 100 nanosec |
| send 2K bytes over 1Gbps network | 20,000 nanosec |
| read 1MB sequentially from memory | 250,000 nanosec |
| fetch from new disk location (seek) | 8,000,000 nanosec |
| read 1MB sequentially from disk | 20,000,000 nanosec |
| send packet US to Europe and back | 150 milliseconds = 150,000,000 nanosec |

⚠️ Norvig's table has **no** SSD row and **no** same-datacentre round-trip row. Jeff Dean's later
"numbers every programmer should know" list adds those, but it was not fetched — state them as
orders of magnitude and attribute them to "the commonly circulated Dean list", or leave them out.

## Google SRE book — chapter 4, Service Level Objectives
URL: https://sre.google/sre-book/service-level-objectives/
- *"An SLI is a service level indicator—a carefully defined quantitative measure of some aspect of the level of service that is provided."*
- *"An SLO is a service level objective: a target value or range of values for a service level that is measured by an SLI."*
- *"Finally, SLAs are service level agreements: an explicit or implicit contract with your users that includes consequences of meeting (or missing) the SLOs they contain."*
- Common SLIs named: *request latency, error rate, system throughput, availability, durability*.
- *"Availability, or the fraction of the time that a service is usable. It is often defined in terms of the fraction of well-formed requests that succeed, sometimes called yield."*
- *"Durability—the likelihood that data will be retained over a long period of time—is equally important for data storage systems."*
- *"While it's tempting to ask for a system that can scale its load 'infinitely' without any latency increase and that is 'always' available, this requirement is unrealistic."*
- *"Complicated aggregations in SLIs can obscure changes to system performance, and are also harder to reason about."*
- *"Users build on the reality of what you offer, rather than what you say you'll supply, particularly for infrastructure services."*

## Google SRE book — chapter 3, Embracing Risk
URL: https://sre.google/sre-book/embracing-risk/
- Time-based: *"Availability = Uptime / (Uptime + Downtime)"*
- Request-based: *"instead of using metrics around uptime, we define availability in terms of the request success rate."* — *"Availability = Successful Requests / Total Requests"*
- *"Extreme reliability comes at a cost: maximizing stability limits how fast new features can be developed and how quickly products can be delivered to users, and dramatically increases their cost."*
- *"experience shows that as we build systems, cost does not increase linearly as reliability increments—an incremental improvement in reliability may cost 100x more than the previous increment."*
- *"a user on a 99% reliable smartphone cannot tell the difference between 99.99% and 99.999% service reliability!"*

## Dynamo — DeCandia et al., SOSP 2007
URL: https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf
- Abstract: *"This paper presents the design and implementation of Dynamo, a highly available key-value storage system that some of Amazon's core services use to provide an 'always-on' experience. To achieve this level of availability, Dynamo sacrifices consistency under certain failure scenarios."*
- §2.2: *"In this paper there are many references to this 99.9th percentile of distributions, which reflects Amazon engineers' relentless focus on performance from the perspective of the customers' experience. Many papers report on averages, so these are included where it makes sense for comparison purposes. Nevertheless, Amazon's engineering and optimization efforts are not focused on averages."*
- §2.3: *"Dynamo targets the design space of an 'always writeable' data store (i.e., a data store that is highly available for writes). For a number of Amazon services, rejecting customer updates could result in a poor customer experience. For instance, the shopping cart service must allow customers to add and remove items from their shopping cart even amidst network and server failures. This requirement forces us to push the complexity of conflict resolution to the reads in order to ensure that writes are never rejected."*
- §2.3: *"Dynamo is designed to be an eventually consistent data store; that is all updates reach all replicas eventually."*
- §4.5: *"This protocol has two key configurable values: R and W. R is the minimum number of nodes that must participate in a successful read operation. W is the minimum number of nodes that must participate in a successful write operation. Setting R and W such that R + W > N yields a quorum-like system. In this model, the latency of a get (or put) operation is dictated by the slowest of the R (or W) replicas. For this reason, R and W are usually configured to be less than N, to provide better latency."*
- §4.6: *"If Dynamo used a traditional quorum approach it would be unavailable during server failures and network partitions, and would have reduced durability even under the simplest of failure conditions. To remedy this it does not enforce strict quorum membership and instead it uses a 'sloppy quorum'; all read and write operations are performed on the first N healthy nodes from the preference list, which may not always be the first N nodes encountered while walking the consistent hashing ring."*
- ⚠️ The "300 ms at 500 requests per second" SLA example is in §2.2 but the extracted text was two-column-garbled; **do not quote figures from it** — say "the paper states its SLAs at the 99.9th percentile".

## Raft — Ongaro & Ousterhout, "In Search of an Understandable Consensus Algorithm (Extended Version)"
URL: https://raft.github.io/raft.pdf
- Abstract: *"In order to enhance understandability, Raft separates the key elements of consensus, such as leader election, log replication, and safety, and it enforces a stronger degree of coherency to reduce the number of states that must be considered."*
- §1: *"Consensus algorithms allow a collection of machines to work as a coherent group that can survive the failures of some of its members."*
- §2: *"They are fully functional (available) as long as any majority of the servers are operational and can communicate with each other and with clients. Thus, a typical cluster of five servers can tolerate the failure of any two servers."*
- §5: *"Raft decomposes the consensus problem into three relatively independent subproblems"* — leader election (§5.2), log replication (§5.3), safety (§5.4).
- §5.1: *"A Raft cluster contains several servers; five is a typical number, which allows the system to tolerate two failures."*
- Figure 3 (verbatim): *Election Safety: at most one leader can be elected in a given term.* · *Leader Append-Only: a leader never overwrites or deletes entries in its log; it only appends new entries.* · *Log Matching: if two logs contain an entry with the same index and term, then the logs are identical in all entries up through the given index.* · *Leader Completeness: if a log entry is committed in a given term, then that entry will be present in the logs of the leaders for all higher-numbered terms.* · *State Machine Safety: if a server has applied a log entry at a given index to its state machine, no other server will ever apply a different log entry for the same index.*

## Bigtable — Chang et al., OSDI 2006
URL: https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/
- *"Bigtable is a distributed storage system for managing structured data that is designed to scale to a very large size: petabytes of data across thousands of commodity servers."* — 7th USENIX OSDI, 2006, pp. 205–218.

## Spanner — Corbett et al., OSDI 2012
URL: https://research.google/pubs/spanner-googles-globally-distributed-database-2/
- *"Spanner is Google's scalable, multi-version, globally-distributed, and synchronously-replicated database. It is the first system to distribute data at global scale and support externally-consistent distributed transactions. This paper describes how Spanner is structured, its feature set, the rationale underlying various design decisions, and a novel time API that exposes clock uncertainty."*

## Jepsen — consistency models
URL: https://jepsen.io/consistency/models
- *"When we say that model x implies y, we mean that for every history where x holds, y does too; x is 'stronger' than y."*
- *"For single-object models, strict serializable implies linearizable, which implies sequential, which implies causal."*
- Individual definitions live on sub-pages (`/consistency/models/linearizable` etc.) — **not fetched**.

## Not obtained
- **Kafka design doc** (`kafka.apache.org/documentation/#design`) — two fetches returned only the navigation shell. Cite the URL, quote nothing.
- **Jeff Dean's latency list** — not fetched; Norvig's table is the quoted one.

## Addendum 2026-09-07 — the circulated Dean list (secondary source, fetched once)
URL: https://gist.github.com/jboner/2841832 — credited *"By Jeff Dean"*, *"Originally by Peter Norvig"*; figures circa 2012.
L1 0.5 ns · branch mispredict 5 ns · L2 7 ns · mutex 25 ns · main memory 100 ns · compress 1K with Zippy 3,000 ns · send 1K over 1 Gbps 10,000 ns · **read 4K randomly from SSD 150,000 ns** · read 1 MB sequentially from memory 250,000 ns · **round trip within same datacenter 500,000 ns** · **read 1 MB sequentially from SSD 1,000,000 ns** · disk seek 10,000,000 ns · read 1 MB sequentially from disk 20,000,000 ns · send packet CA→Netherlands→CA 150,000,000 ns.
⚠️ Not a primary source; cite as "the circulated list credited to Dean and Norvig" and treat as orders of magnitude on ~2012 hardware. The three bold rows are the ones Norvig's own table lacks.
