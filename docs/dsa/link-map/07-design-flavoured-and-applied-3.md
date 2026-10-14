---
title: "Link map · DSA · Part 7 (phases 17-18), file 3"
sidebar_label: "07 · design-flavoured, applied (3)"
sidebar_position: 7
---

# Link map · Part 7, file 3 (phase 18, rows T18-10 to T18-18)

Covers the last nine rows of phase 18. *read* = I read the passage that supports the claim; *headings only* = fetched at HTTP 200 and the headings or topic checked.

### T18-10 · Diffing — Understand · 🔲 not written
- **Read this:** [The Myers diff algorithm: part 1](https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/) · James Coglan · the shortest edit script as a graph search, worked example, no code · covers our angle: **partial** - React reconciliation is elsewhere · fetched 2026-10-14 (*read*)
- **Also good:** [Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html) · React legacy docs · the two heuristics and why keys matter · fetched 2026-10-14 (*read*)
- **Our delta:** edit distance as the dynamic-programming bridge.

### T18-11 · The inverted index — Understand · 🔲 not written
- **Read this:** [A first take at building an inverted index](https://nlp.stanford.edu/IR-book/html/htmledition/a-first-take-at-building-an-inverted-index-1.html) · Stanford IR book · dictionary and postings sorted by document id · covers our angle: **partial** - intersection and ranking are on other pages · fetched 2026-10-14 (*read*)
- **Also good:** [Faster postings list intersection via skip pointers](https://nlp.stanford.edu/IR-book/html/htmledition/faster-postings-list-intersection-via-skip-pointers-1.html) · Stanford IR book · intersecting sorted lists · fetched 2026-10-14 (*headings only*)
- **Our delta:** ranking and a TypeScript version.

### T18-12 · Scheduling — Understand · 🔲 not written
- **Read this:** [The Node.js Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) · Node.js docs · the timers phase and ordering · covers our angle: **partial** - does not describe how timers are stored · fetched 2026-10-14 (*headings only*)
- **Our delta:** the heap or priority queue inside a job runner and in Node's timers; the Node source on GitHub returned 403 so it is not listed.

### T18-13 · Topological sort in build tools and package managers — Understand · 🔲 not written
- **Read this:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · depth-first ordering, an order exists only without cycles · covers our angle: **partial** - no build-tool use, no cycle reporting · fetched 2026-10-14 (*read*)
- **Also good:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · Kahn's algorithm and applications · fetched 2026-10-14 (*headings only*)
- **Our delta:** reporting the cycle path as an error, the package manager framing.

### T18-14 · Radix trees in HTTP routers — Understand · 🔲 not written
- **Read this:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · the compressed prefix tree and its operations · covers our angle: **partial** - nothing on route parameters or Express-style matching · fetched 2026-10-14 (*headings only*)
- **Our delta:** the router use; the httprouter README returned 403 and is not listed.

### T18-15 · Sampled LRU in Redis — Know · 🔲 not written
- **Read this:** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · Redis docs · the approximated LRU, sampling, the candidate pool and maxmemory-samples · covers our angle: full · fetched 2026-10-14 (*read*)

### T18-16 · Shortest paths in maps — Know · 🔲 not written
- **Read this:** [Contraction Hierarchies, illustrated](https://www.mjt.me.uk/posts/contraction-hierarchies/) · Mike Taylor · preprocessing, shortcuts and the bidirectional query, with visualisations · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Contraction hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies) · Wikipedia · definition and references · fetched 2026-10-14 (*headings only*)

### T18-17 · Union-find in networking and clustering — Know · 🔲 not written
- **Read this:** [1.5 Case Study: Union-Find](https://algs4.cs.princeton.edu/15uf/) · Princeton Algorithms · dynamic connectivity, the API and cost model · covers our angle: **partial** - no accounts-merge or clustering use · fetched 2026-10-14 (*headings only*)
- **Our delta:** merging duplicate accounts and single-linkage clustering.

### T18-18 · Rolling hashes in practice — Know · 🔲 not written
- **Read this:** [Foundation - Introducing Content Defined Chunking](https://restic.net/blog/2015-09-12/restic-foundation1-cdc/) · restic · a 64-byte rolling Rabin fingerprint cuts chunks where low bits are zero · covers our angle: **partial** - no cache keys · fetched 2026-10-14 (*read*)
- **Also good:** [Rolling hash](https://en.wikipedia.org/wiki/Rolling_hash) · Wikipedia · polynomial and cyclic-polynomial variants · fetched 2026-10-14 (*headings only*)
- **Also good:** [FastCDC (USENIX ATC '16)](https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia) · USENIX · the faster Gear-hash chunker · fetched 2026-10-14 (*headings only*)
- **Our delta:** Rabin-Karp as the base, cache keys.
