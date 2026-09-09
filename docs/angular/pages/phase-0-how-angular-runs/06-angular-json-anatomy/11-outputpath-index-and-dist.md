---
title: "`outputPath` is an object with three single-segment names, `index` has a third form that is just `false`, and pointing a static host at the output base instead of `browser/` publishes your server bundle"
sidebar_label: "11 · `outputPath`, `index`, `dist`"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `outputPath`, `index`, `outputHashing`
> and related properties of
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`, and
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config#output-path-configuration),
> quoted verbatim. ⚠️ **The schema declares no default for `index` and the generated `angular.json`
> does not set it**, yet the build uses `src/index.html`; that fallback is not documented and is
> stated here as unexplained rather than invented.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The shape of `dist/` is the single most common post-migration surprise, and it is fully described
by one schema property.** `outputPath` grew from a string into an object when one builder started
emitting a client bundle, a server bundle and media from the same run — and the extra directory
level that broke everyone's deploy script is the visible consequence. One of those directory names
carries a security implication that the documentation states in six words and most readers skim.

## `outputPath`

```json
"outputPath": {
  "description": "Specify the output path relative to workspace root.",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "base":    { "type": "string", "description": "Specify the output path relative to workspace root." },
        "browser": { "type": "string", "pattern": "^[-\\w\\.]*$", "default": "browser", "description": "The output directory name of your browser build within the output path base. Defaults to 'browser'." },
        "server":  { "type": "string", "pattern": "^[-\\w\\.]*$", "default": "server",  "description": "The output directory name of your server build within the output path base. Defaults to 'server'." },
        "media":   { "type": "string", "pattern": "^[-\\w\\.]+$", "default": "media",   "description": "The output directory name of your media files within the output browser directory. Defaults to 'media'." }
      },
      "required": ["base"],
      "additionalProperties": false
    },
    { "type": "string" }
  ]
}
```

🔴 **Read the patterns; they carry two facts the descriptions do not.**

`browser` and `server` are `^[-\w\.]*$` — a **single path segment**, no slashes, and the `*`
quantifier means the **empty string is legal**. `media` is `^[-\w\.]+$` with a `+`, so it cannot be
empty.

The empty string is the interesting one, because it is the supported way to flatten the layout back
to what the `browser` builder produced:

```json
{
  "options": {
    "outputPath": {
      "base": "dist/my-app",
      "browser": ""
    }
  }
}
```

That writes `index.html` directly to `dist/my-app/`, which is exactly what a deploy script written
before the migration expects. It is a real option and not a hack — but read the next section before
choosing it.

## 🔴 `browser` is the directory that is safe to serve. The base is not.

> *"| `base` | Specify the output path relative to workspace root. | `string` | |"*
> *"| `browser` | The output directory name for your browser build is within the base output path.
> This can be safely served to users. | `string` | `browser` |"*
> *"| `server` | The output directory name of your server build within the output path base. |
> `string` | `server` |"*
> *"| `media` | The output directory name for your media files located within the output browser
> directory. These media files are commonly referred to as resources in CSS files. | `string` |
> `media` |"*

*"This can be safely served to users"* appears on `browser` and on nothing else — and the implication
is the part that matters. With SSR, `dist/<app>/server/` sits beside `browser/` and contains server
code. **Pointing a static host at the output base rather than at `browser/` publishes it.**

That reframes the flattening trick above: setting `"browser": ""` is fine for a client-only
application, and for an application that also emits a server bundle it merges the two into one
served directory. Do not reach for it to fix a deploy path on an SSR app; fix the deploy path.

Combined with the migration guide's own note, this is the whole answer to the most common question
after switching builders:

> *"By default, after a successful build by the application builder the bundle is located in a
> `dist/<project-name>/browser` directory (instead of `dist/<project-name>` for the browser
> builder)."*

## The related output options

| Option | Default | Description (verbatim) |
|---|---|---|
| `outputHashing` | `"none"` | *"Define the output filename cache-busting hashing mode. - `none`: No hashing. - `all`: Hash for all output bundles. - `media`: Hash for all output media (e.g., images, fonts, etc. that are referenced in CSS files). - `bundles`: Hash for output of lazy and main bundles."* |
| `deleteOutputPath` | `true` | *"Delete the output path before building."* |
| `namedChunks` | `false` | *"Use file name for lazy loaded chunks."* |
| `extractLicenses` | `true` | *"Extract all licenses in a separate file."* |
| `subresourceIntegrity` | `false` | *"Enables the use of subresource integrity validation."* |
| `crossOrigin` | `"none"` | *"Define the crossorigin attribute setting of elements that provide CORS support."* |
| `statsJson` | `false` | *"Generates a 'stats.json' file which can be analyzed with https://esbuild.github.io/analyze/."* |
| `baseHref` | — | *"Base url for the application being built."* |
| `outputMode` | — | *"Defines the type of build output artifact. 'static': Generates a static site build artifact for deployment on any static hosting service. 'server': Generates a server application build artifact, required for applications using hybrid rendering or APIs."* |

⚠️ **`outputHashing` defaults to `"none"` in the builder**, and the application schematic sets
`"all"` only inside the `production` configuration. A `staging` configuration that does not repeat
it therefore ships unhashed filenames — the same class of surprise as every other
per-configuration option, and a direct consequence of the merge being per-configuration rather than
inherited.

⚠️ **`statsJson` produces an esbuild metafile**, and the schema points at
`https://esbuild.github.io/analyze/`. It is not a webpack stats file and webpack-bundle-analyzer
will not open it.

