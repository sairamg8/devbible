---
title: "A JVM gets exactly four OutOfMemoryErrors with stack traces and every one after that arrives bare, because HotSpot pre-allocates the error objects at startup and never replenishes the pool — which is the real reason for the trace-less OOM everyone blames on the JIT"
sidebar_label: "01b · The trace-less OOM"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 HotSpot source at tag `jdk-25+36`** —
> `src/hotspot/share/memory/universe.cpp` (`gen_out_of_memory_error`,
> `create_preallocated_out_of_memory_errors`), `src/hotspot/share/memory/universe.hpp`, and
> `src/hotspot/share/runtime/globals.hpp` (`PreallocatedOutOfMemoryErrorCount`,
> `StackTraceInThrowable`, `OmitStackTraceInFastThrow`)
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/memory/universe.cpp)),
> and the **JDK 25 API documentation** for `java.lang.OutOfMemoryError`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/OutOfMemoryError.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**`java.lang.OutOfMemoryError: Java heap space` with no `at` lines under it is not a logging
misconfiguration, not `-XX:-OmitStackTraceInFastThrow`, and not a truncated log. It is HotSpot
running out of pre-allocated error objects. The JVM builds a small fixed pool of
`OutOfMemoryError` instances with writable backtraces during startup — four of them — and once
they are handed out, every subsequent OOM is a shared singleton whose stack trace was never
filled in. The counter only ever goes down.**

## Why the JVM pre-allocates its own errors

Throwing an exception normally means allocating the exception object and walking the stack to
build a backtrace, both of which allocate. Doing that at the exact moment the heap is exhausted
is a recursion waiting to happen. So `Universe::create_preallocated_out_of_memory_errors` runs
during VM initialisation, long before the heap is under pressure, and builds two things:

1. **One error object per detail message**, with the message set and **no backtrace**.
2. **A small array of extra `OutOfMemoryError` instances that do have allocated backtraces**,
   used to give the first few failures a real stack trace.

The messages are set once, at startup, in the source's own order:

```cpp
Handle msg = java_lang_String::create_from_str("Java heap space", CHECK);
java_lang_Throwable::set_message(oom_array->obj_at(_oom_java_heap), msg());

msg = java_lang_String::create_from_str("C heap space", CHECK);
...
msg = java_lang_String::create_from_str("Metaspace", CHECK);
msg = java_lang_String::create_from_str("Compressed class space", CHECK);
msg = java_lang_String::create_from_str("Requested array size exceeds VM limit", CHECK);
msg = java_lang_String::create_from_str("GC overhead limit exceeded", CHECK);
msg = java_lang_String::create_from_str(
        "Java heap space: failed reallocation of scalar replaced objects", CHECK);
```

That list is worth pausing on: it is the complete inventory of the detail messages HotSpot itself
carries, and **two of them are not in the Troubleshooting Guide's seven**. See
[02c](02c-the-messages-that-are-not-on-the-list.md).

The header comment states the consequence plainly:

> *"OutOfMemoryError support. Returns an error with the required message. The returned error
> **may or may not have a backtrace**. If error has a backtrace then the stack trace is already
> filled in."*

## The pool is four, it is a `develop` flag, and it never refills

```cpp
develop(uintx, PreallocatedOutOfMemoryErrorCount, 4,
        "Number of OutOfMemoryErrors preallocated with backtrace")
```

Three things follow, and each one surprises people.

**`develop` means it is not a command-line flag in a release build.** A `develop` declaration is
compiled to a constant in a product JVM. You cannot raise the number to get more stack traces;
`-XX:PreallocatedOutOfMemoryErrorCount=64` will not be recognised.

**The count is a countdown, not a budget per interval.** The handout path is:

```cpp
if ((_preallocated_out_of_memory_error_avail_count > 0) &&
    vmClasses::Throwable_klass()->is_initialized()) {
  next = (int)Atomic::add(&_preallocated_out_of_memory_error_avail_count, -1);
} else {
  next = -1;
}
if (next < 0) {
  // all preallocated errors have been used.
  // return default
  return default_err;
}
```

