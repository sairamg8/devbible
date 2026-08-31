---
title: "Every platform thread gets its own fixed-size native stack that is reserved outside the Java heap, which is why -Xmx has nothing to say about the region that actually killed your container"
sidebar_label: "06 · Thread stacks"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JVMS SE 25 §2.5.2 (Java Virtual Machine Stacks)** and
> **§2.6 (Frames)**
> ([docs.oracle.com](https://docs.oracle.com/javase/specs/jvms/se25/html/jvms-2.html)); the
> **JDK 25 `java` tool reference** entries for `-Xss` and `-XX:ThreadStackSize`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> the **JDK 25 `Thread.Builder.OfPlatform`** javadoc
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.Builder.OfPlatform.html));
> and the OpenJDK `jdk-25+36` source `src/hotspot/share/runtime/globals.hpp`
> (`ThreadStackSize`, `VMThreadStackSize`, `CompilerThreadStackSize`).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A Java heap is one allocation the JVM makes; a thread stack is one allocation *per thread*,
made by the operating system, sized by `-Xss`, and completely invisible to `-Xmx`. That makes
thread stacks the second-largest term in most server processes' memory bill and the one
almost nobody has on their whiteboard. This chunk is about what is in a stack, what `-Xss`
actually buys you, and why "reserved" and "committed" are two different numbers that lead to
two different wrong conclusions.**

## What a stack is, in the specification's own words

The JVM specification is unusually direct here:

> *"Each Java Virtual Machine thread has a private Java Virtual Machine stack, created at
> the same time as the thread. A Java Virtual Machine stack stores frames. A Java Virtual
> Machine stack is analogous to the stack of a conventional language such as C: it holds
> local variables and partial results, and plays a part in method invocation and return."*

Two phrases in there carry the whole chunk: **private** and **created at the same time as the
thread**. A stack is not shared, is not garbage collected, and is not allocated lazily on the
first deep call — it comes into existence when the thread does and dies when the thread does.
Nothing in HotSpot ever shrinks a live platform thread's stack.

A frame is the unit inside it:

> *"A frame is used to store data and partial results, as well as to perform dynamic
> linking, return values for methods, and dispatch exceptions. A new frame is created each
> time a method is invoked. A frame is destroyed when its method invocation completes …
> Each frame has its own array of local variables, its own operand stack, and a reference to
> the run-time constant pool of the class of the current method."*

And the sizing rule that makes frames cheap and predictable:

> *"The sizes of the local variable array and the operand stack are determined at
> compile-time and are supplied along with the code for the method associated with the
> frame."*

So a frame's size is a property of the *method*, fixed by `javac` in the `Code` attribute's
`max_locals` and `max_stack`, not of the data flowing through it. A method with forty locals
has a fat frame on every single call, including the calls where thirty-nine of them are never
assigned. The compiler, not the workload, decides how deeply you can recurse.

Note also what the spec permits but HotSpot does not do:

> *"This specification permits Java Virtual Machine stacks either to be of a fixed size or to
> dynamically expand and contract as required by the computation."*

For platform threads HotSpot chooses **fixed size**. That single implementation decision is
why `-Xss` is a per-thread capacity plan rather than a global limit — see
[06d · The thread-count arithmetic](06d-the-thread-count-arithmetic.md). It is also exactly
the decision virtual threads reverse, which is
[06b · Virtual thread stacks](06b-virtual-thread-stacks.md).

## `-Xss`, and the default is not 1 MB everywhere

Here is the JDK 25 `java` man page, verbatim, because the "the default is 1 MB" folklore is
half wrong on modern hardware:

> *"Sets the thread stack size (in bytes). Append the letter `k` or `K` to indicate KB, `m` or
> `M` to indicate MB, or `g` or `G` to indicate GB. The actual size may be rounded up to a
> multiple of the system page size as required by the operating system. **The default value
> depends on the platform.** For example:*
>
> - *Linux/x64: 1024 KB*
> - *Linux/Aarch64: 2048 KB*
> - *macOS/x64: 1024 KB*
> - *macOS/Aarch64: 2048 KB*
> - *Windows: The default value depends on virtual memory*

