---
title: "Supply chain"
sidebar_label: "23 · Supply chain"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**, **npm 12.0.2**, yarn 4.18 — every output below
> was produced on this machine.

Every other page in this phase is about code you wrote. This one is about the code you
installed, which is most of it. The threat is not abstract: an attacker who publishes to a
package you depend on runs code **on your machine at install time** and **in your process
at runtime**, with your environment, your credentials and your network.

## Know what you actually installed

Five direct dependencies in this phase's sandbox:

```console
direct dependencies -> helmet, redis, undici, valibot, zod
packages on disk    -> 11
node_modules size   -> 14.7 MB
```

Eleven for five is unusually lean — these are libraries that made a point of having no
dependencies. The same exercise on a typical Express service returns several hundred.
Each one is a publisher who can push code you will run.

**Dependency minimisation is the only defence that scales**, because it is the only one
that reduces the number of parties you must trust. Before adding a package, the honest
questions are: how many packages does it bring, is it still maintained, and could this be
40 lines in your repo. Node's standard library absorbed a great deal of what used to be a
dependency — `fetch`, `--env-file`, `node:test`, `parseArgs`, `randomUUID`, `structuredClone`,
`glob` — and much of the ecosystem has not caught up.

## Install scripts: npm 12 changed the default

A `postinstall` script runs arbitrary code before you have executed a single line of your
own. This has been the mechanism behind most real npm compromises. **npm 12 now blocks
them unless you opt in:**

```console
npm warn install-scripts 1 package had install scripts blocked because they are
npm warn install-scripts not covered by allowScripts:
npm warn install-scripts   evil-dep@1.0.0 (postinstall: node -e "…")
npm warn install-scripts Run `npm install-scripts ls` to review, or
npm warn install-scripts `npm install-scripts approve <pkg>` to allow.
```

Approving writes an allowlist into `package.json`:

```json
"allowScripts": { "file:../evil": true }
```

and only then does it run — with everything you would expect it to have:

```console
npm notice run evil-dep@1.0.0 postinstall
    [postinstall] I can read 103 env vars and write to /…/sc2/evil
```

103 environment variables, and write access. On a CI runner that is your registry token,
your cloud credentials and your source tree.

This is a genuine improvement, and it has two consequences worth internalising. First,
**the allowlist is a review artefact** — a diff adding a package to `allowScripts`
deserves the same scrutiny as a diff adding a dependency. Second, **it does not apply
everywhere**: older npm, other package managers and your own CI image may still run
scripts. Yarn's switch is `enableScripts` in `.yarnrc.yml`, and `npm ci --ignore-scripts`
remains the belt-and-braces option for a build that does not need native compilation.

## The lockfile is an integrity check, not a version record

Every entry carries a hash of the exact tarball:

```console
resolved  -> https://registry.npmjs.org/zod/-/zod-4.4.3.tgz
integrity -> sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLD…
```

Change one byte of that hash and `npm ci` refuses:

```console
npm error code EINTEGRITY
npm error sha512-AAAA… integrity checksum failed when using sha512:
          wanted sha512-AAAA… but got sha512-ytENFjIJ… (759588 bytes)
```

Which is the whole point: a registry, a mirror or a proxy that serves different bytes than
the ones you locked is caught. Three rules follow.

**`npm ci`, never `npm install`, in CI.** `install` may resolve new versions and rewrite
the lockfile; `ci` installs exactly what is locked and fails if `package.json` disagrees.

**Commit the lockfile**, including for libraries — it does not affect your consumers, and
it makes your own builds reproducible ([phase 1, page 09](../phase-1-modules/09-semver-and-lockfiles.md)).

**Read lockfile diffs.** A pull request that changes one line of source and 400 lines of
lockfile is the shape of an attack, and it is exactly the diff everyone scrolls past.

## Signatures and provenance

```console
audited 11 packages in 2s
11 packages have verified registry signatures
3 packages have verified attestations
```

Two different claims. **Registry signatures** say the registry served what it recorded.
**Provenance attestations** are stronger — a signed statement, via Sigstore, that this
tarball was built by a specific CI workflow from a specific commit:

```console
undici@8.10.0 -> predicateType: https://slsa.dev/provenance/v1
```

That links the package on disk to a public build log, so a maintainer's stolen npm token
is no longer sufficient to publish a convincing malicious version. Only 3 of 11 here
carry it — coverage is still the exception, so treat it as a positive signal rather than
a requirement you can enforce. Run `npm audit signatures` in CI; it is fast and catches
tampering that `npm audit` never looks for.

If you publish, `npm publish --provenance` from a supported CI is a small change that
makes your consumers' verification meaningful ([phase 1, page 13](../phase-1-modules/13-publishing.md)).

## A cooldown is the highest-value setting nobody uses

Most malicious versions are found and unpublished within hours to days. Not installing
anything published in the last week removes almost the entire window:

```console
min-release-age=0    days -> undici 8.10.0
min-release-age=7    days -> undici 8.10.0
min-release-age=30   days -> undici 8.7.0
min-release-age=365  days -> undici 7.13.0
```

