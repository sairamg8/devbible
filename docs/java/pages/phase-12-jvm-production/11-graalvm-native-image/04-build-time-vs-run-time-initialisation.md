---
title: "A static initialiser that runs during the build is not a compilation step — it is your code executing on the builder's JVM, with its results frozen into the binary, which is why a timestamp, a hostname or an open file descriptor in a static field is a completely different kind of bug here"
sidebar_label: "04 · Build-time vs run-time init"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Class Initialization in Native Image"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/optimizations-and-performance/ClassInitialization/)),
> "Native Image Basics" ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/basics/)),
> "Native Image Compatibility Guide" ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/metadata/Compatibility/))
> and "Build Options" ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run** — the two worked examples below are the reference manual's own, and their described outcomes are quoted, not reproduced.

**Java initialises a class the first time it is used. Native Image can instead initialise it while the binary is being built, run its static initialiser on the JVM hosting the build, and store the resulting static fields inside the executable. That is a large, real performance win and it is the mechanism behind a chunk of native image's start-up advantage. It is also the mechanism by which build-machine state — a timestamp, a hostname, an environment variable, a `Random` seed, a file that existed on the CI worker — becomes a permanent property of your artefact. This page is the mechanism; [04b](04b-the-secret-baked-into-the-image.md) is the security failure that follows from it.**

## Why the builder wants to do this at all

The reference states the cost of run-time initialisation in unusually direct terms:

> *"It significantly degrades the performance of a native executable: every access to a class (via a field or method) requires a check to ensure the class is already initialized. Without optimization, this can reduce performance by more than twofold."*

> *"It increases the amount of computation—and time—to start up an application. For example, the simple "Hello, World!" application requires more than 300 classes to be initialized."*

So the motivation is both throughput (no initialisation barrier before every static access) and start-up (three hundred initialisers you never have to run). The remedy:

> *"To reduce the negative impact of class initialization, Native Image supports class initialization at build time: it can initialize classes when it builds an executable, making runtime initialization and checks unnecessary. All the static state from initialized classes is stored in the executable."*

> *"Access to a class's static fields that were initialized at build time is transparent to the application and works as if the class was initialized at runtime."*

⚠️ **"Transparent" is the good half of the sentence and the dangerous half.** Your code cannot tell the difference — which is why a value that was *supposed* to be computed per run silently becomes a constant.

## What "build time" means, literally

From the basics page:

> *"During the image build, Native Image may execute user code. This code can have side effects, such as writing a value to a static field of a class. We say that this code is executed at *build time*. Values written to static fields by this code are saved in the **image heap**."*

> *"The static class initializer of build-time initialized classes executes **on the JVM running the image build**."*

> *"If a class is initialized at build time, its static fields are saved in the produced binary. At run time, using such a class for the first time does not trigger class initialization."*

🔴 **Read "executes on the JVM running the image build" as "executes on your CI worker".** Not in a sandbox, not symbolically. Whatever the environment of that machine is, that is the environment your static initialiser sees.

The reference's own two-class example makes the difference visible. With `Greeter` initialised at run time, its `static` block prints when `greet()` is first called. With `--initialize-at-build-time=HelloWorld\$Greeter`, the reference notes *"We saw `Greeter is getting ready!` printed during the image build"* and, at run time, only `Hello, World!` — because *"At run time, when `HelloWorld` invoked `Greeter.greet`, `Greeter` was already initialized."*

The second example is the one to internalise:

```java
class Example {
    private static final String message;

    static {
        message = System.getProperty("message");
    }

    public static void main(String[] args) {
        System.out.println("Hello, World! My message is: " + message);
    }
}
```

Built with `native-image Example --initialize-at-build-time=Example -Dmessage=native`, the documentation records the output of `./example` as `Hello, World! My message is: native` — and, critically, the output of `./example -Dmessage=aNewMessage` as **the same string**. Its explanation: *"The class initializer of the `Example` class was executed at image build time. This created a `String` object for the `message` field and stored it inside the image heap."*

**A system property read in a static initialiser is now a build-time constant.** No run-time argument overrides it, because there is no initialiser left to run.

## Two directions of the same trap: `-D` at build time

The Build Options page documents an adjacent behaviour that produces the mirror-image confusion:

