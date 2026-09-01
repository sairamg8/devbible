---
title: "The JDK 25 Troubleshooting Guide documents seven OutOfMemoryError detail messages and only three of them concern the Java heap at all, so the word after the colon is worth more than any tool you could reach for next"
sidebar_label: "02 · The seven messages"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Memory Leaks →
> Understand the OutOfMemoryError Exception"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshooting-memory-leaks.html)),
> the **JDK 25 `java` tool reference** for `-XX:+UseGCOverheadLimit`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)), and the
> **JDK 25 source at tag `jdk-25+36`** — `hotspot/share/oops/arrayOop.hpp` (`max_array_length`),
> `hotspot/share/memory/universe.cpp` (the pre-allocated message strings) and
> `java.base/jdk/internal/util/ArraysSupport.java` (`SOFT_MAX_ARRAY_LENGTH`)
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/oops/arrayOop.hpp)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Seven. Not eight, not nine — the Troubleshooting Guide enumerates exactly seven detail messages
under "Understand the OutOfMemoryError Exception", and any page that lists a different number is
either counting messages that come from elsewhere in the JVM (there are four of those, and
[02d](02d-the-messages-that-are-not-on-the-list.md) covers them) or has quietly invented one. This
chunk is the overview plus the three messages that are about the Java heap and the VM's own
limits; [02b](02b-the-four-native-messages.md) takes the four that are about native memory.**

## The list, and where each region is

| # | Detail message | Region | `-Xmx` helps? | Here |
|---|---|---|---|---|
| 1 | `Java heap space` | Java heap | **yes** | below |
| 2 | `GC overhead limit exceeded` | Java heap, plus a collector spending its life on it | yes, sometimes | below |
| 3 | `Requested array size exceeds VM limit` | none — a hard VM limit on one allocation | no | below |
| 4 | `Metaspace` | native class metadata | no | [02b](02b-the-four-native-messages.md) |
| 5 | `request size bytes for reason. Out of swap space?` | the native heap / the OS | no, it makes it worse | [02b](02b-the-four-native-messages.md) |
| 6 | `Compressed class space` | the bounded klass-pointer region inside metaspace | no | [02b](02b-the-four-native-messages.md) |
| 7 | `reason stack_trace (Native method)` | a native library's own allocation | no | [02b](02b-the-four-native-messages.md) |

Two of seven respond to heap sizing. The remaining five have five different fixes, and applying
the heap fix to any of them ranges from useless to actively harmful. That is the argument for
reading the message before touching anything, and it is repeated in
[02e · The message decides the fix](02e-the-message-decides-the-fix.md).

## 1 · `Java heap space`

> *"The detail message `Java heap space` indicates that an object could not be allocated in the
> Java heap. **This error does not necessarily imply a memory leak.** The problem can be as
> simple as a configuration issue, where the specified heap size (or the default size, if it is
> not specified) is insufficient for the application."*
>
> *"In other cases, and in particular for a long-lived application, the message might indicate
> that the application is unintentionally holding references to objects, which prevents the
> objects from being garbage collected. This is the Java language equivalent of a memory leak."*
>
> *"Note: The APIs that are called by an application could also unintentionally be holding object
> references."*

That last note is doing more work than its size suggests. A very large share of real heap leaks
are not in application code at all: an HTTP client caching responses, a connection pool holding
statement caches, a metrics library retaining tag combinations, an ORM's first-level cache in a
long transaction. The `Note` exists because Oracle's support engineers see it constantly.

The guide then names a cause almost nobody thinks of:

> *"One other potential source of this error arises with applications that make excessive use of
> finalizers. If a class has a `finalize` method, then objects of that type do not have their
> space reclaimed at garbage collection time. Instead, after garbage collection, the objects are
> queued for finalization… If the thread cannot keep up with the finalization queue, then the
> Java heap could fill up."*

That is a real production failure mode with its own diagnostic — see
[07b · Finalizers and cleaners](07b-finalizers-and-cleaners.md).

**Deciding whether it is a leak or a sizing problem** is the whole of
[06 · When it is not a leak](06-when-it-is-not-a-leak.md), and the discriminator is the guide's
own: *"monitor the live set of the application that is, the amount of Java heap space or
Metaspace being used **after a full garbage collection**. If the live set increases over time
after the application has reached a stable state and is under a stable load, that could be a
strong indication of a memory leak."*

### The second `Java heap space` message

HotSpot pre-allocates a seventh string that begins with the same six characters:

```
Java heap space: failed reallocation of scalar replaced objects
```

It is thrown from `deoptimization.cpp` when the JIT had eliminated an object via escape analysis,
the frame then had to be deoptimised, and the allocation needed to *materialise* the object it had
optimised away failed. It is still heap exhaustion, but the frame in the trace is a deoptimisation
path rather than your allocation site. A log search for `Java heap space` matches both.

## 2 · `GC overhead limit exceeded`

