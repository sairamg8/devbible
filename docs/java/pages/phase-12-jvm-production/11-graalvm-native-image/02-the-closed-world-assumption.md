---
title: "One sentence generates every rule in this topic: once a native image is built, no new elements can be added at run time — so the question is never 'does my code work' but 'can a static analysis prove my code is reached'"
sidebar_label: "02 · The closed-world assumption"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Native Image Basics"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/basics/)), "Native Image Compatibility Guide"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/metadata/Compatibility/)), "Build Output"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOutput/)) and "Java Debug Wire Protocol (JDWP)"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/debugging-and-diagnostics/JDWP/));
> the **Spring Boot reference**, "Introducing GraalVM Native Images"
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/packaging/native-image/introducing-graalvm-native-images.html)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run**.

**Everything else in this topic — reachability metadata, the tracing agent, build-time initialisation, Spring's AOT engine, the absence of JVMTI, the fact that `@ConditionalOnProperty` stops working — is a consequence of one design decision. `native-image` builds a *closed* program: it computes the set of classes, methods and fields your application can possibly touch, includes those, and discards everything else. Anything it could not prove reachable is simply not in the binary, and there is no mechanism at run time to go and get it. Understand this one page and the rest of the topic stops being a list of surprises.**

## Static analysis, in the documentation's own words

The basics page defines the process precisely:

> *"Static analysis is a process that determines which program elements (classes, methods and fields) are used by an application. These elements are also referred to as **reachable code**."*

and describes the two halves of it:

> *"- Scanning the bytecode of a method to determine what other elements are reachable from it.*
> *- Scanning the root objects in the native image heap (such as static fields) to determine which classes are reachable from them."*

The starting point and the termination condition:

> *"It starts from the entry points of the application (the `main` method). The newly discovered elements are iteratively scanned until further scanning yields no additional changes in element's reachability."*

And then the sentence the whole topic hangs on:

> *"Only **reachable** elements are included in the final image. Once a native image is built, no new elements can be added at run time, for example, through class loading. We refer to this constraint as the **closed-world assumption**."*

🔴 **Read "no new elements can be added at run time" as an absolute.** Not "slower", not "requires a flag". The bytes are not in the file.

The Compatibility guide restates it from the tool's perspective, and adds the crucial word *optimization*:

> *"Native Image provides an optimization to reduce the memory footprint and startup time of an application. This approach relies on a "closed-world assumption" in which all code is known at build time. That is, no new code is loaded at run time. As with most optimizations, not all applications are amenable to this approach."*

⚠️ **"As with most optimizations, not all applications are amenable to this approach"** is the documentation telling you, in its own voice, that this is a trade and some programs lose it. That sentence belongs in your design review.

The `native-image` README adds the property that makes it tractable at all:

> *"The analysis is static: it does not run your application. This means that all the bytecode in your application that can be called at runtime must be known (observed and analyzed) at build time."*

## What "reachable" means in practice, and where it stops

The analysis follows **statically resolvable calls**. It can see:

```java
// Reachable: an ordinary call graph. The analysis walks it.
public class OrderService {
    private final PricingRules rules = new PricingRules();

    public Money total(Order order) {
        return rules.apply(order);          // PricingRules#apply is reachable
    }
}
```

It cannot see a call whose target is computed from data:

```java
// NOT reachable by static analysis: the target depends on a run-time String.
public Object handler(String className) throws Exception {
    Class<?> type = Class.forName(className);   // className is not a constant
    return type.getDeclaredConstructor().newInstance();
}
```

There is no analysis that can decide what `className` will hold. So the class is not in the binary, and the call fails at run time — with a `MissingReflectionRegistrationError` rather than the `ClassNotFoundException` a JVM would throw, which is itself a signal ([03b](03b-reachability-metadata.md)).

**The rule of thumb that actually predicts outcomes:** if a human reading the code can point at the exact target of every call and the exact name of every loaded resource, so can the analysis. The moment the target is a `String` computed at run time, a service-loader lookup over an unknown classpath, or bytes generated on the fly, it cannot — and that is what metadata exists to bridge.

## The image heap: objects that exist before `main`

The second half of "closed world" is that some *objects*, not just code, are decided at build time:

> *"The **Native Image heap**, also called the **image heap**, contains:*
> *- Objects created during the image build that are reachable from application code.*
> *- `java.lang.Class` objects of classes used in the native image.*
> *- Object constants embedded in method code."*

> *"When native image starts up, it copies the initial image heap from the binary."*

🔴 **That copy is a large part of why start-up is fast, and it is also a large part of what goes wrong.** A `static final Map` populated in a static initialiser that ran at build time is *already populated* in the binary. So is anything it transitively references — including, if you are careless, a configuration object holding a password. [04](04-build-time-vs-run-time-initialisation.md) and [04b](04b-the-secret-baked-into-the-image.md) are that story.

## What the build tells you about closure

The build output reports the analysis result directly. The Build Output reference describes the reachability metrics:

