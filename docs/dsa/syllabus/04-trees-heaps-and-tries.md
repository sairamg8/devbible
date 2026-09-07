---
title: "Part 4 — Trees, heaps and tries"
sidebar_label: "4 · Trees, heaps & tries"
sidebar_position: 4
---

> Phases 9–11 · Recursion with a shape, the structure behind every "top k" and "schedule", and the range structures that appear once a year

Trees are where recursion stops being abstract: every traversal, height and path question
is the same "ask the children, combine, return" move. Heaps are the structure JavaScript
does not give you and interviews assume you can write. Tries and the range structures close
the phase with the rare-but-decisive questions.

---

## Phase 9 — Binary trees and BSTs

Most tree problems are one of three shapes: a traversal, a value returned upward from the
children, or a walk down a search tree. The rows here cover all three, plus the
construction and serialisation problems that test whether you understand the traversals
rather than remember them.

| Topic | Tier |
|---|---|
| **Traversals** — preorder, inorder and postorder recursive and iterative, level order with a queue; the constant-space traversal as the trick interviewers like to see named | <span className="db-tier t-master">Master</span> |
| **BFS by levels** — level averages, zigzag, the right-side view; the "queue size at the start of the level" loop | <span className="db-tier t-master">Master</span> |
| **Height, depth, diameter and balance** — the postorder return-value pattern; the diameter that does not pass through the root | <span className="db-tier t-master">Master</span> |
| **Lowest common ancestor** — in a binary tree by postorder, in a search tree by walking down, with parent pointers by aligning depths | <span className="db-tier t-master">Master</span> |
| **Path problems** — path sums of every kind, the maximum path sum with its "one arm up, two arms for the answer" trick | <span className="db-tier t-master">Master</span> |
| **Serialise and deserialise** — preorder with null markers, level order; the codec that proves you understand the traversal | <span className="db-tier t-master">Master</span> |
| **Search-tree properties** — validation with bounds, the k-th smallest by inorder, the inorder successor, insert and delete with the three cases | <span className="db-tier t-master">Master</span> |
| **The small recursive classics** — same tree, subtree, symmetric, invert; the shared pattern that makes each a four-line function | <span className="db-tier t-master">Master</span> |
| **Constructing trees** — from preorder and inorder, from postorder and inorder, a sorted array into a balanced search tree | <span className="db-tier t-understand">Understand</span> |
| **Views and column order** — left, right, top and bottom views, boundary traversal, vertical order with a map | <span className="db-tier t-understand">Understand</span> |
| **Balanced search trees** — the AVL and red-black ideas, rotations as a concept, Java's sorted map and set, and the sorted structure JavaScript lacks with its workarounds | <span className="db-tier t-understand">Understand</span> |
| **Tree DP** — the house robber on a tree, counting good nodes, the longest path of one value; a state per node returned upward, previewed for [Part 6](06-backtracking-greedy-and-dp.md) | <span className="db-tier t-understand">Understand</span> |
| **Trees in TypeScript and Java** — recursion depth on degenerate trees, the iterative fallback, the node classes the interviewer supplies | <span className="db-tier t-understand">Understand</span> |
| **N-ary trees and the parent-array form** — traversals, height, building a tree from an edge list | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** maximum path sum, serialise/deserialise and lowest common ancestor
come out correct from memory, and you can convert any recursive traversal to an iterative
one on demand.

---

## Phase 10 — Heaps and priority queues

The heap answers "what is the smallest or largest right now" in logarithmic time, which is
the whole of top-k, scheduling and the running median. JavaScript ships no heap, so writing
one in five minutes is a prerequisite; Java's priority queue needs its comparator understood.

| Topic | Tier |
|---|---|
| **The binary heap** — the array representation, sift up and sift down, insert and extract in logarithmic time; a heap of your own in TypeScript, and Java's priority queue with a comparator | <span className="db-tier t-master">Master</span> |
| **Top-k problems** — k largest, k most frequent, k closest points; a min-heap of size k against sorting and against quickselect | <span className="db-tier t-master">Master</span> |
| **Merging k sorted sequences** — the heap of heads; lists, arrays, the smallest covering range | <span className="db-tier t-master">Master</span> |
| **Two heaps** — the running median, the sliding-window median with lazy deletion | <span className="db-tier t-master">Master</span> |
| **Scheduling with heaps** — the task scheduler, meeting rooms, CPU simulation, earliest deadline first | <span className="db-tier t-master">Master</span> |
| **Heapify in linear time** — bottom-up construction and why the bound is linear rather than linearithmic | <span className="db-tier t-understand">Understand</span> |
| **Greedy with heaps** — maximising capital, the minimum cost to connect ropes, reorganising a string | <span className="db-tier t-understand">Understand</span> |
| **Lazy deletion and indexed heaps** — removing arbitrary elements, decrease-key for shortest paths in [Part 5](05-graphs.md) | <span className="db-tier t-understand">Understand</span> |
| **Heap sort and selection** — when the heap is the sorting method, quickselect as the alternative for a single order statistic | <span className="db-tier t-know">Know</span> |
| **Heaps in real systems** — timers, schedulers, the priority queue inside a job runner or a rate limiter | <span className="db-tier t-know">Know</span> |
| **Variants** — d-ary heaps and the others; concept only | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a heap written from memory in TypeScript with tests, then top-k
frequent, merge-k-lists and the running median solved with it — and the same three in Java
using the built-in priority queue.

---

## Phase 11 — Tries, segment trees and Fenwick trees

The structures that separate a strong candidate from a prepared one. The trie is common and
practical; the range structures are rare in interviews outside a few companies, so this
phase says honestly when each appears and keeps the expectations calibrated.

| Topic | Tier |
|---|---|
| **The trie** — insert, search, prefix; a 26-slot array against a map per node; the memory cost and when a hash set is the better answer | <span className="db-tier t-master">Master</span> |
| **Trie applications** — word search with pruning, autocomplete, replacing words by root, the longest common prefix | <span className="db-tier t-master">Master</span> |
| **The binary trie** — the maximum XOR pair, XOR queries over a range | <span className="db-tier t-understand">Understand</span> |
| **The segment tree** — build, point update, range query in logarithmic time; the recursive form you can write under pressure | <span className="db-tier t-understand">Understand</span> |
| **The Fenwick tree** — prefix sums with updates, counting inversions, order statistics; shorter than a segment tree when it fits | <span className="db-tier t-understand">Understand</span> |
| **When these actually appear** — the "range query with updates" phrasing, counting smaller elements after self; honest expectations by company type | <span className="db-tier t-understand">Understand</span> |
| **Lazy propagation** — range updates with a deferred tag; concept and one worked example | <span className="db-tier t-know">Know</span> |
| **The sparse table** — static range minimum with constant-time queries | <span className="db-tier t-know">Know</span> |
| **Suffix structures** — suffix arrays and automata: what they solve and why interviews rarely ask | <span className="db-tier t-know">Know</span> |
| **Tries in real systems** — the radix tree inside HTTP routers, the autocomplete service of the System Design track | <span className="db-tier t-know">Know</span> |
| **Order-statistic and interval trees** — concept only | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write a trie and use it for word search in twenty minutes,
write a Fenwick tree from memory, and explain in one sentence when a segment tree is the
intended solution and when it is over-engineering.

---

← [Part 3 — Linear structures and binary search](03-linear-structures-and-binary-search.md) · [Index](../README.md) · Next → [Part 5 — Graphs](05-graphs.md)
