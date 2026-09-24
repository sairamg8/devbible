---
name: progress-java-p13-oauth2
description: Phase 13 (OAuth2/OIDC) build record — what session a78f3cb7 wrote on 2026-08-31, the RFC corrections it made, the four-fork dispatch pattern that worked, and the exact resume points. Open when picking up phase 13 or when running a wide fork fleet on any phase.
metadata:
  type: project
---

# ☕ Java phase 13 · OAuth2 & OIDC — the 2026-08-31 build

🔴 **Position lives on [[java-board]], not here.** This file is the *record*: what was
decided, what was corrected against the RFCs, and what the fork pattern actually cost.

## ▶️ The 2026-09-04 pass — session `e7ea206c`

Picked on the user's instruction *"continue on java pick phase 13 and use dev bible skill"*.
Wound down on request at **8 of 14 closed (57%)**, working tree clean.

### 🔴 The finding that mattered: 76 pages with no navigation

Every chunk in phase 13 ended at a literal `{/* FOOTER */}` marker — the placeholder a fork
leaves for its coordinator. It is a **valid MDX comment with no link to resolve**, so the
300-line check, `mdxcheck.py` and the link resolver *all pass a page that has no `← Prev ·
Index · Next →` line at all*. The 2026-08-31 hand-off note had recorded it as reassurance
("nothing was cut off mid-write"); it was the defect.

🔴 **This is why `grep -rln '^{/\* FOOTER \*/}$' <topic dir>` is in the authoring contract's
pre-report checklist.** It was, and the phase still shipped this way, because the note above
made it read as expected state. **A `{/* FOOTER */}` in a topic that anyone has called
"closed" is always a defect, whatever the hand-off says.**

### What the pass did

| | |
|---|---|
| Indexes written | **03, 05, 06, 08** (61 chunks / 15,150 lines had been unindexed) + **07** |
| Footers wired | **all 76** existing chunks — prev / topic index / next, and next-topic across boundaries |
| Placeholders repointed | **41** `*(not written yet)*` markers naming topics 02–06 and 08, now on disk |
| `_category_.json` added | **7** — only topic 05 had one |
| Splits | `08/05-the-request-path.md` 302 → `05` + `05d` (3,480→3,604 lines, 167→172 ★) |
| **Topic 07 closed** | 1 chunk → **14 chunks + index, 3,415 lines, 202 ★** |

Topic 07's chunks: the artefact · the authentication request · asking about the human ·
§3.1.3.7's thirteen validation rules · signature/time/conditional checks · the three bindings
· generating and storing them · discovery · the metadata document · standard scopes and
claims · UserInfo · `sub` is not an email · response types and modes · logout. **Four were
drafted over the cap and split** (343→474, 342→440, 313→416, 316→400 lines); every split
proved UP on both line and ★ counts.

### 🔴 The provenance limit the next session inherits

**The published HTML of OpenID Connect Core 1.0 truncates before §5** in the form this corpus
can fetch. Two attempts returned NOT FOUND for **§5.1** (Standard Claims), **§5.3/§5.3.2**
(UserInfo Endpoint / Successful Response) and **§8** (Subject Identifier Types). The four
logout specifications — RP-Initiated, Front-Channel, Back-Channel, Session Management — are
separate documents and were **not fetched at all**.

Chunks 10, 11, 12 and 14 therefore carry an explicit ⚠️ note on their own `> Verified:` lines
saying what could not be read, and present that material as **well-established practice
grounded in the sections that were read** rather than as quotation. **That is the correct
outcome, not a shortfall** — the alternative was quoting normative text from memory. A later
pass with a readable copy should upgrade those four pages to verbatim citation.

Banked verbatim quotes that *were* obtained: [[research-java-p13-t07-oidc]] — §3.1.3.7's
thirteen rules, §3.1.2.1's parameter definitions, Discovery §4/§4.3/§3. **Do not re-fetch.**

### ⚠️ Closed is not exhausted

