---
title: "Semver, ranges and lockfiles"
sidebar_label: "09 · Semver and lockfiles"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 with **npm 12.0.2** on Node 24.19.0.

**`^` means "trust every maintainer of every transitive dependency to get their
version numbers right." The lockfile is what makes that survivable.**

## The version number

`MAJOR.MINOR.PATCH` — `2.1.3`.

| Bump | Means | Example |
|---|---|---|
| **major** | Breaking change. Existing code may stop working | `2.1.3 → 3.0.0` |
| **minor** | New functionality, backwards compatible | `2.1.3 → 2.2.0` |
| **patch** | Bug fix, backwards compatible | `2.1.3 → 2.1.4` |

The contract is the *maintainer's intent*, not a guarantee. A "patch" that fixes a
bug your code depended on is still a break for you. That gap is the entire reason
lockfiles exist.

`0.x` is the explicit exception: **anything may break at any time**. `^0.3.1`
allows only `0.3.x`, because at `0.x` the minor slot behaves like a major.

## Ranges

```json
{
  "dependencies": {
    "express": "^5.1.0",
    "mongoose": "~8.9.2",
    "left-pad": "1.3.0"
  }
}
```

| Range | Allows | Blocks |
|---|---|---|
| `^5.1.0` | `5.1.0` → `<6.0.0` | major bumps |
| `~8.9.2` | `8.9.2` → `<8.10.0` | minor and major |
| `5.1.0` | exactly `5.1.0` | everything else |
| `*` / `latest` | anything | nothing — never do this |
| `>=5.1.0 <6` | explicit window | outside the window |

`^` is npm's default when you `npm install <pkg>`, and it is a reasonable default:
you want security patches without a manual bump. The cost is that **your
`package.json` does not describe what you are running**.

```console
$ npm install ms@^2.0.0
$ node -e "console.log('range in package.json:', require('./package.json').dependencies.ms)"
range in package.json: ^2.1.3
$ node -e "console.log('installed version    :', require('./node_modules/ms/package.json').version)"
installed version    : 2.1.3
```

Two different facts. The range says "any 2.x from 2.1.3 up"; today that resolves
to `2.1.3`, and tomorrow it may not.

## The lockfile is the real answer

`package-lock.json` records the **exact** version, resolved URL and integrity hash
for every package in the tree — direct and transitive.

```console
$ node -e "
const l = require('./package-lock.json');
const e = l.packages['node_modules/ms'];
console.log('lockfileVersion:', l.lockfileVersion);
console.log('resolved       :', e.version);
console.log('integrity      :', e.integrity.slice(0, 30) + '…');
"
lockfileVersion: 3
resolved       : 2.1.3
integrity      : sha512-6FlzubTLZG3J2a/NVCAleEh…
```

The `integrity` hash is the part people forget: it makes the install
**verifiable**, not just reproducible. A tampered tarball fails the check even if
the version number matches.

**Commit the lockfile.** Always, including for libraries. The old advice not to
commit it for published packages confused two things: the lockfile governs *your*
CI and contributors; it is ignored by consumers who install your package, because
their own lockfile governs them. There is no downside and there is a real
supply-chain upside.

## `npm ci` — the one that respects it

```console
$ npm ci
```

- Installs **exactly** the lockfile. Ranges in `package.json` are not consulted.
- Deletes `node_modules` first, so there is no leftover state.
- **Fails** if `package.json` and the lockfile disagree.

That last property is the point. It turns "someone edited `package.json` and
forgot to run install" into a build failure instead of a mystery:

```console
$ npm ci
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and
package-lock.json are in sync. Please update your lock file with `npm install`
before continuing.
npm error Missing: nanoid@5.1.16 from lock file
```

| | `npm install` | `npm ci` |
|---|---|---|
| Reads | `package.json` ranges | lockfile only |
| Writes the lockfile | yes | never |
| Existing `node_modules` | updates in place | deletes first |
| Out of sync | fixes it silently | fails the build |
| Use in | development | **CI, Docker, production** |

