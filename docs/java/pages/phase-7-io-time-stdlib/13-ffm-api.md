---
title: "Foreign Function & Memory API"
sidebar_label: "13 · Foreign Function & Memory API"
sidebar_position: 13
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for the
> `java.lang.foreign` package (`Arena`, `MemorySegment`, `Linker`,
> `FunctionDescriptor`, `SymbolLookup`, `ValueLayout`, `MemoryLayout`),
> JEP 454 (FFM API final in JDK 22), and JEP 472 (JDK 24: unified
> native-access warnings for JNI and FFM, `--illegal-native-access`
> defaulting to `warn`).

**The Foreign Function & Memory API (`java.lang.foreign`, final in JDK 22
via JEP 454) is how modern Java calls native libraries and manages native
memory — replacing both JNI and `sun.misc.Unsafe` with pure-Java code that
is bounds-checked and lifetime-checked by default. You will not use it in a
typical service; you will meet it inside the libraries that do (Lucene,
Netty, Arrow, tokenizer and ML bindings), and it is now the *only*
sanctioned answer when a C library has no Java equivalent.**

## What was wrong with JNI

Calling one C function through JNI meant: declare a `native` method,
generate a header, **write and compile C glue code** for every platform you
ship, load the library, and hope — because JNI checks nothing. Wrong
argument marshalling, a dangling pointer, an out-of-bounds write: all
undefined behavior that kills the JVM with a hex dump instead of an
exception. FFM inverts every one of those properties: no glue code (the
binding is Java), no headers, one artifact for all platforms carrying the
same Java, and safety checks that turn memory misuse into exceptions.

## The cast of types

| Type | Role |
|---|---|
| `MemorySegment` | a region of (usually native) memory — bounds-checked access |
| `Arena` | allocates segments and owns their **lifetime**; closing frees them |
| `ValueLayout` / `MemoryLayout` | the shape of data: `JAVA_INT`, `ADDRESS`, structs |
| `SymbolLookup` | finds a function's address in a loaded library |
| `FunctionDescriptor` | a C function's signature, in layout terms |
| `Linker` | turns address + descriptor into a `MethodHandle` (downcall) or a native pointer from Java code (upcall) |

## Calling C, end to end

The canonical example — `size_t strlen(const char *s)`:

```java
Linker linker = Linker.nativeLinker();
SymbolLookup libc = linker.defaultLookup();          // the C runtime

MethodHandle strlen = linker.downcallHandle(
        libc.findOrThrow("strlen"),
        FunctionDescriptor.of(ValueLayout.JAVA_LONG,  // returns size_t
                              ValueLayout.ADDRESS));  // takes const char*

try (Arena arena = Arena.ofConfined()) {
    MemorySegment cString = arena.allocateFrom("Hello");  // NUL-terminated copy
    long len = (long) strlen.invokeExact(cString);
}                                                     // memory freed HERE
```

Three things to notice: the whole binding is Java; the string's native copy
dies deterministically when the arena closes; and the call site uses
`invokeExact`, whose static argument/return types must match the descriptor
*exactly* (a `long`-returning handle called as `(int)` throws
`WrongMethodTypeException` — this strictness is what lets the JVM compile
the call down to a plain native call).

Your own library instead of libc:
`SymbolLookup.libraryLookup("libwhatever.so", arena)` — the library is
unloaded when the arena closes.

## Arenas — lifetime as an object

Manual `malloc`/`free` discipline becomes a choice of arena:

| Arena | Freed when | Access from |
|---|---|---|
| `Arena.ofConfined()` | `close()` (try-with-resources) | the creating thread only |
| `Arena.ofShared()` | `close()` | any thread |
| `Arena.ofAuto()` | segment becomes unreachable (GC decides) | any thread |
| `Arena.global()` | never | any thread |

The checks are the point: touching a segment after its arena closed throws
`IllegalStateException`; touching a confined segment from the wrong thread
throws `WrongThreadException`. Use-after-free — the classic
JVM-crash-in-production JNI bug — is an exception with a stack trace now.
Confined is the default choice; shared for hand-off between threads (its
`close()` is more expensive); auto only when no scope makes sense.

## Structured memory

Structs are described, not byte-poked:

```java
MemoryLayout POINT = MemoryLayout.structLayout(
        ValueLayout.JAVA_INT.withName("x"),
        ValueLayout.JAVA_INT.withName("y"));

VarHandle xh = POINT.varHandle(MemoryLayout.PathElement.groupElement("x"));
MemorySegment p = arena.allocate(POINT);
xh.set(p, 0L, 42);                        // bounds- and type-checked
```

Every access goes through the segment's bounds; reading `JAVA_INT` at
offset 1 with an aligned layout throws instead of tearing. One sharp edge:
a raw pointer *returned by* C arrives as a **zero-length** segment (the JVM
cannot know its size), and every dereference throws until you claim a size
with `reinterpret(byteSize)` — a restricted method, deliberately, because
that claim is where safety hands back to you.

