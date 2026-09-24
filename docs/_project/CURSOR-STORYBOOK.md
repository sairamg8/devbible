---
name: cursor-storybook
description: START HERE for devbible Storybook. The track is UNCLAIMED. Carries the surveyed debt — 7 cap breaches, 32 missing tier badges, 26 missing Verified lines — the version spine, the model page, and the split mechanics, all measured 2026-09-04 so nothing needs re-deriving.
metadata:
  type: project
---

# 🔴 START HERE — devbible Storybook

**Surveyed 2026-09-04, work NOT started.** The user asked for the cap breaches and
badges, then deferred it (*"wait will pick it up later"*). **Nothing is half-done** —
`git status docs/storybook/` was clean at hand-off. Everything below is measured off
disk, so **do not re-derive it**.

## Lane

⚠️ **Storybook has NO row in `LOCKS.md` and no session has ever claimed it.** It is free.
Claim it before writing. The only Storybook commit since the import is the one MDX fix
below.

## What is already done

✅ **The build-breaking MDX hazard is fixed** — devbible `a9f112e0`, pushed.
`pages/phase-3-decorators/03-providers-in-decorators.md:15` had an inline code span
opened at end of line and closed on the next line starting `{`, which MDX parses as a JSX
expression. It had been on `origin` since the import (**2026-08-14, `c6db2852`**) and was
found only by a manual `mdxcheck` run. Track is now **0 MDX hazards, 184/184 links**.

## 🔴 The structural insight — there are TWO generations here

| Generation | Dirs | State |
|---|---|---|
| `pages/phase-N-*/` (4 dirs) | authored in this project | **have** badges and `> Verified:` lines — these are the model |
| `pages/NN-*/` (17 dirs) | the **as-is bucket import**, `c6db2852` | missing badges, missing provenance, all 7 cap breaches |

**Every single item of debt is in the imported half.** The import was moved in verbatim
and never brought to house style. That is the whole job.

⚠️ The two naming schemes (`phase-N-*` vs `NN-*`) also sit side by side in `pages/`.
Reconciling them is a **separate** decision — it renames directories and breaks inbound
links, so do not fold it into this pass without asking.

## The debt — 54 md files total

| Item | Count |
|---|---:|
| Over the 300-line cap | **7** |
| Missing tier badge | **32** |
| Missing `> Verified:` | **26** |

**22 files miss BOTH** a badge and provenance. The badge list adds 6 index/README files
and 4 `syllabus/` files that the Verified list does not.

### The 7 cap breaches — none has a badge or a Verified line

```
596  pages/13-build-and-configuration/02-advanced-main-and-preview-customization.md
575  pages/13-build-and-configuration/03-manager-ui-builder-hooks-and-env.md
554  pages/17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md
529  pages/17-theming-colors-and-fonts/02-custom-fonts-and-typography.md
350  pages/07-accessibility-testing/01-a11y-addon.md
333  pages/04-controls-and-args/01-dynamic-prop-editing.md
316  pages/05-interaction-testing/01-play-functions.md
```

### Missing tier badge (32)

