---
title: "Link map · DSA · Part 5 (phases 12-13), file 1"
sidebar_label: "05 · graphs (1)"
sidebar_position: 5
---

# Link map · DSA · Part 5, file 1 (phase 12)

Covers the 16 rows of phase 12 (graph fundamentals, traversal, union-find) in `docs/dsa/syllabus/05-graphs.md`. No page of ours covers graphs yet. *read* = the passage that backs the claim was read and checked on 2026-10-14; code that a page loads from tabs or widgets was not run. *headings only* = fetched at 200 and not read (none left in this file).

### T12-01 · Representations — Master · 🔲 not written
- **Read this:** [Algorithms 4e, 4.1 Undirected graphs](https://algs4.cs.princeton.edu/41graph/) · Princeton · Java `Graph` (adjacency lists) and `AdjMatrixGraph` behind one `adj()` API, with the glossary of parallel edges and self-loops · covers our angle: **partial** - no edge list, no grid, no cost table · fetched 2026-10-14 (*read*)
- **Also good:** [Adjacency list](https://en.wikipedia.org/wiki/Adjacency_list) · Wikipedia · list against matrix: space on sparse graphs, neighbour listing in degree time against a row scan · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Grids and graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games · a grid as a graph whose neighbours come from a direction list, with interactive diagrams (Python code) · fetched 2026-10-14 (*read*)
- **Our delta:** edge list, weighted and directed variants, building from an edge array in TypeScript, and the operation-cost table (the Cornell CS 2110 slide table is blank in the published deck, so it was dropped).

### T12-02 · Breadth-first search — Master · 🔲 not written
- **Read this:** [Breadth-first search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · queue, distance array, parent array and path recovery, with C++ and Java tabs · covers our angle: **partial** - marks visited on discovery but gives no interview framing · fetched 2026-10-14 (*read*)
- **Also good:** [Algorithms 4e, 4.1 Undirected graphs](https://algs4.cs.princeton.edu/41graph/) · Princeton · Java BFS and DFS with path reconstruction and the V plus E bound · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Introduction to A-star: breadth first search](https://www.redblobgames.com/pathfinding/a-star/introduction.html) · Red Blob Games · the frontier as an expanding ring, with animations · fetched 2026-10-14 (*read*)
- **Our delta:** mark-on-enqueue versus mark-on-dequeue, TypeScript and Java code.

### T12-03 · Depth-first search — Master · 🔲 not written
- **Read this:** [Depth-first search](https://cp-algorithms.com/graph/depth-first-search.html) · cp-algorithms · entry and exit times, colour array, and tree, back, forward and cross edge classification · covers our angle: **partial** - recursive only, no iterative version · fetched 2026-10-14 (*read*)
- **Also good:** [Algorithms 4e, 4.2 Directed graphs](https://algs4.cs.princeton.edu/42digraph/) · Princeton · DFS on digraphs with directed-cycle detection · fetched 2026-10-14 (*read*)
- **Our delta:** the iterative stack form and the TypeScript and Java code.

### T12-04 · Connected components and flood fill — Master · 🔲 not written
- **Read this:** [Flood fill and connected components (USACO Guide)](https://usaco.guide/silver/flood-fill) · USACO Guide · grid components, recursive then stack or queue version, stack-overflow warning, padding trick · covers our angle: **partial** - grid only, Python only, no in-place sinking · fetched 2026-10-14 (*read*)
- **Also good:** [Finding connected components](https://cp-algorithms.com/graph/search-for-connected-components.html) · cp-algorithms · the plain graph version, rounds of DFS in O(n + m) · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [200. Number of Islands](https://neetcode.io/solutions/number-of-islands) · NeetCode · DFS, BFS and union-find solutions that mark land as water in place, plus the forgot-to-mark pitfall · fetched 2026-10-14 (*read*)
- **Our delta:** TypeScript and Java code, and the trade-off that sinking cells mutates the caller's grid. The labuladong problem page originally listed here holds only the statement, so it was dropped.

### T12-05 · Cycle detection — Master · 🔲 not written
- **Read this:** [Finding a cycle in a graph](https://cp-algorithms.com/graph/finding-cycle.html) · cp-algorithms · white-grey-black DFS for directed graphs and a parent-skip DFS for undirected, with cycle reconstruction through a parent array · covers our angle: **partial** - assumes no loops or multiple edges, union-find variant not shown · fetched 2026-10-14 (*read*)
- **Also good:** [Disjoint set union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · the union-find mechanics; the cycle test (same root before a union) is left to the reader · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Detect cycle in a directed graph using colors](https://www.geeksforgeeks.org/dsa/detect-cycle-direct-graph-using-colors) · GeeksforGeeks · the white-grey-black walk-through with C++ and Java code · fetched 2026-10-14 (*read*)
- **Our delta:** the undirected parent-check pitfall with parallel edges.

### T12-06 · Topological sort — Master · 🔲 not written
- **Read this:** [Topological sorting (USACO Guide)](https://usaco.guide/gold/toposort) · USACO Guide · Kahn and DFS versions, cycle detection by length check and by on-stack check, lexicographic order via a priority queue, DP on the result · covers our angle: **partial** - Python code only · fetched 2026-10-14 (*read*)
- **Also good:** [Topological sort](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · why descending exit time gives a valid order, and why a cycle makes one impossible · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Topological sort: Kahn's algorithm and DFS approach](https://www.techinterview.org/post/3233460122/topological-sort-kahns-algorithm-and-dfs-approach/) · techinterview · both methods on course prerequisites, with cycle handling (Python) · fetched 2026-10-14 (*read*)
- **Our delta:** TypeScript and Java code.

### T12-07 · Multi-source BFS — Master · 🔲 not written
- **Read this:** [Multi-source BFS: solving the rotting oranges problem](https://johnkavanagh.co.uk/articles/multi-source-bfs-solving-the-rotting-oranges-problem) · John Kavanagh · seeds the queue with every source, level-by-level minutes, fresh-count early exit, TypeScript · covers our angle: **partial** - one problem, no walls and gates · fetched 2026-10-14 (*read*)
- **Also good:** [Gold: shortest paths with unweighted edges (USACO Guide)](https://usaco.guide/gold/bfs) · USACO Guide · BFS distance with parent recovery and a 0/1 BFS extension; no multi-source section · fetched 2026-10-14 (*read*)
- **Our delta:** walls-and-gates variant and why one BFS per gate is wrong.

### T12-08 · BFS on implicit graphs — Master · 🔲 not written
- **Read this:** [Word Ladder: BFS on implicit graphs explained](https://www.techinterview.org/post/3233460139/word-ladder-bfs-on-implicit-graphs-explained/) · techinterview · words as nodes, wildcard-pattern index for neighbours, bidirectional BFS (Python) · covers our angle: **partial** - no knight moves or minimum mutations · fetched 2026-10-14 (*read*)
- **Also good:** [1293. Shortest Path in a Grid with Obstacles Elimination](https://algo.monster/liteproblems/1293) · AlgoMonster · BFS over a derived state (row, column, eliminations left) with a visited set of states · fetched 2026-10-14 (*read*)
- **Our delta:** knight moves and gene mutation as further state spaces, state-count estimate.

### T12-09 · Union-find — Master · 🔲 not written
- **Read this:** [Disjoint set union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · path compression, union by size and by rank, the inverse Ackermann bound, and the log n bound without compression · covers our angle: **partial** - C++, applications are not the interview set · fetched 2026-10-14 (*read*)
- **Also good:** [Algorithms 4e, 1.5 Union-find](https://algs4.cs.princeton.edu/15uf/) · Princeton · Java weighted quick-union with path compression · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Disjoint-set data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure) · Wikipedia · Tarjan 1975 tight inverse-Ackermann bound and the 1979 lower bound for pointer algorithms · fetched 2026-10-14 (*read*)
- **Our delta:** provinces, redundant connection and accounts merge in TypeScript. Our `docs/dsa/pages/phase-1-complexity/03b-union-find-and-the-limits-of-amortised.md` exists (checked) and already holds a TypeScript `DSU` class (rank, path halving) and the "effectively constant, inverse Ackermann" sentence, but no graph applications: link to it for the bound and do not repeat it.

### T12-10 · Grid tricks — Master · 🔲 not written
- **Read this:** [Grids and graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games · neighbour generation from a direction list, two ways to bounds-check (Python) · covers our angle: **partial** - four directions shown, eight only mentioned, no in-place marks · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Matrix Traversal (AlgoMaster)](https://algomaster.io/learn/dsa/matrix-traversal-introduction) · AlgoMaster · grid as an implicit graph, 4 and 8 direction arrays, boundary-check helper, in-place marking with its warning, iterative DFS, BFS (code blocks are tabs and were not read) · fetched 2026-10-14 (*read*)
- **Our delta:** direction-vector idiom in TypeScript and Java, in-place visited marking, and the flat-index `r * cols + c` row-wrap hazard (no good source found for that last one).

### T12-11 · Bipartite check — Understand · 🔲 not written
- **Read this:** [Check whether a graph is bipartite](https://cp-algorithms.com/graph/bipartite-check.html) · cp-algorithms · BFS two-colouring from every unvisited vertex, equivalence with no odd cycle · covers our angle: full · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [How to determine a bipartite graph](https://labuladong.online/en/algo/data-structure/bipartite-graph/) · labuladong · two-colour framing, Is Graph Bipartite and Possible Bipartition · fetched 2026-10-14 (*read*)

### T12-12 · Cloning and constructing graphs — Understand · 🔲 not written
- **Read this:** [133. Clone Graph](https://neetcode.io/solutions/clone-graph) · NeetCode · old-to-new hash map with DFS and BFS, cycle reasoning, O(V + E) bound · covers our angle: full · fetched 2026-10-14 (*read*)

### T12-13 · Minimum spanning tree — Understand · 🔲 not written
- **Read this:** [Algorithms 4e, 4.3 Minimum spanning trees](https://algs4.cs.princeton.edu/43mst/) · Princeton · cut property, Kruskal with union-find, Prim with a priority queue · covers our angle: **partial** - Java only, no min cost to connect points · fetched 2026-10-14 (*read*)
- **Also good:** [Kruskal's algorithm](https://cp-algorithms.com/graph/mst_kruskal.html) · cp-algorithms · proof of correctness; its code is the simple O(N squared) version, the union-find version is on [the sibling page](https://cp-algorithms.com/graph/mst_kruskal_with_dsu.html) · fetched 2026-10-14 (*read*)
- **Also good:** [Prim's algorithm](https://cp-algorithms.com/graph/mst_prim.html) · cp-algorithms · dense O(n squared) and sparse set versions · fetched 2026-10-14 (*read*)
- **Our delta:** minimum cost to connect points in TypeScript.

### T12-14 · 0-1 BFS — Understand · 🔲 not written
- **Read this:** [0-1 BFS](https://cp-algorithms.com/graph/01_bfs.html) · cp-algorithms · derives the algorithm from Dijkstra with two queues, then gives the single-deque form (push front for weight 0, back for 1) · covers our angle: **partial** - C++, two-vector version is the main code · fetched 2026-10-14 (*read*)
- **Also good:** [0-1 BFS: shortest path in a binary weight graph](https://www.geeksforgeeks.org/0-1-bfs-shortest-path-binary-graph/) · GeeksforGeeks · deque version with C++ and Java code · fetched 2026-10-14 (*read*)
- **Our delta:** TypeScript has no deque, so say what to use instead.

### T12-15 · Graphs in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [Graph traversals (Cornell CS 2112)](https://www.cs.cornell.edu/courses/cs2112/2017fa/lectures/lec_traversals/) · Cornell · pseudocode BFS with a FIFO queue, swap to a LIFO stack for DFS, then the recursive form on the call stack · covers our angle: **partial** - pseudocode not Java, nothing on TypeScript or V8 stack limits · fetched 2026-10-14 (*read*)
- **Also good:** [ArrayDeque (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle · faster than `Stack` as a stack and than `LinkedList` as a queue · fetched 2026-10-14 (*read*)
- **Our delta:** `Map` of arrays against arrays of arrays in TypeScript, call-stack depth on large grids.

### T12-16 · Graph problems that are really trees — Know · 🔲 not written
- **Read this:** [261. Graph Valid Tree](https://neetcode.io/solutions/graph-valid-tree) · NeetCode · tree means connected and n minus 1 edges, solved by DFS, BFS and union-find · covers our angle: full · fetched 2026-10-14 (*read*)
