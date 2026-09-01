---
title: "The string pool holds literals and nothing else, `intern()` is a native call that costs more than people expect, and the fact that `==` on strings sometimes works is precisely what makes it one of the most durable bugs in Java"
sidebar_label: "10b · The pool and interning"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **`java.lang.String` javadoc for JDK 25** (`intern()`), the
> **Java Language Specification** on constant expressions and string literal interning, and the
> **JDK 25 `java` tool reference**
> ([docs.oracle.com/en/java/javase/25/docs/specs/man/java.html](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.0.
> ⚠️ Default values for `StringTableSize` are reported inconsistently across secondary sources;
> **read them off your own JDK with `-XX:+PrintFlagsFinal`** rather than trusting any figure,
> including one on this page.
> **No sandbox** — Java source, quoted documentation and arithmetic only. No captured output.

**[10](10-strings.md) was about how a string is *stored*. This chunk is about the JVM's oldest
mechanism for not storing the same one twice — the string pool — and about `String.intern()`,
the API that lets you use it deliberately and that you should almost always decline. The third
mechanism, deduplication, works at a completely different level and is in
[10c · String deduplication](10c-string-deduplication.md).**

🔴 **Keep the levels straight from the start: interning collapses `String` *objects*, so `==`
becomes true. Deduplication collapses the `byte[]` *arrays* behind them and leaves the objects
distinct, so `==` stays false. They are not alternatives and they do not substitute for each
other.**

## The string pool: what is actually in it

The **string pool** — the *string table* in HotSpot's own terminology — is a JVM-internal hash
table mapping string contents to a single canonical `String` instance.

Two things go into it, and only two:

1. **String literals in your source**, automatically, at class load.
2. **Anything you pass through `String.intern()`**, explicitly.

Everything else — strings built at runtime from input, from `StringBuilder`, from
`new String(...)`, from JSON parsing, from a JDBC `ResultSet` — is an ordinary heap object and
is *not* in the pool.

```java
String a = "order";                     // literal — pooled
String b = "order";                     // same pooled instance
String c = new String("order");         // NEW object on the heap, NOT the pooled one
String d = c.intern();                  // looks up the pool, returns the pooled instance

a == b;          // true  — same pooled instance
a == c;          // false — c is a distinct object
a == d;          // true  — intern() returned the canonical one
a.equals(c);     // true  — contents are equal, which is the only thing you should test
```

🔴 **This is the whole reason `==` on strings is a bug.** It sometimes works — for literals,
because they are pooled — which is exactly what makes it dangerous. The moment a value arrives
from a network, a file or a database, the pooled instance is not what you have, and a
comparison that passed every test fails in production.

There is a subtlety worth knowing because it explains a class of confusing behaviour:
**compile-time constant expressions are folded and pooled too.**

```java
String x = "order" + "-1234";                 // folded at compile time — pooled
final String prefix = "order";
String y = prefix + "-1234";                  // prefix is a constant variable — also folded

String suffix = "-1234";                      // not final
String z = "order" + suffix;                  // computed at run time — NOT pooled
x == z;                                       // false
```

So `==` can succeed or fail depending on whether a variable happened to be `final`. That is not
a rule worth memorising to exploit — it is a rule worth knowing so that you never trust `==`
even when it appears to work.

### Where the pool lives, and why that changed

The pool has moved twice, and both moves matter for reading old advice:

| Era | Where interned strings live | Consequence |
|---|---|---|
| Java 6 and earlier | PermGen | `intern()` could exhaust PermGen; a fixed, small budget |
| Java 7 onwards | The **Java heap** | Interned strings are collectable and share the heap budget |
| Java 8 onwards | Heap (PermGen removed entirely) | `-XX:MaxPermSize` no longer exists |

So advice from the Java 6 era — "never intern, you will blow PermGen" — describes a JVM that no
longer exists. The modern objection to `intern()` is different, and it is about cost rather than
about a separate region. [04 · Metaspace](04-metaspace.md) covers what *did* move to metaspace,
which is class metadata, not strings.

The table itself is sized by `-XX:StringTableSize`, and HotSpot can report statistics about it:

```bash
java -XX:+PrintFlagsFinal -version | grep -i StringTable
java -XX:+PrintStringTableStatistics -version
```

⚠️ **Read the default off your own JDK.** Secondary sources disagree about the current value and
it has changed across releases; `PrintFlagsFinal` is authoritative for the JVM in front of you
and takes two seconds. This is the same discipline as
[09d · Verifying what the JVM chose](09d-verifying-what-the-jvm-chose.md).

Sizing the table matters for the same reason sizing any hash table matters: a table too small
for the number of interned strings degrades lookups toward a linear scan of a bucket, and
`intern()` is on the caller's thread. If you are interning heavily *and* the table is
undersized, you get the worst of both.

## `String.intern()`: why the obvious idea is usually wrong

The reasoning that leads people to `intern()` is sound in outline: "we parse a million records,
the `status` field only ever holds six distinct values, so we are holding a million copies of
six strings — let's collapse them." The premise is correct. The remedy is usually not.

`intern()` is a **native call into the JVM's string table**. It is not free, and its cost is
paid on every call — including the overwhelming majority of calls that find an existing entry.
Interning inside a hot parsing loop routinely costs more in CPU than it saves in memory, and
the saving is invisible until the next GC while the cost is immediate.

There are also two structural problems:

- **You are putting application data into a JVM-internal structure** whose sizing you do not
  control well and whose contents you cannot enumerate or evict selectively.
- **The pool is shared across the whole JVM.** A library interning aggressively affects
  everyone, and nothing attributes the growth back to it.

The alternative is almost always better, and it is ordinary Java:

```java
// Instead of value.intern() in a parsing loop:
private final Map<String, String> canonical = new ConcurrentHashMap<>();

String canonicalise(String s) {
    return canonical.computeIfAbsent(s, Function.identity());
}
```

This gives you the same collapsing with **a structure you own**: you can bound it, measure it,
clear it, scope it to one parse rather than to the process, and see it in a heap dump as your
own class rather than as an opaque JVM table. For a fixed small set of values — statuses,
currencies, country codes, enum-like fields — an actual `enum` or a preloaded `Map` is better
still, because it also gives you type safety and rejects unexpected values.

⚠️ **A canonicalising map is itself a leak if it is unbounded and the key space is not.**
`computeIfAbsent` on a map keyed by user input, held for the life of the process, is precisely
the unbounded-cache failure mode that [topic 04](../04-out-of-memory-error/README.md) covers.
Scope it to the parse, or bound it, or use a proper cache with eviction.

🔴 **The rule of thumb: if the set of distinct values is small and known, use an enum or a map
you own. If it is large and unknown, interning will not save you either.** The narrow case where
`intern()` genuinely wins — a very large number of duplicates, drawn from an unbounded set,
where the strings live a long time and the canonicalising cost is amortised over many reads — is
real but rare, and it should be reached by measurement rather than by reasoning.

## Gotchas

**★ `==` on strings sometimes works, which is what makes it a bug.** Literals are pooled, so
`"a" == "a"` is true and a test suite full of literals passes. A value from a socket, file or
database is a different object and the comparison fails. Always `equals`, or `Objects.equals`
for nullable references.

**★ `final` can change whether `==` succeeds.** A concatenation of compile-time constants is
folded and pooled; the same expression with a non-`final` variable is computed at run time and
is not. So making a variable `final` can flip an `==` comparison from false to true, which is a
spectacular way to hide a bug during a refactor.

**★ `new String("literal")` deliberately creates a second object.** It is the one construct
guaranteed *not* to give you the pooled instance. It exists for the rare case where identity
matters, and in application code it is almost always an accident — often a leftover from
defensive copying that strings do not need, being immutable.

**★ `intern()` in a hot loop can cost more than it saves.** It is a native call paid on every
invocation, including the ones that find an existing entry. The memory saving is deferred to the
next GC; the CPU cost is immediate and per-call. Benchmark it or use a `ConcurrentHashMap` you
control.

**★ Interning puts your data in a structure you cannot manage.** You cannot bound the string
table per-component, evict selectively, or see it clearly in a heap dump as *your* cache. A
`Map` you own gives you all three — and shows up in the dump with your class name on it.

**★ A canonicalising map is itself a leak if it is unbounded.** Replacing `intern()` with a
process-lifetime `ConcurrentHashMap` keyed on user input trades a JVM-table problem for a
classic unbounded-cache problem. Scope it to the operation, bound it, or give it eviction.

**★ An undersized string table makes `intern()` worse, not just the pool.** Lookups degrade
within a bucket and that cost lands on the calling thread. Heavy interning plus a small
`StringTableSize` is the combination that turns a questionable idea into a measurable one.

**★ Interned strings have been on the heap since Java 7.** Advice about `intern()` exhausting
PermGen describes a JVM that has not existed since Java 8. The modern objection is CPU cost and
loss of control, not a separate memory region.

**★ Do not trust a published `StringTableSize` default, including this page’s.** It has changed
across releases and sources disagree. `-XX:+PrintFlagsFinal | grep StringTable` on the JDK you
actually run is the only authority.

**★ A library can intern on your behalf.** The pool is process-wide, so a dependency that
interns aggressively grows a structure that nothing attributes back to it. If the string table
is large and your code never calls `intern()`, look at what you depend on before concluding the
numbers are wrong.

**★ Switch statements on strings do not need interning.** `switch` on a `String` compiles to a
hash-based dispatch followed by `equals`, not to reference comparison. Interning the subject to
"make the switch faster" is a misunderstanding that adds a native call for no benefit.

## Interview questions

**★ What is the string pool, what goes into it, and where does it live?**
It is a JVM-internal hash table holding one canonical `String` instance per distinct set of
contents. Exactly two things go in: string literals, automatically at class load, and anything
you pass to `String.intern()`. Strings built at runtime — from parsing, from `StringBuilder`,
from a `ResultSet` — are ordinary heap objects and are not pooled. It lived in PermGen through
Java 6; since Java 7 interned strings live on the Java heap, and since Java 8 PermGen does not
exist at all. That history matters because a lot of surviving advice about `intern()` is really
advice about PermGen exhaustion, which is no longer the failure mode.

**★ Why is `==` on strings a bug if it sometimes returns true?**
Because the cases where it works are exactly the cases you write in tests. Literals are pooled,
so two occurrences of `"PENDING"` in source are the same object and `==` is true. The moment the
value comes from a socket, a file, a database or a JSON parser, it is a distinct object with
equal contents and `==` is false. So the bug passes every test and fails on real input. It gets
worse: compile-time constant folding means whether a variable is `final` can decide the answer,
so a refactor that adds or removes `final` can silently change behaviour. The correct comparison
is `equals`, or `Objects.equals` when either side may be null.

**★ Explain what `new String("hello")` does and why anyone would write it.**
It creates a second `String` object on the heap whose contents equal the pooled literal but
which is a distinct object, so `new String("hello") == "hello"` is false while `.equals` is
true. It is the one construct guaranteed to defeat pooling. The legitimate uses are vanishingly
rare — historically, forcing a copy so that a substring did not retain a huge backing array,
which stopped being a concern when substring's implementation changed, or deliberately creating
a unique object to use as a lock or sentinel, which is better done with `new Object()`. In
application code today it is almost always accidental, often written by someone applying
defensive-copy habits to a type that is already immutable.

**★ A colleague proposes calling `intern()` on every parsed field to save memory. What do you
say?**
That the premise is probably right and the remedy probably wrong. If the field has few distinct
values across many records, there is real duplication to collapse. But `intern()` is a native
call paid on every invocation, including the vast majority that find an existing entry, so in a
hot parsing loop the CPU cost is immediate and per-record while the memory saving only appears
at the next GC. It also puts application data into a JVM-internal table you cannot bound, evict,
or inspect as your own. A `ConcurrentHashMap` used with `computeIfAbsent` gives the same
collapsing in a structure you own and can measure — bounded, and scoped to the parse rather than
to the process. If the value set is small and known, an `enum` or a preloaded map is better
still. And if no code change is acceptable, `-XX:+UseStringDeduplication`
([10c](10c-string-deduplication.md)) gets much of the benefit for free.

**★ You replace `intern()` with a `ConcurrentHashMap` and the service now leaks. What happened?**
The map is unbounded and its key space is not. `intern()` at least put the strings somewhere the
GC could reclaim; a `ConcurrentHashMap` held in a field for the life of the process holds every
distinct value it has ever seen, forever, and `computeIfAbsent` guarantees an entry per distinct
input. If the values really were a small closed set — six statuses — this cannot happen. If they
are anything derived from user input, it will. The fix is to scope the map to the operation, to
bound it with an eviction policy, or to reject the canonicalisation idea entirely, because a set
of values large enough to leak is a set too large for canonicalisation to have been saving much.

**★ How would you tell whether a production JVM has a string-table problem at all?**
Start with `-XX:+PrintFlagsFinal | grep StringTable` to see the configured size on the JDK
actually running, and `-XX:+PrintStringTableStatistics` for what is in it. Then ask who is
putting things there: if your code never calls `intern()`, the entries are literals — which are
bounded by your class count — or a dependency is interning. A large table with no `intern()`
call in your own source is a dependency question. And a heap dump is the arbiter for the wider
question of whether strings are the problem at all, since after Java 9 the histogram alone
cannot distinguish string payloads from any other `byte[]`.

{/* FOOTER */}
