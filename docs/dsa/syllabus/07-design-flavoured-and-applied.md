---
title: "Part 7 — Design-flavoured problems and applied algorithms"
sidebar_label: "7 · Design-flavoured & applied"
sidebar_position: 7
---

> Phases 17–18 · The "design a data structure" round, concurrency-shaped problems in Java and Node, and the algorithms you already run in production without naming them

Senior loops lean toward problems that look like small systems: a cache with an O(1)
contract, a rate limiter, an iterator with a lazy API, a thread-safe queue. Phase 17 is that
family, in both of this reader's languages. Phase 18 turns the track around: the algorithms
inside PostgreSQL, Redis, git, React and Kafka are the ones just learned, and being able to
say so is what makes a senior's complexity discussion sound like experience rather than
revision. The [System Design track](../../system-design/README.md) picks up where Phase 18
stops.

---

## Phase 17 — Design-flavoured problems and concurrency

A small API, a complexity contract per operation, and the follow-ups that change the
contract. The concurrency rows are split by language on purpose: Java asks about locks and
conditions, Node asks about the event loop and promise scheduling.

| Topic | Tier |
|---|---|
| **LRU and LFU caches** — the doubly linked list with a map, frequency buckets for LFU; the constant-time contract and the follow-ups (a TTL, a capacity change) | <span className="db-tier t-master">Master</span> |
| **Min-stack, max-queue and the augmented structure** — carrying extra state per element so a query becomes constant time | <span className="db-tier t-master">Master</span> |
| **Design a feed** — merging k user timelines with a heap, follow and unfollow sets; the small version of the news-feed design | <span className="db-tier t-master">Master</span> |
| **Hit counter and the time-based key-value store** — timestamps, binary search over versions, the sliding window over time | <span className="db-tier t-master">Master</span> |
| **Rate limiter** — token bucket and sliding window as data structures; how the coding-round version differs from the distributed one | <span className="db-tier t-master">Master</span> |
| **Randomised set with constant-time insert, delete and random** — the swap-with-last trick, and the variant with duplicates | <span className="db-tier t-master">Master</span> |
| **Concurrency-shaped problems in Node** — a promise pool with a concurrency limit, a scheduler, a debounced queue; the event loop as the model, continuing the [JavaScript async phase](../../javascript/pages/phase-7-async/README.md) and its [machine-coding phase](../../javascript/pages/phase-17-machine-coding/README.md) | <span className="db-tier t-master">Master</span> |
| **Iterators** — the peeking iterator, flattening nested lists, zigzag over k lists; lazy against eager | <span className="db-tier t-understand">Understand</span> |
| **Small APIs over deques and stacks** — the snake game, browser history, a text editor with undo | <span className="db-tier t-understand">Understand</span> |
| **Autocomplete system** — a trie with top-k per node and frequencies that update | <span className="db-tier t-understand">Understand</span> |
| **An in-memory file system and a key-value store with transactions** — trees of maps, an undo log for rollback | <span className="db-tier t-understand">Understand</span> |
| **The quick classics** — a logger rate limiter, a leaderboard, tic-tac-toe; API design under a clock | <span className="db-tier t-understand">Understand</span> |
| **Building the primitives** — a hash map and a hash set from scratch, a skip list; the structures interviewers ask you to implement rather than use | <span className="db-tier t-understand">Understand</span> |
| **Concurrency problems in Java** — print in order, the bounded buffer, dining philosophers, a thread-safe counter; locks, conditions and atomics used correctly | <span className="db-tier t-understand">Understand</span> |
| **The boundary with low-level design** — when a "design X" coding question is the LLD round in disguise; the catalogue in the System Design track | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** LRU and LFU caches, a time-based key-value store and a promise pool
with tests in TypeScript; the bounded buffer in Java; and, for each, the complexity of every
operation written above the class.

---

## Phase 18 — The algorithms behind the systems you run

Every structure in this track is inside something you deploy. This phase names those
places, so that "hash join", "B-tree", "consistent hashing" and "Myers diff" come out as
things you have seen rather than terms you have read — the difference an interviewer hears
immediately.

| Topic | Tier |
|---|---|
| **Consistent hashing** — the ring as a sorted structure with binary search, virtual nodes; the design problem in the System Design track solved with the structure from this one | <span className="db-tier t-master">Master</span> |
| **Joins in PostgreSQL** — nested loop, hash join and merge join as the algorithms you learned; reading a query plan with them in mind ([PostgreSQL](../../postgresql/README.md)) | <span className="db-tier t-master">Master</span> |
| **Index structures** — the B-tree lookup as binary search over pages, the inverted index behind full-text search, generalised search trees for geometry | <span className="db-tier t-master">Master</span> |
| **Explaining a complexity trade-off as a senior** — the sentence that names the bound, the constant, the memory and the failure mode; the skill this phase exists to build | <span className="db-tier t-master">Master</span> |
| **Rate-limiter algorithms in production** — token bucket against sliding window with a shared store; the accuracy you trade for cost | <span className="db-tier t-understand">Understand</span> |
| **Bloom filters** — bit arrays and k hash functions, the false-positive arithmetic; in caches, crawlers and storage engines | <span className="db-tier t-understand">Understand</span> |
| **Count-min sketch, HyperLogLog and streaming top-k** — counting at a fraction of the memory, and the error you accept | <span className="db-tier t-understand">Understand</span> |
| **Reservoir sampling** — sampling from a stream of unknown length; logging and experiments | <span className="db-tier t-understand">Understand</span> |
| **External sort and the k-way merge** — sorting what does not fit in memory; the same merge as the heap problems | <span className="db-tier t-understand">Understand</span> |
| **Diffing** — Myers' algorithm in git, the reconciliation heuristics in React; edit distance with engineering compromises | <span className="db-tier t-understand">Understand</span> |
| **The inverted index** — tokens to postings, intersecting sorted lists, ranking; the search engine as a data structure | <span className="db-tier t-understand">Understand</span> |
| **Scheduling** — cron and priority queues, the heap inside a job runner, the timer structure inside Node's event loop | <span className="db-tier t-understand">Understand</span> |
| **Topological sort in build tools and package managers** — dependency resolution, cycles reported as errors | <span className="db-tier t-understand">Understand</span> |
| **Radix trees in HTTP routers** — how [Express](../../expressjs/README.md)-style routers and their faster successors match a path | <span className="db-tier t-understand">Understand</span> |
| **Sampled LRU in Redis** — why production eviction approximates the textbook structure ([Redis](../../redis/README.md)) | <span className="db-tier t-know">Know</span> |
| **Shortest paths in maps** — Dijkstra at scale, precomputation, contraction hierarchies as the idea | <span className="db-tier t-know">Know</span> |
| **Union-find in networking and clustering** — connectivity checks, merging duplicate accounts | <span className="db-tier t-know">Know</span> |
| **Rolling hashes in practice** — content-defined chunking, deduplication, cache keys | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** for each Master row you can name where the structure lives in the
storefront's stack and what changes at ten times the data — in the sentence a senior would
use, not the paragraph a student would.

---

{/* NAV */}
