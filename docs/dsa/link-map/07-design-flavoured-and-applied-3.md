---
title: "Link map · DSA · Part 7 (phases 17-18), file 3"
sidebar_label: "07 · design-flavoured, applied (3)"
sidebar_position: 7
---

# Link map · Part 7, file 3 (phase 18, rows T18-10 to T18-18)

Covers the last nine rows of phase 18. *read* = I read the passage that supports the claim; *headings only* = fetched at HTTP 200 and the headings or topic checked.

### T18-10 · Diffing — Understand · 🔲 not written
- **Read this:** [The Myers diff algorithm: part 1](https://blog.jcoglan.com/2017/02/12/the-myers-diff-algorithm-part-1/) · James Coglan · the shortest edit script as a graph search, worked grid example on ABCABBA and CBABAC, no code · covers our angle: **partial** - React reconciliation is elsewhere · fetched 2026-10-14 (*read*)
- **Also good:** [Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html) · React legacy docs · general tree diff is O(n cubed), React uses an O(n) heuristic from two assumptions (different types give different trees, keys mark stable children) · fetched 2026-10-14 (*read*)
- **Our delta:** edit distance as the dynamic-programming bridge.

### T18-11 · The inverted index — Understand · 🔲 not written
- **Read this:** [A first take at building an inverted index](https://nlp.stanford.edu/IR-book/html/htmledition/a-first-take-at-building-an-inverted-index-1.html) · Stanford IR book · sort the term and document-id pairs, group into a dictionary and postings sorted by document id · covers our angle: **partial** - intersection and ranking are on other pages · fetched 2026-10-14 (*read*)
- **Also good:** [Faster postings list intersection via skip pointers](https://nlp.stanford.edu/IR-book/html/htmledition/faster-postings-list-intersection-via-skip-pointers-1.html) · Stanford IR book · skip pointers as shortcuts when intersecting sorted lists, about square root of P evenly spaced for a list of length P · fetched 2026-10-14 (*read*)
- **Our delta:** ranking and a TypeScript version.

### T18-12 · Scheduling — Understand · 🔲 not written
- **Read this:** [The Node.js Event Loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick) · Node.js docs · the timers phase, a timer as a threshold not an exact time, setTimeout against setImmediate ordering, and that timers run after the poll phase since libuv 1.45 (Node 20) · covers our angle: **partial** - never says how timers are stored · fetched 2026-10-14 (*read*)
- **Our delta:** the heap or priority queue inside a job runner and in Node's timers. The Node source on GitHub returned 403, and a search for timer internals returned only blog-level descriptions (linked lists per duration) that I could not confirm, so none is listed.

### T18-13 · Topological sort in build tools and package managers — Understand · 🔲 not written
- **Read this:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · depth-first ordering by finish time, an order exists only without cycles, cycle check deferred to the depth-first search article · covers our angle: **partial** - no build-tool use, no cycle reporting · fetched 2026-10-14 (*read*)
- **Also good:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · Kahn's algorithm and applications · fetched 2026-10-14 (*headings only*)
- **Our delta:** reporting the cycle path as an error, the package manager framing.

### T18-14 · Radix trees in HTTP routers — Understand · 🔲 not written
- **Read this:** [httprouter](https://pkg.go.dev/github.com/julienschmidt/httprouter) · julienschmidt/httprouter docs · a compressing dynamic trie (radix tree) for matching, named parameters that match one segment, and catch-all parameters that must come last · covers our angle: **partial** - Go, and nothing on Express-style matching · fetched 2026-10-14 (*read*)
- **Also good:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · the compressed prefix tree and its operations; the routing it mentions is IP, not HTTP · fetched 2026-10-14 (*headings only*)
- **Our delta:** a TypeScript radix router with parameters, and how Express-style routers differ.

### T18-15 · Sampled LRU in Redis — Know · 🔲 not written
- **Read this:** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · Redis docs · the approximated LRU: sample a few keys, evict the oldest, keep a pool of good candidates since 3.0, tune with maxmemory-samples (5 default, 10 near true LRU), and why true LRU costs more memory · covers our angle: full · fetched 2026-10-14 (*read*)

### T18-16 · Shortest paths in maps — Know · 🔲 not written
- **Read this:** [Contraction Hierarchies, illustrated](https://www.mjt.me.uk/posts/contraction-hierarchies/) · Mike Taylor · contract nodes one at a time adding shortcuts, then a bidirectional Dijkstra-like query that only follows edges to higher-ranked nodes · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Contraction hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies) · Wikipedia · definition and references · fetched 2026-10-14 (*headings only*)

### T18-17 · Union-find in networking and clustering — Know · 🔲 not written
- **Read this:** [1.5 Case Study: Union-Find](https://algs4.cs.princeton.edu/15uf/) · Princeton Algorithms · dynamic connectivity, quick-find, quick-union and weighted quick-union with depth at most lg n; applications limited to percolation · covers our angle: **partial** - no networking, accounts-merge or clustering use · fetched 2026-10-14 (*read*)
- **Our delta:** merging duplicate accounts and single-linkage clustering.

### T18-18 · Rolling hashes in practice — Know · 🔲 not written
- **Read this:** [Foundation - Introducing Content Defined Chunking](https://restic.net/blog/2015-09-12/restic-foundation1-cdc/) · restic · a rolling Rabin fingerprint over a 64-byte window, a chunk boundary where the lowest 21 bits are zero · covers our angle: **partial** - no cache keys · fetched 2026-10-14 (*read*)
- **Also good:** [Rolling hash](https://en.wikipedia.org/wiki/Rolling_hash) · Wikipedia · polynomial and cyclic-polynomial variants, content-based slicing · fetched 2026-10-14 (*headings only*)
- **Also good:** [FastCDC (USENIX ATC '16)](https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia) · USENIX · the Gear-hash chunker, about 10x faster than Rabin-based and 3x faster than other fast chunkers (abstract) · fetched 2026-10-14 (*read*)
- **Our delta:** Rabin-Karp as the base, cache keys.
