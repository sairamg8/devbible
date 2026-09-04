---
title: "The factory attribute of @TempDir is how a temporary directory ends up on an in-memory file system or named after the test, and its contract forbids exactly the assumptions a factory author is tempted to make"
sidebar_label: "09c · TempDirFactory"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Built-in Extensions"
> ([built-in-extensions](https://docs.junit.org/6.0.3/writing-tests/built-in-extensions.html));
> javadoc for `@TempDir`
> ([TempDir](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/io/TempDir.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Jupiter ships exactly two user-facing extensions that are registered by default:
`TempDirectory` and `AutoCloseExtension`. [09](09-tempdir-and-resources.md) and
[09b](09b-tempdir-cleanup.md) covered the first one's ordinary use. This chunk is the
`factory` attribute — which is how a temporary directory ends up in RAM instead of on a
disk. The second built-in extension, `@AutoClose`, is
[09d · `@AutoClose`](09d-autoclose.md).**

## `TempDirFactory`

> *"`@TempDir` supports the programmatic creation of temporary directories via the optional
> `factory` attribute. This is typically used to gain control over the temporary directory
> creation, like defining the parent directory or the file system that should be used."*

The contract on implementations is precise, and each clause is there to stop an assumption:

> *"Factories can be created by implementing `TempDirFactory`. Implementations must provide
> a no-args constructor and should not make any assumptions regarding when and how many
> times they are instantiated, but they can assume that their `createTempDirectory(…)` and
> `close()` methods will both be called once per instance, in this order, and from the same
> thread."*

The default:

> *"The default implementation available in Jupiter delegates directory creation to
> `java.nio.file.Files::createTempDirectory` which uses the default file system and the
> system's temporary directory as the parent directory. It passes `junit-` as the prefix
> string of the generated directory name to help identify it as a created by JUnit."*

That prefix is worth remembering — when a build agent's `/tmp` is full of `junit-*`
directories, some test is running with `cleanup = NEVER` ([09b](09b-tempdir-cleanup.md)) or
crashing the JVM before cleanup.

**A factory that names the directory after the test:**

```java
class TempDirFactoryDemo {

    @Test
    void factoryTest(@TempDir(factory = Factory.class) Path tempDir) {
        assertTrue(tempDir.getFileName().toString().startsWith("factoryTest"));
    }

    static class Factory implements TempDirFactory {

        @Override
        public Path createTempDirectory(AnnotatedElementContext elementContext,
                ExtensionContext extensionContext) throws IOException {
            return Files.createTempDirectory(extensionContext.getRequiredTestMethod().getName());
        }

    }

}
```

**A factory on an in-memory file system**, which is the reason most people go looking for
this attribute — no disk I/O at all, and no possibility of leaving anything behind:

```java
class InMemoryTempDirDemo {

    @Test
    void test(@TempDir(factory = JimfsTempDirFactory.class) Path tempDir) {
        // perform test
    }

    static class JimfsTempDirFactory implements TempDirFactory {

        private final FileSystem fileSystem = Jimfs.newFileSystem(Configuration.unix());

        @Override
        public Path createTempDirectory(AnnotatedElementContext elementContext,
                ExtensionContext extensionContext) throws IOException {
            return Files.createTempDirectory(fileSystem.getPath("/"), "junit-");
        }

        @Override
        public void close() throws IOException {
            fileSystem.close();
        }

    }

}
```

⚠️ **An in-memory directory only works with `Path`.** The `@TempDir` javadoc lists as a
configuration error the case *"If the field type or parameter type is `File` and a custom
factory is used, which creates a temporary directory that does not belong to the default
file system"* — a `java.io.File` is a path on the real filesystem and cannot address a Jimfs
entry. Production code that takes `File` rather than `Path` cannot be tested this way, which
is one more reason for `Path` in your own signatures.

## Hiding the factory behind a meta-annotation

> *"`@TempDir` can also be used as a meta-annotation to reduce repetition."*

```java
@Target({ ElementType.ANNOTATION_TYPE, ElementType.FIELD, ElementType.PARAMETER })
@Retention(RetentionPolicy.RUNTIME)
@TempDir(factory = JimfsTempDirFactory.class)
@interface JimfsTempDir {
}

class JimfsTempDirAnnotationDemo {

    @Test
    void test(@JimfsTempDir Path tempDir) {
        // perform test
    }

}
```

The factory can also read configuration off the annotations at the injection point:

> *"Meta-annotations or additional annotations on the field or parameter the `TempDir`
> annotation is declared on might expose additional attributes to configure the factory.
> Such annotations and related attributes can be accessed via the `AnnotatedElementContext`
> parameter of the `createTempDirectory(…)` method."*

And there is a project-wide default with a stated precedence order:

> *"In summary, the factory for a temporary directory is determined according to the
> following precedence rules: The `factory` attribute of the `@TempDir` annotation, if
> present. The default `TempDirFactory` configured via the configuration parameter, if
> present. Otherwise, `org.junit.jupiter.api.io.TempDirFactory$Standard` will be used."*

```properties
# src/test/resources/junit-platform.properties
junit.jupiter.tempdir.factory.default = com.example.testing.JimfsTempDirFactory
```

⚠️ Note the `$` in `TempDirFactory$Standard` — the same binary-name trap as the display-name
generators ([06](06-naming-and-display-names.md)). A dot does not resolve.

## Gotchas

**★ `@TempDir(factory = …)` on a `File` parameter with an in-memory file system.**
A documented configuration error: a `File` cannot point into a non-default file system.
Use `Path`.

**★ A `TempDirFactory` that holds state across instantiations.**
The contract says implementations must not assume when or how many times they are
instantiated. A `static` cache inside a factory is the one thing the documentation warns
against.

**★ Writing `TempDirFactory.Standard` in a properties file.**
It is a nested class; the configuration parameter needs the binary name
`org.junit.jupiter.api.io.TempDirFactory$Standard`.

**★ Setting `junit.jupiter.tempdir.factory.default` and expecting `@TempDir(factory = …)`
to lose.**
Precedence runs annotation attribute, then configured default, then `Standard`. The
annotation always wins, which is what you want and the opposite of what a "default"
sometimes implies.

**★ Reaching for a custom factory when the real problem is disk speed.**
An in-memory file system is a legitimate optimisation, but a test suite dominated by
filesystem time usually has a design problem — code that takes a `Path` when it could take
a stream, or an integration test where a unit test would do.
## Interview questions

**★ What does the `factory` attribute of `@TempDir` let you change?**
Where and how the directory is created: the parent directory, the naming, and the file
system. The stock implementation calls `Files.createTempDirectory` with the prefix `junit-`
on the default file system; a custom `TempDirFactory` can put the directory on an in-memory
file system such as Jimfs, or name it after the test method.

**★ What may a `TempDirFactory` implementation assume?**
Only that `createTempDirectory(…)` and `close()` are each called once per instance, in that
order, on the same thread. It must have a no-args constructor and must not assume anything
about when or how many times it is instantiated.

**★ Which type can and cannot be injected from a custom in-memory factory, and why?**
`Path` can; `File` cannot. A `java.io.File` names a location on the default file system, so
injecting one that points into a non-default file system is a documented configuration
error.

{/* FOOTER */}
