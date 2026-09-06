---
title: "Seven things changed in v22 and a project meets all of them on the same build — and every one is the same change viewed from a different angle: the compiler was given more to check"
sidebar_label: "17c · The v22 upgrade wall"
sidebar_position: 17.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) (breaking changes and migrations, `angular/angular`);
> `angular/angular` at tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts),
> [`packages/compiler-cli/package.json`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/package.json) (TypeScript peer range);
> and angular.dev [Extended diagnostics](https://angular.dev/extended-diagnostics), [Update guide](https://angular.dev/update-guide).
> Documentation-validated; **no sandbox run** — no upgrade was performed and no build output was captured.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Everything this topic has described arrives at once on the day a team runs `ng update` to v22.
Seven separate changes, six of them independent, all landing in the same build output — which is
why the upgrade feels like a wall rather than a list. The purpose of this page is to make the wall
legible: each item, what it is, which chunk explains it, and the single sentence that connects all
seven. That sentence is the topic's thesis, and the release is the best evidence for it that exists.**

## The seven, in the order you will meet them

| # | What changed | Where it is explained | First symptom |
|---|---|---|---|
| 1 | `strictTemplates` defaults to `true` | [14f](14f-what-stricttemplates-actually-switches.md) | a wall of template type errors in a project that never opted in |
| 2 | extended diagnostics therefore emit | [15](15-extended-diagnostics.md) | warnings nobody configured, in every component |
| 3 | the `ng update` migration writes two `suppress` entries | [15e](15e-what-changes-underneath-you.md) | a tsconfig diff nobody on the team wrote |
| 4 | `?.` returns `undefined` rather than `null` | [05](05-expressions-statements-and-safe-navigation.md) | a `=== null` check that silently stops matching |
| 5 | `OnPush` is the default `changeDetection` | [06](06-what-the-compiler-emits.md) | a view that stops updating on a mutated object |
| 6 | duplicate selectors are NG8023, at compile time | [17b](17b-the-resolution-errors.md) | a build failure on markup unchanged for years |
| 7 | TypeScript must be `>=6.0 <6.1` | [13b](13b-ngc-is-tsc-and-the-typescript-pin.md) | the upgrade refuses to start |

Two more sit inside item 1's blast radius, both listed as breaking changes in the 22.0.0 CHANGELOG,
verbatim: > *"data prefixed attribute no-longer bind inputs nor outputs."* and > *"`in` variables will
throw in template expressions."*

🔴 **Item 7 is first in practice.** The TypeScript range is a hard peer dependency, so a project on
TypeScript 5.x cannot begin the upgrade at all — the failure arrives before any of the other six are
observable, and it is the one item on the list that is not about templates.

## Why they arrive together

Items 1, 2 and 3 are one change with two consequences and one apology. `strictTemplates` flipping to
`true` turns on the strict type-check flag family *and* the extended-diagnostic family, because the
second is gated behind the first ([15](15-extended-diagnostics.md)). The migration's two
`suppress` entries exist to keep the second consequence from burying the first.

Items 4, 5 and 6 are unrelated to each other and to the flip — a language-semantics change, a
change-detection default, and a new compile-time diagnostic. They share only their release.

**But all six template-side items are the same move**: work that used to be deferred — to runtime, to
a `null` check that happened to pass, to the day someone noticed the wrong component rendering — is
now done by the compiler, at build time, whether you asked or not. That is the entire topic in one
release. A framework whose compiler knows the template's grammar, the component's dependency list and
the type of every expression can check all of this; the only question was ever whether it would do so
by default. In v22 the answer became yes.

## The order to do it in

Not the order of the table — the order that keeps each step's failures readable:

1. **TypeScript first, alone.** Move to a version inside `>=6.0 <6.1` and get the project building on
   the old Angular if it will. This is the only item with no template component, and mixing it with
   the rest makes every other error suspect.
2. **`ng update`, and read the tsconfig diff.** The migration edits `angularCompilerOptions`. Whatever
   it wrote, you now own — [15e](15e-what-changes-underneath-you.md) is how to unwind it deliberately
   rather than by accident.
3. **Triage by code, not by file.** The first build will produce hundreds of diagnostics from a
   handful of distinct causes. Group them by NG code before opening a single component; almost always
   two or three codes account for most of the volume.
4. **Do not reach for `strictTemplates: false`.** It disables the strict flags *and* every extended
   diagnostic, and if you have configured `extendedDiagnostics` at all it fails the build outright with
   NG4003 ([15d](15d-configuring-extended-diagnostics.md)). Turn off individual flags instead —
   [14g](14g-what-turning-strict-templates-off-costs.md) is the argument in full.
5. **Leave `OnPush` for its own pass.** It is a runtime behaviour change, so it does not appear in the
   build output at all; a view that silently stops updating is not something the compiler will tell you
   about, and hunting it while fixing build errors mixes two very different kinds of debugging.

⚠️ **Item 4 is the one with no build-time signal.** `?.` returning `undefined` instead of `null`
changes what a comparison matches, and nothing in the toolchain flags a `=== null` that used to be
true. If a template compares against `null` explicitly, that comparison is now a thing to read.

## What the wall is evidence for

Every item on the list exists because the compiler already had the information and was not using it:

- it always parsed the template, so it could always have known `in` was not a valid expression there;
- it always resolved the component's dependency list, so it could always have known two selectors
  matched ([12](12-ivy-and-locality.md));
- it always generated a type-check block, so it could always have type-checked your bindings
  ([14](14-template-type-checking.md));
- it always had the extended-diagnostic pass, so it could always have run it.

🔴 **None of the seven required new capability. Six required a new default.** That is what it means to
say Angular is a compiler with a framework attached: the ceiling on what can be checked is set by what
the compiler understands, and it understands the template completely. The rest is policy, and policy
moves in a major version.

## Gotchas

**★ Symptom: `ng update` refuses to run at all on a v21 project.** Cause: the TypeScript peer range,
`>=6.0 <6.1`, is checked before anything else happens. Fix: move TypeScript first, in its own commit,
and confirm the project still builds before touching Angular:

```bash
node -p "require('typescript/package.json').version"
node -p "require('@angular/compiler-cli/package.json').peerDependencies.typescript"
```

**★ Symptom: the first v22 build produces hundreds of errors and the team proposes reverting.** Cause:
items 1 and 2 landing together — the strict flags and the extended diagnostics both switch on with one
default. Fix: triage by NG code rather than by file. The distinct causes are usually two or three, and
[14h](14h-the-input-side-flags.md) through [14k](14k-the-checks-with-no-switch.md) map each flag to the
errors it produces, so a whole class can be assessed at once.

**★ Symptom: somebody "fixed" the upgrade by setting `strictTemplates: false`.** Cause: it is the one
switch that makes all the errors disappear. Fix: it also removes every extended diagnostic
([15](15-extended-diagnostics.md)) and, if `extendedDiagnostics` is configured, fails the build with
NG4003 instead. Disable individual flags and keep the rest:

```jsonc
{
  "angularCompilerOptions": {
    "strictTemplates": true,
    "strictInputTypes": false      // narrow, reversible, and keeps the diagnostics
  }
}
```

**★ Symptom: a `=== null` comparison in a template silently stopped matching after the upgrade.**
Cause: item 4 — `?.` now returns `undefined` where it returned `null`. Nothing reports this; it is a
semantics change, not an error. Fix: compare against both, or use `== null`, which matches both by
JavaScript's own coercion rules — and prefer moving the comparison into the class where it can be
type-checked properly.

**★ Symptom: a view stopped updating after the upgrade and no error was produced anywhere.** Cause:
item 5 — `OnPush` is now the default `changeDetection`, so mutating an object without changing its
reference no longer schedules a re-render. Fix: this is a runtime change with no build-time signal.
Treat it as its own pass after the build is green, and note that it is the only item on the list the
compiler cannot help you with.

**★ Symptom: NG8023 on a component library you do not control.** Cause: two components in your
compilation scope match the same element, and the doc's own hint says to check imported libraries
first. Fix: stop importing one of the two into that component's scope, which is a per-component
decision under standalone, rather than trying to change the library's selector.

**Symptom: your tsconfig gained `suppress` entries during the upgrade.** Cause: item 3, the migration.
Fix: [15e](15e-what-changes-underneath-you.md) — demote to `warning`, fix, then delete. Do not leave
them; `suppress` means the check produces nothing at all, forever.

**Symptom: a `data-` prefixed attribute stopped binding an input.** Cause: a v22 breaking change,
verbatim *"data prefixed attribute no-longer bind inputs nor outputs"*. Fix: bind the input by its real
name. If the DOM attribute is genuinely wanted, use `[attr.data-x]`, which is an attribute binding and
was never an input binding.

## Interview questions

**★ Name three v22 changes that turn something previously silent into a build error, and say what they
have in common.**
`strictTemplates` defaulting to `true`, which type-checks every binding that was previously unchecked;
NG8023, which makes two components matching one element a compile error where it was runtime error
NG0300; and `in` throwing in template expressions, which was previously parsed as something. What they
have in common is that none of them required new capability — the compiler already parsed the
template, already knew the component's local dependency list, and already generated a type-check
block. Each is a decision to use information the compiler had, which is why they all landed in one
major: the checks were possible for years, and the defaults were the only thing in the way.

**★ A team is stuck three days into a v22 upgrade with hundreds of errors. What do you tell them to do
first?**
Confirm TypeScript is inside `>=6.0 <6.1` and that the move happened in its own step, because that is
the one item with no template component and it poisons the diagnosis of everything else. Then triage
by NG code rather than by file — the volume is almost always a handful of distinct causes multiplied
across components. Then check what the migration wrote into `angularCompilerOptions`, since two checks
were suppressed on their behalf and they should know that. And talk them out of `strictTemplates:
false`, which makes the symptom vanish, removes every extended diagnostic along with it, and fails the
build outright with NG4003 if they have any `extendedDiagnostics` configuration at all.

**★ Which v22 change will not show up in your build output, and why does that make it the dangerous
one?**
`OnPush` becoming the default `changeDetection`, with the `?.`-returns-`undefined` change close
behind. Both are runtime semantics, not compile-time checks: a component that mutates an object
without changing its reference still compiles perfectly and simply stops re-rendering, and a
`=== null` comparison that is now never true is a valid expression. Everything else on the upgrade
list announces itself as an error or a warning at build time. These do not, which means they are found
by users rather than by CI — the exact failure mode the rest of the release is designed to eliminate.

**Why is the v22 upgrade a good argument for the claim that Angular is "a compiler with a framework
attached"?**
Because the release is almost entirely compiler policy. Six of its seven headline changes are the
compiler being permitted to act on what it already knew — the template's grammar, the component's
dependency list, the types of the expressions — and the seventh is a TypeScript version pin, which
exists because the compiler is a TypeScript transformer and rides its internals. No new runtime
feature is required to explain any of it. A framework whose upgrades are mostly runtime behaviour
would not have that shape.

---

← Prev: [17b · The resolution errors](17b-the-resolution-errors.md) · Index: [Topic index](README.md) · Next topic → [02 · Standalone by default](../02-standalone-by-default/README.md)
