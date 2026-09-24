---
name: devbible-javascript-concepts-phase5b
description: Load-bearing claims from JavaScript phase 5's Understand and Know tiers (topics 03 onward) — the built-in library — with the sources they were validated against
metadata:
  type: reference
---

**Phase 5, Understand and Know tiers.** Written by lane A in the `js-lane-a` worktree from
2026-08-15. The Master tier's concepts are in [[devbible-javascript-concepts-phase5]]; the live
cursor is [[devbible-javascript-build-progress]].

**Documentation-validated against MDN**, sources named in each page's `> Verified:` line. **No
sandbox, no timings, no console blocks** — rule 8.

## Topic 03 · `slice` vs `splice` vs `at` (Understand, 235 lines, single file)

- **The framing that carries it:** two methods one letter apart doing opposite things, and **both
  return the selected elements** — which is exactly why the mutation slips through code review.
  Mnemonic: **`sPlice` performs surgery**.
- 🔴 **The second argument is a different parameter in each.** `slice(1, 3)` — exclusive **end
  index**, two elements. `splice(1, 3)` — a **count**, three elements removed.
- ⚠️ **Omitting `deleteCount` ≠ passing `0`.** `splice(2)` removes everything from index 2 on;
  `splice(2, 0, x)` is a pure insert.
- **`arr[-1]` is `undefined` because `-1` is a property key, not an index** — that is *why* `at()`
  exists. `at` also works on strings and typed arrays.
- 🔴 **Splicing inside a forward loop skips elements** (each removal shifts the rest down while `i`
  increments). Three ranked fixes: **`filter`** (almost always), backwards iteration (only when the
  array identity must be preserved), and `i--` (works, reads like a puzzle).
- **`substring` is worth avoiding on strings**: it clamps negatives to `0` and **silently swaps its
  arguments** when `start > end` — `"hello".substring(3, 1)` is `"el"`. `slice` does neither.
- `toSpliced`/`with` (ES2023) named as recent, with an explicit check-support caveat.

## Topic 08 · Template literals (Understand, 2 chunks, 412 lines)

- **Every `${}` is a ToPrimitive string conversion**, so `"[object Object]"`, `"1,2,3"` for arrays,
  the literal words `"null"`/`"undefined"`, and **symbols throwing** are all one fact, not four.
- ⚠️ **Multiline keeps the code's indentation**, which is invisible in HTML and breaks Markdown,
  YAML, snapshot tests and anything hashed. Fix by not indenting, `.trim()`, or a real `dedent` tag
  that strips the **common** indent.
- 🔴 **Template literals escape NOTHING** — `innerHTML = \`<div>${userInput}</div>\`` is XSS, and the
  same reasoning applies to SQL.
- 🔴 **The whole point of a tag: it sees the seam between literal text and interpolated value**, a
  distinction destroyed the moment the string is built. That is what makes a `sql` tag
  **injection-proof by construction** rather than by remembering to escape. ⚠️ **The tag does the
  work, not the syntax** — an `html` tag is safe only because that function escapes.
- **`strings.length === values.length + 1`**, always — text alternates with values and both ends are
  text.
- **`.raw` is the text before escape processing**; `String.raw` is the built-in tag. ⚠️ It disables
  backslash escapes only — **`${}` still interpolates**.
- 🔴 **The strings array is FROZEN and cached PER CALL SITE** — the same object on every evaluation,
  which is how `gql`/`lit` cache a parse against it in a `WeakMap`. Two identical templates in
  different files are still different objects.

## Topic 11 · `Number` and `Math` (Understand, 2 chunks, 478 lines)

**One fact drives the page: every number is a 64-bit float.** Both chunks are consequences.

- 🔴 **`Math.round` rounds halves toward +∞, not away from zero** — `2.5 → 3` but **`-2.5 → -2`**.
  Asymmetric across zero, which shows up when averaging or rounding signed deltas. The four
  functions **only differ on negatives**; `Math.trunc` is "drop the decimals" and is what integer
  division usually means.
- ⚠️ **`n | 0` / `~~n` truncate via a 32-bit signed coercion**, so anything past ~2.1 billion wraps
  (often negative). A correctness cliff, not a micro-optimisation.