> *"The detail message `GC overhead limit exceeded` indicates that the garbage collector (GC) is
> running most of the time, and the Java application is making very slow progress. After a
> garbage collection, if the Java application spends more than approximately 98% of its time
> performing garbage collection and if it is recovering less than 2% of the heap and has been
> doing so for the last five (compile-time constant) consecutive garbage collections, then a
> `java.lang.OutOfMemoryError` error is thrown. This error is typically thrown because the amount
> of live data barely fits into the Java heap leaving little free space for new allocations."*
>
> *"Action: Increase the heap size. The `java.lang.OutOfMemoryError` error for GC Overhead limit
> exceeded can be turned off using the command-line flag `-XX:-UseGCOverheadLimit`."*

⚠️ **The guide's heading capitalises it as `GC Overhead limit exceeded`; the string HotSpot
actually sets is `GC overhead limit exceeded`, lowercase `o`.** If you grep a log for the
capitalised form you find nothing.

🔴 And the message is **only ever produced by Parallel GC**, which is not the default on JDK 25.
That correction has its own chunk, [02c](02c-gc-overhead-limit-is-parallel-only.md), because it
changes what the *absence* of this message means on a G1 or ZGC service — which is most of them.

The three numbers in the rule are flags, and only two of them are settable:

```cpp
product(bool, UseGCOverheadLimit, true,  "...")
product(uint, GCTimeLimit,        98,    "Limit of the proportion of time spent in GC ...")
product(uint, GCHeapFreeLimit,    2,     "Minimum percentage of free space after a full GC ...")
develop(uintx, GCOverheadLimitThreshold, 5, "Number of consecutive collections before gc time limit fires")
```

`GCOverheadLimitThreshold` is a `develop` flag — which is exactly why the guide writes
*"(compile-time constant)"* next to the number five. You cannot tune it in a release build.

## 3 · `Requested array size exceeds VM limit`

> *"The detail message `Requested array size exceeds VM limit` indicates that the application (or
> APIs used by that application) attempted to allocate an array with a size **larger than the VM
> implementation limit, irrespective of how much heap size is available**."*
>
> *"Action: Ensure that your application (or APIs used by that application) allocates an array
> with a size less than the VM implementation limit."*

The guide will not tell you what the limit *is*, because it is not a constant. HotSpot computes
it per element type in `arrayOop.hpp`:

```cpp
// Return the maximum length of an array of BasicType. ...
return align_down(max_jint - hdr_size_in_words, MinObjAlignment);
```

So the true ceiling is `Integer.MAX_VALUE` minus the array header expressed in heap words, rounded
down to the object alignment — a value slightly below `Integer.MAX_VALUE` that **depends on the
header size**, and therefore changes under `-XX:+UseCompactObjectHeaders`
([`../01-memory-layout/08b-compact-object-headers.md`](../01-memory-layout/08b-compact-object-headers.md)).

The JDK's own libraries do not try to compute it. They use a conservative bound:

```java
/**
 * Some JVMs (such as HotSpot) have an implementation limit that will cause
 *     OutOfMemoryError("Requested array size exceeds VM limit")
 * to be thrown if a request is made to allocate an array of some length near
 * Integer.MAX_VALUE, even if there is sufficient heap available. The actual
 * limit might depend on some JVM implementation-specific characteristics such
 * as the object header size. The soft maximum value is chosen conservatively so
 * as to be smaller than any implementation limit that is likely to be encountered.
 */
public static final int SOFT_MAX_ARRAY_LENGTH = Integer.MAX_VALUE - 8;
```

That is the number to design against: **`Integer.MAX_VALUE - 8`**, from
`jdk.internal.util.ArraysSupport`. In practice this message means an unbounded
`ByteArrayOutputStream`, an unbounded `StringBuilder`, a `List` grown from untrusted input, or a
`readAllBytes` on something bigger than 2 GB.

```java
// the shape that produces it
byte[] all = inputStream.readAllBytes();          // no bound at all

// the shape that does not
if (declaredLength > MAX_ACCEPTED_BYTES) {
    throw new PayloadTooLargeException(declaredLength);
}
byte[] all = inputStream.readNBytes(MAX_ACCEPTED_BYTES + 1);
```

## Gotchas

**★ The guide's capitalisation of `GC Overhead limit exceeded` does not match the string HotSpot
emits.** The pre-allocated message in `universe.cpp` is `"GC overhead limit exceeded"`. A
case-sensitive log search or alert rule built from the documentation heading matches nothing.

**★ `Requested array size exceeds VM limit` has nothing to do with free memory.**
It is thrown *irrespective of how much heap size is available* — the guide's words. Raising `-Xmx`
to 64 GB changes nothing. The limit is `Integer.MAX_VALUE` minus the array header in words, rounded
to the object alignment, and it moves if you change the header layout.

**★ There are two distinct messages starting `Java heap space`.**
The plain one, and `Java heap space: failed reallocation of scalar replaced objects` from
deoptimisation. A prefix match in a log query treats them as the same event; they have different
frames and different (though related) causes.

