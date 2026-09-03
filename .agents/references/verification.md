# Verification — how to be accurate without a sandbox

**The problem this solves.** The corpus was written under three regimes in
succession — sandbox-proven, doc-validated, then no-sandbox. The sandbox was
abandoned for a measured reason: a page needing a new script took **60–90 minutes
against 20–35** for one written from existing evidence, and a new container 90–150.
A new script roughly **triples** the cost of a page.

But dropping it left a hole. **636 pages carry an output-style block with no
provenance** — a console block, a timing, an error string, and nothing saying where
it came from. Some are quoted from docs, some illustrative, and some were
reconstructed from memory and shipped to a reader as fact.

🔴 **"Stop measuring" was never "make it up."** This file is the middle path: match
each claim to the **cheapest evidence that actually settles it**, and when nothing
available settles it, *say so on the page* instead of inventing.

---

## Efficiency rule 1 — research once per topic, not once per page

This is the single biggest saving available, and it is already proven here: the Java
Phase 11 JaCoCo topic was written from `research_java_p11_t09_jacoco.md` in the
memory store, banked and source-verified in one pass, marked *"do not re-derive"*.

**The pattern:**

1. **One research pass per topic** — fetch the primary sources once, for the whole
   topic, before writing any chunk.
2. **Bank it** in the memory store as `research_<track>_<topic>.md`: every
   load-bearing sentence quoted **verbatim** with its URL, plus the version spine.
3. **Write every chunk from the bank.** A 20-chunk topic then costs one research
   pass, not twenty.
4. Later sessions reuse the bank rather than re-fetching. Mark it `do not re-derive`.

A topic that fetches per chunk pays the research cost 20 times for the same
document. That, not the writing, is where usage goes.

---

## The evidence ladder — use the lowest tier that settles the claim

| Tier | Cost | What it is | Use it for |
|---|---|---|---|
| **T0** | free | A verbatim quote from the primary source | Any rule, guarantee, default, or "the spec says" |
| **T1** | ~1 s | An inline probe of an **already-installed** package | Export lists, signatures, real version numbers, whether an API exists |
| **T2** | one fetch | Reading the primary doc / release notes / spec | Behaviour, rationale, deprecations, migration paths |
| **T3** | 🔴 banned | Running code, containers, timings, benchmarks | Nothing. Requires an explicit user instruction |

**Default to T0 + T2.** Reach for T1 when a claim is about *what exists* rather than
*what happens*.

---

## T1 — the cheap probes that are not a sandbox

These run in about a second against packages **already in `node_modules`**. They are
inline one-liners: **never a new file, never an install, never a container.**

```bash
# Does this export exist? What is the real surface?
node -p "Object.keys(require('react')).join(', ')"

# The exact installed version — always print it beside any probe result
node -p "require('./node_modules/react/package.json').version"

# What the package declares: entry points, exports map, engines
node -p "JSON.stringify(require('./node_modules/zod/package.json').exports, null, 2)"

# Is a built-in present on this runtime, and what shape is it?
node -p "typeof structuredClone"
node -p "Object.keys(require('node:fs/promises')).length"

# The runtime actually in use
node -v
```

This is exactly how the React syllabus was built — its export lists are
`Object.keys()` on the installed package, not recalled from documentation. That is a
real, citable check that costs nothing.

### 🔴 The installed-version trap — measured in this repo on 2026-09-03

**A T1 probe is only evidence if the installed version matches what the page
teaches.** Right now, in this checkout:

| Package | Installed | Corpus pins | Safe to probe? |
|---|---|---|---|
| `react` | **19.2.8** | 19.2.8 | ✅ matches |
| `zod` | **4.4.3** | 4.4.3 | ✅ matches |
| `express` | **4.22.2** | **5.2.1** | 🔴 **NO — probing it evidences Express 4 for a page teaching Express 5** |
| `typescript` | *not installed* | 7.0.2 | ❌ unavailable — use T0/T2 |
| Node runtime | **24.20.0** | 24.19.0 | ⚠️ close, but print the real number |

