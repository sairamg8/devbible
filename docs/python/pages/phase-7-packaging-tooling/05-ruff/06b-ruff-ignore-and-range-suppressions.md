---
title: "ruff's own suppression comments fix what `noqa` cannot express — `ruff: ignore[...]` on the line above covers a whole logical statement (0.16.0), `ruff: file-ignore[...]` names codes for a file with a reason, and `ruff: disable`/`ruff: enable` bracket a range (0.15.0) — at the price of stricter syntax and a rule, RUF104, for ranges you forgot to close"
sidebar_label: "06b · ruff: ignore and ranges"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **ruff 0.16.6** — *The Ruff Linter: Error suppression* ([docs.astral.sh](https://docs.astral.sh/ruff/linter/#error-suppression))
> including the line-level, block-level and file-level specifications; the 0.15.0 and 0.16.0 changelog entries
> ([github.com](https://github.com/astral-sh/ruff/blob/0.16.6/CHANGELOG.md), [github.com](https://github.com/astral-sh/ruff/blob/0.16.6/changelogs/0.15.x.md));
> the v0.16.0 release post ([astral.sh](https://astral.sh/blog/ruff-v0.16.0)).
> Version spine: **ruff 0.16.6** (2026-09-03) · Python 3.14.7 · uv 0.12.12 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no program output**. 🔴 All three comment kinds are **recent** (0.15.0–0.16.0) — older ruff and every non-ruff tool treat them as plain comments.

**`noqa` has two limitations built into its flake8 heritage: it covers one physical line, and it
has no way to say "from here to here". ruff added its own comment family to fix both. A
`ruff: ignore[...]` comment on its own line covers the whole *logical* line that follows — every
line of a function signature, every element of a long literal. `ruff: disable[...]` and
`ruff: enable[...]` bracket a range. `ruff: file-ignore[...]` names codes for a whole file and,
like the others, can carry a reason. The trade is strictness: codes are mandatory (no blanket
form for ranges), a range must be closed with identical codes at the same indentation, and an
unclosed one is reported. And because these are new — ranges in 0.15.0, the other two in
0.16.0 — a repository that uses them has quietly raised its minimum ruff version.**

## When each landed

| Comment | Status in 0.16.6 | Landed |
|---|---|---|
| `# ruff: disable[...]` / `# ruff: enable[...]` | stable | **0.15.0** (2026-02-03) — *"The linter now supports block suppression comments."* |
| `# ruff: ignore[...]` (line above, or end of line) | stable | preview in 0.15.12; stable in **0.16.0** (2026-07-23) |
| `# ruff: file-ignore[...]` | stable | preview in 0.15.12; presented as a v0.16 feature in the release post |
| rule *names* inside any of them (`unused-import`) | **preview only** | 0.15.17 (preview) |

An older ruff does not error on these comments — to it they are ordinary comments — so the
diagnostics they were meant to suppress come back. Pin ruff (**11b** *(not written yet)*).

## `ruff: ignore` — a logical line

> *"To cover an entire "logical" line (a multi-line statement or suite header), an "ignore" comment may be placed above the first line"*
> — [The Ruff Linter: Line-level](https://docs.astral.sh/ruff/linter/#line-level)

```python
# ruff: ignore[ARG001]  # Covers the entire function signature
def foo(
    arg1,
    arg2,
):
    pass

# ruff: ignore[E501]  # Covers the entire list literal
things = [
    "really long string literal ...",
    "really long string literal ...",
]
```

Placement changes the reach:

> *"Alternately, placing the "ignore" comment inside of a multi-line statement, or at the end of a line, will cover only a single "physical" line, leaving the rest of the multi-line statement or header uncovered"*

> *"Ignore comments can also be "stacked" with other comments or pragmas, and will still cover the next logical line"*

```python
# ruff: ignore[E741]
# ruff: ignore[F841]
# I definitely know what I'm doing.
i = 1
```

The grammar is stricter than `noqa`'s: *"An own-line or trailing comment starting with case
sensitive `#ruff:`, with optional whitespace after the `#` symbol and `:` symbol, followed by
`ignore[`, any rules to be suppressed, and ending with `]`."* · *"Rules to be suppressed must be
separated by commas, with optional whitespace before or after each rule name, and may be followed
by an optional trailing comma after the last rule name."* There is no blanket `ruff: ignore`.

## `ruff: disable` / `ruff: enable` — a range

> *"To define a range, both the "disable" and "enable" comments must have matching codes, in the same order, as well as matching indentation levels within a logical block of code"*

```python
def build_legacy_payload(invoice: Invoice) -> dict[str, object]:
    # ruff: disable[N806]
    InvoiceID = invoice.id          # names mirror the vendor's XML schema
    TotalAmount = invoice.total
    # ruff: enable[N806]
    return {"InvoiceID": InvoiceID, "TotalAmount": TotalAmount}
```

Rules that make ranges safe, all verbatim:

> *"If no matching "enable" comment is found, Ruff will also treat this as an "implicit" range. The implicit range is defined from the starting "disable" comment, until reaching a logical scope indented less than the starting comment"*

> *"It is strongly suggested to use explicit range suppressions, in order to prevent accidental suppressions of violations, especially at global module scope. For this reason, a `RUF104` diagnostic will also be produced for any implicit range."*

> *"Range suppressions cannot be used to enable or select rules that aren't already selected by the project configuration or runtime flags. An "enable" comment can only be used to terminate a preceding "disable" comment with identical codes."*

> *"Unlike `noqa` suppressions, range suppressions do not support "blanket" suppression of all violations. At least one violation code must be listed."*

`RUF104` (`unmatched-suppression-comment`) and `RUF103` (`invalid-suppression-comment`) were
both stabilised in 0.15.0, alongside the comments themselves.

## `ruff: file-ignore` — named codes for a file, with a reason

> *"One or more rules can also be ignored across an entire file with a `file-ignore` comment on its own line, at global module scope, and preferably near the top of the file"*

```python
# ruff: file-ignore[F401] Re-export surface for the public API; see docs/api.md
from billing_api.invoices import Invoice
from billing_api.payments import record_payment
```

The release post spells out the reason clause: *"each of these comment kinds can have an
associated "reason" explaining why they were added"*. A reason is the difference between a
suppression that can be reviewed a year later and one that can only be deleted and re-tested.

## Adding them automatically

> *"run Ruff with `--add-noqa` to add `noqa` comments or with `--add-ignore` to add `ruff: ignore` comments"* · *"Both of these flags use rule codes on stable. To add `ruff: ignore` comments with human-readable rule names instead, use `--add-ignore` with preview mode enabled."*

```bash
uv run ruff check --select B904 --add-ignore="predates the exception-chaining policy" .
```

Both flags accept an optional reason — `--add-ignore[=<REASON>]` in the 0.16.6 CLI help. Using
them to adopt ruff on an existing codebase is [06c](06c-unused-suppressions-and-adoption.md).

## Gotchas

**★ Symptom: a `ruff: ignore[ARG001]` placed on the `def` line does not cover the unused
argument two lines down.** Cause: at the end of a line the comment covers *"only a single
"physical" line"*. Fix: put it on its own line above the statement, where it covers the whole
logical line.

```python
# ruff: ignore[ARG001]
def handle_webhook(
    request: Request,
    unused_signature: str,
) -> Response:
    return Response(status_code=204)
```

**★ Symptom: after `ruff: disable[E501]` near the top of a module, long lines are ignored for the
rest of the file — and `RUF104` fires.** Cause: no matching `enable`, so the range is
*"implicit"*, running until a less-indented scope — at module level, the end of the file. Fix:
close every range explicitly with identical codes.

```python
# ruff: disable[E501]
LEGACY_SQL = "SELECT invoice_id, customer_id, amount_cents, currency, issued_at, due_at FROM invoices"
# ruff: enable[E501]
```

**Symptom: a `ruff: enable[E741, F841]` does not end a range opened with
`ruff: disable[F841, E741]`.** Cause: the codes must match *"in the same order"*. Fix: copy the
opening comment's code list exactly.

```python
def summarise_batch() -> None:
    # ruff: disable[E741, F841]
    l = 0
    # ruff: enable[E741, F841]
```

**Symptom: `# ruff: enable[S101]` inside production code does not turn `S101` on.** Cause: range
comments *"cannot be used to enable or select rules that aren't already selected"* — `enable`
only closes a `disable`. Fix: select the rule in configuration.

```toml
[tool.ruff.lint]
extend-select = ["S101"]
```

**Symptom: `# ruff: disable` with no brackets is ignored or reported.** Cause: *"range
suppressions do not support "blanket" suppression of all violations"*. Fix: list the codes.

```python
class VendorInvoice(TypedDict):
    # ruff: disable[N815]
    invoiceId: str          # field names mirror the vendor's JSON
    totalAmount: int
    # ruff: enable[N815]
```

**Symptom: a teammate's editor or a CI job on an older ruff reports violations that
`ruff: ignore` comments are supposed to suppress.** Cause: `ruff: ignore` and `file-ignore` are
0.16 features and ranges are 0.15; an older ruff sees ordinary comments. Fix: require the version
that understands them.

```toml
[tool.ruff]
required-version = ">=0.16.0"
```

**Symptom: `# ruff: ignore[unused-import]` works locally and is rejected in CI.** Cause: rule
names in suppression comments are preview-only; local runs have preview on (an editor setting or
a CLI flag), CI does not. Fix: use codes in committed comments.

```python
import billing_api.signals  # ruff: ignore[F401]
```

## Interview questions

**★ Why did ruff add `ruff: ignore` when `noqa` already existed?**
Because `noqa` can only describe one physical line, and many diagnostics belong to a statement
that spans several — a function signature, a long literal, a decorated definition. `ruff: ignore`
on the line above covers the entire logical line that follows, so one comment covers every
parameter of a signature. It also has a stricter grammar with no blanket form, supports a reason,
and, in preview, accepts readable rule names — improvements `noqa` cannot adopt without breaking
compatibility with flake8.

**★ How do `ruff: disable`/`ruff: enable` ranges work, and what are the traps?**
A `disable[codes]` comment opens a range that an `enable[codes]` with the same codes, in the same
order, at the same indentation, closes. Without the closing comment the range is implicit and
runs until a less-indented scope — at module level, the end of the file — and ruff reports that
with `RUF104`. `enable` can only close a range; it cannot turn on a rule the configuration did
not select. And codes are mandatory: there is no blanket range.

**When would you use `ruff: file-ignore` instead of `per-file-ignores`?**
When the exemption belongs to one file's content rather than to a class of files, and you want it
next to the code with a reason attached — a re-export module, a generated shim checked into the
tree, a vendored snippet. `per-file-ignores` is better for policy over many files, such as tests,
because it lives in one reviewable place and applies to files that do not exist yet.

**What compatibility cost does adopting ruff's own suppression comments carry?**
They raise the minimum ruff version the repository needs — 0.15.0 for ranges, 0.16.0 for
`ruff: ignore` — and older ruff binaries do not fail on them, they just stop suppressing. Other
tools never understand them, which matters if some flake8 plugin still runs beside ruff. The
mitigation is a `required-version` and a single pinned ruff for CLI, CI, pre-commit and editors.

---

← Prev: [06 · noqa comments](06-noqa.md) · [Topic index](README.md) · Next → [06c · Unused suppressions and adoption](06c-unused-suppressions-and-adoption.md)