Upcalls (C calling you back — comparators, event callbacks) are the
mirror image: `linker.upcallStub(methodHandle, descriptor, arena)` produces
a native function pointer whose validity ends with the arena.

## jextract

Nobody hand-writes descriptors for a 400-function header. `jextract`
(separate tool, `jdk.java.net/jextract`, not shipped in the JDK) parses a
`.h` file and generates the Java bindings — layouts, handles, typed
wrappers — so using a C library becomes `jextract` + a Maven module.

## Who is allowed: restricted methods

Linking native functions and `reinterpret` are **restricted methods** —
safe JVM-wide only if the caller is trusted. Since JDK 24 (JEP 472) JNI
and FFM are governed identically: by default (`--illegal-native-access=warn`)
the first restricted use per module prints a warning; approval is explicit:

```
java --enable-native-access=my.native.module,ALL-UNNAMED ...
```

A future release flips the default to `deny` (`IllegalCallerException`), so
treat the flag as mandatory deployment configuration, not noise —
`jnativescan` (JDK 24+) statically lists which jars on the class path will
need it.

## When to reach for FFM — and when not

- **Yes:** a native library with no Java equivalent (codecs, GPU/ML
  runtimes, OS APIs), replacing an old JNI or `sun.misc.Unsafe` layer,
  memory-mapping with deterministic unmap
  ([`FileChannel.map` with an arena](12-nio-channels-selectors.md)).
- **No:** as a performance play for logic Java already does — a downcall
  costs about what a JNI call did, and marshalling isn't free; SIMD math
  wants the (still-incubating) Vector API, not hand-written C.
- **JNI** remains only for legacy code you haven't migrated; it now warns
  at startup like FFM does, so migration pressure is explicit.

## Gotchas

**Symptom:** `WrongThreadException` from code that "worked yesterday"
**Cause:** a segment allocated in a confined arena crossed to a pool/virtual thread — confinement binds to the *creating* thread
**Fix:** `Arena.ofShared()` for cross-thread segments, or keep allocation and use on one thread

**Symptom:** `IllegalStateException: Already closed` on segment access
**Cause:** the segment outlived its arena (stored in a field, returned from the try-with-resources)
**Fix:** the arena's scope *is* the data's scope — widen the arena, or copy out to heap before closing

**Symptom:** `WrongMethodTypeException` at a downcall site
**Cause:** `invokeExact` argument or return types don't exactly match the `FunctionDescriptor` (e.g. `int` vs `long`, missing cast on the result)
**Fix:** match carriers precisely — `JAVA_LONG` ⇒ `long`, `ADDRESS` ⇒ `MemorySegment`; the cast in `(long) handle.invokeExact(...)` is part of the signature

**Symptom:** `IndexOutOfBoundsException` dereferencing a pointer C just returned
**Cause:** foreign pointers arrive as zero-length segments — no size claim, no access
**Fix:** `segment.reinterpret(knownByteSize)` (restricted) with the size the C API documents

**Symptom:** startup prints `WARNING: A restricted method in java.lang.foreign has been called`
**Cause:** JEP 472's default `--illegal-native-access=warn` — some dependency links native code without approval
**Fix:** identify it (`jnativescan`), then grant `--enable-native-access=<module>` deliberately; don't suppress-and-forget, `deny` is the announced future default

## Interview questions

**★ What does FFM give you that JNI didn't?**
No native glue code or per-platform build (the binding is pure Java), and safety by default: bounds-checked segments, lifetime-checked arenas, thread-confinement checks — the JNI failure mode of silent memory corruption becomes exceptions. Tooling (`jextract`) generates bindings from headers.

**★ Explain the four arena kinds and pick one for a request-scoped native buffer.**
Confined (single-thread, deterministic close), shared (multi-thread, deterministic close), auto (GC-managed), global (immortal). Request-scoped: confined in a try-with-resources — deterministic free at end of request, and the confinement check catches accidental thread hops.

**★ Why `invokeExact` rather than `invoke`?**
`invokeExact` requires the call site's static types to match the handle's type exactly, which lets the runtime bind the downcall to a direct native call with no boxing/adaptation. `invoke` would adapt argument types reflectively — convenience the FFM examples deliberately avoid on a hot path.

**★ What is a "restricted method" and how does JDK 24 change running code that uses one?**
A method that can break JVM integrity if misused (linking native functions, `reinterpret`). JEP 472 unifies JNI and FFM under `--illegal-native-access`: default `warn` prints one warning per module, `deny` — the announced future default — throws. `--enable-native-access` grants named modules approval.

**★ C returns `char*` — why can't you read it immediately, and what's the safe pattern?**
The returned `MemorySegment` has length zero because the runtime can't know the allocation's size; any read throws. `reinterpret` it with the documented size (or scan within a documented maximum for the NUL), ideally attaching it to an arena so the claimed region still has a lifetime.

---

← Prev: [NIO channels and selectors](12-nio-channels-selectors.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [Phase 8 — The build: Maven, Gradle and dependencies](../phase-8-build-dependencies/README.md)
