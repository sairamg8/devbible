---
name: gap-stale-not-written-yet-markers
description: 🔴 A `*(not written yet)*` forward reference goes STALE the moment its target lands, and NO gate catches it — it is bold text, not a link, so linkcheck, mdxcheck and the cap check all pass it forever. Carries the one-line close step that catches it.
metadata:
  type: feedback
---

# 🔴 `*(not written yet)*` is a defect with no gate behind it

**The rule that creates it is correct.** A link to a chunk that does not exist yet fails
`onBrokenLinks: 'throw'`, which fails the build, which **skips** the deploy for every other
session in the shared checkout. So the authoring contract says: anything not yet written is
**bold text plus `*(not written yet)*`**, never a link. Every agent obeys it.

**The gap is what happens next.** The moment the target file lands, that marker is a lie — and
**nothing detects it**:

| Gate | Why it passes a stale marker |
|---|---|
| `yarn linkcheck` | there is no link. It is bold text. |
| `yarn mdxcheck` | valid markdown, valid MDX, no expression node |
| the 300-line cap | unaffected |
| `grep '{/\* FOOTER \*/}'` | different marker, different defect |

So the page ships telling the reader a chunk does not exist, while it sits three files away in
the same directory.

## Measured — devbible vite topic 18, 2026-09-08, session `6d8f8a23`

**Ten stale markers across three files** at topic close. Eight of them were in one file:
`01-what-microservices-mean-to-a-vite-build.md`.

🔴 **That concentration is not an accident, and it is the part worth remembering.** The chunk
written *first* in a topic is usually the topic's **map page** — it names every chunk the topic
will have, and at the moment it is written **none of them exist**. A map page therefore
accumulates one stale marker per chunk in the topic, by construction. The bigger the topic, the
worse it gets: 24 chunks, so the map page was wrong 8 times over.

## ✅ The close step — one line, run it beside the footer grep

```bash
grep -rn 'not written yet' <topic dir>      # must be EMPTY at topic close
```

Both greps exist for the same reason and belong in the same block: `{/* FOOTER */}` and
`*(not written yet)*` are the two **invisible** defects — correct while a topic is being written,
wrong the moment it closes, and passed by every automated gate in the repo.

**The fix is never to delete the sentence.** Re-link it to the file that now exists. On a map
page, that means the whole list becomes a real index — which is what the page was always for.

## ⚠️ The related trap: a split sibling can steal a planned filename

Same topic: `05b` was reserved in the plan for the version-skew chunk, and a wave-1 split
sibling took `05b-worked-example-and-the-version-spine.md` first. The planned chunk became
`05c`. ➜ **Plan letters with gaps, or repoint the plan the moment a split lands** — and if any
page already wrote a `*(not written yet)*` naming the old letter, it is now stale *and* wrong.

Related: [[dispatch-anti-stall]] · [[gap-mdxcheck-compiles-but-does-not-render]] ·
[[gap-gates-do-not-validate-frontmatter]] · [[cursor-vite]]
