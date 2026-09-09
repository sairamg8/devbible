---
title: "An option validation failure is assembled from a template, and its two special cases carry the entire diagnosis — the offending key in parentheses, and the complete list of allowed values for a bad enum"
sidebar_label: "15d · Reading a validation failure"
sidebar_position: 15.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — `SchemaValidationException` in
> [`packages/angular_devkit/core/src/json/schema/registry.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/json/schema/registry.ts)
> and the `application` and `dev-server` option schemas under
> [`packages/angular/build/src/builders/`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json),
> all at tag `v22.1.7`, cross-read against
> [angular.dev — Workspace configuration](https://angular.dev/reference/configs/workspace-config#configuring-builder-targets).
> 🔴 **No example failure message is reproduced on this page.** The template is quoted from the source
> that builds it; inventing a filled-in instance would be fabricating output. Documentation-validated;
> **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Layer 4 is the last thing that runs before a builder starts, and it is the strictest — but its
failure message is also the most informative in the whole stack, provided you read the end of the
line rather than the beginning.** The message is not a sentence somebody wrote; it is assembled from
a template, and two of the validator's keywords append the part that actually identifies your
mistake. Everything before that append is generic and will look the same for a misspelling, a wrong
type and a value out of range.

## The message is a template, not a sentence

Two pieces of source produce every option validation failure. The exception's constructor:

```ts
constructor(errors?: SchemaValidatorError[], baseMessage = 'Schema validation failed with the following errors:') {
  …
  super(`${baseMessage}\n  ${messages.join('\n  ')}`);
}
```

*(The body between the signature and the `super(...)` call is elided above — it is the guard for an
empty error list. What matters here is the shape it produces: a heading line, then one indented line
per error.)*

and the mapper that builds each line:

```ts
const messages = errors.map((err) => {
  let message = `Data path ${JSON.stringify(err.instancePath)} ${err.message}`;
  if (err.params) {
    switch (err.keyword) {
      case 'additionalProperties':
        message += `(${err.params.additionalProperty})`;
        break;

      case 'enum':
        message += `. Allowed values are: ${(err.params.allowedValues as string[] | undefined)
          ?.map((v) => `"${v}"`)
          .join(', ')}`;
        break;
    }
  }

  return message + '.';
});
```

So the shape is:

- a heading — `Schema validation failed with the following errors:`
- then, indented, one line per problem: `Data path` followed by a **JSON pointer in quotes**, then
  the underlying validator's own message, then a full stop.

And two special cases are appended:

| Keyword | What is appended | Why it matters |
|---|---|---|
| `additionalProperties` | `(<the offending property name>)` in parentheses | this is the **only** place the misspelled key is named |
| `enum` | `. Allowed values are: "a", "b"` | the complete acceptable set, saved you a trip to the schema |

🔴 **The parenthesised property name is the part people skip.** The rest of an
`additionalProperties` line is generic; the parentheses hold the actual mistake.

## The data path is a JSON pointer, and it locates the mistake

`err.instancePath` is the path *within the validated object*, and the validated object is the
**assembled options** — base `options` merged with whatever configurations applied. So a pointer that
looks shallow is telling you the problem is at the top level of that merged object, not that it is at
the top level of `angular.json`.

That distinction resolves the most common confusion about these messages: the pointer never names the
project or the target, because by the time layer 4 runs both have already been chosen. If you need to
know which configuration contributed the bad key, that is a question about the merge, not about the
message — [04b](04b-the-merge-is-shallow.md).

The four shapes that `additionalProperties: false` gives this failure — a typo, a `dash-case` name,
an option from the old builder, and an option on the wrong target — are
[15e](15e-four-ways-to-fail-a-closed-schema.md).

## What the message never contains

The validator is handed an object and a schema. It has no idea that either came from a file, so the
message cannot name one — and four things people expect to see are structurally absent:

| Absent | Why |
|---|---|
| a file name | the validator never saw a file, only the assembled options object |
| a line number | the same reason; the object has no positions |
| the project | already resolved, two layers earlier |
| the target and configuration | already resolved; the merge happened before validation |

That is why searching `angular.json` for the data path as literal text finds nothing. The pointer
addresses the merged options object, and the merged object is not written down anywhere.

## Gotchas

**★ Symptom: you search `angular.json` for the data path and find no such text.** Cause: the pointer
addresses the assembled options object, which is a runtime value rather than a location in a file —
the validator never saw your file. Fix: read the pointer as a path within the merged options and look
at the corresponding key in `options` plus every configuration that applied:

```json
{
  "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json" },
  "configurations": { "production": { "outputHashing": "all" } }
}
```

**★ Symptom: the failure line has no parenthesised key, so you cannot tell which option is wrong.**
Cause: only the `additionalProperties` keyword appends a property name. A wrong *type* or a value out
of range is reported against a key that is legitimately present, so the data path — not a
parenthesis — is what locates it. Fix: read the pointer as a path into the merged options and check
that key's value type against the builder's schema:

```json
{ "options": { "sourceMap": true, "optimization": false, "outputHashing": "all" } }
```

**Symptom: a colleague pastes only the heading line into a bug report and nobody can act on it.**
Cause: the heading — `Schema validation failed with the following errors:` — is a constant and carries
no information; every diagnosis is in the indented lines beneath it. Fix: ask for the whole block,
because a single heading line is the same text for every option mistake anyone has ever made.

**★ Symptom: an enum value is rejected and you go to the schema to find the allowed set.** Cause: you
did not need to — the validator appends `. Allowed values are:` followed by every acceptable value in
quotes, for exactly this keyword. Fix: read the tail of the line, then correct the value:

```json
{ "options": { "outputHashing": "all" } }
```

**Symptom: the data path in the message does not look like anywhere in your `angular.json`.** Cause:
it is a pointer into the *assembled options object* — base `options` merged with the applied
configurations — not into the workspace file. The project and target are already chosen by the time
this layer runs, so they never appear in the pointer. Fix: work out which configuration contributed
the key, remembering that the merge replaces whole values:

```json
{
  "options": { "outputHashing": "none" },
  "configurations": { "production": { "outputHashing": "all" } }
}
```

**Symptom: several validation lines appear at once and you fix only the first.** Cause: the exception
joins **one line per error** under a single heading, so a run of indented lines is a run of separate
problems. Fix: read to the end of the indented block before editing:

```json
{
  "options": {
    "browser": "src/main.ts",
    "tsConfig": "tsconfig.app.json",
    "outputHashing": "none",
    "sourceMap": false
  }
}
```

**Symptom: a schema validation failure and you start checking the builder string and the project
name.** Cause: layer 4 runs last — reaching it proves the file parsed, the project and target
resolved, the configuration existed and the builder loaded. Fix: confine the investigation to option
names and values; everything upstream is already certified by the fact that you got this message at
all.

## Interview questions

**★ How do you read a schema validation message?**
By its parts. The heading is fixed — `Schema validation failed with the following errors:` — and each
indented line begins `Data path` followed by a JSON pointer in quotes, then the validator's own
description. Two keywords append something extra, and both are the useful part: an
`additionalProperties` failure appends the offending property name in parentheses, which is the only
place the misspelled key is named, and an `enum` failure appends `. Allowed values are:` with every
acceptable value quoted. If you only read the beginning of the line you get a generic complaint; the
diagnosis is at the end.

**★ The message has neither a parenthesised key nor an allowed-values list. Now what?**
Then the keyword was neither `additionalProperties` nor `enum`, which narrows it usefully: the key
itself is legitimate and the problem is with its *value* — a wrong type, a value out of range, or a
malformed nested object. The data path is the whole diagnosis in that case, so read it as a path
into the merged options object and compare that key's value against what the builder's schema
declares. The absence of the two appended parts is information, not a gap.

**Why is it worth knowing that the heading line is a constant?**
Because it is the part people quote. `Schema validation failed with the following errors:` is a
default parameter in the exception's constructor and is identical for every option mistake, so a bug
report or a chat message containing only that line contains no information at all. Recognising it as
boilerplate is what prompts you to ask for the indented lines, which are where the property name,
the data path and the allowed values live.

**Why does an option validation failure have no file name or line number?**
Because the validator is given an object and a schema, not a document. By the time it runs, the
workspace file has been parsed, a project and target chosen, and the base options merged with the
applied configurations into a plain object — and that object has no positions in it. The data path is
a pointer within that object rather than a location in your file, which is why searching for it as
text in `angular.json` finds nothing and why the same key can be reported for a value that came from
a configuration rather than from `options`.

**What does the data path tell you, and what does it deliberately not tell you?**
It tells you where in the *assembled options object* the problem is — after base `options` and any
applied configurations have been merged. It does not tell you the project, the target, or which
configuration contributed the offending key, because all of those were resolved before this layer
ran and the validator only ever sees the merged result. When you need to know which configuration
introduced a key, that is a question about the merge rather than about the message, and the merge
replaces whole values rather than combining them.

**Someone reports "a schema validation error in `angular.json`" and asks whether the builder string
might be wrong. What do you say?**
That it cannot be. Layer 4 runs last: reaching it proves the file parsed, a project and target
resolved, the named configuration existed and the builder package was found and loaded. A schema
validation failure is therefore a certificate for everything upstream, and the investigation should
be confined to option names and values. This is the clearest practical payoff of thinking in layers —
it does not just tell you where to look, it tells you where not to.

---

← Prev: [Complaints, not deletions](15c-complaints-that-are-not-deletions.md) · Index: [Topic index](README.md) · Next → [Closed schemas and spelling](15e-four-ways-to-fail-a-closed-schema.md)