**★ `-XX:-UseGCOverheadLimit` silences a symptom and is occasionally the right thing.**
The guide offers it as an action. It converts an early, diagnosable `OutOfMemoryError` into a
service that thrashes indefinitely and eventually dies of `Java heap space` — or gets OOMKilled
with no Java-side evidence. Use it only when you have decided that a long GC-bound stall is
preferable to a restart, and say so out loud.

**★ The "five consecutive collections" in the rule cannot be changed.**
`GCOverheadLimitThreshold` is a `develop` flag, compiled to a constant in a release build. The
guide says *"(compile-time constant)"* precisely because of that. `GCTimeLimit` (98) and
`GCHeapFreeLimit` (2) *are* `product` flags and can be tuned, which is a much less well-known
option than turning the whole check off.

**★ Nothing in these messages tells you the *rate*.**
Every one of them is a terminal event. A leak that fills the heap in ten minutes and one that
takes ten days produce identical lines. The rate is the most useful discriminator you have, and
you only have it if heap-after-full-GC was being recorded before the incident.

**★ `Java heap space` from a library is still `Java heap space`.**
The guide's own `Note` — *"The APIs that are called by an application could also unintentionally
be holding object references"* — is a reminder that "we don't cache anything" is a statement about
your code, not about your dependencies. The dominator tree settles it;
[04b](04b-shallow-versus-retained.md) explains how to read it.

**★ Only three of the seven can appear on a JVM whose heap graph is rising.**
The other four occur with a heap that looks entirely healthy. If your alerting is heap utilisation
only, you are not watching for four of the seven at all.

## Interview questions

**★ Name the `OutOfMemoryError` detail messages and say which region each one is about.**
The JDK 25 Troubleshooting Guide documents seven. `Java heap space` and `GC overhead limit
exceeded` are the Java heap — the second meaning the collector is running more or less
continuously and reclaiming almost nothing. `Requested array size exceeds VM limit` is a hard VM
limit on a single array allocation and is independent of available memory. `Metaspace` is native
class metadata; `Compressed class space` is the bounded klass-pointer sub-region inside it.
`request size bytes for reason. Out of swap space?` is a failed native allocation inside the JVM,
and it takes the process down through the fatal-error handler with an `hs_err` log rather than an
ordinary throw. `reason stack_trace (Native method)` is a failed allocation in a JNI or native
method — outside the JVM's own accounting altogether. Two more exist in HotSpot's pre-allocated
list and two more come from library code; they are real but not on the guide's list.

**★ A service dies with `Requested array size exceeds VM limit`. Where do you look?**
At the frame that made the allocation, because unusually for an OOM the stack trace *is* the bug.
The message is thrown irrespective of available heap, so nothing about sizing is relevant. The
cause is a single request for an array longer than roughly `Integer.MAX_VALUE` elements — in
practice an unbounded `ByteArrayOutputStream` or `StringBuilder` fed by input whose size nobody
validated, or a `readAllBytes` on a file larger than 2 GB. The fix is a bound on the input, and
the number to design against is `ArraysSupport.SOFT_MAX_ARRAY_LENGTH`, `Integer.MAX_VALUE - 8`.

**★ How do you tell a heap that is too small from a heap that is leaking, from the same
`Java heap space` message?**
By watching the live set rather than utilisation. The guide's rule: measure heap used *after a
full collection*, under stable load, once the application has warmed up. A heap that is merely
too small has a live set that is high but flat — every collection returns it to roughly the same
level, just uncomfortably close to `-Xmx`. A leak has a live set that ratchets upward across
collections and never returns. One observation cannot distinguish them; a GC log across several
hours can, which is the argument for having `-Xlog:gc*` on permanently.

**★ What does `GC overhead limit exceeded` tell you that `Java heap space` does not?**
That the service was already effectively dead before it died. The documented rule is 98 percent of
wall-clock time in GC, recovering less than 2 percent of the heap, for five consecutive
collections — so by the time the error is thrown the application has been unable to make progress
for a measurable period, with every request timing out. It is a *lateness* signal as much as a
memory signal, and the operational lesson is that alerting on GC time as a fraction of wall clock
would have paged you before the error existed. The second thing it tells you, on JDK 25, is that
you are running Parallel GC — see [02c](02c-gc-overhead-limit-is-parallel-only.md).

**★ Why does the guide describe the "five consecutive collections" as a compile-time constant?**
Because `GCOverheadLimitThreshold` is declared `develop` in `gc_globals.hpp`, and `develop` flags
are compiled to constants in a product build rather than being exposed on the command line. The
neighbouring thresholds are not: `GCTimeLimit` (98 percent) and `GCHeapFreeLimit` (2 percent) are
`product` flags and can be adjusted. So the two percentages are tunable and the collection count
is not, which is the opposite of what most people assume from reading the sentence.

{/* FOOTER */}