> *"The number of types (primitives, classes, interfaces, and arrays), fields, and methods that are found reachable by the static analysis. The reachability metrics give an impression of how small or large the application is."*

> *"These metrics can be helpful when compared before and after merging code changes or adding, removing, or upgrading dependencies of an application. … A larger number of reachable types, fields, and methods will also result in a larger native binary."*

**Track those three numbers across builds.** A dependency upgrade that adds twenty thousand reachable methods is visible here before it is visible in the binary size, and long before it is visible in a start-up measurement.

## The fallback file — the failure mode that looks like a success

If the builder cannot close the world, it may not fail:

> *"If the `native-image` builder is unable to optimize an application at build time, it generates a so-called "fallback file" that requires a Java VM to run."*

⚠️ **A fallback file is a build that "succeeded" and produced an artefact that is not a native executable.** It requires a JVM at run time — which is precisely the thing you were removing. If your deployment image has no JVM in it, this surfaces as a container that will not start.

The Compatibility guide names the feature class that triggers it:

> *"Under the closed-world assumption, all methods that are called and their call sites must be known. The `invokedynamic` method and method handles can introduce calls at run time or change the method that is invoked."*

with an important carve-out:

> *"Note that `invokedynamic` use cases generated by `javac` for, for example, Java lambda expressions and String concatenation that are supported because they do not change called methods at run time."*

So **lambdas and string concatenation are fine**; a framework that builds `MethodHandle` chains from run-time data is not. That distinction is the reason "native image doesn't support `invokedynamic`" is wrong as usually stated.

## Consequences you will meet, all from the same sentence

Spring Boot's reference lists them from the application author's side, and every bullet is the closed world wearing a different hat:

> *"- Static analysis of your application is performed at build-time from the `main` entry point.*
> *- Code that cannot be reached when the native image is created will be removed and won't be part of the executable.*
> *- GraalVM is not directly aware of dynamic elements of your code and must be told about reflection, resources, serialization, and dynamic proxies.*
> *- The application classpath is fixed at build time and cannot change.*
> *- There is no lazy class loading, everything shipped in the executables will be loaded in memory on startup.*
> *- There are some limitations around some aspects of Java applications that are not fully supported."*

Two of these are worth pulling out.

**"The application classpath is fixed at build time and cannot change"** is literal to the point that there is no classpath at run time at all. The JDWP documentation states the observable consequence:

> *"There's no runtime class-path `System.getProperty("java.class.path") == null`"*

Any code that reads that property to scan for plugins, locate a config directory or build a class loader gets `null`, not an empty string. It will not throw; it will silently find nothing.

**"There is no lazy class loading"** flips a habit. On a JVM, an unused branch costs nothing until it is taken. In a native image, everything included is resident from process start — which is why footprint tracks *reachability*, not *usage*, and why pruning dependencies pays twice.

## Why not just include everything?

You can get closer to that, and the escape hatch exists: `-H:Preserve` (see [03b](03b-reachability-metadata.md)) will keep whole packages, modules or classpath entries regardless of reachability. The documentation is blunt about the price:

> *"Using `-H:Preserve=all` requires significant memory and will result in much larger native images."*

That is the trade in one line. Closure is not bureaucracy; it is the mechanism that produces the small, fast-starting binary you wanted. **Every step you take toward "include it all" gives back proportionally the thing you adopted native image for.**

## Gotchas

**★ Symptom: a code path that works on the JVM throws at run time in the native binary, and only under one input.** Cause: the path was not reachable from `main` through statically resolvable calls, so it is not in the binary; you only hit it with the input that reaches it. Fix: this is not a bug to be debugged in isolation — it is the closed world. Either make the target constant so the analysis sees it, or register metadata ([03b](03b-reachability-metadata.md)), and make your native test suite exercise the path ([08](08-testing-a-native-image.md)).

**★ Symptom: the build succeeds but the produced artefact will not run without a JVM.** Cause: a fallback file — *"If the `native-image` builder is unable to optimize an application at build time, it generates a so-called "fallback file" that requires a Java VM to run."* Fix: treat "did we get a real native executable" as an explicit CI assertion, not an assumption. Run the produced binary in the JVM-free base image you actually deploy to, in the same pipeline that built it; a fallback file fails there immediately and loudly.

**★ Symptom: `System.getProperty("java.class.path")` returns `null` and a plugin scanner silently loads nothing.** Cause: there is no run-time classpath in a native image; the property is `null`, not empty. Fix: do not derive behaviour from the classpath at run time. Enumerate what you need at build time — a generated `List` of implementation classes, a `ServiceLoader` registration with metadata, or an explicit registry — and read that instead.

```java
// Instead of scanning a classpath that does not exist at run time:
public final class HandlerRegistry {
    private static final Map<String, Handler> HANDLERS = Map.of(
            "csv",  new CsvHandler(),
            "json", new JsonHandler(),
            "xml",  new XmlHandler());

    public static Handler forFormat(String format) {
        Handler handler = HANDLERS.get(format);
        if (handler == null) {
            throw new IllegalArgumentException("Unsupported format: " + format);
        }
        return handler;
    }
}
```