> *"You can define system properties at image build time using the `-D<system.property>=<value>` option syntax. It sets a system property for the `native-image` tool, but the property will not be included in the generated executable. However, JDK system properties are included in generated executables and are visible at runtime."*

> *"`-D<system.property>=<value>` will only be visible at build time. If this system property is accessed in the native executable, it will return `null`."*

So a `-D` you pass to `native-image` is visible **during the build** — including to any static initialiser that runs then — and returns `null` at run time unless it is one of the JDK properties the reference lists as automatically copied (`file.separator`, `file.encoding`, `java.version`, `java.version.date`, `java.class.version`, `java.runtime.version`, `java.specification.name`/`.vendor`/`.version`, `java.vm.specification.name`/`.vendor`/`.version`, `line.separator`, `native.encoding`, `org.graalvm.nativeimage.kind`, `path.separator`, `stdin.encoding`, `stdout.encoding`, `sun.jnu.encoding`).

⚠️ **Combine the two facts and you get the nastiest version:** a build-time `-D` is read by a build-time initialiser, baked into a `static final` field, and the run-time property that was supposed to override it is `null` and irrelevant. The application behaves like the build machine forever.

## What is initialised at build time by default

Not your classes. The Compatibility guide:

> *"By default, classes are initialized at run time. This ensures compatibility, but limits some optimizations. For faster startup and better peak performance, it is better to initialize classes at build time. … Classes that are members of the JDK class libraries are initialized by default."*

and the class-initialization page confirms the JDK half:

> *"Native Image initializes most JDK classes at build time, including the garbage collector, important JDK classes, and the deoptimizer."*

Beyond the JDK, the builder also **infers** safety for application classes:

> *"For application classes, Native Image tries to find classes that can be safely initialized at build time. A class is considered safe if all of its relevant supertypes are safe and if the class initializer does not call any unsafe methods or initialize other unsafe classes."*

and defines "unsafe method" precisely — this is worth reading closely because it explains a lot of otherwise mysterious behaviour:

> *"- It transitively calls into native code (such as `System.out.println`): native code is not analyzed so Native Image cannot know if illegal actions are performed.*
> *- It calls a method that cannot be reduced to a single target (a virtual method). This restriction avoids the explosion of search space for the safety analysis of static initializers.*
> *- It is substituted by Native Image. Running initializers of substituted methods would yield different results in the hosting Java Virtual Machine (JVM) than in the produced executable."*

🔴 **`System.out.println` in a static initialiser makes the class unsafe** and therefore run-time-initialised. That is why adding a debug print to a static block can *change* whether the class is baked in — and why removing it later silently changes it back.

## The constraints Java's own semantics impose

These four rules explain most "why did the builder move this class" questions:

> *"- When a class is initialized, all its superclasses and superinterfaces with default methods must also be initialized. Interfaces without default methods, however, are not initialized.*
> *- Relevant supertypes of types initialized at build time must also be initialized at build time.*
> *- Relevant subtypes of types initialized at runtime must also be initialized at runtime.*
> *- No instances of classes that are initialized at runtime must be present in the executable."*

The last one is the source of a whole family of build failures. If a build-time-initialised class holds a reference to an instance of a run-time-initialised class, the build fails — because that instance would have to live in the image heap, and it is not allowed to.

## The three ways to control it

```bash
# Force build-time initialisation for a class or a package (and implicitly its superclasses).
native-image --initialize-at-build-time=com.example.tables.LookupTables ...

# Force run-time initialisation (and implicitly its subclasses). This is the one you will use.
native-image --initialize-at-run-time=com.example.net.ConnectionRegistry ...

# Ask the builder what it decided and why.
native-image -H:+PrintClassInitialization ...
```

The reference on the diagnostic:

> *"To track which classes were initialized and why, pass the command-line option `-H:+PrintClassInitialization` to the `native-image` tool. This option helps you configure the `native image` builder to work as required. The goal is to have as many classes as possible initialized at build time, yet keep the correct semantics of the application."*

**That last sentence is the design goal you are optimising against.** More build-time initialisation is faster; the limit is correctness.

