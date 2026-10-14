---
title: "Link map · DSA · Part 4 (phases 9-11), file 1"
sidebar_label: "04 · trees, heaps, tries (1)"
sidebar_position: 4
---

# Link map · DSA · Part 4, file 1

Rows T09-01 to T09-14 (phase 9, binary trees and BSTs).
*read* = a verifier read the passage that supports the claim on 2026-10-14 (NeetCode solution pages are server-rendered, so their text was read too); *headings only* = fetched at 200 and headings or keywords checked. No page of ours covers these phases yet.

### T09-01 · Traversals — Master · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · pre, in, post and level order, with iterative stack versions of post-order and in-order and Morris in-order threading · covers our angle: **partial** - Morris is in-order only; no stack-based iterative pre-order · fetched 2026-10-14 (*read*)
- **Also good:** [Iterative binary tree traversals using stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · EnjoyAlgorithms · step-by-step stack versions of pre, in and post order · fetched 2026-10-14 (*read*)
- **Also good:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · iterative in-order, pre-order and a short Morris note · fetched 2026-10-14 (*read*)

### T09-02 · BFS by levels — Master · 🔲 not written
- **Read this:** [Binary Tree Level Order Traversal](https://neetcode.io/solutions/binary-tree-level-order-traversal) · NeetCode · DFS and queue-per-level BFS with the level-size loop · covers our angle: **partial** - no zigzag or averages · fetched 2026-10-14 (*read*)
- **Also good:** [Binary Tree Right Side View](https://neetcode.io/solutions/binary-tree-right-side-view) · NeetCode · the last-node-per-level variant, BFS and DFS · fetched 2026-10-14 (*read*)
- **Also good:** [Zigzag Level Order](https://neetcode.io/solutions/binary-tree-zigzag-level-order-traversal) · NeetCode · reverse per level, then the index-flip version with no reversal · fetched 2026-10-14 (*read*)
- **Our delta:** level averages are not on a single page; write them as a three-line variation.

### T09-03 · Height, depth, diameter and balance — Master · 🔲 not written
- **Read this:** [Diameter of Binary Tree](https://neetcode.io/solutions/diameter-of-binary-tree) · NeetCode · height returned upward while a running maximum tracks left plus right; pitfall note that the path need not pass the root · covers our angle: **partial** - balance is a separate page · fetched 2026-10-14 (*read*)
- **Also good:** [Balanced Binary Tree](https://neetcode.io/solutions/balanced-binary-tree) · NeetCode · brute force, then one DFS returning an isBalanced and height pair · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · names two shapes (bottom-up return value, top-down state), the global-variable trick for diameter and the -1 return for balance · fetched 2026-10-14 (*read*)
- **Our delta:** the diameter that skips the root needs an explicit example.

### T09-04 · Lowest common ancestor — Master · 🔲 not written
- **Read this:** [Lowest Common Ancestor](https://www.interviewbit.com/blog/lowest-common-ancestor/) · InterviewBit · recursive binary-tree case and the parent-pointer map walk · covers our angle: **partial** - the BST case is one FAQ sentence; no depth alignment · fetched 2026-10-14 (*read*)
- **Also good:** [LCA of a Binary Tree](https://neetcode.io/solutions/lowest-common-ancestor-of-a-binary-tree) · NeetCode · boolean-flag DFS, then the return-the-node postorder version, plus BFS parent map · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Lowest common ancestor, Euler tour](https://cp-algorithms.com/graph/lca.html) · cp-algorithms · the Euler tour plus range-minimum view for many queries on a general tree · fetched 2026-10-14 (*read*)
- **Our delta:** depth alignment with parent pointers and the BST walk-down.

### T09-05 · Path problems — Master · 🔲 not written
- **Read this:** [Binary Tree Maximum Path Sum](https://neetcode.io/solutions/binary-tree-maximum-path-sum) · NeetCode · best downward arm returned up, both arms through the node for the answer, negative arms clamped to zero · covers our angle: **partial** - plain path-sum variants absent · fetched 2026-10-14 (*read*)
- **Also good:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · path sum as the top-down (pass remaining target down) example · fetched 2026-10-14 (*read*)
- **Our delta:** path sum I, II, III and the prefix-sum version.

### T09-06 · Serialise and deserialise — Master · 🔲 not written
- **Read this:** [Serialize and Deserialize a Binary Tree](https://www.techinterview.org/post/3233476083/serialize-deserialize-binary-tree/) · techinterview.org · preorder with null markers, level-order BFS, BST and N-ary variants, edge cases · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Serialize and Deserialize Binary Tree](https://neetcode.io/solutions/serialize-and-deserialize-binary-tree) · NeetCode · preorder DFS and BFS versions; pitfall list includes delimiter conflicts · fetched 2026-10-14 (*read*)
- **Also good:** [Serialize and Deserialize a Binary Tree](https://www.geeksforgeeks.org/?p=131938) · GeeksforGeeks · preorder and level-order with a -1 marker array · fetched 2026-10-14 (*read*)

### T09-07 · Search-tree properties — Master · 🔲 not written
- **Read this:** [Binary Search Trees](https://algs4.cs.princeton.edu/32bst/) · Princeton Algorithms · rank, select, floor and Hibbard deletion in one place · covers our angle: **partial** - Java only; bounds validation is only an exercise (isBST) · fetched 2026-10-14 (*read*)
- **Also good:** [Validate Binary Search Tree](https://neetcode.io/solutions/validate-binary-search-tree) · NeetCode · the bounds approach; pitfall: comparing only with the parent · fetched 2026-10-14 (*read*)
- **Also good:** [Deletion from BST](https://www.techiedelight.com/deletion-from-bst) · Techie Delight · the three delete cases with successor · fetched 2026-10-14 (*read*)
- **Also good:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · BST section: validate with a min/max range, k-th smallest by inorder counter, sorted array to BST · fetched 2026-10-14 (*read*)
- **Our delta:** TypeScript versions, the inorder successor, and the k-th smallest by iterative inorder.

### T09-08 · The small recursive classics — Master · 🔲 not written
- **Read this:** [Invert Binary Tree](https://neetcode.io/solutions/invert-binary-tree) · NeetCode · the smallest example of the shared recursive shape (BFS, DFS, iterative DFS) · covers our angle: **partial** - one problem per page · fetched 2026-10-14 (*read*)
- **Also good:** [Symmetric Tree](https://neetcode.io/solutions/symmetric-tree) · NeetCode · mirror comparison of node pairs · fetched 2026-10-14 (*read*)
- **Also good:** [Subtree of Another Tree](https://neetcode.io/solutions/subtree-of-another-tree) · NeetCode · same-tree check inside a walk, plus a serialisation variant · fetched 2026-10-14 (*read*)
- **Our delta:** the single page showing all four share one skeleton.

### T09-09 · Constructing trees — Understand · 🔲 not written
- **Read this:** [Construct Binary Tree from Preorder and Inorder](https://neetcode.io/solutions/construct-binary-tree-from-preorder-and-inorder-traversal) · NeetCode · root from preorder, split by inorder index map, plus a limit-based variant; pitfall: build left before right · covers our angle: **partial** - postorder and sorted-array forms missing · fetched 2026-10-14 (*read*)
- **Also good:** [0105 Construct Binary Tree](https://books.halfrost.com/leetcode/en/ChapterFour/0100~0199/0105.Construct-Binary-Tree-from-Preorder-and-Inorder-Traversal/) · halfrost LeetCode book · one-sentence idea and two Go solutions (slice ranges, index map); no derivation · fetched 2026-10-14 (*read*)
- **Our delta:** postorder plus inorder (build right first) and sorted array to balanced BST.

### T09-10 · Views and column order — Understand · 🔲 not written
- **Read this:** [Top view of Binary Tree](https://www.interviewbit.com/blog/top-view-of-binary-tree/) · InterviewBit · horizontal distance in a map, preorder with level tracking · covers our angle: **partial** - top view only; no boundary traversal · fetched 2026-10-14 (*read*)
- **Also good:** [Top view of binary tree, level order](https://dev.to/jaspreet_singh_86ae1740ac/top-view-of-binary-tree-level-order-traversal-17di) · DEV Community · Java BFS with a TreeMap keyed by horizontal distance; notes that bottom and vertical views follow the same pattern · fetched 2026-10-14 (*read*)
- **Our delta:** left, right and bottom views, boundary traversal, and the row-then-value tie-break of vertical order.

### T09-11 · Balanced search trees — Understand · 🔲 not written
- **Read this:** [Balanced Search Trees](https://algs4.cs.princeton.edu/33balanced/) · Princeton Algorithms · 2-3 trees and red-black trees with rotations · covers our angle: **partial** - AVL (no mention) and the JavaScript workaround missing · fetched 2026-10-14 (*read*)
- **Also good:** [TreeMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html) · Oracle · red-black based; floorKey, ceilingKey and navigation methods · fetched 2026-10-14 (*read*)
- **Also good:** [Self-balancing binary search tree](https://en.wikipedia.org/wiki/Self-balancing_binary_search_tree) · Wikipedia · why balance matters, rotations, a list of variants; AVL only in passing (within 1.44 of optimal height), no AVL against red-black comparison · fetched 2026-10-14 (*read*)
- **Our delta:** AVL rotations in one paragraph, and what to do in TypeScript, which has no sorted map.

### T09-12 · Tree DP — Understand · 🔲 not written
- **Read this:** [House Robber III](https://neetcode.io/solutions/house-robber-iii) · NeetCode · recursion, memoisation, then the rob/skip pair returned per node · covers our angle: **partial** - good nodes and same-value path absent · fetched 2026-10-14 (*read*)
- **Also good:** [Tree Dynamic Programming](https://yennj12.js.org/CS_basics/algo_demo/dp-tree.html) · yennj12 · interactive visualiser; short text on a tuple of states per node, post-order, for House Robber III, max path sum and diameter · fetched 2026-10-14 (*read*)
- **Our delta:** the other two named problems.

### T09-13 · Trees in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [How to Optimize Tree Recursion in JavaScript](https://hackernoon.com/how-to-optimize-tree-recursion-in-javascript) · HackerNoon · deep-tree stack overflow, no tail-call optimisation in most engines, explicit-stack fallback · covers our angle: **partial** - preorder only; no Java side or node-class conventions · fetched 2026-10-14 (*read*)
- **Our delta:** the TreeNode classes interviewers supply, and Java stack depth.

### T09-14 · N-ary trees and the parent-array form — Know · 🔲 not written
- **Read this:** [N-ary Tree Data Structure](https://www.enjoyalgorithms.com/blog/n-ary-tree) · EnjoyAlgorithms · child-array and first-child/next-sibling representations, traversals · covers our angle: **partial** - no parent array or edge list · fetched 2026-10-14 (*read*)
- **Also good:** [Height of a generic tree from parent array](https://www.geeksforgeeks.org/?p=174060) · GeeksforGeeks · builds adjacency from a parent array, then BFS, plus a no-map O(n) variant · fetched 2026-10-14 (*read*)
- **Our delta:** edge list to rooted tree by skipping the parent.
