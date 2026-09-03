# The triage ladder — what each drift class licenses

Loaded from `SKILL.md`. Work the classes **in order**: inconsistencies before drift —
they are defects that exist today, they are cheap, and fixing them stops the scanner
reporting noise every week.

🔴 **The one rule governing all of it: a patch bump never causes a page to be re-read.**


### 1 · `inconsistent` — "pages say X" (first, always)

A **bold** version in a `> Verified:` line, inside one of the pin's own `tracks`,
disagreeing with `pins.js` by a **minor or more**. The detector already filters out
cross-track matches, line-level pins and patch differences (see below), so a surviving
flag is worth taking seriously.

🔴 **It is still a claim, not proof. Confirm before touching anything.**

```bash
grep -rn '^> Verified:' docs/<track> --include=*.md | grep -i '<product>' | head -20
```

Read the **whole** matched line. The classic false positive is a **different product
with the same name in it** — `Spring Data MongoDB 5.1` is not MongoDB, and
`Spring Data Redis 4.1` is not Redis.

- **False positive** → fix the *pin*, never a page: narrow `names`, or correct `tracks`
  so the pin stops seeing pages it does not govern.
- **Real** → treat it as drift of that page's class and continue down the ladder.

⚠️ **Widening `tracks` cuts both ways.** It is also how blast radius is lost: a pin that
does not name a track cannot see pages there. When you touch `tracks`, re-run and check
the `Np` page counts moved the way you expected.

**What the detector already handles, so you do not have to** (all three added
2026-09-03 after every one of six reported inconsistencies turned out to be noise):

- **Track scoping** — a pin only sees pages under its declared `tracks`.
- **Prefix-aware, class-based comparison** — a page naming the line (`7.0` against a pin
  of `7.0.9`) is not disagreeing, and a patch difference (`4.1.0` vs `4.1.1`) is
  reported but never flagged. Patch drift is not work, here as everywhere.
- **Bold-only voting** — only a bold version may contradict `pins.js`. A page *about*
  Podman 6 citing the v6.0.0 release notes is a citation, not a pin.

### 1b · `unbolded` — pages name the product, none bolds a version

Reported as `❔ no bolded version on any page`. Not a contradiction — the corpus has no
pin there to check, so the track's provenance is weaker than it looks.

**Do not mass-bold pages to clear it.** Fixing it means the owning session bolding the
version spine as it next touches each page (see `references/house-style.md`). Report the
list; leave the pages alone.

### 2 · `patch` — mechanical, no prose read

Licenses exactly one thing: bump the version string and the date.

```bash
# 1. blast radius
grep -rl '<product> <old>' docs --include=*.md | tee /tmp/bump.txt | wc -l

# 2. scoped to quote lines only — a `> Verified:` block wraps, so match `^> `.
#    Never a bare global sed.
xargs -a /tmp/bump.txt sed -i 's/^\(> .*\)<old>/\1<new>/'

# 3. GATE: every hunk must sit inside a `> ` line. No output = pass.
git diff -U0 -- docs | grep '^[+-]' | grep -v '^[+-][+-]' | grep -v '^[+-]> '
```

If step 3 prints anything, `git checkout -- docs` and redo it per file.

⚠️ **A patch that changes behaviour is not a patch.** Skim the release headline first.
A security fix, a changed default, a deprecation → reclassify to `minor` and go to §3.
Bumping the date is only honest because the patch contract says the surface did not
move; when it did, that reasoning is void.

🔴 **Preserve the bolding.** The scanner reads **bold** in a `> Verified:` line as the
page's own pin and plain text as a historical citation. A sed that strips `**PostgreSQL
18.4**` down to plain text silently changes what the tooling thinks the page claims —
and the page then stops appearing in its own blast radius. See
`references/house-style.md`.

Then in `pins.js`: set `pin` to the new version, `checked` to today. Never back-date
`checked`.

### 3 · `minor` — changelog-driven, surgical

1. Open the changelog for **every version between `pin` and `latest`**, not just the
   newest.
2. Write down the behavioural deltas only — new API, changed default, deprecation.
   Additions no page mentions are not work.
3. Grep for the pages making a claim about each delta. **Only those pages get opened.**
   A minor is not a licence to re-read the track.
4. Edit prose → version → date, in that order, one commit per file.
   🔴 **If the edit would push a file past 300 lines, read
   `references/authoring-contract.md` and chunk it. Never condense to fit.**
5. Bump `pin` and `checked` in `pins.js`.

If a delta introduces material the corpus has no page for, that is a **syllabus
change**, not a currency edit. Stop and report; never smuggle a new topic in under a
version bump.

### 4 · `major` — syllabus diff first, no page edits

🔴 **Do not open a page until the syllabus is repointed.** A major lands new topics,
retires others and re-tiers the rest; editing pages first means editing pages that
should not exist.

1. Diff the upstream migration guide against `docs/<track>/syllabus/`.
2. Report, as a written diff, what is new, what is deprecated, what changes tier.
3. **Stop and get direction.** A major is a campaign scoped by the user, one technology
   at a time — the working agreement is *build only the step that was asked, then stop
   and report*.
4. New pages written during the campaign follow `references/authoring-contract.md` in
   full — tier badge, exhausted gotchas, exhausted interview Q&A, chunked past 300
   lines.
5. `pins.js` is bumped **last**, when the pages actually match the new major. Leaving
   `pin` on the old major during the campaign is correct — that is what `policy` and
   `cycle` are for, and it keeps the checker honest meanwhile.

### 5 · `unanchored` — a track with no version anchor

Nothing is being watched. Add the anchor; **do not touch pages.**

```bash
grep -rh '^> Verified:' docs/<track> --include=*.md \
  | grep -oiE '\*\*[a-z][a-z0-9 .+_-]{1,24}[0-9]+\.[0-9]+(\.[0-9]+)?\*\*' \
  | tr -d '*' | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn | head
```

The modal version is the corpus's de facto pin. Write it into `pins.js` with the right
`policy` and `source`, set `checked` to today, rerun. If the track names no version
anywhere, that is a **content defect** — report it; do not paper over it by pinning
`latest`.

### 6 · `event` — a dated LTS/EOL inside the 60-day horizon

```
📅 Node.js — LTS for cycle 26 on 2026-10-28 (55 days)
```

A claim that goes false on a **known day**. Hundreds of pages pin Node 24 and many call
it *"Active LTS"* — true today, false on that date.

A campaign opened **ahead** of the date, never a same-day scramble:

1. Grep the **phrase** that expires (`Active LTS`, `current LTS`, `the latest major`),
   not the version — the version often stays correct while the label does not.
2. Report the count and propose wording that cannot expire (`Node 24 (LTS)` rather than
   `the current LTS`).
3. Land it before the date. `policy: 'lts'` flips the pin's meaning that day.

### 7 · `unreachable` / `frozen`

- **`unreachable`** — a source 404'd or timed out. Check the slug by hand;
  endoflife.date has **no `java` and no `git` slug** (use `eclipse-temurin` and GitHub
  tags). Fix `source` in `pins.js`; never delete the pin.
- **`frozen`** — deliberately old. Never bump it. If the `reason` no longer holds, say
  so and ask. Changing a frozen pin is a decision, not maintenance.

---

---

Back to [`SKILL.md`](../SKILL.md) for the edit contract, the lane check, commit cadence
and scope.