Library-supplied configuration uses the same mechanism through `native-image.properties`, which is how a dependency asks for a class to be treated one way — the reference's own example is `Args = --initialize-at-build-time=com.fasterxml.jackson.annotation.JsonProperty$Access`.

## What must never be in the image heap

The Compatibility guide names the two categories and the consequence:

> *"Class initialization at build time may break specific assumptions in existing code. For example, files loaded in a class initializer may not be in the same place at build time as at run time. Also, certain objects such as a file descriptors or running threads must not be stored in a native executable. If such objects are reachable at build time, the `native image` builder fails with an error."*

✅ **This is the good case: the build fails.** An open socket, a started thread, a memory-mapped file — the builder refuses. The bad cases are the ones it cannot detect: a value that is merely *stale* rather than invalid.

```java
// Every one of these is legal, compiles, and is wrong if this class initialises at build time.
public final class Diagnostics {
    static final Instant STARTED_AT   = Instant.now();                 // the build's clock
    static final String  HOSTNAME     = System.getenv("HOSTNAME");     // the builder's hostname
    static final long    SEED         = System.nanoTime();             // a constant "random" seed
    static final String  REGION       = System.getProperty("aws.region"); // null, or the CI worker's
    static final Path    WORKDIR      = Path.of(System.getProperty("user.dir")); // the CI checkout
}
```

The fix is to force this class to run-time initialisation, and to say so where the build can see it:

```bash
native-image --initialize-at-run-time=com.example.Diagnostics ...
```

or, better, to stop putting run-time facts in static state:

```java
public final class Diagnostics {
    private static final class Holder {
        static final Instant STARTED_AT = Instant.now();   // still a static initialiser...
    }
    // ...but with --initialize-at-run-time=com.example.Diagnostics$Holder it is honest,
    // and the plainly correct version needs no initialiser at all:
    private final Instant startedAt = Instant.now();       // computed per instance, at run time
}
```

**The general rule: if a value's correctness depends on *when* or *where* it was computed, it does not belong in a static initialiser in a native image.**

## Gotchas

**★ Symptom: a `-D` property passed at run time is ignored.** Cause: it was read in a static initialiser of a build-time-initialised class, so the value in the image heap is whatever the build saw — the reference's own `Example` shows `./example -Dmessage=aNewMessage` still printing the build-time value. Fix: read configuration where it is used, not in a static block, or force the class to run-time initialisation with `--initialize-at-run-time`.

**★ Symptom: a `-D` passed to `native-image` returns `null` inside the running binary.** Cause: *"It sets a system property for the `native-image` tool, but the property will not be included in the generated executable."* Only the listed JDK properties are copied. Fix: pass run-time configuration to the *executable*, via its own command line or environment. Build-time `-D` is for the builder and for build-time initialisers, and for nothing else.

**★ Symptom: adding a `System.out.println` to a static block changes application behaviour.** Cause: the safety analysis treats a transitive call into native code as unsafe, and `System.out.println` is its own documented example — so the class stops being build-time-initialised. Fix: do not use build-time initialisation as an implicit contract. If a class must be initialised at build time, say so with `--initialize-at-build-time`; if it must not, say that. Never depend on inference.

**★ Symptom: the build fails with an error about an object that cannot be in the image heap.** Cause: a build-time-initialised class transitively holds a file descriptor, a running thread, or an instance of a run-time-initialised class — all four rules in the constraints list produce this. Fix: `--initialize-at-run-time=<the class holding it>`, then re-run with `-H:+PrintClassInitialization` to see which supertype or subtype rule dragged it in.

**★ Symptom: a lookup table or a compiled regex that used to be built at start-up is now empty or stale.** Cause: it was built in a static initialiser from a *file* — and *"files loaded in a class initializer may not be in the same place at build time as at run time."* Fix: either register the file as a resource so it is embedded and read consistently ([03b](03b-reachability-metadata.md)), or move the load out of the initialiser entirely.

**★ Symptom: `Random`, `UUID` or a nonce generator produces the same value on every process start.** Cause: the seed was captured in a static field at build time. Fix: force run-time initialisation for the holder class. This one deserves to be treated as a security defect, not a bug — see [04b](04b-the-secret-baked-into-the-image.md).