## `index` — three forms, and the third is `false`

```json
"index": {
  "description": "Configures the generation of the application's HTML index.",
  "oneOf": [
    { "type": "string", "description": "The path of a file to use for the application's HTML index. The filename of the specified path will be used for the generated file and will be created in the root of the application's configured output path." },
    {
      "type": "object",
      "properties": {
        "input":  { "type": "string", "minLength": 1, "description": "The path of a file to use for the application's generated HTML index." },
        "output": { "type": "string", "minLength": 1, "default": "index.html", "description": "The output path of the application's generated HTML index file. The full provided path will be used and will be considered relative to the application's configured output path." },
        "preloadInitial": { "type": "boolean", "default": true, "description": "Generates 'preload', 'modulepreload', and 'preconnect' link elements for initial application files and resources." }
      },
      "required": ["input"]
    },
    { "const": false, "type": "boolean", "description": "Does not generate an `index.html` file." }
  ]
}
```

🔴 **`"index": false` is legal** and produces no `index.html` at all — for an application embedded
in a host page that provides its own HTML. It is the form people do not know exists, and it is
cleaner than generating a file and deleting it.

**`preloadInitial` defaults to `true`**, and it is the answer to "who put these `modulepreload` tags
in my `index.html`". Turning it off is a deliberate choice about how the browser discovers initial
resources, not a cleanup:

```json
{
  "options": {
    "index": { "input": "src/index.html", "preloadInitial": false }
  }
}
```

⚠️ **The schema declares no default for `index`**, and the generated `angular.json` does not set it —
yet `ng new` writes `src/index.html` and the build uses it. Where that fallback is defined is not
stated in the schema and no documentation sentence for it was found; this page reports the behaviour
and does not explain it.

## Gotchas

**★ Symptom: the deploy uploads `dist/my-app/` and the site 404s.** Cause: the browser output is in
`dist/my-app/browser/`. Fix: point the deploy one level deeper — and prefer that over flattening if
the app has a server bundle:

```bash
test -f dist/my-app/browser/index.html || { echo "browser output missing"; exit 1; }
```

**★ Symptom: an SSR application's server bundle is downloadable from the public site.** Cause: the
static host was pointed at the output *base*, which contains `server/` beside `browser/`. The docs
mark only `browser` as *"can be safely served to users"*. Fix: serve `browser/` and nothing above
it — this is a security fix, not a tidiness one.

**★ Symptom: `"outputPath": { "base": "dist/app", "browser": "public/assets" }` is rejected.**
Cause: `browser` is `^[-\w\.]*$` — one path segment, no slashes. Fix: use a single name, and move
the nesting into `base`:

```json
{ "outputPath": { "base": "dist/app/public", "browser": "assets" } }
```

**★ Symptom: `"media": ""` is rejected while `"browser": ""` is accepted.** Cause: the patterns
differ deliberately — `browser` and `server` use `*` and `media` uses `+`, so media must have a
name. Fix: give it one:

