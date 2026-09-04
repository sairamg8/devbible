---
title: "Strings are usually the largest single thing in a Java heap, and since Java 9 they are not what you think they are — a byte array plus a one-byte encoding flag, which halved most heaps and made a small number of applications slightly slower"
sidebar_label: "10 · Strings in the heap"
sidebar_position: 39
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JEP 254 · Compact Strings**
> ([openjdk.org/jeps/254](https://openjdk.org/jeps/254)), the **`java.lang.String` javadoc for
> JDK 25**, and the **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html))
> for `-XX:-CompactStrings`. Concatenation behaviour cross-checked against **JEP 280 · Indify
> String Concatenation**. JDK 25 · Spring Boot 4.1.1.
> **No sandbox** — Java source, quoted documentation and arithmetic only. No captured output.

**On almost every heap dump of a business application, `byte[]` and `java.lang.String` are the
top two entries by retained size. Strings are the payload of HTTP, of JSON, of SQL, of logs —
everything crossing a boundary arrives as text. The JVM has accumulated four separate answers
to that fact, and the single most useful thing you can do before tuning anything is to know
which of the four you are actually talking about.**

The four are genuinely distinct, and the first thing to fix is the vocabulary:

| Mechanism | What it does | Cost | Who turns it on |
|---|---|---|---|
| **Compact strings** | Stores Latin-1 text at 1 byte per character instead of 2 | A branch on the coder field | On by default since Java 9 |
| **The string pool** | A JVM-internal table holding one canonical instance per distinct literal | A hash table plus GC work | Always on; holds literals automatically |
| **`String.intern()`** | Puts *your* string into that pool by hand | A native call, potentially expensive | You, explicitly — usually a mistake |
| **String deduplication** | Makes duplicate strings *share one backing array*, leaving the `String` objects distinct | Background GC work | `-XX:+UseStringDeduplication` |

This chunk owns the first one — **the representation**. The other three are all about
*identity and sharing*: the pool and `String.intern()` are in
[10b · The pool and interning](10b-the-pool-and-interning.md), and deduplication — which works
at a different level again, on the arrays rather than the objects — is in
[10c · String deduplication](10c-string-deduplication.md).

## Compact strings: the free 50%

Before Java 9, `String` held a `char[]` — two bytes per character, always, even for text that
was entirely ASCII. Given that the overwhelming majority of strings in a typical application
are ASCII (identifiers, JSON keys, SQL, log messages, URLs), half of every one of those arrays
was zero bytes.

JEP 254 changed the representation. `String` now holds a `byte[]` plus a `coder` field
identifying the encoding, and the JEP describes the two supported values: **LATIN1**, one byte
per character, and **UTF16**, two. The choice is made per string, from its contents.

```java
String ascii = "order-1234";          // LATIN1  — 10 bytes of payload
String greek = "παραγγελία-1234";     // UTF16   — 2 bytes per character
```

Sketching the object, ignoring header details that
[08 · The object header](08-the-object-header.md) owns:

```
String {
    byte[] value;    // a reference to the payload array
    byte   coder;    // LATIN1 (0) or UTF16 (1)
    int    hash;     // cached hashCode, computed lazily
    boolean hashIsZero;
}
```

Two things follow from this shape that are worth noticing straight away. First, **a `String` is
two objects**: the `String` itself and the array it points at. Any accounting of "how much does
a string cost" that forgets the second one is wrong by a whole object header. Second, **the hash
is cached**, which is why using strings as map keys is cheaper than it looks after the first
lookup — and why a string whose hash genuinely computes to zero recomputes it every time, which
is what the `hashIsZero` field exists to avoid.

### The consequences are not uniform

- **An all-ASCII heap gets roughly half its string payload back.** For most services this was
  one of the largest single-release footprint improvements the JVM has ever shipped, and it
  arrived without anyone changing a line of code.
- **A heap of genuinely non-Latin-1 text gets nothing** — and pays a small cost. Every
  character access now branches on the coder, and some operations on UTF16 strings have an
  extra step compared to the old always-`char[]` representation. Applications whose strings are
  predominantly CJK or similar can measure a small regression rather than a gain.
