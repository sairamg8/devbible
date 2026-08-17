---
title: "Triple-slash references — what a declaration file points at"
sidebar_label: "13 · Triple-slash references"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook**, *Triple-Slash
> Directives* — the placement rule, each directive's description and the
> TypeScript **5.5** emit change are quoted verbatim. 🔴 The `preserve="true"`
> attribute is confirmed in the installed **5.9.3** parser and emitter (it is
> parsed as `preserve = _preserve === "true"` and checked per reference before
> emit). **No sandbox, no console blocks.**

A declaration file can depend on *other* declaration files, and it cannot use a
`tsconfig.json` to say so — a consumer's config is not yours to edit. Triple-slash
directives are the mechanism, and they are almost the only place you will ever
legitimately write one.

## Triple-slash directives — what the file points at

A declaration file can declare dependencies on *other* declaration files. The
handbook:

> Triple-slash directives are single-line comments containing a single XML tag.
> The contents of the comment are used as compiler directives.

And the placement rule, which explains most "my directive does nothing" reports:

> Triple-slash directives are **only** valid at the top of their containing file.
> A triple-slash directive can only be preceded by single or multi-line comments,
> including other triple-slash directives. If they are encountered following a
> statement or a declaration they are treated as regular single-line comments, and
> hold no special meaning.

⚠️ **"Treated as regular single-line comments"** — no error, no warning. A
directive one line too low is inert, and the symptom is a missing type somewhere
else entirely.

### `/// <reference types="…" />`

> Similar to a `/// <reference path="…" />` directive, which serves as a
> declaration of *dependency*, a `/// <reference types="…" />` directive declares
> a dependency on a package.
>
> An easy way to think of triple-slash-reference-types directives are as an
> `import` for declaration packages.

🔴 **And the rule that tells you where it belongs:**

> For declaring a dependency on an `@types` package in a `.ts` file, use `types`
> on the command line or in your `tsconfig.json` instead. Triple-slash reference
> types directives are used in *declaration files*.

So this is the one triple-slash directive you will legitimately write: a
`.d.ts` that needs `@types/node` says so with `/// <reference types="node" />`,
because a consumer's `tsconfig.json` is not yours to edit.

### `/// <reference path="…" />`

> The `/// <reference path="…" />` directive is the most common of this group. It
> serves as a declaration of *dependency* between files. […] It is an error to
> reference a file that does not exist. It is an error for a file to have a
> triple-slash reference to itself.

**Avoid it in anything you publish.** A `path` is a *file path*, resolved
relative to the referencing file — so it survives only if your package's internal
layout survives. `types` names a package and lets resolution do its job.

### `/// <reference lib="…" />`

> This directive allows a file to explicitly include an existing built-in *lib*
> file. […] use `lib="es2015"` and not `lib="lib.es2015.d.ts"`.

```ts
/// <reference lib="es2017.string" />
"foo".padStart(4);
```

Useful in a declaration file whose types need a library the consumer might not
have enabled.

### `/// <reference no-default-lib="true"/>`

> This directive marks a file as a *default library*. You will see this comment
> at the top of `lib.d.ts` and its different variants. […] when passing
> `skipDefaultLibCheck`, the compiler will only skip checking files with
> `/// <reference no-default-lib="true"/>`.

You will read this one; you will not write it.

### 🔴 The 5.5 change — directives are no longer emitted by default

> As of TypeScript 5.5, the compiler does not generate reference directives, and
> does **not** emit handwritten triple-slash directives to output files unless
> those directives are marked as `preserve="true"`.

```ts
/// <reference types="node" preserve="true" />
```

That is a behavioural change with a version on it, and it is the reason a
declaration file that worked before 5.5 can lose its dependency on upgrade. The
attribute is real in the parser — `preserve = _preserve === "true"` — and the
emitter checks it per reference before writing the directive out.

📌 **The right modern answer is usually neither**: `import type` the thing you
need. A type-only import is erasable, it participates in normal module
resolution, and it does not depend on emit behaviour that changed once already.


## Gotchas

**Symptom:** A triple-slash directive has no effect.
**Cause:** It is not at the top of the file. Only comments may precede it;
anything else makes it *"a regular single-line comment"* with no special meaning
— and no diagnostic.
**Fix:** Move it above every declaration and every import.

**Symptom:** Your published `.d.ts` lost its `/// <reference types="node" />`
after a TypeScript upgrade.
**Cause:** TypeScript 5.5 stopped emitting handwritten directives by default.
**Fix:** Add `preserve="true"`, or replace it with an `import type`.

