---
title: "MapStruct and Spring's processors"
sidebar_label: "02 · MapStruct and Spring"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the MapStruct 1.6 reference guide and FAQ
> (`@Mapper`, `unmappedTargetPolicy`, `componentModel`, the Lombok
> section), the MapStruct project news for the 1.7 line (1.7.0.Beta1
> released 2026-02-01, Beta2 2026-06-27), projectlombok.org's
> documentation for `lombok-mapstruct-binding`, the Apache Maven Compiler
> Plugin `<annotationProcessorPaths>` documentation, and the Spring Boot
> reference documentation for `spring-boot-configuration-processor` and
> `spring-boot-autoconfigure-processor`.

**MapStruct is what a conforming annotation processor looks like: you
declare an interface, it writes an implementation you can open, read and
step through, and a field renamed on one side of the mapping fails the
build instead of returning null in production. Its one famous problem is
not its own — it is what happens when Lombok is in the same compilation
and the two run in the wrong order.**

## MapStruct — the well-behaved example

MapStruct is what a conforming processor looks like. You declare an
interface; it generates the implementation:

```java
@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface PersonMapper {
    @Mapping(target = "fullName", expression = "java(p.firstName() + \" \" + p.lastName())")
    PersonDto toDto(Person p);
}
```

What you get in `target/generated-sources` is a plain `PersonMapperImpl`
with a constructor and ordinary getter/setter calls. That is the entire
selling point:

- **Compile-time, no reflection.** The mapping is `dto.setName(p.getName())`,
  so it is as fast as hand-written code and inlines like hand-written code.
- **You can read it, step through it in a debugger, and diff it.**
- **Mismatches are compile errors**, not silent nulls at runtime, when you
  set `unmappedTargetPolicy = ERROR`. A field renamed on one side fails the
  build — which is the entire reason to prefer it to a reflective mapper.

The honest downsides: another processor in the build, generated code that
must be regenerated after every model change (a stale IDE build directory
is a classic phantom error), and expression strings like the one above,
which are unchecked text until the generated file is compiled.

### The Lombok interaction — the build breakage everyone meets

Put `@Data` on your entity and a MapStruct mapper over it and the build
fails with something like *"Unknown property `name` in result type
PersonDto"* — MapStruct cannot see the getters and setters, because it ran
before Lombok added them.

The cause is that both are processors in the same compilation, and
**processor execution order within a round is not specified**. MapStruct
inspects the element model; Lombok mutates the AST. If MapStruct's round
runs first, the accessors it is looking for do not exist yet.

The fix is two-part and both parts are required:

1. **List Lombok before MapStruct** in `annotationProcessorPaths` (or in
   the Gradle `annotationProcessor` declarations).
2. **Add `org.projectlombok:lombok-mapstruct-binding`** — a tiny artifact
   whose only job is to make MapStruct aware that Lombok is present and
   defer until Lombok has finished. It is required from Lombok 1.18.16
   onwards, and without it the ordering alone is not reliable.

That an entire artifact exists to sequence two build-time tools is the
clearest evidence available that Lombok is not playing by the same rules —
[the next chunk](03-lombok-plainly.md) explains why it cannot.

**Which symbols go missing, and why the error is misleading.** MapStruct
resolves a property by looking for accessor *elements* on the type: a
`getName()`/`setName(...)` pair, an `isActive()` for a boolean, a
`name()` accessor on a record, or a builder method when `@Builder` is in
play. When it runs before Lombok, none of the Lombok-generated members
exist in the element model yet, so what MapStruct sees is a class with
fields and no accessors at all. It therefore reports the *target* side
first — "Unknown property `name` in result type `PersonDto`" — because an
unwritable target is a hard error, while an unreadable source usually
surfaces as an unmapped-property warning. That is why the message points
at the DTO when the actual problem is the entity, and why raising
`unmappedTargetPolicy` makes the failure louder but not clearer.

The same ordering explains two neighbouring symptoms: a `@Builder`-based
mapping failing with "no suitable constructor" (Lombok had not written the
builder yet), and a mapper that compiles but produces an implementation
with empty method bodies (MapStruct found the types but nothing to map).

