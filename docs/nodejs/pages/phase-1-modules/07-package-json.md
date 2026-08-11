---
title: "package.json essentials"
sidebar_label: "07 · package.json"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** with **npm 12.0.2** (the version bundled
> with Node 24).

**The file that decides how your code is parsed, what ships, and what runs. Six
fields carry almost all of it.**

## A realistic one

```json
{
  "name": "@acme/widget",
  "version": "1.2.0",
  "type": "module",
  "main": "./src/index.js",
  "exports": "./src/index.js",
  "files": ["src"],
  "engines": { "node": ">=20.11" },
  "scripts": {
    "dev": "node --watch --env-file-if-exists=.env src/server.js",
    "test": "node --test",
    "start": "node src/server.js"
  },
  "dependencies": {},
  "devDependencies": {}
}
```

## `type` — the most consequential field

It decides how every `.js` file in the package is parsed.

| Value | `.js` files are | `.mjs` | `.cjs` |
|---|---|---|---|
| `"module"` | ESM | ESM | CommonJS |
| `"commonjs"` | CommonJS | ESM | CommonJS |
| *absent* | Detected from source, with a warning | ESM | CommonJS |

Leaving it out is the one option with a cost:

```console
$ node mod2.js
(node:239915) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///…/mod2.js
is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a
performance overhead.
To eliminate this warning, add "type": "module" to /…/package.json.
```

**Set it explicitly in every package you write.** `"module"` for new work.

Note the field is scoped to the nearest `package.json`, so a `"type": "commonjs"`
package inside `node_modules` keeps working inside an ESM app —
see [module resolution](05-module-resolution.md).

## `main` vs `exports`

`main` is the old single entry point. `exports` is the modern one and **takes
precedence wherever both exist**.

```json
{
  "main": "./src/index.js",
  "exports": "./src/index.js"
}
```

Keep `main` for consumers on very old tooling; it is a few bytes of insurance.
Everything real happens through `exports` — subpaths, conditions, and blocking
deep imports. That is its own page: [the `exports` map](08-exports-map.md).

## `scripts`

Scripts run with `node_modules/.bin` prepended to `PATH`, so locally-installed
tools are callable by bare name without `npx`.

```json
{
  "scripts": {
    "dev": "node --watch --env-file-if-exists=.env src/server.js",
    "test": "node --test",
    "lint": "eslint src",
    "build": "tsc -p tsconfig.json"
  }
}
```

`npm run <name>` runs any script. `start`, `test`, `stop` and `restart` also work
without `run`. Arguments need `--` to get past npm: `npm run test -- --watch`.

Node can run these itself, skipping the npm process entirely:

```console
$ node --run dev
```

`node --run` is deliberately minimal — no pre/post scripts, no `.npmrc`
resolution, no shell features beyond what the OS gives it. The trade-off is
startup time versus compatibility; use it for simple scripts and `npm run` when a
script relies on npm's environment.

**Avoid `pre`/`post` hooks** (`pretest`, `postinstall`). They run implicitly, so
the command you read is not the command that ran. `postinstall` in particular is
a supply-chain concern: it executes on every `npm install` of your package.

## `engines`

```json
{ "engines": { "node": ">=20.11" } }
```

A declaration, not enforcement — npm warns by default and installs anyway. Make it
binding with an `.npmrc`:

```ini
# .npmrc
engine-strict=true
```

State a **floor, not a ceiling.** `">=20.11"` says what you need;
`"^24.0.0"` locks users out of Node 26 for no reason and will be the thing
blocking an upgrade a year from now. Pair it with `.nvmrc` and a CI matrix — see
[choosing a version](../phase-0-runtime-model/07-choosing-a-version.md).

## `files` — what actually ships

An allowlist. Without it, npm publishes everything except a small default-ignored
set, which is how test fixtures and `.env.example` end up on the registry.

```json
{ "files": ["src"] }
```

