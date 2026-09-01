---
title: "Shallow heap is the size of an object and retained heap is the size of the hole it would leave, and the whole of leak analysis is the difference between those two numbers — which is also why retained sizes do not add up and should not"
sidebar_label: "04b · Shallow vs retained"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Eclipse Memory Analyzer documentation** — "Concepts →
> Shallow vs. Retained Heap" and "Concepts → Dominator Tree"
> ([help.eclipse.org](https://help.eclipse.org/latest/topic/org.eclipse.mat.ui.help/concepts/shallowretainedheap.html)).
> Object-layout facts referenced here are established in
> [`../01-memory-layout/08-the-object-header.md`](../01-memory-layout/08-the-object-header.md)
> and [`../01-memory-layout/08d-measuring-an-object.md`](../01-memory-layout/08d-measuring-an-object.md).
> **No sandbox** — no dump was opened and no size figure below is measured; the arithmetic shown
> is arithmetic, not output.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every column in a heap-dump tool is one of these two numbers and confusing them wastes entire
investigations. Shallow heap is what the object itself occupies: header, fields, and for a
reference field the pointer rather than the target. Retained heap is what would be freed if that
object became unreachable. A `HashMap` holding a million entries has a shallow size of a few dozen
bytes and a retained size of most of your heap, and only one of those two numbers is a bug
report.**

## The definitions, verbatim

> *"**Shallow heap** is the memory consumed by one object. An object needs 32 or 64 bits (depending
> on the OS architecture) per reference, 4 bytes per Integer, 8 bytes per Long, etc. Depending on
> the heap dump format the size may be adjusted (e.g. aligned to 8, etc...) to model better the
> real consumption of the VM."*
>
> *"**Retained set** of X is the set of objects which would be removed by GC when X is garbage
> collected."*
>
> *"**Retained heap** of X is the sum of shallow sizes of all objects in the retained set of X, i.e.
> memory kept alive by X."*
>
> *"Generally speaking, shallow heap of an object is its size in the heap and retained size of the
> same object is the amount of heap memory that will be freed when the object is garbage
> collected."*

## Why shallow size is almost never interesting

Consider the shape, not the numbers:

```java
final class Order {
    long id;                      // 8 bytes, in the object
    Customer customer;            // a reference, in the object
    List<OrderLine> lines;        // a reference, in the object
    String reference;             // a reference, in the object
}
```

The shallow size of an `Order` is the header plus one `long` plus three references, rounded up to
the object alignment. It does not change if the order has one line or ten thousand. **Shallow size
is a function of the class declaration, not of the data.**

Which means a histogram sorted by shallow size is really sorted by *instance count* times a
per-class constant. That is why `byte[]`, `char[]`, `String` and `HashMap$Node` are always at the
top: they are the leaves everything else points at. They tell you what your data is made of, which
you already knew.

Retained size is a function of the data, and it is the only number in the tool that answers "how
much would I get back".

## Why retained sizes do not sum, and must not

This is the arithmetic that makes people distrust the tool, and it is correct behaviour.

Take a cache and a session registry that both reference the same `User` objects:

```
  cache ──┐
          ├──> User#1, User#2, ... User#N
sessions ─┘
```

The retained heap of `cache` **does not include** the users, because dropping `cache` would not
free them — `sessions` still reaches them. Nor does `sessions` retain them. So both objects show a
small retained size while together they hold a large population, and the sum of all retained sizes
in the dominator tree is much smaller than the heap.

MAT's answer is the **retained set of a leading set** — the retained size of a *group*:

> *"The retained set for a leading set of objects, such as all objects of a particular class or all
> objects of all classes loaded by a particular class loader or simply a bunch of arbitrary
> objects, is the set of objects that is released if all objects of that leading set become
> unaccessible."*

🔴 **So when no single object dominates, select the group and ask for its retained size.** That is
the operation that finds a leak spread across many small owners, and it is the reason MAT's own
advice for the diffuse case is *"group the result by class and class loader"*.

The same graph structure explains the shared-object case in the other direction: an object
referenced from exactly one place appears in that place's retained set and its retained size is
"real"; an object referenced from two independent places belongs to neither and only appears when
you take both as a leading set.

## Minimum retained size

MAT computes an approximation when the exact number would be too slow:

> *"The **Minimum Retained Size** gives a good (under)estimation of the retained size which is
> calculated ways faster than the exact retained size of a set of objects. It only depends on the
> number of objects in the inspected set, not the number of objects in the heap dump."*

Two things follow. It is an **underestimate**, so a large minimum retained size is a hard lower
bound and is trustworthy as evidence. And its cost scales with the *selection*, not the dump, so
it stays usable on a huge file where the exact calculation would not.

## Reading a dominator tree row

Each row gives you both numbers, and the relationship between them is the diagnosis:

| Shallow | Retained | What it means |
|---|---|---|
| small | small | Ordinary object. Ignore. |
| small | **huge** | 🔴 A container. This is what you are looking for. |
| **huge** | huge, ≈ shallow | One enormous object — a big array or a giant `String`. The allocation site is the bug. |
| small | huge, but only as a group | Diffuse retention. Select the class and take the group's retained set. |

The second row is the normal shape of a leak: a `ConcurrentHashMap`, an `ArrayList`, a
`ThreadLocalMap`, a listener list. Tens of bytes of object, gigabytes of retention.

The third row is a different bug with a different fix — nothing is leaking, one allocation was
enormous. That is the `Requested array size exceeds VM limit` family from
[02](02-the-seven-documented-messages.md), and the stack trace is the evidence rather than the
dump.

## The accumulation point

MAT's leak-suspects analysis is built on a derived quantity that is worth knowing by name:

> *"An **accumulation point** is an object with a big difference between the retained size of itself
> and the largest retained size of a child object. These are places where the memory of many small
> objects is accumulated under one object."*

That is the formal version of "walk down the dominator tree until it fans out". Above the
accumulation point, one child holds nearly everything; at it, the retention splits across many
small children. The accumulation point is the container, and the thing directly above it is
usually the field you have to change. The query that finds it directly is **Big Drops in Dominator
Tree**, and it is what [04c](04c-leak-suspects-and-paths-to-gc-roots.md) is about.

## Gotchas

**★ Sorting a histogram by shallow size ranks classes by instance count, not by importance.**
Shallow size per instance is fixed by the class declaration. The list is always `byte[]`, `char[]`,
`String`, `Object[]`, `HashMap$Node` — the leaves. Nothing about that ordering distinguishes a
leaking heap from a healthy one.

**★ Retained sizes do not add up to the heap size, and that is correct.**
An object reachable from two independent owners is in neither owner's retained set, because
dropping either one alone frees nothing. The sum of retained sizes is therefore an undercount by
construction. Treating the shortfall as a tool bug is the standard first reaction.

**★ The fix for "nothing has a big retained size" is a leading set, not a bigger dump.**
Select all instances of the suspicious class — or everything loaded by one class loader — and ask
for the retained set of the group. Retention shared between many small owners only becomes visible
that way.

**★ Minimum Retained Size is an underestimate and the UI does not shout about it.**
It is deliberately approximate and deliberately cheap. As evidence it is a lower bound, which is
usually enough to make a case; as a number to quote in a report it should be labelled as such.

**★ A huge shallow size is a different bug from a huge retained size.**
One giant array is an allocation-site problem — read the stack trace, bound the input. A small
object with a huge retained set is a lifetime problem — find who holds it. Applying the leak
methodology to the first wastes an afternoon on a dominator tree with one node in it.

**★ Shallow size depends on the object layout, which is not fixed across configurations.**
Header size, compressed oops, alignment and `-XX:+UseCompactObjectHeaders` all change it. Two dumps
from JVMs launched with different flags are not directly comparable at the byte level. Topic 01
owns the layout —
[`../01-memory-layout/09-compressed-oops.md`](../01-memory-layout/09-compressed-oops.md).

**★ Retained size is a property of the graph at one instant, not a trend.**
A single dump cannot tell you whether that gigabyte was always there. Two dumps can, which is why
comparison mode and the before/after-full-GC dump pair from
[03b](03b-which-failures-actually-trigger-them.md) exist.

**★ Soft, weak and phantom references distort retained size in the direction of understatement.**
An object held only by a `SoftReference` is reachable, so it counts toward somebody's retained set
— but the collector would drop it under pressure, so the memory is not really "kept alive" in the
sense you care about. MAT's path queries exclude those reference types by default for the same
reason; the retained-size calculation does not.

## Interview questions

**★ Explain shallow heap versus retained heap.**
Shallow heap is the memory one object occupies by itself: its header, its primitive fields, and one
pointer per reference field — so it is a function of the class declaration and identical for every
instance of a class. Retained heap is the sum of the shallow sizes of the retained set, which MAT
defines as *"the set of objects which would be removed by GC when X is garbage collected"* — so it
is a function of the data and answers "how much memory comes back if this dies". Leak analysis is
entirely about the second number; the first is only useful when a single object is itself enormous.

**★ Why do the retained sizes in a dominator tree not add up to the heap size?**
Because an object reachable from two independent owners belongs to neither owner's retained set:
dropping either one alone would not free it, and the retained set is defined by what GC would
actually remove. Shared structure therefore appears in nobody's retained size, and the total falls
short of the heap. The correct way to measure it is a retained set over a *leading set* — all
instances of a class, or everything a class loader owns — which MAT supports directly and which is
the standard move when no single object dominates.

**★ You find an object with a small shallow size and a retained size of 4 GB. What is it likely to
be, and what do you do next?** A container — a map, a list, a queue, a `ThreadLocalMap`, a listener
registry. That is the classic leak signature: tens of bytes of object holding gigabytes of
lifetime. Next, walk down the dominator tree to the accumulation point, which MAT defines as the
node with a large gap between its own retained size and its largest child's, because that is where
many small objects are being collected under one owner. Then run Paths to GC Roots on it to get the
reference chain, and the field or registration in that chain is what has to change.

**★ When is a large shallow size the interesting number?**
When a single object is itself the problem: a multi-gigabyte `byte[]` from an unbounded
`ByteArrayOutputStream`, a `char[]` behind a `String` built in a loop, an oversized array from a
declared length nobody validated. In that case shallow and retained are nearly equal, there is no
container to find and no lifetime question to answer — the bug is at the allocation site, and the
stack trace from the `OutOfMemoryError` is more useful than the dump. It is also the shape behind
`Requested array size exceeds VM limit`.

**★ What is an accumulation point and why does MAT compute it?**
It is *"an object with a big difference between the retained size of itself and the largest
retained size of a child object"* — the node in the dominator tree where retention stops being
concentrated in one child and fans out across many. Above it, you are walking down a chain of
single owners; at it, you have found the container that is aggregating everything. MAT computes it
because that node, and the "interesting" application object immediately above it, are what a human
would search for by hand: the fan-out point is the container, and its owner is the code that has to
change.

{/* FOOTER */}
