---
title: "Link map · DSA · Part 7 (phases 17–18)"
sidebar_label: "07 · design-flavoured & applied"
sidebar_position: 7
---

# Link map · DSA · Part 7 (phases 17–18)

Covers every topic row of phases 17 and 18 in `docs/dsa/syllabus/07-design-flavoured-and-applied.md`: design-flavoured problems and concurrency (T17-01 to T17-15) and the algorithms behind the systems you run (T18-01 to T18-18). That is 33 rows. Only one has a written page of ours (reservoir sampling, in phase 2); the other 32 are marked not written and their delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title or headings checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means language and product documentation, university course notes, cp-algorithms and the Wikipedia articles that cite the textbooks; blogs count as beyond the docs.

---

## Phase 17 — Design-flavoured problems and concurrency

### T17-01 · LRU and LFU caches — Master · 🔲 not written
- **Read this:** [Cache replacement policies](https://en.wikipedia.org/wiki/Cache_replacement_policies) · Wikipedia · defines LRU and LFU as eviction policies and lists their variants (*headings only*) · covers our angle: **partial** — policies, not the list-plus-map implementation or the O(1) contract · fetched 2026-10-14
- **Also good:** [Least frequently used](https://en.wikipedia.org/wiki/Least_frequently_used) · Wikipedia · the LFU policy and its frequency-count bookkeeping (*headings only*) · fetched 2026-10-14
- **Also good:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · a JavaScript Map iterates in insertion order, which is the shortcut for a TypeScript LRU (*headings only*) · fetched 2026-10-14
- **Our delta:** the doubly linked list plus map with every operation constant, frequency buckets for LFU, and the TTL and capacity-change follow-ups that alter the contract.

### T17-02 · Min-stack, max-queue and the augmented structure — Master · 🔲 not written
- **Read this:** [Double-ended queue](https://en.wikipedia.org/wiki/Double-ended_queue) · Wikipedia · the deque operations a monotonic max-queue is built on (*headings only*) · covers our angle: **partial** — the structure, not the augmentation idea · fetched 2026-10-14
- **Also good:** [Stacks and queues](https://algs4.cs.princeton.edu/13stacks/) · Sedgewick and Wayne, Princeton · the stack and queue contracts the augmented versions extend (*headings only*) · fetched 2026-10-14
- **Our delta:** carrying the running minimum or maximum alongside each element so the query is constant time, and the two-stack queue that makes a max-queue amortised.

### T17-03 · Design a feed — Master · 🔲 not written
- **Read this:** [K-way merge algorithm](https://en.wikipedia.org/wiki/K-way_merge_algorithm) · Wikipedia · merging k sorted lists with a heap or tournament tree (*headings only*) · covers our angle: **partial** — the merge, not follow sets or the API · fetched 2026-10-14
- **Also good:** [Priority queue](https://en.wikipedia.org/wiki/Priority_queue) · Wikipedia · the heap-backed structure the merge uses (*headings only*) · fetched 2026-10-14
- **Our delta:** a small news feed as a k-way heap merge over per-user timelines with follow and unfollow sets, and where it stops scaling.

### T17-04 · Hit counter and the time-based key-value store — Master · 🔲 not written
- **Read this:** [Multiversion concurrency control](https://en.wikipedia.org/wiki/Multiversion_concurrency_control) · Wikipedia · keeping several timestamped versions of a value and reading the latest at or before a time, the idea behind a versioned store (*headings only*) · covers our angle: **partial** — versioning concept only, no binary search over versions · fetched 2026-10-14
- **Also good:** [Sliding window protocol](https://en.wikipedia.org/wiki/Sliding_window_protocol) · Wikipedia · a window moving over a sequence, the loose cousin of the hit-counter window (*headings only*) · fetched 2026-10-14
- **Our delta:** timestamps appended in order so a binary search finds the version, and the queue or bucketed counter for hits in the last window.

### T17-05 · Rate limiter — Master · 🔲 not written
- **Read this:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe engineering blog · describes the token bucket, a centralised bucket host where each request takes a token and tokens drip back, and the other limiter types they run (*read*) · covers our angle: **partial** — the production view, not the in-process data structure · fetched 2026-10-14
- **Also good:** [Token bucket](https://en.wikipedia.org/wiki/Token_bucket) · Wikipedia · the algorithm and its parameters (*headings only*) · fetched 2026-10-14
- **Our delta:** token bucket and sliding window as in-process structures with their complexity, and how the coding-round version differs from the distributed one.

### T17-06 · Randomised set with constant-time insert, delete and random — Master · 🔲 not written
- **Read this:** [Fisher–Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) · Wikipedia · swapping an element into place from the unprocessed range, the same swap move (*headings only*) · covers our angle: **partial** — shuffling, not an array plus index map · fetched 2026-10-14
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · expected constant-time insert and delete that the index map relies on (*headings only*) · fetched 2026-10-14
- **Our delta:** array plus map with delete by swapping the last element into the hole, and the duplicates variant using a set of indices per value.

### T17-07 · Concurrency-shaped problems in Node — Master · 🔲 not written
- **Read this:** [The Node.js Event Loop](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick) · Node.js docs · phases of the loop, timers, and where process.nextTick and promise callbacks run (*headings only*) · covers our angle: **partial** — the model, not a promise pool or scheduler · fetched 2026-10-14
- **Also good:** [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) · MDN · the combinators and their rejection behaviour that a pool must account for (*headings only*) · fetched 2026-10-14
- **Our delta:** a promise pool with a concurrency limit, a scheduler and a debounced queue, with the event loop as the model.

### T17-08 · Iterators — Understand · 🔲 not written
- **Read this:** [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) · MDN · the iterable and iterator protocols with next returning a done flag, which is lazy by construction (*headings only*) · covers our angle: **partial** — the protocol, not peeking or flattening · fetched 2026-10-14
- **Our delta:** the peeking iterator with a cached head, flattening nested lists with a stack, zigzag over k lists, and lazy against eager.

### T17-09 · Small APIs over deques and stacks — Understand · 🔲 not written
- **Read this:** [Double-ended queue](https://en.wikipedia.org/wiki/Double-ended_queue) · Wikipedia · deque operations and implementations (*headings only*) · covers our angle: **partial** — no snake, history or undo design · fetched 2026-10-14
- **Our delta:** the snake game, browser history and a text editor with undo, each as a small API over a deque or two stacks.

### T17-10 · Autocomplete system — Understand · 🔲 not written
- **Read this:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · the prefix tree and its lookup cost proportional to key length (*headings only*) · covers our angle: **partial** — no per-node top-k or frequency updates · fetched 2026-10-14
- **Our delta:** a trie with top-k per node, and how frequency updates change the stored lists.

### T17-11 · An in-memory file system and a key-value store with transactions — Understand · 🔲 not written
- **Read this:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · a tree keyed by path segments is the same shape as the directory tree (*headings only*) · covers our angle: **partial** — no transactions or rollback · fetched 2026-10-14
- **Our delta:** trees of maps for the file system, and an undo log or stack of overlays for nested transactions.

### T17-12 · The quick classics — Understand · 🔲 not written
- **Read this:** [Token bucket](https://en.wikipedia.org/wiki/Token_bucket) · Wikipedia · the throttling idea behind the logger rate limiter (*headings only*) · covers our angle: **partial** — nothing on the leaderboard or tic-tac-toe · fetched 2026-10-14
- **Our delta:** a logger rate limiter, a leaderboard and tic-tac-toe as API design under a clock.

### T17-13 · Building the primitives — Understand · 🔲 not written
- **Read this:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · collision resolution by chaining and open addressing, load factor and resizing (*headings only*) · covers our angle: **partial** — theory, not an interview-sized implementation · fetched 2026-10-14
- **Also good:** [Skip list](https://en.wikipedia.org/wiki/Skip_list) · Wikipedia · layered linked lists with randomised levels giving expected logarithmic search (*headings only*) · fetched 2026-10-14
- **Our delta:** a hash map and set from scratch and a skip list, the structures interviewers ask you to implement rather than use.

### T17-14 · Concurrency problems in Java — Understand · 🔲 not written
- **Read this:** [Condition](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/Condition.html) · Oracle Java SE 21 API · await and signal on a lock, with a bounded-buffer example in the class description (*headings only*) · covers our angle: **partial** — the primitive, not the problem set · fetched 2026-10-14
- **Also good:** [Chapter 17, Threads and Locks](https://docs.oracle.com/javase/specs/jls/se21/html/jls-17.html) · Java Language Specification · the memory model that makes locks and atomics correct (*headings only*) · fetched 2026-10-14
- **Also good:** [ArrayBlockingQueue](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ArrayBlockingQueue.html) · Oracle Java SE 21 API · the library bounded buffer to compare your own against (*headings only*) · fetched 2026-10-14
- **Also good:** [Dining philosophers problem](https://en.wikipedia.org/wiki/Dining_philosophers_problem) · Wikipedia · the deadlock and starvation setup with resource-ordering and arbitrator fixes (*headings only*) · fetched 2026-10-14
- **Our delta:** print in order, the bounded buffer, dining philosophers and a thread-safe counter, with locks, conditions and atomics used correctly.

### T17-15 · The boundary with low-level design — Know · 🔲 not written
- **Read this:** [Producer–consumer problem](https://en.wikipedia.org/wiki/Producer%E2%80%93consumer_problem) · Wikipedia · a classic example of a "design X" prompt that is really a synchronisation exercise (*headings only*) · covers our angle: **partial** — one example, not the boundary · fetched 2026-10-14
- **Our delta:** how to tell a "design X" coding question from the LLD round in disguise, and where the System Design track's catalogue picks up.

---

## Phase 18 — The algorithms behind the systems you run

### T18-01 · Consistent hashing — Master · 🔲 not written
- **Read this:** [Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) · Wikipedia · servers and keys placed on a ring, and virtual nodes (several labels per real server) to even out the distribution (*read*) · covers our angle: **partial** — the idea and its uses, not the sorted array with binary search · fetched 2026-10-14
- **Our delta:** the ring as a sorted array of points with binary search for the successor, virtual nodes, and what a node join or leave moves.

### T18-02 · Joins in PostgreSQL — Master · 🔲 not written
- **Read this:** [Planner/Optimizer](https://www.postgresql.org/docs/current/planner-optimizer.html) · PostgreSQL docs · lists the three join strategies: nested loop, merge join (both relations sorted on the join keys, then scanned in parallel) and hash join (*read*) · covers our angle: **partial** — the strategies, not cost per algorithm in big-O terms · fetched 2026-10-14
- **Also good:** [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) · PostgreSQL docs · reading plan nodes and their costs (*headings only*) · fetched 2026-10-14
- **Also good:** [Hash join](https://en.wikipedia.org/wiki/Hash_join) · Wikipedia · build and probe phases (*headings only*) · fetched 2026-10-14
- **Our delta:** the three joins as the nested loop, hash map and sorted two-pointer merge you already wrote, with the plan read through them.

### T18-03 · Index structures — Master · 🔲 not written
- **Read this:** [B-Tree Indexes](https://www.postgresql.org/docs/current/btree.html) · PostgreSQL docs · the B-tree implementation notes and operator support (*headings only*) · covers our angle: **partial** — the index, not the binary-search-over-pages framing · fetched 2026-10-14
- **Also good:** [GIN Indexes](https://www.postgresql.org/docs/current/gin.html) · PostgreSQL docs · the inverted index used for full-text search (*headings only*) · fetched 2026-10-14
- **Also good:** [GiST Indexes](https://www.postgresql.org/docs/current/gist.html) · PostgreSQL docs · generalised search trees for geometry and ranges (*headings only*) · fetched 2026-10-14
- **Also good:** [B-tree](https://en.wikipedia.org/wiki/B-tree) · Wikipedia · node fan-out and why height stays tiny (*headings only*) · fetched 2026-10-14
- **Our delta:** B-tree lookup as binary search over pages, the inverted index and the generalised tree, and what changes at ten times the data.

### T18-04 · Explaining a complexity trade-off as a senior — Master · 🔲 not written
- **Read this:** [Cache replacement policies](https://en.wikipedia.org/wiki/Cache_replacement_policies) · Wikipedia · a worked family of trade-offs between hit rate, bookkeeping cost and memory (*headings only*) · covers our angle: **partial** — content, not the sentence shape · fetched 2026-10-14
- **Our delta:** the one-sentence form that names the bound, the constant, the memory and the failure mode.

### T18-05 · Rate-limiter algorithms in production — Understand · 🔲 not written
- **Read this:** [Counting things, a lot of different things](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/) · Cloudflare blog · replaces a fixed window with a sliding window that estimates the count from two adjacent windows, using only GET, SET and INCR on a shared store (*read*) · covers our angle: **full** for the accuracy-for-cost trade · fetched 2026-10-14
- **Also good:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe engineering blog · token bucket with a centralised bucket host (*read*) · fetched 2026-10-14
- **Our delta:** token bucket against sliding window with a shared store, and the accuracy traded for cost.

### T18-06 · Bloom filters — Understand · 🔲 not written
- **Read this:** [Bloom filter](https://en.wikipedia.org/wiki/Bloom_filter) · Wikipedia · sections on the false-positive probability, the optimal number of hash functions and counting variants (*headings only*) · covers our angle: **partial** — maths there, not the storefront placements · fetched 2026-10-14
- **Also good:** [Bloom filter](https://redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/) · Redis docs · the structure as a shipped data type (*headings only*) · fetched 2026-10-14
- **Our delta:** bit array and k hashes with the false-positive arithmetic, in caches, crawlers and storage engines.

### T18-07 · Count-min sketch, HyperLogLog and streaming top-k — Understand · 🔲 not written
- **Read this:** [Count–min sketch](https://en.wikipedia.org/wiki/Count%E2%80%93min_sketch) · Wikipedia · a small table of counters with several hashes giving over-estimates only (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [HyperLogLog](https://en.wikipedia.org/wiki/HyperLogLog) · Wikipedia · distinct-count estimation in small memory (*headings only*) · fetched 2026-10-14
- **Also good:** [Top-K](https://redis.io/docs/latest/develop/data-types/probabilistic/top-k/) · Redis docs · streaming heavy hitters as a shipped type (*headings only*) · fetched 2026-10-14
- **Our delta:** counting at a fraction of the memory and the error you accept for each of the three.

### T18-08 · Reservoir sampling — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/10h-reservoir-sampling.md`
- **Read this:** [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling) · Wikipedia · the algorithm for a stream of unknown length and its weighted and skip variants (*headings only*) · covers our angle: **partial** — the algorithm and variants, no induction proof written for interviews · fetched 2026-10-14
- **Our delta:** the whole algorithm as accept the i-th item with probability k/i, with the induction derived rather than cited; the logging and experiment uses are syllabus-only.

### T18-09 · External sort and the k-way merge — Understand · 🔲 not written
- **Read this:** [External sorting](https://en.wikipedia.org/wiki/External_sorting) · Wikipedia · sort runs that fit in memory, then merge them (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [K-way merge algorithm](https://en.wikipedia.org/wiki/K-way_merge_algorithm) · Wikipedia · the heap-based merge (*headings only*) · fetched 2026-10-14
- **Our delta:** sorting what does not fit in memory, with the same merge as the heap problems.

### T18-10 · Diffing — Understand · 🔲 not written
- **Read this:** [An O(ND) Difference Algorithm and Its Variations](http://www.xmailserver.org/diff2.pdf) · Eugene Myers, 1986 · the original paper behind git's default diff (*headings only*) · covers our angle: **partial** — no React side · fetched 2026-10-14
- **Also good:** [Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html) · React legacy docs · the heuristic diff: elements of different types rebuild, and keys identify children (*headings only*) · fetched 2026-10-14
- **Also good:** [Edit distance](https://en.wikipedia.org/wiki/Edit_distance) · Wikipedia · the exact quantity the heuristics trade away (*headings only*) · fetched 2026-10-14
- **Our delta:** Myers in git, the React heuristics, and edit distance with the engineering compromises.

### T18-11 · The inverted index — Understand · 🔲 not written
- **Read this:** [A first take at building an inverted index](https://nlp.stanford.edu/IR-book/html/htmledition/a-first-take-at-building-an-inverted-index-1.html) · Manning, Raghavan and Schütze, Introduction to Information Retrieval · tokens to a sorted postings list per term (*headings only*) · covers our angle: **partial** — building, with intersection and ranking in neighbouring sections · fetched 2026-10-14
- **Also good:** [Inverted index](https://en.wikipedia.org/wiki/Inverted_index) · Wikipedia · overview and variants (*headings only*) · fetched 2026-10-14
- **Our delta:** tokens to postings, intersecting sorted lists with two pointers, and ranking.

### T18-12 · Scheduling — Understand · 🔲 not written
- **Read this:** [The Node.js Event Loop](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick) · Node.js docs · the timers phase that runs expired callbacks (*headings only*) · covers our angle: **partial** — behaviour, not the timer structure · fetched 2026-10-14
- **Also good:** [Priority queue](https://en.wikipedia.org/wiki/Priority_queue) · Wikipedia · the heap behind a job runner (*headings only*) · fetched 2026-10-14
- **Also good:** [Cron](https://en.wikipedia.org/wiki/Cron) · Wikipedia · the schedule-expression side (*headings only*) · fetched 2026-10-14
- **Our delta:** cron plus a heap of next-run times, and the timer structure inside Node's loop.

### T18-13 · Topological sort in build tools and package managers — Understand · 🔲 not written
- **Read this:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · DFS-based ordering by exit time (*headings only*) · covers our angle: **partial** — no build or package-manager context · fetched 2026-10-14
- **Also good:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · Kahn's algorithm and the cycle condition (*headings only*) · fetched 2026-10-14
- **Our delta:** dependency resolution with cycles reported as errors.

### T18-14 · Radix trees in HTTP routers — Understand · 🔲 not written
- **Read this:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · a compressed trie whose edges carry strings (*headings only*) · covers our angle: **partial** — no routing · fetched 2026-10-14
- **Also good:** [Routing](https://expressjs.com/en/guide/routing/) · Express docs · the route-pattern surface a router must match (*headings only*) · fetched 2026-10-14
- **Our delta:** how Express-style routers and their radix-tree successors match a path.

### T18-15 · Sampled LRU in Redis — Know · 🔲 not written
- **Read this:** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · Redis docs · the LRU is an approximation: it samples a few random keys and evicts the best candidate, tuned by maxmemory-samples (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** why production eviction approximates the textbook list-plus-map.

### T18-16 · Shortest paths in maps — Know · 🔲 not written
- **Read this:** [Contraction hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies) · Wikipedia · precomputed shortcuts for fast road queries (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Dijkstra's algorithm](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms · the baseline being sped up (*headings only*) · fetched 2026-10-14
- **Our delta:** Dijkstra at scale, precomputation, and contraction hierarchies as the idea.

### T18-17 · Union-find in networking and clustering — Know · 🔲 not written
- **Read this:** [Disjoint Set Union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · the structure and its near-constant cost (*headings only*) · covers our angle: **partial** — no applied framing · fetched 2026-10-14
- **Also good:** [Disjoint-set data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure) · Wikipedia · applications section (*headings only*) · fetched 2026-10-14
- **Our delta:** connectivity checks and merging duplicate accounts; the structure itself is covered in phase 1 (`docs/dsa/pages/phase-1-complexity/03b-union-find-and-the-limits-of-amortised.md`), not the applications.

### T18-18 · Rolling hashes in practice — Know · 🔲 not written
- **Read this:** [Rolling hash](https://en.wikipedia.org/wiki/Rolling_hash) · Wikipedia · hash updated as a window slides, and content-defined chunking (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Rabin fingerprint](https://en.wikipedia.org/wiki/Rabin_fingerprint) · Wikipedia · the fingerprint used for chunk boundaries (*headings only*) · fetched 2026-10-14
- **Also good:** [String Hashing](https://cp-algorithms.com/string/string-hashing.html) · cp-algorithms · polynomial hashing details (*headings only*) · fetched 2026-10-14
- **Our delta:** content-defined chunking, deduplication and cache keys.

---

← [Part 7 syllabus](../syllabus/07-design-flavoured-and-applied.md)
