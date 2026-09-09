---
title: "Angular's build system is not Vite-based — esbuild builds in development too, the result is handed to Vite in memory, and the documentation puts \"development server capacity only\" in italics because so many people get this wrong"
sidebar_label: "05 · Vite is only the dev server"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — angular.dev,
> [Angular CLI builds](https://angular.dev/tools/cli/build-system-migration) (§ *Vite as a
> development server*, source `adev/src/content/tools/cli/build-system-migration.md` at tag
> `v22.1.5`); the source of
> [`src/builders/dev-server/builder.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/builder.ts)
> and [`src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`; and the `dependencies` of the published manifest at
> [registry.npmjs.org/@angular/build/22.1.7](https://registry.npmjs.org/@angular/build/22.1.7).
> Documentation- and source-validated; **no sandbox run** — no dev server was started and no
> output is reproduced here.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**"Angular moved to Vite" is the most repeated wrong sentence about the modern Angular build.**
Vite is a real dependency of `@angular/build`, pinned at `8.1.5`, and it is doing real work — but
only while `ng serve` is running, and only as an HTTP server. Vite's bundler never touches your
code. Vite's plugin pipeline is not available to you. There is no `vite.config.ts`, and creating one
does nothing. The documentation is unusually direct about this, to the point of italicising the
limit in its own prose, and getting it right changes how you debug: a difference between `ng serve`
and `ng build` is a difference in *build options*, not a difference between two bundlers.

## The sentence the documentation italicises itself

The whole chunk is one paragraph of angular.dev, and it is worth reading in full before anything
else:

> *"The usage of Vite in the Angular CLI is currently within a `development server capacity only`.
> Even without using the underlying Vite build system, Vite provides a full-featured development
> server with client side support that has been bundled into a low dependency npm package. This
> makes it an ideal candidate to provide comprehensive development server functionality. The
> current development server process uses the new build system to generate a development build of
> the application in memory and passes the results to Vite to serve the application. The usage of
> Vite, much like the Webpack-based development server, is encapsulated within the Angular CLI
> `dev-server` builder and currently cannot be directly configured."*
> — [angular.dev · Vite as a development server](https://angular.dev/tools/cli/build-system-migration#vite-as-a-development-server)

*(The emphasis on "development server capacity only" is the documentation's own italics, rendered
here as code so it survives the quote.)*

Readers skim quotes, so pull the four separate claims out and state each one:

**1 · Vite's bundler is not used.** *"Even without using the underlying Vite build system."*
esbuild builds your application in development exactly as it does in production — same builder,
same compiler plugin, different options. Vite contributes zero transformation of your source.

**2 · The development build never lands on disk.** *"Generate a development build of the application
in memory and passes the results to Vite to serve."* There is no `dist/` output for `ng serve` to
serve from, which is why inspecting your output directory while the dev server runs tells you
nothing about what the browser is receiving.

**3 · Vite is encapsulated in the `dev-server` builder.** Not in your project, not in a config file
you own. It is an implementation detail of one builder, in the same way `webpack-dev-server` was an
implementation detail of the builder before it.

**4 · It *"currently cannot be directly configured."*** This is the sentence people argue with and
it is unambiguous. The only Vite behaviour you can influence is what the `dev-server` builder
chooses to expose as its own options.

## The code says the same thing

`dev-server/builder.ts` at `v22.1.7` wires it together in one call:

```ts
yield* serveWithVite(
  normalizedOptions,
  builderName,
  (options, context, plugins) =>
    buildApplicationInternal(options, context, { codePlugins: plugins }),
  context,
  { indexHtml: extensions?.indexHtmlTransformer },
  extensions,
);
```

Read the third argument. **The build function handed to `serveWithVite` is
`buildApplicationInternal`** — the same application build that `ng build` performs, described in
[01 · What `ng build` actually runs](01-what-ng-build-actually-runs.md). Vite is being given a
function that produces an Angular build; it is not building anything itself. That is the mechanical
form of claim 1, and it is why "the dev server uses a different bundler" is false.

## The three Vite knobs the builder exposes, and where the rest went

*"Cannot be directly configured"* does not mean *no* Vite behaviour is reachable — it means the only
route is an option the `dev-server` builder declares. Three of its options are Vite pass-throughs,
and each says so in its own schema description:

| Builder option | What it reaches |
|---|---|
| `allowedHosts` | *"This option sets the Vite option of the same name."* — [`dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json) |
| `proxyConfig` | Vite's proxy, whose path-matching rules differ from the webpack dev server's |
| `prebundle` | Vite's dependency pre-bundling, on by default |

Everything else in Vite's server configuration — the file-system allow list, watcher options, the
plugin array, the middleware mode — is simply not reachable. **The full nineteen-option surface of
the `dev-server` builder, including the proxy semantics change and the `PORT` precedence rule** is
[06 · The dev-server contract](06-the-dev-server-contract.md). `prebundle` is
**[05b · Prebundling](05b-prebundling.md)**, and what hot module replacement can actually replace —
which three primary sources describe three different ways — is
**[05c · What HMR actually replaces](05c-what-hmr-actually-replaces.md)**.

## The Vite version is not yours to choose

This is the practical consequence that catches teams during a security review. From the published
manifest:

```json
"dependencies": {
  "esbuild": "0.28.2",
  "vite": "8.1.5",
  "rolldown": "1.2.0"
}
```

`vite` is a **direct dependency at an exact pin**, not a peer and not a range. You do not select it,
you do not widen it, and installing your own copy does not replace the one `@angular/build`
resolves. When a Vite advisory lands, the upgrade path is an Angular CLI release that bumps the pin
— which arrives through `ng update`, not through editing your `package.json`. See
[04 · `ng update`, not `npm install`](../04-ng-update-not-npm-install/README.md) for why hand-editing
the version is the wrong lever.

