---
title: "Link map · DSA · Part 5 (phases 12-13), file 2"
sidebar_label: "05 · graphs (2)"
sidebar_position: 5
---

# Link map · DSA · Part 5, file 2 (phase 13)

Covers the 15 rows of phase 13 (shortest paths and advanced graph algorithms) in `docs/dsa/syllabus/05-graphs.md`. No page of ours covers graphs yet. *read* = I read the passage; *headings only* = fetched at 200 and the page checked for the key terms and section structure, not read end to end.

### T13-01 · Dijkstra — Master · 🔲 not written
- **Read this:** [Dijkstra algorithm](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms · the invariant, the proof and the dense and sparse versions · covers our angle: **partial** - C++ set instead of a heap with lazy deletion · fetched 2026-10-14 (*headings only*)
- **Also good:** [Algorithms 4e, 4.4 Shortest paths](https://algs4.cs.princeton.edu/44sp/) · Princeton · edge relaxation framing in Java · fetched 2026-10-14
- **Beyond the docs:** [Dijkstra's algorithm (CS 491 CAP transcript)](https://courses.grainger.illinois.edu/cs491cap/fa2019/transcripts/dijkstra-shortest-path) · Illinois · explains why a standard priority queue forces lazy deletion · fetched 2026-10-14 (*headings only*)
- **Our delta:** a hand-written binary heap in TypeScript, Java `PriorityQueue` with a comparator, network delay and path with minimum effort.

### T13-02 · Constrained shortest paths — Master · 🔲 not written
- **Read this:** [787. Cheapest Flights Within K Stops](https://neetcode.io/solutions/cheapest-flights-within-k-stops) · NeetCode · Bellman–Ford with bounded rounds and the copy-previous-round detail · covers our angle: **partial** - one of the three approaches is central · fetched 2026-10-14 (*headings only*)
- **Also good:** [Cheapest flights within k stops (Hello Interview)](https://www.hellointerview.com/learn/code/graphs/cheapest-flights-k-stops) · Hello Interview · the layered and extended-state views · fetched 2026-10-14
- **Also good:** [Cheapest Flights Within K Stops (AlgoMaster)](https://algomaster.io/learn/dsa/cheapest-flights-within-k-stops) · AlgoMaster · BFS by layers and Dijkstra over (city, stops) · fetched 2026-10-14
- **Our delta:** side-by-side of the two solutions the gate asks for.

### T13-03 · The decision table — Master · 🔲 not written
- **Read this:** [Shortest path algorithms (Hello Interview)](https://www.hellointerview.com/learn/code/graphs/shortest-path-algorithms) · Hello Interview · picks BFS, Dijkstra, Bellman–Ford and Floyd–Warshall by graph shape · covers our angle: **partial** - no DAG-then-DP row · fetched 2026-10-14 (*headings only*)
- **Also good:** [Shortest paths (USACO Guide)](https://usaco.guide/gold/shortest-paths) · USACO Guide · Dijkstra, Bellman–Ford and Floyd–Warshall together · fetched 2026-10-14
- **Our delta:** the DAG row and a one-line reason for each choice.

### T13-04 · Bellman–Ford — Understand · 🔲 not written
- **Read this:** [Bellman-Ford algorithm](https://cp-algorithms.com/graph/bellman_ford.html) · cp-algorithms · negative-cycle detection and path recovery, plus the SPFA queue idea · covers our angle: **partial** - bounded-rounds variant is not the focus · fetched 2026-10-14 (*headings only*)
- **Also good:** [Bellman–Ford algorithm](https://en.wikipedia.org/wiki/Bellman%E2%80%93Ford_algorithm) · Wikipedia · correctness proof and early exit · fetched 2026-10-14
- **Our delta:** the copy-per-round trick for at most k edges.

### T13-05 · Floyd–Warshall — Understand · 🔲 not written
- **Read this:** [Floyd-Warshall algorithm](https://cp-algorithms.com/graph/all-pair-shortest-path-floyd-warshall.html) · cp-algorithms · all pairs, the intermediate-vertex loop and negative edges · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Floyd–Warshall algorithm](https://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm) · Wikipedia · states that only the k, i, j loop order is correct · fetched 2026-10-14

### T13-06 · Shortest paths over an extended state — Understand · 🔲 not written
- **Read this:** [1293. Shortest Path in a Grid with Obstacles Elimination](https://algo.monster/liteproblems/1293) · AlgoMonster · BFS over (row, col, remaining) with code in several languages · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Shortest Path in a Grid with Obstacles Elimination (AlgoMaster)](https://algomaster.io/learn/dsa/shortest-path-in-a-grid-with-obstacles-elimination) · AlgoMaster · state-space pruning · fetched 2026-10-14

### T13-07 · Strongly connected components — Understand · 🔲 not written
- **Read this:** [Strongly connected components and the condensation graph](https://cp-algorithms.com/graph/strongly-connected-components.html) · cp-algorithms · Kosaraju with the condensation DAG · covers our angle: **partial** - Tarjan is only mentioned · fetched 2026-10-14 (*headings only*)
- **Also good:** [Algorithms 4e, 4.2 Directed graphs](https://algs4.cs.princeton.edu/42digraph/) · Princeton · Kosaraju–Sharir in Java · fetched 2026-10-14
- **Also good:** [Strongly connected component](https://en.wikipedia.org/wiki/Strongly_connected_component) · Wikipedia · compares the linear-time algorithms · fetched 2026-10-14
- **Our delta:** a Tarjan implementation to reproduce in TypeScript.

### T13-08 · Bridges and articulation points — Understand · 🔲 not written
- **Read this:** [Finding bridges in an undirected graph](https://cp-algorithms.com/graph/bridge-searching.html) · cp-algorithms · entry time and low-link with the bridge test · covers our angle: **partial** - recursive C++ · fetched 2026-10-14 (*headings only*)
- **Also good:** [Finding articulation points](https://cp-algorithms.com/graph/cutpoints.html) · cp-algorithms · the root special case · fetched 2026-10-14
- **Beyond the docs:** [Bridges and articulation points](https://soi.ch/wiki/bridges-articulationpoints/) · SOI wiki · an alternative write-up of the same low-link idea · fetched 2026-10-14 (*headings only*)
- **Our delta:** the critical-connections problem with parallel edges.

### T13-09 · Eulerian paths — Understand · 🔲 not written
- **Read this:** [Hierholzer's algorithm](https://en.wikipedia.org/wiki/Hierholzer%27s_algorithm) · Wikipedia · the circuit-splicing idea and its linear-time claim · covers our angle: **partial** - no itinerary problem · fetched 2026-10-14 (*headings only*)
- **Also good:** [Finding the Eulerian path](https://cp-algorithms.com/graph/euler_path.html) · cp-algorithms · existence conditions and an implementation for directed and undirected graphs · fetched 2026-10-14
- **Our delta:** reconstruct-itinerary with lexical order, via a reversed post-order.

### T13-10 · Ordering from constraints — Understand · 🔲 not written
- **Read this:** [269. Alien Dictionary](https://algo.monster/liteproblems/269) · AlgoMonster · edges from adjacent words, then a topological sort · covers our angle: **partial** - the prefix contradiction needs extra care · fetched 2026-10-14 (*headings only*)
- **Also good:** [Topological sorting (USACO Guide)](https://usaco.guide/gold/toposort) · USACO Guide · the sorting half, with cycle detection · fetched 2026-10-14
- **Our delta:** the longer-word-before-its-prefix case and tie-breaking with a heap.

### T13-11 · DP on DAGs — Understand · 🔲 not written
- **Read this:** [CSE 421 Dynamic Programming: longest path in a DAG](https://courses.cs.washington.edu/courses/cse421/22sp/lecture-20.pdf) · University of Washington · topological order as the DP order · covers our angle: **partial** - no path counting · fetched 2026-10-14 (*headings only*)
- **Also good:** [DAGs, sinks, extraction order and dynamic programming](https://courses.grainger.illinois.edu/CS374AL1/fa2024/lec/notes/dags.pdf) · Illinois (Har-Peled) · DP over a DAG with proofs · fetched 2026-10-14
- **Our delta:** counting paths and the link to Part 6.

### T13-12 · A-star search — Know · 🔲 not written
- **Read this:** [Introduction to A-star](https://www.redblobgames.com/pathfinding/a-star/introduction.html) · Red Blob Games · builds from BFS to Dijkstra to `A*` with animations · covers our angle: **partial** - admissibility is touched, not proved · fetched 2026-10-14 (*headings only*)
- **Also good:** [A-star search algorithm](https://en.wikipedia.org/wiki/A*_search_algorithm) · Wikipedia · admissible and consistent heuristics defined · fetched 2026-10-14
- **Our delta:** when plain BFS is enough in an interview.

### T13-13 · Max flow and bipartite matching — Know · 🔲 not written
- **Read this:** [Maximum flow: Ford-Fulkerson and Edmonds-Karp](https://cp-algorithms.com/graph/edmonds_karp.html) · cp-algorithms · residual graph and augmenting paths · covers our angle: **partial** - the matching reduction lives on a second page · fetched 2026-10-14 (*headings only*)
- **Also good:** [Kuhn's algorithm: maximum bipartite matching](https://cp-algorithms.com/graph/kuhn_maximum_bipartite_matching.html) · cp-algorithms · matching without building a flow network · fetched 2026-10-14
- **Beyond the docs:** [CSE 421 Lecture 18: efficient maximum flow and applications](https://courses.cs.washington.edu/courses/cse421/26wi/lecture/lecture18.pdf) · University of Washington · the unit-capacity reduction to matching · fetched 2026-10-14 (*headings only*)

### T13-14 · The NP-hard boundary — Know · 🔲 not written
- **Read this:** [Held–Karp algorithm](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm) · Wikipedia · the exact bitmask-style dynamic programme for the travelling salesman · covers our angle: **partial** - nothing on colouring or independent set, nothing on recognising NP-hardness · fetched 2026-10-14 (*headings only*)
- **Also good:** [Bitmask DP (USACO Guide)](https://usaco.guide/gold/dp-bitmasks) · USACO Guide · subset DP with problems · fetched 2026-10-14
- **Our delta:** a list of the tell-tale phrasings and the heuristic fallback.

### T13-15 · Graphs in real systems — Know · 🔲 not written
- **Read this:** [Directed Acyclic Graphs and topological sort (NetworkX guide)](https://networkx.org/nx-guides/content/algorithms/dag/index.html) · NetworkX · dependency graphs and why a cycle makes them unbuildable · covers our angle: **partial** - no road graph or social graph · fetched 2026-10-14 (*headings only*)
- **Our delta:** road graphs, social graphs and the System Design track hand-off; no good single source found for those.
