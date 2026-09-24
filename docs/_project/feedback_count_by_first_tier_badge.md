---
name: devbible-feedback-count-by-first-tier-badge
description: Counting pages per tier with grep -rl over-counts, because phase index pages list every tier — count the first badge per file instead
metadata:
  type: feedback
---

# Count tiers by the FIRST badge per file, never with `grep -rl`

**What went wrong (2026-08-14, Express).** Asked how much of the corpus was still thin, I
ran the obvious thing:

```bash
grep -rl 't-master"' docs/expressjs/pages --include="*.md" | wc -l
```

and reported **76 non-Master pages, 62 under 200 lines**. Both numbers were wrong. The
totals across the four tiers came to 201 files in a corpus of 183 — which should have been
the tell, and I said the figure out loud before noticing it.

**Why:** every **phase index page** lists its topics in a table with a tier badge per row,
so a single `README.md` matches `t-master`, `t-understand`, `t-know` and `t-when` all at
once. `grep -rl` counts the file once per tier searched, and the same page lands in every
bucket.

**How to apply — the counting rule:**

- A page's tier is the **first** `db-tier t-…` occurrence in it, nothing later.
- **Exclude the corpus index and the phase indexes** (`README.md` at depth ≤ 1). Keep the
  **topic** indexes — a chunk directory's `README.md` carries its own topic's tier, once.
- Sanity check before publishing any tier figure: **the per-tier counts must sum to the
  number of badged files**, and that must be less than the total file count. If it sums
  higher, index pages are being double-counted.

```python
# the shape that gets it right
m = re.search(r'db-tier t-([a-z-]+)"', open(f).read())     # FIRST match only
```

Corrected Express figures from that method: Master 114 files / 21,407 lines · Understand
41 / 5,895 · Know 14 / 2,235 · When Needed 2 / 383 — and **57 non-Master content pages, 53
of them under 200 lines**.

**The wider point, and why this is filed as feedback rather than a note:** the number was
load-bearing — it sized the remaining work and went into a status artifact for the user.
[[devbible-feedback-verify-your-own-measurements]] says a real measurement can still be
the wrong measurement; this is that failure in its cheapest form, and the check that would
have caught it took one line of arithmetic. Applies to any corpus in this repo, not just
Express — every technology's phase READMEs have the same tier tables.

## The same failure in a second shape — syllabus part headers (2026-08-31, Angular)

Not a `grep -rl` problem this time, and worth recording because the sum check above is what
catches both.

Every syllabus part file opens with `> **Phases N–M · X topics · Y Master**`. Angular's six
parts were drafted with projected tier counts, then ten rows were demoted from Master to
Understand to bring the corpus inside the 25–30% band. **The headers were updated by
subtracting the demotions from the projections instead of by recounting the files.** Two
drafts had come out one row above their projection, so both headers landed one low — Part 4
said 11 and had 12, Part 5 said 7 and had 8.

The README was right (63 / 211 / 30%) because it *was* counted from the badges. So the tell
was there and free: **the six part headers summed to 61 against a README total of 63.**
The user caught it; I had not run the check.

**How to apply — extends the rule above:**

- After any tier edit, **recount. Never adjust a stated count by arithmetic on a previous
  stated count** — a projection that was never verified propagates silently.
- The per-part sum check is one line, and covers the topic counts too:

```bash
for f in docs/<lang>/syllabus/0*.md; do
  printf "%-46s header=%-3s actual=%s\n" "$(basename $f)" \
    "$(sed -n '7p' $f | grep -oE '[0-9]+ Master')" "$(grep -c 't-master' $f)"
done
grep -hc 't-master' docs/<lang>/syllabus/0*.md | paste -sd+ | bc   # must equal the README
```

- Check the per-phase `*N topics.*` lines the same way, against the rows under each
  `## Phase` heading. Angular's sixteen were all correct — but only because they were
  verified, not because they were trusted.

Live Express state and the corrected numbers: [[devbible-express-master-depth-pass]].
The Angular corpus this second case came from: [[cursor-angular]].
