---
title: "An audit asks the question a lock never asks — is anything I chose now known to be bad — and the index configuration decides whether an attacker can make you choose it: audit the locked set against OSV, gate deploys on what deploys, and never let two indexes compete for one name"
sidebar_label: "23b · Auditing and indexes"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **CLI reference** for `uv audit` and `--index-strategy`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/), **uv 0.12.12**), uv's **Locking and
> syncing** (*Malware checks*) ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), uv's
> **Package indexes** concepts ([docs.astral.sh](https://docs.astral.sh/uv/concepts/indexes/)) and pip's
> **pip install** reference ([pip.pypa.io](https://pip.pypa.io/en/stable/cli/pip_install/), pip docs
> v26.2.1). Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**A lock records what you chose and never revisits it; an advisory published tomorrow against a package you
locked last month changes nothing in the file. Something has to ask, on a schedule and before every deploy,
whether the locked set contains a known vulnerability — and uv now ships that question as a command. The
other half of supply-chain hygiene is upstream of the lock: *which index* a name resolves from. pip's
historical behaviour with an extra index treats every index as an equally good source for every name, which
is exactly the property a dependency-confusion attack exploits. uv's default refuses it, and the settings
that relax that default say "unsafe" in their names for a reason.**

## `uv audit`

The CLI reference describes it:

> *"Audit the project's dependencies. Dependencies are audited for known vulnerabilities, as well as 'adverse'
> statuses such as deprecation and quarantine. By default, all extras and groups within the project are audited.
> To exclude extras and/or groups from the audit, use the --no-extra, --no-group, and related options."*

⚠️ The command is documented in the uv 0.12.12 CLI reference; I could not confirm from the changelog which
release introduced it, so check your pinned uv has it before building a pipeline on it.

The options that make it a CI tool:

| Option | Behaviour, quoted |
|---|---|
| `--frozen` | *"Audit the requirements without locking the project"* |
| `--no-dev`, `--no-group`, `--no-extra` | restrict the audit to what a given environment installs |
| `--ignore <ID>` | *"Ignore a vulnerability by ID."* |
| `--ignore-until-fixed <ID>` | *"Ignore a vulnerability by ID, but only while no fix is available. … Once a fix version becomes available, the vulnerability will be reported again."* |
| `--output-format` | `text`, `json`, or `sarif` |
| `--service-format` | default `osv` — *"OSV: https://api.osv.dev/"* |

Two jobs, two scopes — the deploy gate covers exactly what deploys; the nightly job covers everything:

```yaml
# .github/workflows/audit.yml
on:
  push: { branches: [main] }
  schedule: [{ cron: "0 3 * * *" }]
jobs:
  deploy-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv audit --frozen --no-dev
  everything:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: uv audit --frozen --output-format sarif > audit.sarif
```

`--ignore-until-fixed` is the honest way to acknowledge a vulnerability with no fix yet: it stays quiet only as
long as there is nothing to upgrade to, then fails again the day a fix ships — unlike `--ignore`, which is
forever.

## Malware checks on sync (preview)

A lighter check can run on every sync. uv marks it as not yet stable:

> *"On-sync malware checking is in preview, and is subject to change until stabilized."*

> *"While syncing, uv can perform a lightweight scan of your lockfile for known malware by checking it against
> OSV. OSV references MAL advisories from the OpenSSF's malicious packages database."* · *"If a locked dependency
> matches a malware advisory, the sync will be terminated."*

```toml
[tool.uv]
audit = { malware-check = true }
```

or `UV_MALWARE_CHECK=1` in the environment. It complements the cooldown in
[23](23-keeping-a-lock-current.md): the cooldown keeps a brand-new malicious upload out of a *new* resolution;
the check catches one that is already in your lock once the advisory exists.

## Where a name resolves from

pip's rule for multiple sources is stated in its install reference:

> *"Where more than one source of the chosen version is available, it is assumed that any source is acceptable
> (as otherwise the versions would differ)."*

and `--extra-index-url` adds sources on equal footing — *"Extra URLs of package indexes to use in addition to
--index-url."* Combined with "prefer the highest version", that is dependency confusion: publish
`acme-billing 99.0` to the public index and a resolver that consults both indexes for every name picks it over
your private `acme-billing 1.4`.

uv's default stops at the first index that has the name:

> *"By default, uv will stop at the first index on which a given package is available, and limit resolutions to
> those present on that first index (first-index). This prevents "dependency confusion" attacks, whereby an
> attacker can upload a malicious package under the same name to an alternate index."*

The alternatives are named for what they are — `unsafe-first-match` and `unsafe-best-match` — and the docs spell
out the trade: *"While unsafe-best-match is the closest to pip's behavior, it exposes users to the risk of
'dependency confusion' attacks."*

The strongest configuration pins private names to the private index and makes that index unusable for anything
else:

```toml
[tool.uv.sources]
acme-billing = { index = "internal" }

[[tool.uv.index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
explicit = true            # only packages pinned to it may come from it
```

An `explicit` index is used only for packages that name it, so `acme-billing` can come only from `internal`, and
nothing else can come from `internal` by accident.

One operational fact to plan for: *"Credentials are never stored in the uv.lock file; as such, uv must have access
to the authenticated URL at installation time."* The lock records where a file lives, not how to get in.

## Gotchas

**★ Symptom: a deploy is blocked by a vulnerability in `pytest`'s dependency tree.** Cause: *"By default, all
extras and groups within the project are audited."* Fix: gate deploys on the production set; audit everything on
a schedule:

```bash
uv audit --frozen --no-dev
```

**★ Symptom: an audit job leaves `uv.lock` modified.** Cause: without a flag the audit locks the project first — the
`--frozen` option exists to *"Audit the requirements without locking the project"* — so a lock that had drifted
from the declaration is rewritten as a side effect. Fix: audit exactly the committed lock:

```bash
uv audit --frozen
```

**★ Symptom: a vulnerability with no available fix fails every build, so someone adds `--ignore` and forgets
it.** Cause: `--ignore` is permanent; the day a fix ships, nobody is told. Fix: acknowledge it only while it is
unfixable:

```bash
uv audit --frozen --ignore-until-fixed GHSA-xxxx-xxxx-xxxx
```

**★ Symptom: after adding a private index with `--extra-index-url`, pip installed a public package with the same
name as an internal one.** Cause: pip treats every source as acceptable and picks the best version across them —
*"it is assumed that any source is acceptable"*. Fix: in uv, pin the name to the private index with an explicit
index; in pip, point `--index-url` at a private proxy that serves internal names and mirrors public ones, so
there is only one index:

```toml
[tool.uv.sources]
acme-billing = { index = "internal" }

[[tool.uv.index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
explicit = true
```

**Symptom: a resolution cannot find a newer public release of a package that also exists on the private
index.** Cause: uv's safe default — it *"limit[s] resolutions to those present on that first index"*. Fix: pin the
public package to PyPI explicitly rather than weakening the strategy for every name:

```toml
[tool.uv.sources]
requests = { index = "pypi" }

[[tool.uv.index]]
name = "pypi"
url = "https://pypi.org/simple"
```

**Symptom: `uv sync --locked` works on developers' machines and fails in the deploy job with an authentication
error.** Cause: *"Credentials are never stored in the uv.lock file"* — the deploy environment has no credentials
for the private index. Fix: provide them to the install step, for example through the keyring integration uv
documents (*"At present, only --keyring-provider subprocess is supported"*):

```bash
uv sync --locked --keyring-provider subprocess
```

**Symptom: turning on malware checks changes behaviour between two uv releases.** Cause: the feature *"is in
preview, and is subject to change until stabilized."* Fix: pin uv in CI and read the release notes before
upgrading it:

```yaml
- uses: astral-sh/setup-uv@v5
  with:
    version: "0.12.12"
```

## Interview questions

**★ Why does a project with a committed lockfile still need a vulnerability audit?**
Because a lock is a record of a decision and never re-evaluates it. An advisory published after you locked
changes nothing in the file, and uv does not even warn about yanked versions when installing from a lock. An
audit is the step that asks the new question — *"Dependencies are audited for known vulnerabilities, as well as
'adverse' statuses such as deprecation and quarantine"* — against the exact set you will install. Run it with
`--frozen` so it checks the committed lock rather than a fresh resolution, gate deploys on the production set
with `--no-dev`, and audit every group on a schedule.

**★ What is dependency confusion, and how does uv's default prevent it?**
An attacker publishes a package to a public index under the name of your private package, with a higher version.
A resolver that considers every index for every name and prefers the highest version installs the attacker's
package; pip's documented assumption that *"any source is acceptable"* with `--extra-index-url` is the classic
case. uv's default `first-index` strategy stops at the first index that has the name and *"limit[s] resolutions
to those present on that first index"*, which the docs say *"prevents "dependency confusion" attacks."* The
belt-and-braces configuration pins private names to an `explicit` index so they can come from nowhere else.

**What is the difference between `--ignore` and `--ignore-until-fixed` in `uv audit`, and why does it matter?**
`--ignore` suppresses a vulnerability ID permanently. `--ignore-until-fixed` suppresses it *"only while no fix is
available"* and reports it again *"Once a fix version becomes available."* The second encodes the real policy —
"we accept this risk because there is nothing to upgrade to" — and expires automatically when that stops being
true. The first is how an accepted risk outlives its justification, because nobody revisits a suppression that
never fails.

**How do a cooldown, an audit and a malware check divide the work?**
They act at different moments. A cooldown (`exclude-newer`) acts at resolution, keeping brand-new uploads out of
the lock in the first place. An audit acts on the locked set, catching known vulnerabilities and adverse statuses
discovered after you locked. The preview malware check acts at sync, terminating an install if a locked package
has since been flagged in OpenSSF's malicious-packages data. Hashes sit underneath all three, proving the files
are the ones you locked. None of them replaces reading the lock diff in an upgrade pull request.

---

← [23 · Keeping a lock current](23-keeping-a-lock-current.md) · [Topic index](README.md) · Next → [24 · Reading a resolution failure](24-reading-a-resolution-failure.md)