**When the binding is needed, and when it is not.** It is needed whenever
Lombok and MapStruct process the *same* types in the *same* compilation
unit, from Lombok 1.18.16 onwards — that release changed how Lombok
signals completion, and MapStruct cannot detect it without the binding.
It is *not* needed when the two never meet: a multi-module build where the
Lombok-annotated entities are compiled in one module and the mappers in
another sees fully-compiled classes with real accessors by the time
MapStruct runs, so ordering is irrelevant. That module split is a genuine
architectural fix, not just a workaround — it is also what makes the
mapper module's build reproducible without depending on processor
scheduling.

## Spring's own processors

Spring ships two you meet without noticing:

- **`spring-boot-configuration-processor`** reads your
  `@ConfigurationProperties` classes and writes
  `META-INF/spring-configuration-metadata.json`. The file describes each
  property: its full key, its type, its default value, and the Javadoc on
  the field or record component as a description — plus `hints` for
  enumerable values and `deprecation` entries carrying a replacement key
  and a reason. That is what an IDE reads to autocomplete
  `acme.retry.max-attempts` in `application.yml`, to show its type and
  documentation inline, and to strike through a property you deprecated.
  It is `optional` scope in Maven and `annotationProcessor` in Gradle, and
  **its absence produces no error at all** — the application starts and
  binds properties exactly as before. You lose only the editor experience
  and the deprecation signalling, which is precisely why so many projects
  are missing it and nobody notices until someone mistypes a key and gets
  a silent default.
- **`spring-boot-autoconfigure-processor`** generates index metadata so
  autoconfiguration classes can be filtered without loading them, cutting
  startup work.

Spring's AOT engine for native images is the same idea taken much further:
generate ordinary Java source at build time instead of doing reflection at
runtime. Both are covered by **Phase 9 · Spring Boot** *(not written
yet)*.

## Gotchas

**Symptom:** `Unknown property "name" in result type PersonDto` from MapStruct, on a class that clearly has that field via `@Data`
**Cause:** MapStruct ran before Lombok had added the accessors; processor order within a round is unspecified
**Fix:** list Lombok before MapStruct in the processor paths **and** add `org.projectlombok:lombok-mapstruct-binding` — both, not either

**Symptom:** `NullPointerException` from `Mappers.getMapper(PersonMapper.class)` or "Cannot find implementation for …" at runtime
**Cause:** the processor did not run, so `PersonMapperImpl` was never generated — usually the JDK 23 change, a missing `mapstruct-processor` path, or an IDE build that skipped processing
**Fix:** confirm the generated file exists in `target/generated-sources/annotations`; if it is absent, the problem is the build configuration, never the mapper

**Symptom:** a mapper silently maps only some fields
**Cause:** MapStruct's default `unmappedTargetPolicy` is `WARN`, and warnings scroll past in CI
**Fix:** set `unmappedTargetPolicy = ReportingPolicy.ERROR` on the `@Mapper` (or globally via a compiler arg) so a renamed field fails the build

**Symptom:** `application.yml` gives no autocompletion for the project's own `@ConfigurationProperties`
**Cause:** `spring-boot-configuration-processor` is not on the processor path; its absence is not an error
**Fix:** add it as an `optional` dependency (Maven) or `annotationProcessor` (Gradle), and rebuild so the metadata JSON is regenerated

## Interview questions

**★ MapStruct and Lombok in the same module. What breaks, and what is the fix?**
MapStruct reports unknown properties on Lombok-generated accessors, because
processor order within a round is unspecified and MapStruct inspected the
model before Lombok mutated it. The fix has two required parts: order
Lombok before MapStruct in the processor path, and add
`org.projectlombok:lombok-mapstruct-binding`, which exists solely to make
MapStruct defer until Lombok has finished. Ordering alone is not reliable
from Lombok 1.18.16 onward.

**★ Why prefer MapStruct to a reflective mapper such as ModelMapper or Dozer?**
Because the mapping is decided at compile time and emitted as ordinary
code. A reflective mapper resolves field names at runtime, so a renamed or
removed field becomes a silent null on some request path, months later, and
every mapping costs reflection. MapStruct generates
`dto.setName(entity.getName())` — as fast as hand-written code, visible in
a debugger and a diff — and with `unmappedTargetPolicy = ERROR` the same
rename fails the build on the commit that caused it. The cost is another
processor in the build and generated code you must regenerate after model
changes.

