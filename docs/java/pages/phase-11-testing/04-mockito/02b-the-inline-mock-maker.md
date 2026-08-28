---
title: "Mockito 5 mocks final classes and methods out of the box because the inline mock maker became the default — and that default is built on runtime agent attachment, which is exactly what the JDK restricted in Java 21, so on JDK 25 the warning in your build log is policy rather than breakage"
sidebar_label: "02b · The inline mock maker"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> (sections 0.2 inline mock making, 0.3 instrumentation on Java 21+, and 39 mocking final
> types), and [JEP 451](https://openjdk.org/jeps/451).
> JDK 25 · Spring Boot 4.1.0 → Mockito 5.23.0, JUnit Jupiter 6.0.3. **No sandbox** — this
> page carries Java and build configuration, never a fabricated test run.

**[02](02-creating-mocks.md) covered how you obtain a mock. This is what the default mock
maker underneath it can and cannot do, and the one thing about it that will surprise you on a
modern JDK: since Mockito 5.0.0 final classes and methods are mockable by default, and the
mechanism that makes that possible is runtime agent attachment — the very thing Java 21
restricted. A warning in the build log after a JDK upgrade is this, and it is configuration,
not a Mockito defect.**

## 🔴 The inline mock maker and Java 21+

Since Mockito 5.0.0:

> *"Mockito now offers support for mocking final classes and methods by default. … Since
> 5.0.0, this feature is enabled by default."*

The inline mock maker *"uses a combination of both Java instrumentation API and sub-classing
rather than creating a new class to represent a mock. This way, it becomes possible to mock
final types and methods."* The separate `mockito-inline` artifact is legacy — the javadoc
says it *"may be abolished in future versions"*.

**And instrumentation is where JDK 25 bites.** Section 0.3, verbatim:

> *"Starting from Java 21, the JDK restricts the ability of libraries to attach a Java agent
> to their own JVM. As a result, the inline-mock-maker might not be able to function without
> an explicit setup to enable instrumentation, and the JVM will always display a warning."*

That is [JEP 451](https://openjdk.org/jeps/451), and on Java 25 you should expect the
warning. The documented fix is to pass Mockito's own jar as a `-javaagent`. Gradle, Kotlin
DSL, from the javadoc:

```kotlin
val mockitoAgent = configurations.create("mockitoAgent")
dependencies {
    testImplementation(libs.mockito)
    mockitoAgent(libs.mockito) { isTransitive = false }
}
tasks {
    test {
        jvmArgs.add("-javaagent:${mockitoAgent.asPath}")
    }
}
```

⚠️ The javadoc notes these are *"examples about how to set up mockito-core as a Java agent,
and it may be more appropriate to choose a different approach depending on your project
constraints"*, and that Gradle recommends a `CommandLineArgumentProvider` for task
relocatability — omitted above for simplicity, as in the original.

**If your build suddenly prints an agent warning after a JDK upgrade, this is why**, and it
is not a Mockito bug.

### What the inline maker still cannot do

From section 39:

- Mocking final types and enums is *"incompatible with mock settings like"*
  `withSettings().serializable()` and `withSettings().extraInterfaces()`.
- *"Some methods cannot be mocked"* — *"Package-visible methods of `java.*`"* and
  *"`native` methods"*.

## Gotchas

**★ The JDK 21+ agent warning read as a broken build.**
JEP 451 restricts self-attaching agents. The inline mock maker still works in many setups but
warns; the documented fix is `-javaagent` pointing at Mockito's jar. It is configuration, not
breakage.

**★ Assuming "final classes are mockable now" means everything is.**
Package-visible methods of `java.*` and `native` methods still cannot be mocked, and
`serializable()` and `extraInterfaces()` are incompatible with mocking final types and enums.

**★ Adding the `mockito-inline` artifact on Mockito 5.**
It is redundant — the inline maker is the default since 5.0.0 — and the javadoc says the
artifact *"may be abolished in future versions"*. A dependency that does nothing is worse
than no dependency, because the next reader assumes it does something.

## Interview questions

**★ Your build starts warning about a Java agent after upgrading the JDK. What happened?**
Java 21 restricted a library's ability to attach an agent to its own JVM (JEP 451), and
Mockito's inline mock maker is built on runtime agent attachment. The documented fix is to
pass Mockito's jar explicitly with `-javaagent` on the test JVM. It is a JDK policy change,
not a Mockito defect.

**★ Since Mockito 5, final classes are mockable. What is still out of reach?**
Package-visible methods of `java.*` and `native` methods. And mocking final types or enums is
incompatible with `withSettings().serializable()` and `withSettings().extraInterfaces()`.
Needing any of these is usually a design signal — see
**11 · Static and final** *(not written yet)*.

**★ Should a Mockito 5 project depend on `mockito-inline`?**
No. The inline mock maker has been the default since 5.0.0, and the javadoc says the separate
artifact *"may be abolished in future versions"*. Keeping it adds a dependency that changes
nothing and misleads the next reader into thinking it does.


{/* FOOTER */}