```console
$ npm pack --dry-run
npm notice 📦  @acme/widget@1.2.0
npm notice Tarball Contents
npm notice 9B README.md
npm notice 158B package.json
npm notice 20B src/index.js
npm notice 25B src/util.js
npm notice Tarball Details
npm notice total files: 4
```

`test/` and `NOTES.md` were in the directory and did not ship. `README.md`,
`LICENSE` and `package.json` are always included regardless of `files`, and
`node_modules` is always excluded.

**`npm pack --dry-run` before every first publish.** It is the only way to see
what you are actually shipping.

## The rest, briefly

| Field | What it does |
|---|---|
| `name` + `version` | Identity. Together they are the registry key. Scoped names (`@acme/x`) avoid collisions |
| `private: true` | Refuses to publish. Put it in every app and monorepo root |
| `dependencies` | Needed at runtime by consumers |
| `devDependencies` | Needed only to develop and build — not installed for consumers |
| `peerDependencies` | "I work with this, you provide it" — plugins, React components |
| `optionalDependencies` | Install failure is not fatal |
| `bin` | Maps a command name to a script; that is how CLIs get on `PATH` |
| `license` | Use an SPDX id. `UNLICENSED` for private code |

## Gotchas

**Symptom:** `MODULE_TYPELESS_PACKAGE_JSON` warning, slower startup
**Cause:** No `type` field, so Node parses twice to work it out.
**Fix:** Add `"type": "module"` (or `"commonjs"`).

**Symptom:** A published package is missing files at runtime
**Cause:** `files` omitted a directory the code needs — templates, migrations,
`.sql` fixtures.
**Fix:** Add it to `files` and verify with `npm pack --dry-run`.

**Symptom:** `npm install` on a consumer machine fails on your Node version
**Cause:** An upper bound in `engines` plus `engine-strict`.
**Fix:** Publish a floor only.

**Symptom:** `npm run test -- --watch` passes `--watch` to npm instead of the test
runner
**Cause:** Missing `--` separator, or it was placed wrongly.
**Fix:** `npm run test -- --watch`. Everything after `--` goes to the script.

**Symptom:** Secrets appear in the published tarball
**Cause:** No `files` allowlist, and `.gitignore` does not govern npm packing the
way people assume.
**Fix:** Use `files`, run `npm pack --dry-run`, and rotate anything exposed.

**Symptom:** A dependency works locally but is missing in production
**Cause:** It is in `devDependencies`, and production installs with `--omit=dev`.
**Fix:** Move it to `dependencies`. The test is simple — does the *running app*
need it?

## Interview questions

**★ What does `"type": "module"` do?**
It makes every `.js` file in that package parse as ESM. `.mjs` and `.cjs`
override it per file. Without the field, Node falls back to detecting module
syntax from the source and warns about the reparse cost, so setting it explicitly
is always better.

**★ What is the difference between `main` and `exports`?**
`main` names one entry point and imposes no restrictions. `exports` defines a map
of public subpaths, supports conditions like `import` / `require` / `types`, and
blocks any path not listed. Where both exist, `exports` wins.

**★ `dependencies` vs `devDependencies` vs `peerDependencies`?**
`dependencies` are installed for anyone who installs your package — the runtime
needs them. `devDependencies` are for building and testing and are skipped for
consumers. `peerDependencies` declare a package you integrate with but expect the
host application to supply, which is how plugins avoid loading a second copy of
their framework.

**★ How do you control what gets published?**
The `files` allowlist in `package.json`, verified with `npm pack --dry-run`.
`README`, `LICENSE` and `package.json` always ship; `node_modules` never does.

**Does `engines` prevent installation on the wrong Node version?**
Not by default — npm prints a warning and continues. It becomes a hard error only
with `engine-strict=true` in `.npmrc`.

**Why avoid `postinstall` scripts?**
They execute automatically on every install, on every machine that installs your
package, which makes them both a debugging surprise and a supply-chain risk. Put
the work in an explicit script the user runs.

---

← Prev: [Circular dependencies](06-circular-dependencies.md) · Next → [The `exports` map](08-exports-map.md)