**★ Name a processor you use without realising it.**
`spring-boot-configuration-processor`: it reads `@ConfigurationProperties`
classes and emits `META-INF/spring-configuration-metadata.json`, which is
what gives IDE autocompletion and documentation for your own application
properties. It is optional-scope and its absence produces no error at all —
only missing autocompletion — which is why so many projects quietly lack it.
`spring-boot-autoconfigure-processor` is the other, generating index
metadata so autoconfiguration classes can be filtered without being loaded.

**★ Exactly which symbols go missing when MapStruct runs before Lombok, and why does the error name the wrong class?**
Everything Lombok would have generated: the `getX`/`setX` pairs from
`@Data` or `@Getter`/`@Setter`, the all-args constructor from
`@AllArgsConstructor`, and the builder from `@Builder`. MapStruct resolves
properties from accessor *elements*, so it sees a class of bare fields.
It reports the target side first — "Unknown property `name` in result type
`PersonDto`" — because an unwritable target is a hard error while an
unreadable source is only an unmapped-property warning. So the message
names the DTO while the missing accessors are on the entity. Sibling
symptoms from the same cause: "no suitable constructor" on a
`@Builder`-based mapping, and a generated implementation with empty method
bodies.

**★ When is `lombok-mapstruct-binding` required, and when is it genuinely unnecessary?**
Required whenever both processors handle the same types in the same
compilation, from Lombok 1.18.16 onward — that release changed how Lombok
signals it has finished, and MapStruct cannot observe it otherwise;
ordering the processor paths alone is not reliable. Unnecessary when the
two never share a compilation: put the Lombok-annotated entities in one
module and the mappers in another, and the mapper module compiles against
fully-formed classes with real accessors. That is the better answer where
the module boundary is defensible, because it removes the dependency on
processor scheduling entirely rather than patching it.

**★ What does `spring-boot-configuration-processor` produce, and what do you actually lose without it?**
`META-INF/spring-configuration-metadata.json`, describing every
`@ConfigurationProperties` key: full property name, type, default value,
the Javadoc as a description, `hints` for enumerable values, and
`deprecation` entries with a replacement and a reason. Without it nothing
breaks — binding is reflective at runtime and unaffected — you lose IDE
autocompletion and inline documentation for your own properties, and you
lose the ability to signal a deprecated key to the people editing
`application.yml`. It is the archetypal "silent absence" processor: no
error, no warning, just a worse experience nobody attributes to a missing
dependency.

**★ How does `annotationProcessorPaths` help build reproducibility, compared with a processor on the compile classpath?**
On the compile classpath the processor set is whatever `ServiceLoader`
finds, which means it changes when any dependency changes — a new
transitive library that happens to ship a processor starts running in your
build, and a scope change can make one disappear. `annotationProcessorPaths`
declares the set explicitly, so the processors that run and their versions
are stated in the POM rather than derived from resolution. It also pins
the processor version independently of the runtime artifact
(`mapstruct-processor` vs `mapstruct`), keeps processor-internal classes
off the compile classpath so nothing can import them, and is non-transitive
so consumers do not inherit your code generator. It is also the
configuration that survives the JDK 23 change, because supplying a
processor path *is* an explicit enabling of processing.

**★ MapStruct's `componentModel` — what does it change, and why does it matter?**
It decides how the generated implementation is obtained. The default
generates a plain class with a static `INSTANCE` retrieved via
`Mappers.getMapper(...)` — no container, but also no way to inject
collaborators. `componentModel = "spring"` annotates the generated class
as a Spring component with constructor injection, so the mapper is a bean
you can autowire and it can itself depend on other mappers or services;
`jsr330` and `cdi` do the equivalent for those containers. It matters
because a mapper that needs a collaborator — a lookup service to resolve
an ID into an entity — is only expressible once the mapper is a managed
component, and because `Mappers.getMapper` failing at runtime is the
usual symptom of the processor not having run at all.

---

← Prev: [How processors work](01-how-processors-work.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → [Lombok, plainly](03-lombok-plainly.md)