- 🔴 **`toFixed` fails twice for money:** it returns a **string** (so `+` concatenates), and it
  rounds the **stored binary value** — `(1.005).toFixed(2)` is `"1.00"`, `(2.675).toFixed(2)` is
  `"2.67"`. **There is no fix at that level**; the answers are integer minor units for storage and
  `Intl.NumberFormat` for display.
- **`MAX_SAFE_INTEGER` (2⁵³−1) has one everyday case:** 64-bit database IDs arriving as JSON
  numbers silently lose their last digits, so two records can compare equal. **Carry those IDs as
  strings end to end.**
- ⚠️ **An absolute `Number.EPSILON` comparison only works near 1** — the representable gap grows
  with magnitude. Use a relative tolerance, or restructure so equality is on integers.
- **`Number("")` and `Number(null)` are `0`; `Number("42px")` is `NaN`; `parseInt("42px")` is `42`.**
  Choose by whether a numeric **prefix** should count. Always pass `parseInt`'s radix (`"0x10"` → 16
  without it).
- 🔴 **The global `isNaN`/`isFinite` coerce first**, so `isNaN("abc")` is `true`. Use the `Number.*`
  versions. `Number.isNaN` is the only reliable NaN test, since `NaN !== NaN`.
- **Random integer, inclusive:** `Math.floor(Math.random() * (max - min + 1)) + min` — the `+ 1` is
  what makes `max` reachable.
- 🔴 **`Math.random` is not cryptographically secure** (MDN says so) — tokens, reset codes and
  session IDs need `crypto.randomUUID()` / `crypto.getRandomValues()`. And
  **`sort(() => Math.random() - 0.5)` is not a shuffle** — the comparator is inconsistent, so the
  result depends on the sort algorithm. Fisher–Yates is five lines.
- 🔴 **`Math.max(...[])` is `-Infinity`** (identity value) — the empty-cart bug. Spreading a very
  large array can also throw `RangeError`; `reduce` avoids both.

## Topic 12 · String searching (Understand, 2 chunks, 428 lines)

- **`if (s.indexOf(x))` is false when the match is at index 0** — the bug `includes` removes.
- 🔴 **`includes`/`startsWith`/`endsWith` THROW on a regex** (deliberately — silent stringification
  would be worse), while **`indexOf` stringifies it**, so `"a/b/".indexOf(/b/)` searches for the
  literal `"/b/"`.
- ⚠️ **`endsWith`'s second argument is an END position**, not a start: `"hello".endsWith("hell", 4)`
  is `true`. And `lastIndexOf` searches **backwards** from its position argument.
- 🔴 **`toLowerCase` case-insensitivity is wrong twice:** it is locale-independent, so Turkish's
  dotless `ı` breaks it (`"I".toLocaleLowerCase("tr-TR")` is `"ı"`), and **case folding is not
  symmetric** — `ß` uppercases to `SS`, so `"Straße"` and `"STRASSE"` never match. The real answer
  is `Intl.Collator` with `sensitivity: "base"`.
- ⚠️ **`charAt` returns `""` out of range where `s[i]`/`at()` return `undefined`** — so a `??`
  fallback silently does not fire.
- 🔴 **`sort()` on strings compares UTF-16 code units**, so every capital sorts before every
  lowercase and accents land after `z`. Not alphabetical in any language.
- **Collation is genuinely locale-dependent and both answers are right:** German sorts `ä` near `a`,
  Swedish sorts it **after `z`**. There is no locale-independent "correct" alphabetical order.
