#!/usr/bin/env python3
"""Repoint the store after one page. usage: store.py LABEL TOTAL N LINES STARS NEXTN NEXTFILE NEXTPOS NEXTDIR BANK"""
import sys,re
label,total,n,lines,stars,nextn,nextfile,nextpos,nextdir,bank=sys.argv[1:11]
R='/mnt/Storage/my-learning/claude/'
p=R+'devbible/CURSOR-DSA-SYSTEM-DESIGN.md'; s=open(p).read()
i=s.index(label+' — `')  # this label's table heading, e.g. '🚧 DSA phase 0 — `docs/...'
head,tail=s[:i],s[i:]
tail,c=re.subn(r'^(\| '+re.escape(n)+r' \| `[^`]+` \| \d+ \| )⬜ \*\*NEXT\*\* \|$',lambda m:m.group(1)+f'✅ {lines} lines, {stars} ★ |',tail,count=1,flags=re.M)
if c==0:  # already marked (re-run) — accept if the row is ✅
    assert re.search(r'^\| '+re.escape(n)+r' \| `[^`]+` \| \d+ \| ✅',tail,flags=re.M), 'cursor row '+n
if nextfile!='-':
    tail,c=re.subn(r'^(\| '+re.escape(nextn)+r' \| `'+re.escape(nextfile)+r'` \| \d+ \| )⬜(?: \*\*NEXT\*\*)? \|$',lambda m:m.group(1)+'⬜ **NEXT** |',tail,count=1,flags=re.M); assert c==1,'next row'
s=head+tail
if nextfile!='-':
    s,c=re.subn(r'\| 🔴 \*\*NEXT FILE\*\* \| \*\*`[^`]+`\*\* \(`sidebar_position: \d+`[^|]*\|',lambda m:f'| 🔴 **NEXT FILE** | **`{nextdir}/{nextfile}`** (`sidebar_position: {nextpos}`, written from `{bank}`). |',s,count=1); assert c==1,'next file'
open(p,'w').write(s)
j=s.index(label+' — `'); block=s[j:j+5000]
written=len(re.findall(r'^\| \d+ \| `[^`]+` \| \d+ \| ✅',block,flags=re.M))  # topics, not files: b-rows excluded
p=R+'devbible/LOCKS.md'; s=open(p).read()
ph=re.search(r'phase (\d+)',label).group(1); short='SD' if 'System' in label else 'DSA'
s,c=re.subn(r'\*\*'+short+r' phase '+ph+r': \d+ of \d+\*\*[^`\n]*next `[^`]+`(?: \(`sidebar_position: \d+`\))?',f'**{short} phase {ph}: {written} of {total}**, next `{nextdir}/{nextfile}` (`sidebar_position: {nextpos}`)',s,count=1); assert c==1,'locks'
open(p,'w').write(s); print('store repointed',written)