**Symptom:** A `/// <reference path="…" />` in a published package resolves to
nothing for consumers.
**Cause:** It is a file path into your source layout, which the published package
does not reproduce.
**Fix:** Use `types="pkg"`, or an ordinary import.

**Symptom:** `TS1084: Invalid 'reference' directive syntax.`
**Cause:** A malformed triple-slash tag — a missing quote, a stray space, an
attribute the parser does not accept.
**Fix:** Match the exact form. The tag is parsed strictly, not read loosely.

**Symptom:** The compiler reports an error for a referenced file you deleted.
**Cause:** *"It is an error to reference a file that does not exist."*
**Fix:** Remove the directive. Unlike most things in a comment, this one is
checked.

**Symptom:** A method exists at runtime but not in your types, and adding
`lib` to `tsconfig.json` fixed it locally but not for consumers.
**Cause:** Your `.d.ts` depends on a lib the consumer has not enabled.
**Fix:** `/// <reference lib="es2017.string" />` in the declaration file, so the
dependency travels with it.

**Symptom:** `skipDefaultLibCheck` appears to do nothing.
**Cause:** It only skips files marked `/// <reference no-default-lib="true"/>` —
that is the lib files, not your dependencies.
**Fix:** You are probably reaching for `skipLibCheck`
(**10 · `skipLibCheck`** *(not written yet)*).

**Symptom:** Adding `/// <reference types="node" />` to a browser package pulled
Node's globals into consumers' projects.
**Cause:** A reference is a dependency declaration; it applies to whoever loads
your types.
**Fix:** Only reference what your *declarations* genuinely need. If one type is
all you want, `import type` it instead — the blast radius is one file, not the
program.

**Symptom:** Two packages both `/// <reference types="…" />` conflicting versions
of the same `@types` package.
**Cause:** Reference directives resolve like module specifiers, and the resolved
copy is whatever the install layout provides.
**Fix:** This is a dependency problem, not a declaration one — deduplicate the
`@types` package.

**Symptom:** You wrote `/// <reference lib="lib.es2015.d.ts" />` and it failed.
**Cause:** The handbook: use `lib="es2015"`, *"not `lib="lib.es2015.d.ts"`"*.
**Fix:** Drop the prefix and the extension — the names match the `lib` compiler
option's values.

## Interview questions

**★ When do you write `/// <reference types="…" />` instead of using `types` in
`tsconfig.json`?**
In a **declaration file**. The handbook is explicit: for a `.ts` file use the
`types` compiler option; the triple-slash form is for `.d.ts` files, where you are
declaring a dependency your consumers cannot configure on your behalf.

**★ Why might a published `.d.ts` lose a reference directive on a TypeScript
upgrade?**
TypeScript 5.5 stopped emitting handwritten triple-slash directives unless they
carry `preserve="true"`, and stopped generating reference directives itself. Add
the attribute, or replace the directive with an `import type`.

**★ Why does a triple-slash directive sometimes silently do nothing?**
Because it is valid *only* at the top of the file, preceded by nothing but
comments. Anywhere else the handbook says it is treated as a regular single-line
comment — no special meaning, and no diagnostic to tell you.

**★ What is the difference between `reference path` and `reference types`?**
`path` is a dependency on a *file*, resolved relative to the current one; `types`
is a dependency on a *package*, resolved like a module specifier. In anything you
publish, `types` is the portable one — a file path into your source tree does not
survive packaging.

**What is the modern alternative to a reference directive?**
`import type`. It is erasable, it participates in ordinary module resolution, its
effect is scoped to the file rather than the program, and it does not depend on
emit behaviour that has already changed once.

**What does `/// <reference lib="…" />` buy you that `tsconfig.json` does not?**
It travels with the declaration file. A `.d.ts` whose types need `es2017.string`
can say so, rather than relying on every consumer having configured `lib`
compatibly.

**Where will you actually see `/// <reference no-default-lib="true"/>`?**
At the top of `lib.d.ts` and its variants — it marks a file as a default library
and suppresses inclusion of the default lib. It is also the only thing
`skipDefaultLibCheck` looks at. You read it; you do not write it.

**Is a reference directive checked, or is it just a comment?**
Checked, in the ways that matter: referencing a non-existent file is an error, so
is a self-reference, and malformed syntax is `TS1084`. What is *not* checked is
placement — a directive in the wrong position silently becomes an ordinary
comment.

---

← Prev: [12 · `@internal` and `stripInternal`](./12-internal-and-strip.md) · Back to [the topic index](./README.md)
