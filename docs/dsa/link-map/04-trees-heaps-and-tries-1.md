---
title: "Link map · DSA · Part 4 (phases 9-11), file 1"
sidebar_label: "04 · trees, heaps, tries (1)"
sidebar_position: 4
---

# Link map · DSA · Part 4, file 1

Rows T09-01 to T09-14 (phase 9, binary trees and BSTs).
*read* = I read the passage; *headings only* = fetched at 200 and headings or keywords checked. Every row below is *headings only*. No page of ours covers these phases yet.

### T09-01 · Traversals — Master · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · the one page with all four orders, iterative forms and the Morris threaded traversal named · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Iterative binary tree traversals using stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · EnjoyAlgorithms · step-by-step stack versions of pre, in and post order · fetched 2026-10-14

### T09-02 · BFS by levels — Master · 🔲 not written
- **Read this:** [Binary Tree Level Order Traversal](https://neetcode.io/solutions/binary-tree-level-order-traversal) · NeetCode · the queue-per-level template that the variants reuse · covers our angle: **partial** - no zigzag or averages · fetched 2026-10-14 (*headings only*)
- **Also good:** [Binary Tree Right Side View](https://neetcode.io/solutions/binary-tree-right-side-view) · NeetCode · the last-node-per-level variant · fetched 2026-10-14
- **Also good:** [Zigzag Level Order](https://neetcode.io/solutions/binary-tree-zigzag-level-order-traversal) · NeetCode · flips direction per level · fetched 2026-10-14
- **Our delta:** level averages are not on a single page; write them as a three-line variation.

### T09-03 · Height, depth, diameter and balance — Master · 🔲 not written
- **Read this:** [Diameter of Binary Tree](https://neetcode.io/solutions/diameter-of-binary-tree) · NeetCode · height returned upward while a global tracks the diameter · covers our angle: **partial** - balance is a separate page · fetched 2026-10-14 (*headings only*)
- **Also good:** [Balanced Binary Tree](https://neetcode.io/solutions/balanced-binary-tree) · NeetCode · the same postorder return value with a sentinel · fetched 2026-10-14
- **Beyond the docs:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · frames the whole family as one bottom-up return pattern · fetched 2026-10-14 (*headings only*)
- **Our delta:** the diameter that skips the root needs an explicit example.

### T09-04 · Lowest common ancestor — Master · 🔲 not written
- **Read this:** [Lowest Common Ancestor](https://www.interviewbit.com/blog/lowest-common-ancestor/) · InterviewBit · covers the recursive tree case and the parent-pointer walk · covers our angle: **partial** - BST walk-down thin · fetched 2026-10-14 (*headings only*)
- **Also good:** [LCA of a Binary Tree](https://neetcode.io/solutions/lowest-common-ancestor-of-a-binary-tree) · NeetCode · the postorder solution · fetched 2026-10-14
- **Beyond the docs:** [Lowest common ancestor, Euler tour](https://cp-algorithms.com/graph/lca.html) · cp-algorithms · the general-tree and many-queries view · fetched 2026-10-14 (*headings only*)
- **Our delta:** depth alignment with parent pointers and the BST walk-down.

### T09-05 · Path problems — Master · 🔲 not written
- **Read this:** [Binary Tree Maximum Path Sum](https://neetcode.io/solutions/binary-tree-maximum-path-sum) · NeetCode · the single-arm return against the two-arm answer · covers our angle: **partial** - plain path-sum variants absent · fetched 2026-10-14 (*headings only*)
- **Our delta:** path sum I, II, III and the prefix-sum version.

### T09-06 · Serialise and deserialise — Master · 🔲 not written
- **Read this:** [Serialize and Deserialize Binary Tree](https://algomaster.io/learn/dsa/serialize-and-deserialize-binary-tree) · AlgoMaster · preorder with null markers and the level-order alternative · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Serialize and Deserialize Binary Tree](https://neetcode.io/solutions/serialize-and-deserialize-binary-tree) · NeetCode · short code walk-through · fetched 2026-10-14

### T09-07 · Search-tree properties — Master · 🔲 not written
- **Read this:** [Binary Search Trees](https://algs4.cs.princeton.edu/32bst/) · Princeton Algorithms · rank, select, floor and Hibbard deletion in one place · covers our angle: **partial** - Java only, no bounds validation · fetched 2026-10-14 (*headings only*)
- **Also good:** [Validate Binary Search Tree](https://neetcode.io/solutions/validate-binary-search-tree) · NeetCode · the bounds approach · fetched 2026-10-14
- **Also good:** [Deletion from BST](https://www.techiedelight.com/deletion-from-bst) · Techie Delight · the three delete cases with successor · fetched 2026-10-14
- **Our delta:** TypeScript versions and the k-th smallest by iterative inorder.

### T09-08 · The small recursive classics — Master · 🔲 not written
- **Read this:** [Invert Binary Tree](https://neetcode.io/solutions/invert-binary-tree) · NeetCode · the smallest example of the shared recursive shape · covers our angle: **partial** - one problem per page · fetched 2026-10-14 (*headings only*)
- **Also good:** [Symmetric Tree](https://neetcode.io/solutions/symmetric-tree) · NeetCode · mirror comparison · fetched 2026-10-14
- **Also good:** [Subtree of Another Tree](https://neetcode.io/solutions/subtree-of-another-tree) · NeetCode · same-tree check inside a walk · fetched 2026-10-14
- **Our delta:** the single page showing all four share one skeleton.

### T09-09 · Constructing trees — Understand · 🔲 not written
- **Read this:** [Construct Binary Tree from Preorder and Inorder](https://neetcode.io/solutions/construct-binary-tree-from-preorder-and-inorder-traversal) · NeetCode · root from preorder, split by inorder index map · covers our angle: **partial** - postorder and sorted-array forms missing · fetched 2026-10-14 (*headings only*)
- **Also good:** [0105 Construct Binary Tree](https://books.halfrost.com/leetcode/en/ChapterFour/0100~0199/0105.Construct-Binary-Tree-from-Preorder-and-Inorder-Traversal/) · halfrost LeetCode book · worked derivation · fetched 2026-10-14
- **Our delta:** postorder plus inorder (build right first) and sorted array to balanced BST.

### T09-10 · Views and column order — Understand · 🔲 not written
- **Read this:** [Top view of Binary Tree](https://www.interviewbit.com/blog/top-view-of-binary-tree/) · InterviewBit · horizontal distance with BFS · covers our angle: **partial** - no boundary traversal · fetched 2026-10-14 (*headings only*)
- **Also good:** [Top view of binary tree, level order](https://dev.to/jaspreet_singh_86ae1740ac/top-view-of-binary-tree-level-order-traversal-17di) · DEV Community · map-based code · fetched 2026-10-14
- **Our delta:** left, right and bottom views, boundary traversal, and the row-then-value tie-break of vertical order.

### T09-11 · Balanced search trees — Understand · 🔲 not written
- **Read this:** [Balanced Search Trees](https://algs4.cs.princeton.edu/33balanced/) · Princeton Algorithms · 2-3 trees and red-black trees with rotations · covers our angle: **partial** - AVL and the JavaScript workaround missing · fetched 2026-10-14 (*headings only*)
- **Also good:** [TreeMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html) · Oracle · floor, ceiling and navigation methods · fetched 2026-10-14
- **Also good:** [Self-balancing binary search tree](https://en.wikipedia.org/wiki/Self-balancing_binary_search_tree) · Wikipedia · AVL against red-black overview · fetched 2026-10-14
- **Our delta:** what to do in TypeScript, which has no sorted map.

### T09-12 · Tree DP — Understand · 🔲 not written
- **Read this:** [House Robber III](https://neetcode.io/solutions/house-robber-iii) · NeetCode · the rob/skip pair returned per node · covers our angle: **partial** - good nodes and same-value path absent · fetched 2026-10-14 (*headings only*)
- **Also good:** [Tree Dynamic Programming](https://yennj12.js.org/CS_basics/algo_demo/dp-tree.html) · yennj12 · general state-per-node reference · fetched 2026-10-14
- **Our delta:** the other two named problems.

### T09-13 · Trees in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [How to Optimize Tree Recursion in JavaScript](https://hackernoon.com/how-to-optimize-tree-recursion-in-javascript) · HackerNoon · call-stack limits and the explicit-stack fallback · covers our angle: **partial** - no Java side or node-class conventions · fetched 2026-10-14 (*headings only*)
- **Our delta:** the TreeNode classes interviewers supply, and Java stack depth.

### T09-14 · N-ary trees and the parent-array form — Know · 🔲 not written
- **Read this:** [N-ary Tree Data Structure](https://www.enjoyalgorithms.com/blog/n-ary-tree) · EnjoyAlgorithms · representation and traversals of children lists · covers our angle: **partial** - no parent array or edge list · fetched 2026-10-14 (*headings only*)
- **Also good:** [Height of a generic tree from parent array](https://www.geeksforgeeks.org/?p=174060) · GeeksforGeeks · builds adjacency from a parent array, then BFS · fetched 2026-10-14
- **Our delta:** edge list to rooted tree by skipping the parent.
