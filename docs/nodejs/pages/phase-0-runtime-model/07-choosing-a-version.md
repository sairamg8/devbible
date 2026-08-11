---
title: "Choosing a version"
sidebar_label: "07 · Choosing a version"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against nodejs.org's release schedule announcement and
> endoflife.date/nodejs.

**Run the Active LTS in production. Learn on Current. Pin the version in the
repo so every machine agrees.**

## The lifecycle

Every major version walks the same path:

| Stage | Length | What it means |
|---|---|---|
| **Current** | 6 months | Newest features, still absorbing changes. Great for learning, risky for production |
| **Active LTS** | 12 months | Frozen feature set, actively maintained, bug fixes backported. **This is production** |
| **Maintenance LTS** | ~12 months | Critical and security fixes only |
| **End of Life** | — | No fixes, including security. Running it is a liability |

Total supported life: **30 months** from first release.

## Where things stand — August 2026

| Version | Released | Status now | Security support ends |
|---|---|---|---|
| **26** | 5 May 2026 | **Current** — becomes Active LTS in October 2026 | 30 Apr 2029 |
| **24** | 6 May 2025 | **Active LTS** ← use this in production today | 30 Apr 2028 |
| **22** | 24 Apr 2024 | Maintenance LTS | 30 Apr 2027 |
| **20** | 18 Apr 2023 | **End of life** (April 2026) — upgrade now | — |

Practical reading: **build on Node 24 today, test against 26**, and plan the move
to 26 shortly after it goes LTS in October 2026.

This bible targets **Node 24** throughout for exactly that reason. Every example
is run on it, and no API is used that Node 24 lacks. When 26 becomes the Active
LTS in October 2026, the target moves with it — the rule is "whatever is Active
LTS", not "whatever is newest".

## The odd/even rule is ending

For a decade the convention was: even-numbered versions become LTS, odd ones
never do. That rule dies with **v27**.

From v27 onward:

- **One major per year**, shipping in **April**, promoted to LTS in **October**.
- **Every release becomes LTS.** No more odd/even.
- Version numbers track the year: 27.0.0 in 2027, 28.0.0 in 2028.
- An alpha channel runs October to March for early testing.

The v27 timeline: alpha opens **October 2026**, `27.0.0` ships **April 2027**,
LTS **October 2027**, end of life **April 2030**. Node 26 is the last release
line under the old model.

Repeating "never use odd versions" after 2027 is the most outdated Node advice
still in circulation.

## Pin the version in the repo

Four places, each for a different audience. Set all four; they cost nothing.

```bash
# .nvmrc — for humans and CI actions
24
```

```json
// package.json
{
  "engines": { "node": ">=24.0.0 <25" },
  "packageManager": "yarn@4.18.0"
}
```

```dockerfile
# Dockerfile — pin the patch, not just the major
FROM node:24.19.0-bookworm-slim
```

```yaml
# .github/workflows/ci.yml
- uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'   # one source of truth
```

`engines` is documentation by default — npm warns, it does not stop the install.
Make it binding with `engine-strict=true` in `.npmrc` if you want a hard failure.
Yarn and pnpm enforce it more aggressively.

## Version managers

You will run several projects on several Node versions. Do not fight it with a
system-wide install.

| Tool | How it works | Trade-off |
|---|---|---|
| **nvm** | Shell function that rewrites `PATH`. `nvm use` per shell | The original, works everywhere, but it is a shell script and noticeably slows shell startup. No automatic switching without a hook |
| **fnm** | Same idea, written in Rust | Much faster, `--use-on-cd` switches automatically when you enter a directory. Smaller community |
| **volta** | Pins the toolchain in `package.json` and shims the binaries | Switches per *project* with no shell hook and covers package managers too. More magic, and it wants to own your toolchain |

Any of them is fine. What matters is that the version is **declared in the
repository**, not remembered by each developer.

```console
$ cat .nvmrc
24
$ nvm use            # reads .nvmrc
Found '/home/you/app/.nvmrc' with version <24>
Now using node v24.19.0 (npm v12.0.2)
$ node --version
v24.19.0
```

## Gotchas

**Symptom:** Code works locally, crashes on the server with
`SyntaxError: Unexpected token` or `is not a function`
**Cause:** Version drift — a newer language or API feature that the server's
older Node does not have.
**Fix:** Pin the version everywhere and make CI run the same one. Check the
feature against the deployed version before using it, not after.

**Symptom:** `engines` says Node 24 and someone installed on Node 20 anyway
**Cause:** npm treats `engines` as advisory and only warns.
**Fix:** `engine-strict=true` in `.npmrc`, plus a CI check. Do not rely on people
reading warnings.

**Symptom:** The Docker image behaves differently after a rebuild you did not
change
**Cause:** The tag is floating — `node:24` moves to a new patch whenever one
ships.
**Fix:** Pin the full version and base (`node:24.19.0-bookworm-slim`) and bump it
deliberately. Reproducible builds are worth the upgrade chore.

**Symptom:** `nvm use` in a script has no effect
**Cause:** `nvm` is a shell function, not a binary — it cannot change the `PATH`
of a process that already started, and it does not exist in a non-interactive
shell.
**Fix:** Source `nvm.sh` first in the script, or use `fnm`/`volta`, which are
real executables.

**Symptom:** A security audit flags your runtime, not your dependencies
**Cause:** Running an end-of-life Node. Node 20 stopped receiving fixes in April
2026; nothing will be patched, ever.
**Fix:** Move to the Active LTS. Upgrading one major every year is far cheaper
than jumping three at once under pressure.

## Interview questions

**★ Which Node version should a production application run, and why?**
The Active LTS. Its feature set is frozen and it receives backported bug and
security fixes for 30 months from release. Current is for trying new features;
end-of-life versions get no security patches at all.

**★ What was the odd/even rule and what replaces it?**
Even majors became LTS, odd majors never did. From v27 that ends: one major per
year in April, promoted to LTS in October, and *every* release becomes LTS.
Node 26 is the last line under the old model.

**★ How do you make sure everyone on the team runs the same Node version?**
Declare it in the repo — `.nvmrc` plus `engines` in `package.json` — have CI read
that same file, and pin the exact base image in the Dockerfile. Anything relying
on a person remembering will drift.

**Is `engines` enforced?**
Not by npm on its own; it warns. `engine-strict=true` in `.npmrc` turns it into
an error, and Yarn and pnpm are stricter by default. Treat it as documentation
plus an optional guard, not a guarantee.

**What are Current, Active LTS and Maintenance?**
Current is the newest line, six months, still changing. Active LTS is twelve
months of frozen features with full backported fixes. Maintenance is the final
stretch — critical and security fixes only. After that, end of life.

**Why pin the patch version in a Dockerfile when `node:24` already works?**
Because `node:24` is a moving target: the same Dockerfile produces different
images over time, so a rebuild can change behaviour with no commit to blame.
Pinning makes the build reproducible and the upgrade a visible, reviewable
change.

---

← Prev: [Globals worth knowing](06-globals.md) · Next → [Running node](08-running-node.md)