```
pages/01-core-concepts/01-component-driven-development.md
pages/02-story-anatomy/01-file-structure.md
pages/03-addons-ecosystem/01-essential-addons.md
pages/03-addons-ecosystem/02-actions-panel-in-depth.md
pages/04-controls-and-args/01-dynamic-prop-editing.md
pages/05-interaction-testing/01-play-functions.md
pages/06-visual-testing/01-chromatic-integration.md
pages/07-accessibility-testing/01-a11y-addon.md
pages/08-documentation/01-docs-generation.md
pages/09-decorators/01-wrapping-stories.md
pages/10-composition-and-design-systems/01-storybook-as-a-design-system-hub.md
pages/11-testing-integration/01-test-runner.md
pages/12-multi-framework-support/01-renderer-architecture.md
pages/13-build-and-configuration/01-storybook-main.md
pages/13-build-and-configuration/02-advanced-main-and-preview-customization.md
pages/13-build-and-configuration/03-manager-ui-builder-hooks-and-env.md
pages/14-publishing-and-deployment/01-shipping-a-static-storybook.md
pages/15-advanced-patterns/01-component-driven-workflow.md
pages/16-real-world-workflows-and-recipes/01-bootstrapping-into-an-existing-app.md
pages/16-real-world-workflows-and-recipes/02-wiring-colors-and-custom-fonts.md
pages/17-theming-colors-and-fonts/01-global-colors-themes-and-tokens.md
pages/17-theming-colors-and-fonts/02-custom-fonts-and-typography.md
pages/phase-0-how-storybook-runs/README.md
pages/phase-1-story-format/README.md
pages/phase-2-args-and-controls/README.md
pages/phase-3-decorators/README.md
pages/README.md
README.md
syllabus/01-how-storybook-runs.md
syllabus/02-composing-stories.md
syllabus/03-testing-with-storybook.md
syllabus/04-configuration-and-shipping.md
```

Missing `> Verified:` is the same list **minus** the 6 README/index files and **minus**
`syllabus/02`, plus nothing new — regenerate with
`grep -rL '^> Verified:' docs/storybook --include=*.md`.

## What you need before writing

- **Pin: `storybook` 10.5.8**, `src/data/pins.js:245` (`source: npm:storybook`, policy
  `latest`, checked 2026-08-31). Bold this on `> Verified:` lines that pin it.
- **Model page — copy its shape exactly:**
  `pages/phase-1-story-format/05-naming-and-the-sidebar.md` (frontmatter → badge →
  two-line `> Verified:` with real doc links → `**No sandbox run** — this page carries no
  console output.`).
- **Tier calibration, already in this track:** Understand 55 · Master 36 · Know 17 ·
  When Needed 1. House style wants `t-master` at roughly 25–30% of a track, and Storybook
  is already at ~33% — so **lean Understand/Know** on the backfill rather than adding
  Master.
- **Sources seen on existing Verified lines:** the decorators docs (×4),
  `registry.npmjs.org/storybook/latest` (×2), the configuration docs (×2), the portable
  stories reference, the parameters reference.

## 🔴 The traps in this specific job

1. **A split is not a trim.** Record `wc -l` and `grep -c '^\*\*★'` **before**; after,
   a new file must exist and **both totals must have gone UP**. A 596-line file becoming
   two 290-line files is a **trim** and destroys content.
2. **These 7 are single files, not chunked topics** — so each becomes a directory:
   `NN-slug.md` → `NN-slug/` with `_category_.json`, `README.md` (index) and the chunks,
   keeping the same slug and numeric prefix so inbound links still resolve. The lettered-
   sibling form (`04-x.md` + `04b-y.md`) is for a file **already inside** a chunked topic
   and does not apply here.
3. **Each new chunk needs its OWN `> Verified:` line** — so the splits force provenance
   work whether or not you meant to do it. That means real verification against the
   Storybook docs (T2 fetch), **not** copying a neighbour's line.
4. **Never add a ` ```console ` block.** No sandbox. Existing pages have none and a new
   one must not gain one.
5. **Update the phase `README.md` and the neighbours' footers** when a file becomes a
   directory — the contract requires it and it is the step most often skipped.

## Suggested order

1. **The 4 big splits first** (596, 575, 554, 529) — they are the hard-rule breaches and
   each forces its own badge + provenance anyway, so they retire three debts at once.
2. **The 3 smaller splits** (350, 333, 316).
3. **The remaining badge-only backfill** — the 6 README/index files and 4 syllabus files
   need a badge but no provenance.
4. **The residual `> Verified:` backfill** on imported pages not touched by a split.
   🔴 This one needs source fetches; it is an authoring job, not a stamping job. Bank the
   research once per topic per the skill, not per chunk.

Related: [[progress-frontmatter-and-hooks-20260904]] (where this debt was found),
[[devbible-locks]], [[hooks-make-the-rules-mechanical]].
