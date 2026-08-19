---
title: "How processors work"
sidebar_label: "01 · How processors work"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the JDK 25 `javax.annotation.processing` API
> documentation (`Processor`, `AbstractProcessor`, `RoundEnvironment`,
> `Filer`, `Messager`) and the `javax.lang.model` element/type model, the
> JDK 25 `javac` reference page (`-proc:none`, `-proc:only`, `-proc:full`,
> `-processor`, `--processor-path`, `-Xlint:processing`), the JDK 23
> release notes and the OpenJDK Quality Outreach note announcing that
> annotation processing is no longer implicitly enabled, the Apache Maven
> Compiler Plugin documentation for `<annotationProcessorPaths>`, and the
> Gradle user guide on the `annotationProcessor` configuration and
> incremental annotation processing.

**An annotation processor is a plugin for `javac` that runs during
compilation, reads the program's declarations through a read-only model,
and writes *new* source or class files that the same compiler then
compiles. It cannot change a class you wrote — that restriction is the
design, not an oversight, and it is the line that separates every
well-behaved processor from Lombok.**

## What a processor is, mechanically

The API is JSR 269, `javax.annotation.processing`. A processor implements
`Processor` (almost always by extending `AbstractProcessor`), declares
which annotations it cares about, and is **discovered exactly like any
other service** — via `META-INF/services/javax.annotation.processing.Processor`
on the processor path. That is the same `ServiceLoader` convention covered
in [jar anatomy](../08-jar-anatomy/01-the-format.md).

```java
@SupportedAnnotationTypes("com.acme.GenerateBuilder")
@SupportedSourceVersion(SourceVersion.RELEASE_25)
public final class BuilderProcessor extends AbstractProcessor {

    @Override
    public boolean process(Set<? extends TypeElement> annotations, RoundEnvironment roundEnv) {
        for (Element e : roundEnv.getElementsAnnotatedWith(GenerateBuilder.class)) {
            TypeElement type = (TypeElement) e;
            try (Writer w = processingEnv.getFiler()
                    .createSourceFile(type.getQualifiedName() + "Builder", type)
                    .openWriter()) {
                w.write(renderBuilderSource(type));
            } catch (IOException ex) {
                processingEnv.getMessager()
                    .printMessage(Diagnostic.Kind.ERROR, "cannot write builder", e);
            }
        }
        return true;   // these annotations are "claimed" — other processors will not see them
    }
}
```

Three pieces do all the work:

| Piece | Role |
|---|---|
| `javax.lang.model` (`Element`, `TypeMirror`) | A **read-only** view of declarations — not reflection, not the AST. There is no method body here; you see signatures, modifiers, annotations and types |
| `Filer` | The only sanctioned way to create output. Writing files with `java.io` directly breaks incremental builds and the round machinery |
| `Messager` | The only sanctioned way to report. `System.out.println` from a processor is noise; `Messager` produces a real diagnostic attached to an element |

## Rounds — why generated code can generate more code

Processing runs in **rounds**. Round 1 sees the source files you handed
`javac`. Any source file a processor writes with the `Filer` becomes input
to round 2, where processors run again over those new declarations. This
repeats until a round produces no new files, followed by one **final
round** (`RoundEnvironment.processingOver()` returns `true`) for cleanup —
which is where you write summary files, because writing new *source* in
the final round is an error.

Consequences that matter in practice:

- A processor that generates an annotated class can legitimately trigger
  another processor. That is how Dagger, Micronaut and Spring's AOT
  pipeline compose.
- `return true` from `process` **claims** the annotations and stops later
  processors from seeing them. Returning `true` by reflex is a common way
  to silently break a second processor in the same build.
- A processor is instantiated **once** per compilation and called once per
  round. State that accumulates across rounds is fine; state that
  accumulates across *compilations* is a bug that shows up only under
  Gradle's compiler daemon or an IDE.
- Generated sources land in a known directory —
  `target/generated-sources/annotations` for Maven,
  `build/generated/sources/annotationProcessor/...` for Gradle. Read them.
  They are the answer to most "why does this mapper do that" questions.

## Generate, do not modify

The API gives you no way to change an existing class, and that is
deliberate: `javax.lang.model` is read-only, and the `Filer` refuses to
overwrite a source file it did not create. A conforming processor's only
outputs are new types, new resources and diagnostics.

