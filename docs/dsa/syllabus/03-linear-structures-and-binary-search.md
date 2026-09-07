---
title: "Part 3 — Linear structures and binary search"
sidebar_label: "3 · Linear structures & binary search"
sidebar_position: 3
---

> Phases 6–8 · Stacks and queues used as tools rather than containers, linked lists as the pointer drill they really are, and binary search done without off-by-ones

Three topics that look elementary and produce more failed rounds than graphs do. A monotonic
stack is the difference between a quadratic and a linear answer to a whole family of
problems; a linked-list question is a test of pointer discipline under time pressure; and
binary search is where candidates who "know it" lose to a boundary condition.

---

## Phase 6 — Stacks, queues and monotonic structures

A stack remembers what is unresolved; a queue preserves order. The monotonic variants keep
only candidates that can still matter, which is why they turn "for each element, find the
nearest bigger one" from quadratic into linear.

| Topic | Tier |
|---|---|
| **The stack for matching and parsing** — balanced brackets, path simplification, postfix evaluation, decoding nested strings | <span className="db-tier t-master">Master</span> |
| **The monotonic stack** — next greater and next smaller element, daily temperatures, stock span; the "pop while" invariant and why every element is pushed and popped once | <span className="db-tier t-master">Master</span> |
| **Largest rectangle in a histogram** — the monotonic stack's hardest classic, and the maximal rectangle in a matrix built on it | <span className="db-tier t-master">Master</span> |
| **Min-stack and the auxiliary structure** — constant-time minimum, the pair or the second stack | <span className="db-tier t-master">Master</span> |
| **The monotonic deque** — sliding-window maximum revisited, shortest subarray with a sum of at least k | <span className="db-tier t-master">Master</span> |
| **Circular buffers and array-backed queues** — a bounded queue of your own; why removing from the front of a JavaScript array is the wrong queue | <span className="db-tier t-master">Master</span> |
| **A queue from two stacks, a stack from queues** — amortised analysis practised on a toy | <span className="db-tier t-understand">Understand</span> |
| **Deques in TypeScript and Java** — an array-backed deque you can write in five minutes against Java's built-in one | <span className="db-tier t-understand">Understand</span> |
| **Stack-based simulation** — asteroid collisions, removing adjacent duplicates, an editor buffer | <span className="db-tier t-understand">Understand</span> |
| **Recursion as an explicit stack** — iterative depth-first traversals; previewed for [Part 4](04-trees-heaps-and-tries.md) | <span className="db-tier t-understand">Understand</span> |
| **Design problems on stacks and queues** — browser history, an undo stack, a queue with a maximum | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write the next-greater-element and the histogram
rectangle from memory, explain the linear bound in one sentence, and implement a bounded
circular queue in TypeScript without using the array's shift.

---

## Phase 7 — Linked lists

Interviewers keep asking linked lists because they expose pointer discipline: every
reversal and merge is a small proof about what each reference points to after each step.
The dummy head and the drawn diagram are the tools; the LRU cache is the payoff.

| Topic | Tier |
|---|---|
| **Singly and doubly linked lists** — node shapes, the dummy head, sentinels; where lists win in practice (the LRU cache) and where an array beats them | <span className="db-tier t-master">Master</span> |
| **Reversal** — iterative, recursive, in groups of k, between two positions; the three-pointer dance drawn before it is typed | <span className="db-tier t-master">Master</span> |
| **Fast and slow on lists** — the middle, cycle detection and the cycle's start, the palindrome list | <span className="db-tier t-master">Master</span> |
| **Merging** — two sorted lists, k sorted lists with a heap or by divide and conquer | <span className="db-tier t-master">Master</span> |
| **One-pass tricks** — removing the n-th node from the end with a gap pointer, finding the k-th from the end | <span className="db-tier t-master">Master</span> |
| **The LRU cache** — a doubly linked list plus a map; JavaScript's insertion-ordered `Map` as the shortcut and where it stops being one (see the [JavaScript track](../../javascript/syllabus/04-dsa-and-machine-coding.md)) | <span className="db-tier t-master">Master</span> |
| **Reorder, rotate and partition** — split, reverse and weave; partitioning around a value while keeping order | <span className="db-tier t-understand">Understand</span> |
| **Copying a list with random pointers** — the interleaving trick against a map | <span className="db-tier t-understand">Understand</span> |
| **Arithmetic on lists** — adding numbers with carries, digits stored forward and reversed | <span className="db-tier t-understand">Understand</span> |
| **Intersection of two lists** — aligning lengths, the two-pointer switch | <span className="db-tier t-understand">Understand</span> |
| **Lists in Java and TypeScript** — the built-in list against your own nodes, references and garbage, why the interviewer hands you the node class | <span className="db-tier t-understand">Understand</span> |
| **Flattening and other structural changes** — multilevel lists, recursion against an explicit stack | <span className="db-tier t-know">Know</span> |
| **Skip lists** — the probabilistic sorted structure behind some ordered sets; concept only | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** reverse-in-k-groups, merge-k-lists and the LRU cache come out
correct on the first run in both languages, and you draw the pointer diagram before writing
any of them.

---

## Phase 8 — Binary search

Binary search is a proof about an invariant, not a loop you remember. The rows here are one
template that never overflows and never off-by-ones, the shapes it applies to — sorted data,
rotated data, and a monotone answer space — and the language details that trip people up.

| Topic | Tier |
|---|---|
| **The template** — lower and upper bound with an invariant stated before the loop; the midpoint that cannot overflow; the off-by-one that fails exactly one hidden test | <span className="db-tier t-master">Master</span> |
| **On a sorted array** — first and last occurrence, insert position, the closest element | <span className="db-tier t-master">Master</span> |
| **Rotated sorted arrays** — with and without duplicates, finding the minimum, finding a target | <span className="db-tier t-master">Master</span> |
| **Search on the answer** — a monotone predicate over a numeric range: shipping capacity, eating speed, minimum days, splitting an array, the k-th smallest pair distance | <span className="db-tier t-master">Master</span> |
| **Recognising binary search** — sorted input, or an answer that is monotone; the "minimum x such that" phrasing as the signal | <span className="db-tier t-master">Master</span> |
| **In TypeScript and Java** — no bisect in JavaScript; Java's built-in searches and their negative insertion-point return; writing your own every time and why | <span className="db-tier t-master">Master</span> |
| **On a two-dimensional matrix** — row-major flattening, the staircase search, the k-th smallest in a sorted matrix | <span className="db-tier t-understand">Understand</span> |
| **Median of two sorted arrays** — the partition search; the hardest binary search an interview asks | <span className="db-tier t-understand">Understand</span> |
| **Unknown or unbounded length** — exponential probing, then binary search | <span className="db-tier t-understand">Understand</span> |
| **Floating-point binary search** — precision-bounded loops, square roots, geometric answers | <span className="db-tier t-know">Know</span> |
| **Ternary search and unimodal functions** — the concept and its rare uses | <span className="db-tier t-know">Know</span> |
| **The same idea in trees and databases** — the binary search tree, previewed for [Part 4](04-trees-heaps-and-tries.md), and the B-tree lookup in [PostgreSQL](../../postgresql/README.md) | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** one binary-search template you can reproduce in both languages,
applied to first-occurrence, rotated-minimum and a search-on-answer problem, each with the
invariant written as a comment above the loop.

---

{/* NAV */}