Each of 03, 05, 06 and 08's new indexes carries a **Still owed** section naming chunks the
2026-08-31 author referenced in prose but never wrote: **2** in topic 03 (implicit and
password grants), **7** in 05 (refresh rotation, the rotation race, reuse detection, RFC 7009,
introspection, opaque-vs-JWT, the ID token role), **~12** in 06 (time claims, algorithm table,
key rotation, the five classic attacks, `JwtEncoder`), **~10** in 08 (audience, validator
bean, clock skew, authorities mapping and the converters, introspection, multi-tenancy, error
responses). Those are extension work on navigable topics, not blockers.

### Whole-phase QC at wind-down

0 files over the 300-line cap · **0 `{/* FOOTER */}` markers** · **569 links, 0 dangling** ·
0 MDX hazards · no duplicate `sidebar_position` in any topic · every content page badged and
`> Verified:`-stamped. Phase totals on disk: **97 chunks + 8 indexes · 22,619 lines ·
1,172 ★**.

### Found, not fixed — other sessions' lanes

- `docs/java/pages/phase-12-jvm-production/13-jvm-flags-that-matter/05-the-live-list-memory.md`
  grew past the cap during this session (301 → 311 lines).
- Several `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/` files were 350–430 lines
  while being written.
- Both belong to live sessions in this shared checkout and were left alone.

---

## What was written

Session `a78f3cb7`, one sitting, 2026-08-31. **76 chunks + 3 indexes · 18,886 lines ·
1,001 `**★` gotcha and interview entries.** 0 files over the 300-line cap, 0 MDX hazards,
0 broken links, everything committed.

| Topic | Who | Chunks | Lines | ★ | State |
|---|---|---|---|---|---|
| 01 · Why OAuth2 exists | coordinator | 5 | 1,214 | 73 | ✅ closed |
| 02 · The four roles | coordinator | 6 | 1,590 | 106 | ✅ closed |
| 03 · Auth code + PKCE | fork A | 20 | 4,711 | 256 | ⚠️ index owed |
| 04 · Client credentials | coordinator | 3 | 716 | 44 | ✅ closed |
| 05 · The three tokens | fork C | 16 | 3,982 | 188 | ⚠️ index owed |
| 06 · JWT anatomy | fork B | 11 | 3,005 | 150 | ⚠️ index owed |
| 07 · OpenID Connect | coordinator | 1 | 216 | 17 | ⚠️ index owed |
| 08 · Resource server | fork D | 14 | 3,452 | 167 | ⚠️ index owed |

Phase went 160 → 163 of 233 topics for the Java corpus as a whole.

## 🔴 The RFC correction — the rule working as intended

`_PHASE-NOTES.md`'s first draft said the implicit grant was a **MUST NOT** and PKCE a
blanket **MUST**. Verified against datatracker the same hour and **both were overstated**:

- RFC 9700 **§2.1.2** — implicit is *"Clients **SHOULD NOT** use the implicit grant"*.
- RFC 9700 **§2.4** — only the password grant is *"**MUST NOT** be used"*.
- RFC 9700 **§2.1.1** — PKCE is *"Public clients **MUST** use PKCE"* but *"For confidential
  clients, the use of PKCE … is **RECOMMENDED**"*; and *"Authorization servers **MUST**
  support PKCE"*.
- RFC 9700 **§2.1** — redirect URIs: *"authorization servers **MUST** utilize exact string
  matching except for port numbers in `localhost` redirection URIs of native apps"*.
- RFC 9700 **§2.2.1** — sender-constraining is a **SHOULD** (mTLS RFC 8705 / DPoP RFC 9449).

The binding notes were corrected and both live forks were messaged mid-run. **This is the
"verify the brief, do not comply with it" instruction paying for itself** — it is now in
every fork brief for this phase and should stay there.

Also corrected: the phase README banner said **Spring Security 6.x**. Boot 4.x manages
**7.x**, and the rest of the corpus (`phase-9-spring-boot/11-spring-security/`) already said
7.x. Fixed in the README and pinned in `_PHASE-NOTES.md`.

