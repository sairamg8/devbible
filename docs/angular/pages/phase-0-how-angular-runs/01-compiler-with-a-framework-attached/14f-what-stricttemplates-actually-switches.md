---
title: "⚠️ `strictTemplates` has been ON by default since v22.0.0 and angular.dev still tells you to turn it on — the option became an opt-out, `typeCheckHostBindings` quietly did the same, and four separate artefacts in the release notes exist only because the default flipped"
sidebar_label: "14f · strictTemplates is on by default"
sidebar_position: 14.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts),
> [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts) —
> the same repo's [`adev/src/content/reference/configs/angular-compiler-options.md`](https://angular.dev/reference/configs/angular-compiler-options)
> and the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md).
> ⚠️ Contradicts [angular.dev · Template type checking](https://angular.dev/tools/cli/template-typecheck), which has not been updated for the v22 default — where the guide and the source disagree, this page follows the source and says so.
> Documentation-validated; **no sandbox run** — every code block is source read from a named file.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Almost everything written about Angular template type checking — including Angular's own
template-typecheck guide, today — describes a world with three modes you opt into: basic, then
`fullTemplateTypeCheck`, then `strictTemplates`. That world ended in v22.0.0. `strictTemplates` is
now `true` unless you explicitly write `false`. This is not trivia. It means an upgrade lights up
template errors in code nobody touched, it means a second option you have probably never heard of
started type-checking your host bindings on the same day, and it means a blog post or an answer that
tells you to "enable strict templates" is describing a version you are not on. The check that
settles it is one line of source, and it disagrees with the most obvious documentation.**

## The default flipped, and the source says so in a doc comment

`compiler.ts` at `v22.1.5`, verbatim — comment included, because the comment is the design
statement:

```ts
/**
 * strictTemplate is `true` by default.
 * Explicit opt-out is required to disable strictness
 */
private get strictTemplates(): boolean {
  return this.options.strictTemplates !== false;
}
```

`!== false` is the whole story. Not set, set to `null`, set to `undefined`, absent from the file
entirely — all of them are strict. Only the literal `false` opts out.

The same getter at `v21.2.22`, for the diff:

```ts
const strictTemplates = !!this.options.strictTemplates;
return strictTemplates || !!this.options.fullTemplateTypeCheck;
```

Read the two together and the change is exact. Before: falsy unless you asked, with
`fullTemplateTypeCheck` as a second way to ask. After: true unless you refuse, with
`fullTemplateTypeCheck` no longer consulted at all.

The reference page in the same repository agrees, verbatim: > *"`strictTemplates` — When `true`,
enables strict template type checking. … Default is `true`."*

## Four independent corroborations in the v22.0.0 CHANGELOG

This is a large behavioural change to assert from one getter, so it is worth showing that the
release notes are built around it. All verbatim:

- **The migration writes the flag into your config on upgrade** — *"add strictTemplates to tsconfig
  during ng update"* (commit `682aaf943f`), with a follow-up *"Fix typo for strict-template
  migration"* (`1415d86980`). 🔴 A migration that writes a flag into your `tsconfig` is what a team
  does when a default is changing under existing projects: it pins your current behaviour so the
  upgrade itself is not the thing that breaks you.
- **The team pre-emptively suppressed two diagnostics they knew would light up** — *"Disabling
  nullishCoalescingNotNullable & optionalChainNotNullable on ng update"* (commit `6a435658e2`).
- **The breaking-change note says so outright**, verbatim and with the original's typos intact:
  > *"This change will trigger the `nullishCoalescingNotNullable` and `optionalChainNotNullable`
  > diagnostics on exisiting projects. You might want to disable those 2 diagnotiscs in your
  > `tsconfig` temporarily."*
- **The tooling had to catch up** — CHANGELOG 22.1.4, language-service: *"account for strictTemplates
  being enabled by default"* (commit `a99fb915c0`).

Four artefacts that only make sense if the default flipped. Any one of them alone would be
suggestive; together they are conclusive.

⚠️ **And the guide did not catch up.** `angular.dev/tools/cli/template-typecheck` still frames
`strictTemplates` as something you switch on, alongside a `fullTemplateTypeCheck` option that is no
longer in the public option surface. This is the same class of defect as
[13e](13e-the-option-surface-and-config-time-diagnostics.md)'s rule, and the same resolution
applies: **when angular.dev and the compiler disagree about an option, the checked-in source and
golden win.** Note that this is not "the docs are wrong" in general — the *reference* page
(`angular-compiler-options`) is correct and current. Two different documents, one updated and one
not, and the stale one is the more prominent.

## `typeCheckHostBindings` did the same thing, and the guide never mentions it at all

```ts
const typeCheckHostBindings = this.options.typeCheckHostBindings ?? true;
```

angular.dev's *reference* page documents it, verbatim: > *"`typeCheckHostBindings` — When `true`,
enables type checking of expressions in the `host` object literal and `@HostBinding`/`@HostListener`
decorators of components and directives. Default is `true`."*

The template-typecheck guide does not mention it at all. So there is a second body of expressions in
your components — everything in a `host: {…}` literal and every `@HostBinding` / `@HostListener` —
that is type-checked by default, through a separate option with its own default, documented on a
page most people never open. Its companion error is `HOST_BINDING_PARSE_ERROR = 5001`, described in
`error_code.ts` as *"Raised when a host expression has a parse error, such as a host listener or
host binding expression containing a pipe."*

🔴 **Host bindings are the most common source of surprise errors in a v22 upgrade after templates
themselves**, precisely because nobody was thinking of them as type-checked code. And because it is
a separate option, `strictTemplates: false` does not turn it off — a fact that catches people who
assume one switch governs everything.

**What it costs to turn strictness off — and why the answer is worse than expected — is
[14g · What turning `strictTemplates` off costs](14g-what-turning-strict-templates-off-costs.md).**

## Gotchas

**★ Symptom: upgrading to v22 produces hundreds of template errors in a project that never enabled
`strictTemplates`.** Cause: the default flipped, so code that was never checked is being checked for
the first time. These are not new bugs and not a regression — they are a backlog that was previously
invisible. Fix: let `ng update` write the flag for you so the upgrade and the cleanup are separate
commits, then burn the backlog down by category. If you must unblock a release, disable the
*narrowest* flags that cover the biggest groups:

```jsonc
{
  "angularCompilerOptions": {
    "strictNullInputTypes": false,
    "strictAttributeTypes": false
  }
}
```

**★ Symptom: after upgrading you get a wave of `nullishCoalescingNotNullable` and
`optionalChainNotNullable` warnings.** Cause: exactly what the Angular team predicted in the
breaking-change note — those two extended diagnostics fire on `??` and `?.` applied to values that
are not actually nullable, and a codebase written without strict template checking is full of
defensive `?.`. Fix: the `ng update` migration disables both for you. Migrating by hand, do the same,
then re-enable once the templates are clean:

```jsonc
{
  "angularCompilerOptions": {
    "extendedDiagnostics": {
      "checks": {
        "nullishCoalescingNotNullable": "suppress",
        "optionalChainNotNullable": "suppress"
      }
    }
  }
}
```

**★ Symptom: you add `"fullTemplateTypeCheck": true` and nothing happens.** Cause: it is no longer in
the public option surface and is not consulted by the v22 getter. Depending on your setup it may not
even be reported as unknown, so it looks accepted. Fix: delete it. The two reachable modes are
`strictTemplates` on (the default) and off; the middle tier it used to select no longer exists.

**★ Symptom: a `@HostListener` or a `host: {…}` expression suddenly fails to compile after the
upgrade.** Cause: `typeCheckHostBindings` defaults to `true` via `?? true` and is a *separate* option
from `strictTemplates`, documented only on the reference page. Fix: fix the expression — it is real
code that was never checked. To defer it, that one option turns off on its own without touching
template strictness:

```jsonc
{
  "angularCompilerOptions": {
    "typeCheckHostBindings": false
  }
}
```

**★ Symptom: a pipe inside a `@HostListener` or `host` expression produces NG5001.** Cause:
`HOST_BINDING_PARSE_ERROR` — host expressions are parsed with a grammar that does not accept pipes,
and this is a *parse* error rather than a type error, so no strictness flag affects it. Fix: move the
transformation into the class, where there is no template grammar to satisfy:

```ts
// before — a pipe in a host expression cannot be parsed
@Component({host: {'[attr.title]': 'name | titlecase'}})

// after
@Component({host: {'[attr.title]': 'titleCasedName'}})
export class Badge {
  name = 'ada lovelace';
  get titleCasedName(): string {
    return this.name.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
```

**★ Symptom: a blog post, an LLM answer or an accepted Stack Overflow answer tells you to enable
`strictTemplates`, and it is already on.** Cause: essentially every piece of writing about this
predates v22.0.0 — including Angular's own guide, which is why the mistake is so durable. Fix: check
the getter, not the prose. `!== false` is one line and settles it for whatever version you are on.

**Symptom: two developers on the same repo see different template errors.** Cause: one has an
explicit `strictTemplates` in a `tsconfig` the other's build does not extend from — a
`tsconfig.app.json` versus `tsconfig.spec.json` split is the usual shape, and the migration only
writes the flag into the file it targets. Fix: put `angularCompilerOptions` in the base
`tsconfig.json` that every configuration extends, then remove the per-config copies.

**Symptom: CI is strict and your editor is not, or the reverse.** Cause: on v22.1.3 and earlier the
language service did not account for the new default — the fix is CHANGELOG 22.1.4, *"account for
strictTemplates being enabled by default"*. Fix: match your editor's Angular language-service version
to the project's, and prefer the workspace version over a globally installed one.

## Interview questions

**★ Is `strictTemplates` on or off by default in the current Angular?**
On, since v22.0.0, and the getter is explicit about the shape: `return this.options.strictTemplates
!== false`, under a doc comment reading *"strictTemplate is `true` by default. Explicit opt-out is
required to disable strictness"*. Only the literal `false` turns it off. This is the reverse of every
version through v21, where it was `!!this.options.strictTemplates || !!this.options.fullTemplateTypeCheck`.
⚠️ The template-typecheck guide on angular.dev has not been updated and still describes it as
opt-in; the reference page for compiler options is the one that is correct.

**★ How would you convince a sceptical colleague that the default really changed, given the guide says
otherwise?**
Show the getter and its doc comment first, then the v21 getter beside it — the diff is unambiguous.
Then point at the release notes, which are built around the change: a migration that writes the flag
into your `tsconfig` during `ng update`, a second migration disabling `nullishCoalescingNotNullable`
and `optionalChainNotNullable` because the team knew they would fire across existing code, a
breaking-change note saying exactly that, and a 22.1.4 language-service fix described as *"account
for strictTemplates being enabled by default"*. Four independent artefacts that only make sense if
the default flipped. The guide page is simply stale, and the reference page in the same repository
agrees with the source.

**★ What is `typeCheckHostBindings`, and why does it surprise people?**
It enables type checking of expressions in a `host: {…}` literal and in `@HostBinding` /
`@HostListener`, and it defaults to `true` via `?? true` — a separate option from `strictTemplates`
with its own default. It surprises people twice: first because it is documented only on the
compiler-options reference page and not on the template type-checking guide, so an upgrade produces
errors in a category nobody thought of as checked code; and second because being separate means
`strictTemplates: false` does not disable it. Its parse-level companion is NG5001
`HOST_BINDING_PARSE_ERROR`, raised for things like a pipe in a host expression.

**A team upgrading to v22 gets hundreds of new template errors. How do you triage?**
Establish first that these are pre-existing defects newly made visible rather than a regression,
because that changes the conversation about scheduling entirely. Let the migration write
`strictTemplates` into `tsconfig` so the upgrade and the cleanup are separate changes. Then group the
errors by the flag that produces them and disable the narrowest ones temporarily —
`strictNullInputTypes` and `strictAttributeTypes` typically account for the bulk, the first because
libraries written before `strictNullChecks` have incomplete typings, the second because boolean
attributes like `<input disabled>` arrive as strings. Re-enable one flag at a time.

**Why did Angular ship a migration that writes a flag into your config rather than just changing the
default?**
Because the two are not the same for existing projects. Changing the default silently alters the
behaviour of every project on upgrade; writing the flag pins current behaviour so the version bump
is safe and the strictness change becomes a separate, deliberate commit. It is the standard way to
flip a default without making the upgrade itself the breaking event, and here it is visible in the
CHANGELOG as *"add strictTemplates to tsconfig during ng update"*.

**Why is NG5001 unaffected by every strictness flag?**
Because it is raised during *parsing* of a host expression, not during type checking. The host
binding grammar does not accept pipes, so `'name | titlecase'` fails before any type is considered.
Strictness flags change what the type-check block generates; they cannot rescue an expression that
never parsed.

---

← Prev: [14e · The errors that never arrive](14e-the-errors-that-never-arrive.md) · Index: [Topic index](README.md) · Next → [14g · What turning `strictTemplates` off costs](14g-what-turning-strict-templates-off-costs.md)
