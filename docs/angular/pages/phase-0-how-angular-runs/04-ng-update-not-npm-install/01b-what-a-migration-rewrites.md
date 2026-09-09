---
title: "A migration is a program with a version number that receives your project as a filesystem and returns edits to it — and v22's eight required ones mostly exist to freeze the old behaviour, not to adopt the new"
sidebar_label: "01b · What a migration rewrites"
sidebar_position: 1.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/migrations.json`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/migrations.json)
> (read in full, verbatim below);
> `angular/angular-cli` at tag `v22.1.7`:
> [`packages/schematics/angular/migrations/migration-collection.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/migrations/migration-collection.json).
> Documentation-validated; **no sandbox run** — no migration was executed. ⚠️ The migration
> *descriptions* below are verbatim from the collection files; the compiled migration
> implementations were **not** read, and the before/after code shows the shape each description
> names.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**[Chunk 01](01-why-npm-install-is-not-an-upgrade.md) argued that an Angular upgrade rewrites your
source. This chunk shows the file that declares the rewrites and what each one does to a real
project.** The surprise, once you read `@angular/core`'s v22 collection top to bottom, is not how
aggressive the migrations are — it is how conservative. Two of the eight exist purely to write the
*old* default into your config so that upgrade day ends with a working build and a decision
deferred, rather than a broken build and a rollback. An Angular application that upgraded cleanly
is therefore usually carrying opt-outs nobody remembers agreeing to, and finding them is a
five-minute job once you know they are declared by name.

## The collection file, verbatim

A migration collection is a JSON map of name → `{version, description, factory}`. Here are four of
`@angular/core`'s eight, exactly as published at `v22.1.5`:

```json
"change-detection-eager": {
  "version": "22.0.0",
  "description": "Adds `ChangeDetectionStrategy.Eager` to all components.",
  "factory": "./bundles/change-detection-eager.cjs#migrate"
},
"http-xhr-backend": {
  "version": "22.0.0",
  "description": "Adds 'withXhr' to 'provideHttpClient' function calls when the 'HttpXhrBackend' is used. For more information see: https://angular.dev/api/common/http/withXhr",
  "factory": "./bundles/http-xhr-backend.cjs#migrate"
},
"strict-templates-default": {
  "version": "22.0.0",
  "description": "Adds 'strictTemplates: false' in tsconfig.json when not set.",
  "factory": "./bundles/strict-templates-default.cjs#migrate"
},
"incremental-hydration": {
  "version": "22.0.0",
  "description": "Adds withNoIncrementalHydration() opt out to provideClientHydration() when incremental hydration is not enabled to retain pre-v22 behavior-.",
  "factory": "./bundles/incremental-hydration.cjs#migrate"
}
```

⚠️ The stray `behavior-.` is in the source file, and is quoted unaltered.

Three fields, three jobs:

- **`version`** is what makes it a migration rather than a generator. `ng update` builds a semver
  range from your installed version to the target and runs only the entries inside it. An entry
  with no `version` is skipped entirely.
- **`description`** is what you see printed while it runs, and it is the only human-readable
  contract the migration has. Read them before you upgrade; they are short and they are precise.
- **`factory`** is a JavaScript entry point — `<path>#<exportedFunction>`. The function receives a
  virtual filesystem of your project and records edits against it. Writing one is Phase 15's
  business, at Master tier; **Phase 15 · the toolchain in depth** *(not written yet)*.

🔴 **All eight of `@angular/core`'s v22 entries are `"version": "22.0.0"` and none carries
`"optional": true`.** That is the checkable form of "the upgrade rewrites your source": on a
v21 → v22 update, all eight run, and none of them asks. The two-bucket mechanism that `optional`
selects is **06 · Required and optional migrations** *(not written yet)*.

## `change-detection-eager` — the one that touches every component file

Its description says *"all components"*. In an application with four hundred component classes,
that is four hundred files with an edited import list and an edited decorator:

```ts
// src/app/order-summary/order-summary.ts — before
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-order-summary',
  templateUrl: './order-summary.html',
})
export class OrderSummary {
  readonly orderId = input.required<string>();
}
```