Everything follows from that. A conforming processor cannot add a method
to your class, so the generated builder is a separate `FooBuilder` type
and the generated mapper is a separate `PersonMapperImpl`. When a tool
*appears* to add members to your own class, it is not using this API.

## Turning it on and off — and the JDK 23 change

| Flag | Effect |
|---|---|
| `-proc:none` | Compile only; run no processors. The fast, safe default for a module with none |
| `-proc:only` | Run processors, do not compile |
| `-proc:full` | Compile **and** search the class path for processors — the pre-JDK-23 behaviour, made explicit |
| `-processor a.B,c.D` | Name processors explicitly; disables discovery |
| `--processor-path` | Where to look for processors, independent of the compile class path |
| `-Xlint:processing` | Warn about suspicious processing (unclaimed annotations, source-version mismatches) |

🔴 **Since JDK 23, `javac` no longer searches the class path for
processors implicitly.** Up to JDK 22 a processor jar sitting on the
compile class path was found and run automatically; JDK 21 and 22 warned
about relying on it. From JDK 23 the default is effectively "no
processing" unless you pass `-proc:full`, name processors with
`-processor`, or supply `--processor-path`. Support for spelling
`-proc:full` was backported so a build can use it on older JDKs too.

The failure mode is nasty precisely because it is not an error: the build
**succeeds**, and the generated classes are simply absent. Lombok-annotated
classes lose their getters; MapStruct's `Mappers.getMapper` fails at
runtime with "Cannot find implementation". If a project moved to JDK 23+
and started failing with missing generated types, this is the first thing
to check.

The clean fix is not `-proc:full`. It is to declare the processors
explicitly, which is what `<annotationProcessorPaths>` already does.

## Maven: `annotationProcessorPaths`, not the compile classpath

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <version>3.14.0</version>
  <configuration>
    <annotationProcessorPaths>
      <!-- ORDER MATTERS: Lombok first -->
      <path>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok</artifactId>
        <version>${lombok.version}</version>
      </path>
      <path>
        <groupId>org.mapstruct</groupId>
        <artifactId>mapstruct-processor</artifactId>
        <version>${mapstruct.version}</version>
      </path>
      <path>
        <groupId>org.projectlombok</groupId>
        <artifactId>lombok-mapstruct-binding</artifactId>
        <version>0.2.0</version>
      </path>
    </annotationProcessorPaths>
  </configuration>
