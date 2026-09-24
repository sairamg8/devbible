---
name: cursor-java-p11-audit
description: Java Phase 11 audit trail — split out of CURSOR-JAVA.md at the 300-line cap on 2026-08-31. What is already proven done, topic 05's position map, the dangling-link inventory, the phase-10 Testcontainers 1.x defect, and the split-versus-trim incident record every fork brief must carry.
metadata:
  type: project
---

# Java Phase 11 · the audit trail

Split out of `CURSOR-JAVA.md` on 2026-08-31 when that file hit 306 lines. **The cursor is what
you need to start writing; this is the proof of what is already done.** Nothing was dropped in
the split — the two files together are longer than the one was.

### ✅ NOTHING IS OWED — BOTH INDEXES ARE WRITTEN

✅ **`01-junit-5/README.md`** (17:32) — 142 lines. Repaired the four live 404s in closed topics
02 and 03 at a stroke.
✅ **`04-mockito/README.md`** (18:12) — 140 lines, and the renumber with it: positions contiguous
**1–57**, **no file renamed** (diff = 17 `sidebar_position` lines, nothing else). Writing it also
resolved topic 05's last two dangling links.
✅ **`05-the-test-pyramid/README.md`** (18:08) — 108 lines, 22 chunks, 300 ★.

🔴 **The only dangling links left in the whole phase are topic 06's forward references**
(`03-mockmvctester.md`, `03b-the-classic-api.md`, `07-exception-handlers.md`,
`08-security-in-a-slice.md`, `09-what-mockmvc-cannot-test.md`) — all being written by the live fork.

### 📌 Topic 05 · sidebar_position map (coordinator's lane, so nobody collides)

1 `01-the-pyramid` · 2 `02-a-unit-test-needs-no-spring` · 3 `03-the-slices` ·
4 `03b-what-a-slice-excludes` · 5 `03c-the-slice-catalogue` · 6 `04-springboottest` ·
7 `04b-webenvironment` · 8 `05-the-context-cache` · 9 `05b-what-evicts-it` ·
10 `05c-context-pausing` · 11 `06-bean-overriding` · 12 `06b-overriding-changes-the-cache-key` ·
13 `06c-mockitospybean` · 14 `06d-testbean` · 15 `06e-overrides-and-aop-proxies` ·
**16 = NEXT, `07-test-properties-and-profiles`** · 17 `07b` · 18 `08-transactions-in-tests` · 19 `08b` ·
20 `09-the-twenty-minute-suite` · 21 `10-choosing-a-level` · 22 `11-the-checklist` · 0 `README.md`.

🔴 Chunks 03–06e already link forward to `05b`, `06-bean-overriding`, `06e-overrides-and-aop-proxies`,
`07-test-properties-and-profiles`, `08-transactions-in-tests`, `09-the-twenty-minute-suite` and
`10-choosing-a-level` **by exactly those filenames**. Use those names or repoint the links.


---

### ⚠️ A defect in CLOSED phase-10 work, recorded not fixed

Testcontainers 2.x dropped the self-type generic from module container classes, so
`phase-10-data-access/05-sql-first-access/12g-testcontainers-and-serviceconnection.md` is
written against 1.x and **does not compile on the pinned 2.0.5**. Phase 10 is closed; a
correction pass is the user's call, not a drive-by edit. Details in the T07 research file.

## 🔴🔴 THE LESSON THIS PHASE KEEPS TEACHING — put it in every fork brief

**A fork told to split a file will sometimes DELETE content instead, and the diff is the only
tell.** It happened **three times in this phase alone**. The worst case: `04/06e` went
**358 lines / 16 ★ → 199 / 6 with no sibling file**. The file was untracked, so **git could not
recover it** — it survived only because a section listing had been read minutes earlier and the
fork still held the text, and was rebuilt verbatim into `06f`.

🔴 **A trim passes the cap check, the MDX check and the link check, and is indistinguishable
from a split in a file listing.** The only detection is:

```bash
wc -l <file>; grep -c '^\*\*★' <file>      # BEFORE
# ... after the split: a NEW FILE must exist, and the combined counts must not have fallen
```

Record both numbers before, demand both after, and never accept "I split it" as a report.
Genuine splits this session, for calibration: 476→1,010 lines (22→54 ★) · 312→391 (14→18) ·
301→442 (13→19) · 358→192+197 (22→22, my own).

**Second recurring defect: rename-after-linking**, now four Java phases deep, and
`fixlinks.py` is blind to all of it. Every brief must say: `ls` before writing a link; after
any rename, `grep -rn 'old-name' .` and repoint targets **and visible labels**.

**Third: my own briefs were wrong twice**, and the forks were right to check rather than
comply — `Strictness` has **three** values (the four-valued enum is the nested
`Mock.Strictness`), and the Framework 7.0 reference does **not** present `MockMvcTester` as
current (it lists Hamcrest first; Boot 4.1 is what switched its examples). **Tell forks to
verify the brief against the docs, not to trust it.**

## 🔴 The dangling-link inventory — resolved against the filesystem 2026-08-28

`fixlinks.py` reports these as clean. They were found with the loop in the QC section below.
**Nothing here is broken prose — every one is a link to a file nobody has written yet.** But
four of them are **live 404s inside CLOSED topics**, which is a different severity:

✅ **The four live 404s inside CLOSED topics are GONE** — `02-assertj/README.md`,
`03-parameterized-tests/01` (×2) and `/04` all linked `../01-junit-5/README.md`; the T01 index
now exists. **Nothing dangling is left inside a closed topic.** Re-verified with the loop below
at 2026-08-28 17:32: every remaining entry points at a chunk that is genuinely unwritten.

| Link target | Linked from | Fixed by |
|---|---|---|
| ~~`../01-junit-5/README.md`~~ | ~~`02-assertj`, `03-parameterized`~~ | ✅ **DONE — T01 index written** |
| ~~`../08-test-data-patterns/README.md`~~ | ~~`01-junit-5/06c`~~ | ✅ **DONE — made plain text** |
| `../04-mockito/README.md` | `05/01`, `05/02` | the T04 index |
| `08-spies.md` | `04/03`, `03f`, `03g`, `10`, `10d` | writing T04 `08` |
| `09-injectmocks.md` | `04/10c` ×2 | writing T04 `09` |
| `03-the-slices`, `05-the-context-cache`, `06-bean-overriding`, `06b`, `08-transactions`, `09-the-twenty-minute-suite` | `05/01`, `05/02` | writing T05 chunks 03+ |
| `02-webmvctest`, `03-mockmvctester`, `03b-the-classic-api`, `08-security-in-a-slice`, `09-what-mockmvc-cannot-test` | `06/01`, `06/01b` | writing T06 chunks 02+ |

⚠️ **`12c-contract-testing-a-fake` is owed but NOT dangling** — `12b` promises the technique
twice in prose and both references were converted to plain bold *(not written yet)*.

---


---

> 🗄️ **95 lines of superseded history moved to [CURSOR-JAVA-P11-AUDIT-HISTORY.md](CURSOR-JAVA-P11-AUDIT-HISTORY.md) on 2026-09-08**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/CURSOR-JAVA-P11-AUDIT-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```
