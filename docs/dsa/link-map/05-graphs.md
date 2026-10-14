---
title: "Link map · DSA · Part 5 (phases 12–13)"
sidebar_label: "05 · graphs"
sidebar_position: 5
---

# Link map · DSA · Part 5 (phases 12–13)

Covers every topic row of phases 12 and 13 in `docs/dsa/syllabus/05-graphs.md`: graph fundamentals, traversal and union-find (T12-01 to T12-16) and shortest paths and advanced graph algorithms (T13-01 to T13-15). That is 31 rows. None of them has a written page of ours yet (`docs/dsa/pages` holds phases 0 to 2 only; the only neighbour is the union-find amortised-bound section in phase 1, noted in T12-09, and the travelling-salesman mask DP in phase 2, noted in T13-14), so every block is marked not written and its delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the headings or title checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means language and library documentation, university course notes, cp-algorithms and the Wikipedia articles that cite CLRS; blogs, visualisers and tutorial sites count as beyond the docs.

---

## Phase 12 — Graph fundamentals, traversal and union-find

### T12-01 · Representations — Master · 🔲 not written
- **Read this:** [Graph (abstract data type)](https://en.wikipedia.org/wiki/Graph_(abstract_data_type)) · Wikipedia · compares adjacency list, adjacency matrix and incidence matrix with a table of costs: storing is O(V+E) against O(V squared), adjacency tests O(V) against O(1), and lists are preferred for sparse graphs (*read*) · covers our angle: **partial** — no edge list and no code, and nothing on the grid as an implicit graph · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.1 Undirected Graphs](https://algs4.cs.princeton.edu/41graph/) · Sedgewick and Wayne, Princeton · builds the vertex-indexed array-of-lists Graph type and a matrix version of the same API, with the memory cost of the list version worked out in an exercise (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Grids and graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games · shows a grid as a graph whose nodes are cells and whose edges come from a neighbours function (*read*) · page dated 2026-03-23 · fetched 2026-10-14
- **Our delta:** the three representations side by side with when each wins, building each from an edge list, directed and weighted variants, and the grid as an implicit graph that is never built.

### T12-02 · Breadth-first search — Master · 🔲 not written
- **Read this:** [Breadth-first search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · BFS finds shortest paths in unweighted graphs, and a parent array restores the path by walking back from the target (*read*) · covers our angle: **partial** — no mark-on-enqueue discipline spelled out as a bug source and no TypeScript or Java · fetched 2026-10-14
- **Also good:** [Breadth-first search](https://en.wikipedia.org/wiki/Breadth-first_search) · Wikipedia · the queue formulation, O(V+E), and a vertex checked for explored before it is enqueued, not after it is dequeued (*read*) · fetched 2026-10-14
- **Beyond the docs:** [VisuAlgo, graph traversal](https://visualgo.net/en/dfsbfs) · VisuAlgo, National University of Singapore · step-by-step animation of BFS and DFS on a graph you can edit, with edge-list and adjacency-list input (*read*) · fetched 2026-10-14
- **Our delta:** why visited is marked when a node is enqueued and not when it is dequeued, the level-by-level loop, and path reconstruction from parents.

### T12-03 · Depth-first search — Master · 🔲 not written
- **Read this:** [Depth First Search](https://cp-algorithms.com/graph/depth-first-search.html) · cp-algorithms · colours 0, 1, 2 for unvisited, entered and exited, entry and exit times, and an edge to an ancestor is a back edge that closes a cycle (*read*) · covers our angle: **partial** — recursive form only, no iterative version and no stack-depth warning · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.1 Undirected Graphs](https://algs4.cs.princeton.edu/41graph/) · Sedgewick and Wayne, Princeton · warns that recursive DFS can overflow the call stack on a line graph and asks for an explicit-stack rewrite (*read*) · fetched 2026-10-14
- **Our delta:** recursive and iterative forms that visit in the same order, the visited discipline, and the three colours as the whole cycle test for directed graphs.

### T12-04 · Connected components and flood fill — Master · 🔲 not written
- **Read this:** [Search for connected components in a graph](https://cp-algorithms.com/graph/search-for-connected-components.html) · cp-algorithms · a series of DFS rounds, each started at an unvisited node and marking its whole component, in O(n+m), with an iterative version to avoid stack overflow on big graphs (*read*) · covers our angle: **partial** — plain graphs only, no grid, island count or surrounded-regions variant · fetched 2026-10-14
- **Also good:** [Flood fill](https://en.wikipedia.org/wiki/Flood_fill) · Wikipedia · four-way against eight-way connectivity, and moving the recursion into a stack or queue to prevent stack overflow, at a memory cost (*read*) · fetched 2026-10-14
- **Our delta:** the grid forms (count islands, largest area, surrounded regions) on one template, and marking visited in place as a trade against mutating the input.

### T12-05 · Cycle detection — Master · 🔲 not written
- **Read this:** [Checking a graph for acyclicity and finding a cycle in O(M)](https://cp-algorithms.com/graph/finding-cycle.html) · cp-algorithms · directed graphs use white, gray and black, and reaching a gray vertex signals a cycle; undirected graphs merge gray and black into one visited flag and skip the edge to the parent (*read*) · covers our angle: **partial** — the page assumes no parallel edges, so where the parent check breaks is not shown, and the union-find route is absent · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.2 Directed Graphs](https://algs4.cs.princeton.edu/42digraph/) · Sedgewick and Wayne, Princeton · DFS finds a directed cycle and returns one, and a topological order exists only for a DAG (*read*) · fetched 2026-10-14
- **Our delta:** why undirected and directed need different tests, the parent check and where it breaks, and the same question answered by union-find.

### T12-06 · Topological sort — Master · 🔲 not written
- **Read this:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · runs DFS from every unvisited vertex, records exit order and reverses it; says an order exists only without cycles, and leaves cycle checking to the DFS article (*read*) · covers our angle: **partial** — no Kahn's algorithm and no cycle detection inside the procedure · fetched 2026-10-14
- **Also good:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · describes both Kahn's algorithm and the DFS-based one, and states an order is possible if and only if the graph has no directed cycles (*read*) · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.2 Directed Graphs](https://algs4.cs.princeton.edu/42digraph/) · Sedgewick and Wayne, Princeton · reverse DFS postorder of a DAG is a topological order, in time proportional to V+E (*read*) · fetched 2026-10-14
- **Our delta:** Kahn's count of processed nodes as the "no order exists" test, side by side with the DFS form, applied to the course-schedule family.

### T12-07 · Multi-source BFS — Master · 🔲 not written
- **Read this:** [Breadth-first search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · the single-source queue the technique extends; the page does not cover multi-source BFS itself (*read*) · covers our angle: **partial** — the queue discipline only; seeding with every source is not shown · fetched 2026-10-14
- **Also good:** [Red Blob Games, grids and graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games · cells, neighbours and direction offsets for the grid versions of rotting oranges and walls and gates (*read*) · page dated 2026-03-23 · fetched 2026-10-14
- **Our delta:** putting every source in the queue at distance zero as one BFS, and why that equals a hidden super-source joined to all of them.

### T12-08 · BFS on implicit graphs — Master · 🔲 not written
- **Read this:** [Breadth-first search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · treats game states as vertices so that BFS yields the fewest moves, and builds an auxiliary graph of vertex and parity states (*read*) · covers our angle: **partial** — states as vertices is there, but word ladder, mutations and knight moves are not worked · fetched 2026-10-14
- **Also good:** [Grids and graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games · neighbours computed on demand instead of storing edges (*read*) · page dated 2026-03-23 · fetched 2026-10-14
- **Our delta:** the state as the node and the neighbour function as the edges, with word ladder's wildcard-bucket trick for generating neighbours cheaply.

### T12-09 · Union-find — Master · 🔲 not written
- **Read this:** [Disjoint Set Union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · path compression alone gives O(log n) amortised, union by size or rank alone O(log n), both together O(alpha(n)) with alpha at most 4 for any sane n; applications include connected components and Kruskal (*read*) · covers our angle: **partial** — no provinces, redundant-connection or accounts-merge problem and no TypeScript or Java · fetched 2026-10-14
- **Also good:** [Disjoint-set data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure) · Wikipedia · union by rank, path compression and its one-pass variants halving and splitting, with Tarjan's 1975 bound and the Fredman and Saks optimality result (*read*) · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 1.5 Union-Find](https://algs4.cs.princeton.edu/15uf/) · Sedgewick and Wayne, Princeton · weighted quick-union has depth at most lg n, and path compression is bounded by the inverse Ackermann function (*read*) · fetched 2026-10-14
- **Beyond the docs:** [VisuAlgo, union-find disjoint sets](https://visualgo.net/en/ufds) · VisuAlgo, National University of Singapore · animates FindSet and UnionSet with path compression and union by rank (*read*) · fetched 2026-10-14
- **Our delta:** the code with both heuristics and the three problem shapes, with the bound said in one sentence; the amortised-bound side is already covered by `docs/dsa/pages/phase-1-complexity/03b-union-find-and-the-limits-of-amortised.md`, which this page should link rather than repeat.

### T12-10 · Grid tricks — Master · 🔲 not written
- **Read this:** [Grids and graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games · a `dirs` list of offset pairs added to the current coordinates, a neighbours function filtered by bounds or membership, four edges per cell and four more for diagonals (*read*) · page dated 2026-03-23 · covers our angle: **partial** — no cell-as-one-integer encoding and no in-place visited marks · fetched 2026-10-14
- **Also good:** [Flood fill](https://en.wikipedia.org/wiki/Flood_fill) · Wikipedia · four-way against eight-way movement (*read*) · fetched 2026-10-14
- **Our delta:** the direction-vector array, the bounds check written once, encoding a cell as row times width plus column, and marking visited in place.

### T12-11 · Bipartite check — Understand · 🔲 not written
- **Read this:** [Check whether a graph is bipartite](https://cp-algorithms.com/graph/bipartite-check.html) · cp-algorithms · BFS from each unvisited vertex, flipping the side with `side[v] ^ 1` for each new neighbour, and a neighbour on the same side means not bipartite (*read*) · covers our angle: **partial** — the BFS form and the loop over disconnected parts are there; the DFS form and the possible-bipartition problem are not · fetched 2026-10-14
- **Also good:** [Bipartite graph](https://en.wikipedia.org/wiki/Bipartite_graph) · Wikipedia · bipartite means no odd-length cycle, equivalently two-colourable, and a linear-time DFS or BFS two-colouring tests it (*read*) · fetched 2026-10-14
- **Our delta:** the same test in BFS and DFS, the disconnected-graph loop, and the possible-bipartition problem as the interview wrapper.

### T12-12 · Cloning and constructing graphs — Understand · 🔲 not written
- **Read this:** [Graph (abstract data type)](https://en.wikipedia.org/wiki/Graph_(abstract_data_type)) · Wikipedia · the adjacency-list structure that a deep copy has to reproduce node by node (*read*) · covers our angle: **partial** — no cloning algorithm · fetched 2026-10-14
- **Also good:** [Depth First Search](https://cp-algorithms.com/graph/depth-first-search.html) · cp-algorithms · the traversal that clone-by-DFS rides on (*read*) · fetched 2026-10-14
- **Our delta:** the old-to-new map doing double duty as the visited set, so cycles do not recurse forever, in DFS and BFS forms.

### T12-13 · Minimum spanning tree — Understand · 🔲 not written
- **Read this:** [Minimum spanning tree, Kruskal's algorithm](https://cp-algorithms.com/graph/mst_kruskal.html) · cp-algorithms · sort edges and merge components; O(M log N + N squared) with a naive relabelling, about O(M log N) once a DSU replaces it (*read*) · covers our angle: **partial** — DSU is linked, not implemented, and no minimum-cost-to-connect-points problem · fetched 2026-10-14
- **Also good:** [Minimum spanning tree, Prim's algorithm](https://cp-algorithms.com/graph/mst_prim.html) · cp-algorithms · O(n squared) for dense graphs with plain arrays and O(m log n) for sparse graphs with a `set` (a red-black tree); no heap (*read*) · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.3 Minimum Spanning Trees](https://algs4.cs.princeton.edu/43mst/) · Sedgewick and Wayne, Princeton · Kruskal with a priority queue and union-find in E log E; lazy Prim in E log E and eager Prim in E log V (*read*) · fetched 2026-10-14
- **Beyond the docs:** [VisuAlgo, minimum spanning tree](https://visualgo.net/en/mst) · VisuAlgo, National University of Singapore · animates Kruskal on union-find and Prim on a priority queue (*read*) · fetched 2026-10-14
- **Our delta:** Kruskal with union-find and Prim with a heap shown as the same cut rule, and the dense-points problem where an O(n squared) Prim beats building all edges.

### T12-14 · 0-1 BFS — Understand · 🔲 not written
- **Read this:** [0-1 BFS](https://cp-algorithms.com/graph/01_bfs.html) · cp-algorithms · a single deque with weight-0 edges pushed to the front and weight-1 edges to the back; also gives a two-vector variant reported 1.15 times faster on cache-sized graphs, and Dial's algorithm (*read*) · covers our angle: **partial** — C++ only, and no Java or TypeScript deque · fetched 2026-10-14
- **Also good:** [ArrayDeque (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle · the Java deque for both ends, null elements prohibited, amortised constant-time operations (*read*) · fetched 2026-10-14
- **Our delta:** why the deque keeps distances in nondecreasing order, and the TypeScript stand-in for a deque, since an array's `shift` is linear.

### T12-15 · Graphs in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [Map (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · keys compared by SameValueZero, so object keys are compared by reference; iteration follows insertion order; sublinear average access (*read*) · covers our angle: **partial** — the container, not the adjacency-list idiom · fetched 2026-10-14
- **Also good:** [Too much recursion (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · "too much recursion" in Firefox and "Maximum call stack size exceeded" (a RangeError) in Chrome and Safari, and an exit condition that is reachable but too deep still throws (*read*) · fetched 2026-10-14
- **Also good:** [ArrayDeque (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle · likely faster than `Stack` as a stack and than `LinkedList` as a queue (*read*) · fetched 2026-10-14
- **Our delta:** `Map<number, number[]>` against `List<List<Integer>>`, the depth at which recursive DFS fails on a large grid in each language, and the explicit-stack fallback.

### T12-16 · Graph problems that are really trees — Know · 🔲 not written
- **Read this:** [Tree (graph theory)](https://en.wikipedia.org/wiki/Tree_(graph_theory)) · Wikipedia · a tree on n vertices is equivalent to connected with n minus 1 edges, or acyclic with n minus 1 edges; a forest is defined separately as an acyclic graph or a disjoint union of trees (*read*) · covers our angle: **partial** — no valid-tree interview test or parent array · fetched 2026-10-14
- **Also good:** [Disjoint Set Union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · the union-find route to the same edge-by-edge cycle test (*read*) · fetched 2026-10-14
- **Our delta:** the edge-count test (n minus 1 edges plus connected, or plus acyclic) as the one-line valid-tree check, and the parent array for a rooted forest.

---

## Phase 13 — Shortest paths and advanced graph algorithms

### T13-01 · Dijkstra — Master · 🔲 not written
- **Read this:** [Dijkstra Algorithm](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms · edge weights must be non-negative, correctness by induction that a marked vertex's distance never changes, O(n squared + m) for the array version (*read*) · covers our angle: **partial** — no heap here; it points to the sparse article for that · fetched 2026-10-14
- **Also good:** [Dijkstra on sparse graphs](https://cp-algorithms.com/graph/dijkstra_sparse.html) · cp-algorithms · the `priority_queue` version leaves outdated pairs in the queue and skips them on pop, which is the lazy deletion; without the check complexity can reach O(nm) (*read*) · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.4 Shortest Paths](https://algs4.cs.princeton.edu/44sp/) · Sedgewick and Wayne, Princeton · edge relaxation as the primitive, Dijkstra in E log V with non-negative weights, and that re-enqueuing makes it correct with negative edges but exponential in the worst case (*read*) · fetched 2026-10-14
- **Also good:** [PriorityQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · `offer` and `poll` are O(log n), `remove(Object)` and `contains(Object)` are linear, and there is no decrease-key (*read*; that this makes lazy deletion the right choice is our inference) · fetched 2026-10-14
- **Beyond the docs:** [VisuAlgo, single-source shortest paths](https://visualgo.net/en/sssp) · VisuAlgo, National University of Singapore · animates Dijkstra and Bellman-Ford, including an example where the original Dijkstra fails on a negative edge (*read*) · fetched 2026-10-14
- **Our delta:** the relaxation invariant stated once, a hand-written TypeScript heap against Java's built-in, and network delay and minimum effort as the two problem shapes.

### T13-02 · Constrained shortest paths — Master · 🔲 not written
- **Read this:** [Bellman-Ford Algorithm](https://cp-algorithms.com/graph/bellman_ford.html) · cp-algorithms · the invariant that after phase i the algorithm has found all shortest paths of at most i edges; the page has no separate k-edges-limited variant (*read*) · covers our angle: **partial** — the invariant behind the bounded rounds, not the cheapest-flights problem · fetched 2026-10-14
- **Also good:** [Breadth-first search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · states as vertices, the layered idea for stop counts (*read*) · fetched 2026-10-14
- **Our delta:** cheapest flights within k stops solved two ways, by layered rounds with a copy of the distance array each round and by Dijkstra over a (city, stops) state, with the reason the plain visited-once Dijkstra is wrong.

### T13-03 · The decision table — Master · 🔲 not written
- **Read this:** [Shortest path problem](https://en.wikipedia.org/wiki/Shortest_path_problem) · Wikipedia · Dijkstra for non-negative weights, Bellman-Ford if weights may be negative, Floyd-Warshall for all pairs, BFS for unweighted in O(E+V), and topological sorting for a DAG in Theta(E+V) even with arbitrary weights (*read*) · covers our angle: **partial** — complexity tables per graph class, but no single decision table keyed on the graph's shape · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.4 Shortest Paths](https://algs4.cs.princeton.edu/44sp/) · Sedgewick and Wayne, Princeton · acyclic digraphs relaxed in topological order handle negative weights in E+V; Bellman-Ford in E times V (*read*) · fetched 2026-10-14
- **Our delta:** one table keyed on the graph's shape, with the cost of each entry and the one-line reason for each rung, built to be reproduced on a blank page.

### T13-04 · Bellman–Ford — Understand · 🔲 not written
- **Read this:** [Bellman-Ford Algorithm](https://cp-algorithms.com/graph/bellman_ford.html) · cp-algorithms · n minus 1 phases suffice because no shortest path has more than n minus 1 edges; one extra phase that still relaxes shows a reachable negative cycle, which can be recovered through predecessors; SPFA is also covered (*read*) · covers our angle: **partial** — no TypeScript or Java and no bounded-rounds problem · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.4 Shortest Paths](https://algs4.cs.princeton.edu/44sp/) · Sedgewick and Wayne, Princeton · a negative cycle is reachable if the queue is still non-empty after the Vth pass (*read*) · fetched 2026-10-14
- **Also good:** [Finding a negative cycle in the graph](https://cp-algorithms.com/graph/finding-negative-cycle-in-graph.html) · cp-algorithms · Bellman-Ford with every distance starting at zero, then N walks back through parents to land on the cycle (*read*) · fetched 2026-10-14
- **Our delta:** the bounded-rounds variant with a copy of the previous round, and what an extra round proves.

### T13-05 · Floyd–Warshall — Understand · 🔲 not written
- **Read this:** [Floyd-Warshall Algorithm](https://cp-algorithms.com/graph/all-pair-shortest-path-floyd-warshall.html) · cp-algorithms · the `k` loop is outermost with `i` and `j` inside, O(n cubed), a negative distance from a vertex to itself shows a negative cycle (*read*) · covers our angle: **partial** — no sizing rule for when n is small enough and no language-specific notes · fetched 2026-10-14
- **Also good:** [Floyd-Warshall algorithm](https://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm) · Wikipedia · the recurrence over intermediate vertices 1 to k, Theta(V cubed), and a check for a negative diagonal inside the innermost loop to avoid underflow (*read*) · fetched 2026-10-14
- **Our delta:** why `k` must be outermost, a feel for the n at which cubic stops fitting the limit, and the threshold-neighbours style of problem.

### T13-06 · Shortest paths over an extended state — Understand · 🔲 not written
- **Read this:** [Breadth-first search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · the auxiliary graph of (vertex, parity) states, the same move as cell plus remaining budget (*read*) · covers our angle: **partial** — a parity example, not an obstacle-removal grid · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.4 Shortest Paths](https://algs4.cs.princeton.edu/44sp/) · Sedgewick and Wayne, Princeton · Dijkstra's relaxation over whatever the vertices are (*read*) · fetched 2026-10-14
- **Our delta:** cell plus remaining removals as the node, the visited array gaining a dimension, and when BFS suffices and when a heap is needed.

### T13-07 · Strongly connected components — Understand · 🔲 not written
- **Read this:** [Strongly connected components and the condensation graph](https://cp-algorithms.com/graph/strongly-connected-components.html) · cp-algorithms · Kosaraju with two DFS passes (the second on the transposed graph) and Tarjan with one DFS and a stack, then building the acyclic condensation graph (*read*) · covers our angle: **partial** — C++ only, no reproducible-in-an-interview framing · fetched 2026-10-14
- **Also good:** [Tarjan's strongly connected components algorithm](https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm) · Wikipedia · a node whose lowlink equals its own index roots a component and the component is popped from the stack, in O(V+E) (*read*) · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.2 Directed Graphs](https://algs4.cs.princeton.edu/42digraph/) · Sedgewick and Wayne, Princeton · Kosaraju-Sharir: reverse postorder of the reverse digraph, then DFS on the original (*read*) · fetched 2026-10-14
- **Our delta:** one implementation you commit to, with the condensation DAG as the reason SCCs matter.

### T13-08 · Bridges and articulation points — Understand · 🔲 not written
- **Read this:** [Finding bridges in a graph in O(N+M)](https://cp-algorithms.com/graph/bridge-searching.html) · cp-algorithms · `tin` is the DFS entry time, `low` the smallest entry time reachable by one back edge from the subtree, and a tree edge (v, to) is a bridge exactly when low of `to` is greater than tin of v (*read*) · covers our angle: **partial** — bridges only, in C++ · fetched 2026-10-14
- **Also good:** [Finding articulation points in a graph in O(N+M)](https://cp-algorithms.com/graph/cutpoints.html) · cp-algorithms · the vertex version: low of a child at least tin of v, with the root a cut vertex only if it has more than one DFS child, in O(N+M) (*read*) · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.1 Undirected Graphs](https://algs4.cs.princeton.edu/41graph/) · Sedgewick and Wayne, Princeton · brute-force bridge finding costs O(E(V+E)) and DFS-based methods reduce it to O(V+E) (*read*) · fetched 2026-10-14
- **Our delta:** the low-link rule explained once with the parent edge handled, and critical connections as the shape.

### T13-09 · Eulerian paths — Understand · 🔲 not written
- **Read this:** [Finding the Eulerian path in O(M)](https://cp-algorithms.com/graph/euler_path.html) · cp-algorithms · all degrees even for a cycle, exactly two odd for a path, and the stack procedure that pops a vertex into the answer when it has no unused edge (*read*) · covers our angle: **partial** — undirected only, and it does not name Hierholzer · fetched 2026-10-14
- **Also good:** [Eulerian path](https://en.wikipedia.org/wiki/Eulerian_path) · Wikipedia · the directed condition (at most one vertex with one more out-edge than in-edges, at most one with the reverse, all others balanced) and Hierholzer's algorithm, which follows unused edges back to the start and splices in new closed trails in O(E), also applicable to directed graphs (*read*) · fetched 2026-10-14
- **Our delta:** the directed variant with sorted adjacency for the lexicographically smallest itinerary, and why the answer is built in reverse.

### T13-10 · Ordering from constraints — Understand · 🔲 not written
- **Read this:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · the ordering machinery the alien-dictionary graph is fed into (*read*) · covers our angle: **partial** — no graph-building from comparisons and no contradiction handling · fetched 2026-10-14
- **Also good:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · Kahn's algorithm, which is the natural fit for tie-breaking and for noticing a cycle (*read*) · fetched 2026-10-14
- **Our delta:** edges from the first differing character of adjacent words, the prefix trap that signals an invalid dictionary, and a cycle as a contradiction.

### T13-11 · DP on DAGs — Understand · 🔲 not written
- **Read this:** [Longest path problem](https://en.wikipedia.org/wiki/Longest_path_problem) · Wikipedia · on a DAG longest paths are found in linear time, because negating the weights creates no negative cycle; used in critical path analysis (*read*) · covers our angle: **partial** — no path-counting and no code · fetched 2026-10-14
- **Also good:** [Algorithms 4th ed., 4.4 Shortest Paths](https://algs4.cs.princeton.edu/44sp/) · Sedgewick and Wayne, Princeton · relax vertices in topological order for E+V, and flip the inequality for longest paths, applied to job scheduling (*read*) · fetched 2026-10-14
- **Our delta:** topological order first and DP second as the standard recipe, with counting paths as the same loop over a different recurrence, and the hand-off to Part 6.

### T13-12 · A* search — Know · 🔲 not written
- **Read this:** [Introduction to the A* Algorithm](https://www.redblobgames.com/pathfinding/a-star/introduction.html) · Red Blob Games · orders the frontier by cost so far plus a heuristic, Manhattan distance on a four-way grid, optimal when the heuristic never overestimates, and suits one goal rather than all locations (*read*) · page dated 2026-09-29 · covers our angle: **partial** — no interview framing of when it matters · fetched 2026-10-14
- **Also good:** [A* search algorithm](https://en.wikipedia.org/wiki/A*_search_algorithm) · Wikipedia · admissible against consistent, Dijkstra as the special case where the heuristic is zero (*read*) · fetched 2026-10-14
- **Also good:** [Implementation of A*](https://www.redblobgames.com/pathfinding/a-star/implementation.html) · Red Blob Games · BFS, Dijkstra and A* in Python and C++ (C# has BFS and A* only) (*read*) · page dated August 2026 · fetched 2026-10-14
- **Our delta:** what to say in a loop, which is name it, state admissibility and say plain BFS is enough on an unweighted grid.

### T13-13 · Max flow and bipartite matching — Know · 🔲 not written
- **Read this:** [Maximum flow, Ford-Fulkerson and Edmonds-Karp](https://cp-algorithms.com/graph/edmonds_karp.html) · cp-algorithms · repeatedly find a source-to-sink path with spare residual capacity and push flow along it; BFS for paths gives O(VE squared); also the max-flow min-cut theorem (*read*) · covers our angle: **partial** — no matching reduction · fetched 2026-10-14
- **Also good:** [Kuhn's algorithm for maximum bipartite matching](https://cp-algorithms.com/graph/kuhn_maximum_bipartite_matching.html) · cp-algorithms · an augmenting path is an alternating path with unsaturated ends, and the algorithm runs in O(nm) (*read*) · fetched 2026-10-14
- **Also good:** [Maximum flow problem](https://en.wikipedia.org/wiki/Maximum_flow_problem) · Wikipedia · a maximum bipartite matching as a unit-capacity max flow, with a source on one side and a sink on the other (*read*) · fetched 2026-10-14
- **Our delta:** the augmenting-path idea in a paragraph, and the short list of problems where it appears.

### T13-14 · The NP-hard boundary — Know · 🔲 not written
- **Read this:** [Travelling salesman problem](https://en.wikipedia.org/wiki/Travelling_salesman_problem) · Wikipedia · TSP is NP-hard, Held-Karp dynamic programming runs in O(n squared times 2 to the n) against O(n factorial) brute force, and heuristics such as nearest neighbour, Christofides-Serdyukov and 2-opt exist (*read*) · covers our angle: **partial** — no interview advice on how to react · fetched 2026-10-14
- **Also good:** [Graph coloring](https://en.wikipedia.org/wiki/Graph_coloring) · Wikipedia · deciding k-colourability is NP-complete for every k except 0, 1 and 2 (*read*) · fetched 2026-10-14
- **Also good:** [Independent set (graph theory)](https://en.wikipedia.org/wiki/Independent_set_(graph_theory)) · Wikipedia · maximum independent set is strongly NP-hard, and its decision version is NP-complete (*read*) · fetched 2026-10-14
- **Our delta:** recognising the shape in thirty seconds, saying so aloud, then reaching for bitmask DP when n is about 20 or a heuristic when it is not; the TSP mask DP itself is already written in `docs/dsa/pages/phase-2-recursion-maths-bits/09f-dp-over-masks-with-a-last-element.md`, which this page should link rather than repeat.

### T13-15 · Graphs in real systems — Know · 🔲 not written
- **Read this:** [Dependency graph](https://en.wikipedia.org/wiki/Dependency_graph) · Wikipedia · edges mean one object needs another evaluated first, any topological order is a valid build order, a cycle means no order exists; names Make and npm (*read*) · covers our angle: **partial** — the dependency graph only; roads and social graphs are not there · fetched 2026-10-14
- **Also good:** [Contraction hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies) · Wikipedia · road networks reach tens of millions of vertices, so plain Dijkstra is impractical and precomputed shortcuts give queries in microseconds (*read*) · fetched 2026-10-14
- **Also good:** [Social graph](https://en.wikipedia.org/wiki/Social_graph) · Wikipedia · the graph of social ties, people as nodes and friendships as edges (*read*) · fetched 2026-10-14
- **Our delta:** the three real graphs mapped back to the algorithms of these two phases, with a pointer to the System Design track's map and feed problems.
