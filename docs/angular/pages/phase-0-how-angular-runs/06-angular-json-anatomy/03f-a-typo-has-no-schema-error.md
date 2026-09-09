---
title: "The `target` schema's generic branch accepts any string that is not an official builder — so a misspelled builder name is valid JSON, valid against the schema, and fails only when the command runs"
sidebar_label: "03f · A typo has no schema error"
sidebar_position: 3.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> the `target` definition in
> [`packages/angular/cli/lib/config/workspace-schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json)
> and [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json),
> both at tag `v22.1.7`. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The consequence of the `oneOf`'s generic branch is worth its own page, because it inverts what
people expect a schema to do for them.** A builder string that matches no official branch is not
rejected — it falls into the branch that exists so third-party builders can be named at all. The
file validates. The editor stays quiet. The failure arrives at run time, from the resolver rather
than the validator. How that `oneOf` is constructed is
[03c · The seventeen builder strings](03c-the-seventeen-builder-strings.md).

## The consequence: a typo has no schema error

The generic branch accepts **any string that is not one of the seventeen**. `@angular/build:aplication`
is not on the list, so it matches the generic branch, so the file is schema-valid — and because that
branch types `options` as a bare `{ "type": "object" }`, every option inside it becomes valid too.
You lose the error *and* the autocompletion in the same moment.

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:aplication",
      "options": { "tsConfig": "tsconfig.app.json", "anythingAtAll": 42 }
    }
  }
}
```

That file passes a schema check. It fails at run time with `Cannot find builder
"@angular/build:aplication".` from the resolver
([03d](03d-how-a-builder-string-becomes-a-function.md)).

🔴 **So "the editor is happy" is not evidence that a builder string is right. The disappearance of
autocompletion is the signal** — if a target stops offering option names, the builder string above it
is the first thing to read.

## Gotchas

**★ Symptom: your editor offers no autocompletion for options inside a target that used to have it.**
Cause: the builder string no longer matches any official branch of the `oneOf`, so the generic branch
applies and `options` is typed as a plain object. A typo is by far the most common reason; a genuinely
custom builder has the same effect legitimately. Fix: correct the string and the typing returns:

```json
{
  "targets": {
    "build": {
      "builder": "@angular/build:application",
      "options": { "tsConfig": "tsconfig.app.json" }
    }
  }
}
```

**★ Symptom: a misspelled builder string produces no error until the command runs.** Cause: the
generic branch is defined by exclusion, so anything not on the list of seventeen is a valid "custom"
builder as far as the schema is concerned. Fix: the run-time message names the string you wrote —
read it literally, character by character, rather than assuming the package is missing:

```json
{
  "targets": {
    "build": { "builder": "@angular/build:application", "options": { "tsConfig": "tsconfig.app.json" } }
  }
}
```

**Symptom: a custom builder's options get no validation in the editor.** Cause: expected — the
generic branch types `options` as `{ "type": "object" }` because the schema cannot know your
builder's option shape. The validation still happens, but at run time, against the `schema.json` your
builder's `builders.json` points at. Fix: nothing in `angular.json`; the typing you want comes from
your builder package's own schema, which the resolver loads.

**Symptom: someone adds a builder string with a trailing space or a capital letter and the message
is confusing.** Cause: the enum match, the resolver's package lookup and the manifest lookup are all
exact string operations, and none of them trims or normalises. Fix: compare the string against the
package's `builders.json` key exactly:

```json
{
  "targets": {
    "test": { "builder": "@angular/build:unit-test", "options": {} }
  }
}
```

## Interview questions

**★ Why does a misspelled builder string produce no editor error?**
Because the generic branch of the `oneOf` is defined by exclusion. Any string that is not one of the
seventeen official ones is, by construction, a valid custom builder name, and the branch that accepts
it types `options` as an untyped object. So a typo produces a schema-valid file with no option
validation at all, and the first sign of trouble is the resolver failing at run time with
`Cannot find builder "…"`. The practical tell is the *loss of autocompletion* inside `options` — that
happens the instant the string stops matching an official branch.

**A colleague says the schema will catch a bad builder name. What do you tell them?**
That it will catch a bad *option* under a recognised builder, and will not catch a bad builder name
at all. The two failures are asymmetric: with the correct string you get a typed `options` object and
immediate feedback on every key; with an incorrect string you get an untyped object and no feedback
on anything, until the resolver fails. It is worth teaching as a diagnostic rule — if `angular.json`
suddenly accepts nonsense inside a target, look up one line.

**★ Why is the generic branch the right design despite costing you typo detection?**
Because the alternative is worse: a closed enum of official builder strings would make every
third-party and in-house builder unnameable, and `angular.json` would stop being extensible at the
exact point extensibility matters. The schema is choosing to admit unknown builders rather than to
catch known mistakes, which is a defensible trade — but it moves the check from validation time to
resolution time, and it means the editor's silence about a builder string carries no information at
all. The practical response is to treat the builder name as the one field a schema will not defend,
and to verify it by running the target rather than by reading the file.

---

← Prev: [The error ladder](03e-the-error-ladder-of-an-invocation.md) · Index: [Topic index](README.md) · Next → [`options` and `configurations`](04-options-and-configurations.md)