Use `npm ci` in every automated context. Use `npm install` when you are
deliberately changing dependencies.

## Keeping up to date

```console
$ npm outdated          # what has moved, and how far
$ npm update            # move within existing ranges, update the lockfile
$ npm install pkg@latest  # cross a major deliberately
$ npm audit             # known vulnerabilities
$ npm audit fix         # patch within ranges
```

`npm audit fix --force` crosses major versions and *will* break things. Read what
it plans to do first.

The trade-off nobody states honestly: updating has a cost, and not updating has a
larger one that arrives all at once. A dependency four majors behind is a project,
not a chore. Small regular updates, on a schedule, with CI to catch the breaks.

## Gotchas

**Symptom:** CI builds a different tree than your machine
**Cause:** `npm install` in CI, resolving ranges freshly.
**Fix:** `npm ci`.

**Symptom:** A patch release broke production
**Cause:** `^` accepted it automatically. Semver is intent, not a guarantee.
**Fix:** `npm ci` everywhere so deploys are reproducible; pin the specific
dependency if it has a track record of this.

**Symptom:** Merge conflict in `package-lock.json`
**Cause:** Two branches changed dependencies.
**Fix:** Take either side of the lockfile, then re-run `npm install` to
regenerate it. Do not hand-edit it.

**Symptom:** `npm ci` fails with `EUSAGE` / "Missing: x from lock file"
**Cause:** `package.json` was edited without re-running `npm install`.
**Fix:** Run `npm install` locally, commit the updated lockfile.

**Symptom:** `npm audit` reports vulnerabilities that cannot be fixed
**Cause:** The fix is in a transitive dependency whose parent has not updated.
**Fix:** `overrides` in `package.json` forces a version. Verify it actually works
— you are overriding the parent's declared compatibility.

**Symptom:** A `0.x` dependency broke on a minor bump
**Cause:** `^0.3.1` only allows `0.3.x` precisely because `0.x` minors are treated
as majors — but `~`/`^` confusion still catches people.
**Fix:** Pin `0.x` dependencies exactly.

## Interview questions

**★ What does `^1.2.3` allow, and what does `~1.2.3` allow?**
`^1.2.3` allows anything from `1.2.3` up to but excluding `2.0.0` — minor and
patch updates. `~1.2.3` allows `1.2.3` up to but excluding `1.3.0` — patch only.
For `0.x` versions `^` tightens to patch-level, because the minor slot carries
breaking changes there.

**★ What is the difference between `npm install` and `npm ci`?**
`npm install` resolves the ranges in `package.json`, may update the lockfile, and
patches the existing `node_modules`. `npm ci` installs the lockfile exactly, never
writes it, deletes `node_modules` first, and fails if the two files disagree. CI
and production use `ci`.

**★ Why commit the lockfile?**
So every machine and every deploy installs a byte-identical tree, verified by
integrity hashes. It is what makes builds reproducible and blocks a tampered
tarball. Consumers of a published package are unaffected — their own lockfile
governs their install.

**★ Does semver guarantee a patch release will not break you?**
No. It records the maintainer's intent. A genuine bug fix can break code that
depended on the bug, and mistakes happen. The lockfile is what turns that from a
random event into a change you choose to make.

**What does the `integrity` field in the lockfile do?**
It stores a hash of the package tarball. npm verifies it on install, so a package
that has been altered on the registry or in transit fails rather than executing.

**How do you fix a vulnerability in a transitive dependency?**
Update the direct parent if a fixed version exists. If it does not, `overrides` in
`package.json` pins the nested dependency to a patched version — accepting that
you have overridden what the parent declared it works with.

---

← Prev: [The `exports` map](08-exports-map.md) · Next → [npm day to day](10-npm-day-to-day.md)
