---
title: "Commit messages, and what belongs in one commit"
sidebar_label: "10 · Messages and scope"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-commit` §DISCUSSION (the
> 50-character recommendation and the title/body split), `man git-interpret-trailers`,
> `man git-log` (`--oneline`). **Documentation-validated, not sandbox-proven.**
> The 72-character body convention is community practice, not a documented Git
> rule, and is labelled as such below.

**A commit message is written once and read for years, usually by someone trying
to understand why a line exists. The diff already says what changed. The message's
job is why — and the commit's job is to be small enough that "why" has a single
answer.**

## The structure Git actually defines

`man git-commit`'s DISCUSSION section is the only part of this that is a rule
rather than a convention:

> Though not required, it's a good idea to begin the commit message with a single
> short (**no more than 50 characters**) line summarizing the change, followed by
> a blank line and then a more thorough description. **The text up to the first
> blank line in a commit message is treated as the commit title**, and that title
> is used throughout Git.

Two facts in that:

- **The blank line is structural.** Everything before it is the title, and Git
  uses that title in `log --oneline`, in `format-patch`'s Subject line, in
  `shortlog`, and in every host's PR and commit list. Forget the blank line and
  your whole message becomes the title.
- **50 characters is a documented recommendation.** The 72-character wrap for the
  body is a widespread convention, not something Git states — it comes from email
  workflows and from `git log` indenting output by four spaces.

```text
Fix rounding error on invoice totals

Amounts were summed as floats and rounded once at the end, so a cart of
30 items could be off by a cent. Sum in integer minor units instead and
round only when formatting for display.

The API contract is unchanged; only the internal representation moves.

Fixes: #482
```

## Imperative mood, and why

**"Fix rounding error"**, not "Fixed" or "Fixes" or "Fixing".

The reason is not style. Git's own generated messages are imperative — `Merge
branch 'x'`, `Revert "..."` — so an imperative subject reads consistently
alongside them. And the mood makes the message complete a sentence that is
actually useful:

> *If applied, this commit will…* **fix rounding error on invoice totals**.

That test also catches empty messages. *"If applied, this commit will… update
code"* is obviously worthless in a way that "update code" on its own is not.

## The body answers *why*

The diff shows what changed. Nobody needs a prose translation of it. What the
diff cannot show:

| Write about | Because |
|---|---|
| **Why this change** | The reason is invisible in six months, and it is what a reader is looking for |
| **Why this approach** | Rules out the obvious alternative someone will otherwise try again |
| **What was rejected** | "Tried X, it breaks Y" saves the next person the same afternoon |
| **Non-obvious consequences** | Behaviour changes, migration steps, anything that surprises |
| **Context that lives outside the code** | An incident, a customer report, a spec decision |

A commit that changes one line and explains a subtle reason in eight lines of body
is a good commit. The ratio is not the measure.

**Do not** write the body when the title says everything — "Fix typo in README"
needs no more. Ceremony for its own sake trains people to stop reading.

## Trailers

Structured key-value lines at the end, separated from the body by a blank line:

```text
Co-authored-by: Sam Patel <sam@example.com>
Fixes: #482
Reviewed-by: Alex Kim <alex@example.com>
```

Git parses these with `git interpret-trailers`, and `git commit --trailer` adds
them. Hosts read some of them: `Co-authored-by` gives multiple people credit on
GitHub and GitLab, and issue-closing keywords in the body or title
(`Fixes #482`) close issues on merge.

That last one is a host feature, not a Git one — the syntax varies by host, and
Git itself attaches no meaning to it.

## What belongs in one commit

The message and the scope are the same problem: **a commit that does two things
cannot have an honest one-line title.** If the subject needs an "and", the commit
usually needs splitting.

The working test — a commit should pass all four:

