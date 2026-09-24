---
name: devbible-palette
description: The exact colors and type roles the user approved for the Dev Bible UI
metadata:
  type: project
---

Palette the user explicitly approved for [[devbible-brief]], taken from the reader
prototype at `https://claude.ai/code/artifact/d57aa9d8-94cc-40a4-b7c4-2427196d80a5`.
Implemented in `src/css/custom.css`, bound to Infima variables.

**Light**
```
--ground #F2F5F7   --surface #FFFFFF   --surface-2 #E9EEF2   --surface-3 #DFE7ED
--ink    #14202A   --ink-2   #4A5B66   --ink-3    #77878F
--rule   #D8E0E6   --rule-strong #BFCCD5
--accent #0B6E5B   --accent-soft rgba(11,110,91,.10)
--amber  #8A5A11   --amber-soft  rgba(138,90,17,.12)
```

**Dark**
```
--ground #0F161C   --surface #161F27   --surface-2 #1D2831   --surface-3 #243039
--ink    #E6EDF2   --ink-2   #A3B1BC   --ink-3    #74838F
--rule   #27343E   --rule-strong #36454F
--accent #55C3A3   --accent-ink #7BD6BB  --accent-soft rgba(85,195,163,.14)
--amber  #D3A051
```

**Type roles:** serif display (`ui-serif, "Iowan Old Style", Georgia`) for headings ·
system sans for body · mono (`ui-monospace, "SF Mono", "JetBrains Mono", Menlo`) for
eyebrows, labels, file paths and phase numbers, uppercase at `.13em` letter-spacing.

**Why:** Neutrals are cool / blue-biased on purpose rather than pure grey, and the
accent is deep pine specifically to avoid the acid-green-on-black Node cliché. The user
said they loved these colors — don't substitute them.

**How to apply:** Tier badges are authored in markdown as
`<span className="db-tier t-master">Master</span>` — classes `t-master`,
`t-understand`, `t-know`, `t-when`. Use `className`, not `class`: Docusaurus parses
`.md` as MDX.