**Read the AArch64 rows twice.** Moving the same service from an x64 node to a Graviton or
Ampere node **doubles** the default per-thread stack reservation, with no configuration change
and no line in your own application's release notes. A 400-thread process goes from roughly
400 MB of reserved stack to roughly 800 MB, and if that process lives in a container with a
fixed limit, the migration presents as "the ARM build leaks memory". It does not; the platform
default changed underneath you.

Note the other sentence: *"The actual size may be rounded up to a multiple of the system page
size."* `-Xss` is a request that gets rounded, which is one more reason not to assert on it.

`-XX:ThreadStackSize` is the same knob with different units, and the units are a trap:

> *"Sets the Java thread stack size (in kilobytes). Use of a scaling suffix, such as `k`,
> results in the scaling of the kilobytes value so that `-XX:ThreadStackSize=1k` sets the Java
> thread stack size to 1024\*1024 bytes or 1 megabyte."*

So `-Xss1024k` and `-XX:ThreadStackSize=1024` mean the same thing, and
`-XX:ThreadStackSize=1k` *also* means the same thing — a bare number is kilobytes, and a `k`
suffix multiplies kilobytes by 1024. Prefer `-Xss` with an explicit suffix and never mix the
two forms in one argument list.

In the HotSpot sources the flag is declared platform-dependent, which is why the man page has
to enumerate platforms rather than state a number:

```cpp
product_pd(intx, ThreadStackSize,
        "Thread Stack Size (in Kbytes)")
        range(0, 1 * M)
```

`product_pd` is HotSpot's marker for "product flag, platform-dependent default". Any blog that
states a single universal default for a `product_pd` flag is guessing.

## Reserved is not committed, and this is where people mis-read `top`

When the JVM creates a platform thread, the OS **reserves** `-Xss` bytes of *address space*
for its stack. Physical pages are **committed** only as the stack is actually touched — the
kernel faults a page in when the stack pointer first reaches it. A thread that never goes more
than a few frames deep costs a few pages of RSS, not a megabyte.

That gives three different, all-correct numbers for the same thread:

| Number | What it means | Where you see it |
|---|---|---|
| **Reserved** | Address space set aside; the ceiling on stack depth | `threads × -Xss` |
| **Committed** | Pages actually faulted in and backed by RAM | NMT's `committed` for the `Thread` category |
| **RSS contribution** | Committed pages currently resident | the OS and the cgroup's accounting |

The practical consequences run in opposite directions:

- **Raising `-Xss` is nearly free in RSS and expensive in address space.** On 64-bit it is
  almost always safe; on a 32-bit JVM it is precisely how you run out of address space well
  before you run out of RAM.
- **Lowering `-Xss` does not reclaim RSS you were never using.** If your threads are shallow,
  cutting `-Xss` from 1 MB to 512 KB changes the reserved column and leaves RSS alone. People
  do this, see no improvement, and conclude that thread stacks "do not count". They count; the
  measurement was on the wrong column.

Native Memory Tracking is the only tool that separates those columns for you, and
[11 · Native memory tracking](11-native-memory-tracking.md) owns it.

## One OS stack carries two kinds of frame

The specification models Java frames and native frames as two different stacks. §2.5.6:

> *"An implementation of the Java Virtual Machine may use conventional stacks, colloquially
> called "C stacks," to support `native` methods … If supplied, native method stacks are
> typically allocated per thread when each thread is created."*

HotSpot on the mainstream platforms does not give a thread two separate memory regions for
this. One OS thread stack holds interpreted Java frames, JIT-compiled Java frames, VM-internal
C++ frames and JNI frames, interleaved in call order. That is why `-Xss` is a budget shared by
your recursion and by any native library you call through, and why the spec attaches the same
two exceptional conditions to native method stacks as to Java ones:

> *"If the computation in a thread requires a larger native method stack than is permitted, the
> Java Virtual Machine throws a `StackOverflowError`."*

