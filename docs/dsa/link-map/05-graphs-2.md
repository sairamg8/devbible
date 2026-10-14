---
title: "Link map · DSA · Part 5 (phases 12-13), file 2"
sidebar_label: "05 · graphs (2)"
sidebar_position: 5
---

# Link map · DSA · Part 5, file 2 (phase 13)

Covers the 15 rows of phase 13 (shortest paths and advanced graph algorithms) in `docs/dsa/syllabus/05-graphs.md`. No page of ours covers graphs yet. *read* = the passage that backs the claim was read and checked on 2026-10-14; code that a page loads from tabs or widgets was not run. *headings only* = fetched at 200 and not read (none left in this file).

### T13-01 · Dijkstra — Master · 🔲 not written
- **Read this:** [Dijkstra algorithm](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms · the invariant, the induction proof and the dense O(n squared) version · covers our angle: **partial** - the heap and set version lives on [the sparse-graphs page](https://cp-algorithms.com/graph/dijkstra_sparse.html), in C++ with a set, not a heap with lazy deletion · fetched 2026-10-14 (*read*)
- **Also good:** [Algorithms 4e, 4.4 Shortest paths](https://algs4.cs.princeton.edu/44sp/) · Princeton · edge relaxation framing in Java, E log V bound · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Dijkstra's algorithm (CS 491 CAP transcript)](https://courses.grainger.illinois.edu/cs491cap/fa2019/transcripts/dijkstra-shortest-path) · Illinois · step-by-step relaxation, and why a C++ priority queue with no decrease-key forces lazy deletion · fetched 2026-10-14 (*read*)
- **Our delta:** a hand-written binary heap in TypeScript, Java `PriorityQueue` with a comparator, network delay and path with minimum effort.

### T13-02 · Constrained shortest paths — Master · 🔲 not written
- **Read this:** [787. Cheapest Flights Within K Stops](https://neetcode.io/solutions/cheapest-flights-within-k-stops) · NeetCode · Dijkstra over (city, stops), Bellman–Ford with a temporary prices array per round, and SPFA · covers our angle: full for the two solutions the gate asks for · fetched 2026-10-14 (*read*)
- **Also good:** [Cheapest Flights Within K Stops (AlgoMaster)](https://algomaster.io/learn/dsa/cheapest-flights-within-k-stops) · AlgoMaster · why plain Dijkstra fails, then BFS by levels with a cost copy per level, modified Bellman–Ford, and Dijkstra with the flight count in the state · fetched 2026-10-14 (*read*)
- **Our delta:** side-by-side of the two solutions the gate asks for. The Hello Interview page for this problem was dropped: the body is behind a paywall, so it could not be read.

### T13-03 · The decision table — Master · 🔲 not written
- **Read this:** [Algorithms 4e, 4.4 Shortest paths](https://algs4.cs.princeton.edu/44sp/) · Princeton · nonnegative weights give Dijkstra, a DAG gives topological-order relaxation (negative weights allowed), negative weights without a negative cycle give queue-based Bellman–Ford, with negative-cycle detection · covers our angle: **partial** - no unweighted BFS row and no all-pairs row · fetched 2026-10-14 (*read*)
- **Also good:** [Shortest paths (USACO Guide)](https://usaco.guide/gold/shortest-paths) · USACO Guide · Bellman–Ford, Floyd–Warshall and Dijkstra (O(N squared) and O(M log N)) on one page · fetched 2026-10-14 (*read*)
- **Our delta:** the BFS and Floyd–Warshall rows and a one-line reason for each choice. The Hello Interview decision-tree page was dropped: it is paywalled past its headings.

### T13-04 · Bellman–Ford — Understand · 🔲 not written
- **Read this:** [Bellman-Ford algorithm](https://cp-algorithms.com/graph/bellman_ford.html) · cp-algorithms · n minus 1 phases, negative-cycle detection, path recovery, and an SPFA section · covers our angle: **partial** - bounded-rounds variant is not the focus · fetched 2026-10-14 (*read*)
- **Also good:** [Bellman–Ford algorithm](https://en.wikipedia.org/wiki/Bellman%E2%80%93Ford_algorithm) · Wikipedia · proof of correctness by induction and the early-exit improvement · fetched 2026-10-14 (*read*)
- **Our delta:** the copy-per-round trick for at most k edges.

### T13-05 · Floyd–Warshall — Understand · 🔲 not written
- **Read this:** [Floyd-Warshall algorithm](https://cp-algorithms.com/graph/all-pair-shortest-path-floyd-warshall.html) · cp-algorithms · all pairs, the phase-k intermediate-vertex invariant, negative edges and negative-cycle detection on the diagonal · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Floyd–Warshall algorithm](https://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm) · Wikipedia · states that the correct order is k outermost, then i, then j · fetched 2026-10-14 (*read*)

### T13-06 · Shortest paths over an extended state — Understand · 🔲 not written
- **Read this:** [1293. Shortest Path in a Grid with Obstacles Elimination](https://algo.monster/liteproblems/1293) · AlgoMonster · BFS over (row, col, remaining) with a visited set of states, O(m n k) bound, code in Python, Java, C++ and TypeScript · covers our angle: full · fetched 2026-10-14 (*read*; this host dropped one of several connections from the checking proxy, so recheck before publishing)
- **Also good:** [Shortest Path in a Grid with Obstacles Elimination (AlgoMaster)](https://algomaster.io/learn/dsa/shortest-path-in-a-grid-with-obstacles-elimination) · AlgoMaster · stacked-layers picture of the state, the Manhattan-distance shortcut when k is large, and an A-star variant · fetched 2026-10-14 (*read*)

### T13-07 · Strongly connected components — Understand · 🔲 not written
- **Read this:** [Strongly connected components and the condensation graph](https://cp-algorithms.com/graph/strongly-connected-components.html) · cp-algorithms · Kosaraju and the condensation DAG · covers our angle: **partial** - Tarjan is only linked, not explained · fetched 2026-10-14 (*read*)
- **Also good:** [Algorithms 4e, 4.2 Directed graphs](https://algs4.cs.princeton.edu/42digraph/) · Princeton · Kosaraju–Sharir in Java with the V plus E bound · fetched 2026-10-14 (*read*)
- **Also good:** [Strongly connected component](https://en.wikipedia.org/wiki/Strongly_connected_component) · Wikipedia · compares Kosaraju (two passes), Tarjan and the path-based algorithm (one pass) · fetched 2026-10-14 (*read*)
- **Our delta:** a Tarjan implementation to reproduce in TypeScript.

### T13-08 · Bridges and articulation points — Understand · 🔲 not written
- **Read this:** [Finding bridges in an undirected graph](https://cp-algorithms.com/graph/bridge-searching.html) · cp-algorithms · entry time and low-link with the bridge test, and a `parent_skipped` flag that handles parallel edges · covers our angle: **partial** - recursive C++ only · fetched 2026-10-14 (*read*)
- **Also good:** [Finding articulation points](https://cp-algorithms.com/graph/cutpoints.html) · cp-algorithms · the root special case and the low-link versus entry-time comparison · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Bridges and articulation points](https://soi.ch/wiki/bridges-articulationpoints/) · SOI wiki · definitions, brute force, then the Tarjan low-link idea after a DFS preorder and postorder primer; simple graphs only · fetched 2026-10-14 (*read*)
- **Our delta:** the critical-connections problem as an edge-list input, and an iterative version.

### T13-09 · Eulerian paths — Understand · 🔲 not written
- **Read this:** [Eulerian path (Hierholzer's algorithm section)](https://en.wikipedia.org/wiki/Hierholzer%27s_algorithm) · Wikipedia · this URL redirects to the Eulerian path article; existence conditions, then Hierholzer's trail splicing in linear time · covers our angle: **partial** - no itinerary problem, no reversed post-order form · fetched 2026-10-14 (*read*)
- **Also good:** [Finding the Eulerian path](https://cp-algorithms.com/graph/euler_path.html) · cp-algorithms · degree conditions and an O(M) implementation for **undirected** multigraphs only · fetched 2026-10-14 (*read*)
- **Our delta:** the directed case (in-degree against out-degree) and reconstruct-itinerary with lexical order, via a reversed post-order.

### T13-10 · Ordering from constraints — Understand · 🔲 not written
- **Read this:** [269. Alien Dictionary](https://algo.monster/liteproblems/269) · AlgoMonster · edges from adjacent word pairs, the longer-word-before-its-prefix rejection, then Kahn's algorithm with a cycle check · covers our angle: **partial** - no tie-breaking · fetched 2026-10-14 (*read*; this host dropped one of several connections from the checking proxy, so recheck before publishing)
- **Also good:** [Topological sorting (USACO Guide)](https://usaco.guide/gold/toposort) · USACO Guide · the sorting half with cycle detection, and a one-line note that a priority queue in Kahn's algorithm gives the lexicographically smallest order · fetched 2026-10-14 (*read*)
- **Our delta:** tie-breaking with a heap, shown in full.

### T13-11 · DP on DAGs — Understand · 🔲 not written
- **Read this:** [CSE 421 Dynamic Programming: longest path in a DAG](https://courses.cs.washington.edu/courses/cse421/22sp/lecture-20.pdf) · University of Washington · topological order as the DP order, with the note that longest path is NP-hard on general digraphs · covers our angle: **partial** - no path counting · fetched 2026-10-14 (*read*)
- **Also good:** [DAGs, sinks, extraction order and dynamic programming](https://courses.grainger.illinois.edu/CS374AL1/fa2024/lec/notes/dags.pdf) · Illinois (Har-Peled) · extraction order, longest path by edge count and weighted s-to-t, linear time · fetched 2026-10-14 (*read*)
- **Our delta:** counting paths and the link to Part 6.

### T13-12 · A-star search — Know · 🔲 not written
- **Read this:** [Introduction to A-star](https://www.redblobgames.com/pathfinding/a-star/introduction.html) · Red Blob Games · builds from BFS to Dijkstra to greedy best-first to `A*` with animations · covers our angle: **partial** - uses a Manhattan heuristic but never mentions admissibility · fetched 2026-10-14 (*read*)
- **Also good:** [A-star search algorithm](https://en.wikipedia.org/wiki/A*_search_algorithm) · Wikipedia · admissible and consistent heuristics defined, and the optimality theorem · fetched 2026-10-14 (*read*)
- **Our delta:** when plain BFS is enough in an interview.

### T13-13 · Max flow and bipartite matching — Know · 🔲 not written
- **Read this:** [Maximum flow: Ford-Fulkerson and Edmonds-Karp](https://cp-algorithms.com/graph/edmonds_karp.html) · cp-algorithms · residual graph and augmenting paths · covers our angle: **partial** - says nothing about matching · fetched 2026-10-14 (*read*)
- **Also good:** [Kuhn's algorithm: maximum bipartite matching](https://cp-algorithms.com/graph/kuhn_maximum_bipartite_matching.html) · cp-algorithms · alternating and augmenting paths, matching without building a flow network · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [CSE 421 Lecture 18: efficient maximum flow and applications](https://courses.cs.washington.edu/courses/cse421/26wi/lecture/lecture18.pdf) · University of Washington · augmenting-path proof, then bipartite matching as a unit-capacity flow with the integer-flow bijection · fetched 2026-10-14 (*read*)

### T13-14 · The NP-hard boundary — Know · 🔲 not written
- **Read this:** [Algorithms, chapter 12: NP-hardness](https://jeffe.cs.illinois.edu/teaching/algorithms/book/12-nphard.pdf) · Jeff Erickson · reductions for maximum independent set, clique, vertex cover, graph colouring and Hamiltonian cycle · covers our angle: **partial** - proof-oriented, not a guide to spotting hard problems; the travelling salesman appears in passing, and no bitmask DP or heuristics · fetched 2026-10-14 (*read*)
- **Also good:** [Held–Karp algorithm](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm) · Wikipedia · the exact subset dynamic programme for the travelling salesman · fetched 2026-10-14 (*read*)
- **Also good:** [Bitmask DP (USACO Guide)](https://usaco.guide/gold/dp-bitmasks) · USACO Guide · subset DP over visited cities, with the Hamiltonian Flights problem · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Version SAT](https://research.swtch.com/version-sat) · Russ Cox · a concrete recognition example: package version selection is NP-complete, with the proof · fetched 2026-10-14 (*read*)
- **Our delta:** a list of the tell-tale phrasings and the heuristic fallback; the easy-versus-hard pair longest path, linear on a DAG (T13-11 sources) and NP-hard in general.

### T13-15 · Graphs in real systems — Know · 🔲 not written
- **Read this:** [Contraction hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies) · Wikipedia · the road graph: intersections as vertices, roads as edges weighted by travel time, and the preprocessing that makes route queries fast · covers our angle: **partial** - road graph only · fetched 2026-10-14 (*read*)
- **Also good:** [TAO: Facebook's distributed data store for the social graph](https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf) · USENIX ATC 2013 · the social graph as objects and associations, and why it is served by a graph-aware cache (abstract, introduction and background read) · fetched 2026-10-14 (*read*)
- **Also good:** [Directed Acyclic Graphs and topological sort (NetworkX guide)](https://networkx.org/nx-guides/content/algorithms/dag/index.html) · NetworkX · DAG basics with a cycle example, and a note that dependency graphs order scheduling and spreadsheet updates (Python; build tools and package managers are not covered) · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Version SAT](https://research.swtch.com/version-sat) · Russ Cox · package-manager dependency resolution as a graph-and-constraint problem and why a diamond dependency breaks it · fetched 2026-10-14 (*read*)
- **Our delta:** the System Design track hand-off for maps and feeds; no single source found that covers all three graphs.
