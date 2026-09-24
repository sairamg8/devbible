---
name: gap-gates-do-not-validate-frontmatter
description: 🔴 devbible's two gates — `yarn mdxcheck` and `yarn linkcheck` — do NOT validate YAML frontmatter or house-style marks. A file whose frontmatter is destroyed passes both with 0 problems. Found 2026-09-07. Carries the drop-in checker.
metadata:
  type: project
---

# 🔴 `mdxcheck` and `linkcheck` both pass a file whose frontmatter is destroyed

**Found 2026-09-07, session `84f95c0c`, by a `devbible-topic` agent working on
`docs/vite/pages/08-plugin-system/`.** It ran a line-reflow pass to reclaim lines against the
300-line cap. The reflow **merged the YAML frontmatter of two files into a single wrapped `title:`
blob**, destroying `sidebar_label` and `sidebar_position`.

🔴 **`yarn mdxcheck` returned 0 problems. `yarn linkcheck` returned 0 problems.** Both files were
structurally broken and both gates were green. It was caught only by an explicit
`grep '^sidebar_position:'` returning nothing.

## Why this is worse than it looks

- `sidebar_position` is what orders a topic. A file that loses it sorts unpredictably, and
  [[devbible-house-style]] records that 135 of 608 topic READMEs had already drifted this way.
- The corpus is 7,000+ pages. Nothing else in the pipeline reads frontmatter, so this class of
  damage is **silent and permanent** until a human notices a sidebar looks wrong.
- 🔴 **Any tool that reflows markdown must exclude everything between the opening and closing
  `---`.** That is the standing rule this incident bought.

## The check that was missing — drop it into any topic gate

```python
import pathlib, re
D = pathlib.Path('docs/<track>/pages/<topic>')
bad = []
for p in sorted(D.glob('*.md')):
    t = p.read_text()
    if not t.startswith('---\n'):           bad.append((p.name,'no opening ---')); continue
    end = t.find('\n---\n', 4)
    if end < 0:                             bad.append((p.name,'no closing ---')); continue
    fm, body = t[4:end], t[end+5:]
    for key in ('title:','sidebar_label:','sidebar_position:'):
        if not re.search(rf'^{key}', fm, re.M): bad.append((p.name,f'missing {key}'))
    if len(fm.splitlines()) > 6:            bad.append((p.name,'frontmatter too long — reflow damage?'))
    for key,pat in (('tier badge',r'^<span className="db-tier'),('Verified',r'^> Verified:'),
                    ('Validated',r'^> Validated:'),('Gotchas',r'^## Gotchas'),
                    ('Interview',r'^## Interview questions'),('footer',r'^← \[')):
        if not re.search(pat, body, re.M):  bad.append((p.name,f'missing {key}'))
print('✅ clean' if not bad else '\n'.join(f'⛔ {n}: {w}' for n,w in bad))
```

It also catches the **`{/* FOOTER */}` marker** problem from the other direction: a page with no
footer at all passes the cap check, the MDX check and the link check, because a missing link is not
a broken link. 1,241 pages across 48 topics shipped that way — see
`project_footer_cleanup_scope.md`.

## The general lesson

**The three existing gates check three things and are silent about everything else.** `mdxcheck`
validates MDX parseability; `linkcheck` validates that links resolve; the cap hook validates file
size. None of them validates that a page is a *devbible page*. Adding a check is cheaper than the
next silent regression, and this one is ~20 lines.

⚠️ **Not yet wired into `package.json`.** It has been run by hand on
`docs/vite/pages/08-plugin-system/` (30 files, all clean). Wiring it as `yarn housecheck` is an
obvious follow-up nobody has been asked for yet.

Related: [[devbible-locks]] · [[cursor-vite]] · [[feedback-verify-in-ci-not-locally]]
