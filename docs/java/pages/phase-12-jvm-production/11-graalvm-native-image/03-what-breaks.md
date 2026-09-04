---
title: "The catalogue of what a closed world takes away — reflection, proxies, resources, bundles, serialization, JNI and dynamic class definition need metadata, while finalizers, the security manager, JVMTI and parts of Unsafe behave differently or not at all"
sidebar_label: "03 · What breaks"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09 against the **GraalVM Native Image reference** — "Reachability Metadata"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/metadata/)), "Native Image Compatibility Guide"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/metadata/Compatibility/)), "Dynamic Features of Java"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/dynamic-features/)) and "Build Options"
> ([graalvm.org](https://www.graalvm.org/latest/reference-manual/native-image/overview/BuildOptions/)).
> Target: **JDK 25 · GraalVM 25.3.4.1 · Spring Boot 4.1.0 / Spring Framework 7.0.8**.
> Documentation-validated; **no sandbox run** — error type names below are quoted from the reference, not reproduced from a run.

**There are two different lists here and conflating them wastes days. The first is *dynamic features that need metadata*: reflection, JNI, resources, resource bundles, serialization and the Foreign Function and Memory API all still work, but only for the elements you declared. The second is *behaviour that is simply different*: finalizers never run, the security manager is inert, JVMTI does not exist, and `sun.misc.Unsafe` field offsets need special handling. The first list is a configuration problem with a known workflow. The second list is a design problem, and no amount of metadata fixes it.**

## List one — the six things that need metadata

The reference states the principle first:

> *"The dynamic language features of the JVM (for example, reflection and resource handling) compute the *dynamically-accessed program elements* such as fields, methods, or resource URLs at run time. On HotSpot this is possible because all class files and resources are available at run time and can be loaded by the runtime."*

> *"To ensure inclusion of necessary dynamically-accessed elements into the native binary, the `native-image` builder requires **reachability metadata**."*

and then enumerates the categories:

> *"- Java reflection (the `java.lang.reflect.*` API) enables Java code to examine its own classes, methods, fields, and their properties at run time.*
> *- JNI allows native code to access classes, methods, fields and their properties at run time.*
> *- Resources allow arbitrary files present on the classpath to be dynamically accessed in the application.*
> *- Resource Bundles Java localization support (`java.util.ResourceBundle`) that enables Java code to load L10N resources.*
> *- Serialization enables writing (and reading) Java objects to (and from) streams.*
> *- (Experimental) Predefined Classes provide support for dynamically generated classes."*

The Compatibility guide adds the Foreign Function and Memory API to the same bucket. [03b](03b-reachability-metadata.md) is how you supply the metadata; this page is what each category costs you.

### Reflection

**What still works for free.** The builder resolves reflective calls whose arguments are compile-time constants:

> *"For all methods in this section Native Image will compute reachability at build time given that all the call arguments are constant. Providing constant arguments in code is a preferred way to provide metadata as it requires no duplication of information in external JSON files."*

```java
// Works with no configuration: "Foo" is a literal, so the builder resolves it at build time.
class ReflectiveAccess {
    public Class<?> fetchFoo() throws ClassNotFoundException {
        return Class.forName("Foo");
    }
}
```

The reference notes the compensating behaviour: *"If the class `Foo` does not exist, the call to `Class#forName` will be transformed into `throw ClassNotFoundException("Foo")`."* — the failure is compiled in, not discovered.

"Constant" is defined generously — a literal, a build-time-initialised `static` field, an effectively final variable, a constant-length array of constants, or simple computation over those. Constant `Class<?>[]` parameter arrays work in all three of the usual spellings.

**What does not.** Anything where the name or signature arrives at run time. The methods that will fail without metadata are enumerated in the reference and are worth knowing by shape, because the list is broader than most people assume: `getConstructor`, `getDeclaredConstructor`, `getConstructors`, `getDeclaredConstructors`, `getMethod`, `getDeclaredMethod`, `getMethods`, `getDeclaredMethods`, `getField`, `getDeclaredField`, `getFields`, `getDeclaredFields`, `getRecordComponents`, `getPermittedSubclasses`, `getSigners`, `getNestMembers`, `getClasses`, `getDeclaredClasses` — plus *"all reflective lookups via `java.lang.invoke.MethodHandles.Lookup`"*.

Invocation and field access are a **separate** registration from lookup. Without invocation metadata, `Method#invoke`, `Constructor#newInstance`, `MethodHandle#invokeExact` and `MethodHandle#invokeWithArguments` fail; without field-access metadata, `Field#get`, `Field#set` and *"All accessor methods on `java.lang.reflect.VarHandle`"* fail.

🔴 **The failure is an `Error`, deliberately.** The reference: *"Invocation of methods above without the provided metadata will result in throwing `MissingReflectionRegistrationError` which extends `java.lang.Error` and **should not be handled**."* And the sentence that catches people: *"Note that even if a type does not exist on the classpath, the methods above will throw a `MissingReflectionRegistrationError`."* So a native image cannot tell you apart "not registered" and "not present" — code that relies on catching `ClassNotFoundException` to detect an optional dependency **changes behaviour**.

```java
// A very common JVM idiom that changes meaning in a native image.
private static boolean optionalLibraryPresent() {
    try {
        Class.forName("com.example.optional.Feature");
        return true;
    } catch (ClassNotFoundException e) {
        return false;                 // never reached: the error is an Error, not this exception
    }
}
```

The fix is to make presence a build-time fact rather than a run-time probe — a constant, a Spring `@ConditionalOnClass` resolved during AOT processing, or two build profiles.

### Dynamic proxies

A JDK proxy is a class generated at run time from an interface list. The builder can only pre-generate the proxy classes whose interface lists it knows, so `Proxy#getProxyClass` and `Proxy#newProxyInstance` are metadata-driven, and the metadata is *"an ordered collection of interfaces that defines a proxy"*. **Ordered** is load-bearing: two proxies over the same interfaces in a different order are different registrations.

⚠️ **Lambda-proxy classes are a documented gap**: *"Note that for lambda-proxy classes, metadata can not be provided. This is a known issue that will be addressed in the future releases of GraalVM."* Ordinary lambdas are fine (they are `javac`-generated `invokedynamic`); this is specifically about registering a lambda's proxy class as metadata.

Spring's own proxies are a different mechanism again — cglib bytecode, generated at build time by the AOT engine. [05](05-spring-boot-aot.md).

### Resources

Resources are embedded in the binary, which changes both *whether* they are found and *what kind of URL* you get:

> *"Resources embedded in a native executable are returned as `resource:` URLs instead of `file:` URLs. Do not use `URL#getFile()` to obtain a file system path for an embedded resource. To read the resource, use `Class#getResourceAsStream()`, `ClassLoader#getResourceAsStream()`, or `URL#openStream()`. If an API requires a file system path, copy the resource to a temporary file first."*

🔴 **`URL#getFile()` on a classpath resource is a JVM habit that silently breaks here.** It does not throw; it returns something that is not a path.

Constant lookups are auto-registered under two conditions — *"The class on which these methods are called is constant"* and *"The first argument (`name`) is a constant"*. So `Example.class.getResourceAsStream("plans/v2/conquer_the_world.txt")` needs nothing; `getClass().getResourceAsStream(configuredPath)` needs a `resources` entry with a glob.

And one consequence people find late:

> *"A consequence of this approach is that some parts of the application that use resources for configuration (such as logging) are effectively configured at build time."*

### Resource bundles and locales

Bundles are registered like resources, and *"Resource bundles are included for all locales that are included into the image"*. The locale set is itself a build-time decision — `-H:IncludeLocales=fr,en`, or `-H:+IncludeAllLocales` with the documented warning that *"it increases the size of the resulting executable."* A service that formats currency for a locale nobody registered will not fall back the way you expect.

### Serialization

> *"Java can serialize (or deserialize) any class that implements the `Serializable` interface. Native Image supports serialization (or deserialization) with proper serialization metadata registration. This is necessary because serialization usually requires reflective accesses to the object that is being serialized."*

The in-code registration route is unusual and worth knowing because it doubles as a security improvement: the builder detects a constant pattern passed to `ObjectInputFilter.Config#createFilter`, and registers exactly the classes it names.

```java
// Registers pkg.SerializableClass for serialization AND restricts what the stream may deserialize.
var filter = ObjectInputFilter.Config.createFilter("pkg.SerializableClass;!*;");
objectInputStream.setObjectInputFilter(filter);
```

The reference notes the double benefit: *"Using this pattern has a positive side effect of improving security on the JVM as only `pkg.SerializableClass` can be received by the `objectInputStream`."* ⚠️ And the limit: *"Patterns like `"pkg.**"` and `"pkg.Prefix*"` will not perform serialization registration as they are too general and would increase image size significantly."* A broad filter pattern registers nothing.

### JNI

> *"Java Native Interface (JNI) allows native code to access arbitrary Java types and type members. Native Image cannot predict what such native code will lookup, write to or invoke. To build a native binary for a Java application that uses JNI to access Java values, JNI metadata is required."*

Symmetric to reflection, and the reason a database driver or a compression library with a native component needs either shipped metadata or your own.

### Classes defined at run time

> *"Java has support for loading new classes from bytecode at run time, which is not possible in Native Image as all classes must be known at build time (the "closed-world assumption")."*

The documented options, in the reference's own order of preference: reconfigure the application or library not to generate classes; generate them at build time in a static initialiser of a dedicated class and hold the resulting `Class` objects in static fields with `--initialize-at-build-time`; or, last, use the agent's `experimental-class-define-support` to capture *predefined classes*. The last is explicitly hedged: *"Predefined classes are the best-effort approach for legacy projects, and they are not guaranteed to work."*

## List two — behaviour that is simply different

Metadata does not help with any of these. They are documented in the Compatibility guide and each one is a design constraint.

- **Finalizers never run.** *"Therefore, finalizers are not invoked. We recommend you replace finalizers with weak references and reference queues."* Any cleanup you left in `finalize()` does not happen. Deprecated since Java 9, so this should already be true of your code — audit dependencies, not just your own source.
- **The security manager is inert.** *"`java.lang.System#getSecurityManager()` always returns `null` even if the security manager is set via `-Djava.security.manager` at startup"*, and `setSecurityManager` with a non-null argument throws `SecurityException` unless `-Djava.security.manager` is `disallow`.
- **Long-deprecated `Thread` methods are absent.** *"Native Image does not implement long-deprecated methods in `java.lang.Thread` such as `Thread.stop()`."*
- **`sun.misc.Unsafe` field offsets need care.** *"Fields that are accessed using `sun.misc.Unsafe` need to be marked as such for the static analysis if classes are initialized at build time."* Usually automatic — *"field offsets stored in `static final` fields are automatically rewritten from the hosted value … to the native executable value"* — but non-standard patterns need `RecomputeFieldValue`. The reason is worth understanding: an offset computed on the *builder's* JVM is meaningless in the produced binary, so it must be recomputed rather than copied.
- **JVMTI and every bytecode-based tool are unsupported.** *"These interfaces are built on the assumption that Java bytecode is available at run time, which is not the case for native images built with the closed-world optimization. … JVMTI and other bytecode-based tools are not supported with Native Image."* This is the sentence that rules out `-javaagent`, most APM agents, and JaCoCo-style coverage inside the binary. What replaces them is [07b](07b-no-jit-no-jfr-no-jstack.md).
- **Build-time class initialisation can break assumptions.** *"For example, files loaded in a class initializer may not be in the same place at build time as at run time. Also, certain objects such as a file descriptors or running threads must not be stored in a native executable. If such objects are reachable at build time, the `native image` builder fails with an error."* This is [04](04-build-time-vs-run-time-initialisation.md).
- **`--enable-http`, `--enable-https` and `--enable-url-protocols` are deprecated.** The Build Options page: *"Use reachability metadata instead."* If you copy a `native-image` command line from a 2022 article, this is the first thing in it that is stale.
- **AArch64 on Linux has two documented carve-outs**: `-R:WriteableCodeCache` *"must be disabled"*, and for `--libc`, *"`musl` is not supported."* The second matters if your deployment story is Alpine on ARM.

## Gotchas

**★ Symptom: an optional-dependency probe using `catch (ClassNotFoundException)` reports the dependency present when it is absent, or throws.** Cause: the reference states that *"even if a type does not exist on the classpath, the methods above will throw a `MissingReflectionRegistrationError`"*, which is an `Error` and does not match your `catch`. Fix: resolve optionality at build time. In Spring, `@ConditionalOnClass` is evaluated during AOT processing and produces the right artefact; outside Spring, use two build profiles or a constant flag rather than probing.

**★ Symptom: a resource loads, but the code that consumes it fails on a path.** Cause: *"Resources embedded in a native executable are returned as `resource:` URLs instead of `file:` URLs"* and `URL#getFile()` returns something that is not a filesystem path. Fix: read it as a stream, and if a third-party API insists on a path, materialise a temp file:

```java
static Path materialise(String resourceName) throws IOException {
    try (InputStream in = HandlerRegistry.class.getResourceAsStream(resourceName)) {
        if (in == null) {
            throw new FileNotFoundException("Resource not embedded in the image: " + resourceName);
        }
        Path temp = Files.createTempFile("embedded-", ".dat");
        Files.copy(in, temp, StandardCopyOption.REPLACE_EXISTING);
        temp.toFile().deleteOnExit();
        return temp;
    }
}
```

**★ Symptom: a serialization registration via `ObjectInputFilter` pattern silently registers nothing.** Cause: the pattern was too general — *"Patterns like `"pkg.**"` and `"pkg.Prefix*"` will not perform serialization registration."* Fix: name the classes explicitly in the pattern, or register them in `reachability-metadata.json` with `"serializable": true` ([03b](03b-reachability-metadata.md)). A wildcard filter is a security control here, not a registration.

**★ Symptom: a cleanup that used to happen "eventually" never happens.** Cause: *"finalizers are not invoked."* Fix: replace with an explicit `close()` and try-with-resources, or a `Cleaner` with a phantom reference. If the offender is a dependency, that is a dependency-replacement conversation, and it is one you should have on the JVM too.

**★ Symptom: `-Djava.security.manager` in the run command changes nothing.** Cause: `System.getSecurityManager()` *"always returns `null`"* in a native image. Fix: whatever the manager was enforcing has to move somewhere real — OS-level sandboxing, container capabilities, or code-level checks. Do not ship a binary that believes it is sandboxed.

**★ Symptom: an APM agent, a profiler or a coverage tool attaches and reports nothing.** Cause: JVMTI is not supported, because there is no bytecode at run time. Fix: use JFR (`--enable-monitoring=jfr`), `jcmd`, heap dumps, NMT and `perf`, all covered in [07b](07b-no-jit-no-jfr-no-jstack.md). For coverage, measure it on the JVM test run — which is where you should be running the bulk of your tests anyway (**08 · Testing a native image** *(not written yet)*).

**★ Symptom: a build command copied from an article fails on `--enable-http`.** Cause: *"The `--enable-http`, `--enable-https`, and `--enable-url-protocols` options are deprecated. Use reachability metadata instead."* Fix: delete them and let metadata handle URL protocols; the URL Protocols page in the reference covers the current mechanism.

**★ Symptom: a proxy-based library works for one interface set and fails for another that looks equivalent.** Cause: proxy metadata is *"an ordered collection of interfaces"* — the order is part of the key. Fix: register every ordering the application actually produces, or, better, capture them with the agent ([03c](03c-the-tracing-agent.md)) rather than hand-writing them.

**★ Symptom: locale-specific formatting falls back to English in production but not in tests.** Cause: only the locales included at build time are in the image, and bundles are *"included for all locales that are included into the image."* Fix: name them — `-H:IncludeLocales=de,fr,en` — and be deliberate about `-H:+IncludeAllLocales`, which the reference warns *"increases the size of the resulting executable."*

**★ Symptom: a library using `sun.misc.Unsafe` produces nonsense values or crashes.** Cause: a field offset computed on the builder's JVM was captured into the image without recomputation. The automatic rewrite covers *"field offsets stored in `static final` fields"*; anything else needs `RecomputeFieldValue`. Fix: this is nearly always a library-side fix — check whether the library ships native-image support, and if not, that is a strong signal about its suitability.

## Interview questions

**★ What is the difference between the two kinds of native-image incompatibility, and why does the distinction matter operationally?**
One kind is *missing metadata*: reflection, JNI, resources, bundles, serialization and FFM all work, but only for what you declared. It has a workflow — declare it, or capture it with the agent, or take it from the metadata repository — and a predictable failure mode, a `MissingReflectionRegistrationError`. The other kind is *different behaviour*: finalizers not running, an inert security manager, no JVMTI, absent `Thread.stop()`. No metadata fixes those; they are design changes. Operationally it matters because the first list is a sprint of configuration work with a definite end, and the second is a decision about whether the application can go native at all.

**★ Why does `Class.forName("Foo")` need no configuration but `Class.forName(name)` does?**
Because the builder computes reachability for constant arguments at build time. With a literal, it resolves the class during the build and stores the result in the image heap — and if the class does not exist, it compiles in a `throw ClassNotFoundException("Foo")` instead. With a variable, there is nothing to resolve; the analysis has no way to know which classes could reach that call site, so the class is not included and the call throws `MissingReflectionRegistrationError`. The reference explicitly recommends the constant form as *"a preferred way to provide metadata as it requires no duplication of information in external JSON files."*

**★ Why is `MissingReflectionRegistrationError` an `Error` and not an exception, and what does that imply for your code?**
The reference says it *"extends `java.lang.Error` and should not be handled"* — the intent is that a missing registration is a build defect, not a run-time condition to recover from. The implication is that broad `catch (Throwable)` blocks will swallow a real configuration bug and turn it into silent degradation. GraalVM ships a countermeasure for exactly that: `-XX:MissingRegistrationReportingMode=Exit` makes the application print the error and exit unconditionally, which the documentation recommends *"for running application tests to guarantee all metadata is included."*

**★ A resource loads correctly in the native image but a downstream library throws on the path. What happened?**
The library called `URL#getFile()`. Embedded resources are returned as `resource:` URLs, not `file:` URLs, so there is no filesystem path behind them — the reference says so and tells you not to do it. Read the resource as a stream. If the library's API genuinely requires a `Path` or a `File`, copy the stream to a temporary file at start-up and hand that over.

**★ Your application needs to load handler classes named in a configuration file. Walk through the options.**
The names are not constants, so nothing is registered automatically. Option one, and by far the best: invert it — enumerate the handlers in code as a `Map` of constants and let configuration select among them, which makes every target statically reachable. Option two: if the set is closed but large, register all of them as reflection metadata and accept that the artefact now fixes the set. Option three: if the classes are *generated*, the reference's own preference order applies — reconfigure, or generate at build time in a `--initialize-at-build-time` static initialiser, or fall back to agent-captured predefined classes, which the documentation calls *"best-effort"* and *"not guaranteed to work."* Option four: if the names are genuinely user-supplied and open-ended, this application should not be a native image.

**★ Which Java features work in a native image but behave differently enough to matter?**
Serialization works but only for registered types, and a broad `ObjectInputFilter` pattern registers nothing. Resources work but come back as `resource:` URLs. Localisation works but only for locales included at build time. `Unsafe` works but field offsets must be recomputed, not copied from the builder's JVM. Proxies work but are keyed on an *ordered* interface list. And `invokedynamic` works for the `javac`-generated cases — lambdas, string concatenation — while `MethodHandle` chains built from run-time data do not, which is the distinction most summaries get wrong.

{/* FOOTER */}