```ts
// src/app/order-summary/order-summary.ts — after
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-order-summary',
  templateUrl: './order-summary.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class OrderSummary {
  readonly orderId = input.required<string>();
}
```

There is no hand-editing budget for that scale of change, and there is no way to do it with a
regular expression either — the import specifier list has to be merged, not appended, and the
decorator argument is an object literal that may already have five keys in any order. That is the
argument for shipping a real program with a TypeScript AST behind it rather than a documentation
page saying "add this to your components".

## `strict-templates-default` — one file, and the most consequential line in the upgrade

```jsonc
// tsconfig.json — after the migration. The key did not exist before.
{
  "compilerOptions": {
    "strict": true
  },
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

The migration writes `false` **deliberately**. v22 flipped the compiler's default for this flag to
`true`; the migration's job is to hold your project at the old behaviour so that upgrade day
produces a build that works. What that one flag actually switches on, and what leaving it off
costs, is already documented at Master tier in topic 01 —
[`14f · what strictTemplates actually switches`](../01-compiler-with-a-framework-attached/14f-what-stricttemplates-actually-switches.md)
and [`14g · what turning strict templates off costs`](../01-compiler-with-a-framework-attached/14g-what-turning-strict-templates-off-costs.md).
Do not re-derive it here; go and read those two before deleting the key.

## `incremental-hydration` and `http-xhr-backend` — your provider array

```ts
// src/app/app.config.ts — after both migrations
import { ApplicationConfig } from '@angular/core';
import { provideClientHydration, withNoIncrementalHydration } from '@angular/platform-browser';
import { provideHttpClient, withXhr } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(withNoIncrementalHydration()),
    provideHttpClient(withXhr()),
  ],
};
```

Both add a **feature function that preserves pre-v22 behaviour** to a provider you already had.
Neither adds a capability; both freeze one. `incremental-hydration`'s description says so outright
— *"to retain pre-v22 behavior"*. The feature it is opting you out of is covered in topic 03's
[`11c · incremental hydration and event replay`](../03-the-provider-array/11c-incremental-hydration-and-event-replay.md);
the provider array those calls live in is topic 03's subject throughout
([03 · The provider array](../03-the-provider-array/README.md)).

## The pattern worth internalising: migrate to the old behaviour, decide later

Of the four shown, **three write an opt-out**. That is the shape of a well-run framework migration
and it has a direct operational consequence:

> **A clean upgrade is not a finished upgrade.** The build going green means the migrations
> succeeded at freezing your behaviour. The v22 features you upgraded *for* are, in several cases,
> switched off in your own config by code that ran on your behalf.

So the upgrade has a second half that no tool will remind you about: grep your own diff for the
opt-outs and schedule their removal one at a time, each with its own test run. The names to grep
for are exactly the ones in the collection file — `strictTemplates`, `withNoIncrementalHydration`,
`withXhr`, and whatever the CLI's own collection added.

`@angular/cli` publishes a **second** collection of its own, with two extra fields and a different
character — that is [01c · The CLI's own collection](01c-the-clis-own-collection.md).

## Gotchas

**★ Symptom: `tsconfig.json` gained `"strictTemplates": false` that nobody on the team wrote.**
Cause: the required `strict-templates-default` migration, which ran without asking because it is
not marked `optional`. Fix: this is working as designed — remove the key when you are ready to take
v22's default, not on upgrade day, and read
[`15e · what changes underneath you`](../01-compiler-with-a-framework-attached/15e-what-changes-underneath-you.md)
first:

```jsonc
// tsconfig.json — taking v22's default, deliberately, in its own commit
{
  "angularCompilerOptions": {
    // "strictTemplates": false   ← delete this line, then fix the diagnostics
  }
}
```

**★ Symptom: the upgrade commit touches four hundred files and is impossible to review.** Cause:
correct, and expected — that is `change-detection-eager`. Fix: separate the dependency change from
the source change so each is reviewable on its own. `ng update --create-commits` (short flag `-C`)
produces one commit per migration, so the four-hundred-file change lands under a message naming the
migration that made it, and can be reviewed as *"is this the edit the description promised"* rather
than file by file:

```bash
ng update @angular/cli@^22 @angular/core@^22 --create-commits
git log --oneline    # one commit for the dependency change, then one per migration
```

**★ Symptom: a migration reports that it changed nothing, on a project that visibly needs it.**
Cause: migrations match on source *shape*, not on intent. `http-xhr-backend` looks for
`provideHttpClient` call sites; if yours is built by a factory function, spread from a shared
array, or lives in a library the migration is not scanning, there is nothing for it to match.
Fix: treat "no changes made" as a prompt to check by hand, not as an all-clear — the descriptions
tell you exactly what pattern was being looked for.

**★ Symptom: your migrated files came back reformatted — quote style, line breaks, trailing
commas.** Cause: the CLI runs the files a migration touched through Prettier after each migration.
Fix: nothing to fix, but expect it, and make sure the repo has a `.prettierrc` that matches your
house style before you upgrade rather than after — otherwise the formatting churn lands inside the
migration commits and hides the real edits.

**★ Symptom: you removed `withNoIncrementalHydration()` and hydration broke in a way the tests did
not catch.** Cause: the opt-out was freezing pre-v22 behaviour for a reason — incremental hydration
changes *when* components hydrate, which is a timing behaviour, and timing behaviour is exactly
what unit tests do not see. Fix: remove opt-outs one at a time, each in its own commit, each
followed by an actual run of the application, not just the test suite.

## Interview questions

**★ Two of v22's required migrations disable v22 behaviour. Why would a framework ship that?**
Because the alternative is a project that will not build on upgrade day, and a team that therefore
does not upgrade at all. A migration that writes `strictTemplates: false` converts "your build is
broken and you cannot ship" into "your build works and you owe yourself a decision" — and it makes
that debt *visible*, in a config file, in a diff, under a commit that names the migration. A
framework whose upgrades routinely brick projects loses the ability to make breaking changes at
all, which is a far more expensive outcome than a config key someone has to delete later.

**★ What are the three fields every migration declares, and what does each decide?**
`version` decides whether the migration is in range for this particular update — it is the field
that makes an entry a migration rather than an on-demand generator, and an entry without it is
skipped. `description` is the human contract, printed as the migration runs. `factory` is
`<path>#<export>`, the JavaScript entry point that receives the project as a virtual filesystem.
The CLI's collection adds two more: `optional`, which moves the entry into the prompted bucket, and
`recommended`, which pre-ticks its checkbox.