**★ Symptom: two builds of the same commit produce different binaries.** Cause: build-time initialisation captured something environmental — a clock, a hostname, an environment variable, a directory listing. Fix: this is a reproducible-builds problem with a native-image cause. Audit static initialisers for anything environmental, force the offenders to run time, and remember that `-H:+PrintClassInitialization` tells you what was initialised at build time and why.

**★ Symptom: a library works on the JVM and misbehaves in the native image, with no error.** Cause: it relies on a static initialiser running once per process, and in the image it ran once per *build*. Fix: check whether the library ships a `native-image.properties` with an `--initialize-at-run-time` entry for that class; if not, add one yourself and raise it upstream. This is precisely the kind of thing the shared metadata repository exists to carry.

## Interview questions

**★ What does `--initialize-at-build-time` actually do to a class?**
It runs that class's static initialiser on the JVM executing the build, and stores the resulting static fields into the image heap, which is copied into memory when the executable starts. At run time the class is already initialised, so no initialiser runs and no initialisation check is emitted before static accesses. The reference gives both motivations: run-time initialisation checks *"can reduce performance by more than twofold"*, and even "Hello, World!" needs *"more than 300 classes to be initialized"*. The cost is that any environmental value the initialiser read is now a constant in the artefact.

**★ Why does a system property read in a static initialiser stop being configurable?**
Because the read happened during the build. The reference's `Example` walks it: with `--initialize-at-build-time=Example -Dmessage=native`, running `./example -Dmessage=aNewMessage` still prints the build-time value, because *"The class initializer of the `Example` class was executed at image build time. This created a `String` object for the `message` field and stored it inside the image heap."* There is no initialiser left at run time, so there is nothing for the new property to influence.

**★ How does the builder decide, on its own, which application classes to initialise at build time?**
It infers safety: *"A class is considered safe if all of its relevant supertypes are safe and if the class initializer does not call any unsafe methods or initialize other unsafe classes."* A method is unsafe if it transitively calls native code (the reference's example is `System.out.println`), if it calls a method that cannot be reduced to a single target, or if it is substituted by Native Image. So a debug print in a static block is enough to flip a class from build-time to run-time initialisation — which is why relying on the inference rather than declaring your intent is fragile.

**★ Which objects can never be in the image heap, and what happens if they are?**
File descriptors and running threads are the two the Compatibility guide names, plus — from the initialisation constraints — instances of any class that is initialised at run time. If such an object is reachable at build time, *"the `native image` builder fails with an error."* That is the well-behaved case. The genuinely dangerous case is an object that is perfectly serialisable into the heap but semantically stale: an `Instant`, a hostname, a seeded PRNG, a resolved config path.

**★ You need a value computed once per process. Where do you put it in a native image?**
Not in a static initialiser of a class you have allowed to initialise at build time. Either compute it lazily on first use in a class you have explicitly marked `--initialize-at-run-time`, or make it instance state on a bean whose construction happens at run time. In Spring, ordinary bean construction is safe — AOT processing builds bean *definitions* at build time but *"Bean instances are not created during the AOT processing phase"* — so a field initialised in a constructor or `@PostConstruct` is computed per process, as expected.

**★ Two CI builds of the same commit produce different native binaries. What is the likely cause and how do you find it?**
Build-time class initialisation captured something environmental — most often a timestamp, a hostname, an environment variable or a filesystem path. Find it with `-H:+PrintClassInitialization`, which the reference describes as the way *"To track which classes were initialized and why"*; the output tells you which classes ran at build time, and you audit their static initialisers for environmental reads. The fix is `--initialize-at-run-time` for the offenders and, ideally, removing the environmental read from static state altogether.

**★ Why is build-time initialisation described as "an expert feature" even though it is on by default for the JDK?**
Because the semantics it changes are invisible at the call site. The reference says access to build-time-initialised static fields *"is transparent to the application and works as if the class was initialized at runtime"* — so nothing in your code signals that a value is frozen. Combine that with the inference rules, where an unrelated edit to a static block can silently flip a class between the two regimes, and you have a feature whose effects are large, silent and non-local. The reference's own summary is *"Note that build-time class initialization is an expert feature. Not all classes are suitable for build-time initialization."*

{/* FOOTER */}
