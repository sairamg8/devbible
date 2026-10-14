---
title: "Link map · DSA · Part 7 (phases 17-18), file 2"
sidebar_label: "07 · design-flavoured, applied (2)"
sidebar_position: 7
---

# Link map · Part 7, file 2 (phase 18, rows T18-01 to T18-09)

Covers the first nine rows of phase 18. *read* = I read the passage that supports the claim; *headings only* = fetched at HTTP 200 and the headings or topic checked.

### T18-01 · Consistent hashing — Master · 🔲 not written
- **Read this:** [Consistent Hashing Explained](https://blog.algomaster.io/p/consistent-hashing-explained) · AlgoMaster · hash ring, virtual nodes, and a sorted list of hashes searched with bisect, wrapping to the first node; Python explained, Java linked · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) · Wikipedia · history (Karger et al.), virtual nodes and rendezvous hashing as the alternative · fetched 2026-10-14 (*headings only*)

### T18-02 · Joins in PostgreSQL — Master · 🔲 not written
- **Read this:** [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) · PostgreSQL docs · real plans for Nested Loop (inner side run once per outer row), Hash Join (build an in-memory hash table, probe with the other table) and Merge Join (inputs sorted on the join keys), plus one cost comparison made by switching merge join off · covers our angle: **partial** - reads plans but does not compare the three algorithms' big-O costs · fetched 2026-10-14 (*read*)
- **Our delta:** the cost comparison tied to the algorithms from the sorting and hashing phases.

### T18-03 · Index structures — Master · 🔲 not written
- **Read this:** [B-Tree Indexes](https://www.postgresql.org/docs/current/btree.html) · PostgreSQL docs · multi-level tree of pages, page splits that cascade up to a root split, deduplication into posting lists · covers our angle: **partial** - inverted index and GiST are separate pages, and the binary-search-over-pages framing is ours · fetched 2026-10-14 (*read*)
- **Also good:** [GIN Indexes](https://www.postgresql.org/docs/current/gin.html) · PostgreSQL docs · the inverted index: a set of key and posting-list pairs, with a posting tree when a list is large · fetched 2026-10-14 (*read*)
- **Also good:** [GiST Indexes](https://www.postgresql.org/docs/current/gist.html) · PostgreSQL docs · a balanced tree that acts as a template for arbitrary indexing schemes, with R-tree behaviour for geometric types · fetched 2026-10-14 (*read*)
- **Our delta:** the lookup as binary search across pages.

### T18-04 · Explaining a complexity trade-off as a senior — Master · 🔲 not written
- **Read this:** [Space Time Trade Off Discussions](https://algomaster.io/learn/dsa/space-time-trade-off-discussions) · AlgoMaster · a table of approaches by time, space and when to use each, a spoken script ("I see three approaches... which constraint should I optimize for?"), cache locality, and six trade-off patterns · covers our angle: **partial** - interview-prep framing, no failure modes or tail latency · fetched 2026-10-14 (*read*)
- **Also good:** [1.5 Correctness, Time Complexity, and Space Complexity](https://www.opendatastructures.org/ods-cpp/1_5_Correctness_Time_Comple.html) · Open Data Structures · worst-case, amortized and expected running times defined, with a mortgage analogy for amortized cost · fetched 2026-10-14 (*read*)
- **Our delta:** the senior sentence itself (bound, constant, memory, failure mode); searches found no write-up that names the failure mode (tried: explaining time complexity trade-offs senior engineer interview, amortized worst case tail latency trade-off).

### T18-05 · Rate-limiter algorithms in production — Understand · 🔲 not written
- **Read this:** [Build 5 Rate Limiters with Redis](https://redis.io/tutorials/howtos/ratelimiting/) · Redis · why atomic Lua scripts beat MULTI and WATCH, cluster same-slot constraint solved with hash tags, and a table of memory per client against accuracy per algorithm · covers our angle: full · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe · a token bucket on Redis plus load shedders, from an operator's view · fetched 2026-10-14 (*read*)

### T18-06 · Bloom filters — Understand · 🔲 not written
- **Read this:** [Bloom Filters by Example](https://llimllib.github.io/bloomfilter-tutorial/) · llimllib · bit array and hashes walked through; states the false-positive rate (1 - e to the minus kn/m) to the k and the optimal k of (m/n) ln 2 · covers our angle: **partial** - states the arithmetic without deriving it · fetched 2026-10-14 (*read*)
- **Also good:** [Bloom filter](https://en.wikipedia.org/wiki/Bloom_filter) · Wikipedia · the math, plus uses such as Squid caches and Bigtable · fetched 2026-10-14 (*headings only*)
- **Our delta:** the derivation and uses in caches, crawlers and storage engines.

### T18-07 · Count-min sketch, HyperLogLog and streaming top-k — Understand · 🔲 not written
- **Read this:** [Count-min sketch](https://en.wikipedia.org/wiki/Count%E2%80%93min_sketch) · Wikipedia · point query as the minimum across hashed rows, width from e over epsilon and depth from ln of 1 over delta · covers our angle: **partial** - no heavy hitters or streaming top-k with a heap on the page · fetched 2026-10-14 (*read*)
- **Also good:** [HyperLogLog](https://redis.io/docs/latest/develop/data-types/probabilistic/hyperloglogs/) · Redis docs · distinct counting in at most 12 KB with 0.81 percent standard error; PFADD, PFCOUNT, PFMERGE · fetched 2026-10-14 (*read*)
- **Our delta:** sketch plus min-heap for top-k.

### T18-08 · Reservoir sampling — Understand · 🔲 not written
- **Read this:** [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling) · Wikipedia · Algorithm R in prose, an inductive proof of uniformity, and the faster variants · covers our angle: **partial** - no TypeScript, the proof is terse, logging and experiment uses are thin · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Reservoir Sampling](https://jtobin.io/reservoir-sampling) · Jared Tobin · Haskell implementation and benchmark of Algorithm R and a skip-based variant (about 65x faster), but no uniformity proof · fetched 2026-10-14 (*read*)
- **Our delta:** a plain-language survival-probability walkthrough and TypeScript.

### T18-09 · External sort and the k-way merge — Understand · 🔲 not written
- **Read this:** [External sorting](https://en.wikipedia.org/wiki/External_sorting) · Wikipedia · sort RAM-sized chunks then k-way merge, with the external-memory I/O cost model and pass counts · covers our angle: **partial** - no heap or priority-queue merge anywhere on the page · fetched 2026-10-14 (*read*)
- **Our delta:** the heap merge, tied to merge k sorted lists.
