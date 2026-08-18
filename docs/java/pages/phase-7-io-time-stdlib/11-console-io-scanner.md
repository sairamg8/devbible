---
title: "Console I/O and Scanner"
sidebar_label: "11 · Console I/O and Scanner"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Scanner`, `Console`
> (availability and `isTerminal` notes, `readPassword`), `System`
> (`in`/`out`/`err`, `console()`) and `PrintStream` (error-state and
> autoflush behavior), and the JDK 22 release notes (the `System.console()`
> redirection behavior change and `Console.isTerminal()`).

**`Scanner` and `System.out` are learning-Java tools that quietly encode
three production lessons: a tokenizer that mixes token reads with line reads
will desynchronize (`nextInt` → `nextLine` returns `""`); anything that
parses numbers without naming a locale inherits the host's; and a service
has no human at stdin — its "console input" is configuration, and its
"console output" is a log stream. Know the APIs, know their traps, and know
why none of this appears in a request path.**

## The three standard streams

- `System.in` — an `InputStream` of raw bytes, connected to the terminal,
  a pipe, or nothing at all (a container with no TTY).
- `System.out` / `System.err` — `PrintStream`s. `out` is for output, `err`
  for diagnostics, and keeping them separate is what lets
  `myTool > data.csv` work while errors still reach the screen — the same
  distinction [`ProcessBuilder`](10-processbuilder.md) exposes from the
  parent's side.
- **`PrintStream` never throws.** Every other stream reports failure with
  `IOException`; `PrintStream` swallows it and sets an internal flag you can
  poll with `checkError()`. A full disk under `System.out` is silent data
  loss unless something checks.
- Since JDK 18 the JVM default charset is UTF-8, but `System.out`/`err`
  encode with the *console's* encoding when attached to a terminal
  (`stdout.encoding`) — the byte-vs-char rules are
  [topic 03's](03-streams-buffers-charsets.md).
- `println` on `System.out` flushes (it is constructed with autoflush);
  a `PrintStream` you build yourself defaults to *no* autoflush.

## `Scanner` — a tokenizer, not a line reader

`Scanner` splits input into **tokens** separated by a delimiter (default:
any whitespace, newlines included) and converts them:

```java
Scanner sc = new Scanner(System.in);        // charset overloads since JDK 10
int n      = sc.nextInt();                  // reads ONE token — not the line
String s   = sc.next();                     // next whitespace-free token
String ln  = sc.nextLine();                 // rest of the CURRENT line
```

The model explains every classic surprise:

- **`nextInt()` then `nextLine()` returns `""`.** `nextInt` consumed the
  token `42` but *not* the newline after it; `nextLine` reads to that
  newline — zero characters away. Fix: `sc.nextLine()` once to discard the
  tail, or read whole lines and parse (`Integer.parseInt(sc.nextLine())`).
- **`hasNextInt()`/`nextInt()` block** until a token or EOF arrives —
  "hangs" at startup usually means nothing was piped in.
- **EOF throws.** At end of input (Ctrl+D on Unix, Ctrl+Z on Windows, or an
  empty redirected stdin) `next*` throws `NoSuchElementException` — the
  loop guard is `while (sc.hasNextLine())`, not try/catch.
- **Wrong token type throws `InputMismatchException`** and *leaves the token
  unconsumed* — a retry loop that doesn't call `next()` to discard it spins
  forever on the same bad token.
- **Number parsing is locale-sensitive.** `nextDouble()` uses the default
  locale's decimal separator — `3.14` is a mismatch on a comma-decimal
  host, and `1.234` may parse as a grouped thousand
  ([topic 09](09-localization-basics.md)). `sc.useLocale(Locale.ROOT)` for
  machine input.
- **Not thread-safe** — the Javadoc says so outright; a `Scanner` is
  single-consumer state.
- **Closing a `Scanner` closes its source.** `try (var sc = new
  Scanner(System.in))` closes `System.in` *for the whole JVM* — nothing can
  read stdin afterwards. Deliberately leak the scanner over `System.in`, or
  close it only at true end-of-program.

For plain line input, `BufferedReader` is the smaller, faster tool with one
honest failure mode:

```java
BufferedReader in = new BufferedReader(new InputStreamReader(System.in, UTF_8));
String line;                                 // null at EOF — no exception
while ((line = in.readLine()) != null) { ... }
```

`Scanner` earns its keep only when its regex tooling does —
`useDelimiter(...)`, `findAll(pattern)` — otherwise read lines and parse
explicitly.

## `Console` — the terminal, when there is one

```java
Console cons = System.console();
if (cons != null && cons.isTerminal()) {         // JDK 22+: the honest check
    char[] pw = cons.readPassword("Token for %s: ", host);
    try { use(pw); } finally { Arrays.fill(pw, ' '); }
}
```

- `System.console()` reflects how the JVM was launched: run from an
  interactive shell there is a console; under an IDE run-window, a
  redirected pipe or a background scheduler there historically is **not**
  (`null`). The JDK 25 Javadoc still describes availability exactly that
  way.
- ⚠️ **The null-check idiom wobbled in JDK 22**: with JLine as the default
  provider, `System.console()` began returning a `Console` object even when
  streams were redirected (documented in the JDK 22 release notes, with
  `-Djdk.console=java.base` to restore the old behavior), and
  `Console.isTerminal()` was added as the explicit test. Later releases
  stepped back from the JLine default, but the portable check across
  22 → 25 remains `cons != null && cons.isTerminal()`.
- `readPassword` disables echo and returns `char[]`, not `String` — you can
  zero a char array the moment you're done; an interned/pooled `String`
  copy of a secret lives until GC decides otherwise.
- Interactive prompts belong to CLI tools. In a service image there is no
  terminal: `readPassword` from a Dockerfile-launched process is a `null`
  console and an NPE waiting.

## Why none of this is in a service

A service is started by an orchestrator, not a person: stdin is typically
empty or closed, so a `Scanner` blocks forever or throws
`NoSuchElementException` on the first read. Input arrives as **environment
variables, args, config files and secrets mounts** (Phase 9's
externalized-configuration story — **Spring Boot** *(not written yet)*),
and output goes to **stdout as structured log lines** for the platform to
collect. `Scanner(System.in)` in server code is a smell with exactly one
meaning: an exercise pattern escaped into production.

## Gotchas

**Symptom:** `nextLine()` after `nextInt()` returns an empty string
**Cause:** `nextInt` consumes the number token, not the trailing newline; `nextLine` reads up to that newline immediately
**Fix:** discard the tail with an extra `nextLine()`, or standardize on reading lines and parsing them

**Symptom:** input loop works locally, `NoSuchElementException` at startup in CI or a container
**Cause:** stdin is empty/redirected there — EOF on the first `next*` call
**Fix:** guard with `hasNextLine()`; better, don't read stdin in non-interactive programs at all

**Symptom:** retry-on-bad-input loop spins forever printing the error prompt
**Cause:** `InputMismatchException` leaves the offending token in the stream; the loop re-reads the same token
**Fix:** consume it with `sc.next()` in the catch/else branch before retrying

**Symptom:** `nextDouble()` rejects `3.14` (or silently misreads `1.234`) on some hosts
**Cause:** `Scanner`'s number parsing follows the default locale's separators
**Fix:** `sc.useLocale(Locale.ROOT)` for machine-format input, or parse lines with `Double.parseDouble`

**Symptom:** after one method finishes, every later stdin read in the program fails with `IllegalStateException`/EOF
**Cause:** a try-with-resources `Scanner(System.in)` closed `System.in` for the whole JVM
**Fix:** never auto-close a scanner over `System.in`; scope try-with-resources to streams you own ([try-with-resources](../phase-5-exceptions/03-try-with-resources/README.md))

**Symptom:** `NullPointerException` at `System.console().readPassword()` in the IDE, fine in a terminal
**Cause:** no interactive console under the IDE's run window (streams are pipes), so `console()` is `null`
**Fix:** check `cons != null && cons.isTerminal()`; fall back to `Scanner`/args for dev, knowing echo stays on

**Symptom:** tool "succeeds" but its redirected output file is truncated; no exception anywhere
**Cause:** `PrintStream` swallows `IOException` (disk full, closed pipe) and only sets an internal flag
**Fix:** poll `System.out.checkError()` at exit for CLI tools that pipe data; real data paths use streams that throw

## Interview questions

**★ Why does `nextLine()` "skip" after `nextInt()`, and what does it reveal about Scanner's model?**
`Scanner` is a token stream, not a line stream: `nextInt` takes one token and leaves the line's newline unread, so the next `nextLine` completes the *current* line — instantly and emptily. Mixing token reads and line reads means managing that seam yourself; reading only lines and parsing avoids it.

**★ When would you pick `Scanner` over `BufferedReader`, and the reverse?**
`Scanner` when the input genuinely needs tokenizing or regex scanning (`useDelimiter`, `findAll`, typed `hasNextX` probes). `BufferedReader` for line-oriented input: less state, faster, and EOF is a clean `null` instead of an exception. For anything performance-adjacent or concurrent, `Scanner` is out — it's synchronizing-free, mutable, single-consumer.

**★ `System.console()` returns null — when, and what changed in JDK 22?**
Historically: whenever the JVM lacks an interactive terminal — redirected streams, IDE run windows, background launch. JDK 22 shipped JLine as the default provider and began returning a `Console` even under redirection (release-noted; `-Djdk.console=java.base` opted out), breaking the null-check idiom — `Console.isTerminal()` was added as the real test. The robust cross-version check is `cons != null && cons.isTerminal()`.

**★ Why does `readPassword` return `char[]` rather than `String`?**
So the caller can zero it (`Arrays.fill`) immediately after use. A `String` is immutable and lives until collected — its bytes can sit in heap dumps and swapped pages indefinitely. It also disables echo, which no `Scanner`-based read does.

**★ Why is reading configuration from stdin an anti-pattern in services?**
There's no operator: stdin under an orchestrator is empty or closed, so reads block or throw; restarts and replicas can't retype anything; and secrets on stdin bypass the platform's config/secret machinery (env, mounted files) that supports rotation and audit. Interactive input is a CLI concern only.

**★ What does `System.out.println` do when the disk is full?**
Nothing visible — `PrintStream` catches the `IOException` and sets an error flag readable via `checkError()`. That design keeps casual printing exception-free but makes `System.out` unsuitable as a data channel unless the flag is checked; it's also why logging frameworks manage their own streams.

**★ Is `Scanner` thread-safe? What about `System.out`?**
`Scanner` — no, documented as unsafe without external synchronization; its buffer and position are mutable state. `PrintStream` — individual method calls are internally synchronized, so lines from two threads won't interleave *within* a call, but ordering between calls is still scheduling luck.

**★ A grader pipes a file to your program; it worked when you typed input manually but now throws. Most likely causes?**
EOF semantics (typed sessions never hit EOF mid-protocol; a file does — missing `hasNext` guards), a trailing-newline difference on the last line, or a locale/charset mismatch between the file and the scanner. All three are the same lesson: piped input exercises boundaries interactive input hides.

---

← Prev: [ProcessBuilder](10-processbuilder.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [NIO channels and selectors](12-nio-channels-selectors.md)