| Test | Why it matters |
|---|---|
| **It builds** | Otherwise `bisect` cannot use it, and it breaks anyone who lands on it |
| **Its tests pass** | Same reason, and it makes the commit a safe point to return to |
| **It does one thing** | A reviewer can hold it in their head; a title can describe it |
| **It can be reverted alone** | `git revert` on one commit should not require unpicking three |

The payoff is not tidiness. It is:

- **`git bisect`** — the whole technique assumes every commit builds. A branch of
  broken intermediate commits cannot be bisected, so a bug that lands there is
  found by reading instead of by binary search.
- **`git revert`** — reverting "fix the bug, refactor the module, bump the
  dependency" means reverting all three or none.
- **Review** — three small commits get read; one large commit gets skimmed and
  approved. This is the difference reviewers notice most.
- **`git log -p -- <file>`** — history is only a useful explanation if each step
  had one intent.

### How to get there without planning ahead

You do not have to work in atomic commits to produce them. Two tools do it after
the fact:

- **[`git add -p`](02-git-add/03-patch-mode.md)** — stage only the hunks belonging
  to one change, commit, repeat. This alone produces most of the benefit.
- **`git reset --soft`** and interactive rebase — collapse or re-split commits on
  a branch nobody else has. See [undo before you push](08-undo-before-you-push.md)
  and Phase 2.

Commit messily while thinking, tidy before anyone sees it. That is the normal
workflow, not a compromise.

## Conventional Commits, briefly

```text
feat(billing): sum invoice totals in minor units
fix: handle empty cart in checkout
chore(deps): bump express to 5.1.0
```

A widely-used convention where the title carries a machine-readable type and
optional scope. It exists to let tools generate changelogs and derive semantic
version bumps automatically.

It is **not** a Git feature and not required. Adopt it if something consumes it —
a release tool, a changelog generator, a versioning policy. Adopting it because it
looks professional gets you the ceremony without the payoff, and a repository
where half the commits say `chore:` because nobody could decide.

## Templates and enforcement

```bash
git config commit.template ~/.gitmessage    # a starting skeleton in the editor
git config commit.verbose true              # show the staged diff while writing
```

`commit.verbose` is the setting that most improves messages, because you write the
message while looking at exactly what you are committing
([`git commit`](03-git-commit.md)).

A `commit-msg` hook can enforce a format, and CI can check it on a PR. Enforcement
is a team decision and belongs to the parked team-workflow phase; the mechanism is
just a hook that exits non-zero.

## Trade-off

**Every rule here costs time at the moment you are least willing to spend it —
the end of a task, when the change already works.**

That is the honest tension, and it is why "just commit it" wins so often. A
careful message and a split commit cost perhaps two minutes; the benefit lands on
a stranger, months later, possibly you.

Two things make the trade worth taking. First, the cost is front-loaded onto the
person with the most context — you, right now, are the only person who will ever
cheaply know why. Reconstructing that later costs hours, if it is possible at all.
Second, it is not all-or-nothing: an imperative subject and one sentence of why
captures most of the value, and takes twenty seconds.

Where the rules genuinely do not pay: a personal scratch repository, a spike
branch that will be squashed, and any commit that will be rewritten before anyone
sees it. Tidy at the point the work becomes shared, not before.

## Gotchas

**Symptom:** `git log --oneline` shows your entire multi-paragraph message on one line
**Cause:** no blank line after the subject, so Git treats everything up to the first blank line as the title
**Fix:** blank line after the first line, always. It is structural, not cosmetic

**Symptom:** the title is truncated in the host's UI and in `--oneline` output
**Cause:** over-long subject. Git recommends 50 characters; tools truncate at their own limits
**Fix:** move the detail to the body. If the subject cannot fit, the commit is often doing two things

**Symptom:** `git revert` on one commit breaks the build
**Cause:** the commit did several things, and only one of them was meant to go
**Fix:** nothing retroactive. Going forward, split with `git add -p` — the atomic test exists precisely for this

**Symptom:** `git bisect` returns a commit that does not build, so you cannot test it
**Cause:** intermediate commits on a merged branch were never independently valid
**Fix:** `git bisect skip` to work around it now; keep each commit building in future