⚠️ **Compare this with `rollup`, which *is* an optional peer** — see
[04c · The Rolldown switch](04c-the-rolldown-switch-and-the-environment.md). The difference is
deliberate: an optional peer is something you may supply, a pinned dependency is something the
package insists on.

## Gotchas

**★ Symptom: you add a `vite.config.ts` to an Angular project and nothing changes.** Cause: the
documentation's own words — Vite is *"encapsulated within the Angular CLI `dev-server` builder and
currently cannot be directly configured."* No file with that name is read, by any Angular builder.
Fix: delete it, and configure the `dev-server` builder instead, which is where every supported knob
lives:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "buildTarget": "my-app:build:development",
    "allowedHosts": ["my-tunnel.example.dev"]
  }
}
```

**★ Symptom: you follow a Vite recipe that begins "add this plugin to `vite.config.ts`" and there is
nowhere to put it.** Cause: the Vite plugin pipeline is not exposed by the `dev-server` builder, and
Vite is not building your code anyway — esbuild is. Fix: ask what the plugin actually does. If it
transforms source, the equivalent is an esbuild-stage feature of the `application` builder
(`define`, `loader`, and the rest, in [10 · Features only this builder has](10-features-only-this-builder-has.md)).
If it serves something, the equivalent is a `dev-server` option such as `proxyConfig` or `headers`:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "buildTarget": "my-app:build:development",
    "proxyConfig": "src/proxy.conf.json"
  }
}
```

**★ Symptom: your security scanner flags the bundled Vite version and adding `vite` to
`devDependencies` does not change what the CLI uses.** Cause: `vite` is a direct dependency of
`@angular/build` at the exact pin `8.1.5`; your own copy is a second, unused installation. Fix:
upgrade the package that owns the pin, and confirm which copy is actually resolved:

```bash
npm ls vite
ng update @angular/cli
```

**★ Symptom: a design document or an architecture review states that the project "uses Vite".**
Cause: reading a dependency list as an architecture. Fix: state the accurate version — esbuild
bundles in both development and production, Rolldown re-chunks production output, and Vite serves
during `ng serve` only. The evidence is one line of angular.dev and one call in `builder.ts`; cite
them rather than the dependency list.

**Symptom: you want Vite's dev-server options — `server.fs.allow`, `server.watch`, middleware — and
cannot find them in `angular.json`.** Cause: the `dev-server` builder declares
`additionalProperties: false` and exposes nineteen options; anything Vite offers beyond those three
pass-throughs is unreachable. Fix: check the option actually exists before configuring around it,
and expect a schema error rather than silence if it does not:

```bash
node -p "Object.keys(require('@angular/build/src/builders/dev-server/schema.json').properties)"
```

**Symptom: an SSR or prerendering behaviour differs between `ng serve` and the built server.**
Cause: the dev server builds in memory with development options and serves through Vite, which is a
different execution environment from the Node server produced by a production build. Fix: verify
server behaviour against a real build rather than the dev server:

```bash
ng build --configuration production
node dist/my-app/server/server.mjs
```

## Interview questions

**★ Is Angular's build system Vite-based?**
No. Vite is present, and it is doing real work, but only as a development server. The documentation
states the boundary in a sentence it italicises itself — Vite's usage is *"within a development
server capacity only"* — and adds *"even without using the underlying Vite build system."* What
actually compiles and bundles your code, in development as well as production, is esbuild with the
Angular compiler running as a plugin. The corroboration in code is that the dev-server builder hands
`serveWithVite` a callback that calls `buildApplicationInternal` — the same application build
`ng build` performs. Saying "Angular uses Vite" without that qualifier leads people to expect Vite
plugins, `vite.config.ts` and Vite's build behaviour, none of which exist here.

**★ What exactly does Vite do during `ng serve`?**
It serves. The Angular build system produces a development build in memory, hands the result to
Vite, and Vite provides the HTTP server, the client-side runtime for reload and hot replacement, and
dependency pre-bundling. The documentation's reasoning for choosing it is explicit: Vite
*"provides a full-featured development server with client side support that has been bundled into a
low dependency npm package"*, which made it *"an ideal candidate to provide comprehensive
development server functionality"*. It replaced `webpack-dev-server` in exactly that role and in no
other.

**★ Why is there no `vite.config.ts` in an Angular project, and what do you do instead?**
Because Vite is encapsulated inside the `dev-server` builder and, in the documentation's words,
*"currently cannot be directly configured."* Nothing reads a `vite.config.ts`, so adding one is
inert rather than wrong — which is worse, because it fails silently. What you configure instead is
the `dev-server` builder's own option surface, three of whose options are deliberate Vite
pass-throughs: `allowedHosts`, which the schema says *"sets the Vite option of the same name"*,
`proxyConfig`, and `prebundle`. Anything Vite can do that is not exposed there is unreachable, and
the honest answer to "how do I set it" is "you cannot".

**★ Why can you not upgrade Vite independently of the Angular CLI?**
Because `vite` is a direct dependency of `@angular/build` at the exact pin `8.1.5` at 22.1.7 — not
a peer dependency and not a range. Adding `vite` to your own `package.json` installs a second copy
that nothing resolves. So a Vite advisory is handled by upgrading the package that owns the pin,
which means an Angular CLI release and `ng update`. Contrast this with `rollup`, which *is* declared
as an optional peer precisely because it is a path the user may supply; the difference in
declaration is the difference in who owns the version.

---

← Prev: [The Rolldown switch](04c-the-rolldown-switch-and-the-environment.md) · Index: [Topic index](README.md) · Next → [Prebundling](05b-prebundling.md)