</plugin>
```

Why this and not simply a `provided`-scope dependency:

- **The processor stays out of the compile classpath**, so nobody can
  accidentally `import` a processor-internal class and have it vanish at
  runtime.
- **It is not transitive**, so consumers of your artifact do not inherit
  your code generator.
- **It survives the JDK 23 change**, because supplying a processor path is
  an explicit configuration of processing.
- **Versions are pinned in one place**, separately from the runtime
  dependency (`mapstruct` the annotations jar vs `mapstruct-processor` the
  processor).

Gradle draws the same line with a dedicated configuration:

```kotlin
dependencies {
    compileOnly("org.projectlombok:lombok:$lombokVersion")
    annotationProcessor("org.projectlombok:lombok:$lombokVersion")

    implementation("org.mapstruct:mapstruct:$mapstructVersion")
    annotationProcessor("org.mapstruct:mapstruct-processor:$mapstructVersion")
    annotationProcessor("org.projectlombok:lombok-mapstruct-binding:0.2.0")
}
```

`compileOnly` + `annotationProcessor` is the Lombok idiom: the annotations
are needed to compile, the processor is needed to process, and neither
belongs on the runtime classpath. Gradle also tracks processor jars for
incremental compilation — a processor that writes files outside the `Filer`
silently degrades the build to full recompilation.

## When not to write one

Writing a processor is a real cost and it is usually the wrong tool:

- **The model is not the language you know.** `javax.lang.model` gives you
  `Element` and `TypeMirror`, not `Class` and `Method`, and there are no
  method bodies at all. Anything that needs to inspect logic is out of
  scope by construction.
- **Errors are hard to make good.** A processor that reports through
  `Messager` with the wrong `Element` produces a diagnostic pointing at the
  wrong line, and the user's only recourse is reading generated source.
- **It couples your users' builds to you.** Every consumer now needs a
  processor path entry, IDE support, and a version that matches their JDK.
- **Runtime alternatives are often enough.** Reflection at startup, a
  `ServiceLoader` registry, or plain code generation from a build plugin
  are all simpler and none of them run inside the compiler.

Reach for a processor when you need compile-time *validation* (fail the
build on a bad annotation combination) or generated code that must be
type-checked against the user's own types. Otherwise consume one; do not
write one.

## Gotchas

**Symptom:** after moving the build to JDK 23 or later, compilation succeeds but every generated class is missing
**Cause:** since JDK 23 `javac` no longer searches the class path for processors implicitly, and this project relied on that discovery
**Fix:** declare processors explicitly with `<annotationProcessorPaths>` / Gradle's `annotationProcessor`; `-proc:full` restores the old behaviour but leaves the configuration implicit

**Symptom:** a second annotation processor stops producing output after another one is added
**Cause:** the first processor returns `true` from `process`, claiming the annotations so no later processor sees them
**Fix:** return `false` unless you genuinely intend to consume the annotation exclusively; check with `-Xlint:processing`

**Symptom:** a Gradle build that used to be incremental now recompiles everything on any change
**Cause:** a processor writes files with `java.io` instead of the `Filer`, or reads the whole element model, so Gradle cannot classify it as isolating/aggregating
**Fix:** use the `Filer` for every output; for a processor you own, declare its incremental category in `META-INF/gradle/incremental.annotation.processors`

**Symptom:** a module with no annotations at all still pays a measurable share of its compile time on processing
**Cause:** processing was enabled for the whole reactor, so `javac` still initialises the processor path and runs a round per compilation
**Fix:** set `-proc:none` for modules that genuinely have no processors; keep the explicit processor path only where it is used

**Symptom:** `Attempt to recreate a file for type com.acme.FooBuilder`
**Cause:** the processor generated the same source file in two rounds — usually because it re-processes elements it has already seen, or does not guard the final round
**Fix:** track generated names in the processor instance, skip when `roundEnv.processingOver()`, and never write output for elements that came from a previous round

## Interview questions

**★ What is an annotation processor, and what is it allowed to do?**
A `javax.annotation.processing.Processor` (JSR 269) discovered by
`ServiceLoader` on the processor path and invoked by `javac` during
compilation. It sees a **read-only** model of declarations through
`javax.lang.model` — elements and type mirrors, not bytecode and not
method bodies — and its only outputs are new files created through the
`Filer` and diagnostics emitted through the `Messager`. It cannot modify
an existing class. That restriction is the whole design: generation is
composable and inspectable, mutation would not be.

**★ Explain rounds, and why they exist.**
`javac` runs processing in rounds. Round 1 processes the original sources;
any source file written by the `Filer` becomes input to round 2, and so on
until a round produces no new files, followed by a final round where
`processingOver()` is true. They exist so that generated code can itself be
annotated and processed — which is how Dagger, Micronaut and Spring AOT
build multi-stage generation. Practical consequences: writing new source in
the final round is an error, and returning `true` from `process` claims the
annotations so later processors never see them.

**★ Why put processors in `annotationProcessorPaths` instead of on the compile classpath?**
Four reasons. The processor stays off the compile classpath, so nothing can
import processor internals that will not exist at runtime. It is not
transitive, so consumers do not inherit your code generator. Versions are
pinned separately from the runtime artifact — `mapstruct` and
`mapstruct-processor` are different jars. And it is explicit configuration
of annotation processing, which is exactly what JDK 23 made mandatory.

**★ What changed in JDK 23 around annotation processing, and how does a project notice?**
Up to JDK 22, `javac` implicitly searched the class path for processors and
ran whatever it found; JDK 21 and 22 warned about depending on it. From JDK
23 that implicit search is off, so processing runs only when you pass
`-proc:full`, name processors with `-processor`, or supply a
`--processor-path`. A project notices in the worst possible way: the
compile **succeeds** and the generated classes are simply gone — missing
Lombok accessors, missing MapStruct implementations — so the first failure
is at runtime or in an unrelated compile error.

---

← Prev: [Annotation processing](README.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [MapStruct and Spring's processors](02-mapstruct-and-spring.md)
