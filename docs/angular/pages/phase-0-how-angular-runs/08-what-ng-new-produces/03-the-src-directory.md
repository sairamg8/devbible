---
title: "Outside `src/app/` the source directory is four files, and only one of them is load-bearing — an HTML shell whose `<base href>` the router genuinely requires, a one-line stylesheet whose extension is a CLI option, a `public/` folder that is a sibling of `src/` rather than inside it, and a five-line entry point whose `.catch` is all that separates a failed startup from a blank page"
sidebar_label: "03 · The `src` directory"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `application` schematic's templates in
> `angular/angular-cli` at tag `v22.1.7`:
> [`common-files/src/index.html.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/index.html.template),
> [`common-files/src/styles.__style__.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/styles.__style__.template),
> [`common-files/public/favicon.ico.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/public/favicon.ico.template),
> [`standalone-files/src/main.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/main.ts.template)
> and [`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts);
> and angular.dev —
> [Workspace and project file structure](https://angular.dev/reference/configs/file-structure),
> [Router reference](https://angular.dev/guide/routing/router-reference), quoted verbatim.
> Documentation-validated; **no sandbox run** — every file below is read from its `.template`
> source, not captured from a generated project.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`src/index.html` is the only file in the source root the framework will not let you invent for
yourself, and even then the part that matters is one tag.** Everything else here is a template
author's choice: `styles.css` could be called anything and its extension is a flag, `public/` was
`src/assets/` two years ago, and `main.ts` is five lines of which `bootstrapApplication(App,
appConfig)` is the only one Angular defines. The value of reading these four files carefully is not
memorising them — it is learning which line you can delete without consequence and which one
silently costs you routing.

## The four files, and which template wrote each

The `application` schematic renders two template sets. `common-files/` is rendered for both
standalone and NgModule projects; `standalone-files/` is the v22 default branch. Which set a file
comes from tells you whether it survives `--no-standalone`.

| Path in a generated workspace | Template it came from | Set |
|---|---|---|
| `src/index.html` | `src/index.html.template` | `common-files/` |
| `src/styles.css` | `styles.__style__.template` | `common-files/` |
| `public/favicon.ico` | `public/favicon.ico.template` | `common-files/` |
| `src/main.ts` | `src/main.ts.template` | `standalone-files/` |

`src/app/` — `app.ts`, `app.html`, `app.css`, `app.spec.ts`, `app.config.ts`, `app.routes.ts` — is
**the root component** *(not written yet)* and the files bootstrap reads. `public/` is listed
here because it arrives with `src/`, but note it is **not inside it**.

Where each file is covered: `src/index.html` here and in [03b · `index.html` is a shell the build rewrites](03b-index-html-is-a-shell-the-build-rewrites.md); `src/styles.css` in
[03c](03c-styles-css-and-its-extension.md); `public/` in [03d](03d-public-is-a-sibling-of-src.md); `src/main.ts` in [03e](03e-main-ts-and-the-load-bearing-catch.md).

## `src/index.html`, from its template source

The `.template` file at `v22.1.7`, complete. This is EJS, not HTML — `<%= … %>` is a substitution
and the file is not valid markup until the schematic renders it:

```text
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title><%= utils.classify(name) %></title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <<%= selector %>></<%= selector %>>
</body>
</html>
```

Resolved for `ng new my-app` with the default `prefix` of `app`, which makes the root selector
`app-root`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MyApp</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
</head>
<body>
  <app-root></app-root>
</body>
</html>
```

angular.dev's one-line description, verbatim:

> *"The main HTML page that is served when someone visits your site."*

Eleven lines. Four of them are worth an explanation and the rest are ordinary HTML boilerplate.

## `<base href="/">` is the router's dependency, not decoration

This is the one line in the file whose removal breaks something a beginner will not connect back to
it. angular.dev's [Router reference](https://angular.dev/guide/routing/router-reference), verbatim:

> *"You must add a `<base href>` element to the application's `index.html` for `pushState` routing
> to work."*

and, on the consequence of leaving it out:

> *"Without that tag, the browser might not be able to load resources (images, CSS, scripts) when
> 'deep linking' into the application."*

Two separate consequences in two sentences, and it is worth keeping them separate: the *router*
needs a base URL to resolve routes against, and the *browser* needs one to resolve every relative
URL on a deep-linked page. Deleting the tag degrades both, and the second failure shows up as
missing images rather than as a routing error, which is why it is rarely diagnosed correctly.

The default strategy is the one that needs it:

> *"HTML5 style navigation is the router default."*

Three escape routes exist, and they are not interchangeable:

- **Change the value at build time.** `ng build --base-href /my-app/` rewrites the tag in the
  emitted `index.html`. It is a build option, not a source edit, so the same source tree can be
  deployed at several paths — [`baseHref`](../06-angular-json-anatomy/11-outputpath-index-and-dist.md)
  in `angular.json` is the persistent form of the same flag.
- **Supply the value through DI instead.** The documentation's wording, verbatim:
  *"Provide the router with an appropriate `APP_BASE_HREF` value."* This is the answer when a host
  will not let you control the served HTML.
- **Stop using `pushState`.** `withHashLocation()` moves the route into the URL fragment and no
  longer needs a base for routing —
  [08b · `withRouterConfig` and hash location](../03-the-provider-array/08b-with-router-config-and-hash-location.md)
  covers the feature and the `LocationStrategy` override it installs. ⚠️ The documentation names
  the resource-resolution consequence in the same breath as the routing one and **does not state
  whether hash routing removes it**; the safe move is to leave the tag in place regardless.

🔴 **`--base-href` and the dev server's `servePath` are different options and setting only one is
the classic half-fix.** They are compared directly in
[06e · The four dev-server options that do what they say](../05-the-build-angular-build/06e-the-four-that-do-what-they-say.md).

## The body is one custom element, and both halves come from one value

The template line is `<<%= selector %>></<%= selector %>>` — the doubled angle bracket is not a
typo, it is an opening `<` followed by the substitution. Both the opening and closing tags render
from the same `selector` value, which the schematic derives from the `prefix` option (default
`app`) and hands to **both** this file and the root component's `@Component` decorator.

That single source is why the two agree by construction and why editing one of them by hand is how
they stop agreeing. `bootstrapApplication(App, appConfig)` locates this element by the component's
selector and renders into it; what that call actually does, step by step, is
[01 · `app.config.ts` and what bootstrap does with it](../03-the-provider-array/01-app-config-and-what-bootstrap-does-with-it.md).

## Gotchas

**★ Symptom: every route 404s on refresh after deploying to a sub-path, though the app works at the
root.** Cause: `<base href="/">` still says the application lives at `/`, so the router resolves
routes against the wrong base and the server is asked for paths that do not exist. Fix: set the base
at build time rather than editing the source — the flag exists precisely so one source tree can be
deployed anywhere:

```bash
ng build --base-href /my-app/
```

**★ Symptom: the page loads, the bundle executes, and the body stays empty with no error.** Cause:
the element in `index.html` no longer matches the root component's `selector` — usually because
`--prefix` was changed after generation, or one of the two was renamed by hand. Fix: make them
agree; they are generated from one value and must stay that way:

```html
<body>
  <app-root></app-root>
</body>
```

```ts
@Component({
  selector: 'app-root',
})
export class App {}
```

**Symptom: a screen reader announces the wrong language, or a translation tool mis-detects the
page.** Cause: `<html lang="en">` is hard-coded in the template — there is no EJS substitution in
that attribute, so every generated application claims English regardless of the locale you intend to
ship. Fix: change it by hand; nothing else will:

```html
<html lang="de">
```

## Interview questions

**★ What is `<base href="/">` for, and what breaks without it?**
The router's default strategy is `pushState` — angular.dev states *"HTML5 style navigation is the
router default"* — and it resolves routes against the document's base URL. The documentation is
direct: *"You must add a `<base href>` element to the application's `index.html` for `pushState`
routing to work."* Removing it breaks routing, and it separately breaks relative resource URLs on
deep-linked pages, which the docs call out as its own consequence: *"the browser might not be able
to load resources (images, CSS, scripts) when 'deep linking'"*. The three alternatives are not
equivalent — `--base-href` changes the emitted value at build time, `APP_BASE_HREF` supplies it
through DI when you cannot control the HTML, and `withHashLocation()` abandons `pushState`
altogether.

**★ Which files in `src/` could you delete or rename, and what would you have to change?**
`styles.css` is named only by `angular.json`'s `styles` array — rename both and nothing notices.
`main.ts` is named by the build target's `browser` option; the same applies. `public/` is named by
the default `assets` entry. `index.html` is the awkward one: nothing in the generated `angular.json`
names it, and the builder schema declares no default for `index` either, so the path is honoured by
a fallback that is not documented — if you move it, set `index` explicitly rather than trusting
discovery. The one line you cannot casually remove is `<base href>`, and it is not a file at all.

---

← Prev: **02 · The workspace layer** *(not written yet)* · Index: [Topic index](README.md) · Next → [03b · `index.html` is a shell the build rewrites](03b-index-html-is-a-shell-the-build-rewrites.md)
