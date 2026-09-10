---
title: "GitLab Code Quality, GitHub code scanning and the JSON output put ruff's findings where reviewers and tools look — and each needs something the gate does not: a report job that exits 0 on violations so it can publish, an exact image tag, and a consumer that expects nullable locations"
sidebar_label: "11d · CI reports"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *Integrations* (raw Markdown at the `0.16.6` tag, [docs.astral.sh](https://docs.astral.sh/ruff/integrations/)),
> the `--output-format` help text in *Configuring Ruff* ([docs.astral.sh](https://docs.astral.sh/ruff/configuration/)), the 0.16.0 entry of `BREAKING_CHANGES.md`
> ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/BREAKING_CHANGES.md)); `github/codeql-action` `upload-sarif/action.yml` at v4.38.0
> ([github.com](https://github.com/github/codeql-action/blob/v4.38.0/upload-sarif/action.yml)).
> Action versions checked on each repository's releases page and tag list on **2026-09-10**: `github/codeql-action` **v4.38.0** (floating `v4` exists),
> `actions/checkout` **v7.0.1**, `astral-sh/setup-uv` **v10.0.1**.
> Version spine: **ruff 0.16.6** (2026-09-03) · uv 0.12.12 · Python 3.14.7 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**.

**A failing job tells the author *that* something is wrong; a report tells them *where*, in the
interface they are already reading. ruff writes the reports itself — `gitlab` for a merge
request's Code Quality widget, `sarif` for GitHub code scanning, `json` for anything you build —
and since 0.16.0 `ruff format --check` writes them too. The traps are all at the boundary between
reporting and gating: a job that fails on violations never reaches its upload step, an image tag
that floats is an unpinned ruff, and a JSON schema that changed in a minor release breaks the
script reading it.**

## GitLab Code Quality

GitLab renders a Code Quality report in the merge request. ruff writes one with
`--output-format=gitlab`. This is the integrations page's job as it reads at the `0.16.6` tag,
where the image tag is already that release's exact version:

```yaml
# .gitlab-ci.yml
.base_ruff:
  stage: build
  interruptible: true
  image:
    name: ghcr.io/astral-sh/ruff:0.16.6-alpine
  before_script:
    - cd $CI_PROJECT_DIR
    - ruff --version

Ruff Check:
  extends: .base_ruff
  script:
    - ruff check --output-format=gitlab --output-file=code-quality-report.json
  artifacts:
    reports:
      codequality: $CI_PROJECT_DIR/code-quality-report.json

Ruff Format:
  extends: .base_ruff
  script:
    - ruff format --diff
```

The image tag is the version pin here. The Docker tags ruff publishes are `latest`,
`{major}.{minor}.{patch}` and `{major}.{minor}` — the last documented as *"the latest patch
version"* — each also with a base suffix such as `-alpine`. `0.16.6-alpine` is exact; `0.16-alpine`
moves with every patch; `latest` moves with every release. Keep the tag equal to the version in
`uv.lock` (**12 · Pinning ruff** *(not written yet)*) — the image runs ruff without the project's
environment, so nothing else ties the two together.

Since 0.16.0, `format --check` *"supports the same output formats as the linter, including the
`github` and `gitlab` outputs"*, so the format job can also produce a Code Quality file with
`ruff format --check --output-format=gitlab --output-file=…`. How GitLab combines two
`codequality` reports from two jobs was not checked for this page.

## GitHub code scanning (SARIF)

`--output-format=sarif` produces a SARIF file that `github/codeql-action/upload-sarif` sends to
code scanning, where findings persist as alerts across runs rather than living in one job's log.
Keep it a separate job from the gate:

```yaml
  ruff-sarif:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      security-events: write
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v10.0.1
      - run: uv sync --locked --only-dev
      - run: uv run --no-sync ruff check --exit-zero --output-format=sarif --output-file=ruff.sarif .
      - uses: github/codeql-action/upload-sarif@v4
        with:
          sarif_file: ruff.sarif
          category: ruff
```

- **`--exit-zero`** — without it, any violation exits `1`, the upload step is skipped, and code
  scanning never hears about the violations the job found. `--exit-zero` still exits `2` on a broken
  configuration ([11](11-ruff-in-ci.md)).
- **`security-events: write`** — the upload action's token input says *"the workflow must have the
  `security-events: write` permission."*
- **`category`** — *"String used by Code Scanning for matching the analyses"*; it keeps ruff's
  results distinct from any other SARIF the repository uploads.

Because this job always passes, it is not a gate; the job in [11b](11b-the-ci-runner.md) still is.
Whether code scanning is available on a private repository depends on the GitHub plan, which was
not checked for this page.

## The output formats

The 0.16.6 CLI help lists: `concise`, `full`, `json`, `json-lines`, `junit`, `grouped`, `github`,
`gitlab`, `pylint`, `rdjson`, `azure`, `sarif`.

| Format | Consumer |
|---|---|
| `full` (default), `concise` | a human reading the log |
| `github` | GitHub Actions workflow annotations ([11b](11b-the-ci-runner.md)) |
| `gitlab` | a GitLab Code Quality report |
| `sarif` | GitHub code scanning, or any SARIF viewer |
| `junit` | CI systems that render JUnit-style test reports |
| `json`, `json-lines` | your own tooling — and since 0.16.0 its location fields *"may now be `null`"* |
| `grouped`, `pylint`, `rdjson`, `azure` | named in the help text; not described on this page |

The JSON change is the one that breaks scripts on upgrade: a consumer that assumed `filename` or
`location` was always a string must now handle `null`.

## Gotchas

**★ Symptom: code scanning shows no ruff alerts, though the SARIF job's log lists violations.**
Cause: `ruff check` exited `1`, so the upload step was skipped. Fix: the report job exits `0` on
violations — and only on violations.

```bash
uv run --no-sync ruff check --exit-zero --output-format=sarif --output-file=ruff.sarif .
```

**Symptom: the SARIF upload step fails even though the file was written.** Cause: the job's token
lacks the permission the upload action requires. Fix: grant it at the job level.

```yaml
    permissions:
      contents: read
      security-events: write
```

**Symptom: the GitLab job's ruff changed on its own, between two pipelines on the same commit.**
Cause: the image tag is `latest` or `0.16-alpine`, both of which move. Fix: the exact tag, kept
equal to the lock.

```yaml
  image:
    name: ghcr.io/astral-sh/ruff:0.16.6-alpine
```

**Symptom: after upgrading to ruff 0.16, a script that reads `ruff check --output-format=json`
crashes on a missing path.** Cause: since 0.16.0 the `filename` and `location` fields *"may now be
`null`"*. Fix: handle the null case in the consumer.

```python
import json
import subprocess

result = subprocess.run(
    ["ruff", "check", "--output-format=json", "--exit-zero", "."],
    capture_output=True, text=True, check=True,
)
for diagnostic in json.loads(result.stdout):
    where = diagnostic["filename"] or "<no file>"
    row = (diagnostic["location"] or {}).get("row")
    print(f"{where}:{row}: {diagnostic['code']} {diagnostic['message']}")
```

## Interview questions

**★ Why does a SARIF upload job run `ruff check --exit-zero`, and why keep a separate gate?**
The upload is a later step, and a step after a failed one does not run; with violations present
`ruff check` exits `1`, and the report never reaches code scanning. `--exit-zero` lets the report
job succeed on violations while still failing on exit `2`. The cost is that the job no longer
gates anything — so the blocking check lives in its own job, and the two answer different questions:
"may this merge?" and "what is the standing list of findings?"

**How do you show ruff's findings in a GitLab merge request?**
Run `ruff check --output-format=gitlab --output-file=code-quality-report.json` and declare that file
as the job's `artifacts:reports:codequality`, as the integrations page shows; since 0.16.0,
`ruff format --check` can write the same format. Pin the `ghcr.io/astral-sh/ruff` image to an exact
tag such as `0.16.6-alpine`, because `latest` and the `{major}.{minor}` tags move.

**What is the risk in consuming ruff's JSON output from a script?**
That the schema is treated as stable when ruff's minors are breaking releases. 0.16.0 made the
`filename`, `location`, `end_location` and fix-edit location fields nullable, so a consumer that
indexes into them unconditionally breaks on upgrade. Treat every location as optional, and read
`BREAKING_CHANGES.md` for the output format whenever ruff is upgraded.

**★ Which output format does each CI surface need, and why is the default wrong for all of them?**
The default `full` format is for a human reading a terminal, and CI surfaces parse something else:
GitHub Actions turns `github` lines into pull-request annotations, GitLab reads a `gitlab` Code
Quality file declared as a report artifact, code scanning ingests `sarif`, JUnit-style report
viewers take `junit`, and your own scripts want `json`. ruff never picks one on its own, so each job
names its format — per command, or for the whole job through `RUFF_OUTPUT_FORMAT`.

---

← Prev: [11c · ruff-action](11c-ruff-action.md) · [Topic index](README.md) · Next → **11e · Changed files and pre-commit in CI** *(not written yet)*