**Before any T1 probe, print the version and compare it to the pin.** A probe against
the wrong major is worse than no probe: it produces a confident, specific, wrong
fact — and it will read as verified.

If the installed version does not match, **drop to T2.** Never install a package to
make a probe possible; that is T3 by another name.

---

## What to do when nothing settles the claim

This is the rule that would have prevented the 636.

1. **Try one source.** One fetch of the primary doc. Not three.
2. Still unsettled → **write the sentence as explicitly uncertain**, or leave the
   claim out. *"The documentation does not state whether X; treat it as unspecified"*
   is a legitimate, useful sentence.
3. 🔴 **Never fabricate.** No console output, timings, byte counts, error strings or
   stack traces reconstructed from memory.

**A confident invention is the only unacceptable outcome.** "I could not confirm
this" is fine. Silence is fine. Making it up is not.

### Output blocks specifically

**Do not add a ` ```console ` block to any page.** It is program output, and there is
no sandbox to produce it. If output genuinely matters:

- Quote it from the docs as a **backticked inline phrase**, and say it is quoted.
- Or relabel the fence `text` and make the prose say it is **illustrative**.
- Or explain the mechanism in prose and drop the block. Usually the best option — the
  mechanism is what the reader needed anyway.

---

## Supporting files the user provides

When the user supplies a document, PDF, spec extract or screenshot to verify against,
it is **T0/T2 evidence at zero fetch cost** — the cheapest verification available.

- **Validate against it, do not skim it.** Check every load-bearing claim in the topic
  against what it actually says.
- **Cite it on the `> Verified:` line by its real name**, exactly as a URL would be
  cited: `> Verified: 2026-09 against *<file name>* supplied by the user, §4.2`.
- **Where it contradicts the page, the supplied source wins** — say so explicitly in
  the report, naming both claims. Do not quietly reconcile them.
- **Where it is silent, it is not evidence.** Fall back to T2; do not stretch it to
  cover a claim it does not make.

---

## Record the tier — it is what makes a later pass cheap

The `> Verified:` line already names the source. Make it name **how** the claim was
checked, so a validation pass can tell a quoted rule from a probed surface without
re-deriving either:

```markdown
> Verified: 2026-09-03 against the React reference — [`useEffect`](https://react.dev/reference/react/useEffect).
> Export list probed on the installed package (`react` **19.2.8**, `Object.keys`).
> Target: **React 19.2.8 · Node 24.20.0**.
```

The distinction that matters to a reader, and to the next session:

- **quoted** — the docs say it (T0/T2)
- **probed** — checked against the installed package, version named (T1)
- **stated as uncertain** — the source would not settle it
- ⚠️ **never** — "verified" with nothing behind it

🔴 **Bold the version being pinned.** The currency scanner reads bold as the page's
own pin and plain text as a historical citation, so bolding the wrong number changes
what the tooling believes the page claims. See [`house-style.md`](house-style.md).

---

## The severity ladder, when re-validating an existing page

Reused verbatim from the validation plan so two passes cannot disagree:

| | Defect | Action |
|---|---|---|
| **S1** | Claim contradicted by the primary source · output block with no provenance · code that cannot work | **Fix now.** One file, one commit |
| **S2** | True once, wrong for the version the track pins | **Fix**, naming the new source and the version boundary |
| **S3** | Load-bearing, plausible, **no source found** | One fetch attempt, then **rewrite as explicitly uncertain**. Never delete, never assert |
| **S4** | Structural — cap, link, badge, missing section | **Fix in place**, batched with the S1/S2 work |
| **S5** | Cosmetic — wording, ordering, heading style | 🔴 **Ledger only. Do not touch.** A validation pass that rewrites prose stops being a validation pass |

A page that has been checked carries a stamp directly under its `> Verified:` line:

```markdown
> Validated: 2026-09-03 · claims + output provenance · session <id>
```

`grep -c '^> Validated:'` per track **is** the progress bar — no board to keep in
sync. **Never edit or delete the original `> Verified:` line**; it records how the
page was written, the stamp records that it was checked. Two different facts. Every
chunk of a chunked topic gets its own stamp, the topic `README.md` included.
