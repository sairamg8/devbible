---
title: "The fourth family of flakes is everything the test touches outside the JVM — a path, a port, a table — and all three share one shape: the test assumes it is the only thing in the world, which is true on your laptop and false on a CI agent running four builds at once"
sidebar_label: "14d · Environment"
sidebar_position: 56
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against javadoc for `java.nio.file.DirectoryStream`
> ([DirectoryStream](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/file/DirectoryStream.html))
> and `java.lang.Class`
> ([Class](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Class.html));
> the Spring Framework 7.0.x javadoc for `TestSocketUtils`
> ([TestSocketUtils](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/util/TestSocketUtils.html));
> the JUnit 6.0.3 User Guide — "Built-in Extensions"
> ([writing-tests/built-in-extensions](https://docs.junit.org/6.0.3/writing-tests/built-in-extensions.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**A test that names a path, a port or a row is making a claim about a resource it does not own.
On a laptop, running one build, in one checkout, that claim is true often enough to look like a
rule. On an agent running your build beside three others, it is a lottery.**

This is the entry point for the environment family and it covers the filesystem. The rest:

| Where the resource lives | Chunk |
|---|---|
| Files, paths, fixtures, `@TempDir` | this chunk |
| Ports, sockets, external services, the database | [14h](14h-ports-network-and-the-database.md) |
| Environment variables, system properties, machine locale and clock, CI-versus-laptop, JDK and dependency drift | [14i](14i-process-globals-and-drift.md) |
| Test ordering | [11](11-execution-order.md) – [11d](11d-when-order-is-a-smell.md), and [14](14-flaky-tests.md) |

The framing, the cost of a flake and the state-based family are [14](14-flaky-tests.md).

## The filesystem

### Fixed paths

```java
// 🔴 three separate flakes in one line
Path out = Path.of("/tmp/report.csv");
```

It collides with a concurrent test in the same JVM, with a *different build* on the same agent
running as the same user, and with yesterday's leftover file that makes the test pass without
writing anything. On Windows the path does not exist at all.

`@TempDir` is the whole answer and it is chunk [09](09-tempdir-and-resources.md): one directory
per declaration, isolated per test, cleaned up on a policy you choose
([09b](09b-tempdir-cleanup.md)), with a pluggable factory when you need an in-memory file system
([09c](09c-tempdirfactory-and-autoclose.md)). There is no case where a hardcoded absolute path is
the better option.

### `user.dir` is not a constant

The other half of the same problem is *relative* paths. `new File("src/test/resources/x.json")`
resolves against the JVM's working directory, and the working directory is set by whatever
launched the JVM — your IDE, Maven's Surefire fork, Gradle's test task — each with its own
default and its own configuration parameter for changing it. In a multi-module build the "obvious"
answer differs between the module directory and the repository root.

That is the mechanism behind "it runs in IntelliJ and fails in the build", and it does not
present as a path problem: it presents as `FileNotFoundException` on a file you can see.

**Fix:** resolve test data from the *classpath*, never from a relative file path.

```java
try (InputStream in = getClass().getResourceAsStream("/fixtures/order.json")) {
    // ...
}
```

The javadoc's rule for the leading slash is worth knowing exactly, because getting it wrong
produces a `null` stream and an NPE three lines later:

> *"If the name begins with a `'/'`… then the absolute name of the resource is the portion of the
> name following the `'/'`. Otherwise, the absolute name is of the following form:
> `modified_package_name/name`… where the `modified_package_name` is the package name of this
> object with `'/'` substituted for `'.'`."*

So `Class.getResourceAsStream("order.json")` looks *next to the class*, and
`getResourceAsStream("/fixtures/order.json")` looks at the classpath root. `ClassLoader`'s
equivalent has no such rule — it is always absolute and a leading slash breaks it. Pick one form
per codebase and be consistent.

⚠️ **Never write to a classpath resource.** Reading `target/test-classes/...` is fine; writing to
it means the second run sees the first run's output, which is a flake that "fixes itself" after a
clean build and comes back.

### Case sensitivity and separators

`data.json` and `Data.json` are the same file on a default macOS volume and on Windows, and two
different files on the Linux container your CI runs. A test that reads `Data.json` from a
repository containing `data.json` passes for everyone on a Mac and fails only on CI — and the fix
is a rename that looks like a no-op in `git status` on the machine that cannot see the difference.

Same family: hardcoding `"/"` or `"\\"` in a path string, and comparing an expected path built
with `"/"` against an actual one from `Path.toString()`. Build paths with `Path.of("a", "b")` and
compare `Path` objects, not strings.

### Directory listing order is unspecified

```java
// 🔴 asserts on whichever file the filesystem felt like returning first
Path first = Files.list(dir).findFirst().orElseThrow();
```

`DirectoryStream`, which `Files.list` and `Files.newDirectoryStream` are built on:

> *"The elements returned by the iterator are in no specific order."*

ext4, APFS, NTFS and an overlay filesystem in a container each answer differently, and the same
filesystem can answer differently after files are added and deleted. Sort explicitly if the order
matters; assert order-insensitively if it does not ([02 · AssertJ](../02-assertj/README.md)).

### Line endings

A golden-file test that compares generated text against a committed fixture fails on Windows the
moment git's `core.autocrlf` rewrites the fixture on checkout — and passes again on Linux, so it
looks like a Windows bug in the generator. Normalise before comparing, or commit a
`.gitattributes` that pins the fixture to LF. This is one of the few flakes where the fix is in
version control configuration rather than in code.

## Where the filesystem argument goes next

Ports, sockets and the database are the same mistake with a different resource — a test naming
something the machine shares — and they are [14h](14h-ports-network-and-the-database.md).

## Gotchas

**★ A hardcoded absolute path in a test.**
Collides with concurrent tests, with other builds by the same user on the same agent, and with a
stale file from yesterday that makes the test pass while writing nothing. `@TempDir`
([09](09-tempdir-and-resources.md)) exists for exactly this and has no downside.

**★ A relative path to a test resource.**
It resolves against the JVM working directory, which your IDE, Maven and Gradle each choose
differently, and which differs again in a multi-module build. Load fixtures from the classpath.

**★ Writing into `target/test-classes` or `build/resources`.**
The second run reads the first run's output. It passes after `clean` and then starts failing
again, which is the most misleading signature a flake can have.

**★ `Class.getResourceAsStream("data.json")` when you meant the classpath root.**
Without a leading slash the name is resolved relative to the class's package, so you get `null`
and an NPE that names neither the file nor the reason. With `ClassLoader.getResourceAsStream` the
rule inverts — there a leading slash is what breaks it.

**★ A fixture referenced as `Data.json` when the file is `data.json`.**
Identical on a default macOS volume and on Windows; two different files on Linux. It fails only on
CI, and the fixing commit looks empty to the developer who cannot reproduce it.

**★ Asserting on the first entry of a directory listing.**
`DirectoryStream`'s javadoc says the elements are *"in no specific order."* Sort, or assert
order-insensitively.

**★ Comparing paths as strings.**
`"a/b"` and `"a\\b"` denote the same path and are different strings. Compare `Path` objects.

**★ A golden-file test with no line-ending policy.**
`core.autocrlf` rewrites the committed fixture on a Windows checkout and the comparison fails for
one platform only. Normalise the text or pin the fixture in `.gitattributes`.

## Interview questions

**★ A test reads a fixture file and fails on CI but not locally. What are your hypotheses, in
order?**
First, filename case — a default macOS volume is case-insensitive and the Linux container is not,
so `Data.json` and `data.json` are the same file on one and not the other. Second, the working
directory: if the file is loaded by relative path, the IDE, Maven and Gradle each resolve it
differently and a multi-module build differs again. Third, line endings, if the comparison is
against text. The fix for the first two is the same one: load fixtures from the classpath with an
absolute resource name, so no filesystem layout or working directory is involved.

**★ How do you decide whether a resource belongs in `@TempDir` or on the classpath?**
Direction of data flow. Anything the test *reads* and never modifies is a fixture and belongs on
the classpath, loaded by absolute resource name. Anything the test *writes* belongs in a
`@TempDir`, because a written file is per-test state and needs per-test isolation and cleanup.
The failure mode people hit is writing into the classpath output directory, which makes the
second run see the first run's file.

{/* FOOTER */}