Every implementation is now a constant reference the analysis can follow, and the failure for an unknown format is a clear exception rather than a missing class.

**★ Symptom: "we can't use native image, we use lambdas / string concatenation, and those are `invokedynamic`."** Cause: half-remembering the `invokedynamic` limitation. Fix: the reference explicitly carves those out — *"`invokedynamic` use cases generated by `javac` for, for example, Java lambda expressions and String concatenation … are supported because they do not change called methods at run time."* The unsupported case is code that constructs or re-targets `MethodHandle`s from run-time data.

**★ Symptom: image size and RSS grow after a dependency upgrade that "only added one class".** Cause: reachability is transitive; one new call site can drag a large subgraph into the closed world, and with no lazy class loading all of it is resident from start-up. Fix: watch the reachable types/fields/methods counts the build prints, compare them across builds, and treat a jump as a review item — the Build Output reference recommends exactly this comparison.

**★ Symptom: someone proposes `-H:Preserve=all` to "just make it work".** Cause: it does make many missing-metadata errors go away. Fix: read the documented cost — *"requires significant memory and will result in much larger native images"* — and use it the way the documentation intends, as a **discovery** build combined with metadata tracing, not as a deployment setting. [03c](03c-the-tracing-agent.md) shows that workflow.

**★ Symptom: a profiler, an APM agent or a bytecode-instrumenting library does nothing.** Cause: *"JVMTI and other bytecode-based tools are not supported with Native Image"* — the Compatibility guide's own words, because *"These interfaces are built on the assumption that Java bytecode is available at run time, which is not the case for native images."* Fix: use what the binary does support — JFR, `jcmd`, heap dumps, NMT, `perf` — which is [07b](07b-no-jit-no-jfr-no-jstack.md), and stop expecting a `-javaagent` to attach.

## Interview questions

**★ State the closed-world assumption in one sentence and then say what follows from it.**
*"Once a native image is built, no new elements can be added at run time, for example, through class loading."* What follows: reflection, dynamic proxies, resources, serialization and JNI need explicit metadata because the analysis cannot compute their targets; there is no run-time classpath and no lazy class loading; JVMTI and bytecode-instrumenting agents cannot work; class initialisation can be moved to build time because there is no later moment at which the set of classes changes; and frameworks that decide their shape at start-up have to decide it at build time instead.

**★ How does the analysis decide what is reachable, and what defeats it?**
It starts at `main`, scans method bytecode for what each method can call, scans root objects in the image heap such as static fields, and iterates to a fixed point. It is defeated by any target that is not statically resolvable: `Class.forName` on a non-constant string, `Method#invoke` on a looked-up method, a proxy built from an interface list computed at run time, a resource path assembled from configuration, bytes defined into a class loader. Notably it is *not* defeated by `javac`-generated `invokedynamic` for lambdas and string concatenation, because those do not change their target at run time.

**★ What is a fallback file and why is it dangerous?**
It is the artefact `native-image` produces when it cannot close the world: *"a so-called "fallback file" that requires a Java VM to run."* It is dangerous because the build reports success. You get a file where you expected a native executable, and the failure surfaces later — in a JVM-free container that will not start, or in a deployment where the footprint and start-up gains silently never materialised. Assert on it in CI by running the artefact in the JVM-free image you deploy.

**★ Why is there no lazy class loading in a native image, and what does that change about footprint?**
Because there is nothing to defer: the classes are compiled into the binary and the image heap is copied at start-up. Boot's reference puts it as *"everything shipped in the executables will be loaded in memory on startup."* The consequence is that footprint tracks what is *reachable*, not what is *used*. On a JVM, an unused code path costs almost nothing; in a native image it costs its share of the binary and of resident memory from the first millisecond. That is why pruning dependencies pays twice — smaller image, smaller RSS — and why the build's reachability counts are a genuine review metric.

**★ Why is the closed world described as an "optimization" rather than a restriction?**
Because that is what it is, and the framing matters for how you argue about it. The reference says: *"Native Image provides an optimization to reduce the memory footprint and startup time of an application. This approach relies on a "closed-world assumption" … As with most optimizations, not all applications are amenable to this approach."* The restrictions are not gratuitous; they are the enabling condition for the small, instantly-starting binary. Any move you make toward re-opening the world — `-H:Preserve=all`, registering everything reflectively, keeping all locales — gives back exactly the benefit you adopted it for.

**★ A dependency computes class names from a properties file and instantiates them. What are your options, honestly?**
Four, in decreasing order of preference. One: configure that dependency to use a static registration mechanism instead, if it has one. Two: enumerate the possible class names at build time and register them as reflection metadata, accepting that the set is now fixed in the artefact. Three: check the GraalVM Reachability Metadata Repository — if the library is popular, someone has already done exactly that. Four: if the set of names is genuinely open-ended and user-supplied, the dependency is incompatible with a closed world and the answer is to replace it or not to go native. Saying option four out loud is part of the job.

{/* FOOTER */}