Two consequences worth carrying:

- A `StackOverflowError` can be produced by a *native* call chain you did not write — a JDBC
  driver with a JNI component, an image codec, a crypto provider — consuming your `-Xss`.
- A JIT-compiled frame is generally smaller than the interpreted frame for the same method,
  because the compiler can keep values in registers instead of materialising the full
  `max_locals` array. The same recursion can therefore go measurably deeper after warm-up than
  it does on the first few thousand calls. Never encode a maximum recursion depth in a test.

## What is on the stack, and what only looks like it is

§2.6.1 is precise about what a local variable slot can hold:

> *"A single local variable can hold a value of type `int`, `float`, `reference`, or
> `returnAddress`. A pair of local variables can hold a value of type `long` or `double`."*

`reference` is the operative word. `new Order(...)` in a method body puts an *object* on the
heap and a *reference* in a stack slot. The frame is four or eight bytes wider; the object's
bytes are `-Xmx`'s problem, not `-Xss`'s. This is the single most common confusion about the
two regions, and it survives into senior interviews.

The exception is real but narrower than folklore suggests: HotSpot's escape analysis can prove
that an object never escapes its allocating method and then **scalar-replace** it, keeping its
fields in registers or stack slots and never allocating the object at all. That is an
optimisation, not a language rule — it happens only in C2-compiled code, only when the analysis
succeeds, and it can be undone by a deoptimisation. You cannot rely on it, and you cannot see
it without `-XX:+PrintEliminateAllocations` on a debug build. The correct mental model remains:
objects on the heap, references on the stack.

## Gotchas

**★ A `StackOverflowError` can come from native frames you never wrote.**
HotSpot puts interpreted, compiled, VM-internal and JNI frames on the same OS stack, and the
JVMS attaches `StackOverflowError` to native method stacks too. A crypto provider, a JDBC
driver's native part or an image codec called from deep in your own call chain is spending
your `-Xss`. Cutting `-Xss` aggressively on a service that goes through JNI is how you find
this out the hard way.

**★ The depth a recursion reaches changes after warm-up.**
A JIT-compiled frame is usually smaller than the interpreted frame for the same method. The
same code can therefore recurse deeper once C2 has compiled it, and a test that asserts on a
maximum depth will pass on a cold JVM and fail on a warm one, or vice versa.

**★ "Objects live on the stack when they do not escape" is an optimisation, not a rule.**
Escape analysis plus scalar replacement can eliminate an allocation in C2-compiled code, but
it is not guaranteed, not visible in the source, and undone by deoptimisation. Reason about
memory as though every `new` allocates on the heap, because in the interpreter and in C1 it
does.

**★ The default `-Xss` on Linux/AArch64 is 2048 KB, double the Linux/x64 default.**
The man page says so explicitly. A lift-and-shift from x64 to Graviton or Ampere silently
doubles the reserved stack footprint of every thread in the process. If a container that was
comfortable at 512 MB starts getting OOMKilled after an architecture migration and the heap
graph is flat, this is the first thing to check.

**★ `-Xmx` does not bound thread stacks, and neither does anything else.**
There is no `-XX:MaxThreadStackTotal`. The only bound on the total is `thread count × -Xss`,
and the thread count is set by your web container, your connection pools and your executors —
i.e. by application configuration, not by a JVM flag. That is why a thread leak surfaces as a
container kill rather than as `OutOfMemoryError: Java heap space`.

**★ Lowering `-Xss` frequently changes nothing measurable, and that is not evidence that
stacks are free.** Reserved address space shrinks; committed pages do not, because they were
never committed. Comparing the effect requires NMT's committed figure before and after — not
RSS, and certainly not `-Xss × threads`.

**★ `-XX:ThreadStackSize=1k` is one megabyte, not one kilobyte.**
The flag's unit is kilobytes and the `k` suffix multiplies by 1024 on top of that. A bare
`-XX:ThreadStackSize=512` is 512 KB. Mixing the two conventions in the same argument list is a
good way to ship a JVM with a stack size a thousand times off what you intended.

