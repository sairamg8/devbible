---
title: "Link map · DSA · Part 2 (phases 3-5), file 3"
sidebar_label: "02 · arrays, strings, hashing (3)"
sidebar_position: 2
---

# Link map · DSA · Part 2 · file 3

Covers rows T05-01 to T05-13 (phase 5, strings). No page of ours covers these rows yet, so every block is marked not written.
*read* means I read the passage; *headings only* means the page was fetched at HTTP 200 and its title and headings or key terms were checked.

### T05-01 · Strings in TypeScript and Java — Master · 🔲 not written
- **Read this:** [String - JavaScript (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) · MDN · UTF-16 code units, code points and surrogate pairs · covers our angle: **partial** - no Java side · fetched 2026-10-14 (*read*)
- **Also good:** [StringBuilder (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/StringBuilder.html) · Oracle · the mutable builder and its append contract · fetched 2026-10-14
- **Also good:** [Character (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Character.html) · Oracle · char as a code unit and the code point methods · fetched 2026-10-14
- **Our delta:** the real cost of concatenation and character access on each platform.

### T05-02 · Palindromes — Master · 🔲 not written
- **Read this:** [Longest Palindromic Substring](https://neetcode.io/solutions/longest-palindromic-substring) · NeetCode · brute force, dynamic programming, then expand around the centre · covers our angle: **partial** - the two-pointer check is separate · fetched 2026-10-14 (*read*)
- **Also good:** [Valid Palindrome II](https://neetcode.io/solutions/valid-palindrome-ii) · NeetCode · one allowed deletion · fetched 2026-10-14
- **Also good:** [Manacher's Algorithm](https://cp-algorithms.com/string/manacher.html) · cp-algorithms · the linear-time version, beyond interview need · fetched 2026-10-14
- **Beyond the docs:** [Longest Palindromic Substring](https://www.callicoder.com/longest-palindromic-substring/) · CalliCoder · a plain walk-through of the centre expansion · fetched 2026-10-14 (*read*)
- **Our delta:** palindrome partitions are previewed for Part 6.

### T05-03 · Anagrams and frequency signatures — Master · 🔲 not written
- **Read this:** [Group Anagrams](https://neetcode.io/solutions/group-anagrams) · NeetCode · sorted key against a 26-slot count key · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Valid Anagram](https://neetcode.io/solutions/valid-anagram) · NeetCode · the basic comparison · fetched 2026-10-14
- **Also good:** [Find All Anagrams in a String](https://neetcode.io/solutions/find-all-anagrams-in-a-string) · NeetCode · the sliding-window anagram · fetched 2026-10-14

### T05-04 · Parsing problems — Master · 🔲 not written
- **Read this:** [Decode String](https://neetcode.io/solutions/decode-string) · NeetCode · nested decoding with a stack · covers our angle: **partial** - the calculator and atoi are other problems · fetched 2026-10-14 (*read*)
- **Also good:** [Basic Calculator II](https://neetcode.io/solutions/basic-calculator-ii) · NeetCode · the sign-and-stack evaluation · fetched 2026-10-14
- **Our delta:** string to integer with overflow handling, and the parenthesised calculator.

### T05-05 · Building strings efficiently — Master · 🔲 not written
- **Read this:** [StringBuilder (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/StringBuilder.html) · Oracle · the official builder, with its append and capacity notes · covers our angle: **partial** - says nothing about the quadratic loop or TypeScript join · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Back to Basics](https://www.joelonsoftware.com/2001/12/11/back-to-basics/) · Joel Spolsky · the classic account of repeated strcat calls turning quadratic, in C · fetched 2026-10-14 (*read*)
- **Our delta:** collect then join once in TypeScript, and the Java compiler concatenation caveat.

### T05-06 · String matching — Understand · 🔲 not written
- **Read this:** [Prefix function - Knuth-Morris-Pratt](https://cp-algorithms.com/string/prefix-function.html) · cp-algorithms · the failure function derived and applied to matching · covers our angle: **partial** - Z-function and Rabin–Karp are separate pages · fetched 2026-10-14 (*read*)
- **Also good:** [Z-function](https://cp-algorithms.com/string/z-function.html) · cp-algorithms · the Z array and matching by concatenation · fetched 2026-10-14
- **Also good:** [Rabin-Karp for String Matching](https://cp-algorithms.com/string/rabin-karp.html) · cp-algorithms · the rolling hash search · fetched 2026-10-14
- **Our delta:** which of these an interview actually expects.

### T05-07 · Compression and run-length encoding — Understand · 🔲 not written
- **Read this:** [String Compression](https://neetcode.io/solutions/string-compression) · NeetCode · the read and write pointers with multi-digit counts · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Run-length encoding](https://en.wikipedia.org/wiki/Run-length_encoding) · Wikipedia · the general idea and where it is used · fetched 2026-10-14

### T05-08 · The small classics — Understand · 🔲 not written
- **Read this:** [Isomorphic Strings](https://neetcode.io/solutions/isomorphic-strings) · NeetCode · the two-way mapping trap · covers our angle: **partial** - string rotation is not covered · fetched 2026-10-14 (*read*)
- **Also good:** [Word Pattern](https://neetcode.io/solutions/word-pattern) · NeetCode · the same mapping over words · fetched 2026-10-14
- **Also good:** [Longest Common Prefix](https://neetcode.io/solutions/longest-common-prefix) · NeetCode · vertical scan against sorting · fetched 2026-10-14
- **Our delta:** string rotation by doubling the string.

### T05-09 · Reversal problems — Understand · 🔲 not written
- **Read this:** [Reverse Words in a String](https://algomaster.io/learn/dsa/reverse-words-in-a-string) · AlgoMaster · split-and-reverse, then the in-place follow-up of reversing the whole string and then each word · covers our angle: **partial** - a mutable-array version without space cleanup is not shown · fetched 2026-10-14 (*read*)
- **Also good:** [Reverse Words in a String II](https://guides.codepath.org/compsci/Reverse-Words-in-a-String-II) · CodePath · reverse the whole list, then each word, on a character array · fetched 2026-10-14
- **Our delta:** the three-reversal pattern on a character array is ours to write.

### T05-10 · Subsequence checks — Understand · 🔲 not written
- **Read this:** [Is Subsequence](https://neetcode.io/solutions/is-subsequence) · NeetCode · the two-pointer scan · covers our angle: **partial** - the many-queries follow-up (precomputed next occurrence of each character) is on the page · fetched 2026-10-14 (*read*)
- **Our delta:** the follow-up in TypeScript and Java, and the binary-search variant over character positions.

### T05-11 · Unicode and locale pitfalls — Know · 🔲 not written
- **Read this:** [String - JavaScript (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) · MDN · UTF-16 code units, surrogate pairs and the Unicode-aware methods · covers our angle: **partial** - Java and bytes against characters are not covered · fetched 2026-10-14 (*read*)
- **Also good:** [Intl.Collator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator) · MDN · locale-aware comparison options · fetched 2026-10-14
- **Also good:** [String.prototype.normalize()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) · MDN · canonical equivalence before comparing · fetched 2026-10-14
- **Also good:** [Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) · MDN · grapheme clusters, the user-perceived characters · fetched 2026-10-14
- **Beyond the docs:** [The Absolute Minimum Every Software Developer Must Know About Unicode](https://www.joelonsoftware.com/2003/10/08/the-absolute-minimum-every-software-developer-absolutely-positively-must-know-about-unicode-and-character-sets-no-excuses/) · Joel Spolsky · the classic bytes versus characters explanation · fetched 2026-10-14 (*headings only*)

### T05-12 · String hashing — Know · 🔲 not written
- **Read this:** [String Hashing](https://cp-algorithms.com/string/string-hashing.html) · cp-algorithms · polynomial hash, choice of base and modulus, collision probability · covers our angle: **partial** - deduplication and caches are not discussed · fetched 2026-10-14 (*read*)
- **Also good:** [Hashing](https://usaco.guide/gold/hashing) · USACO Guide · polynomial hashes and choosing a random base against hacks · fetched 2026-10-14
- **Also good:** [Rolling hash](https://en.wikipedia.org/wiki/Rolling_hash) · Wikipedia · the family of rolling schemes · fetched 2026-10-14

### T05-13 · The string problems that are really DP — Know · 🔲 not written
- **Read this:** [Edit Distance](https://neetcode.io/solutions/edit-distance) · NeetCode · the table over prefixes and its three moves · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Longest Common Subsequence](https://neetcode.io/solutions/longest-common-subsequence) · NeetCode · the recursive recurrence, memoisation and the bottom-up table · fetched 2026-10-14
- **Also good:** [Regular Expression Matching](https://neetcode.io/solutions/regular-expression-matching) · NeetCode · the star and dot recurrence · fetched 2026-10-14
- **Also good:** [Longest common subsequence](https://en.wikipedia.org/wiki/Longest_common_subsequence) · Wikipedia · the formal definition and applications · fetched 2026-10-14
