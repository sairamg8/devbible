---
title: "`src/main.ts` is three imports and one call — `bootstrapApplication(App, appConfig)` is the only line Angular defines, and the `.catch` is what stands between a failed startup and a blank page"
sidebar_label: "03e · `main.ts` and the load-bearing `.catch`"
sidebar_position: 3.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `application` schematic's [`standalone-files/src/main.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/main.ts.template) in `angular/angular-cli` at tag `v22.1.7`; and angular.dev — [Workspace and project file structure](https://angular.dev/reference/configs/file-structure), quoted verbatim.
> Split out of [03 · The `src` directory](03-the-src-directory.md) on 2026-09-10, on a concept
> boundary. Documentation-validated; **no sandbox run** — every file is read from its `.template`
> source, not captured from a generated project.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`src/main.ts` is three imports and one call, and the one line that looks like boilerplate is the
one that matters.** `bootstrapApplication` returns a promise; the generated `.catch` is what turns a
failed startup into a console error instead of a blank page.

## `src/main.ts` — three imports, one call, and a `.catch` that is load-bearing

The template, complete, with `<%= suffix %>` empty under the default `fileNameStyleGuide` of
`'2025'`:

```text
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app<%= suffix %>';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

Resolved:

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

angular.dev, verbatim: *"The main entry point for your application."*

Four sentences, and then this page stops:

1. **It is three imports and one call.** That is the entire entry point of an Angular application —
   there is no framework-supplied runtime file, no registration step, nothing hidden.
2. **`App` is the first argument and `appConfig` the second, and the second is optional.** Neither
   the file `app.config.ts` nor the exported name `appConfig` is an API; `bootstrapApplication` only
   requires that the second argument structurally match `ApplicationConfig`.
3. 🔴 **The `.catch` is not boilerplate.** `bootstrapApplication` returns a promise, so a startup
   failure *rejects* rather than throwing. Without a rejection handler a failed bootstrap can
   produce a blank page and a completely empty console —
   [06c · When a startup initializer fails](../03-the-provider-array/06c-when-a-startup-initializer-fails.md)
   walks that failure end to end.
4. **Everything about what the call does** — the injector tiers it builds, the order in which
   providers and initializers run, what happens between the call and the first render — is
   [01 · `app.config.ts` and what bootstrap does with it](../03-the-provider-array/01-app-config-and-what-bootstrap-does-with-it.md).
   That page carries this same file verbatim and the full six-step order. It is not repeated here on
   purpose: two copies of a sequence is two copies that can drift.

## Gotchas

**★ Symptom: the app renders nothing and the browser console is empty.** Cause: bootstrap rejected
before the root component was created, and the rejection handler was removed or replaced with
something silent. Fix: keep the generated `.catch`, and make it loud:

```ts
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

[06c · When a startup initializer fails](../03-the-provider-array/06c-when-a-startup-initializer-fails.md)
is the full diagnosis of what can reject here.

## Interview questions

**★ `main.ts` ends with `.catch((err) => console.error(err))`. Is that boilerplate you can delete?**
No. `bootstrapApplication` returns a promise, so a startup failure rejects it instead of throwing.
Delete the handler and a failed bootstrap can present as a blank page with an empty console — the
worst possible diagnostic, because there is nothing to search for. Anything that can reject during
startup, an application initializer above all, fails this way.

---

← Prev: [03d · `public/` is a sibling of `src/`](03d-public-is-a-sibling-of-src.md) · Index: [Topic index](README.md) · Next → **04 · The root component** *(not written yet)*