**★ `-Xss` is rounded up to a page-size multiple.**
*"The actual size may be rounded up to a multiple of the system page size as required by the
operating system."* On a system configured with large pages this rounding is not a rounding
error — it can be a substantial fraction of a small `-Xss`, and it applies once per thread.

**★ Frame size is decided by `javac`, not by your data.**
`max_locals` and `max_stack` are compile-time constants in the method's `Code` attribute.
Adding locals to a hot recursive method — even ones that are usually unused, even ones the JIT
will eventually eliminate — makes every interpreted frame bigger and lowers the maximum
recursion depth for the whole application.

**★ Where does a thread stack live, and does `-Xmx` bound it?**
Outside the Java heap, in native memory allocated by the operating system when the thread is
created — and no. `-Xmx` bounds the Java heap only. The total stack footprint is the thread
count multiplied by `-Xss`, plus the JVM's own internal threads at their own flag defaults, and
nothing in the JVM caps it. That is why a service with a thread leak gets OOMKilled by the
container rather than throwing `OutOfMemoryError: Java heap space` — the growth is in a region
the heap flags never saw.

**★ What is actually in a stack frame?**
Per JVMS §2.6, each frame has its own array of local variables, its own operand stack, and a
reference to the run-time constant pool of the current method's class; implementations may add
more, such as debugging information. Crucially the sizes of the local variable array and the
operand stack are fixed at compile time and stored in the method's `Code` attribute, so a
frame's size is a property of the method rather than of the values flowing through it. That is
why frames can be allocated in one step on invocation and why recursion depth is predictable
for a given method on a given JVM.

**★ What is the difference between reserved and committed for a thread stack, and which one
shows up in RSS?**
Reserved is address space the OS has set aside — `-Xss` per thread — and it costs no physical
memory. Committed is the subset of those pages that have actually been faulted in because the
stack really grew that deep, and only committed pages contribute to RSS. A thousand shallow
threads reserve a gigabyte and commit a small fraction of it. Two practical implications:
lowering `-Xss` on a shallow-stacked service will not reduce RSS, and measuring the effect
requires NMT's committed column rather than the reserved arithmetic.

**★ The JVM specification allows stacks to grow and shrink dynamically. Does HotSpot do that?**
For platform threads, no — HotSpot allocates a fixed-size stack when the thread is created and
never resizes it, which is why `-Xss` behaves as a per-thread reservation. For virtual threads
the answer is different: their stacks live on the Java heap as stack chunk objects and do grow
and shrink as the application runs. That divergence is the entire reason virtual threads change
the memory arithmetic, and it is covered in the next chunk.

**★ A colleague says local variables are "on the stack, so they do not cost heap". Where are
they wrong?**
Only partly wrong, and the distinction matters. A local variable *slot* is on the stack and can
hold an `int`, `float`, `reference` or `returnAddress`, with `long` and `double` taking a pair
of slots — that is JVMS §2.6.1 verbatim. But a local of a reference type holds only the
reference; the object it points at is on the heap and is bounded by `-Xmx`, not by `-Xss`.
Holding a million-element list in a local variable costs one stack slot and megabytes of heap.
The one nuance in the other direction is escape analysis with scalar replacement, which can
eliminate a non-escaping allocation in C2-compiled code — but that is an optimisation you
cannot depend on, not a rule you can reason from.

**★ Can a `StackOverflowError` be thrown by code that is not recursing?**
Yes. All the frames on a Java thread's stack share one OS stack in HotSpot: interpreted frames,
JIT-compiled frames, VM-internal C++ frames and JNI frames. A deep-but-bounded framework call
chain that finally enters a native library near the bottom of the stack can exhaust what is
left, and the JVMS explicitly associates `StackOverflowError` with native method stacks as well
as Java ones. Aggressively lowering `-Xss` on a service with JNI dependencies is a common way
to produce overflows in code with no recursion in it at all.

{/* FOOTER */}
