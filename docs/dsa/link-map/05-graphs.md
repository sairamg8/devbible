---
title: "Link map · DSA · Part 5 (phases 12–13)"
sidebar_label: "05 · graphs"
sidebar_position: 5
---

# Link map · DSA · Part 5 (phases 12–13)

Covers every topic row of phases 12 and 13 in `docs/dsa/syllabus/05-graphs.md`: graph fundamentals, traversal and union-find (T12-01 to T12-16), and shortest paths and advanced graph algorithms (T13-01 to T13-15). That is 31 rows, each with a block, and the tier words are copied from the syllabus table. Our pages exist only for phases 0 to 2, so every block here is `🔲 not written`; the only overlap is the union-find bound, which `docs/dsa/pages/phase-1-complexity/03b-union-find-and-the-limits-of-amortised.md` already states (T12-09 still needs its own page for the problems).
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200, opening or headings checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. "Read this" and "Also good" hold canonical references (cp-algorithms, Princeton Algorithms, Wikipedia, MIT 6.006, MDN); "Beyond the docs" holds explainers, blogs and problem walkthroughs. Where no canonical page covers a problem-shaped topic, the best third-party walkthrough stays under "Read this" and the block says so. Where no good non-canonical explainer was verified after searching, the block has no "Beyond the docs" line.

🔴 **Language note.** The cp-algorithms pages use C++ and the Princeton pages use Java. The interview write-ups (NeetCode, techinterview.org, AlgoMonster) mix Python, Java and C++. All are language-neutral in idea; our solutions are TypeScript first, Java second. Links left out because they could not be read: the Codeforces blog (HTTP 403 and 503 from scripted requests), Baeldung's bridges page (403), LeetCode problem pages (403), and lecture PDFs that came back as binary (MIT 6.006 recitation 12, Illinois CS 374 DAG notes, UW flow notes, Stanford CS161 lecture 12).

---

## Phase 12 — Graph fundamentals, traversal and union-find

