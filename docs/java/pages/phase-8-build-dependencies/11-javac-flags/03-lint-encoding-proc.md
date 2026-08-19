---
title: "Diagnostics and how the compiler runs: -encoding, -Xlint, -Werror, -proc, -J"
sidebar_label: "03 · Lint, encoding, proc, -J"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the JDK 25 `javac` tool specification
> (docs.oracle.com/en/java/javase/25/docs/specs/man/javac.html) for
> `-encoding`, `-Xlint` and its category list, `-Werror`, `-proc:none`/`only`/
> `full` and `-J`; JEP 400 (UTF-8 by Default) for the source-encoding default;
> and the Apache Maven Compiler Plugin and Gradle `CompileOptions`
> documentation for `<compilerArgs>`, `<fork>` and `forkOptions`.

**None of these flags changes the bytes in your class file. They change what
the compiler reads, what it tells you, and what process it runs in — so the
only real decisions here are how strict you make the diagnostics and whether
you are honest about what the build is actually doing behind the build tool's
abstraction.**

## `-encoding`, and what JEP 400 actually changed

`-encoding` names the charset of your **source files**. Historically the
default was the platform's charset, so the same source tree compiled
differently on a Windows build agent than on Linux — a `é` in a string
literal became mojibake, or a compile error inside a comment. JEP 400 (JDK 18)
made UTF-8 the default charset for the Java SE APIs on every platform, and
since `javac` uses that default when `-encoding` is absent, source files are
read as UTF-8 by default on JDK 18 and later. The `javac` specification still
words this as "the platform default converter" — on a modern JDK, that
converter *is* UTF-8.

Set it explicitly anyway, because it also silences a long-standing Maven
warning and pins the behaviour for anyone building on an older JDK:

```xml
<properties>
  <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
</properties>
```

If a legacy tree genuinely is not UTF-8, `native.encoding` (JDK 18+) reports
what the platform would have used, and `-encoding` accepts it.

## `-Xlint`, and the honest case against `-Werror`

`-Xlint:all` enables every warning category; a leading hyphen disables one, so
`-Xlint:all,-serial,-processing` is the usual shape. The JDK 25 category list
is long — it includes `unchecked`, `rawtypes`, `deprecation`, `removal`,
`fallthrough`, `finally`, `overrides`, `overloads`, `cast`, `divzero`,
`empty`, `try`, `varargs`, `serial`, `static`, `text-blocks`,
`missing-explicit-ctor`, `lossy-conversions`, `this-escape`, `identity`,
`preview`, `incubating`, `restricted`, `dangling-doc-comments`,
`output-file-clash`, `path`, `options`, `processing`, and the module-related
`exports`, `opens`, `module`, `requires-automatic`,
`requires-transitive-automatic`.

The ones that repay attention on a real codebase:

- **`unchecked` / `rawtypes`** — every unchecked cast is a `ClassCastException`
  deferred to runtime.
- **`removal`** — API scheduled for deletion, as distinct from merely
  deprecated. This is your upgrade backlog, printed for free.
- **`this-escape`** (JDK 21+) — a constructor publishing `this` before the
  object is fully initialised; a genuine source of "impossible" nulls and of
  broken subclass invariants.
- **`fallthrough`, `overrides`, `overloads`** — classic silent logic bugs.
- **`try`** — resources in try-with-resources that are never used.
- **`identity`** — synchronising on or otherwise relying on the identity of a
  value-based class, which is a forward-compatibility hazard.

`-Werror` turns every warning into an error. On a greenfield module it is
excellent: warnings never accumulate, and the count cannot drift. On a large
existing codebase it is worse than it looks, and the argument against it is
not laziness:

1. **New JDKs add categories and deprecate more API.** A build that passed on
   JDK 21 fails on JDK 25 with no code change, which converts every JDK
   upgrade into a cleanup project you did not schedule.
2. **Some warnings are unfixable from where you sit** — a deprecated method
   with no replacement yet, or a warning emitted from a dependency's
   generated source.
3. **The escape hatch is worse than the warning.** Under `-Werror`, pressure
   moves toward blanket `@SuppressWarnings("all")`, which suppresses the next,
   real warning too.

The workable middle: `-Xlint:all` on (so you see everything), `-Werror`
enabled for a named subset of categories or for new modules only, warnings
counted in CI so the number can only go down, and `@SuppressWarnings` used
narrowly with a comment saying why.

## `-proc`, and `-J`

