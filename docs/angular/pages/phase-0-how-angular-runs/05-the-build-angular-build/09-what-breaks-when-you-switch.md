---
title: "Three of the six Known Issues are about your own code and its output — and the first of them, `index.html` moving one directory deeper, breaks deploy scripts rather than builds, which is why it is the one that reaches production"
sidebar_label: "09 · What breaks when you switch"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the Known Issues section of
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)
> and [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build), quoted verbatim, plus
> [`packages/angular/build/src/tools/esbuild/commonjs-checker.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/commonjs-checker.ts)
> and `execute-build.ts` at tag `v22.1.7`.
> Documentation-validated; **no sandbox run** — any warning block below is quoted from angular.dev,
> not produced here.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Angular publishes a Known Issues list for this migration and it is unusually honest — one entry
is an acknowledged bug in esbuild, linked to its upstream issue.** What makes it worth reading
carefully rather than skimming is that the entries are sorted the wrong way round for a reader's
instincts: the ones that fail loudly at build time are the easy ones. This page takes the three that
are about your code and the shape of its output; [09b · What the build stops telling
you](09b-what-the-build-stops-telling-you.md) takes the three that are about what the build checks
and reports.

## 1 · The output moved one directory deeper

> *"By default, after a successful build by the application builder the bundle is located in a
> `dist/<project-name>/browser` directory (instead of `dist/<project-name>` for the browser
> builder). This might break some of the toolchains that rely the previous location. In this case,
> you can [configure the output path](https://angular.dev/reference/configs/workspace-config#output-path-configuration)
> to suit your needs."*

🔴 **This one reaches production, because nothing fails.** The build succeeds, the artefact
directory exists, and the deploy uploads a folder containing a `browser/` subdirectory instead of an
`index.html`. The first symptom is a 404 on a site that "built fine".

Gate it in CI, where the assertion costs nothing:

```bash
test -f dist/my-app/browser/index.html || { echo "browser output missing"; exit 1; }
```

The `outputPath` object that lets you reshape this is topic 06's territory.

## 2 · Namespace imports of CommonJS default exports

> *"TypeScript by default allows default exports to be imported as namespace imports and then used
> in call expressions. This is unfortunately a divergence from the ECMAScript specification. The
> underlying bundler (`esbuild`) within the new build system expects ESM code that conforms to the
> specification. The build system will now generate a warning if your application uses an incorrect
> type of import of a package."*

The warning, quoted from angular.dev — this is documentation text, not output produced here:

```text
▲ [WARNING] Calling "moment" will crash at run-time because it's an import namespace object, not a function [call-import-namespace]

    src/main.ts:2:12:
      2 │ console.log(moment().format());
        ╵             ~~~~~~

Consider changing "moment" to a default import instead:

    src/main.ts:1:7:
      1 │ import * as moment from 'moment';
        │        ~~~~~~~~~~~
        ╵        moment
```

⚠️ **Read the severity: it is a WARNING, and the failure is at run time.** The build goes green and
the page throws `moment is not a function` in the browser. Before:

```ts
import * as moment from 'moment';

console.log(moment().format());
```

After:

```ts
import moment from 'moment';

console.log(moment().format());
```

> *"However, you can avoid the runtime errors and the warning by enabling the `esModuleInterop`
> TypeScript option for the application and changing the import to the following"*

```jsonc
// tsconfig.app.json
{ "compilerOptions": { "esModuleInterop": true } }
```

Note that the automated migration sets `esModuleInterop` for you when it merges
`tsconfig.server.json` into `tsconfig.app.json` — which is one more reason a manual migration is the
riskier of the two paths ([08](08-migrating-off-webpack.md)).

## 3 · Order-dependent side-effectful imports

> *"Import statements that are dependent on a specific ordering and are also used in multiple lazy
> modules can cause top-level statements to be executed out of order. This is not common as it
> depends on the usage of side-effectful modules and does not apply to the `polyfills` option. This
> is caused by a [defect](https://github.com/evanw/esbuild/issues/399) in the underlying bundler but
> will be addressed in a future update."*

🔴 **An acknowledged upstream bug, named with its issue number.** There is no configuration that
fixes it. The conditions are narrow — a module with non-local side effects, imported from more than
one lazily-loaded route, where the order of the top-level statements matters — and when they are all
met the symptom is a value that is undefined only on some navigation paths.

The documentation's advice is the real fix and is worth taking on its own merits:

> *"IMPORTANT: Avoiding the use of modules with non-local side effects (outside of polyfills) is
> recommended whenever possible regardless of the build system being used and avoids this particular
> issue. Modules with non-local side effects can have a negative effect on both application size and
> runtime performance as well."*

In practice that means moving initialisation out of module scope and into something the framework
calls:

```ts
// side-effectful: runs at import time, order matters
configureLibrary({ locale: 'en-GB' });

// order-independent: runs when Angular bootstraps
export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => configureLibrary({ locale: 'en-GB' })),
  ],
};
```

## Gotchas

**★ Symptom: the build is green, the deploy succeeds, and the site returns 404.** Cause: the
`application` builder writes to `dist/<project>/browser/` and the deploy uploaded
`dist/<project>/`. Fix: point the deploy one level deeper and assert it in CI so the next rename
cannot repeat it:

```bash
test -f dist/my-app/browser/index.html || { echo "browser output missing"; exit 1; }
```

**★ Symptom: `moment is not a function` at run time, from code that compiled with only a
warning.** Cause: `import * as moment` is a namespace import, and calling a namespace object is a
TypeScript divergence from the ECMAScript specification that esbuild does not honour. Fix: use a
default import, and turn on interop so the type system agrees:

```ts
import moment from 'moment';
```

**★ Symptom: a value initialised by a library is `undefined`, but only when you reach the page by
one particular route.** Cause: order-dependent top-level side effects in a module imported by more
than one lazy route — the acknowledged esbuild defect. Fix: no build option changes this. Move the
initialisation out of module scope into an app initializer:

```ts
provideAppInitializer(() => configureLibrary({ locale: 'en-GB' }))
```

**★ Symptom: after a manual migration you hit the namespace-import warning across dozens of files.**
Cause: `esModuleInterop` was never enabled, because you did the migration by hand and the automated
one is what normally sets it. Fix: enable it once rather than rewriting every import:

```jsonc
// tsconfig.app.json
{ "compilerOptions": { "esModuleInterop": true } }
```

## Interview questions

**★ Which failure in this migration is the most dangerous, and why is it not the one that fails the
build?**
The output path. `dist/<project>/browser/` instead of `dist/<project>/` does not fail anything — the
build succeeds, the directory exists, and a deploy script uploads a folder whose only child is
`browser/`. Every other item on the Known Issues list announces itself, at build time or at least in
a warning; this one produces a green pipeline and a 404. The general lesson worth stating is that
the severity of a breaking change is not its loudness: a change that fails at build time is
self-limiting, and a change that silently produces a valid-looking artefact is the one that reaches
users.

**★ Why does `import * as moment from 'moment'` stop working, and what are the two fixes?**
Because TypeScript historically allowed a namespace import to be used in a call expression, which
diverges from the ECMAScript specification, and esbuild implements the specification. The build
emits a warning — `Calling "moment" will crash at run-time because it's an import namespace object,
not a function` — and the actual failure is at run time. The fixes are to change the import to a
default import, or to enable `esModuleInterop` in the application's tsconfig, which is what the
automated migration does for you. Worth adding: this is a warning rather than an error, so a team
that treats warnings as noise ships the crash.

**What is the one item on this list that has no fix?**
The out-of-order execution of top-level statements in side-effectful modules imported by multiple
lazy routes. Angular names it as a defect in esbuild, links the upstream issue, and says it will be
addressed in a future update — there is no option to set. The mitigation is a design change rather
than a configuration one: avoid non-local side effects at module scope, which the documentation
recommends independently of the build system because it also costs application size and runtime
performance.

**Why is `esModuleInterop` worth enabling even though changing the imports also works?**
Because the two fixes have different blast radii. Rewriting every `import * as x` is proportional to
how many such imports exist and has to be repeated whenever a dependency is added that ships a
CommonJS default export. Enabling the compiler option changes the rule once, for the whole
application, and aligns TypeScript's view with what esbuild will actually emit. It is also what the
automated migration does, which is a reasonable signal about the intended path — and a reason a
manual migration is the riskier of the two.

---

← Prev: [The option renames](08b-the-option-renames.md) · Index: [Topic index](README.md) · Next → [What the build stops telling you](09b-what-the-build-stops-telling-you.md)
