---
sidebar_position: 10
title: "`import.meta.glob` imports a directory as a module map, and it only exists because Turbopack does"
sidebar_label: "10 · Glob imports"
description: "The Vite-compatible glob API in Turbopack: lazy thunks vs eager modules, the import and query options, negation patterns, and why it brings HMR to Server Components that read from disk."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the
> [Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack) and the
> [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4**, Turbopack. 🔴 **Requires Turbopack — unavailable under webpack.**

**Reading a directory of content files from a Server Component has always worked and has always
been slightly wrong.** `fs.readdir` plus `fs.readFile` gives you the files, but the bundler
knows nothing about them: nothing is a module, nothing is watched, and editing a post does not
trigger a refresh. `import.meta.glob` fixes the category error by turning a glob pattern into a
**map of real module imports**, which means the dependency graph knows about your content — so
Hot Module Replacement works, tree-shaking applies, and the files are bundled rather than read
at runtime. The catch is in the first line of the reference: this is a Turbopack API, and
Turbopack is the default bundler, so the feature arrived the moment the bundler did.

## The shape of the result

```js
const modules = import.meta.glob('./dir/*.js')
// {
//   './dir/foo.js': () => import('./dir/foo.js'),
//   './dir/bar.js': () => import('./dir/bar.js'),
// }
```

The object is **keyed by file path relative to the calling file**, and by default each value is
a **thunk** — a function returning a `Promise` for the module. Nothing is loaded until you call
one:

```js
const modules = import.meta.glob('./dir/*.js')

for (const path in modules) {
  const module = await modules[path]()
  console.log(path, module)
}
```

That default is the useful one for content directories: a hundred posts cost a hundred entries
in a map, not a hundred modules in the bundle.

## Eager loading

`{ eager: true }` imports everything up front, and each value becomes the **module object
itself** rather than a thunk:

```js
const modules = import.meta.glob('./dir/*.js', { eager: true })

for (const path in modules) {
  console.log(path, modules[path].default)
}
```

Reach for it when you need every module anyway — a route manifest, a registry of validators —
and the indirection of awaiting each thunk buys nothing.

## The blog-index case, which is the one you will actually write

```tsx filename="app/blog/page.tsx"
import matter from 'gray-matter'

export default function Page() {
  // .md needs a loader registered in next.config.js
  const posts = import.meta.glob('./posts/*.md', { eager: true })

  return (
    <ul>
      {Object.entries(posts).map(([path, mod]) => {
        const { data } = matter(mod.default)
        return <li key={path}>{data.title}</li>
      })}
    </ul>
  )
}
```

Note the comment, because it is the part that bites: **`.md` is not a module type Turbopack
understands on its own.** A loader has to be registered under `turbopack.rules` in
`next.config.js`, or the glob resolves to files the bundler cannot parse.

## Selecting a single export

The `import` option picks one named export from every matched module, and it composes with
`eager`:

```js
// Lazy: each value is () => Promise<exportValue>
const defaults = import.meta.glob('./dir/*.js', { import: 'default' })

// Eager: each value is the export value directly
const setups = import.meta.glob('./dir/*.js', { import: 'setup', eager: true })
```

This is what makes a plugin or route registry tidy — you get a map of *the thing you wanted*,
not a map of module namespaces you then have to reach into.

## Query strings

`query` appends a query string to every import, which is how you ask for a file as a raw string
or a URL rather than as a parsed module:

```js
const rawFiles = import.meta.glob('./dir/*.txt', { query: '?raw' })
const urls = import.meta.glob('./dir/*.png', { query: '?url' })
```

It also takes an object, whose keys and values are URL-encoded and joined for you:

```js
const modules = import.meta.glob('./*.ts', {
  query: { bar: 'foo', raw: true },
})
// equivalent to: { query: '?bar=foo&raw=true' }
```

## Multiple patterns, and negation

The first argument accepts an array, and a `!` prefix excludes:

```js
// Combine multiple directories
const modules = import.meta.glob(['./dir/*.js', './other/*.js'])

// Exclude test files
const withoutTests = import.meta.glob(['./src/**/*.js', '!**/*.test.js'])
```

## Every option

| Option | Type | Default | What it does |
|---|---|---|---|
| `eager` | `boolean` | `false` | Import synchronously instead of returning thunks |
| `import` | `string` | `undefined` | Named export to select from each module, e.g. `'default'` |
| `query` | `string \| Record<string, string \| boolean>` | `undefined` | Query string or object appended to each import |
| `base` | `string` | `undefined` | Override the base path used for resolving patterns **and for keying results** |
| `caseSensitive` | `boolean` | `true` | Match case-sensitively; `false` ignores ASCII case |

## TypeScript

Types ship with Next.js and are picked up automatically when `tsconfig.json` sets
`"moduleResolution": "bundler"` — or `"node16"` / `"nodenext"` — which is the default for new
projects. The return type follows `eager`:

```ts
// Lazy (default) — Record<string, () => Promise<unknown>>
const lazy = import.meta.glob('./dir/*.ts')

// Eager — Record<string, unknown>
const eager = import.meta.glob('./dir/*.ts', { eager: true })
```

Both resolve to `unknown`, so a content pipeline wants a validated cast — Zod at the boundary —
rather than an `as` that asserts a shape nothing checked.

## Two Vite APIs that are deliberately absent

- **`as`** — deprecated in Vite 5, not supported here. Use `query: '?raw'` or `query: '?url'`.
- **`import.meta.globEager()`** — the legacy eager API, not supported. Use
  `import.meta.glob('...', { eager: true })`.

Both omissions are worth knowing because Vite-era examples on the web still use them, and
neither fails in a way that names the real problem.

## Gotchas

### Using it under webpack

**Symptom.** The build fails, or `import.meta.glob` is undefined at runtime.

**Cause.** It is a **Turbopack** API. Turbopack is the default bundler, but `next dev --webpack`
and `next build --webpack` opt out — and so does any platform without Turbopack's native
bindings, where Next.js falls back to WASM and Turbopack is unavailable entirely (FreeBSD and
OpenBSD are the named examples).

**Fix.** Stay on Turbopack, or read the directory with `fs` and accept losing HMR. There is no
polyfill.

### Globbing `.md` without registering a loader

**Symptom.** The glob matches the right files and the build fails to parse them.

**Cause.** Markdown is not a module type Turbopack handles natively. The glob resolves paths;
it does not teach the bundler a new format.

**Fix.** Register a loader under `turbopack.rules` in `next.config.js` before globbing anything
that is not JS, TS, JSON or a supported asset.

### Expecting `eager: true` to be the safe default

**Symptom.** Bundle size grows with the content directory, and a hundred-post blog ships a
hundred modules to render an index of titles.

**Cause.** `eager` imports **everything**, immediately.

**Fix.** Default to lazy thunks and call only what you render. Use `eager` when you genuinely
need every module — and when you do, prefer `import: 'default'` so you get values rather than
namespaces.

### Reading `mod.default` after using `import: 'default'`

**Symptom.** `undefined`, or a runtime error one layer deeper than the mistake.

**Cause.** `import: 'default'` already unwrapped it. The value **is** the default export; there
is no `.default` on it.

**Fix.** Pick one. Either `{ eager: true }` and read `mod.default`, or
`{ eager: true, import: 'default' }` and read the value directly.

### Assuming keys are absolute, or stable across a move

**Symptom.** A lookup by path returns `undefined` after a file is moved, or a key does not match
a route slug you derived elsewhere.

**Cause.** Keys are **relative to the calling file**, so moving the *caller* changes every key
even when the content did not move. The `base` option overrides both resolution and keying.

**Fix.** Derive slugs from the key with an explicit transform rather than assuming a shape, and
set `base` when you want keys anchored somewhere stable.

### Trying the Vite APIs by muscle memory

**Symptom.** `as: 'raw'` is silently ignored, or `import.meta.globEager` is not a function.

**Cause.** Neither is supported — `as` was deprecated in Vite 5 and `globEager` is legacy.

**Fix.** `query: '?raw'` and `{ eager: true }` respectively.

### Treating the result as a runtime directory listing

**Symptom.** A file added to the directory in production is not picked up.

**Cause.** The glob is resolved at **build time**. It produces a static module map, not a
`readdir`. That is the entire benefit — the bundler knows your content — and the entire
limitation.

**Fix.** If the file set genuinely changes at runtime, this is the wrong tool; read the
filesystem or a database. If it changes at deploy time, a glob is correct and cheaper.

## Interview questions

**Q. What does `import.meta.glob` return by default?**
An object keyed by file path **relative to the calling file**, whose values are thunks —
functions returning a `Promise` for each module. Nothing loads until a thunk is called.

**Q. What changes with `{ eager: true }`?**
Every matched module is imported up front and each value becomes the module object directly
rather than a thunk.

**Q. Why is this better than `fs.readdir` in a Server Component?**
Because the results are real module imports, so the bundler's dependency graph knows about the
files. That is what brings **HMR** to a Server Component reading from disk, and it lets the
files be bundled rather than read at runtime.

**Q. What does the `import` option do?**
Selects a specific named export from each matched module, in both lazy and eager modes — so you
get a map of values rather than a map of namespaces.

**Q. How do you load matched files as raw text or as URLs?**
`query: '?raw'` and `query: '?url'`. `query` also accepts an object, whose keys and values are
URL-encoded into a query string.

**Q. How do you exclude files from a glob?**
Pass an array of patterns and prefix the exclusions with `!`, for example
`['./src/**/*.js', '!**/*.test.js']`.

**Q. Which two Vite APIs are not supported, and what replaces them?**
`as` (deprecated in Vite 5) → use `query: '?raw'` or `query: '?url'`. `import.meta.globEager()`
→ use `{ eager: true }`.

**Q. What is required to glob a directory of Markdown files?**
A loader registered under `turbopack.rules` in `next.config.js`. The glob resolves paths; it
does not teach Turbopack a file format it does not already handle.

**Q. Is this available under webpack?**
No. It requires Turbopack — which also means it is unavailable on platforms that fall back to
WASM bindings, where Turbopack does not run at all.

**Q. What TypeScript type do you get back?**
`Record<string, () => Promise<unknown>>` lazily, `Record<string, unknown>` eagerly, with types
available automatically under `"moduleResolution": "bundler"`, `"node16"` or `"nodenext"`.
Because both are `unknown`, validate rather than cast.
