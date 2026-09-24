#!/usr/bin/env python3
"""De-link forward references: any [label](NN-file.md) whose target does not exist in the page's directory
becomes **label** followed by *(not written yet)* (a following '*(not written yet)*' is not duplicated)."""
import sys,re,os
for p in sys.argv[1:]:
    d=os.path.dirname(p); s=open(p).read(); n=0
    def rep(m):
        global n
        label,target=m.group(1),m.group(2)
        if os.path.exists(os.path.join(d,target)): return m.group(0)
        n+=1; return f'**{label}**'
    s2=re.sub(r'\[([^\]]+)\]\(([0-9][0-9a-z]*-[^)]+\.md)\)',rep,s)
    # ensure a '(not written yet)' marker follows each de-linked bold, without duplicating it
    s2=re.sub(r'(\*\*[^*]+\*\*)(\s*\*\(not\s+written\s+yet\)\*)',r'\1 *(not written yet)*',s2)
    open(p,'w').write(s2); print(f'{p}: {n} de-linked')
