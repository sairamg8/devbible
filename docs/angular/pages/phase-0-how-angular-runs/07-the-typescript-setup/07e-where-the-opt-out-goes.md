---
title: "An opt-out written in the wrong tsconfig either does nothing or silently widens to your tests — so the file you put it in is part of the decision, not an afterthought"
sidebar_label: "07e · Where the opt-out goes"
sidebar_position: 7.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Template type checking](https://angular.dev/tools/cli/template-typecheck) (the three hatches and
> the `$any()` description, quoted verbatim and in their published order) — and `angular/angular` at
> tag `v22.1.5`:
> [`packages/compiler-cli/src/ngtsc/core/src/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/core/src/compiler.ts)
> (the `strictTemplates` getter and the override block that applies individual flags, both quoted with
> their own comments).
> Documentation-validated; **no sandbox run** — no build was executed and no diagnostic was captured
> from a terminal.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Choosing an escape hatch is only half of it; the other half is which file you write it in.**
The three tsconfigs of a generated workspace inherit from one another, so the same key means
different things depending on where it lands — narrowing one app, quietly covering the specs too, or
having no effect at all. The ranking of the hatches themselves is
[07c · The escape hatches are ranked](07c-the-escape-hatches-are-ranked.md).

## Which tsconfig the opt-out goes in

angular.dev names *"the application's TypeScript configuration file, `tsconfig.json`"* — the **root**,
not `tsconfig.app.json`. That is not carelessness, and it is the single most common way an opt-out is
applied wrongly.

A CLI workspace's three configs form a **star, not a chain**:

```
tsconfig.json            ← the root. compilerOptions + ALL angularCompilerOptions
├── tsconfig.app.json    ← extends the root. types: [], excludes *.spec.ts
└── tsconfig.spec.json   ← extends the ROOT, not the app config
```

`tsconfig.spec.json` extends the root, so anything you put in `tsconfig.app.json` is **invisible to
tests**. Put `strictTemplates: false` there and `ng build` goes quiet while `ng test` keeps failing on
the same components — which reads as a flaky test setup and is not.

```json
// tsconfig.json — the workspace root. Both leaves inherit this.
{
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictDomEventTypes": false
  }
}
```

The full topology, the `include`/`exclude` split, and the hand-rolled merge that makes
`angularCompilerOptions` inherit at all — TypeScript does not know the key exists — are
[03](03-the-three-tsconfig-files.md) and
[04](04-angularcompileroptions-and-how-it-inherits.md) in this topic.

## The procedure, end to end

1. **Count distinct error codes, not errors.** Four hundred errors is usually three codes.
2. **For each code, find the flag.** [07d](07d-the-other-rejection-classes.md) maps the rejection
   classes to their flags; topic 01's `14h`–`14k` map the flags to the internal behaviour.
3. **Ask whether the code is telling the truth.** `<input matInput disabled>` and a nullable input
   binding are true findings; fix them. `$event.target.value` is a true finding with a bad
   cost-to-value ratio, and the compiler says so itself.
4. **Take the lowest rung that clears the whole class.** One expression → `$any()` or `!`. A whole
   class you have decided not to fix → the flag, in the root, in one commit, with the reason in the
   message.
5. **Never take rung 3 for a rung-2 problem.**

## Gotchas

**★ Symptom: the opt-out went into `tsconfig.app.json` and `ng test` still fails template checking.**
Cause: the star topology — `tsconfig.spec.json` extends the root, not the app config. Fix: move it to
the root:

```json
// tsconfig.json, not tsconfig.app.json
{
  "angularCompilerOptions": {
    "strictTemplates": false
  }
}
```

**Symptom: a flag set in `tsconfig.spec.json` had no effect on the app build.** Cause: same star
topology, other direction. Leaves do not see each other. Fix: put anything shared in the root, and put
a key in a leaf only when you mean *that leaf only* — for example, relaxing a check for tests while
keeping it for the application.

## Interview questions

**★ Where does a `strictTemplates` opt-out belong — `tsconfig.json` or `tsconfig.app.json`?**
The root `tsconfig.json`, which is what angular.dev names. The three configs form a star: the app config
and the spec config each extend the root and neither extends the other. Put the opt-out in
`tsconfig.app.json` and the build stops checking templates while `ng test` carries on failing on the
same components — which looks like a broken test setup and is not. The root is the only place both
programs inherit from, which makes it the only correct home for any shared `angularCompilerOptions`
key.

**What is `$any` and where does it come from?**
It is a pseudo-function in the template expression language, resolved by the Angular compiler when it
builds the type-check block — angular.dev calls it *"the `$any()` cast pseudo-function"* and says the
compiler treats it as a cast to `any` *"just like in TypeScript when a `<any>` or `as any` cast is
used"*. It has no runtime existence and no import; it is not available in a `.ts` file, where the
equivalent is `as any`.

**★ Why is "which file" part of the decision rather than a detail?**
Because the three generated tsconfigs form an inheritance chain, and a key's blast radius is decided
entirely by where it sits. Written into the base, an opt-out covers the application and the specs
together — which is usually wider than intended and hides exactly the template errors tests would
have caught. Written into `tsconfig.app.json`, it covers the application alone. So the same three
words mean two different scopes, with no syntactic difference to warn you, and the narrower choice
is almost always the one you meant.

---

← Prev: [The other rejection classes](07d-the-other-rejection-classes.md) · Index: [Topic index](README.md) · Next → [The other angularCompilerOptions](08-the-other-angular-compiler-options.md)
