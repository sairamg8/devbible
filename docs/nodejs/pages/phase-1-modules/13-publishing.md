---
title: "Publishing a package"
sidebar_label: "13 · Publishing"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 with **npm 12.0.2** on Node 24.19.0.

**Most developers publish rarely, so the whole thing is a checklist rather than a
skill. The two irreversible parts are what ends up in the tarball and the version
number you burn.**

## Scoped names

```json
{ "name": "@acme/widget", "version": "1.0.0" }
```

A scope (`@acme/`) is a namespace you own. Unscoped names are first-come and
mostly taken; scoped names avoid the collision and make provenance obvious.

Scoped packages default to **private**, which is a paid feature. To publish one
publicly you must say so, every time or once in the manifest:

```console
$ npm publish --access public
```

```json
{ "publishConfig": { "access": "public" } }
```

Forgetting this is the most common first-publish failure — the error is a
permissions message that does not mention the word "scope".

## The pre-flight check

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

Run this every time. It is the only way to see what you are actually shipping,
and it catches the two failures that matter: **secrets going out** and **needed
files staying home**.

Control the contents with `files` in `package.json` — an allowlist, covered in
[package.json essentials](07-package-json.md). `README`, `LICENSE` and
`package.json` always ship regardless; `node_modules` never does.

Then verify it actually works from a consumer's position:

```console
$ npm pack                       # produces acme-widget-1.2.0.tgz
$ mkdir ../smoke && cd ../smoke && npm init -y
$ npm install ../widget/acme-widget-1.2.0.tgz
$ node --input-type=module -e "import('@acme/widget').then(m => console.log('smoke test →', m.widget))"
smoke test → installed correctly

$ ls node_modules/@acme/widget/
package.json  README.md  src
```

`test/` and `NOTES.md` are absent — the `files` allowlist did its job.

Installing the tarball exercises the real `exports` map, the real `files` list and
the real `main`. A package that works in its own directory and fails when
installed is the normal outcome of skipping this.

## Versioning

```console
$ npm version patch     # 1.2.0 → 1.2.1, commits and tags
$ npm version minor     # 1.2.0 → 1.3.0
$ npm version major     # 1.2.0 → 2.0.0
```

`npm version` edits `package.json`, creates a commit and creates a git tag. Push
with `git push --follow-tags`.

**A published version is permanent.** `npm unpublish` is restricted to a 72-hour
window and only when nothing depends on it — the ecosystem learned this the hard
way. The realistic recovery from a bad release is `npm deprecate` plus a new
version:

```console
$ npm deprecate @acme/widget@1.2.1 "Broken exports map — use 1.2.2"
```

Which semver bump applies is decided by the consumer's experience, not the size of
the diff — see [semver](09-semver-and-lockfiles.md). Adding an `exports` map is a
major, even though it is three lines.

### Pre-releases

```console
$ npm version prerelease --preid=beta    # 1.2.0 → 1.2.1-beta.0
$ npm publish --tag beta
```

The `--tag` matters: without it the pre-release becomes `latest` and everyone
running `npm install @acme/widget` gets a beta. With it, only
`npm install @acme/widget@beta` does.

## Provenance

```console
$ npm publish --provenance
```

Run from a supported CI (GitHub Actions, GitLab), this attaches a signed,
verifiable statement linking the tarball to the exact commit and workflow that
built it. The registry shows a "Built and signed" badge, and consumers can verify
the package came from the repository it claims to.

It only works from CI — that is the point, since the guarantee is that no human
laptop was involved. Publishing from CI on a tag is the better practice regardless:
it removes "it worked on my machine" from the release path.

## Dual CJS/ESM packages

Covered mechanically in [the `exports` map](08-exports-map.md); the publishing
decision is:

| Ship | When | Cost |
|---|---|---|
| **ESM only** | New packages, Node ≥ 20.19 consumers | Older Node cannot `require` you; top-level `await` blocks it entirely |
| **CJS only** | Maximum compatibility | No named imports from ESM without the lexer guessing |
| **Both** | Wide public library | Dual package hazard — two copies of module state |

The ecosystem is converging on **ESM only**, because `require(esm)` now works
(Node ≥ 22.12, stable in 24.15). For an internal package where you control the
consumers, ESM only is straightforwardly correct today.

## Gotchas

**Symptom:** `npm publish` fails with a 402 or permissions error on a new scoped
package
**Cause:** Scoped packages are private by default.
**Fix:** `npm publish --access public`, or `publishConfig.access` in
`package.json`.

**Symptom:** Consumers get `ERR_MODULE_NOT_FOUND` for a file that exists in your
repo
**Cause:** `files` excluded it.
**Fix:** `npm pack --dry-run`, add the path, republish as a patch.

**Symptom:** A `.env` or key ended up on the registry
**Cause:** No `files` allowlist.
**Fix:** Rotate the credential immediately — unpublishing does not undo
disclosure — then republish with an allowlist.

**Symptom:** Everyone suddenly installed your beta
**Cause:** `npm publish` without `--tag`, so the pre-release became `latest`.
**Fix:** `npm dist-tag add @acme/widget@1.2.0 latest` to point it back, then
republish the beta under a tag.

**Symptom:** `npm version` did not create a tag
**Cause:** The working tree was dirty, or it is not a git repository.
**Fix:** Commit first. `npm version` refuses to run on a dirty tree by design.

## Interview questions

**★ How do you control what files get published?**
The `files` allowlist in `package.json`, verified with `npm pack --dry-run`.
`README`, `LICENSE` and `package.json` are always included; `node_modules` never
is. `.gitignore` is not the mechanism people assume it is.

**★ Can you unpublish a bad version?**
Only within 72 hours and only if nothing depends on it. The practical answer is
`npm deprecate` with a message pointing at the fixed version, then publish the
fix. Treat every publish as permanent.

**★ What does `npm publish --provenance` give you?**
A signed attestation, generated in CI, linking the published tarball to the
specific commit and workflow that produced it. Consumers can verify the package
really came from the repository it claims. It only works from supported CI, which
is what makes the claim meaningful.

**★ Why does a pre-release need `--tag`?**
Without a dist-tag the published version becomes `latest`, so every plain
`npm install` picks up the pre-release. `--tag beta` keeps it opt-in via
`@beta`.

**Should a new library ship CJS, ESM or both?**
ESM only is now the reasonable default — `require(esm)` works from Node 22.12 and
is stable in 24.15, so CommonJS consumers are served without a second build. Ship
both only for a wide public library that must support older Node, and accept the
dual package hazard that comes with it.

---

← Prev: [TypeScript without a build step](12-typescript-natively.md) · Next → [The `node:module` API](14-node-module-api.md)
