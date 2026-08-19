---
title: "Lombok, plainly"
sidebar_label: "03 · Lombok, plainly"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against projectlombok.org's feature documentation,
> configuration reference (`lombok.config`,
> `lombok.addLombokGeneratedAnnotation`) and changelog (JDK support
> history; the 1.18.4x line carries the JDK 25 fixes), the JDK 25 `javac`
> reference for `--add-opens`/`-J` flag handling and JEP 396/403 (strong
> encapsulation of JDK internals), the JDK 25 language specification for
> records, and the `delombok` documentation.

**Lombok registers as an annotation processor and then does the one thing
the processor API forbids: it mutates the compiler's own syntax tree,
inserting members into the class you wrote. There is no generated file to
read. Every benefit and every complaint about Lombok — the boilerplate it
removes, the JDK upgrades it blocks, the IDE plugin it demands — is
downstream of that single decision, and records have since taken over a
large part of what it was for.**

## What Lombok actually does

Lombok registers as an annotation processor and then does something the
API does not permit: it obtains the compiler's internal `JCTree` and
**mutates the syntax tree in place**, inserting getters, setters,
constructors, `equals`, `hashCode`, `toString` and builders into the class
you wrote. There is no generated file to read. The class in
`target/classes` has members that appear nowhere in `src/`.

Everything awkward about Lombok is downstream of that:

- **It depends on `jdk.compiler` internals.** Since JDK 16 those packages
  are strongly encapsulated, so Lombok needs `--add-opens`-style access to
  `com.sun.tools.javac.*` — which is why builds sometimes carry a wall of
  `-J--add-opens=jdk.compiler/...` flags, and why the plain `javac`
  invocation in a Dockerfile behaves differently from Maven's.
- **Every new JDK can break it, and often does.** A change to the compiler's
  internal tree representation is not a breaking change for anyone using
  the public API, and it is a total outage for Lombok. The pattern each
  year is the same: the JDK ships, Lombok is broken, an edge release fixes
  it. JDK 25 was no exception — builds needed a Lombok release from the
  1.18.4x line. **Never treat "we upgrade the JDK" as independent of "we
  upgrade Lombok".**
- **IDEs need a plugin.** IntelliJ and Eclipse do not run `javac`; they
  have their own compilers and element models, so a Lombok-generated getter
  does not exist as far as the IDE is concerned until a Lombok plugin
  reproduces the same mutation. Every "the IDE shows an error but the build
  passes" report about Lombok is this.
- **Other tools that read the AST or the element model can disagree** —
  other annotation processors (see MapStruct above), error-prone-style
  checkers, coverage tools reporting generated branches, and static
  analysis complaining about code nobody wrote.
- **`delombok` exists as the escape hatch.** It writes out the expanded
  source, which is how you leave Lombok, feed a tool that cannot cope, or
  simply see what it actually generated.

### The honest trade-off

The upside is real and should not be waved away: a JPA entity or a
configuration holder with fifteen fields loses a hundred lines of
mechanical, never-read, occasionally-wrong accessor code, and `@Builder`
and `@Slf4j` remove genuine ceremony. On a large codebase that is a
meaningful reduction in noise.

The cost is a compile-time dependency on unsupported compiler internals in
the critical path of every build in the organisation. You are accepting
that a JDK upgrade can block you until a third party ships a release. That
is a defensible trade for an internal service on a slow JDK cadence; it is
a much harder trade for a published library, which pushes the same
constraint onto everybody who builds from source.

The practical middle ground most teams land on: use records for immutable
carriers, keep Lombok for the mutable JPA/entity layer and `@Slf4j`, and
never put it in a public API artifact.

### `@Data` on a JPA entity is a specific hazard

`@Data` generates `equals`, `hashCode` and `toString` over **all** fields,
which is wrong for an entity in three separate ways:

- **`hashCode` over mutable fields.** An entity put in a `HashSet` before
  it is persisted changes hash when the generated ID is assigned, and is
  then unfindable in the set it is in — the exact failure described in
  [equals and hashCode · where it breaks in production](../../phase-2-classes-objects/06-equals-hashcode/03-where-it-breaks-in-production.md).
- **`toString` over associations.** A `@OneToMany` back-reference makes
  `toString` recurse (`StackOverflowError`), or triggers lazy loading of
  the whole graph the moment something logs the entity.
- **`equals` over all fields** contradicts the entity contract, where
  identity is the primary key and nothing else.

`@EqualsAndHashCode(onlyExplicitlyIncluded = true)` plus
`@ToString(exclude = ...)` patches it. The deeper point is that `@Data`
generates the *default* answer to a question — [what does equality mean for
this type](../../phase-2-classes-objects/06-equals-hashcode/README.md) — that
entities must answer differently. **Phase 10 · Data access with JPA**
*(not written yet)* takes it further.

## Records ate a large part of the use case

For an immutable data carrier, a record does natively what half of Lombok
was for:

| Lombok | Record equivalent |
|---|---|
| `@Getter` | accessor methods, generated |
| `@AllArgsConstructor` | the canonical constructor |
| `@EqualsAndHashCode` | value-based `equals`/`hashCode` |
| `@ToString` | generated `toString` |
| `@Value` | the record itself |