- **One non-Latin-1 character makes the whole string UTF16.** It is per-string, not per-run and
  not per-application. A name field where 1% of values contain an accented character stores the
  other 99% compactly and those 1% at double width — which is fine, but means "we're a European
  business so it's all Latin-1" is not quite the claim people think it is.

The behaviour can be turned off with **`-XX:-CompactStrings`**, and the only reason to do so is
the measured regression case above. 🔴 **Do not disable it speculatively** — you are giving up a
large, certain footprint win to avoid a small, uncertain CPU one.

### What this did to `char`, and to APIs

`String` no longer contains `char`s. `charAt(int)` still returns a `char`, so the API is
unchanged, but it now decodes from the byte array according to the coder rather than indexing
a `char[]` directly. `toCharArray()` genuinely materialises a new `char[]` — for a Latin-1
string that is a widening conversion and an allocation, not a copy of an existing array.

That has a practical edge: code that reached for `toCharArray()` as a cheap way to iterate is
now allocating. Iterating with `charAt` in a loop, or with `chars()`/`codePoints()`, avoids the
copy.

The other API worth knowing here is `String.length()`, which returns the number of **UTF-16 code
units**, not characters and not bytes. That was true before Java 9 and is still true; compact
strings did not change it. For a Latin-1 string the length happens to equal the byte count, and
relying on that coincidence is a portability bug waiting for its first emoji.

## Concatenation is a separate mechanism that people attribute to this one

Java 9 also changed how `+` on strings compiles: instead of the compiler emitting
`StringBuilder` calls, it emits an `invokedynamic` that lets the runtime pick and cache a
concatenation strategy at first execution. That is **JEP 280**, not JEP 254, and it is why
"string concatenation got faster in Java 9" and "strings got smaller in Java 9" are two
different facts that happen to have arrived together.

The practical advice survives both:

```java
// Fine — fixed arity, the runtime builds an efficient concatenation
String msg = "order " + id + " for " + customer;

// Wrong shape — each iteration allocates a new String and copies everything so far
String all = "";
for (String line : lines) { all += line; }        // quadratic

// Right
StringBuilder sb = new StringBuilder();
for (String line : lines) { sb.append(line); }
String all2 = sb.toString();
```

**`+` in a loop is still quadratic.** Indified concatenation improved the fixed-arity case; it
did not make repeated concatenation linear, because each `+` still produces a new immutable
string containing everything accumulated so far.

## Reading a heap dump after Java 9

One consequence of the representation change catches people every time they open an analyser:
**strings are `byte[]` now**, so the array class name no longer distinguishes text from genuine
binary data. Before Java 9, a heap dominated by `char[]` was, by definition, a string problem.
Today a heap dominated by `byte[]` might be strings, might be I/O buffers, might be cached
serialised payloads, might be image data.

The histogram cannot tell you which. The **dominator tree** can, because it shows what *retains*
the arrays. [Topic 04 · `OutOfMemoryError`](../04-out-of-memory-error/README.md) owns dump
analysis properly; the point here is only that the question "is my heap full of strings?" got
harder to answer in Java 9 and the old shortcut no longer works.

## Gotchas

**★ Compact strings are per-string, not per-application.** One non-Latin-1 character promotes
that entire string to UTF16. A field that is 99% ASCII still stores those 99% compactly, but a
single string is never half-and-half.

**★ Compact strings can be a small regression for predominantly non-Latin-1 text.** The coder
branch and the UTF16 paths cost a little. This is the only defensible reason for
`-XX:-CompactStrings`, and it needs measuring — you are trading a certain, large footprint win
for an uncertain, small CPU one.

**★ JEP 254 and JEP 280 both landed in Java 9 and get conflated.** Compact strings changed the
*representation*; indified string concatenation changed how `+` *compiles*. "Strings got better
in 9" is two separate changes with two separate mechanisms, and confusing them leads to
attributing a concatenation benchmark to the footprint change or vice versa.

**★ `+` in a loop is still quadratic.** Indified concatenation improved the fixed-arity case; it
did not make repeated concatenation linear. Accumulate with `StringBuilder`.

**★ A heap dominated by `byte[]` is not automatically a string problem.** Since Java 9 strings
*are* `byte[]`, so the array class no longer distinguishes them from genuine binary buffers.
Check what retains the arrays before concluding it is text — the dominator tree, not the
histogram, answers this.

