---
title: "The @Generated rule: JaCoCo skips anything annotated with an annotation simply named Generated — but only if it survives compilation, which jakarta.annotation.Generated does not, and which Lombok does not add unless you turn it on"
sidebar_label: "05b · The @Generated rule"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/changes.html` — which is where the filter
> list lives, since ⚠️ **there is no `doc/filtering.html`** (both `jacoco.org` and `eclemma.org`
> return 404 for it). Retention verified against the **Jakarta Annotations 3.0** javadoc for
> `jakarta.annotation.Generated`, and against **Project Lombok**'s configuration documentation
> for `lombok.addLombokGeneratedAnnotation`. Version spine from `spring-boot-dependencies:4.1.0`:
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — documented behaviour and configuration only.

**"JaCoCo ignores generated code" is one of those claims that is true enough to repeat and wrong
in exactly the two cases you will actually hit. The rule is real: since 0.8.3, JaCoCo filters
classes and methods annotated with an annotation whose simple name is `Generated`. But it has a
retention requirement that eliminates the standard Java annotation for exactly this purpose, and
the most common Java code generator does not apply its annotation unless you ask. Both facts are
one line of configuration away from mattering, and both are widely misstated.**

## The rule as documented

From JaCoCo's release notes: filtering of classes and methods annotated with
**`@*Generated`** — that is, any annotation whose simple name is `Generated` — arrived in
**0.8.3**, with the requirement that the annotation's **retention policy is `RUNTIME` or `CLASS`**.

Two earlier, dedicated filters predate it, both from **0.8.0**:

- `@lombok.Generated`
- `@groovy.transform.Generated`

The retention requirement is not an arbitrary restriction. JaCoCo works on bytecode
([chunk 01b](01b-how-jacoco-works.md)); an annotation that is not in the class file does not
exist as far as it is concerned. `SOURCE`-retained annotations are discarded by the compiler, so
there is nothing left to filter on.

## 🔴 Trap 1 · `jakarta.annotation.Generated` is `@Retention(SOURCE)`

This is the one that catches people, because it is the *standard* annotation for marking
generated code and it has exactly the right name.

Verified against the Jakarta Annotations 3.0 javadoc: `jakarta.annotation.Generated` is declared
`@Retention(SOURCE)`. It is discarded at compile time. **JaCoCo cannot see it and does not filter
it.**

So a code generator whose output is marked only with `@jakarta.annotation.Generated` —
and this is the conventional, correct thing for a generator to emit — produces classes that count
fully toward your coverage. The generated mapper implementations, the generated client stubs, all
of it is in the denominator.

⚠️ The same applies to `javax.annotation.Generated`, its predecessor, which is likewise
source-retained. If you have inherited advice about "the `@Generated` annotation working with
JaCoCo", check which one is meant and check its retention before believing it.

**What to do instead.** For generated code carrying only a source-retained annotation, you are
back to path-based exclusion at the report ([chunk 05](05-exclusions.md)):

```xml
<excludes>
  <exclude>**/*MapperImpl.class</exclude>
  <exclude>com/example/**/generated/**/*.class</exclude>