## The four-fork pattern — what worked, and the two things that made it safe

The user asked for **4 author forks + coordinator**, wider than [[java-playbook]]'s "three
agents maximum". It worked, and two deviations from the playbook are why:

1. 🔴 **One topic directory per fork, not disjoint `sidebar_position` bands inside one
   topic.** Disjoint *paths* means zero collision risk, and a fork that dies leaves a
   recognisable `⚠️ partial` topic rather than a hole in the middle of someone else's
   numbering. Recommend this over banding whenever the fleet is wider than two.
2. 🔴 **The coordinator commits on the forks' behalf, banking only files that carry the
   `{/* FOOTER */}` marker.** `devbible-author` never commits, so without this the forks'
   work sits uncommitted for hours — the exact thing per-file cadence exists to prevent. The
   footer check is what makes it safe: a file mid-write has no footer and is left alone.
   Script: `bank-forks.sh`, reproduced below in substance.

```bash
# Bank only COMPLETE fork chunks. A file with no {/* FOOTER */} was cut off mid-write.
for f in "$d"/*.md; do
  grep -q '{/\* FOOTER \*/}' "$f" && DONE+=("$f") || SKIP+=("$f")
done
git add "${DONE[@]}" && git commit -m "…"
```

**Result at wind-down: 0 truncated files across all four forks.** Every chunk on disk had
its footer, so the next session has no half-file to finish before starting.

## 🔴 The wind-down defect — a stopped fork leaves broken links, and it fails the build

**Found only by the final QC sweep, after all four forks were stopped.** Each fork had
linked *ahead* to chunks it planned but never reached — **87 relative links across 34
files** pointing at files that do not exist. Docusaurus fails the build on those, so the
phase was un-buildable and nothing before the final sweep would have said so.

Fixed by demoting every dangling link to `**Title** *(not written yet)*`, the convention the
coordinator topics already used from the start.

🔴 **This is now a mandatory wind-down step for any fork fleet**, not a phase-13 quirk:

```bash
# Every dangling relative .md link in a directory tree -> bold prose. Run at wind-down.
for f in <dir>/*/*.md; do d=$(dirname "$f")
  grep -oE '\]\(([^)h][^)]*)\)' "$f" | sed 's/](//;s/)$//' | while read -r l; do
    [ -e "$d/${l%%#*}" ] || echo "BROKEN $f -> $l"; done; done
```

🔴 **And prove the rewrite is not a trim**: record total lines and `grep -c '^\*\*★'`
before and after. Here both were **identical** — 18,886 lines and 1,001 entries — which is
what distinguishes a link rewrite from content loss. A tool that edits many files at once is
exactly where the four historical content-destruction incidents came from.

**Better still: put it in the fork brief.** Tell forks to write forward references as prose
from the start and only link backwards, so a fork that is stopped at any moment leaves a
link-clean tree. The coordinator topics did this and needed zero repair.

## Two hard-won operational notes

- 🔴 **`index.lock` races are constant with 3+ sessions on this checkout.** Every commit
  goes through a retry loop (40 attempts, 2s apart). Without it roughly one commit in five
  fails outright. `dbcommit.sh`.
- ⚠️ **A naive MDX hazard grep produces false positives on inline code.** `` `{baseUrl}` ``
  trips `grep -E '[{}]'` even though inline code is safe in MDX. Strip fenced blocks **and**
  inline spans (`sed 's/`[^`]*`//g'`) before grepping, or the check cries wolf and gets
  ignored.

## Where to resume

[[java-board]]'s phase 13 section, which names the next file and the next
`sidebar_position` for all five part-written topics. **Cheapest win: four `README.md`
indexes closes three topics** — 03, 05, 06 and 08 already hold 61 chunks and 15,150 lines
between them and are only missing an index. Copy `01-why-oauth2-exists/README.md`.

Related: [[java-playbook]] · [[java-board]] · [[devbible-locks]]