`-proc:none` compiles without running annotation processors; `-proc:only`
runs processors and skips compilation; `-proc:full` does both. There is a JDK
25 default worth knowing: if none of these is specified, annotation processing
runs **only if some other option explicitly configures it** — discovery of a
processor merely present on the classpath no longer silently switches
processing on. `-proc:none` is therefore mostly a diagnostic tool now ("is
Lombok/MapStruct responsible for this?") and a small speed-up for modules that
have no processors. The mechanism itself belongs to **Annotation processing**
*(not written yet)*.

`-J` passes an option to the JVM running `javac` itself — `-J-Xmx2g` when the
compiler runs out of heap on a very large module. Note that build tools do not
generally forward `-J` for you: Maven wants `<fork>true</fork>` with
`<meminitial>`/`<maxmem>`, and Gradle wants
`options.forkOptions.memoryMaximumSize`. Passing `-J` inside `<compilerArgs>`
of a non-forking compiler plugin does nothing useful, which is a confusing
half-hour if you have not met it.

## Gotchas

**Symptom:** an `é` in a string literal is corrupted, but only in artifacts built on one CI agent
**Cause:** that agent runs a pre-18 JDK, where the source encoding default came from the platform locale
**Fix:** set `project.build.sourceEncoding`/`-encoding UTF-8` explicitly; on JDK 18+ UTF-8 is already the default, but the explicit setting is what makes it true everywhere

**Symptom:** `-Xlint:all` produces hundreds of warnings from generated sources nobody wrote
**Cause:** annotation processors emit source that is compiled like any other, and lint applies to it
**Fix:** exclude generated source roots from the strict configuration rather than disabling the category globally — the categories are worth keeping on for hand-written code

**Symptom:** `@SuppressWarnings("unchecked")` on a method does not silence the warning
**Cause:** the warning originates at a different element than the one annotated — often a field initialiser or a nested class — and `@SuppressWarnings` applies only to the annotated declaration and what it encloses
**Fix:** move the annotation to the smallest enclosing declaration that actually contains the offending expression; if that is a whole method, that is a signal the cast is doing more than you thought

**Symptom:** a build that passed on JDK 21 fails on JDK 25 with no source change
**Cause:** `-Werror` plus new or expanded lint categories and newly deprecated API in the newer JDK
**Fix:** decide deliberately — either scope `-Werror` to categories you control, or budget lint cleanup as part of every JDK upgrade; do not "fix" it with a blanket `@SuppressWarnings("all")`

**Symptom:** the build prints "uses unchecked or unsafe operations. Recompile with -Xlint:unchecked" and nothing else — no file, no line
**Cause:** `javac` summarises these categories by default and withholds the per-site detail until the category is explicitly enabled
**Fix:** turn the category on (`-Xlint:unchecked`, `-Xlint:deprecation`) to get file-and-line diagnostics; a summary note is the compiler telling you it has more to say, not that the issue is minor

**Symptom:** Lombok or MapStruct stopped generating code after a JDK upgrade, with no configuration change
**Cause:** modern `javac` does not enable annotation processing merely because a processor is on the classpath
**Fix:** declare processors explicitly via `annotationProcessorPaths` (Maven) or the `annotationProcessor` configuration (Gradle), which is the configuration that turns processing on

**Symptom:** `javac` runs out of heap on a large module and adding `-J-Xmx2g` to the plugin's compiler args changes nothing
**Cause:** without forking, the compiler runs in the build tool's own JVM, so `-J` has nothing to configure
**Fix:** `<fork>true</fork>` with `<maxmem>` in Maven, or `options.forkOptions.memoryMaximumSize` in Gradle — or raise the build JVM's heap instead

## Interview questions

**★ Make the case for and against `-Werror` on a large legacy codebase.**
For: warnings that cannot fail a build accumulate until nobody reads them, so
the count only ever grows; making them fatal is the only mechanism that
reliably holds. Against: new JDKs add lint categories and deprecate more API,
so an unchanged codebase starts failing on upgrade, turning every JDK bump
into unplanned cleanup; some warnings originate in dependencies or generated
code and cannot be fixed locally; and the pressure it creates pushes people
to blanket `@SuppressWarnings`, which then hides the next real warning. The
defensible position is `-Xlint:all` everywhere so nothing is invisible,
`-Werror` scoped to new modules or to categories you control, and a
CI-enforced ratchet on the warning count.

**★ What did JEP 400 change about compiling source files, and what did it not?**
It made UTF-8 the default charset for the Java SE APIs on all platforms from
JDK 18, and since `javac` reads source files with the default charset when
`-encoding` is absent, source is read as UTF-8 by default from that release —
ending the "compiles differently on the Windows agent" class of bug. It did
not change the console streams, and it did not retroactively change files
already written in a platform charset; `native.encoding` still reports what
the platform would have used, for trees that genuinely need it.

**★ When is `-proc:none` the right flag, and what breaks if you set it on a Lombok build?**
It is right as a diagnostic — "is a processor responsible for this generated
class / this odd error?" — and as a small speed-up on modules that genuinely
have no processors. On a Lombok build it is catastrophic in a very specific
way: Lombok *is* an annotation processor, so `-proc:none` means no getters, no
setters, no `@Builder`, no constructors are generated, and the module fails to
compile with hundreds of "cannot find symbol" errors against methods you never
wrote by hand. The errors point at your source rather than at the flag, which
is what makes it confusing. The same applies to MapStruct: the mapper
implementation simply is not generated.

**★ What does `-J` do, and why does adding it to your build tool's compiler args often achieve nothing?**
`-J` passes an option to the JVM running `javac` itself — `-J-Xmx2g` is the
answer when the compiler runs out of heap on a very large module. It achieves
nothing in a build tool that runs the compiler *in-process*, because there is
no separate compiler JVM to configure: Maven's compiler plugin needs
`<fork>true</fork>` with `<maxmem>`, and Gradle needs
`options.forkOptions.memoryMaximumSize`. Otherwise the thing to raise is the
build tool's own heap. It is worth knowing because `-J` in `<compilerArgs>`
fails silently rather than erroring.

**★ Which `-Xlint` categories would you actually turn on, and why those?**
`unchecked` and `rawtypes`, because every unchecked cast is a
`ClassCastException` moved to runtime. `removal`, because it lists API
scheduled for deletion rather than merely deprecated — that is your upgrade
backlog printed for free, and it is the difference between a planned migration
and a broken build on the next JDK. `this-escape` (JDK 21+), because a
constructor publishing `this` before initialisation completes produces
"impossible" nulls and broken subclass invariants. `fallthrough`, `overrides`
and `overloads`, because they are silent logic bugs rather than style. `try`,
for unused try-with-resources resources. And `identity`, for reliance on the
identity of a value-based class, which is a forward-compatibility hazard. The
practical shape is `-Xlint:all` with a short, commented exclusion list rather
than an opt-in list that quietly stops growing.

---

← Prev: [Parameter names and debug info](02-parameters-and-debug-info.md) · Index: [`javac` flags that matter](README.md) · Next → [Toolchains](../12-toolchains.md)