### T12-01 · Representations — Master · 🔲 not written
- **Read this:** [Adjacency list](https://en.wikipedia.org/wiki/Adjacency_list) · Wikipedia · space, neighbour listing and edge-existence trade-offs against the adjacency matrix, with the sparse-versus-dense break-even (*read*) · covers our angle: **partial** — "edge list" is only a navigation link, and nothing on building from edges · fetched 2026-10-14
- **Also good:** [4.1 Undirected Graphs](https://algs4.cs.princeton.edu/41graph/) · Princeton Algorithms, Sedgewick and Wayne · the adjacency-list `Graph` API in Java, plus an `AdjMatrixGraph` class behind the same API; no edge list (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Grids and Graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games, modified 2026-03-23 · a grid as a graph whose neighbours are computed on demand by a `neighbors` function and a direction array; nodes are coordinate pairs (*read*) · fetched 2026-10-14
- **Our delta:** edge list, directed and weighted variants, and building each from an edge array in TypeScript.

### T12-02 · Breadth-first search — Master · 🔲 not written
- **Read this:** [Breadth First Search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · queue, a vertex marked used when pushed, the shortest-path claim, and a parent array walked back and reversed; O(n + m) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Breadth-First Search (BFS)](https://www.interviewcake.com/concept/java/bfs) · Interview Cake, updated 2026-06-17 · level-by-level with a FIFO queue, a predecessor map and a `reconstructPath` helper in Java; free to read, with a course upsell · fetched 2026-10-14 (*read*)
- **Our delta:** why marking on dequeue lets a node enter the queue twice.

### T12-03 · Depth-first search — Master · 🔲 not written
- **Read this:** [Depth First Search](https://cp-algorithms.com/graph/depth-first-search.html) · cp-algorithms, updated 2026-05-24 · three colour states stored as 0, 1, 2 (not named white, gray, black), and "cycles can be detected using back edges"; recursive code only (*read*) · covers our angle: **partial** — no iterative form · fetched 2026-10-14
- **Also good:** [4.1 Undirected Graphs](https://algs4.cs.princeton.edu/41graph/) · Princeton Algorithms · `DepthFirstSearch` and `DepthFirstPaths` in Java, recursive (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Converting Recursive DFS to an Iterative Approach in Java](https://dev.to/adityabhuyan/converting-recursive-depth-first-search-dfs-to-an-iterative-approach-in-java-346l) · Aditya Pratap Bhuyan, DEV Community, 2025-07-11 · explicit stack replaces the call stack; says neighbours "should often be pushed in reverse order" to keep the recursive order, uses the legacy `Stack` class and marks on pop, and does not warn about duplicate entries (*read*) · fetched 2026-10-14
- **Our delta:** the iterative version that keeps DFS visit order, in TypeScript.

### T12-04 · Connected components and flood fill — Master · 🔲 not written
- **Read this:** [Finding Connected Components](https://cp-algorithms.com/graph/search-for-connected-components.html) · cp-algorithms, updated 2025-12-28 · repeated DFS in O(n + m), recursive and iterative forms (*read*) · covers our angle: **partial** — no grid or islands · fetched 2026-10-14
- **Also good:** [4.1 Undirected Graphs](https://algs4.cs.princeton.edu/41graph/) · Princeton Algorithms · connected components with `CC.java`, DFS based (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Number of Islands: Flood Fill Pattern Explained](https://www.techinterview.org/post/3233460121/number-of-islands-flood-fill-pattern-explained/) · techinterview.org, 2026-04-16, updated 2026-07-05 · DFS and BFS flood fill, sinking cells in place, a no-modify variant; max area and surrounded regions appear only as table rows without code; BFS complexity not stated (*read*) · fetched 2026-10-14
- **Our delta:** largest area and surrounded regions as variations on one scan loop.

### T12-05 · Cycle detection — Master · 🔲 not written
- **Read this:** [Checking a graph for acyclicity and finding a cycle](https://cp-algorithms.com/graph/finding-cycle.html) · cp-algorithms, updated 2026-09-18 · directed with three colours, undirected with a parent skip, cycle recovered from a parent array (*read*) · covers our angle: **partial** — no union-find method · fetched 2026-10-14
- **Beyond the docs:** [Union-Find Algorithm for cycle detection in a graph](https://techiedelight.com/union-find-algorithm-cycle-detection-graph/) · Techie Delight, updated 2025-09-18 · root comparison per edge, with C++, Java and Python; the simple find is O(n) worst case; the prose example cycle (8, 9, 11, 12) does not match its own edge list, so trust the code (*read*) · fetched 2026-10-14
- **Our delta:** which of the three methods to reach for, by input shape.

### T12-06 · Topological sort — Master · 🔲 not written
- **Read this:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia, edited 2025-12-17 · Kahn's algorithm and the DFS algorithm as separate sections; an order exists only without directed cycles, and leftover edges (Kahn) or a temporarily marked node (DFS) signal one; linear time (*read*) · covers our angle: **full** for both orderings · fetched 2026-10-14
- **Also good:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms, updated 2025-04-22 · DFS exit-time order only; Kahn's algorithm is not covered and the code assumes an acyclic graph (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Topological Sort: Solving the Course Schedule Problem](https://johnkavanagh.co.uk/articles/topological-sort-solving-the-course-schedule-problem/) · John Kavanagh, 2026-03-23 · Kahn's with in-degree counts, a DFS three-state alternative, edge direction and a head pointer instead of `shift()` (its reason for avoiding `shift()` is loose, since engines differ) (*read*) · fetched 2026-10-14
- **Our delta:** the "output shorter than the node count means no order" check.

### T12-07 · Multi-source BFS — Master · 🔲 not written
- **Read this:** [Advanced BFS: Multi-Source, Stateful, and Bidirectional](https://levelop.dev/blog/advanced-bfs-multi-source-stateful-and-bidirectional) · Avinash Tyagi, Levelop, 2026-07-19 · every source queued at distance zero before the first pop, then ordinary BFS; no canonical reference covers this, so this third-party article is the closest. I did not rely on its bidirectional word-ladder snippet, whose meeting check looks only at the other side's frontier (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Graph BFS Interview Patterns](https://www.techinterview.org/post/3233465554/graph-bfs-interview-patterns/) · techinterview.org, updated 2026-04-17 · a multi-source section with the O(V + E) against O(S times (V + E)) comparison, citing 286, 994 and 542; the title says 2025 but the page is dated 2026 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [994. Rotting Oranges](https://neetcode.io/solutions/rotting-oranges) · NeetCode · all rotten oranges queued first, one level per minute, a fresh count to detect the -1 case; O(m times n) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [286. Walls And Gates](https://neetcode.io/solutions/walls-and-gates) · NeetCode · the same loop seeded with every gate; O(m times n); readable without login (*read*) · fetched 2026-10-14
- **Our delta:** the distance to the nearest zero as the same loop with a different seed.

### T12-08 · BFS on implicit graphs — Master · 🔲 not written
- **Read this:** [Word Ladder: BFS on Implicit Graphs Explained](https://www.techinterview.org/post/3233460139/word-ladder-bfs-on-implicit-graphs-explained/) · techinterview.org, 2026-04-16 · words as nodes, single-letter edges, wildcard buckets in O(M squared times N), bidirectional BFS; no canonical reference covers this (*read*) · covers our angle: **partial** — word ladder in full, knight moves only briefly, minimum genetic mutation not mentioned · fetched 2026-10-14
- **Also good:** [Graph BFS Interview Patterns](https://www.techinterview.org/post/3233465554/graph-bfs-interview-patterns/) · techinterview.org, updated 2026-04-17 · states as implicit nodes in the lock puzzle (752) and knight moves (1197), with a check that state count times branching stays feasible; its claim that symmetry makes the knight's space "bounded" needs qualifying (*read*) · fetched 2026-10-14
- **Our delta:** the state-space framing for minimum mutations and knight moves.

### T12-09 · Union-find — Master · 🔲 not written
- **Read this:** [Disjoint Set Union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms, updated 2026-09-19 · path compression alone is O(log n) on average, union by size or rank alone O(log n), both together O(alpha(n)) amortised with alpha(n) at most 4; problems are only listed (*read*) · covers our angle: **full** for the bound; problems are not worked · fetched 2026-10-14
- **Also good:** [Disjoint-set data structure](https://en.wikipedia.org/wiki/Disjoint-set_data_structure) · Wikipedia, revision 2026-10-07 · rank rule, path splitting and halving, Theta(m alpha(n)) for m operations with both, and the weaker bounds for each heuristic alone (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Union-Find (Disjoint Set Union) Interview Patterns](https://www.techinterview.org/post/3233462611/union-find-disjoint-set-interview-patterns/) · techinterview.org, 2026-04-16 · components, cycle detection and Kruskal with code; its claim that a compressed tree has at most 2 levels is wrong (compression flattens only the paths it walks), its accounts-merge code omits the final grouping step, and its `find` is recursive (*read*) · fetched 2026-10-14
- **Our delta:** redundant connection and provinces in TypeScript; the bound itself is already in phase 1 (03b).

### T12-10 · Grid tricks — Master · 🔲 not written
- **Read this:** [Grids and Graphs](https://www.redblobgames.com/pathfinding/grids/graphs.html) · Red Blob Games, modified 2026-03-23 · a `neighbors` function and the `dirs` array for four-way movement; no canonical reference covers grid idioms, so this is the closest (*read*) · covers our angle: **partial** — no integer cell encoding or in-place marks · fetched 2026-10-14
- **Beyond the docs:** [Coding Interview: Matrix and Grid Problems](https://www.techinterview.org/post/3233474301/coding-interview-matrix-and-grid-problems-bfs-dfs-island-counting-shortest-path-rotting-oranges-word-search-flood-fill/) · techinterview.org, 2026-04-20 · the four-direction template, the bounds check, and marking visited in place with the caveat to ask the interviewer first; no single-integer cell encoding (*read*) · fetched 2026-10-14
- **Our delta:** `r * cols + c` encoding, bounds checks, and in-place visited marks.

### T12-11 · Bipartite check — Understand · 🔲 not written
- **Read this:** [Check whether a graph is bipartite](https://cp-algorithms.com/graph/bipartite-check.html) · cp-algorithms, updated 2026-04-02 · BFS two-colouring, conflict on a same-side edge, one search per component (*read*) · covers our angle: **partial** — BFS only, and it cites the even-cycle theorem without explaining it · fetched 2026-10-14
- **Also good:** [Bipartite graph](https://en.wikipedia.org/wiki/Bipartite_graph) · Wikipedia, edited 2026-08-11 · bipartite exactly when there is no odd cycle; a linear-time DFS test returns a two-colouring or an odd cycle, with a BFS variant (*read*) · fetched 2026-10-14
- **Beyond the docs:** [What Is a Bipartite Graph?](https://labuladong.online/en/algo/data-structure/bipartite-graph/) · labuladong Algo Notes · DFS and BFS colouring side by side, and Possible Bipartition as the same check; no odd-cycle argument (*read*) · fetched 2026-10-14
- **Our delta:** the odd-cycle reason a same-colour edge means failure.

### T12-12 · Cloning and constructing graphs — Understand · 🔲 not written
- **Read this:** [133. Clone Graph](https://neetcode.io/solutions/clone-graph) · NeetCode · the old-to-new map, the clone stored before recursing into neighbours, and a BFS variant; O(V + E) time and O(V) space; no canonical reference covers this problem, and the explanation is readable without login (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none beyond TypeScript code and the cycle trap if the map entry is written late.

### T12-13 · Minimum spanning tree — Understand · 🔲 not written
- **Read this:** [4.3 Minimum Spanning Trees](https://algs4.cs.princeton.edu/43mst/) · Princeton Algorithms · Kruskal with a priority queue plus union-find (E log E), lazy Prim (E log E) and eager Prim (E log V); the dense array scan is only an exercise (*read*) · covers our angle: **partial** — no minimum-cost-to-connect-points framing · fetched 2026-10-14
- **Also good:** [Minimum Spanning Tree - Prim's Algorithm](https://cp-algorithms.com/graph/mst_prim.html) · cp-algorithms, updated 2025-06-30 · proof, an O(n squared) dense version with a matrix (noted as suited to Euclidean MST) and an O(m log n) version that uses a C++ `set`, not a heap (*read*) · fetched 2026-10-14
- **Also good:** [Minimum spanning tree: Prim's algorithm, Kruskal's algorithm](https://www.uvm.edu/~cbcafier/cs2240/content/14_mst/01_mst.html) · Clayton Cafiero, University of Vermont, 2025-01-05 · short definitions and Kruskal's find-and-union cycle check; worked examples sit in linked PDFs and no complexity is given (*read*) · fetched 2026-10-14
- **Our delta:** the minimum cost to connect points as Prim on a dense implicit graph.

### T12-14 · 0-1 BFS — Understand · 🔲 not written
- **Read this:** [0-1 BFS](https://cp-algorithms.com/graph/01_bfs.html) · cp-algorithms, updated 2026-09-19 · O(E) shortest paths for weights 0 and 1: push front for 0, back for 1; the main code uses two vectors, and Dial's algorithm covers larger weights (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Unweighted Shortest Path](https://usaco.guide/gold/bfs) · USACO Guide · an "Extension - 0/1 BFS" section with a grid worked example (Tracks in the Snow: same track costs 0, different costs 1); the mechanics are delegated to cp-algorithms (*read*) · fetched 2026-10-14
- **Our delta:** a deque in TypeScript (an array with `shift` is O(n); use a two-ended buffer).

### T12-15 · Graphs in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN, modified 2026-08-13 · the Objects-versus-Maps comparison (prototype keys, any key type, `size`, frequent changes) and the bracket-assignment trap, where `map["x"] = 1` does not create an entry (*read*) · covers our angle: **partial** — the container choice only · fetched 2026-10-14
- **Also good:** [InternalError: too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN, modified 2025-07-08 · Firefox says InternalError, Chrome and Safari say RangeError: Maximum call stack size exceeded; causes are a missing base case or a limit set too high (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Converting Recursive DFS to an Iterative Approach in Java](https://dev.to/adityabhuyan/converting-recursive-depth-first-search-dfs-to-an-iterative-approach-in-java-346l) · Aditya Pratap Bhuyan, DEV Community, 2025-07-11 · explicit `Stack` fallback; see the T12-03 caveats on visit order (*read*) · fetched 2026-10-14
- **Our delta:** array-of-arrays versus `Map`, and the grid depth at which recursion fails.

### T12-16 · Graph problems that are really trees — Know · 🔲 not written
- **Read this:** [Tree (graph theory)](https://en.wikipedia.org/wiki/Tree_(graph_theory)) · Wikipedia · a tree is connected with n minus 1 edges, or acyclic with n minus 1 edges; a forest is defined separately as an acyclic graph or a disjoint union of trees (*read*) · covers our angle: **full** for the edge-count test · fetched 2026-10-14
- **Beyond the docs:** [261. Graph Valid Tree](https://neetcode.io/solutions/graph-valid-tree) · NeetCode · early exit on more than n minus 1 edges, then DFS, BFS or union-find for connectivity; union-find is O(V + E times alpha(V)) (*read*) · fetched 2026-10-14
- **Our delta:** the parent array for rooted trees given as edge lists.

---

## Phase 13 — Shortest paths and advanced graph algorithms

### T13-01 · Dijkstra — Master · 🔲 not written
- **Read this:** [Dijkstra on sparse graphs](https://cp-algorithms.com/graph/dijkstra_sparse.html) · cp-algorithms, updated 2023-01-08 · the `priority_queue` version with lazy deletion (old pairs are not removed, stale ones are skipped on extraction) and the `set` version; O(m log n) (*read*) · covers our angle: **full** for the heap and lazy deletion · fetched 2026-10-14
- **Also good:** [Dijkstra - finding shortest paths from given vertex](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms, updated 2023-09-24 · the induction proof that a marked distance is final; non-negative weights assumed; main code is the O(n squared) linear scan, not a heap (*read*) · fetched 2026-10-14
- **Also good:** [4.4 Shortest Paths](https://algs4.cs.princeton.edu/44sp/) · Princeton Algorithms · edge relaxation, E log V, and why negative weights break it (*read*) · fetched 2026-10-14
- **Also good:** [Lecture 16: Dijkstra](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/resources/lecture-16-dijkstra/) · MIT 6.006, Fall 2011 · video, transcript and notes PDF; the page text does not mention a heap (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Dijkstra's Algorithm](https://courses.grainger.illinois.edu/cs491cap/fa2019/transcripts/dijkstra-shortest-path) · UIUC CS 491 CAP transcript, 2019 · names "lazy deleting" and explains why: the C++ queue cannot update entries; no complexity stated, and it calls the result an "MST" in one place (it is a shortest-path tree) (*read*) · fetched 2026-10-14
- **Our delta:** the minimum-effort path as Dijkstra with max-edge in place of a sum.

### T13-02 · Constrained shortest paths — Master · 🔲 not written
- **Read this:** [Bellman-Ford](https://cp-algorithms.com/graph/bellman_ford.html) · cp-algorithms, updated 2026-09-18 · after phase i all shortest paths of at most i edges are correct, which is the basis of the k-stops variant; also covers SPFA (*read*) · covers our angle: **partial** — no bounded-rounds version with a copy of the previous array · fetched 2026-10-14
- **Beyond the docs:** [787. Cheapest Flights Within K Stops](https://neetcode.io/solutions/cheapest-flights-within-k-stops) · NeetCode · Dijkstra over (city, stops), Bellman-Ford for k plus 1 rounds with a copy of the previous round, and SPFA; no BFS-by-layers section, and its Bellman-Ford bound O(n + m times k) omits the n-element copy each round, so use O(k times (n + m)) (*read*) · fetched 2026-10-14
- **Our delta:** the layered-BFS version and why a settled-once Dijkstra misses the answer.

### T13-03 · The decision table — Master · 🔲 not written
- **Read this:** [Shortest path problem](https://en.wikipedia.org/wiki/Shortest_path_problem) · Wikipedia · algorithms tabulated by graph type: BFS in O(E + V), DAG order in Theta(E + V), Dijkstra variants, Bellman-Ford O(VE), Floyd-Warshall O(V cubed) (*read*, first 100000 characters) · covers our angle: **partial** — split across sections, not one table, and no 0-1 BFS row · fetched 2026-10-14
- **Beyond the docs:** [Shortest Path — Which Algorithm?](https://yennj12.js.org/CS_basics/cheatsheets/shortest_path_comparison.html) · yennj12 cheatsheet (GitHub repo yennanliu/CS_basics, no named author), shows "Updated Oct 14, 2026" · one table from unweighted to all-pairs, including 0-1 BFS, at-most-K-edges Bellman-Ford and DAG relax; two small slips: it lists Dijkstra space as O(V) although the heap can hold O(E) entries, and an LC 847 comment omits a factor of n (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Key Graph-Based Shortest-Path Algorithms: When to Use Each](https://macmyths.com/key-graph-based-shortest-path-algorithms-when-to-use-each/) · MacMyths Team, 2026-09-30 · the same rule in prose, noting the bounds are asymptotic rather than measured; does not cover A* (*read*) · fetched 2026-10-14
- **Our delta:** the table keyed on the question asked, not the algorithm.

### T13-04 · Bellman–Ford — Understand · 🔲 not written
- **Read this:** [Bellman-Ford - finding shortest paths with negative weights](https://cp-algorithms.com/graph/bellman_ford.html) · cp-algorithms, updated 2026-09-18 · a relaxation still happening in phase n means a reachable negative cycle, with cycle extraction; to test the whole graph, start every distance at zero (*read*) · covers our angle: **partial** — no bounded-rounds copy trick · fetched 2026-10-14
- **Also good:** [4.4 Shortest Paths](https://algs4.cs.princeton.edu/44sp/) · Princeton Algorithms · the queue-based version, E times V for the general algorithm, and negative-cycle detection (*read*) · fetched 2026-10-14
- **Our delta:** the cycle must be reachable from the source; a virtual source (or all-zero start) tests the whole graph.

### T13-05 · Floyd–Warshall — Understand · 🔲 not written
- **Read this:** [Floyd-Warshall - finding all shortest paths](https://cp-algorithms.com/graph/all-pair-shortest-path-floyd-warshall.html) · cp-algorithms, updated 2025-10-25 · intermediate vertex k outermost, justified by the phase definition; negative cycles show as a negative diagonal; O(n cubed) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Floyd–Warshall algorithm](https://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm) · Wikipedia, edited 2026-08-11 · says the correct order is KIJ, that IJK and IKJ are wrong on some inputs unless repeated three times, and checks the diagonal for negative cycles; Theta(V cubed) time (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Floyd-Warshall Algorithm](https://www.programiz.com/dsa/floyd-warshall-algorithm) · Programiz · a step-by-step walk through the matrices A0 to A4 with k outermost; the matrices are images, it has small labelling slips, and it says nothing about detecting negative cycles (*read*) · fetched 2026-10-14
- **Our delta:** the symptom of the wrong loop order.

### T13-06 · Shortest paths over an extended state — Understand · 🔲 not written
- **Read this:** [1293. Shortest Path in a Grid with Obstacles Elimination](https://www.algo.monster/liteproblems/1293) · AlgoMonster · the state (row, col, remaining k); visited tracks triples; first arrival is minimal because BFS goes level by level (no per-state proof); O(m times n times k); no canonical reference covers this (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Advanced BFS: Multi-Source, Stateful, and Bidirectional](https://levelop.dev/blog/advanced-bfs-multi-source-stateful-and-bidirectional) · Avinash Tyagi, Levelop, 2026-07-19 · its keys-and-locks example shows why coordinate-only visited can block the only valid path (*read*) · fetched 2026-10-14
- **Our delta:** sizing the state space before coding it.

### T13-07 · Strongly connected components — Understand · 🔲 not written
- **Read this:** [Strongly Connected Components and Condensation Graph](https://cp-algorithms.com/graph/strongly-connected-components.html) · cp-algorithms, updated 2025-12-26 · Kosaraju in two DFS passes over the graph and its transpose, then a separate Tarjan section (one DFS, a stack, roots found in reverse topological order, O(n + m)) with code; the condensation is acyclic (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Tarjan's strongly connected components algorithm](https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm) · Wikipedia, edited 2026-08-20 · index and lowlink, the on-stack test, root when lowlink equals index, O(V + E) (*read*) · fetched 2026-10-14
- **Also good:** [4.2 Directed Graphs](https://algs4.cs.princeton.edu/42digraph/) · Princeton Algorithms · Kosaraju-Sharir in O(V + E); the proof pieces sit in the exercises and Tarjan is only a linked implementation (*read*) · fetched 2026-10-14
- **Our delta:** one implementation to reproduce (Kosaraju) and when Tarjan saves a pass.

### T13-08 · Bridges and articulation points — Understand · 🔲 not written
- **Read this:** [Finding bridges in a graph in O(N+M)](https://cp-algorithms.com/graph/bridge-searching.html) · cp-algorithms, updated 2026-09-18 · entry time and low, bridge when `low[to]` exceeds `tin[v]`; a `parent_skipped` flag lets parallel edges count as back edges (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Finding articulation points in a graph in O(N+M)](https://cp-algorithms.com/graph/cutpoints.html) · cp-algorithms, updated 2023-04-17 · the child test `low[to] >= tin[v]` and the root with more than one DFS child (*read*) · fetched 2026-10-14
- **Beyond the docs:** [1192. Critical Connections in a Network](https://www.algo.monster/liteproblems/1192) · AlgoMonster · the bridge test with Java and TypeScript code; the prose is in Python and the TypeScript and Java carry only comments; O(V + E) (*read*) · fetched 2026-10-14
- **Our delta:** why the bridge test is strict and the cut-vertex test is not, and the parallel-edge case, which cp-algorithms handles in code but does not discuss.

### T13-09 · Eulerian paths — Understand · 🔲 not written
- **Read this:** [Eulerian path](https://en.wikipedia.org/wiki/Eulerian_path) · Wikipedia, edited 2026-10-03 · degree conditions for directed and undirected graphs (including the single connected component), Hierholzer's algorithm named and described as linear time (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Finding the Eulerian path in O(M)](https://cp-algorithms.com/graph/euler_path.html) · cp-algorithms, updated 2026-09-18 · the splice-cycles method (never named Hierholzer) with recursive and stack versions, for undirected multigraphs only (*read*) · fetched 2026-10-14
- **Beyond the docs:** [332. Reconstruct Itinerary](https://neetcode.io/solutions/reconstruct-itinerary) · NeetCode · names Hierholzer: DFS on unused edges, post-order append, reverse; destinations sorted for lexical order; O(E log E) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Hierholzer Algorithm to Find Eulerian Path](https://labuladong.online/en/algo/data-structure/eulerian-graph-hierholzer/) · labuladong Algo Notes · Hierholzer as the reverse postorder of a DFS over all edges, with existence conditions; the conditions as written omit connectivity, and the page does not work through Reconstruct Itinerary (*read*) · fetched 2026-10-14
- **Our delta:** the degree conditions for existence, directed and undirected, plus connectivity.

### T13-10 · Ordering from constraints — Understand · 🔲 not written
- **Read this:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · Kahn's and DFS algorithms, and no order when a cycle exists (*read*) · covers our angle: **partial** — no building a graph from comparisons, no tie-breaking · fetched 2026-10-14
- **Beyond the docs:** [269. Alien Dictionary](https://neetcode.io/solutions/alien-dictionary) · NeetCode · one edge from the first differing letter of each adjacent pair, the invalid-prefix case, Kahn's and DFS cycle handling; O(N + V + E); no tie-breaking rule, so output order for free letters depends on map iteration (*read*) · fetched 2026-10-14
- **Our delta:** tie-breaking with a heap in place of the queue.

### T13-11 · DP on DAGs — Understand · 🔲 not written
- **Read this:** [4.4 Shortest Paths](https://algs4.cs.princeton.edu/44sp/) · Princeton Algorithms · relaxing vertices in topological order solves shortest and longest paths in E plus V, plus the critical path method (*read*) · covers our angle: **partial** — no path counting · fetched 2026-10-14
- **Also good:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · once an order is known, shortest paths in a weighted DAG take Theta(n + m) (*read*) · fetched 2026-10-14
- **Our delta:** counting paths with the same order, and the memoised DFS form.

### T13-12 · A* search — Know · 🔲 not written
- **Read this:** [A* search algorithm](https://en.wikipedia.org/wiki/A*_search_algorithm) · Wikipedia · admissible versus consistent heuristics: consistent means no node is processed twice and A* equals Dijkstra on reduced weights; admissible only needs re-opening of nodes, which can cost exponentially many expansions in the worst case (*read*, first 100000 characters) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Lecture 18: Speeding up Dijkstra](https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/6-006-introduction-to-algorithms-fall-2011/lecture-videos/lecture-18-speeding-up-dijkstra/) · MIT 6.006, Fall 2011 · video, transcript and notes covering single-target Dijkstra, bidirectional search and goal-directed A* (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Introduction to the A* Algorithm](https://www.redblobgames.com/pathfinding/a-star/introduction.html) · Red Blob Games, Amit J. Patel, modified 2026-09-29 · priority is cost so far plus heuristic; optimal when the heuristic never overestimates; BFS or Dijkstra suit all-locations, A* a single goal (*read*) · fetched 2026-10-14
- **Our delta:** when plain BFS is enough.

### T13-13 · Max flow and bipartite matching — Know · 🔲 not written
- **Read this:** [Maximum flow - Ford-Fulkerson and Edmonds-Karp](https://cp-algorithms.com/graph/edmonds_karp.html) · cp-algorithms, updated 2026-09-18 · zero flow, augmenting paths in the residual network, stop when none remain; BFS gives Edmonds-Karp in O(V times E squared) (*read*) · covers our angle: **partial** — matching reduction not shown · fetched 2026-10-14
- **Also good:** [6.4 Maximum Flow](https://algs4.cs.princeton.edu/64maxflow/) · Princeton Algorithms · `FordFulkerson.java`, max-flow min-cut, an E squared times V bound; the "Bipartite matching" heading has no explanation and no residual-network definition (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the unit-capacity matching reduction (source to left side, left to right, right side to sink), and where it appears.

### T13-14 · The NP-hard boundary — Know · 🔲 not written
- **Read this:** [Karp's 21 NP-complete problems](https://en.wikipedia.org/wiki/Karp%27s_21_NP-complete_problems) · Wikipedia, edited 2026-01-19 · chromatic number, clique (with a see-also to independent set) and the Hamilton circuit problems are on the list; the travelling salesman problem itself is not (*read*) · covers our angle: **partial** — the list only · fetched 2026-10-14
- **Also good:** [Held–Karp algorithm](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm) · Wikipedia · subset DP over (subset, endpoint), Theta(n squared times 2 to the n) time and Theta(n times 2 to the n) space; mentions bitmask storage only in the space assumption (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Traveling Salesperson](https://courses.grainger.illinois.edu/cs491cap/fa2019/transcripts/tsp) · UIUC CS 491 CAP transcript, 2019 · factorial brute force to about 11 cities, bitmask DP to about 16; it states the DP as O(2 to the n), which leaves out the per-state work (the usual bound is n squared times 2 to the n), and it counts n factorial permutations rather than (n minus 1) factorial (*read*) · fetched 2026-10-14
- **Our delta:** saying "this is NP-hard" in an interview, then the bitmask fallback.

### T13-15 · Graphs in real systems — Know · 🔲 not written
- **Read this:** [Dependency graph](https://en.wikipedia.org/wiki/Dependency_graph) · Wikipedia, edited 2026-09-14 · build tools (Make, npm install, composer, Ant), package installers, and cycles that make an order impossible (*read*) · covers our angle: **partial** — no road or social graph · fetched 2026-10-14
- **Also good:** [Contraction hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies) · Wikipedia, edited 2026-09-15 · one-time preprocessing with shortcut edges for road networks, with an optional customisation phase when weights change (*read*) · fetched 2026-10-14
- **Our delta:** the social graph and the System Design map and feed problems.
