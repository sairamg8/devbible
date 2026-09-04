---
title: "The default cleanup mode deletes the evidence of the failure you were trying to debug, ON_SUCCESS is the setting that fixes it, and a failed recursive delete turns a passing test red on Windows and nowhere else"
sidebar_label: "09b · @TempDir cleanup"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Built-in Extensions"
> ([built-in-extensions](https://docs.junit.org/6.0.3/writing-tests/built-in-extensions.html))
> and "Release Notes" ([release-notes](https://docs.junit.org/6.0.3/release-notes.html),
> the 6.0.0 Jupiter section); javadoc for `@TempDir`
> ([TempDir](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/io/TempDir.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Creating the directory ([09](09-tempdir-and-resources.md)) is the easy half. Deleting it
is where the surprises live: the default takes your evidence away at exactly the moment you
need it, deletion failures are reported as test failures rather than warnings, and JUnit 6
removed the configuration parameter people used to reach for.**

## Cleanup, and the three modes

> *"By default, when the end of the scope of a temporary directory is reached — when the
> test method or class has finished execution — JUnit will attempt to clean up the
> temporary directory by recursively deleting all files and directories in the temporary
> directory and, finally, the temporary directory itself."*

```java
class CleanupModeDemo {

    @Test
    void fileTest(@TempDir(cleanup = ON_SUCCESS) Path tempDir) {
        // perform test
    }

}
```

> *"The `@TempDir` annotation has an optional `cleanup` attribute that can be set to either
> `NEVER`, `ON_SUCCESS`, or `ALWAYS`. If the cleanup mode is set to `NEVER`, the temporary
> directory will not be deleted after the test completes. If it is set to `ON_SUCCESS`, the
> temporary directory will only be deleted after the test if the test completed
> successfully."*

> *"The default cleanup mode is `ALWAYS`. You can use the
> `junit.jupiter.tempdir.cleanup.mode.default` configuration parameter to override this
> default."*

**`ON_SUCCESS` is the setting worth knowing about**, and almost nobody knows it exists. A
file-processing test that fails leaves you nothing to look at under `ALWAYS`; under
`ON_SUCCESS` the directory survives exactly when you need to inspect it, and is cleaned up
on every green run. It is the debugging affordance that stops people commenting out the
`@TempDir` and hard-coding a path — which is how the fixed-path habit starts.

Two more rules from the javadoc, both of which explain real failures:

> *"Symbolic and other types of links, such as junctions on Windows, are not followed. A
> warning is logged when deleting a link that targets a location outside the temporary
> directory."*

> *"In case deletion of a file or directory fails, an `IOException` will be thrown that
> will cause the test or test class to fail."*

So a test that leaves a file handle open — a `FileChannel`, an unclosed `InputStream`, a
memory-mapped buffer — can **fail during cleanup on Windows**, where an open file cannot be
deleted, while passing on Linux. The assertion succeeded; the test is red; the stack trace
points at machinery the author never wrote. Close your streams
([09c](09c-tempdirfactory-and-autoclose.md) is about making that automatic).

## What JUnit 6 changed

From the 6.0.0 release notes:

> *"The deprecated `junit.jupiter.tempdir.scope` configuration parameter is no longer
> supported."*

That parameter was the old, global way of asking for per-class or per-context sharing; the
supported mechanism is now the placement of the declaration — instance field, `static`
field, or parameter — as described above.

> *"Setting an invalid value for one of the following enum-based configuration parameters
> now causes test discovery or execution to fail: … `junit.jupiter.tempdir.cleanup.mode.default` …"*

A typo in `junit-platform.properties` used to be ignored and now fails the run. This is an
improvement and it will bite exactly once, on the upgrade, in a project whose properties
file has been copied between repositories for years.

## Gotchas

**★ Leaving a stream open and blaming the assertion.**
Cleanup deletes recursively and throws an `IOException` on failure, which fails the test.
On Windows an open handle makes the delete fail, so a test that passed its assertions goes
red in teardown, on one OS only.

**★ Expecting `ALWAYS` to leave you evidence after a failure.**
It does not — that is what `ON_SUCCESS` is for. Set it on the tests whose artefacts you
would want to look at, or globally while debugging.

**★ Assuming symbolic links inside the directory are followed on cleanup.**
They are not, deliberately — a followed link could delete outside the temporary directory.
A link pointing outside logs a warning when the link itself is deleted.

**★ Still setting `junit.jupiter.tempdir.scope`.**
Removed in JUnit 6. The property is now inert; anything relying on it silently changes
behaviour on upgrade.

**★ A typo in `junit.jupiter.tempdir.cleanup.mode.default`.**
On JUnit 6 an invalid enum value fails discovery or execution instead of being ignored.
Good change, sharp edge.
**★ Setting `NEVER` and forgetting.**
Every run leaves a directory behind. On a long-lived CI agent that is a slow disk-space
leak, and locally it is a `/tmp` full of `junit-` directories nobody can attribute. `NEVER`
is for an afternoon, not for a commit.

**★ Assuming `ON_SUCCESS` keeps the directory when a *later* test fails.**
The mode is per declaration and per scope. A method-scoped directory is judged on that
method's outcome; a class-scoped one on the class's. It does not preserve a directory
because some other test in the suite failed.

## Interview questions

**★ What are the cleanup modes and which one would you actually change?**
`ALWAYS` (the default), `ON_SUCCESS` and `NEVER`. `ON_SUCCESS` is the one worth using: the
directory survives a failure so you can inspect what was written, and disappears on every
green run. `NEVER` leaks directories and is for one-off debugging.

**★ A test passes its assertions and fails anyway with an `IOException` from cleanup. What
happened?**
The recursive delete could not remove something — almost always an open file handle on
Windows. The javadoc says the deletion failure throws an `IOException` that causes the test
or class to fail. Close the resource, ideally with try-with-resources or `@AutoClose`.

**★ What changed for `@TempDir` in JUnit 6?**
The deprecated `junit.jupiter.tempdir.scope` configuration parameter is gone, and an
invalid value for `junit.jupiter.tempdir.cleanup.mode.default` now fails the run rather than
being ignored. The annotation itself is unchanged.

{/* FOOTER */}**★ Why does JUnit fail the test when cleanup fails, rather than logging a warning?**
Because a directory that could not be deleted is evidence of a resource the test did not
release, and that resource is going to affect something else — the next test, the next run,
or the CI agent's disk. Making it a failure attributes the leak to the test that caused it,
which is the only moment anybody can fix it cheaply.

{/* FOOTER */}
