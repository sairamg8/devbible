---
title: "Path and Files"
sidebar_label: "02 · Path and Files"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.nio.file` (`Path`, `Paths`, `Files`, `StandardCopyOption`,
> `FileVisitOption`, `FileSystem`), the `java.io.File` Javadoc's own
> pointer to the interoperability methods (`File.toPath`), and JEP 400
> for the charset notes. `Files.readString`/`writeString` and the other
> text methods in `Files` have specified UTF-8 as their default since
> they were introduced — they never depended on `file.encoding`.

**`Path` is a value — an immutable sequence of name elements that may or
may not exist on disk. `Files` is the verb set — every static method on
it actually touches the filesystem and reports failure as a typed
`IOException` instead of `File`'s `boolean false`. That split is the
whole modernization: values you can resolve, relativize and compare
without I/O, operations that fail loudly with a reason, and streaming
reads (`Files.lines`, `Files.walk`) that hold an open file handle and
therefore must be closed.**

## Why `File` is read-only legacy

`java.io.File` mixes the value and the verbs in one class, and its
operations (`delete()`, `mkdir()`, `renameTo()`) return `false` on
failure with no reason — no "permission denied" vs "not empty" vs
"doesn't exist". It has no symlink awareness, no metadata access beyond
a few getters, and `renameTo` is fully platform-dependent. Recognize it
at boundaries (old libraries, `Swing` file choosers), convert with
`file.toPath()` / `path.toFile()`, and write new code against
`java.nio.file`.

## `Path` — the value side

```java
Path config = Path.of("conf", "app.yml");      // relative: conf/app.yml
Path abs    = Path.of("/etc/app").resolve("app.yml");  // /etc/app/app.yml
```

- **`resolve`** appends — *unless the argument is absolute, in which
  case it returns the argument unchanged*. That rule is what makes
  user-supplied names dangerous to resolve blindly.
- **`normalize`** collapses `.` and `..` textually — no I/O, no symlink
  resolution. `Path.of("a/../b").normalize()` is `b`.
- **`relativize`** is `resolve`'s inverse: `base.relativize(child)`
  gives the hop from one to the other; both must be relative or both
  absolute.
- **`toRealPath()`** is the only one of these that touches disk — it
  resolves symlinks and fails if the file doesn't exist.
- `Path` implements `Comparable` and equals by *textual* path, not by
  target: `Path.of("a")` ≠ `Path.of("./a")` until you `normalize()`.

**The traversal trap:** serving `baseDir.resolve(userInput)` lets
`../../etc/passwd` walk out of the base. The check is normalize, then
containment:

```java
Path requested = baseDir.resolve(userInput).normalize();
if (!requested.startsWith(baseDir)) throw new SecurityException("outside base");
```

## `Files` — reading and writing

| Need | Call | Notes |
|---|---|---|
| Whole small text file | `Files.readString(path)` | UTF-8 default; throws on malformed bytes |
| Whole small binary | `Files.readAllBytes(path)` | bounded inputs only |
| All lines as a `List` | `Files.readAllLines(path)` | eager — file is closed when it returns |
| Lines lazily | `Files.lines(path)` | **stream over an open file — close it** |
| Write text | `Files.writeString(path, s)` | creates/truncates by default |
| Append | `Files.writeString(path, s, StandardOpenOption.APPEND)` | options vary the verb |
| Buffered classic I/O | `Files.newBufferedReader/Writer(path)` | UTF-8 default |

`readString` vs `lines` is the memory decision: eager methods bound by
file size, streaming methods bound by line size. For the byte/char
split and charset policy underneath these, see
[Streams, buffers and charsets](03-streams-buffers-charsets.md).

## The streams that hold a file open

`Files.lines`, `Files.walk`, `Files.list` and `Files.find` return a
`Stream` backed by an **open directory or file handle**. The stream's
`close()` releases it — and nothing else does until GC finalizes it,
which on a busy service means running out of file descriptors first.
They are the reason `Stream` extends `AutoCloseable`:

```java
try (Stream<String> lines = Files.lines(log)) {
    long errors = lines.filter(l -> l.contains("ERROR")).count();
}
```

Collection-returning methods (`readAllLines`, `readAllBytes`) need no
close — the handle is released before they return. `Files.walk` is
depth-first, does **not** follow symlinks unless you pass
`FileVisitOption.FOLLOW_LINKS`, and throws `UncheckedIOException` from
the stream *during iteration* if a directory becomes unreadable — the
try block must expect failure mid-stream, not just at creation.

## Copy, move and their options

```java
Files.copy(src, dst, StandardCopyOption.REPLACE_EXISTING);
Files.move(src, dst, StandardCopyOption.ATOMIC_MOVE);
```

- Without `REPLACE_EXISTING`, both fail with
  `FileAlreadyExistsException` if the target exists. Copy does not copy
  attributes unless you add `COPY_ATTRIBUTES`.
- **`ATOMIC_MOVE`** is all-or-nothing *within one file store*. Across
  filesystems (different mounts, container volumes) it throws
  `AtomicMoveNotSupportedException`; a plain `move` falls back to
  copy-then-delete there — visibly non-atomic to readers.
- The write-temp-then-atomic-rename pattern — write to a temp file **in
  the same directory** as the target, then `ATOMIC_MOVE` onto it — is
  how you publish a file no reader ever sees half-written. Same
  directory, because same directory guarantees same file store.
- `Files.delete` throws (`NoSuchFileException`,
  `DirectoryNotEmptyException` — with the reason);
  `Files.deleteIfExists` returns a boolean for the one case where
  absence is fine. Deleting a non-empty tree needs a bottom-up walk:
  `Files.walkFileTree` with a visitor, or `walk` + sorted reverse.

## Temp files

```java
Path tmp = Files.createTempFile("upload-", ".bin");
Path dir = Files.createTempDirectory("batch-");
```

Created in `java.io.tmpdir` unless you pass a directory; the name gets
a random component. On POSIX, `Files.createTempFile` creates with
owner-only permissions — unlike the legacy `File.createTempFile`, which
used default permissions and was a CVE-class information leak on shared
`/tmp`. Nothing deletes temp files for you: `File.deleteOnExit()` only
runs on *normal* JVM exit and its registry grows for the JVM's life —
long-running services must delete explicitly (`finally` /
try-with-resources over the operation that uses the file — see
[try-with-resources](../phase-5-exceptions/03-try-with-resources/README.md)).

## Existence checks are advisory

`Files.exists(path)` answers about *that instant*. Check-then-act
(`if (exists) read`) is a TOCTOU race — the file can vanish between the
two calls. The robust shape is to attempt the operation and handle
`NoSuchFileException`; use `exists` for UX decisions, not correctness.
Note also `!Files.exists(p)` ≠ `Files.notExists(p)` — both are false
when the status is *unknown* (permission denied on a parent).

## Gotchas

**Symptom:** service runs fine for days, then every file operation fails with "Too many open files"
**Cause:** `Files.lines`/`Files.list` streams created without try-with-resources — each leaks a file descriptor until GC gets around to it
**Fix:** every `Stream` from `Files` goes in a try-with-resources; only the `readAll*` methods are close-free

**Symptom:** download endpoint serves `/etc/passwd` when asked for `..%2F..%2Fetc%2Fpasswd`
**Cause:** `baseDir.resolve(userName)` happily walks `..` out of the base — and if the decoded input is absolute, `resolve` returns it as-is
**Fix:** `resolve` → `normalize` → `startsWith(baseDir)` check before touching the file

**Symptom:** `Files.move` with `ATOMIC_MOVE` works in dev, throws `AtomicMoveNotSupportedException` in the container
**Cause:** source and target are on different file stores (tmpfs scratch vs mounted volume) — atomic rename only exists within one store
**Fix:** create the temp file in the *target's* directory so the rename never crosses a store; fall back to `REPLACE_EXISTING` copy only where torn reads are acceptable

**Symptom:** `Files.walk` pipeline dies with `UncheckedIOException` halfway through a large tree
**Cause:** a subdirectory became unreadable (permissions, concurrent delete) — `walk` reports I/O failure lazily, during iteration, wrapped unchecked
**Fix:** catch `UncheckedIOException` around the *terminal operation*, or use `walkFileTree` with a `visitFileFailed` override for per-file recovery

**Symptom:** "renaming" a file to overwrite the old version intermittently leaves readers seeing an empty file
**Cause:** plain `Files.move` across file stores degrades to copy-then-delete — readers can open the target mid-copy
**Fix:** write-temp-in-same-directory + `ATOMIC_MOVE`; readers then see either the old or the new file, never a partial one

**Symptom:** disk on a long-running service slowly fills with `upload-*.bin` files
**Cause:** temp files registered with `deleteOnExit()` — the JVM hasn't exited in three months, and the registry also holds heap
**Fix:** delete explicitly when done (`Files.deleteIfExists` in a `finally`), or scope each temp file's life to a try-with-resources over the work

**Symptom:** `Files.delete(dir)` throws `DirectoryNotEmptyException` even though the listing "looked empty"
**Cause:** hidden files, or entries created between the check and the delete — and on some stores, recently-deleted entries not yet flushed
**Fix:** delete bottom-up with `walkFileTree` (delete in `postVisitDirectory`); treat the listing as advisory

**Symptom:** `path1.equals(path2)` is false for what is obviously the same file
**Cause:** `Path` equality is textual per-provider — `./a` vs `a` vs a symlinked spelling differ as values
**Fix:** `normalize()` for textual comparison, `Files.isSameFile(p1, p2)` (does I/O) when symlinks may be involved, `toRealPath()` for a canonical form

**Symptom:** code guarded by `if (!Files.exists(cfg))` still throws `NoSuchFileException` under load
**Cause:** TOCTOU — the file was deleted between the check and the read; `exists` answers only for the instant it ran
**Fix:** attempt the read and handle `NoSuchFileException` as the normal "absent" path; keep `exists` for non-load-bearing decisions

## Interview questions

**★ `Path` vs `File` — what actually changed, beyond "newer API"?**
Separation of value from operation, and honest failure. `Path` is an
immutable value manipulable without I/O (`resolve`, `normalize`,
`relativize`); the operations live on `Files` and throw typed
`IOException`s (`NoSuchFileException`, `DirectoryNotEmptyException`,
`AccessDeniedException`) where `File.delete()` returned `false` with no
reason. Plus symlink awareness, metadata/attribute views, directory
streams, and pluggable filesystems (zip FS, in-memory jimfs for tests).
Bridge methods: `file.toPath()`, `path.toFile()`.

**★ Which `Files` methods return a stream you must close, and why those?**
`Files.lines`, `list`, `walk`, `find` — anything lazy. They hold an
open file or directory handle that only the stream's `close()`
releases; that is why `Stream` extends `AutoCloseable` at all. Eager
methods (`readAllLines`, `readAllBytes`, `readString`) close before
returning. The failure mode for forgetting is file-descriptor
exhaustion on a long-running service, not a quick crash.

**★ How do you overwrite a config file so that no concurrent reader ever sees a partial write?**
Write the new content to a temp file created *in the same directory* as
the target, fsync if the durability requirement demands it, then
`Files.move(tmp, target, ATOMIC_MOVE, REPLACE_EXISTING)`. Same
directory guarantees the same file store, which is the precondition for
atomic rename — across stores you get `AtomicMoveNotSupportedException`
(or, with plain `move`, a silent copy+delete that readers can observe
mid-copy).

**★ A user-supplied filename reaches `baseDir.resolve(name)`. What are the two distinct attacks and the correct guard?**
Relative traversal (`../../etc/shadow` — `resolve` appends, `..`
escapes) and the absolute-path variant (`/etc/shadow` — `resolve`
*returns an absolute argument unchanged*). Guard:
`baseDir.resolve(name).normalize()` then require
`.startsWith(baseDir)`; reject otherwise. `normalize` alone is not the
check — it just makes the textual containment test meaningful.

**★ `Files.exists` returns true — what does that guarantee about the next line of code?**
Nothing. It's a statement about a past instant; the file can be deleted
or replaced before your read (TOCTOU). Correct code attempts the
operation and treats `NoSuchFileException` as the absent case. Also:
`exists` and `notExists` can *both* be false when the status is
undeterminable (unreadable parent), so `!exists` is not `notExists`.

**★ What's different about temp-file creation between `File.createTempFile` and `Files.createTempFile`?**
The NIO version creates POSIX temp files with owner-only permissions
(0600-style) by default; the legacy one used default permissions,
leaving contents readable by other local users on shared `/tmp` — a
recurring vulnerability class. Both leave deletion to you;
`deleteOnExit` only fires on orderly shutdown and accumulates entries
for the JVM's lifetime, so services delete explicitly.

**★ Why does `Files.walk` throw `UncheckedIOException` instead of `IOException`, and when?**
It returns a lazy `Stream`, and stream pipelines' functional interfaces
can't throw checked exceptions — so I/O failures discovered *during
iteration* (unreadable directory, entry deleted mid-walk) surface
wrapped as `UncheckedIOException` from the terminal operation. Only
failures detectable at call time throw plain `IOException`. If you need
per-file failure handling, `walkFileTree`'s `visitFileFailed` is the
finer-grained tool.

---

← Prev: [java.time](01-java-time/README.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [Streams, buffers and charsets](03-streams-buffers-charsets.md)