**★ A `String` is two objects, not one.** The `String` and its backing array each carry their
own header. Any per-string cost estimate that counts only the payload bytes understates it,
which matters most for very short strings where the two headers dominate the content.

**★ `toCharArray()` allocates, and after Java 9 it also converts.** For a Latin-1 string it
widens every byte to a `char` into a fresh array. Using it as a "cheap way to iterate" is now
an allocation per call in a loop; `charAt`, `chars()` or `codePoints()` do not copy.

**★ `length()` is UTF-16 code units, not characters and not bytes.** For Latin-1 strings the
number coincides with the byte count, which makes the bug invisible until the first
non-BMP character — an emoji, a rare CJK ideograph — arrives and one "character" counts as two.

**★ Disabling compact strings changes memory *and* changes nothing else you can see.** There is
no API difference and no exception; a service run with `-XX:-CompactStrings` simply uses more
heap. If a flag like that is inherited in a `JAVA_OPTS` line, nothing will ever surface it
except reading the flags — see [09d](09d-verifying-what-the-jvm-chose.md).

## Interview questions

**★ What are compact strings and what did they change?**
Before Java 9, `String` held a `char[]` at two bytes per character regardless of content.
JEP 254 changed the representation to a `byte[]` plus a `coder` field with two values, LATIN1
and UTF16, chosen per string from its contents. Text that is entirely Latin-1 — which is most
text in most applications — now costs one byte per character instead of two. It is enabled by
default and can be disabled with `-XX:-CompactStrings`. The trade-off is a branch on the coder
for character access, so applications whose strings are predominantly non-Latin-1 gain nothing
and can measure a small regression.

**★ How much memory does a short string actually cost?**
More than its characters, because it is two objects. There is the `String` object — a header,
a reference to the array, the coder byte, the cached hash and its flag, all padded to an
alignment boundary — and separately the `byte[]`, which has its own header plus a length field
plus the payload, also padded. For a ten-character ASCII string the two headers and the padding
are comparable to the payload itself. That is why collections of very many very short strings
are so much worse than the character count suggests, and why the fix is usually structural —
sharing, or not materialising them at all — rather than shaving bytes.

**★ Your heap dump's top entry by retained size is `byte[]`. What does that tell you?**
Less than it would have before Java 9, because strings are now backed by `byte[]` too — so the
class name no longer distinguishes text from genuine binary data. The histogram alone cannot
tell you which. The next step is the dominator tree: look at what *retains* those arrays. If it
is `String` instances, you are looking at a text problem and the questions are duplication,
caching and whether the strings are Latin-1 or UTF16. If it is buffers, streams or a cache of
serialised payloads, it is a different investigation entirely.

**★ Why did `String` change from `char[]` to `byte[]` rather than just adding a compression
flag to the existing array?**
Because a `char[]` is two bytes per element by definition — the array type itself is what
carries the cost, so no flag on the `String` could change what the array occupied. Switching to
`byte[]` makes the array's element size one and puts the interpretation in the `coder` field
alongside it. It is a change of container, not a change of annotation, which is also why it was
an implementation change with no API impact: `charAt` still returns a `char`, it just decodes
rather than indexes.

**★ Did Java 9 make string concatenation faster? Explain carefully.**
Java 9 changed how `+` compiles — JEP 280 replaced the compiler's fixed `StringBuilder` sequence
with an `invokedynamic` that lets the runtime choose and cache a strategy, which is generally
faster for the fixed-arity case. That is a *different* change from JEP 254, which changed the
representation and is about memory. Both shipped in 9, which is why they get conflated. And
neither one changed the asymptotics of concatenating in a loop: `+=` in a loop is still
quadratic, because each operation produces a new immutable string containing everything so far.

**★ When would you set `-XX:-CompactStrings`?**
Almost never, and only after measuring. The case for it is an application whose strings are
overwhelmingly non-Latin-1 — CJK text, for example — where the coder branch and the UTF16 paths
cost a little CPU and the footprint saving never materialises because nothing is Latin-1. Even
then it is a small, uncertain CPU gain traded against giving up a mechanism that costs nothing
when it does not apply. What makes it worth knowing about is the reverse situation: finding it
already set in an inherited `JAVA_OPTS`, where it is silently costing heap for no reason and
nothing in the application's behaviour will ever reveal it.

{/* FOOTER */}