```json
{ "outputPath": { "base": "dist/app", "media": "assets" } }
```

**★ Symptom: filenames are hashed in production and not in staging.** Cause: `outputHashing`
defaults to `"none"` on the builder, and the schematic sets `"all"` only in the `production`
configuration. Fix: set it on any configuration you deploy:

```json
{ "configurations": { "staging": { "outputHashing": "all" } } }
```

**★ Symptom: `stats.json` will not open in webpack-bundle-analyzer.** Cause: it is an esbuild
metafile, and the schema points at a different analyzer. Fix: use the one it names —
`https://esbuild.github.io/analyze/`.

**★ Symptom: `index.html` contains `modulepreload` tags nobody wrote.** Cause: `preloadInitial`
defaults to `true` and generates `preload`, `modulepreload` and `preconnect` links for initial
files. Fix: they are usually wanted; turn them off deliberately if not:

```json
{ "index": { "input": "src/index.html", "preloadInitial": false } }
```

**★ Symptom: a build step that writes extra files into the output directory finds them gone.**
Cause: `deleteOutputPath` defaults to `true`, so the directory is cleared before each build. Fix:
write after the build, or turn the deletion off and take responsibility for stale files:

```json
{ "options": { "deleteOutputPath": false } }
```

**★ Symptom: an application embedded in another page still emits an `index.html` you then delete.**
Cause: the `false` form of `index` is not widely known. Fix: ask for no index at all:

```json
{ "options": { "index": false } }
```

**★ Symptom: lazy chunks have opaque hashed names and you cannot tell which route is which.**
Cause: `namedChunks` defaults to `false`. Fix: enable it while investigating — it is a debugging
aid, not a production setting:

```json
{ "configurations": { "development": { "namedChunks": true } } }
```

## Interview questions

**★ Where does a default `ng build` put `index.html`, and how would you change it?**
In `dist/<project>/browser/`. `outputPath` accepts either a string or an object with `base`,
`browser`, `server` and `media`; the last three are single path segments, and `browser` and `server`
may be the empty string. So `{ "base": "dist/my-app", "browser": "" }` flattens the layout back to
what the old `browser` builder produced. The judgement worth adding is that flattening is fine for a
client-only app and wrong for one with SSR, because the server bundle lives beside the browser
output and merging them means serving it.

**★ Why does the documentation say only that `browser` "can be safely served to users"?**
Because the base directory is not safe to serve. With server-side rendering the build emits
`server/` alongside `browser/` under the same base, so a static host pointed at the base publishes
server code. The phrase is doing real work in six words, and the failure it warns about looks
identical to a working deploy — the site loads, because `browser/`'s contents are reachable through
a subdirectory, while the server bundle is also reachable. It is the strongest reason to fix a
deploy path rather than flatten the output.

**★ What are the three forms of `index`?**
A string path; an object with `input`, an optional `output` defaulting to `index.html`, and
`preloadInitial` defaulting to `true`; or the literal `false`, which generates no `index.html` at
all. The third is the one people miss, and it is the right answer for an application embedded in a
host page that supplies its own HTML. `preloadInitial` is worth knowing separately because it
explains the `modulepreload` and `preconnect` links that appear in generated output.

**Why might filenames be hashed in production and not in another configuration you deploy?**
Because `outputHashing` defaults to `"none"` on the builder itself, and the application schematic
writes `"all"` only into the `production` configuration. Configurations do not inherit from one
another, so a `staging` configuration gets the builder's default rather than production's value.
This is the general shape of configuration bugs in `angular.json`: the default that applies is the
*builder's*, not the one you can see in a neighbouring configuration.

**What is `stats.json` good for now, and what changed?**
It is an esbuild metafile, and the schema points at `https://esbuild.github.io/analyze/` to read it.
What changed is the builder: the old webpack stats format and the tooling built around it —
webpack-bundle-analyzer in particular — do not apply. The flag is still the way to get a
machine-readable description of what was emitted; only the reader changed.

---

← Prev: [`assets`, `styles`, `scripts`](10-assets-styles-and-scripts.md) · Index: [Topic index](README.md) · Next → [`optimization` and `sourceMap`](12-optimization-and-sourcemap.md)