npm 12 spells it `min-release-age`, **in days**, implemented as a `before` date. Yarn has
`npmMinimalAgeGate`. Put a value in `.npmrc` or `.yarnrc.yml` and your lockfile stops
being the first place a compromised release lands. When nothing satisfies the range the
command errors with `ENOVERSIONS` rather than quietly installing something newer, which is
the correct failure.

## `npm audit` is worth running and worth distrusting

```console
vulnerabilities: {"info":0,"low":0,"moderate":0,"high":0,"critical":0,"total":0}
```

It matches your tree against a database of *known, disclosed* advisories. That means it
catches nothing about a package compromised today, and it reports plenty that does not
apply to you — a ReDoS in a formatter you only call at build time is a real advisory and
not a real risk. `--audit-level=high` in CI, triage the rest, and never let "0
vulnerabilities" stand in for having thought about it.

## Typosquatting

The names are close enough that a code review does not catch them:

```console
express     vs expres      -> edit distance 1
lodash      vs 1odash      -> edit distance 1
cross-env   vs crossenv    -> edit distance 1
node-fetch  vs nodefetch   -> edit distance 1
@types/node vs types-node  -> edit distance 2
```

`1odash` is a digit one. The practical defences are mechanical, not attentive: install by
copy-paste from the real package page, keep the scope (`@types/node`, not `types-node`),
and let a cooldown plus a lockfile-diff review catch the rest. A dependency that appears
in the lockfile but in no `package.json` is the signal worth alerting on.

## What to actually do

| Control | Cost |
|---|---|
| `npm ci` everywhere but local development | none |
| Commit and *review* the lockfile | attention |
| `min-release-age` / `npmMinimalAgeGate` of 7–14 days | one config line |
| `npm audit signatures` in CI | ~2 s |
| `npm audit --audit-level=high` in CI | ~2 s, plus triage |
| Keep `allowScripts` empty, or reviewed | one PR conversation per addition |
| Fewer dependencies | the only one that scales |

## Gotchas

**Symptom:** A dependency ran code on the CI runner before any test executed
**Cause:** An install script. On npm ≤11 these run by default; npm 12 blocks them unless listed in `allowScripts`.
**Fix:** Keep the allowlist minimal and reviewed; `--ignore-scripts` where nothing needs compiling.

**Symptom:** CI installs a different version than local
**Cause:** `npm install` in CI, which may resolve and rewrite the lockfile.
**Fix:** `npm ci`. It fails when `package.json` and the lockfile disagree, which is the behaviour you want.

**Symptom:** `EINTEGRITY` on install
**Cause:** The tarball's hash does not match the lockfile — a mirror, a proxy, a corrupted cache, or genuine tampering.
**Fix:** Clear the cache and retry once. If it recurs, treat it as tampering and investigate before overriding.

**Symptom:** A PR changes 400 lines of lockfile and one line of code
**Cause:** Often innocent, sometimes not — and it is the diff everyone approves unread.
**Fix:** Review lockfile diffs for packages that appear without a matching `package.json` change.

**Symptom:** "0 vulnerabilities" but a compromised package shipped
**Cause:** `npm audit` only knows disclosed advisories; a fresh malicious version has none.
**Fix:** A release cooldown is what covers that window. Audit covers the older, known half.

**Symptom:** A `postinstall` was approved once and now runs on every install
**Cause:** `allowScripts` persists in `package.json`.
**Fix:** Treat additions to it as security review, and re-check them when the package updates.

## Interview questions

**★ What is the actual threat from a compromised dependency?**
Code execution twice over: at install time via `postinstall`, and at runtime inside your
process. Measured, an approved install script read 103 environment variables and had write
access to the project directory — on CI that is registry tokens and cloud credentials.

**★ What does npm 12 change about install scripts?**
They are blocked by default unless the package appears in the `allowScripts` map in
`package.json`, with `npm install-scripts ls/approve/deny` to manage it. That makes an
approval a reviewable diff instead of an invisible default.

**★ Why `npm ci` rather than `npm install` in CI?**
`ci` installs exactly the locked tree and fails if `package.json` and the lockfile
disagree; `install` may resolve new versions and rewrite the lock. It also enforces the
integrity hashes — a tampered tarball produces `EINTEGRITY`, verified.

**★ What is provenance, and how is it different from a signature?**
A registry signature says the registry served what it recorded. A provenance attestation
is a Sigstore-signed statement that the tarball was built by a specific CI workflow from a
specific commit, so a stolen publish token is not enough. Verify with `npm audit
signatures`; only 3 of 11 packages here carried one, so it is a signal, not a gate.

**★ What single setting reduces supply-chain risk most?**
A release cooldown — `min-release-age` in npm (days), `npmMinimalAgeGate` in yarn. Most
malicious versions are caught within days, so refusing anything younger than a week
removes nearly the whole exposure window at the cost of one config line.

**Is `npm audit` enough?**
No. It matches known advisories, so it says nothing about a package compromised today, and
it reports issues in build-only tooling that carry no runtime risk. Run it at
`--audit-level=high`, pair it with `audit signatures` and a cooldown, and treat "0
vulnerabilities" as one data point.

---

← Prev: [Security headers and CSP](./22-security-headers.md) · Next → [The Permission Model](./24-permission-model.md)
