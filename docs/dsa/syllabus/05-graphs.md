---
title: "Part 5 — Graphs"
sidebar_label: "5 · Graphs"
sidebar_position: 5
---

> Phases 12–13 · Traversal, ordering and connectivity as the everyday tools, then the shortest-path family and the advanced algorithms with an honest note on how often each is asked

Graphs are the topic that scares candidates and delights interviewers, because a graph
question tests modelling before it tests algorithms: seeing the grid, the word list or the
course list *as* a graph is the step most people miss. Phase 12 is the toolkit every loop
assumes; phase 13 is the shortest-path family and the rarer algorithms, tiered to match how
often they actually appear.

---

## Phase 12 — Graph fundamentals, traversal and union-find

Two traversals, one ordering, one connectivity structure. With BFS, DFS, topological sort
and union-find you can answer most graph questions asked in a senior loop; the rows below
are those four plus the problem shapes that disguise them.

| Topic | Tier |
|---|---|
| **Representations** — adjacency list against matrix against edge list, building one from edges, directed and undirected and weighted; the grid as an implicit graph | <span className="db-tier t-master">Master</span> |
| **Breadth-first search** — the queue, marking visited on enqueue, shortest paths in unweighted graphs, reconstructing the path from parents | <span className="db-tier t-master">Master</span> |
| **Depth-first search** — recursive and iterative, visited discipline, the three colours that detect a directed cycle | <span className="db-tier t-master">Master</span> |
| **Connected components and flood fill** — counting islands, the largest area, surrounded regions, marking visited in place | <span className="db-tier t-master">Master</span> |
| **Cycle detection** — undirected with a parent check or union-find, directed with colours | <span className="db-tier t-master">Master</span> |
| **Topological sort** — Kahn's algorithm and DFS post-order, the course-schedule family, detecting that no order exists | <span className="db-tier t-master">Master</span> |
| **Multi-source BFS** — rotting oranges, walls and gates, the distance to the nearest zero; seeding the queue with every source | <span className="db-tier t-master">Master</span> |
| **BFS on implicit graphs** — word ladder, minimum mutations, knight moves; the state space as the graph | <span className="db-tier t-master">Master</span> |
| **Union-find** — path compression and union by rank, provinces, the redundant connection, merging accounts; the near-constant amortised bound explained in a sentence | <span className="db-tier t-master">Master</span> |
| **Grid tricks** — direction vectors, bounds checks, encoding a cell as one integer, in-place visited marks | <span className="db-tier t-master">Master</span> |
| **Bipartite check** — two-colouring by BFS or DFS, the possible bipartition | <span className="db-tier t-understand">Understand</span> |
| **Cloning and constructing graphs** — the old-to-new map, cloning by DFS or BFS | <span className="db-tier t-understand">Understand</span> |
| **Minimum spanning tree** — Kruskal with union-find, Prim with a heap, the minimum cost to connect points | <span className="db-tier t-understand">Understand</span> |
| **0-1 BFS** — the deque for graphs whose edges weigh zero or one | <span className="db-tier t-understand">Understand</span> |
| **Graphs in TypeScript and Java** — adjacency lists as maps of arrays against lists of lists, recursion depth on large grids and the iterative fallback | <span className="db-tier t-understand">Understand</span> |
| **Graph problems that are really trees** — the parent array, forests, the edge-count test for a valid tree | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write BFS, DFS, topological sort and union-find from
memory in both languages, and you can name the graph in "word ladder", "course schedule"
and "accounts merge" within thirty seconds of reading each.

---

## Phase 13 — Shortest paths and advanced graph algorithms

The shortest-path family is asked often and confused often; the rest of this phase is asked
rarely and rewards a candidate who can name the right tool and explain why it is overkill
for the question at hand.

| Topic | Tier |
|---|---|
| **Dijkstra** — with a heap and lazy deletion, non-negative weights, the relaxation invariant; network delay, the path with minimum effort | <span className="db-tier t-master">Master</span> |
| **Constrained shortest paths** — cheapest flights within k stops: BFS by layers, Bellman–Ford with a bounded number of rounds, Dijkstra over an extended state | <span className="db-tier t-master">Master</span> |
| **The decision table** — unweighted means BFS, non-negative weights mean Dijkstra, negative edges mean Bellman–Ford, small all-pairs means Floyd–Warshall, a DAG means an order and then DP | <span className="db-tier t-master">Master</span> |
| **Bellman–Ford** — negative edges, the bounded-rounds variant, detecting a negative cycle | <span className="db-tier t-understand">Understand</span> |
| **Floyd–Warshall** — all pairs, the loop order that matters, when the graph is small enough | <span className="db-tier t-understand">Understand</span> |
| **Shortest paths over an extended state** — a grid with obstacles you may remove, the state as cell plus remaining budget | <span className="db-tier t-understand">Understand</span> |
| **Strongly connected components** — the Kosaraju and Tarjan ideas, condensing a graph; one implementation you can reproduce | <span className="db-tier t-understand">Understand</span> |
| **Bridges and articulation points** — low-link values, critical connections in a network | <span className="db-tier t-understand">Understand</span> |
| **Eulerian paths** — Hierholzer's algorithm, reconstructing an itinerary | <span className="db-tier t-understand">Understand</span> |
| **Ordering from constraints** — the alien dictionary: building the graph from comparisons, topological sort with tie-breaking, detecting contradictions | <span className="db-tier t-understand">Understand</span> |
| **DP on DAGs** — the longest path, counting paths; where graphs meet [Part 6](06-backtracking-greedy-and-dp.md) | <span className="db-tier t-understand">Understand</span> |
| **A\* search** — heuristics and admissibility; when it matters and when plain BFS is enough | <span className="db-tier t-know">Know</span> |
| **Max flow and bipartite matching** — the augmenting-path idea; where it appears, which is rarely | <span className="db-tier t-know">Know</span> |
| **The NP-hard boundary** — colouring, independent sets, the travelling salesman; recognising one and saying so, then reaching for bitmask DP or a heuristic | <span className="db-tier t-know">Know</span> |
| **Graphs in real systems** — the road graph, the dependency graph in build tools and package managers, the social graph; the System Design track's map and feed problems | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** Dijkstra written from memory with your own heap in TypeScript and
the built-in one in Java, cheapest-flights solved two different ways, and the decision
table reproduced on a blank page.

---

{/* NAV */}
