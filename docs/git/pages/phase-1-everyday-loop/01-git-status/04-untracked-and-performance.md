---
title: "Untracked files, performance and config"
sidebar_label: "04 · Untracked and performance"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-status`, sections
> *OPTIONS* (`-u`, `--ignored`, `--ignore-submodules`), *CONFIGURATION*,
> *BACKGROUND REFRESH* and *UNTRACKED FILES AND PERFORMANCE*.
> **Documentation-validated, not sandbox-proven** — no timings are quoted here,
> because none were measured.

**Almost all of `git status`'s cost is one question: which files on disk does Git
not know about? Answering it means walking the working tree. Everything Git
offers to make `status` fast is either a way to skip that walk, or a way to cache
its answer — and every one of them trades away something you might have wanted.**

## Why untracked files are the expensive part

Tracked files are cheap. The index already lists every one of them with cached
size and modification time, so Git can decide "unchanged" without reading the
content. That is the stat cache described in
[the index is a real file](../../phase-0-how-git-stores-things/05-the-index.md).

Untracked files have no such shortcut. To report them, Git must enumerate the
working tree, compare what it finds against the index, and apply the ignore rules
to whatever is left over. There is no list to consult — the answer lives in the
filesystem, and the filesystem is the slow part.

The manual is blunt about the consequence: *"git status can be very slow in large
worktrees if/when it needs to search for untracked files and directories"*, and it
warns that there is **no single optimum set of settings right for everyone**. What
follows is a set of levers, not a recipe.

## `-u`: how much of the untracked truth to ask for

| Mode | Behaviour |
|---|---|
| `-uno` | Show **no** untracked files. The fastest option |
| `-unormal` | Show untracked files and directories — a wholly-untracked directory collapses to one entry. **The default** |
| `-uall` | Also show every individual file inside untracked directories |

Two details from the manual that trip people up:

- The mode **must be stuck to the option**: `-uno` works, `-u no` does not.
- Bare `-u` means `-uall`, not `-unormal`. Writing `-u` because it looks like
  "show untracked" gives you the *most* expensive mode, not the default one.

The default is `normal` deliberately, "to help you avoid forgetting to add newly
created files". The collapse to a single directory entry — the `?? src/` in
Phase 0's recorded output — is the compromise: you learn that something new
exists without Git having to enumerate what is inside it.

`status.showUntrackedFiles` sets the default, and it accepts the usual boolean
spellings, where true means `normal` and false means `no`.

### The cost of `-uno`, stated plainly

The manual attaches a warning to the fastest option: *"git status will not list
the untracked files, so you need to be careful to remember if you create any new
files and manually `git add` them."*

That is not a small footnote. With `-uno` set globally, a new file you forgot to
add is invisible in `status`, invisible in the commit preview, and will simply not
be in the commit. The tell is the different clean message —
`nothing to commit (use -u to show untracked files)` rather than
`nothing to commit, working tree clean`, covered in
[the three sections](01-the-three-sections.md). If you set `-uno`, learn to read
that line.

## `--ignored`: three different questions

Ignored files are never listed unless asked for, and "asked for" has three modes:

| Mode | Behaviour |
|---|---|
| `traditional` | The default when `--ignored` is given with no value. Shows ignored files and directories — and individual files inside ignored directories only if `--untracked-files=all` is also given |
| `no` | Show no ignored files |
| `matching` | Show paths that **explicitly match** an ignore pattern. An ignored directory is shown but its contents are not; a directory that does not itself match, but whose contents are all ignored, is not shown while its contents are |

`matching` is the mode to reach for when the question is *"which rule is
responsible?"* rather than *"what is being ignored?"* — it distinguishes a
directory that an ignore rule names from a directory that merely happens to be
empty of interesting files.

For a single path, the direct answer is better than either:
`git check-ignore -v <path>` names the file, line number and pattern that matched.
That is the subject of topic 05 of this phase, `.gitignore`.

## `status` writes to your repository

This surprises people, and it explains a class of intermittent failures:

> By default, `git status` will automatically refresh the index, updating the
> cached stat information from the working tree and **writing out the result**.

The write is an optimisation, not a requirement — `status` computes the values for
itself either way, and writes them so the *next* command does not have to. But
writing the index takes `.git/index.lock`, and a lock is a shared resource.

The manual's own recommendation for anything running `status` in the background —
an editor's Git integration, a shell prompt, a file watcher — is:

```bash
git --no-optional-locks status
```

Note where the flag goes: on `git`, before the subcommand, because it is a
top-level option. If you have ever seen `Unable to create '.git/index.lock':
File exists` from a command you did not run, an unattended `status` is a prime
suspect.

## The four levers for a slow `status`

The manual lists these in order of increasing sophistication. It also gives one
piece of advice first: **run `git status` again before tuning anything**, because
caching may already make the second run fast, and a cold first run is not a
measurement of the steady state.

| Lever | What it does | What it costs |
|---|---|---|
| `--untracked-files=no` / `status.showUntrackedFiles=no` | Skips the untracked search entirely. The fastest option | You stop being told about new files. Forgetting to `git add` becomes silent |
| `advice.statusUoption=false` | Disables the warning Git prints when enumerating untracked files takes **more than 2 seconds** | Nothing, if you have already accepted the trade-off. It hides a signal, it does not fix a cause |
| `core.untrackedCache=true` | Git remembers the set of untracked files per directory and only re-searches directories modified since the last `status` | The cache is stored **in `.git/index`**, so the index grows and must be kept up to date. Git still has to find which directories changed |
| `core.untrackedCache=true` **plus** `core.fsmonitor=true` | A filesystem monitor tells Git which directories changed, so it does not have to look | A daemon, and the caveats that come with one. FSMonitor without the untracked cache gives *"greatly reduced"* benefit |

Two facts from that table are worth pulling out because they contradict
expectations.

**The untracked cache lives inside the index file.** It is not a separate cache
directory that can be deleted independently, and enabling it makes `.git/index`
larger. The manual's judgement is that the reduced search time is *usually* worth
the size — "usually" being the manual's word, not a guarantee.

**The caches need warming.** *"After you turn on the untracked cache and/or
FSMonitor features it may take a few `git status` commands for the various caches
to warm up before you see improved command times. This is normal."* A single run
immediately after flipping the setting proves nothing — which is a specific case
of a general rule about believing your own measurements.

## Submodules have their own switch

`--ignore-submodules[=<when>]` controls how much submodule state counts as a
change:

| `<when>` | Behaviour |
|---|---|
| `none` | A submodule is modified if it has untracked **or** modified files, or its HEAD differs from the recorded commit. Overrides any `submodule.<name>.ignore` config |
| `untracked` | Untracked content inside a submodule does not make it dirty; modified content still does |
| `dirty` | Ignore all working-tree changes inside submodules — only the recorded commit matters. This was the behaviour before Git 1.7.0 |
| `all` | Hide all submodule changes, and suppress `status.submoduleSummary` output |

Scanning a submodule's working tree is a recursive `status`, so on a superproject
with several large submodules this is a genuine performance lever as well as a
noise filter.

## The configuration worth knowing

| Setting | Effect |
|---|---|
| `status.showUntrackedFiles` | Default for `-u`. `no` / `normal` / `all` |
| `status.relativePaths` | `false` makes paths relative to the repository root instead of your current directory. Porcelain formats ignore this |
| `status.branch` | Show the branch header in short format by default — `-b` without typing it |
| `status.short` | Use the short format by default |
| `status.showStash` | Show the stash count by default |
| `status.renames` | Rename detection default; `copies` also enables copy detection |
| `status.submoduleSummary` | A number or `true` enables the submodule commit summary in the long format |
| `color.status` (or the legacy `status.color`) | Colour output; `color.status.<slot>` tunes individual pieces |
| `advice.statusHints` | The per-section command hints |
| `advice.statusUoption` | The "took more than 2 seconds" warning |
| `core.untrackedCache`, `core.fsmonitor` | The two caching levers above |
| `core.quotePath` | How unusual characters in paths are quoted in non-`-z` output |

`status.relativePaths` deserves a second mention because it is the one setting
that changes what a *string* means rather than what is shown: paths are
cut-and-pasteable by default precisely because they are relative to where you are
standing. Turning it off is defensible in a repository you always operate on from
the root, and confusing everywhere else.

## Trade-off

**Every `status` setting trades safety for speed, and the fast end of the range
is where mistakes become invisible.**

The default configuration is tuned for someone who might forget to add a file: it
enumerates untracked files, prints hints, and warns you when the enumeration is
slow. Each lever above removes one of those protections in exchange for time.
`-uno` is the extreme — `status` becomes fast and stops answering the question
most likely to bite you.

The order to try things in follows directly from that. **Cache before you
suppress:** `core.untrackedCache`, then FSMonitor, and only then consider
`-uno` — because the first two make Git faster at telling you the truth, while
the last one makes it faster by telling you less. And if you do land on `-uno`,
set it per-repository rather than globally, so the one monorepo that needs it does
not change how Git behaves in every other repository you work in.

## Gotchas

**Symptom:** `nothing to commit` in a directory that visibly contains new files
**Cause:** untracked reporting is off — `-uno`, or `status.showUntrackedFiles=no`, possibly set globally years ago
**Fix:** `git status -uall`, then `git config --show-origin --show-scope status.showUntrackedFiles` to find which file set it

**Symptom:** `Unable to create '.git/index.lock': File exists` from a command you did not run
**Cause:** something is running `git status` in the background — an editor integration, a prompt, a watcher — and `status` writes the refreshed index by default
**Fix:** have the background caller use `git --no-optional-locks status`. Delete a stale lock only after confirming no Git process is running

**Symptom:** you typed `git status -u` expecting the default and it got slower
**Cause:** bare `-u` means `-uall`, the most expensive mode. `-unormal` is the default, and the mode must be stuck to the flag — `-u no` is not `-uno`
**Fix:** spell the mode explicitly every time: `-uno`, `-unormal`, `-uall`

**Symptom:** you enabled `core.untrackedCache` and the next `status` was no faster
**Cause:** the caches need several runs to warm up — the manual says so explicitly
**Fix:** run it a few more times before judging. Compare steady-state against steady-state, never a cold run against a warm one

**Symptom:** `git status` warns that enumerating untracked files took over 2 seconds, every single time
**Cause:** a genuinely large working tree; the warning is `advice.statusUoption` doing its job
**Fix:** fix the cause first (untracked cache, FSMonitor, or a build directory that should be ignored). Silence the advice only once you have accepted the trade-off

**Symptom:** a superproject `status` is slow and always shows submodules as dirty
**Cause:** submodule working trees are scanned recursively, and untracked build output inside them counts as modification
**Fix:** `--ignore-submodules=untracked` (or `dirty`), or ignore the build output inside the submodule where it belongs

## Interview questions

**★ Why is `git status` slow on a large repository, and what is actually slow?**
Finding untracked files. Tracked files are covered by the index's cached stat
data, so Git can skip re-hashing them; untracked files require walking the working
tree and applying ignore rules, and there is no list to consult instead.

**★ What are the three `-u` modes and which is the default?**
`no`, `normal` and `all`. `normal` is the default: untracked files and
directories, with a wholly-untracked directory collapsed to one entry. `all`
expands those directories; `no` skips the search entirely — and bare `-u` means
`all`, not `normal`.

**★ Does `git status` modify the repository?**
Yes. By default it refreshes the index and **writes it out**, so subsequent
commands can reuse the cached stat data. That write takes `.git/index.lock`,
which is why the manual recommends `git --no-optional-locks status` for anything
running it in the background.

**★ Your team's monorepo has a slow `status`. What do you try, in what order?**
Run it twice first — caching may already have fixed it. Then `core.untrackedCache`,
then FSMonitor alongside it, allowing several runs for the caches to warm. Only
after that consider `-uno`, per-repository rather than globally, because it buys
speed by no longer reporting new files at all.

**Where is the untracked cache stored?**
Inside `.git/index`. It is not a separate file, and enabling it makes the index
larger — the manual's position is that the reduced search time is usually, not
always, worth it.

**How do you find out why a specific file is being ignored?**
`git check-ignore -v <path>`, which prints the file, line number and pattern that
matched. `git status --ignored=matching` answers the broader version of the
question by showing which paths explicitly match a pattern.

**What is the difference between `--ignore-submodules=dirty` and `=all`?**
`dirty` ignores working-tree changes inside submodules but still reports when the
recorded commit differs from the submodule's HEAD. `all` hides submodule changes
entirely and also suppresses the submodule summary.

---

← Prev: [Porcelain, for scripts](03-porcelain-for-scripts.md) · Next → [Topic index](README.md) 