`_preallocated_out_of_memory_error_avail_count` is assigned exactly once, at the end of
`create_preallocated_out_of_memory_errors`, and every other reference decrements it. **There is
no code path that puts one back.** A JVM that has been up for a week and has thrown five
`OutOfMemoryError`s will never produce another OOM stack trace for the rest of its life.

**The used slot is nulled out.** `preallocated_out_of_memory_errors()->obj_at_put(next, nullptr)`
— the array releases its reference so the error is not kept alive by the VM. The object escapes
into your application with a real filled-in trace, once.

## What you get after the fifth one

`default_err` — the shared, per-message, backtrace-less instance created at startup. Its
`getMessage()` is correct. Its `getStackTrace()` is empty. It is the *same object* every time,
handed to every thread. The javadoc anticipates precisely this:

> *"`OutOfMemoryError` objects may be constructed by the virtual machine as if suppression were
> disabled and/or the stack trace was not writable."*

So `addSuppressed` may be a no-op on it, `setStackTrace` may be ignored, and identity comparison
between two "different" errors can succeed.

## The thing this is not: `OmitStackTraceInFastThrow`

The internet's standard answer to any trace-less throwable is
`-XX:-OmitStackTraceInFastThrow`. That flag is real and it is on by default:

```cpp
product(bool, OmitStackTraceInFastThrow, true,
        "Omit backtraces for some 'hot' exceptions in optimized code")
```

But it describes a **JIT** optimisation: when C2 sees the same implicit exception thrown
repeatedly from one compiled site, it replaces the throw with a pre-allocated instance without a
trace. It applies to the *implicit* runtime exceptions — null dereference, array index,
arithmetic, class cast — thrown from *compiled* code. It is not the mechanism behind a trace-less
`OutOfMemoryError`, and turning it off will not bring the trace back.

The other flag people reach for, `StackTraceInThrowable` (product, default `true`), disables
backtrace collection globally. Turning it *off* would remove traces from everything; it is not a
fix for anything and is essentially a benchmarking flag.

| Symptom | Actual mechanism | Flag that changes it |
|---|---|---|
| `NullPointerException` with no trace in a hot loop | `OmitStackTraceInFastThrow`, JIT | `-XX:-OmitStackTraceInFastThrow` |
| 5th+ `OutOfMemoryError` with no trace | Pre-allocated pool exhausted | **none — `develop` flag** |
| No trace on *any* throwable | `StackTraceInThrowable` was turned off | `-XX:+StackTraceInThrowable` |

## What to do about it

You cannot enlarge the pool, so the answer is to stop letting the JVM reach the fifth OOM.

```
-XX:+ExitOnOutOfMemoryError
```

Terminate on the first one. You then always have the trace-bearing error, always have the single
heap dump the JVM will write (which also fires only once — see
[03](03-the-oom-hooks-are-one-function.md)), and never accumulate a log full of anonymous errors
from a process that has been limping for hours.

If you cannot exit — a batch tool, a desktop application — then treat the **first** OOM in the
log as the only one with evidence in it, and archive it. The tenth is a different-looking line
with the same message and nothing else.

## Gotchas

**★ A trace-less `OutOfMemoryError` means the JVM has already thrown at least four others.**
That is diagnostically useful on its own: it tells you the process has been failing for a while
and that somewhere earlier in the log there is an error that *does* have a trace, and a heap dump
that was written for the first one. Go find them; do not analyse the bare one.

**★ You cannot raise the pre-allocated count.**
`PreallocatedOutOfMemoryErrorCount` is a `develop` flag, which in a release build is a compile-time
constant of 4. Passing it on the command line fails flag parsing (or is silently ignored under
`-XX:+IgnoreUnrecognizedVMOptions`, which is worse). There is no supported knob.

**★ `-XX:-OmitStackTraceInFastThrow` does not fix this and is frequently applied to it.**
It affects JIT-compiled implicit runtime exceptions, not VM-thrown `VirtualMachineError`s. Adding
it to a production command line to "get OOM stack traces back" costs you compiled-code
performance on hot exception paths and changes nothing about the OOM.