A record is a language feature: no processor, no compiler internals, no
IDE plugin, no JDK-upgrade coupling, and every tool in the ecosystem
already understands it. Where a record fits, it is strictly better. See
[records](../../phase-2-classes-objects/08-records/README.md).

What records did **not** replace:

- **`@Builder`.** Records have no builder, and a canonical constructor with
  twelve parameters is exactly the problem builders exist to solve.
- **`@Slf4j` / `@Log`.** Nothing in the language declares a logger field.
- **Mutable types.** JPA entities need a no-arg constructor and setters;
  records are final and their components are final. Frameworks that
  populate objects by mutation cannot use them.
- **Inheritance.** Records cannot extend a class, so a shared abstract base
  rules them out.
- **`@SneakyThrows`, `@Cleanup`, `@With`, `@NonNull` parameter checks** —
  small conveniences with no language equivalent.

The realistic split: records for DTOs, API payloads, value objects and
anything crossing a boundary; Lombok, if you keep it, for the mutable
persistence layer and logging.

## Gotchas

**Symptom:** the build breaks on the day you upgrade the JDK, with an error from inside `com.sun.tools.javac`
**Cause:** Lombok mutates compiler-internal AST classes; a JDK release changed them
**Fix:** upgrade Lombok to the release that supports that JDK, and from then on treat JDK and Lombok versions as a single upgrade unit — pin both, bump both

**Symptom:** IntelliJ flags `getName()` as unresolved on a `@Data` class that compiles fine from Maven
**Cause:** the IDE uses its own compiler and never runs Lombok's AST mutation; the members do not exist in its model
**Fix:** install the Lombok plugin and enable annotation processing in the IDE — and recognise the class of problem: any tool that does not run `javac` sees the un-Lombok'd class

**Symptom:** Hibernate fails to instantiate an entity, or Jackson cannot deserialise a DTO, after `@Builder` was added
**Cause:** `@Builder` generates an all-args constructor and, in doing so, suppresses the implicit no-arg constructor those frameworks require
**Fix:** add `@NoArgsConstructor` and `@AllArgsConstructor` alongside `@Builder` — and note that this is the shape records cannot take, which is why entities stay non-records

**Symptom:** a warning on every subclass: "Generating equals/hashCode implementation but without a call to superclass"
**Cause:** Lombok's `@EqualsAndHashCode` defaults to `callSuper = false`, which is almost never right when a superclass has state
**Fix:** set `callSuper` explicitly on every such class — or accept that equality across an inheritance hierarchy is a design decision Lombok should not be making for you

**Symptom:** the coverage report shows uncovered branches in classes whose source contains no branches
**Cause:** Lombok-generated `equals`, `hashCode` and builder methods are real bytecode attributed to your class's lines
**Fix:** put `lombok.addLombokGeneratedAnnotation = true` in `lombok.config`; JaCoCo and similar tools filter methods annotated `@lombok.Generated`

## Interview questions

**★ Why is Lombok not "just another annotation processor"?**
Because the processor API cannot modify existing classes, and modifying
existing classes is exactly what Lombok does. It registers as a processor
and then reaches into `com.sun.tools.javac` internals to mutate the
compiler's syntax tree, inserting members into the class you wrote. There
is no generated source file. Every consequence follows: it needs
`--add-opens`-style access to `jdk.compiler` since JDK 16, it breaks on new
JDK releases until a matching Lombok ships, IDEs need a plugin because they
do not run `javac`, and other processors can run before it and not see the
members it will add.

**★ Give the honest case for and against Lombok on a new service.**
For: it removes a large volume of mechanical accessor, constructor,
`equals`/`hashCode` and `toString` code, and `@Builder` and `@Slf4j` remove
real ceremony — on a big codebase, a genuine readability win. Against: it
puts a dependency on unsupported compiler internals in the critical path of
every build, so a JDK upgrade can be blocked by a third party's release
schedule, and every tool that reads source rather than running `javac`
needs its own support. My split: records for immutable carriers, Lombok
confined to the mutable persistence layer and logging, never in a published
library artifact.

**★ Why is `@Data` a bad default on a JPA entity?**
It generates `equals`, `hashCode` and `toString` over all fields.
`hashCode` over mutable fields means an entity added to a `HashSet` before
persisting becomes unfindable once the ID is assigned; `toString` over a
bidirectional association either recurses into `StackOverflowError` or
force-loads a lazy graph the first time something logs it; and `equals` over
all fields contradicts the entity contract, where identity is the primary
key. Use `@EqualsAndHashCode(onlyExplicitlyIncluded = true)` and exclude
associations from `@ToString` — or write the two methods, since for an
entity they are three lines and a decision.

**★ Records replaced part of Lombok. Which part, and what is left?**
Records cover the immutable-carrier case natively: accessors, canonical
constructor, value-based `equals`/`hashCode`, `toString` — everything
`@Value` did, with no processor, no compiler internals, no IDE plugin, and
universal tool support. What they do not cover: builders (a twelve-parameter
canonical constructor is precisely the problem `@Builder` solves), `@Slf4j`,
mutable types such as JPA entities that need a no-arg constructor and
setters, inheritance from a shared base class, and small conveniences like
`@SneakyThrows` and `@With`.

---

← Prev: [MapStruct and Spring's processors](02-mapstruct-and-spring.md) · Index: [Phase 8 — The build: Maven, Gradle and dependencies](../README.md) · Next → **Artifact repositories** *(not written yet)*
