---
title: "resolve.conditions is the list of Node conditional-exports keys Vite is allowed to match, and its default silently picks the browser branch of every dual-published package"
sidebar_label: "01h · resolve.conditions"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [`resolve.conditions`](https://vite.dev/config/shared-options#resolve-conditions), and the Node.js documentation — [Conditional exports](https://nodejs.org/docs/latest-v22.x/api/packages.html#conditional-exports). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `resolve.conditions`: Which Branch of `exports` Vite Picks

**A conditional `exports` map is a small `switch` statement keyed by strings, and
`resolve.conditions` is the list of case labels Vite is allowed to match against. Get the
list wrong — or forget that Vite's client default is not Node's default — and the resolver
silently walks into the wrong branch: a Node-only entry point in the browser, or a
production build carrying a package's `development` branch with all its extra warnings and
assertions still switched on.**

## What a "condition" is, mechanically

[Chunk 01g](01g-the-exports-and-imports-fields.md) covers the `exports` field itself; this
is the option that controls which key of a conditional map gets chosen. Given:

```json
// node_modules/acme-widgets/package.json
{
  "exports": {
    ".": {
      "import": "./index.mjs",
      "require": "./index.js"
    }
  }
}
```

Node's own documentation defines `import` and `require` as **conditions**:

> *"Here, `import` and `require` are "conditions". Conditions can be nested and should be
> specified from most specific to least specific."*

`import` and `require` are not something you configure — Node always applies them based on
how the specifier was actually loaded:

> *"Note that `import`, `require`, `default` conditions are always applied if the
> requirements are met."*

`resolve.conditions` widens that fixed set. It names the **additional** condition strings
Vite is willing to match, on top of the ones that are always live:

> *"Additional allowed conditions when resolving [Conditional Exports] from a package."*

## The default, and why it is not neutral

**Type:** `string[]` · **Default:** `['module', 'browser', 'development|production']`
(`defaultClientConditions`) — this is the **client** default. `resolve.conditions` is a
top-level option; it has nothing to do with SSR, which has its own, separate condition
options covered in full in
[../10-ssr-support/01e-ssr-target-and-resolve-conditions.md](../10-ssr-support/01e-ssr-target-and-resolve-conditions.md) — do not duplicate that
page's ground here, only the difference matters: the client list includes `browser`, the SSR
list does not.

That one string is the entire reason a dual-published package resolves differently in a
component under test in the browser than in the same component rendered on a server: with
`browser` in the condition list, a package publishing:

```json
{
  "exports": {
    ".": {
      "browser": "./dist/browser.mjs",
      "node": "./dist/node.mjs",
      "default": "./dist/index.mjs"
    }
  }
}
```

resolves to `dist/browser.mjs` on the client and (per the SSR page's own default, which
omits `browser`) to a different branch on the server — without a single line of app config
having named either file.

## `development|production` — the one condition that reads an environment variable

`resolve.conditions` treats this token specially rather than as a literal condition string:

> *"`development|production` is a special value that is replaced with `production` or
> `development` depending on the value of `process.env.NODE_ENV`. It is replaced with
> `production` when `process.env.NODE_ENV === 'production'` and `development` otherwise."*

```json
{
  "exports": {
    ".": {
      "development": "./dist/dev.js",
      "production": "./dist/prod.js"
    }
  }
}
```

The trap this sets is that `NODE_ENV` and Vite's own `mode` are separate concepts — running
`vite build --mode staging` does not set `NODE_ENV` to `staging`; it leaves whatever
`NODE_ENV` already was in the process environment. A package resolving off this condition
picks its branch from `NODE_ENV` specifically, not from `--mode`.

## Style and CSS-preprocessor conditions — resolved outside JS entirely

`resolve.conditions` is not only for JavaScript entry points:

> *"In addition, the `style` condition is applied when resolving style imports, e.g.
> `@import 'my-library'`. For some CSS pre-processors, their corresponding conditions are
> also applied, i.e. `sass` for Sass and `less` for Less."*

```json
{
  "exports": {
    "./theme.css": {
      "sass": "./theme.scss",
      "style": "./theme.css",
      "default": "./theme.css"
    }
  }
}
```

A package that ships both a `.scss` source and a compiled `.css` file can point Sass
consumers at the source and everyone else at the compiled output, through the same map that
governs JS conditions — the `style`/`sass`/`less` strings are applied automatically and are
not something you add to `resolve.conditions` yourself.

## Setting it explicitly

```js
// vite.config.js — a client app that also wants a custom, package-defined condition
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    // Extends, does not replace, the always-applied import/require/default set.
    conditions: ['module', 'browser', 'development|production', 'my-design-system'],
  },
})
```

A custom condition set here only affects **Vite's own** resolution. Anything Node itself
resolves later — your `vite.config.js` file being loaded, a CJS dependency's own internal
`require` calls that Vite did not intercept — obeys Node's `--conditions` flag instead,
which is a completely separate mechanism documented on Node's side:

> *"When running Node.js, custom user conditions can be added with the `--conditions`
> flag: `node --conditions=development index.js` which would then resolve the
> "development" condition in package imports and exports, while resolving the existing
> "node", "node-addons", "default", "import", and "require" conditions as appropriate."*

An SSR app that needs the same custom condition in both Vite and the Node process it deploys
to needs to set it in both places — worked through in full, with the exact command lines, in
[../10-ssr-support/01e-ssr-target-and-resolve-conditions.md](../10-ssr-support/01e-ssr-target-and-resolve-conditions.md).

## Order inside the `exports` map, not inside `resolve.conditions`, decides ties

A condition being in `resolve.conditions` makes it *eligible*; which one wins when a package
lists several is decided by the package's own `exports` map, read top to bottom:

> *"Within the "exports" object, key order is significant. During condition matching,
> earlier entries have higher priority and take precedence over later entries. The general
> rule is that conditions should be from most specific to least specific in object order."*

So `resolve.conditions: ['module', 'browser', 'development|production']` does not mean
`module` beats `browser` beats `development|production` — the array's order only matters for
readability. What decides the winner, for any single package, is the order that package's
own author wrote its `exports` keys in.

## Gotchas

**★ Symptom: a dual-published package uses its Node build in a component that only ever runs in the browser.** Cause: `browser` was removed from `resolve.conditions` — often
copied from an SSR config example that correctly omits it for the server, then pasted into
the client config where it is load-bearing. Fix: restore the client default, or if a custom
list is genuinely needed, keep `browser` in it.
```js
export default defineConfig({
  resolve: { conditions: ['module', 'browser', 'development|production'] },
})
```

**★ Symptom: a production build ships a dependency's development branch, complete with its extra console warnings.** Cause: `development|production` resolves from
`process.env.NODE_ENV`, not from `--mode`. A CI pipeline that runs `vite build --mode
production` without also exporting `NODE_ENV=production` leaves the condition on
whatever the ambient environment already set — often `development`, or unset. Fix: set
`NODE_ENV` explicitly in the build command, not just `--mode`.
```json
{ "scripts": { "build": "NODE_ENV=production vite build" } }
```

**★ Symptom: adding a custom condition to `resolve.conditions` changes nothing for a dependency's `.css` or `.scss` import.** Cause: style imports resolve against the `style`/
`sass`/`less` conditions automatically, and those are not entries you add to
`resolve.conditions` — the option only widens the *JS* condition set. Fix: nothing to
configure; if the package's `exports` map does not define a `style` or preprocessor-specific
branch for that subpath, there is no branch to pick.

**★ Symptom: a package exposes both `browser` and `node` branches, `resolve.conditions` lists both, and the wrong one is still chosen.** Cause: eligibility in `resolve.conditions`
does not decide precedence — the package's own key order inside `exports` does. If the
package author listed `"node"` before `"browser"`, `node` wins for every consumer regardless
of what order the consumer's `resolve.conditions` array is written in. Fix: this is a
package-authoring bug, not a consumer misconfiguration — report it, or work around it with
`resolve.alias` pointed at the specific branch you need
(fundamentals in [01](01-resolve-options.md)).

## Interview questions

**★ Why does the exact same `import` statement load a different file in the browser than under SSR, with no alias and no code difference?**
Because `resolve.conditions` and the SSR side's equivalent are two different option
defaults: the client list is `['module', 'browser', 'development|production']`, and the SSR
default (documented in full at
[../10-ssr-support/01e-ssr-target-and-resolve-conditions.md](../10-ssr-support/01e-ssr-target-and-resolve-conditions.md)) drops `browser`. A
package whose `exports` map has a `browser` branch resolves to it on the client and falls
through to `node` or `default` on the server, purely because of which condition strings each
environment is allowed to match — the app never named either file.

**★ What decides which key of a package's `exports` map wins when more than one of a consumer's allowed conditions is present?**
The package's own key order, not the consumer's. Node's rule is explicit: *"During condition
matching, earlier entries have higher priority and take precedence over later entries."*
`resolve.conditions` only decides which condition strings are *eligible* to be matched at
all; once several eligible keys exist in one `exports` object, the first one written by the
package's author is the one used, regardless of the order the consumer listed conditions in
their own config.

**★ Why does `development|production` sometimes pick the wrong branch even though `--mode production` was passed to the build?**
Because `mode` and `NODE_ENV` are independent in Vite, and this specific condition token
reads `process.env.NODE_ENV` only — *"replaced with `production` when
`process.env.NODE_ENV === 'production'` and `development` otherwise."* A custom `--mode`
value, or a build environment that never sets `NODE_ENV` at all, leaves this condition
resolving against whatever `NODE_ENV` happens to be, independent of what `--mode` said. Any
dependency relying on this condition for a dev/prod split needs `NODE_ENV` set explicitly in
the command that runs the build.

---

← [01ga · imports field & self-reference](01ga-the-imports-field-and-self-referencing.md) · [Vite overview](../../README.md) · Next → [01i · mainFields & browser field](01i-resolve-mainfields-and-the-browser-field.md)