- **Build ONE `Intl.Collator` and pass `collator.compare` to `sort`** (MDN's own recommendation) —
  the locale and options resolve once instead of per comparison. `localeCompare` returns a
  **negative/zero/positive**, not `-1`/`1`.
- **`numeric: true` is the fix for `file10` before `file2`** and is the option most projects should
  have on. The `sensitivity` scale: `base` (case+accents ignored) → `accent` → `case` → `variant`
  (default, all distinct).
- 🔴 **The same text can be encoded two ways** — `é` as one code point or `e` + combining accent.
  They render identically, are **not `===`**, have different `length`, and break `Set`/`Map` keys
  and `includes`. **`normalize("NFC")` at the boundary**, once — `Intl.Collator` already handles it
  for *comparison*.
- **Three units, three tools:** code unit (`length`, `s[i]` — storage only), code point (`[...s]`,
  `for...of`), **grapheme (`Intl.Segmenter`)** — what a reader calls a character. `"👍".length` is
  **2**; a ZWJ family emoji is 8. A `.length`-based character counter is wrong for every emoji, and
  `slice` can cut a surrogate pair in half and render `�`.

## Topic 13 · Non-mutating array counterparts (Understand, 186 lines, single file)

- **The four pairs:** `sort`→`toSorted`, `reverse`→`toReversed`, `splice`→`toSpliced`,
  `arr[i]=v`→`with`. `push`/`pop`/`shift`/`unshift` have no `to…` version because spread and `slice`
  already say it.
- 🔴 **The bug they exist for, and it is the framework one:** a mutating `sort` returns the **same
  reference**, so change detection sees no change and **the UI does not update while logging shows
  the correct order**. `setItems(items.sort(f))` vs `setItems(items.toSorted(f))`.
- ⚠️ **`with` throws `RangeError` out of range** — deliberately, where `a[9] = v` would extend the
  array with holes. It also accepts negative indices.
- **They are shallow copies** — they solve "do not reorder my array", not "do not mutate my
  objects". And **`toSorted` still uses the default string comparator**.
- **`TypedArray` has `toSorted`/`toReversed`/`with` but NOT `toSpliced`** (fixed length).
- ⚠️ ES2023 — check targets; the `[...arr].sort()` idiom is not deprecated and is more portable.

## Topic 14 · `flat`, `flatMap`, `fill`, `copyWithin` (Understand, 202 lines, single file)

- **`flat()` is one level by default** and **also removes empty slots**, so it changes a sparse
  array's length — the shortest densify. `flat(Infinity)` for unknown depth.
- **`flatMap` flattens one level only, no depth argument.** Its best use is **filter+map in one
  pass** — return `[]` to drop, `[value]` to keep — which also narrows better in TypeScript than a
  `filter(Boolean)` chain.
- 🔴 **`fill` evaluates its argument ONCE**, so `new Array(3).fill([])` puts **the same array** in
  every slot. `Array.from({ length: 3 }, () => [])` calls the function per index. **`fill` for
  primitives, `Array.from` for anything else.**
- **`copyWithin` is read-only knowledge** — it exists for typed arrays (ring buffers, audio, image
  data); in app code it is a `slice` and a spread written obscurely.
- 🔴 **`indexOf` can NEVER find `NaN`** (`===`, and `NaN !== NaN`) while **`includes` can**
  (SameValueZero). `indexOf` also **skips holes** where `includes` reports `undefined`.
- **The three equality algorithms, and this is the reusable table:**
  `===` / `indexOf` — NaN unequal, `0 === -0`. **SameValueZero** — `includes`, **`Map`/`Set` keys** —
  NaN equal, `-0` equal. **SameValue** — `Object.is` — NaN equal, **`-0` NOT equal**.
  That is *why* `NaN` works as a `Map` key while `indexOf` cannot find it.

## Topics 15 and 16 · Regular expressions (Understand, 2 chunks each, 899 lines total)

**Syntax (15).**

- 🔴 **The two facts behind most real regex bugs:** `.` **does not match line terminators** without
  the `s` flag, and **`\w` is ASCII-only** (`[A-Za-z0-9_]`) — so `^\w+$` rejects `Müller` and every
  non-Latin name. **`\p{L}` with the `u` flag** is the fix, and **`\b` inherits the same problem**
  because it is defined in terms of `\w`.
- **Greedy vs lazy**, and the better third option: **a negated class (`[^>]+`) cannot overshoot at
  all**, so it beats both `.+` and `.+?`.
- **Inside `[...]` most metacharacters are literal** — only `]`, `\`, a leading `^` and a hyphen in
  range position need care.
- **Escape user input before `new RegExp`** — `s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`. A built-in
  `RegExp.escape` is **recent, check support**.
- 🔴 **`|` has the LOWEST precedence in the pattern**, so `/^cat|dog$/` means `(^cat)|(dog$)`. And
  **alternation is ordered, not longest-wins** — `/(a|ab)/` on `"ab"` captures `"a"`.
- **Group numbers are positional**, so inserting a group renumbers every `$1` downstream — **named
  groups and `$<name>` survive edits**; `(?:…)` for groups that exist only for a quantifier.
- **A backreference matches the same TEXT, not the same pattern** — which is what makes
  `/(["']).*?\1/` match *matching* quotes.
- **Lookaround is zero-width.** Two idioms: thousands separators
  `replace(/\B(?=(\d{3})+(?!\d))/g, ",")`, and multi-`(?=.*x)` "must contain" checks — the latter
  shown and then **argued against** for code you control (three checks give three error messages).
  **Lookbehind is newer than lookahead — check targets.**
- **An optional group that did not participate is `undefined`, not `""`.**

**In practice (16).** Almost every failure here is the API, not the pattern.

- 🔴 **`match` WITH `/g` silently discards capture groups** and returns plain strings. That is why
  **`matchAll` exists — and it REQUIRES `g`**, throwing otherwise.
- 🔴🔴 **The `lastIndex` trap.** A `g`- or `y`-flagged regex is **stateful**: `test`/`exec` start at
  `lastIndex` and update it, so **the same object gives true, false, true on identical input**.
  Three shapes: a module-level regex, a regex reused in a loop, one reused across renders/requests.
  **The fix is to drop the `g` — `test` never needed it**, not to reset `lastIndex` by hand.
  ⚠️ **`match`/`matchAll`/`replace`/`split` are NOT affected.** A `while (re.exec(s))` loop over a
  pattern that can match empty **never terminates**.
- **Flags:** `u` should be the default for real text (a surrogate pair is one `.` with it);
  **`y` (sticky) is the tokeniser flag** — it refuses to search forward; `d` gives `.indices`.
- **`replace` with a string pattern replaces ONCE.** `replaceAll` with a regex **requires `g`**.
- 🔴 **The replacement string has its own syntax** (`$&`, `$1`, `$<name>`, `` $` ``, `$'`, `$$`), so
  **user-supplied replacement text is interpreted** — the **callback form** (`() => text`) inserts
  literally and is the safe version. Callback args: match, captures…, offset, string, **groups
  last** (only if named groups exist).
- 🔴 **Catastrophic backtracking / ReDoS.** Nested quantifiers (`/^(a+)+$/`) on almost-matching
  input go exponential. **JavaScript has NO atomic groups and NO possessive quantifiers**, so the
  mitigation must be the pattern: no nested quantifiers, negated classes instead of `.`, anchoring,
  bounded input length — or a linear-time engine (RE2). **On Node one bad match blocks the whole
  process.**
- **Four wrong tools:** HTML (`DOMParser`), URLs (`new URL`), structured formats, and **email** —
  no pattern can tell you the mailbox exists, so `type="email"` + a minimal check + **a confirmation
  link**.

## Topic 17 · `Set` (Understand, 203 lines, single file)

- **Two real uses:** deduplication (`[...new Set(arr)]`) and membership. The membership argument is
  made from **the spec's own requirement that implementations give sublinear average access** — no
  timings — with the shape that matters being **build once, query in a loop**. A `Set` built and
  queried once has bought nothing.
- **Insertion order is guaranteed** on iteration (unlike a plain object, where integer-like keys
  jump the queue).
- **Equality is SameValueZero**, so `NaN` deduplicates correctly, `0`/`-0` collapse, and there is no
  coercion (`"1"` and `1` are distinct).
- 🔴 **Objects compare by REFERENCE**, so `new Set([{id:1},{id:1}]).size` is **2**. Deduplicate by
  key with `new Map(items.map(i => [i.id, i]))` and take `.values()`. ⚠️ **Do not use
  `JSON.stringify` as a value key** — property order changes the string, and `undefined`/functions/
  `Map`s are dropped.
- **Seven set methods** (`union`, `intersection`, `difference`, `symmetricDifference`, `isSubsetOf`,
  `isSupersetOf`, `isDisjointFrom`), each returning a **new** `Set`. ⚠️ **Recent — check targets**;
  spread/filter equivalents work everywhere. **The argument must be set-like** (`size`, `has`,
  `keys`) — **a `Map` qualifies and matches on its keys; an array throws.**
- **What a `Set` is not:** indexable, `map`/`filter`-able, JSON-serialisable (`{}`), or protected by
  `Object.freeze` — the last three all being the internal-slots fact from phase 4.

