---
title: "Link map · DSA · Part 7 (phases 17–18)"
sidebar_label: "07 · design-flavoured & applied"
sidebar_position: 7
---

# Link map · DSA · Part 7 (phases 17–18)

Covers every topic row of phases 17 and 18 in `docs/dsa/syllabus/07-design-flavoured-and-applied.md`: design-flavoured problems and concurrency (T17-01 to T17-15) and the algorithms behind the systems you run (T18-01 to T18-18). That is 33 rows. Only one has a written page of ours (reservoir sampling, in phase 2); the other 32 are marked not written and their delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at HTTP 200 and the title or headings checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means language and product documentation, university course notes, cp-algorithms and the Wikipedia articles that cite the textbooks; blogs and project READMEs count as beyond the docs. Every URL below was fetched and returned 200 at the address shown, on the date given on its line (2026-10-14 or 2026-10-15).

---

## Phase 17 — Design-flavoured problems and concurrency

### T17-01 · LRU and LFU caches — Master · 🔲 not written
- **Read this:** [Implementing LFU in O(1)](https://arpitbhayani.me/blogs/lfu) · Arpit Bhayani · one hash table plus a doubly linked list of frequency nodes, each holding its own list of values, with insert, get and evict (lowest-frequency node first) all constant time, from the Shah, Mitra and Matani paper · covers our angle: **partial** — LFU only, no TTL or capacity-change follow-ups, no TypeScript or Java · fetched 2026-10-15 (*read*)
- **Also good:** [Designing an LRU cache that actually runs in O(1)](https://www.techinterview.org/post/3233476035/lru-cache-design-o1/) · techinterview.org · map plus doubly linked list with dummy head and tail, then prose on LFU, TTL expiry and sharded locks; the page is ad-heavy and its company-frequency claims are unsourced · fetched 2026-10-15 (*read*)
- **Also good:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · a Map remembers the original insertion order of its keys and iterates in that order, which is the shortcut for a TypeScript LRU (*read*) · fetched 2026-10-14
- **Also good:** [Cache replacement policies](https://en.wikipedia.org/wiki/Cache_replacement_policies) · Wikipedia · LRU discards the least recently used item first and needs bookkeeping of what was used when; LFU counts how often an item is needed; sections on LRU approximations and LFU variants (*read*) · fetched 2026-10-14
- **Our delta:** the doubly linked list plus map with every operation constant, frequency buckets for LFU, and the TTL and capacity-change follow-ups that alter the contract. The Java `LinkedHashMap` access-order answer is already in phase 0 (`docs/dsa/pages/phase-0-the-interview-and-practice/12-javas-collections-for-interviews.md`).

### T17-02 · Min-stack, max-queue and the augmented structure — Master · 🔲 not written
- **Read this:** [Minimum Stack / Minimum Queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · a stack that stores the running minimum with each element, three ways to get an O(1)-minimum queue (one of them two modified stacks), and the minimum of every fixed-length subarray in O(n) (*read*) · covers our angle: **full** for the minimum structures (C++ only, no max variant) — not the general "augment each element" framing · fetched 2026-10-14
- **Also good:** [Bags, Queues, and Stacks](https://algs4.cs.princeton.edu/13stacks/) · Sedgewick and Wayne, Princeton · the exercises include "Stack + max" with a second stack holding the maximums, and a queue built from two stacks with amortised constant cost (*read*) · fetched 2026-10-14
- **Also good:** [Double-ended queue](https://en.wikipedia.org/wiki/Double-ended_queue) · Wikipedia · the monotonic queue section: an input-restricted deque gives the sliding-window minimum or maximum in O(n) (*read*) · fetched 2026-10-14
- **Our delta:** carrying the running minimum or maximum alongside each element so the query is constant time, and the two-stack queue that makes a max-queue amortised.

### T17-03 · Design a feed — Master · 🔲 not written
- **Read this:** [Design Twitter](https://algomaster.io/learn/dsa/design-twitter) · AlgoMaster · states outright that the feed reduces to merging K sorted lists, compares collect-and-sort against a max-heap seeded with each followee's newest tweet (O(K log K), at most 11 tweets touched per user), and keeps follow and unfollow as constant-time set updates (*read*) · covers our angle: **full** for the design — code tabs not checked for language · fetched 2026-10-15
- **Also good:** [355. Design Twitter](https://walkccc.me/LeetCode/problems/0355/) · walkccc · code only: C++ and Java seed a max-heap with each followee's newest tweet and pop ten times, with follow and unfollow as set updates that are no-ops for self-follows; no TypeScript, no prose (*read*) · fetched 2026-10-15
- **Read this:** [K-way merge algorithm](https://en.wikipedia.org/wiki/K-way_merge_algorithm) · Wikipedia · two-way merge, then direct k-way merge with a heap or a tournament tree to find the smallest head quickly (*read*) · covers our angle: **partial** — the merge, not follow sets or the API · fetched 2026-10-14
- **Our delta:** a small news feed as a TypeScript k-way heap merge over per-user timelines with follow and unfollow sets, the link back to merge k sorted lists, and where it stops scaling.

### T17-04 · Hit counter and the time-based key-value store — Master · 🔲 not written
- **Read this:** [Time Based Key-Value Store](https://www.algo.monster/liteproblems/time-based-key-value-store) · AlgoMonster · per-key list kept sorted because set calls arrive in increasing time, then binary search for the largest timestamp not after the query (*read*) · covers our angle: **partial** — Python only; the hit counter and sliding window half is missing · fetched 2026-10-15
- **Also good:** [362. Design Hit Counter](https://leetcode.doocs.org/en/lc/362/) · doocs · one solution: binary search over an append-only timestamp list, with code in six languages including TypeScript; a queue that drops stale hits is only mentioned in passing (*read*) · fetched 2026-10-15
- **Our delta:** the sliding window over time as a queue or circular buffer, and TypeScript for the key-value store.

### T17-05 · Rate limiter — Master · 🔲 not written
- **Read this:** [Build 5 Rate Limiters with Redis](https://redis.io/tutorials/howtos/ratelimiting/) · Redis · fixed window, sliding window log and counter, token bucket and leaky bucket, each with how it works, trade-offs and a TypeScript caller around a Lua script, plus a comparison table of memory, accuracy and burst behaviour (*read*) · covers our angle: **partial** — built around Redis, not the in-process coding-round version · fetched 2026-10-15
- **Also good:** [Rate limiting algorithms explained with code](https://blog.algomaster.io/p/rate-limiting-algorithms-explained-with-code) · AlgoMaster · the same five algorithms in short prose with pros and cons; the code sits in linked GitHub repos (Python and Java) that I did not check (*read*) · fetched 2026-10-15
- **Read this:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe engineering blog · the request-rate limiter, the concurrent-requests limiter and two load shedders, all built on the token bucket: a centralised bucket host where each request takes a token and tokens drip back (*read*) · covers our angle: **partial** — the production view, not the in-process data structure · fetched 2026-10-14
- **Our delta:** token bucket and sliding window as in-process structures with their complexity (the single-process class with an injectable clock), and how the coding-round version differs from the distributed one.

### T17-06 · Randomised set with constant-time insert, delete and random — Master · 🔲 not written
- **Read this:** [380. Insert Delete GetRandom O(1)](https://leetcode.doocs.org/en/lc/380/) · doocs · array of values plus a map of value to index; insert appends, delete swaps with the last element and repairs that index, random picks from the array; code includes TypeScript (*read*) · covers our angle: **partial** — the no-duplicates variant only · fetched 2026-10-15
- **Also good:** [381. Insert Delete GetRandom O(1) - Duplicates allowed](https://leetcode.doocs.org/en/lc/381/) · doocs · list plus value-to-index-set map, swap with last on removal, duplicates weigh more in random; Python and Java only (*read*) · fetched 2026-10-15
- **Our delta:** why the swap-with-last move keeps every operation constant, and a TypeScript walkthrough of the duplicates variant.

### T17-07 · Concurrency-shaped problems in Node — Master · 🔲 not written
- **Read this:** [JavaScript promise concurrency limit](https://techearl.com/javascript-promise-concurrency-limit) · TechEarl · a 15-line dependency-free pool: several workers share one cursor, results stored by index, first failure rejects, with allSettled or p-map as the alternatives, plus AbortSignal cancellation (*read*) · covers our angle: **partial** — no scheduler or debounced queue · fetched 2026-10-15
- **Read this:** [The Node.js Event Loop](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick) · Node.js docs · the phases of the loop, when timers fire against their threshold, setImmediate against setTimeout, and why process.nextTick runs outside the phases after the current operation (*read*) · covers our angle: **partial** — the model, not a promise pool or scheduler; promise microtasks are not discussed · fetched 2026-10-14
- **Also good:** [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) · MDN · the concurrency methods: Promise.all rejects when any input rejects, Promise.allSettled waits for all, which a pool must account for (*read*) · fetched 2026-10-14
- **Beyond the docs:** [p-limit](https://github.com/sindresorhus/p-limit) · Sindre Sorhus, README · "run multiple promise-returning and async functions with limited concurrency", the library version of the pool to compare yours against (*read*) · fetched 2026-10-14
- **Our delta:** a promise pool with a concurrency limit, a scheduler and a debounced queue, with the event loop as the model.

### T17-08 · Iterators — Understand · 🔲 not written
- **Read this:** [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) · MDN · the iterable and iterator protocols: next returns a result with done and value, one value per call, so an infinite iterator is legal (*read*) · covers our angle: **partial** — the protocol, not peeking or flattening · fetched 2026-10-14
- **Also good:** [284. Peeking Iterator](https://walkccc.me/LeetCode/problems/0284/) · walkccc · code only: Java and Python cache one element ahead so peek is constant time, the C++ version copies the iterator instead; no flatten or zigzag (*read*) · fetched 2026-10-15
- **Our delta:** the peeking iterator with a cached head, flattening nested lists with a stack, zigzag over k lists, and lazy against eager.

### T17-09 · Small APIs over deques and stacks — Understand · 🔲 not written
- **Read this:** [Double-ended queue](https://en.wikipedia.org/wiki/Double-ended_queue) · Wikipedia · deque operations and its doubly-linked-list and dynamic-array implementations (*headings only*) · covers our angle: **partial** — no snake, history or undo design · fetched 2026-10-14
- **Also good:** [Bags, Queues, and Stacks](https://algs4.cs.princeton.edu/13stacks/) · Sedgewick and Wayne, Princeton · the exercises model a text-editor buffer as two stacks, the left and right of the cursor (*read*) · fetched 2026-10-14
- **Also good:** [353. Design Snake Game](https://walkccc.me/LeetCode/problems/0353/) · walkccc · code only: a deque for the body and a hash set of cell ids for O(1) self-collision, removing the old tail before adding the new head (*read*) · fetched 2026-10-15
- **Also good:** [1472. Design Browser History](https://walkccc.me/LeetCode/problems/1472/) · walkccc · code only: array with a last index, two stacks, doubly linked list (*read*) · fetched 2026-10-15
- **Our delta:** the snake game, browser history and a text editor with undo, each as a small API over a deque or two stacks.

### T17-10 · Autocomplete system — Understand · 🔲 not written
- **Read this:** [System Design: Typeahead / Search Autocomplete](https://techinterview.org/system-design-typeahead/) · techinterview.org · top-K stored per trie node so serving costs O(prefix length), against a naive subtree walk; updates must refresh every ancestor, done asynchronously (*read*) · covers our angle: **partial** — system-design level, not the LeetCode 642 coding version · fetched 2026-10-15
- **Also good:** [642. Design Search Autocomplete System](https://leetcode.doocs.org/en/lc/642/) · doocs · the coding-round version: a trie with a heat count per sentence and a walk of the subtree under the prefix per query (not top-K per node); Python and Java (*read*) · fetched 2026-10-15
- **Our delta:** the in-memory TypeScript trie with top-k per node and frequency updates.

### T17-11 · An in-memory file system and a key-value store with transactions — Understand · 🔲 not written
- **Read this:** [588. Design In-Memory File System](https://leetcode.doocs.org/en/lc/588/) · doocs · a trie keyed by path segments with a child map per node, contrasted with a flat map of full paths; Python, Java, Go (*read*) · covers our angle: **partial** — nothing on transactions or an undo log · fetched 2026-10-15
- **Also good:** [Design an in-memory database to handle transactions](https://www.hellointerview.com/community/questions/memory-database-transactions/cm6uaoy1y00003b6la4jojd7s) · Hello Interview community answer · a stack of dictionaries, one per open transaction, storing the new and previous value so rollback can restore; nested commit merges into the parent frame; Python; its rollback treats a stored None as absent, which is a bug to avoid with a sentinel (*read*) · covers the key-value half only · fetched 2026-10-15
- **Our delta:** trees of maps for the file system, and a vetted begin, commit and rollback store with an absent-key sentinel, in TypeScript.

### T17-12 · The quick classics — Understand · 🔲 not written
- **Read this:** [348. Design Tic-Tac-Toe](https://helloacm.com/how-to-design-a-tic-tac-toe-game/) · helloacm · a naive O(N squared) board scan against O(N) space of per-row, per-column and diagonal counts for O(1) per move (*read*) · covers our angle: **partial** — logger and leaderboard not covered; C++ · fetched 2026-10-15
- **Also good:** [359. Logger Rate Limiter](https://leetcode.doocs.org/en/lc/359/) · doocs · a hash table of message to next allowed print time, O(1) per call, O(m) space; Python, Java, C++, Go, JavaScript (*read*) · fetched 2026-10-15
- **Our delta:** the leaderboard, API design under a clock, TypeScript.

### T17-13 · Building the primitives — Understand · 🔲 not written
- **Read this:** [Skip list](https://en.wikipedia.org/wiki/Skip_list) · Wikipedia · layered linked lists where a search drops down a level when it overshoots, giving expected logarithmic search (*read*) · fetched 2026-10-14
- **Also good:** [Hashing with separate chaining](https://web.cs.wpi.edu/~heineman/html/teaching_/cs2223/b15/days/day12.html) · WPI CS 2223 · a Java SeparateChainingHashST that doubles the table when the average chain length reaches 7, and the rehash cost of a resize (*read*) · fetched 2026-10-15
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · load factor for chaining and for open addressing, hash functions and resizing (*headings only*) · fetched 2026-10-14
- **Our delta:** a hash map and set from scratch with resizing, and an interview-sized skip list, in TypeScript — the structures interviewers ask you to implement rather than use.

### T17-14 · Concurrency problems in Java — Understand · 🔲 not written
- **Read this:** [Condition](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/locks/Condition.html) · Oracle Java SE 21 API · await and signal on a lock; the class description builds a BoundedBuffer with two conditions, notFull and notEmpty (*read*) · covers our angle: **partial** — the primitive, not the problem set · fetched 2026-10-14
- **Also good:** [1114. Print in Order](https://leetcode.doocs.org/en/lc/1114/) · doocs · three semaphores force the order, Java solution (also Python and C++) (*read*) · fetched 2026-10-15
- **Also good:** [1188. Design Bounded Blocking Queue](https://leetcode.doocs.org/en/lc/1188/) · doocs · the bounded buffer with two semaphores (free slots and items), Java, Python, C++; no locks or conditions (*read*) · fetched 2026-10-15
- **Also good:** [Lock Objects](https://docs.oracle.com/javase/tutorial/essential/concurrency/newlocks.html) · Oracle Java Tutorials · Lock, tryLock backing out, and the Safelock example that avoids deadlock by acquiring both locks or neither (*read*) · fetched 2026-10-15
- **Also good:** [ArrayBlockingQueue](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ArrayBlockingQueue.html) · Oracle Java SE 21 API · describes itself as a classic bounded buffer with fixed capacity, the library version to compare your own against (*read*) · fetched 2026-10-14
- **Also good:** [Dining philosophers problem](https://en.wikipedia.org/wiki/Dining_philosophers_problem) · Wikipedia · the problem, then Dijkstra's, resource-hierarchy, arbitrator and Chandy/Misra solutions (*headings only*) · fetched 2026-10-14
- **Our delta:** print in order, the bounded buffer, dining philosophers and a thread-safe counter, with locks, conditions and atomics used correctly.

### T17-15 · The boundary with low-level design — Know · 🔲 not written
- **Read this:** [What to expect in a low-level design interview round](https://www.designgurus.io/answers/detail/what-to-expect-in-a-low-level-design-interview-round) · DesignGurus · lists what an LLD round evaluates (object-oriented principles, design patterns, class structure, database and API design) but does not contrast it with a coding round (*read*) · covers our angle: **partial** — vendor page, no catalogue of when a design coding question is really LLD · fetched 2026-10-15
- **Our delta:** how to tell a "design X" coding question from the LLD round in disguise, and where the System Design track's catalogue picks up. A search for a source that draws this line found only interview anecdotes, so none is listed.

---

## Phase 18 — The algorithms behind the systems you run

### T18-01 · Consistent hashing — Master · 🔲 not written
- **Read this:** [Consistent Hashing Explained](https://blog.algomaster.io/p/consistent-hashing-explained) · AlgoMaster · why hash mod N reshuffles most keys, the hash ring, adding and removing a node, virtual nodes, and a sorted list of hashes searched with bisect, wrapping to the first node; Python explained, Java linked (*read*) · covers our angle: **full** for the ring and successor search; no TypeScript · fetched 2026-10-15
- **Also good:** [Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) · Wikipedia · only n/m keys move on a resize, each key goes to the next server clockwise on the circle found by binary search in O(log N) or a BST successor, and virtual nodes even out the spread (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Consistent Hashing](https://tom-e-white.com/2007/11/consistent-hashing.html) · Tom White, Nov 27, 2007 · virtual nodes as replicas on the circle, with a plot of the spread, and a Java implementation on a TreeMap whose tailMap finds the successor (*read*) · fetched 2026-10-14
- **Our delta:** the ring as a sorted array of points with binary search for the successor, virtual nodes, and what a node join or leave moves.

### T18-02 · Joins in PostgreSQL — Master · 🔲 not written
- **Read this:** [Planner/Optimizer](https://www.postgresql.org/docs/current/planner-optimizer.html) · PostgreSQL docs · the three join strategies: nested loop, merge join (both relations sorted on the join keys, then scanned in parallel) and hash join (right relation loaded into a hash table, left relation probes it) (*read*) · covers our angle: **partial** — the strategies, not cost per algorithm in big-O terms · fetched 2026-10-14
- **Also good:** [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) · PostgreSQL docs · reading plan nodes and their estimated costs (*headings only*) · fetched 2026-10-14
- **Also good:** [Hash join](https://en.wikipedia.org/wiki/Hash_join) · Wikipedia · build and probe phases, and why it needs an equality predicate (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Join Operations](https://use-the-index-luke.com/sql/join) · Markus Winand, Use The Index, Luke · nested loops, hash join and sort-merge join ("like a zipper on two sorted sets"), each with the index that helps it (*read*) · fetched 2026-10-14
- **Our delta:** the three joins as the nested loop, hash map and sorted two-pointer merge you already wrote, with the plan read through them.

### T18-03 · Index structures — Master · 🔲 not written
- **Read this:** [B-Tree Indexes](https://www.postgresql.org/docs/current/btree.html) · PostgreSQL docs · the standard multi-way balanced tree, its operator classes and support functions, and implementation notes such as deduplication (*read*) · covers our angle: **partial** — the index, not the binary-search-over-pages framing · fetched 2026-10-14
- **Also good:** [GIN Indexes](https://www.postgresql.org/docs/current/gin.html) · PostgreSQL docs · the Generalized Inverted Index, with tsvector among its built-in operator classes and a fast-update technique because inverted-index updates are slow (*read*) · fetched 2026-10-14
- **Also good:** [GiST Indexes](https://www.postgresql.org/docs/current/gist.html) · PostgreSQL docs · the generalised search tree on which R-trees and other schemes for geometry and ranges are built (*read*) · fetched 2026-10-14
- **Also good:** [B-tree](https://en.wikipedia.org/wiki/B-tree) · Wikipedia · more than two children per node keeps the height low, which matters for storage read in large blocks (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Search Tree (B-Tree) Makes the Index Fast](https://use-the-index-luke.com/sql/anatomy/the-tree) · Markus Winand, Use The Index, Luke · leaf nodes in a doubly linked list, root and branch nodes for searching among them, drawn for a 30-entry index (*read*) · fetched 2026-10-14
- **Our delta:** B-tree lookup as binary search over pages, the inverted index and the generalised tree, and what changes at ten times the data.

### T18-04 · Explaining a complexity trade-off as a senior — Master · 🔲 not written
- **Read this:** [Space Time Trade Off Discussions](https://algomaster.io/learn/dsa/space-time-trade-off-discussions) · AlgoMaster · a table of approaches by time, space and when to use each, a spoken script ("I see three approaches... which constraint should I optimize for?"), cache locality, and six trade-off patterns (*read*) · covers our angle: **partial** — interview-prep framing, no failure modes or tail latency · fetched 2026-10-15
- **Also good:** [1.5 Correctness, Time Complexity, and Space Complexity](https://www.opendatastructures.org/ods-cpp/1_5_Correctness_Time_Comple.html) · Open Data Structures · worst-case, amortized and expected running times defined, with a mortgage analogy for amortized cost (*read*) · fetched 2026-10-15
- **Our delta:** the one-sentence form that names the bound, the constant, the memory and the failure mode.

### T18-05 · Rate-limiter algorithms in production — Understand · 🔲 not written
- **Read this:** [Counting things, a lot of different things](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/) · Cloudflare blog · replaces a fixed window with a sliding window estimated from the previous and current window (42 × 0.75 + 18 in their example), using only GET, SET and INCR on a shared store, and accepts the approximation (*read*) · covers our angle: **full** for the accuracy-for-cost trade · fetched 2026-10-14
- **Also good:** [Build 5 Rate Limiters with Redis](https://redis.io/tutorials/howtos/ratelimiting/) · Redis · why atomic Lua scripts beat MULTI and WATCH, the cluster same-slot constraint solved with hash tags, and a table of memory per client against accuracy for each algorithm (*read*) · fetched 2026-10-15
- **Also good:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe engineering blog · token bucket with a centralised bucket host (*read*) · fetched 2026-10-14
- **Our delta:** token bucket against sliding window with a shared store, and the accuracy traded for cost.

### T18-06 · Bloom filters — Understand · 🔲 not written
- **Read this:** [Bloom filter](https://en.wikipedia.org/wiki/Bloom_filter) · Wikipedia · "possibly in set" or "definitely not in set", no removal without the counting variant, and sections on the false-positive probability and the optimal number of hash functions (*read*) · covers our angle: **partial** — maths there, not the storefront placements · fetched 2026-10-14
- **Also good:** [Bloom filter](https://redis.io/docs/latest/develop/data-types/probabilistic/bloom-filter/) · Redis docs · the structure as a shipped data type, BF.ADD and BF.EXISTS at O(k) for k hash functions (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Bloom Filters by Example](https://llimllib.github.io/bloomfilter-tutorial/) · llimllib.github.io · an interactive bit vector: add strings, watch the bits set, test membership, then size the filter for a target false-positive rate (*read*) · fetched 2026-10-14
- **Our delta:** bit array and k hashes with the false-positive arithmetic, in caches, crawlers and storage engines. Phase 2 (`docs/dsa/pages/phase-2-recursion-maths-bits/10i-why-add-randomness.md`) covers only the no-false-negatives asymmetry.

### T18-07 · Count-min sketch, HyperLogLog and streaming top-k — Understand · 🔲 not written
- **Read this:** [Count–min sketch](https://en.wikipedia.org/wiki/Count%E2%80%93min_sketch) · Wikipedia · a table of counters under several hashes; the min estimator is biased and may over-estimate, never under-estimate (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [HyperLogLog](https://en.wikipedia.org/wiki/HyperLogLog) · Wikipedia · distinct-count estimation in far less memory than an exact count, which needs memory proportional to the cardinality (*read*) · fetched 2026-10-14
- **Also good:** [Top-K](https://redis.io/docs/latest/develop/data-types/probabilistic/top-k/) · Redis docs · streaming heavy hitters as a shipped type, implemented on HeavyKeeper, compared with count-min sketch (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Redis new data structure: the HyperLogLog](https://antirez.com/news/75) · Salvatore Sanfilippo (antirez) · why the Redis implementation counts any number of items in 12k bytes with a 0.81% standard error (*read*) · fetched 2026-10-14
- **Our delta:** counting at a fraction of the memory and the error you accept for each of the three.

### T18-08 · Reservoir sampling — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/10h-reservoir-sampling.md`
- **Read this:** [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling) · Wikipedia · Algorithm R for a stream of unknown length, an induction for the single-slot case, and the skipping and weighted variants (*read*) · covers our angle: **partial** — the algorithm and variants; the induction is given for one slot and only sketched for k · fetched 2026-10-14
- **Beyond the docs:** [Reservoir Sampling](https://jtobin.io/reservoir-sampling) · Jared Tobin · Haskell implementation and benchmark of Algorithm R and a skip-based variant (about 65x faster), but no uniformity proof (*read*) · fetched 2026-10-15
- **Our delta:** the whole algorithm as accept the i-th item with probability k/i, with the induction for k slots derived rather than cited; the logging and experiment uses are syllabus-only.

### T18-09 · External sort and the k-way merge — Understand · 🔲 not written
- **Read this:** [External sorting](https://en.wikipedia.org/wiki/External_sorting) · Wikipedia · external merge sort: sort runs that fit in memory, then merge them, with extra passes when there are too many runs (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [K-way merge algorithm](https://en.wikipedia.org/wiki/K-way_merge_algorithm) · Wikipedia · the heap or tournament-tree merge, with a section on its use in external sorting (*read*) · fetched 2026-10-14
- **Our delta:** sorting what does not fit in memory, with the same merge as the heap problems.

### T18-10 · Diffing — Understand · 🔲 not written
- **Read this:** [An O(ND) Difference Algorithm and Its Variations](http://www.xmailserver.org/diff2.pdf) · Eugene Myers, 1986 · the shortest edit script as a shortest path in an edit graph, in O(ND) time, fast when the two sequences are similar (*read*) · covers our angle: **partial** — no React side · fetched 2026-10-14
- **Also good:** [git-diff](https://git-scm.com/docs/git-diff) · Git docs · `--diff-algorithm` lists myers, "the basic greedy diff algorithm", as the current default, beside minimal, patience and histogram (*read*) · fetched 2026-10-14
- **Also good:** [Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html) · React legacy docs · a heuristic O(n) diff on two assumptions: elements of different types rebuild the subtree, and keys mark children stable across renders (*read*) · fetched 2026-10-14
- **Also good:** [Edit distance](https://en.wikipedia.org/wiki/Edit_distance) · Wikipedia · the exact quantity, with Levenshtein and the other operation sets (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [The Myers diff algorithm: part 1](https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/) · James Coglan, Feb 12, 2017 · the paper walked through step by step on a small example, by the author of Building Git (*read*) · fetched 2026-10-14
- **Our delta:** Myers in git, the React heuristics, and edit distance with the engineering compromises.

### T18-11 · The inverted index — Understand · 🔲 not written
- **Read this:** [A first take at building an inverted index](https://nlp.stanford.edu/IR-book/html/htmledition/a-first-take-at-building-an-inverted-index-1.html) · Manning, Raghavan and Schütze, Introduction to Information Retrieval · tokenise, normalise, then sort-based indexing into a dictionary and a postings list of docIDs per term (*read*) · covers our angle: **partial** — building, with intersection and ranking in neighbouring sections · fetched 2026-10-14
- **Also good:** [Faster postings list intersection via skip pointers](https://nlp.stanford.edu/IR-book/html/htmledition/faster-postings-list-intersection-via-skip-pointers-1.html) · Stanford IR book · skip pointers as shortcuts when intersecting sorted postings lists, which only helps AND queries, and the trade-off in where to place them (*read*) · fetched 2026-10-15
- **Also good:** [Inverted index](https://en.wikipedia.org/wiki/Inverted_index) · Wikipedia · record-level against word-level indexes, and the structure's place in search engines (*read*) · fetched 2026-10-14
- **Our delta:** tokens to postings, intersecting sorted lists with two pointers, and ranking.

### T18-12 · Scheduling — Understand · 🔲 not written
- **Read this:** [The Node.js Event Loop](https://nodejs.org/learn/asynchronous-work/event-loop-timers-and-nexttick) · Node.js docs · the timers phase runs callbacks whose threshold has passed, and that since libuv 1.45 (Node 20) timers run after the poll phase rather than before it (*read*) · covers our angle: **partial** — behaviour, not the timer structure · fetched 2026-10-14
- **Also good:** [lib/internal/timers.js](https://github.com/nodejs/node/blob/main/lib/internal/timers.js) · Node.js source · the header comment: one linked list of timeouts per duration, ordered by a PriorityQueue that is a binary heap with O(log n) operations (*read*) · fetched 2026-10-14
- **Also good:** [Priority queue](https://en.wikipedia.org/wiki/Priority_queue) · Wikipedia · the heap behind a job runner (*headings only*) · fetched 2026-10-14
- **Also good:** [Cron](https://en.wikipedia.org/wiki/Cron) · Wikipedia · the schedule-expression side (*headings only*) · fetched 2026-10-14
- **Our delta:** cron plus a heap of next-run times, and the timer structure inside Node's loop.

### T18-13 · Topological sort in build tools and package managers — Understand · 🔲 not written
- **Read this:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · DFS that records vertices by exit time, giving the order reversed, and why a cycle makes an order impossible; the code assumes an acyclic graph and defers the cycle check to the depth-first search article (*read*) · covers our angle: **partial** — no build or package-manager context, no cycle reporting · fetched 2026-10-14
- **Also good:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · an order exists exactly when the graph is a DAG, with Kahn's algorithm and the DFS one (*read*) · fetched 2026-10-14
- **Our delta:** dependency resolution with cycles reported as errors.

### T18-14 · Radix trees in HTTP routers — Understand · 🔲 not written
- **Read this:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · a compressed trie whose edges carry sequences, edge splitting on insert, and its use in IP routing (*read*) · covers our angle: **partial** — no HTTP routing · fetched 2026-10-14
- **Also good:** [Routing](https://expressjs.com/en/guide/routing/) · Express docs · route paths as strings or regular expressions with parameters; Express uses path-to-regexp v8 to match them, and the page does not mention a radix tree (*read*) · fetched 2026-10-14
- **Beyond the docs:** [httprouter](https://github.com/julienschmidt/httprouter) · Julien Schmidt, README · how a Go router stores routes in a compact prefix tree (radix tree) and why it scales with long paths and many routes (*read*) · fetched 2026-10-14
- **Beyond the docs:** [find-my-way](https://github.com/delvedor/find-my-way) · Tomas Della Vedova, README · a framework-independent Node router that walks a radix tree on every lookup, with params and wildcards (*read*) · fetched 2026-10-14
- **Our delta:** how Express-style routers and their radix-tree successors match a path.

### T18-15 · Sampled LRU in Redis — Know · 🔲 not written
- **Read this:** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · Redis docs · the LRU is an approximation: it samples a few random keys and evicts the one idle longest, keeps a pool of good candidates since Redis 3.0, is tuned by maxmemory-samples, and is chosen because true LRU costs more memory (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Random notes on improving the Redis LRU algorithm](https://antirez.com/news/109) · Salvatore Sanfilippo (antirez) · why the plain sampler threw away good candidates and how the candidate pool fixed it (*read*) · fetched 2026-10-14
- **Our delta:** why production eviction approximates the textbook list-plus-map.

### T18-16 · Shortest paths in maps — Know · 🔲 not written
- **Read this:** [Contraction Hierarchies, illustrated](https://www.mjt.me.uk/posts/contraction-hierarchies/) · Mike Taylor, 12 Jun 2015 · contract nodes one at a time adding shortcuts, then a bidirectional Dijkstra-like query that only follows edges to higher-ranked nodes; a UK road-network run of 18 ms per query after 55 minutes of preprocessing (*read*) · covers our angle: **full** · fetched 2026-10-15
- **Also good:** [Contraction hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies) · Wikipedia · a speed-up for road networks that adds shortcut edges in a preprocessing phase so the query phase searches far less (*read*) · fetched 2026-10-14
- **Also good:** [Dijkstra - finding shortest paths from given vertex](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms · the baseline being sped up (*headings only*) · fetched 2026-10-14
- **Our delta:** Dijkstra at scale, precomputation, and contraction hierarchies as the idea.

### T18-17 · Union-find in networking and clustering — Know · 🔲 not written
- **Read this:** [Disjoint Set Union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · the structure built up from the naive version through path compression and union by size or rank (*headings only*) · covers our angle: **partial** — has an applications section led by connected components of a graph, but nothing on networking, clustering or merging accounts · fetched 2026-10-14
- **Also good:** [Disjoint-set data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure) · Wikipedia · an applications section led by Kruskal's minimum spanning tree (*read*) · fetched 2026-10-14
- **Our delta:** connectivity checks and merging duplicate accounts; the structure itself is covered in phase 1 (`docs/dsa/pages/phase-1-complexity/03b-union-find-and-the-limits-of-amortised.md`), not the applications.

### T18-18 · Rolling hashes in practice — Know · 🔲 not written
- **Read this:** [Foundation - Introducing Content Defined Chunking (CDC)](https://restic.net/blog/2015-09-12/restic-foundation1-cdc/) · restic blog, 12 Sep 2015 · why fixed-size chunks break on an insert, and how a rolling Rabin fingerprint over a 64-byte window marks a boundary where the lowest 21 bits are zero, so duplicate chunks are found by their SHA-256 (*read*) · covers our angle: **partial** — no cache keys · fetched 2026-10-14
- **Also good:** [Rolling hash](https://en.wikipedia.org/wiki/Rolling_hash) · Wikipedia · a hash updated as a window slides, with sections on content-defined chunking and the Gear and FastCDC hashes used for it (*headings only*) · fetched 2026-10-14
- **Also good:** [Rabin fingerprint](https://en.wikipedia.org/wiki/Rabin_fingerprint) · Wikipedia · fingerprints as polynomial remainders over GF(2); MIT's LBFS uses them for variable-size chunks (*read*) · fetched 2026-10-14
- **Also good:** [String Hashing](https://cp-algorithms.com/string/string-hashing.html) · cp-algorithms · polynomial hashing details (*headings only*) · fetched 2026-10-14
- **Also good:** [FastCDC (USENIX ATC '16)](https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia) · USENIX · the Gear-hash chunker, about 10x faster than Rabin-based and 3x faster than other fast chunkers (abstract) (*read*) · fetched 2026-10-15
- **Our delta:** content-defined chunking, deduplication and cache keys.

---

← [Part 7 syllabus](../syllabus/07-design-flavoured-and-applied.md)
