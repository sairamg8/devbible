---
title: "Link map · DSA · Part 7 (phases 17-18), file 2"
sidebar_label: "07 · design-flavoured, applied (2)"
sidebar_position: 7
---

# Link map · Part 7, file 2 (phase 18, rows T18-01 to T18-09)

Covers the first nine rows of phase 18. *read* = I read the passage that supports the claim; *headings only* = fetched at HTTP 200 and the headings or topic checked.

### T18-01 · Consistent hashing — Master · 🔲 not written
- **Read this:** [Consistent Hashing Explained](https://blog.algomaster.io/p/consistent-hashing-explained) · AlgoMaster · hash ring, virtual nodes, and a sorted list of hashes searched with bisect · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) · Wikipedia · history and variants · fetched 2026-10-14 (*headings only*)

### T18-02 · Joins in PostgreSQL — Master · 🔲 not written
- **Read this:** [Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) · PostgreSQL docs · real plans showing Nested Loop, Hash Join and Merge Join with what each node does · covers our angle: **partial** - reads plans but does not compare the three algorithms' costs · fetched 2026-10-14 (*read*)
- **Our delta:** the cost comparison tied to the algorithms from the sorting and hashing phases.

### T18-03 · Index structures — Master · 🔲 not written
- **Read this:** [B-Tree Indexes](https://www.postgresql.org/docs/current/btree.html) · PostgreSQL docs · multi-level balanced tree of pages, page splits, deduplication into posting lists · covers our angle: **partial** - inverted index and GiST are separate pages, and the binary-search-over-pages framing is ours · fetched 2026-10-14 (*read*)
- **Also good:** [GIN Indexes](https://www.postgresql.org/docs/current/gin.html) · PostgreSQL docs · the inverted index · fetched 2026-10-14 (*headings only*)
- **Also good:** [GiST Indexes](https://www.postgresql.org/docs/current/gist.html) · PostgreSQL docs · generalised search trees · fetched 2026-10-14 (*headings only*)
- **Our delta:** the lookup as binary search across pages.

### T18-04 · Explaining a complexity trade-off as a senior — Master · 🔲 not written
- **Read this:** none found - tried: explaining time complexity trade-offs senior engineer interview communicate space time trade-off (only generic course pages that restate state-the-complexity advice)

### T18-05 · Rate-limiter algorithms in production — Understand · 🔲 not written
- **Read this:** [Build 5 Rate Limiters with Redis](https://redis.io/tutorials/howtos/ratelimiting/) · Redis · atomic Lua scripts, cluster slot constraints, and a table of accuracy against memory per algorithm · covers our angle: full · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe · a token bucket on Redis plus load shedders, from an operator's view · fetched 2026-10-14 (*read*)

### T18-06 · Bloom filters — Understand · 🔲 not written
- **Read this:** [Bloom Filters by Example](https://llimllib.github.io/bloomfilter-tutorial/) · llimllib · interactive walk-through of bit array and hashes; states the false-positive formula and optimal k · covers our angle: **partial** - states the arithmetic without deriving it · fetched 2026-10-14 (*read*)
- **Also good:** [Bloom filter](https://en.wikipedia.org/wiki/Bloom_filter) · Wikipedia · the math and applications · fetched 2026-10-14 (*headings only*)
- **Our delta:** the derivation and uses in caches, crawlers and storage engines.

### T18-07 · Count-min sketch, HyperLogLog and streaming top-k — Understand · 🔲 not written
- **Read this:** [Count-min sketch](https://en.wikipedia.org/wiki/Count%E2%80%93min_sketch) · Wikipedia · data structure, point query and error bounds · covers our angle: **partial** - streaming top-k with a heap is not on the page · fetched 2026-10-14 (*headings only*)
- **Also good:** [HyperLogLog](https://redis.io/docs/latest/develop/data-types/probabilistic/hyperloglogs/) · Redis docs · distinct counting in a fixed small memory · fetched 2026-10-14 (*headings only*)
- **Our delta:** sketch plus min-heap for top-k.

### T18-08 · Reservoir sampling — Understand · 🔲 not written
- **Read this:** [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling) · Wikipedia · Algorithm R and its variants · covers our angle: **partial** - not TypeScript, logging and experiment uses thin · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [Reservoir Sampling](https://jtobin.io/reservoir-sampling) · Jared Tobin · implementation and benchmark of Algorithm R, though it gives no uniformity proof · fetched 2026-10-14 (*read*)
- **Our delta:** the survival-probability proof.

### T18-09 · External sort and the k-way merge — Understand · 🔲 not written
- **Read this:** [External sorting](https://en.wikipedia.org/wiki/External_sorting) · Wikipedia · sort RAM-sized chunks then k-way merge, with the I/O cost model · covers our angle: **partial** - no heap-based merge code · fetched 2026-10-14 (*read*)
- **Our delta:** the heap merge, tied to merge k sorted lists.
