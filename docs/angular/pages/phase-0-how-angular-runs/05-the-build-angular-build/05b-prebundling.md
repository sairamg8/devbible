---
title: "Prebundling is what makes `ng serve` fast, and it is silently conditional on the Angular CLI disk cache — so a project that turned caching off has turned prebundling off too, and nothing says so"
sidebar_label: "05b · Prebundling"
sidebar_position: 5.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — angular.dev,
> [Angular CLI builds](https://angular.dev/tools/cli/build-system-migration) (§ *Prebundling*,
> § *Vite as a development server*; source
> `adev/src/content/tools/cli/build-system-migration.md` at tag `v22.1.5`); the `prebundle` entry of
> [`src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`; and
> [angular.dev · workspace configuration](https://angular.dev/reference/configs/workspace-config#cache-options)
> for the CLI cache defaults. Documentation- and source-validated; **no sandbox run** — no dev
> server was started and no timing is claimed anywhere on this page.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Prebundling is the single biggest reason `ng serve` rebuilds feel instant, and it is conditional
on something that lives in a different part of `angular.json` entirely.** Vite processes your
third-party dependencies once and reuses the result across every rebuild and every restart — but the
`prebundle` option's own schema says the Angular CLI cache must be enabled for that to happen, and
that sentence appears nowhere in the prose documentation. A team that disables the cache for an
unrelated reason gets a slower dev server, no warning, and no obvious connection between the two.
This page is that mechanism, its prerequisite, and the narrow set of cases where you are supposed to
intervene.

## Prebundling — what it is

> *"Prebundling provides improved build and rebuild times when using the development server. Vite
> provides [prebundling capabilities](https://vite.dev/guide/dep-pre-bundling) that are enabled by
> default when using the Angular CLI. The prebundling process analyzes all the third-party project
> dependencies within a project and processes them the first time the development server is
> executed. This process removes the need to rebuild and bundle the project's dependencies each
> time a rebuild occurs or the development server is executed."*
> — [angular.dev · Prebundling](https://angular.dev/tools/cli/build-system-migration#prebundling)

The economics are the whole point. Your own source changes constantly and must be rebuilt on every
keystroke; `node_modules` changes almost never. Processing dependencies once and reusing the result
takes the largest and least interesting part of the graph out of the rebuild loop entirely — *"each
time a rebuild occurs **or the development server is executed**"*, so the saving survives restarts,
not just rebuilds.

Note which half of the build this belongs to. Prebundling is a **Vite** capability, exposed through
one `dev-server` builder option — it is one of the three Vite pass-throughs named in
[05 · Vite is only the dev server](05-vite-is-only-the-dev-server.md), and it has no effect on
`ng build`.

## 🔴 Prebundling requires the CLI cache

The `prebundle` option's own schema description carries a condition that appears nowhere in the
prose documentation:

> *"Enable and control the Vite-based development server's prebundling capabilities. To enable
> prebundling, the Angular CLI cache must also be enabled."*
> — [`dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json), `prebundle`, default `true`

So this, in `angular.json`, is not only a cache decision:

```json
{
  "cli": {
    "cache": { "enabled": false }
  }
}
```

It turns prebundling off as well, and nothing announces that. A team that disables the cache to
chase a stale-build bug gets a slower `ng serve` as a side effect and usually attributes it to
something else entirely.

⚠️ **The same coupling reaches further than `enabled`.** The CLI cache also has an `environment`
setting, documented as *"Configure in which environment disk cache is enabled"*, whose default is
`local` — caching outside CI, not in it. Combining the two documented facts, a dev server started
inside CI (an end-to-end job, say) is running with the cache off and therefore, by the schema's own
condition, without prebundling. That is an inference from two defaults rather than a sentence
anyone wrote down; the cache options themselves belong to
[11 · Cache, workers and the environment variables](11-cache-and-workers.md), and the `cli` section of
`angular.json` to [topic 06 · `angular.json` anatomy](../06-angular-json-anatomy/README.md).

## When you need to customise it

> *"In most cases, no additional customization is required. However, some situations where it may
> be needed include:*
> *- Customizing loader behavior for imports within the dependency such as the [`loader` option](https://angular.dev/tools/cli/build-system-migration#file-extension-loader-customization)*
> *- Symlinking a dependency to local code for development such as [`npm link`](https://docs.npmjs.com/cli/v10/commands/npm-link)*
> *- Working around an error encountered during prebundling of a dependency"*
> — [angular.dev · Prebundling](https://angular.dev/tools/cli/build-system-migration#prebundling)

*(The `loader` link is site-relative in the source and has been absolutised here; it points at
angular.dev's own section, not at this page.)*

The middle bullet is the one that costs people an afternoon. A dependency you have symlinked with
`npm link` is, as far as prebundling is concerned, a third-party dependency like any other — it gets
processed once and reused, so your edits to the linked package do not appear.

The two supported forms, verbatim from the documentation:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "prebundle": {
      "exclude": ["some-dep"]
    }
  }
}
```

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "prebundle": false
  }
}
```

And the recommendation between them, also verbatim:

> *"By default, `prebundle` is set to `true` but can be set to `false` to fully disable prebundling.
> However, excluding specific dependencies is recommended instead since rebuild times will increase
> with prebundling disabled."*

🔴 **`exclude` is a scalpel and `false` is an amputation.** Excluding one package costs you the
prebundling of one package; disabling the feature costs you the prebundling of every dependency in
`node_modules`, on every rebuild, for the rest of the project's life. Reach for `false` only while
diagnosing, and put back an `exclude` when you know which dependency was the problem.

## The other half of the dev server's speed

Prebundling makes the *rebuild* cheap. Hot module replacement decides what happens to the browser
once a rebuild lands — and its scope at 22.1.7 is described three incompatible ways by three
primary sources, which is why it gets its own page rather than a paragraph here:
**[05c · What HMR actually replaces](05c-what-hmr-actually-replaces.md)**.

## Gotchas

**★ Symptom: `ng serve` became noticeably slower after someone set `"cache": { "enabled": false }`
in `angular.json`.** Cause: the `prebundle` schema states *"To enable prebundling, the Angular CLI
cache must also be enabled"*, so disabling the cache disables prebundling as a side effect, silently.
Fix: leave the cache on and exclude the specific dependency that motivated the change:

```json
{
  "cli": { "cache": { "enabled": true } },
  "projects": {
    "my-app": {
      "targets": {
        "serve": {
          "builder": "@angular/build:dev-server",
          "options": { "prebundle": { "exclude": ["some-dep"] } }
        }
      }
    }
  }
}
```

**★ Symptom: a dependency you are developing locally with `npm link` shows stale code in `ng serve`,
while `ng build` picks up your edits.** Cause: prebundling processes third-party dependencies once
and reuses the result; a symlinked package is still a third-party dependency to it. angular.dev
names this case explicitly. Fix: exclude the linked package rather than disabling the feature:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "buildTarget": "my-app:build:development",
    "prebundle": { "exclude": ["@acme/ui-kit"] }
  }
}
```

**★ Symptom: `ng serve` fails with an error that names a dependency you never import directly.**
Cause: an error *"encountered during prebundling of a dependency"* — the third bullet of the
documentation's own list. Fix: exclude the offending package to confirm the diagnosis, and keep the
exclusion narrow:

```json
"prebundle": { "exclude": ["problematic-dep"] }
```

**Symptom: someone sets `"prebundle": false` to fix one broken dependency and every rebuild gets
slower.** Cause: `false` disables prebundling for the entire dependency graph; the documentation is
explicit that *"excluding specific dependencies is recommended instead since rebuild times will
increase with prebundling disabled."* Fix: narrow it to the package that was actually broken:

```json
"prebundle": { "exclude": ["broken-dep"] }
```

**Symptom: the first `ng serve` after clearing `.angular/cache` is much slower than the next one.**
Cause: prebundling processes dependencies *"the first time the development server is executed"* and
stores the result in the CLI cache, which you just deleted. Fix: expected — but avoid deleting the
cache as a reflex, and check what you are actually deleting first:

```bash
node -p "require('./angular.json').cli && require('./angular.json').cli.cache"
```

**Symptom: a dependency was upgraded but the dev server still serves the old code.** Cause: a
prebundled copy of the dependency. Fix: restart the dev server, and if it persists, exclude the
package while you investigate — noting that the documentation does not state when a prebundled
dependency is invalidated, so do not assume a lockfile change is enough:

```json
"prebundle": { "exclude": ["recently-upgraded-dep"] }
```

## Interview questions

**★ What is prebundling and why does it make `ng serve` feel fast?**
It is Vite's dependency pre-bundling, enabled by default under the Angular CLI. The documentation
describes it as analysing *"all the third-party project dependencies within a project"* and
processing them *"the first time the development server is executed"*, which *"removes the need to
rebuild and bundle the project's dependencies each time a rebuild occurs or the development server
is executed."* The economics are the reason it works: your own source changes constantly, and
`node_modules` almost never does, so taking the largest and most static part of the module graph out
of the rebuild loop is the single biggest available saving. Note the second half of that sentence —
the benefit survives restarts, not only rebuilds.

**★ What is prebundling's hidden prerequisite, and how would you notice it was missing?**
The Angular CLI disk cache. The `prebundle` option's schema description says *"To enable
prebundling, the Angular CLI cache must also be enabled"*, and nothing else in the documentation
repeats it. The symptom is a dev server that is slower than it used to be with no change to the
serve configuration — because the change was to `cli.cache`, somewhere else in `angular.json`
entirely. It is worth knowing the second-order version too: the cache's `environment` setting
defaults to `local`, meaning caching is off inside CI, so by the same coupling a dev server started
in a CI job is running without prebundling. That last step is an inference from two documented
defaults rather than a documented statement, and it is worth flagging as such.

**★ Why does the documentation recommend `prebundle: { exclude: [...] }` over `prebundle: false`?**
Because the two have wildly different costs for the same benefit. Excluding one package removes one
package from prebundling; `false` removes every dependency in the project, and the documentation
spells out the consequence — *"rebuild times will increase with prebundling disabled."* The cases
that genuinely need intervention are narrow and named: customising loader behaviour for imports
inside a dependency, working on a symlinked package via `npm link`, and working around an error hit
while prebundling one specific dependency. All three are about a particular package, so all three
are `exclude` cases. `false` is a diagnostic step, not a configuration.

**Does prebundling affect `ng build`?**
No. It is a capability of the Vite development server, reached through one option of the
`@angular/build:dev-server` builder, and it exists to remove dependencies from the *rebuild* loop.
`ng build` runs the `application` builder with no dev server involved, so nothing about
`prebundle` applies to it. This is worth being precise about because it is a common source of
confused advice: someone whose production build is slow is told to "disable prebundling", which
changes nothing about their production build and makes their development loop worse. The production
build's caching story is a different mechanism entirely — the `.angular/cache` persistent build
cache — even though both are gated by the same `cli.cache` setting.

**Where does the prebundled output live, and when is it invalidated?**
It lives in the Angular CLI cache, which is what the `prebundle` schema's prerequisite is really
telling you: without somewhere to persist the processed dependencies, there is nothing to reuse.
The default cache path is `.angular/cache`, per the workspace configuration's `cache.path`. What I
cannot tell you from the documentation is the **invalidation rule** — angular.dev states that
dependencies are processed *"the first time the development server is executed"* and does not say
what makes that result stale. So the honest operational advice is: if a dependency upgrade is not
showing up, restart the dev server first, and treat "the lockfile changed so it must have been
re-prebundled" as an assumption you have not verified.

---

← Prev: [Vite is only the dev server](05-vite-is-only-the-dev-server.md) · Index: [Topic index](README.md) · Next → [What HMR actually replaces](05c-what-hmr-actually-replaces.md)