</excludes>
```

Some generators can be configured to emit a *different*, class-retained annotation named
`Generated` — that is the cleaner fix where it is available, because it filters members rather
than whole files and survives a package reorganisation. Check your generator's own options rather
than assuming either way.

## 🔴 Trap 2 · Lombok does not add `@lombok.Generated` by default

The second claim everyone repeats — "JaCoCo handles Lombok" — is conditional on configuration
that is off by default.

From Project Lombok's own configuration documentation, describing
`lombok.addLombokGeneratedAnnotation`:

> *"Lombok can be configured to add `@lombok.Generated` annotations to all generated nodes where
> possible; useful for JaCoCo (which has built in support), or other style checkers and code
> coverage tools"*

**"Can be configured to"** — it is opt-in. Until you put this in `lombok.config`:

```
lombok.addLombokGeneratedAnnotation = true
```

…every getter, setter, generated `equals`, `hashCode`, `toString` and `@Builder` member Lombok
produced is ordinary bytecode with no marker on it, and it all counts.

This matters more than it sounds, because Lombok's generated members are exactly the
high-instruction, zero-behaviour code that distorts a coverage number:

- Generated `equals` and `hashCode` are **branch-heavy** — a null check and a comparison per
  field. On an entity with fifteen fields that is a large number of branches nobody will ever
  test, sitting in your branch-coverage denominator.
- Generated getters and setters are pure line and instruction count.

Turning the flag on is one line, applies repository-wide, and typically moves branch coverage
noticeably — not because anything was tested, but because code that was never worth testing left
the denominator. That is a legitimate correction, and it is worth doing *before* setting any
threshold, so the threshold is calibrated against real code.

⚠️ `lombok.config` is directory-scoped and inherits down the tree, with `config.stopBubbling = true`
ending the search. In a multi-module build, a `lombok.config` in one module does not apply to its
siblings. Put it at the repository root.

## Getting it right, in order

1. **Check what JaCoCo already filters for free** — [chunk 05c](05c-what-jacoco-filters-for-free.md).
   Records, enums' `values`/`valueOf`, bridge methods and more are already gone, and a
   hand-written exclusion for them is dead configuration.
2. **Turn on `lombok.addLombokGeneratedAnnotation`** if you use Lombok. One line, correct, and it
   filters members rather than types.
3. **Check whether your other generators emit a class-retained `Generated`.** If they do, nothing
   more is needed. If they emit only `jakarta.annotation.Generated`, they are not filtered.
4. **Only then reach for path-based excludes**, for what remains.

Doing it in that order means the exclusion list stays short, and every entry in it is there
because the cheaper mechanisms genuinely did not apply.

## Where this connects

- **[05 · Exclusions](05-exclusions.md)** — the three `excludes` parameters and the honest test
  for what deserves excluding.
- **[05c · What JaCoCo filters for free](05c-what-jacoco-filters-for-free.md)** — the rest of the
  built-in list, with the version each filter arrived in.
- **[01b · How JaCoCo works](01b-how-jacoco-works.md)** — why bytecode-level operation is what
  makes the retention requirement inevitable.
- **[03b · Branch coverage](03b-branch-coverage-is-the-useful-one.md)** — why generated `equals`
  distorts the branch denominator in particular.

## Gotchas

**★ `jakarta.annotation.Generated` is source-retained, so JaCoCo cannot filter on it.**
Verified against the Jakarta Annotations 3.0 javadoc: `@Retention(SOURCE)`. It is the standard
annotation for the job, it has exactly the right simple name, and it is gone from the class file
before JaCoCo ever sees it. Its predecessor `javax.annotation.Generated` behaves the same way.

**★ Lombok adds `@lombok.Generated` only if you turn it on.**
`lombok.addLombokGeneratedAnnotation = true` in `lombok.config`. Until then, "JaCoCo ignores
Lombok" is false for your project, and every generated getter and `equals` is in your denominator.
This is a one-line fix that most projects using both tools have not applied.

**★ Generated `equals` and `hashCode` are branch-heavy, so they distort the counter you should be gating on.**
Each field contributes a null check and a comparison. An entity package with unfiltered Lombok
`equals` methods can hold a large fraction of a module's total branches, none of which any
reasonable test will exercise. This is the strongest practical reason to fix the Lombok flag
before calibrating a branch threshold.

**★ Turning the Lombok flag on will move your coverage number, and that is not cheating.**
Code leaves the denominator that was never worth testing. Do it *before* setting a threshold, so
the threshold reflects real code — and note it in the commit, because an unexplained jump in
coverage looks exactly like [chunk 04b](04b-the-eighty-percent-ritual.md)'s pattern 5.

**★ `lombok.config` is directory-scoped and does not reach sibling modules.**
It applies to the directory it is in and below, with `config.stopBubbling = true` halting the
upward search. A config in one module of a multi-module build leaves the others unfiltered, which
produces the confusing state of some modules filtered and some not. Put it at the repository root.

**★ There is no `doc/filtering.html` on jacoco.org — the filter list is in `doc/changes.html`.**
Both `jacoco.org` and `eclemma.org` return 404 for a filtering page. Anyone citing one is citing
something that no longer exists, or never did at that path. The authoritative list, with the
version each filter arrived in, is in the release notes.

**★ The rule matches on the annotation's simple name, so a custom `@Generated` works.**
Any annotation named `Generated`, in any package, with `RUNTIME` or `CLASS` retention, is honoured.
That is a genuinely useful escape hatch for a home-grown generator: declare your own
class-retained `@Generated` and JaCoCo filters its output, with no path patterns to maintain.

**★ Annotation filtering removes members; path exclusion removes files.**
This is the reason to prefer it. A class with three generated methods and one hand-written one
keeps the hand-written method in the report under annotation filtering, and loses it entirely under
a path exclusion. Mixed classes are common, and path exclusion is a blunt instrument on them.

**★ A hand-written exclusion for something JaCoCo already filters is invisible dead configuration.**
It does no harm and it never expires, so it accumulates. Checking the built-in list before adding
a pattern costs a minute and keeps the exclusion list meaningful — see
[chunk 05c](05c-what-jacoco-filters-for-free.md).

## Interview questions

**★ Does JaCoCo ignore code annotated `@Generated`?**
Conditionally. Since 0.8.3 it filters classes and methods annotated with any annotation whose
simple name is `Generated`, but only when that annotation's retention is `RUNTIME` or `CLASS` —
because JaCoCo operates on bytecode and a source-retained annotation is not there to be seen. The
practical catch is that `jakarta.annotation.Generated`, the standard annotation for exactly this
purpose, is declared `@Retention(SOURCE)` and is therefore not filtered.

**★ You use Lombok and your entity package has low coverage. What do you check first?**
Whether `lombok.addLombokGeneratedAnnotation = true` is set in `lombok.config`. Lombok does not add
`@lombok.Generated` by default — its documentation says it *can be configured* to — so without that
flag every generated getter, setter, `equals` and `hashCode` counts. Generated `equals` in
particular is branch-heavy, a null check and a comparison per field, so it inflates the branch
denominator with code no test will ever exercise. Also check that `lombok.config` is at the
repository root, since it is directory-scoped and does not reach sibling modules.

**★ Your MapStruct-generated mappers count toward coverage despite being annotated `@Generated`. Why?**
Because the annotation being applied is almost certainly `jakarta.annotation.Generated` (or the
older `javax` one), which is source-retained and therefore absent from the class file. JaCoCo's
filter requires `RUNTIME` or `CLASS` retention. The fixes are to configure the generator to emit a
class-retained annotation named `Generated` if it supports that, or to fall back to a path-based
exclusion at the report on the generated output.

**★ Why does JaCoCo require CLASS or RUNTIME retention rather than accepting source retention?**
Because it never sees your source. It instruments bytecode as classes are loaded and analyses class
files to build the report, so the only annotations available to it are those the compiler wrote
into the class file. A `SOURCE`-retained annotation is discarded by `javac` and leaves no trace to
filter on. The requirement is a consequence of the architecture, not a policy choice.

**★ Annotation-based filtering or path-based exclusion — which is better and why?**
Annotation-based, where it is available. It filters at the level of individual methods, so a class
containing three generated members and one hand-written one keeps the hand-written one in the
report; a path exclusion drops the whole file. It also survives package reorganisation, whereas
path patterns silently stop matching or start matching too much. Path exclusion is the fallback
for generated output whose annotation is source-retained or absent.

{/* FOOTER */}
