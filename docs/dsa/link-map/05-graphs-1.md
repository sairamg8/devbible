---
title: "Link map · DSA · Part 5 (phases 12-13), file 1"
sidebar_label: "05 · graphs (1)"
sidebar_position: 5
---

# Link map · DSA · Part 5, file 1 (phase 12)

Covers the 16 rows of phase 12 (graph fundamentals, traversal, union-find) in `docs/dsa/syllabus/05-graphs.md`. No page of ours covers graphs yet. *read* = I read the passage; *headings only* = fetched at 200 and the page checked for the key terms and section structure, not read end to end.

### T12-01 · Representations — Master · 🔲 not written
- **Read this:** [Graph traversals and representations (Cornell CS 2110 lecture slides)](https://www.cs.cornell.edu/courses/cs2110/2026sp/lectures/lec21/lec21-pre-slides.pdf) · Cornell · Java adjacency matrix and list code with an operation-cost table, close to our Java second angle · covers our angle: **partial** - no edge list, no grid · fetched 2026-10-14 (*headings only*)
- **Also good:** [Adjacency list](https://en.wikipedia.org/wiki/Adjacency_list) · Wikipedia · compares list against matrix and gives the trade-offs · fetched 2026-10-14
- **Beyond the docs:** [Grids and graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games · shows why a grid is just a graph with implicit neighbours, with pictures · fetched 2026-10-14 (*headings only*)
- **Our delta:** edge list, weighted and directed variants, building from an edge array in TypeScript.

### T12-02 · Breadth-first search — Master · 🔲 not written
- **Read this:** [Breadth-first search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · queue, shortest paths in unweighted graphs and path recovery in one page · covers our angle: **partial** - C++ only, marks visited on discovery but no interview framing · fetched 2026-10-14 (*headings only*)
- **Also good:** [Algorithms 4e, 4.1 Undirected graphs](https://algs4.cs.princeton.edu/41graph/) · Princeton · Java BFS and DFS with path reconstruction · fetched 2026-10-14
- **Beyond the docs:** [Introduction to A-star: breadth first search](https://www.redblobgames.com/pathfinding/a-star/introduction.html) · Red Blob Games · animated frontier makes the queue discipline obvious · fetched 2026-10-14 (*headings only*)
- **Our delta:** mark-on-enqueue versus mark-on-dequeue, TypeScript and Java code.

### T12-03 · Depth-first search — Master · 🔲 not written
- **Read this:** [Depth-first search](https://cp-algorithms.com/graph/depth-first-search.html) · cp-algorithms · entry and exit times and the colour states in one place · covers our angle: **partial** - recursive only, no iterative version · fetched 2026-10-14 (*headings only*)
- **Also good:** [Algorithms 4e, 4.2 Directed graphs](https://algs4.cs.princeton.edu/42digraph/) · Princeton · DFS on digraphs with directed-cycle detection · fetched 2026-10-14
- **Our delta:** the iterative stack form and the TypeScript and Java code.

### T12-04 · Connected components and flood fill — Master · 🔲 not written
- **Read this:** [Flood fill and connected components (USACO Guide)](https://usaco.guide/silver/flood-fill) · USACO Guide · grid components with worked problems · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Finding connected components](https://cp-algorithms.com/graph/search-for-connected-components.html) · cp-algorithms · the plain graph version · fetched 2026-10-14
- **Beyond the docs:** [Number of Islands: flood fill pattern explained](https://labuladong.online/en/problem/number-of-islands/description/) · labuladong · interview-framed walk through of the grid case with the sink-in-place trick · fetched 2026-10-14 (*headings only*)

### T12-05 · Cycle detection — Master · 🔲 not written
- **Read this:** [Finding a cycle in a graph](https://cp-algorithms.com/graph/finding-cycle.html) · cp-algorithms · colour-based DFS for directed and parent check for undirected · covers our angle: **partial** - union-find variant not shown · fetched 2026-10-14 (*headings only*)
- **Also good:** [Disjoint set union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · supplies the union-find route · fetched 2026-10-14
- **Beyond the docs:** [Detect cycle in a directed graph using colors](https://www.geeksforgeeks.org/dsa/detect-cycle-direct-graph-using-colors) · GeeksforGeeks · the white-grey-black walk-through with Java code · fetched 2026-10-14 (*headings only*)
- **Our delta:** the undirected parent-check pitfall with parallel edges.

### T12-06 · Topological sort — Master · 🔲 not written
- **Read this:** [Topological sorting (USACO Guide)](https://usaco.guide/gold/toposort) · USACO Guide · Kahn and DFS side by side with cycle detection and problems · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Topological sort](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · DFS exit-time proof of the ordering · fetched 2026-10-14
- **Beyond the docs:** [Topological sort: Kahn's algorithm and DFS approach](https://www.techinterview.org/post/3233460122/topological-sort-kahns-algorithm-and-dfs-approach/) · techinterview · framed around course schedule · fetched 2026-10-14 (*headings only*)

### T12-07 · Multi-source BFS — Master · 🔲 not written
- **Read this:** [Multi-source BFS: solving the rotting oranges problem](https://johnkavanagh.co.uk/articles/multi-source-bfs-solving-the-rotting-oranges-problem) · John Kavanagh · seeds the queue with every source, TypeScript-friendly · covers our angle: **partial** - one problem, no walls and gates · fetched 2026-10-14 (*headings only*)
- **Also good:** [Gold: breadth-first search (USACO Guide)](https://usaco.guide/gold/bfs) · USACO Guide · multi-source and 0-1 BFS together · fetched 2026-10-14
- **Our delta:** walls-and-gates variant and why one BFS per gate is wrong.

### T12-08 · BFS on implicit graphs — Master · 🔲 not written
- **Read this:** [Word Ladder: BFS on implicit graphs explained](https://www.techinterview.org/post/3233460139/word-ladder-bfs-on-implicit-graphs-explained/) · techinterview · treats words as nodes and uses a wildcard index for neighbours · covers our angle: **partial** - no knight moves or minimum mutations · fetched 2026-10-14 (*headings only*)
- **Also good:** [Gold: breadth-first search (USACO Guide)](https://usaco.guide/gold/bfs) · USACO Guide · state-space BFS problems · fetched 2026-10-14
- **Our delta:** knight moves and gene mutation as further state spaces, state-count estimate.

### T12-09 · Union-find — Master · 🔲 not written (our `docs/dsa/pages/phase-1-complexity/03b-union-find-and-the-limits-of-amortised.md` covers only the amortised bound)
- **Read this:** [Disjoint set union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · path compression, union by size and rank, and the inverse Ackermann bound, with applications · covers our angle: **partial** - C++, applications are not the interview set · fetched 2026-10-14 (*headings only*)
- **Also good:** [Algorithms 4e, 1.5 Union-find](https://algs4.cs.princeton.edu/15uf/) · Princeton · Java weighted quick-union with compression · fetched 2026-10-14
- **Beyond the docs:** [Disjoint-set data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure) · Wikipedia · states the Tarjan bound and the lower bound cleanly · fetched 2026-10-14
- **Our delta:** provinces, redundant connection and accounts merge in TypeScript.

### T12-10 · Grid tricks — Master · 🔲 not written
- **Read this:** [Grids and graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games · neighbour generation, direction lists and bounds · covers our angle: **partial** - no in-place marks · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [BFS and Voronoi diagrams using bit-shift operations](https://www.codingame.com/playgrounds/66330/bfs-and-voronoi-diagrams-using-bit-shift-operations/shortest-path-in-great-escape) · CodinGame · flat index as `x + y * WIDTH` and the row-wrap hazard · fetched 2026-10-14 (*headings only*)
- **Our delta:** direction-vector idiom in TypeScript and Java, in-place visited marking.

### T12-11 · Bipartite check — Understand · 🔲 not written
- **Read this:** [Check whether a graph is bipartite](https://cp-algorithms.com/graph/bipartite-check.html) · cp-algorithms · BFS two-colouring, short and exact · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [How to determine a bipartite graph](https://labuladong.online/en/algo/data-structure/bipartite-graph/) · labuladong · interview framing, possible bipartition · fetched 2026-10-14 (*headings only*)

### T12-12 · Cloning and constructing graphs — Understand · 🔲 not written
- **Read this:** [133. Clone Graph](https://neetcode.io/solutions/clone-graph) · NeetCode · old-to-new map with DFS and BFS · covers our angle: full · fetched 2026-10-14 (*headings only*)

### T12-13 · Minimum spanning tree — Understand · 🔲 not written
- **Read this:** [Algorithms 4e, 4.3 Minimum spanning trees](https://algs4.cs.princeton.edu/43mst/) · Princeton · Kruskal with union-find and Prim with a priority queue, cut property · covers our angle: **partial** - Java only, no min cost to connect points · fetched 2026-10-14 (*headings only*)
- **Also good:** [Kruskal's algorithm](https://cp-algorithms.com/graph/mst_kruskal.html) · cp-algorithms · short proof and code · fetched 2026-10-14
- **Also good:** [Prim's algorithm](https://cp-algorithms.com/graph/mst_prim.html) · cp-algorithms · dense and heap versions · fetched 2026-10-14
- **Our delta:** minimum cost to connect points in TypeScript.

### T12-14 · 0-1 BFS — Understand · 🔲 not written
- **Read this:** [0-1 BFS](https://cp-algorithms.com/graph/01_bfs.html) · cp-algorithms · the deque trick and why it is correct · covers our angle: **partial** - C++ deque · fetched 2026-10-14 (*headings only*)
- **Also good:** [0-1 BFS: shortest path in a binary weight graph](https://www.geeksforgeeks.org/0-1-bfs-shortest-path-binary-graph/) · GeeksforGeeks · includes Java code · fetched 2026-10-14
- **Our delta:** TypeScript has no deque, so say what to use instead.

### T12-15 · Graphs in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [Graph traversals (Cornell CS 2112)](https://www.cs.cornell.edu/courses/cs2112/2017fa/lectures/lec_traversals/) · Cornell · Java traversal with explicit stack versus recursion · covers our angle: **partial** - nothing on TypeScript or V8 stack limits · fetched 2026-10-14 (*headings only*)
- **Also good:** [ArrayDeque (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle · the queue and stack to use in Java · fetched 2026-10-14
- **Our delta:** `Map` of arrays against arrays of arrays in TypeScript, call-stack depth on large grids.

### T12-16 · Graph problems that are really trees — Know · 🔲 not written
- **Read this:** [261. Graph Valid Tree](https://neetcode.io/solutions/graph-valid-tree) · NeetCode · the n minus 1 edges test plus connectivity · covers our angle: full · fetched 2026-10-14 (*headings only*)