**★ The same `OutOfMemoryError` object is handed to multiple threads.**
After the pool is exhausted every thread that fails on the heap gets the identical singleton. Any
code that stores the throwable, mutates it, or reasons about identity — a correlation map keyed by
`Throwable`, a `setStackTrace` call, an `addSuppressed` — is operating on shared VM state. The
javadoc's warning about suppression and writability exists for this reason.

**★ There are two distinct `Java heap space` messages, and the second one is not about your heap
being full in the ordinary sense.**
`Java heap space: failed reallocation of scalar replaced objects` is thrown when the JIT had
scalar-replaced an object via escape analysis and then had to materialise it during
deoptimisation, and the allocation for the materialised object failed. Grepping logs for the
short string finds both; they are different situations.

**★ `C heap space` is a HotSpot message that no Oracle guide enumerates.**
It sits in the same pre-allocated array as `Java heap space` and `Metaspace`. Failing to find it
in the Troubleshooting Guide's list does not mean you misread the log — see
[02c](02c-the-messages-that-are-not-on-the-list.md).

**★ The pool is only used if `java.lang.Throwable` is already initialised.**
`gen_out_of_memory_error` checks `vmClasses::Throwable_klass()->is_initialized()`. An OOM during
very early startup, before `Throwable` is initialised, gets the bare object regardless of how
many pool slots are left. A trace-less OOM in the first milliseconds of a launch is expected, not
evidence of a long-running problem.

**★ Log aggregation will happily dedupe your four good errors down to one line.**
A structured logging pipeline that groups by message will collapse "OOM with trace" and "OOM
without trace" into one bucket, because the message string is identical. The trace is in the
stack-trace field, not the message, and if your pipeline drops the field for `Error` levels you
have thrown away the only four traces the JVM was ever going to give you.

## Interview questions

**★ Your production log has `java.lang.OutOfMemoryError: Java heap space` on its own line with no
frames beneath it. What happened, and what do you do?**
The JVM exhausted its pool of pre-allocated `OutOfMemoryError` objects that carry backtraces.
HotSpot builds four of those during VM initialisation —
`PreallocatedOutOfMemoryErrorCount`, a `develop` flag, so it is a compile-time constant in a
release build — hands them out on the first four failures and never refills the pool. From the
fifth failure on you get a shared, message-only singleton with an empty stack trace. The practical
response is not to fix the logging: it is to search *earlier* in the log for the first
`OutOfMemoryError`, which does have a trace and which triggered the one heap dump the JVM will
write, and then to add `-XX:+ExitOnOutOfMemoryError` so a future incident stops at number one.

**★ Someone proposes adding `-XX:-OmitStackTraceInFastThrow` to fix missing OOM stack traces. Is
that right?**
No. `OmitStackTraceInFastThrow` is a JIT optimisation — its own description is *"Omit backtraces
for some 'hot' exceptions in optimized code"* — and it applies to implicit runtime exceptions such
as `NullPointerException` and `ArrayIndexOutOfBoundsException` raised from compiled frames. A
trace-less `OutOfMemoryError` comes from an entirely different mechanism in
`Universe::gen_out_of_memory_error`, which has nothing to do with the compiler. The flag is
sometimes the right answer for a trace-less NPE; it is never the answer here, and disabling it
costs performance on hot exception paths.

**★ Why does HotSpot pre-allocate error objects instead of creating them on demand?**
Because creating a `Throwable` allocates: the object itself, and the backtrace array produced by
walking the stack. Doing that at the moment the heap is exhausted risks failing to report the
failure — the report of the OOM would itself OOM. Pre-allocating during initialisation, when
memory is plentiful, guarantees that the VM always has *something* to throw. The cost of that
guarantee is that the supply of trace-bearing instances is finite and fixed.

**★ You see two `OutOfMemoryError` objects in a debugger with the same identity hash. Bug?**
No, expected. After the pre-allocated trace-bearing pool is exhausted, every failure with a given
detail message receives the *same* startup-created singleton for that message. The
`OutOfMemoryError` javadoc warns about the downstream effects — *"may be constructed by the
virtual machine as if suppression were disabled and/or the stack trace was not writable"* — so
identity, suppressed-exception lists and `setStackTrace` are all unreliable on VM-thrown OOMs.

{/* FOOTER */}
