---
title: "@TempDir exists because a test that writes to a path you chose is a test that fails the moment two of them run at once, and its scope rule — one directory per declaration — is the part that decides whether your tests are isolated or merely appear to be"
sidebar_label: "09 · @TempDir"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Built-in Extensions"
> ([built-in-extensions](https://docs.junit.org/6.0.3/writing-tests/built-in-extensions.html))
> and "Release Notes" ([release-notes](https://docs.junit.org/6.0.3/release-notes.html),
> the 6.0.0 Jupiter section); javadoc for `@TempDir`
> ([TempDir](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/io/TempDir.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Every hard-coded path in a test is a shared mutable global. `/tmp/test-output.csv` is
shared between two tests in the same class, between two classes running in parallel,
between two Maven modules building concurrently, and between today's run and the run that
crashed yesterday and left the file behind. `@TempDir` replaces all of that with a
directory that belongs to exactly one scope and is deleted when that scope ends — and the
scope rule is the part worth learning precisely.**

This chunk is the annotation and its scope. Cleanup modes and the JUnit 6 changes are
[09b · cleanup modes](09b-tempdir-cleanup.md); the factory attribute and the `@AutoClose`
extension are [09c · `TempDirFactory` and `@AutoClose`](09c-tempdirfactory-and-autoclose.md).

## Registration and the two injection styles

> *"The built-in `TempDirectory` extension is used to create and clean up a temporary
> directory for an individual test or all tests in a test class. It is registered by
> default. To use it, annotate a non-final, unassigned field of type `java.nio.file.Path`
> or `java.io.File` with `@TempDir` or add a parameter of type `java.nio.file.Path` or
> `java.io.File` annotated with `@TempDir` to a test class constructor, lifecycle method,
> or test method."*

Nothing to register, nothing to add to the POM. As a parameter:

```java
@Test
void writeItemsToFile(@TempDir Path tempDir) throws IOException {
    Path file = tempDir.resolve("test.txt");

    new ListWriter(file).write("a", "b", "c");

    assertEquals(List.of("a,b,c"), Files.readAllLines(file));
}
```

Two of them, if the test copies between directories:

```java
@Test
void copyFileFromSourceToTarget(@TempDir Path source, @TempDir Path target) throws IOException {
    Path sourceFile = source.resolve("test.txt");
    new ListWriter(sourceFile).write("a", "b", "c");

    Path targetFile = Files.copy(sourceFile, target.resolve("test.txt"));

    assertNotEquals(sourceFile, targetFile);
    assertEquals(List.of("a,b,c"), Files.readAllLines(targetFile));
}
```

Or as a field, when several methods need it:

```java
class SharedTempDirectoryDemo {

    @TempDir
    static Path sharedTempDir;

    @Test
    void writeItemsToFile() throws IOException {
        Path file = sharedTempDir.resolve("test.txt");
        // ...
    }

    @Test
    void anotherTestThatUsesTheSameTempDir() {
        // use sharedTempDir
    }

}
```

`Path` is the better type in every case. `File` is supported for legacy APIs and carries a
restriction the javadoc spells out below.

## The scope rule, which is the whole isolation story

> *"By default, a separate temporary directory is created for every declaration of the
> `@TempDir` annotation."*

**Per declaration** — not per test, not per class. Read the two consequences off that
sentence:

- Two `@TempDir` parameters on the same method are two different directories, which is why
  the copy example above works.
- One `@TempDir` **`static` field** is one declaration, so it is **one directory shared by
  every test method in the class.**

The javadoc says what to do about it:

> *"For better isolation when using `@TestInstance(Lifecycle.PER_METHOD)` semantics, you
> can annotate an instance field or a parameter in the test class constructor with
> `@TempDir` so that each test method uses a separate temporary directory. Alternatively,
> if you want to share a temporary directory across all tests in a test class, you should
> declare the annotation on a `static` field or on a parameter of a `@BeforeAll` method."*

And the guide repeats the warning next to its own shared example: *"For better isolation,
you should use an instance field or constructor injection so that each test method uses a
separate directory."*

The failure this prevents is specific and common: test A writes `report.csv` into the
shared directory, test B asserts on the number of files in it, and B passes or fails
depending on ordering ([11 · execution order](11-execution-order.md)) — a `static`
`@TempDir` reintroduces exactly the shared mutable state the per-method lifecycle removed
([03 · the lifecycle](03-the-lifecycle.md)).

The rule of thumb: **instance field or parameter by default; `static` only when creating
the directory is genuinely expensive or the fixture is genuinely shared, and then say so in
a comment.**

## What is a configuration error

> *"The temporary directory is only created if a field in a test class or a parameter in a
> test class constructor, lifecycle method, or test method is annotated with `@TempDir`. An
> `ExtensionConfigurationException` or a `ParameterResolutionException` will be thrown in
> one of the following cases: If the field type or parameter type is neither `Path` nor
> `File`. If a field is declared as `final`. If the temporary directory cannot be created.
> If the field type or parameter type is `File` and a custom factory is used, which creates
> a temporary directory that does not belong to the default file system."*

Four rules, and three of them bite in ordinary code:

- **`String` is not a supported type.** `@TempDir String dir` is a configuration error, not
  a conversion.
- **`final` fields are rejected.** The natural instinct — `private final Path tempDir;` —
  fails, because the extension assigns the field reflectively after construction.
- **`File` plus a non-default file system is rejected**, which is what stops you injecting
  an in-memory directory into a `java.io.File` that has nowhere to point
  ([09c](09c-tempdirfactory-and-autoclose.md)).

An **unassigned** field is also required by the guide's own wording; initialising it
yourself and expecting the extension to leave it alone is not a supported mode.
## The argument, stated plainly

A test that writes to a path it chose is broken in at least four ways, and `@TempDir` fixes
all four at once:

1. **Two tests collide** — same file, different expectations, order-dependent result.
2. **Two builds collide** — parallel execution ([12](12-parallel-execution.md)), two Maven
   modules, two CI agents on one machine, two developers on a shared box.
3. **Yesterday collides with today** — the run that crashed left the file, and the next run
   asserts against stale content and passes for the wrong reason.
4. **The path does not exist on the next machine** — `/tmp` on Linux, something else on
   Windows, read-only in a hardened container.

There is no version of "use a unique filename" that fixes all four. `@TempDir` does,
because the uniqueness is generated, the lifetime is bounded by the test scope, and the
deletion is the framework's problem rather than the author's.

## Gotchas

**★ A `static @TempDir` field used for isolation.**
It is one declaration, therefore one directory, therefore shared by every test in the
class. Instance field or parameter is the isolated form.

**★ `private final Path tempDir` annotated with `@TempDir`.**
A `final` field is a documented configuration error — the extension has to assign it. Drop
the `final`.

**★ `@TempDir String path`.**
Only `Path` and `File` are supported. Anything else is an `ExtensionConfigurationException`
at run time, not a compile error.

**★ Sharing a `@TempDir` between a `@BeforeAll` and the tests without meaning to.**
A parameter on `@BeforeAll` is a class-scoped declaration by design. That is the documented
way to share; just be sure sharing is what you wanted.

**★ Using `@TempDir` and then writing to `System.getProperty("java.io.tmpdir")` anyway.**
Helper code deep in the production path often ignores the directory the test was given.
The test looks isolated and is not; assert on the injected directory's contents and the
mismatch shows up immediately.
## Interview questions

**★ How many directories does `@TempDir` create for a class with three test methods and one
`static @TempDir` field?**
One. The rule is one directory per *declaration* of the annotation, and a `static` field is
a single declaration whose scope is the class. Three instance fields, or a parameter on
each of the three methods, would give three directories — one per test.

**★ Which types can `@TempDir` inject, and where?**
`java.nio.file.Path` and `java.io.File`, into a non-final, unassigned field or into a
parameter of a test class constructor, a lifecycle method or a test method. Any other type,
or a `final` field, is a configuration error.

**★ Why is a hard-coded temporary path a bug even when the test passes today?**
Because it is shared mutable state across every axis that can vary: two tests, two threads,
two modules, two runs. It gives order-dependent results under parallel execution and stale
results after a crashed run, and it assumes a filesystem layout the next machine may not
have.

{/* FOOTER */}
