---
title: "After the bundle is written, two defaults you never set rewrite your `index.html` — critical CSS is inlined into a `<style>` element and external font CSS is fetched over the network at build time, which is why a CSP and an air-gapped CI runner are the two things that break here"
sidebar_label: "03d · Critical CSS and font inlining"
sidebar_position: 3.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against angular.dev
> [Angular CLI builds](https://angular.dev/tools/cli/build) (the critical-CSS section, quoted
> verbatim) and the `optimization` block of
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`, corroborated by the `beasties` and `parse5-html-rewriting-stream` entries in the
> published manifest of `@angular/build` **22.1.7**
> ([registry.npmjs.org](https://registry.npmjs.org/@angular/build/22.1.7)).
> Documentation-validated; **no sandbox run** — no `index.html` output is reproduced here.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Your built `index.html` is not your source `index.html` with script tags added.** Two
optimizations that default to *on* rewrite it after the bundle is written: the CSS needed for the
initial viewport is extracted and inlined into the document, and external Google/Adobe font CSS is
**fetched over the network at build time** and inlined too. Both are good for first paint and both
are invisible until they are not: the first collides with any Content Security Policy that forbids
inline styles, and the second makes your build depend on outbound network access, which is the one
thing a locked-down CI runner does not have.

## Critical CSS, in the documentation's words

> *"Angular can inline the critical CSS definitions of your application to improve [First
> Contentful Paint (FCP)](https://web.dev/first-contentful-paint). This option is enabled default."*
>
> *"This optimization extracts the CSS needed to render the initial viewport and inlines it directly
> into the generated HTML, allowing the browser to display content faster without waiting for the
> full stylesheets to load. The remaining CSS then loads asynchronously in the background. Angular
> CLI uses [Beasties](https://github.com/danielroe/beasties) to analyze your application's HTML and
> styles."*
> — [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build)

The corroboration is in the manifest: `beasties` is pinned at `0.4.3` as a direct dependency of
`@angular/build` — see [02b](02b-twenty-six-dependencies.md). The schema's own wording for the
switch is *"Extract and inline critical CSS definitions to improve first paint time."*, with
`"default": true`.

A third dependency lines up with the same story: **`parse5-html-rewriting-stream`**, a streaming
HTML rewriter. Its presence is consistent with `index.html` being *transformed* rather than copied,
which is the mental model to carry: the file in `dist` is generated.

## Font inlining reaches the network during your build

The schema describes `optimization.fonts` as:

> *"Enables optimization for fonts. This option requires internet access. `HTTPS_PROXY` environment
> variable can be used to specify a proxy server."*
> — `application/schema.json`, `optimization.fonts`, `"default": true`

and its `inline` sub-option as:

> *"Reduce render blocking requests by inlining external Google Fonts and Adobe Fonts CSS
> definitions in the application's HTML index file. This option requires internet access.
> `HTTPS_PROXY` environment variable can be used to specify a proxy server."*
> — `application/schema.json`, `optimization.fonts.inline`, `"default": true`

🔴 **Read the scope precisely: it inlines the CSS of *external Google Fonts and Adobe Fonts*.**
Self-hosted fonts are not fetched and not affected. So the option matters exactly when your
`index.html` or a stylesheet links out to one of those two services — and in that case, your build
is no longer hermetic, and the schema names `HTTPS_PROXY` as the supported way through a proxy.

## The object you edit, and the mistake people make editing it

Both switches live under one option, and the shape matters more than the values:

| Path | Governs | Schema default |
|---|---|---|
| `optimization` | the whole group; accepts a boolean **or** an object | `true` |
| `optimization.scripts` | script optimization — and gates the rolldown chunk pass | `true` |
| `optimization.styles.minify` | CSS minification | `true` |
| `optimization.styles.inlineCritical` | critical-CSS inlining | `true` |
| `optimization.styles.removeSpecialComments` | dropping `@license` / `@preserve` / `/*!` comments in global CSS | `true` |
| `optimization.fonts.inline` | fetching and inlining external Google/Adobe font CSS | `true` |

🔴 **`"optimization": false` is not "turn off critical CSS".** It is a single boolean over the whole
group: minification, the rolldown chunk-optimization pass ([03b](03b-eleven-concerns-one-process.md)),
critical CSS and font inlining all go at once. Reach for the nested form and change exactly the leaf
you meant. The full schema — every nested default, and the documentation's own copy-paste error in
that section — is **topic 06 · `angular.json` anatomy** *(not written yet)*.

## Gotchas

**★ Symptom: `<style>` blocks appear inline in `index.html` in production and your Content Security
Policy rejects them.** Cause: critical-CSS inlining is enabled by default. Fix: turn off the
specific sub-option rather than the whole `optimization` object:

```json
{ "optimization": { "styles": { "inlineCritical": false } } }
```

The other direction — keeping the performance benefit and making the CSP accept it — is what the
builder's `security.autoCsp` option is for; the field itself belongs to **topic 06 ·
`angular.json` anatomy** *(not written yet)*.

**★ Symptom: builds succeed on a laptop and hang or fail on a locked-down CI network.** Cause:
`optimization.fonts.inline` fetches Google and Adobe font CSS at build time and is on by default.
Fix: either disable it in the environment that cannot reach the network, or give it the proxy the
schema names:

```json
{ "configurations": { "production": { "optimization": { "fonts": false } } } }
```

```bash
HTTPS_PROXY=http://proxy.internal:3128 ng build --configuration production
```

**★ Symptom: you set `"optimization": false` to stop the inline styles and your bundles triple in
size.** Cause: the outer value is a boolean over the entire group — minification, the chunk
optimization pass, critical CSS and font inlining. Fix: change only the leaf:

```json
{
  "optimization": {
    "scripts": true,
    "styles": { "minify": true, "inlineCritical": false },
    "fonts": true
  }
}
```

**★ Symptom: a `@license` banner survives in JavaScript but disappears from a global stylesheet.**
Cause: two different options govern them — script licenses by `extractLicenses` (default `true`),
CSS comments by `optimization.styles.removeSpecialComments` (default `true`, and it removes
`@license`, `@preserve` and `/*!` comments in global CSS). Fix: keep the CSS comments when a licence
requires you to:

```json
{ "optimization": { "styles": { "removeSpecialComments": false } } }
```

**★ Symptom: a deploy check that diffs `dist/my-app/browser/index.html` against `src/index.html`
fails on every build.** Cause: the built `index.html` is generated, not copied — hashed script tags,
inlined critical CSS and inlined font CSS all land in it. Fix: never compare the built HTML with the
source; assert on what the deploy actually needs:

```bash
test -f dist/my-app/browser/index.html || { echo "browser output missing"; exit 1; }
```

**Symptom: you self-host your fonts and disabling `optimization.fonts` changes nothing.** Cause:
the option's scope is *external Google Fonts and Adobe Fonts CSS definitions* — self-hosted font
files are not fetched by it at all. Fix: nothing to change here; if the goal was to remove the
build's network dependency, self-hosting has already achieved it, and you can leave the option
alone or disable it for clarity:

```json
{ "optimization": { "fonts": { "inline": false } } }
```

**Symptom: first paint got measurably worse after someone "cleaned up" the build config.** Cause:
`inlineCritical` was turned off, so the browser now waits for the full stylesheet before rendering
the initial viewport — which is exactly the delay the optimization exists to remove. Fix: put it
back and solve the original problem (usually a CSP) at the policy layer instead:

```json
{ "optimization": { "styles": { "inlineCritical": true } } }
```

**Symptom: two CI runners produce different `index.html` bytes from the same commit.** Cause: font
inlining depends on a network fetch, so a runner that reached the font service and one that did not
can produce different HTML without either failing. Fix: make the behaviour deterministic by
choosing it explicitly for CI rather than leaving it to network conditions:

```json
{ "configurations": { "production": { "optimization": { "fonts": { "inline": false } } } } }
```

## Interview questions

**★ What is critical CSS inlining, what does it buy, and what does it break?**
The build extracts the CSS needed to render the initial viewport and inlines it into the generated
HTML, loading the rest asynchronously — angular.dev frames it as a First Contentful Paint
improvement, and the CLI uses Beasties to do it. It is on by default. What it breaks is any Content
Security Policy that forbids inline styles, because the inlined rules land in a `<style>` element in
your HTML. The targeted switch is `optimization.styles.inlineCritical: false`; the alternative is to
keep the optimization and let the builder generate a policy that accepts it, which is what
`security.autoCsp` exists for. Turning off `optimization` wholesale to achieve it is the common
overcorrection — that also disables minification and the chunk-optimization pass.

**★ Why can the same commit build on a laptop and fail on CI with no code change?**
`optimization.fonts` is enabled by default and, per its own schema description, *requires internet
access* — the build fetches Google and Adobe font CSS in order to inline it. On a network-restricted
CI runner that is a build-time network call that may hang or fail. The schema names `HTTPS_PROXY` as
the supported way through; the alternative is `"optimization": { "fonts": false }` for that
configuration. It is worth knowing because it is one of very few places where an Angular build is
not hermetic, and nothing about the failure will say "fonts".

**★ Why is `optimization` an object rather than a boolean, and what does that cost you?**
Because it groups four genuinely different things — script optimization, CSS minification, critical
CSS, font inlining — that people need to control separately, and the boolean form is kept for the
common case. The cost is a real trap: the outer value is still a boolean over the whole group, so
`"optimization": false` in a configuration silently disables minification and the rolldown chunk
pass along with whatever you were actually trying to turn off. The habit worth forming is to write
the nested object whenever you disable anything, so the reader of the diff can see which leaf you
meant.

**★ What exactly does `optimization.fonts.inline` inline, and what does it leave alone?**
External Google Fonts and Adobe Fonts CSS definitions, inlined into the application's HTML index
file to remove a render-blocking request. That is the scope the schema states, and it is narrower
than "fonts": self-hosted font files are not fetched, not inlined and not affected. So the option is
only relevant to projects that link out to one of those two services — and for those projects it
converts a runtime request into a build-time one, which is a good trade for first paint and a bad
one for build hermeticity.

**Your built `index.html` differs from your source. Name everything that changed it.**
Script and stylesheet tags for the hashed output files, critical CSS inlined into a `<style>`
element, and external Google/Adobe font CSS inlined — the last two both defaulting to on. The
mental model to carry is that `index.html` is *generated*: `@angular/build` even carries a streaming
HTML rewriter (`parse5-html-rewriting-stream`) as a direct dependency. Any tooling that assumes the
built HTML is the source HTML with a couple of tags appended — a diff-based deploy check, a
checksum, a template scanner — is going to be wrong, and it will be wrong differently depending on
whether the build machine could reach the font services.

{/* FOOTER */}
