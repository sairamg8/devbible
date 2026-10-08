---
title: "Choosing a version"
sidebar_label: "07 · Choosing a version"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-10-08 against the [nodejs/Release README](https://github.com/nodejs/Release/blob/main/README.md),
> its [schedule.json](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json),
> and [nodejs.org/dist/index.json](https://nodejs.org/dist/index.json) (bundled npm per
> release); earlier pass against nodejs.org's release schedule announcement and
> endoflife.date/nodejs.

**Run the Active LTS in production. Learn on Current. Pin the version in the
repo so every machine agrees.**

## The lifecycle

Every major version walks the same path:

| Stage | Length | What it means |
|---|---|---|
| **Current** | 6 months | Newest features, still absorbing changes. Great for learning, risky for production |
| **Active LTS** | 12 months | Actively maintained; bug fixes and Release-team-audited new features land. **This is production** |
| **Maintenance LTS** | 18 months | Critical bug fixes and security updates; new features only at the Release team's discretion |
| **End of Life** | — | No fixes, including security. Running it is a liability |

Total supported life: about **36 months** from first release — **30 months** of
that counted from the day the line enters LTS. Node 24 is the worked example:
first release 2025-05-06, Active LTS 2025-10-28, Maintenance 2026-10-20, end of
life 2028-04-30 (`schedule.json`). Active LTS is not a freeze: the Release WG
defines it as audited, stable change, so expect semver-minor releases with new
features throughout the 12 months.

> *"Active LTS - New features, bug fixes, and updates that have been audited by
> the Release team and have been determined to be appropriate and stable for the
> release line."* — [nodejs/Release README](https://github.com/nodejs/Release/blob/main/README.md#release-phases)

> *"Every even (LTS) major version will be actively maintained for 12 months from
> the date it enters LTS coverage. Following those 12 months of active support,
> the major version will transition into "maintenance" mode for 18 months."* —
> same README, "Release Plan"

## Where things stand

Dates, not adjectives — a table that says "current" is wrong within months.

| Version | Released | Lifecycle dates | Security support ends |
|---|---|---|---|
| **26** | 5 May 2026 | Current from release; **Active LTS from 28 Oct 2026** | 30 Apr 2029 |
| **24** | 6 May 2025 | Active LTS from 28 Oct 2025; Maintenance LTS from **20 Oct 2026** | 30 Apr 2028 |
| **22** | 24 Apr 2024 | Maintenance LTS for the rest of its support window | 30 Apr 2027 |
| **20** | 18 Apr 2023 | **End of life** since April 2026 — upgrade off it | — |

Read the table against the calendar: the line to build on is the one whose
**Active LTS** date has passed and whose support end has not. Through most of
2026 that is **Node 24**; from **28 October 2026** it is **Node 26**, and 24
stays supported — critical fixes and security updates, with new features only at the Release team's discretion — to **30 April 2028**.

This bible targets **Node 24 (LTS)** throughout for exactly that reason, and 24
carries support to 30 Apr 2028. Every example is run on it, and no API is used
that Node 24 lacks. The target follows the rule and not the number — "whatever
line is Active LTS", never "whatever is newest" — so it moves to 26 after that
line's **28 October 2026** promotion.

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

Illustrative session, not captured output. The npm version in the parentheses is
whatever the Node build bundles: per `nodejs.org/dist/index.json`, Node 24.19.0
bundles **npm 11.17.0**, and no Node release line bundles npm 12.

```text
$ cat .nvmrc
24
$ nvm use            # reads .nvmrc
Found '/home/you/app/.nvmrc' with version <24>
Now using node v24.19.0 (npm v11.17.0)
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
The Active LTS. It is stable but not frozen — it takes backported bug fixes plus
new features the Release team has audited as safe — and the line is supported for
about 36 months from first release (30 from entering LTS). Current is for trying
new features; end-of-life versions get no security patches at all.

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
months of audited, stable change — bug fixes and vetted new features. Maintenance
is the final eighteen months — critical bug fixes and security updates, with new
features only at the Release team's discretion. After that, end of life.

**Why pin the patch version in a Dockerfile when `node:24` already works?**
Because `node:24` is a moving target: the same Dockerfile produces different
images over time, so a rebuild can change behaviour with no commit to blame.
Pinning makes the build reproducible and the upgrade a visible, reviewable
change.

---

← Prev: [Globals worth knowing](06-globals.md) · Next → [Running node](08-running-node.md)