**How would you audit what an Angular upgrade actually did to a codebase six months later?**
Open the two collection files for the version you crossed — `node_modules/@angular/core/schematics/migrations.json`
and the CLI's `migration-collection.json` — and read the descriptions. They name the exact symbols
each migration writes, so each becomes a grep: `ChangeDetectionStrategy.Eager`, `strictTemplates`,
`withNoIncrementalHydration`, `withXhr`. Anything you find is something a program decided on your
behalf, and each is a candidate for a small, separately-tested removal.

**A migration ran and reported no changes. Does that mean your project was already correct?**
No — it means no source matched the pattern the migration looks for. Those are different claims.
The honest reading is "this migration had nothing to say about your code", which on a project that
wraps `provideHttpClient` in its own factory is exactly what you would expect even though the
underlying change absolutely applies to you.

**Why can migrations not be published as a documentation page listing find-and-replace rules?**
Because the edits are structural, not textual. Adding a key to a decorator's object literal
requires knowing which argument of which call is the metadata object; merging a new symbol into an
import statement requires knowing whether the module is already imported and under what specifiers.
Both are AST operations. A regex that gets them right on a hundred files gets them wrong on the
hundred-and-first, silently.

---

← Prev: [Why `npm install` is not an upgrade](01-why-npm-install-is-not-an-upgrade.md) · Index: [Topic index](README.md) · Next → [The CLI's own collection](01c-the-clis-own-collection.md)