**Symptom:** the whole team's commits say `update` and `wip`
**Cause:** no shared expectation, and nobody wants to be the first to write more
**Fix:** `commit.verbose=true` and a `commit.template` do more than a policy document. If a format matters, enforce it in a `commit-msg` hook rather than asking

**Symptom:** `Co-authored-by` did not attribute the other person
**Cause:** the trailer must be in the trailer block — after a blank line, spelled exactly, with a real email
**Fix:** check with `git interpret-trailers --parse`, and confirm the email matches an account on the host

## Interview questions

**★ What part of a commit message is a Git rule, and what part is convention?**
The structure is a rule: the text up to the first blank line is the **title**, and
Git uses it everywhere — `log --oneline`, `format-patch`'s Subject line,
`shortlog`, every host's commit and PR list. The 50-character limit is a
documented *recommendation* in `git commit`'s DISCUSSION. The 72-character body
wrap is neither — it is community practice inherited from email workflows and from
`git log` indenting output by four spaces. Knowing which is which matters when
somebody quotes a linter at you as though it were Git.

**★ Why imperative mood — "Fix", not "Fixed"?**
Two reasons, neither of them taste. Git's own generated messages are imperative —
`Merge branch 'x'`, `Revert "..."` — so an imperative subject reads consistently
beside them. And it makes the subject complete a sentence that is actually useful:
*"If applied, this commit will… fix rounding on invoice totals."* That test is
also the cheapest way to catch an empty message: *"If applied, this commit will…
update code"* is obviously worthless, in a way that "update code" sitting alone is
not.

**★ What should the body of a commit message contain?**
Not a translation of the diff — the diff already says what changed. The body's job
is what the diff cannot show: why the change was needed, why *this* approach, what
was tried and rejected, non-obvious consequences, and context that lives outside
the code such as an incident or a customer report. A one-line change with eight
lines of body is a good commit; the ratio is not the measure. And a body is not
compulsory: "Fix typo in README" needs nothing more, and ceremony for its own sake
trains people to stop reading.

**★ What are the four tests for whether something belongs in one commit?**
It builds, its tests pass, it does one thing, and it can be reverted alone. The
payoff is not tidiness: `git bisect` assumes every commit builds, so a branch of
broken intermediates turns a binary search into reading; `git revert` on a commit
that did three things reverts all three or none; three small commits get read
while one large commit gets skimmed and approved; and `git log -p -- <file>` is
only an explanation if each step had one intent. The quick heuristic is the
title — if the subject needs an "and", the commit needs splitting.

**★ Do you have to work in atomic commits to produce them?**
No, and it is normal not to. Commit messily while thinking and tidy before anyone
sees it: `git add -p` stages only the hunks belonging to one change, which
produces most of the benefit on its own, and `git reset --soft` or an interactive
rebase collapses or re-splits commits on a branch nobody else has. The constraint
is the golden rule, not perfectionism — tidy at the point the work becomes shared,
and leave a personal scratch repository or a to-be-squashed spike alone.

**Should a team adopt Conventional Commits?**
Only if something consumes it. It is a convention rather than a Git feature, and
its purpose is machine-readable titles for changelog generation and automatic
semantic-version bumps. Adopted with a release tool behind it, it pays. Adopted
because it looks professional, it buys ceremony and produces a repository where
half the commits say `chore:` because nobody could decide which type applied.

**What single setting most improves a team's commit messages?**
`commit.verbose = true`, which puts the staged diff in the editor below the
message. You write the description while looking at exactly what is being
committed, which catches both the accidental extra file and the vague subject. A
`commit.template` skeleton helps too. Both do more than a policy document, and if
a format genuinely matters, a `commit-msg` hook enforces it rather than asking
people to remember.

---

← Prev: [`git log`](09-git-log.md) · Next → [`git stash`](11-git-stash.md)
