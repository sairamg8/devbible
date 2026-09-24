#!/usr/bin/env python3
"""Wire one finished page into the four boards. Run from the devbible root.
usage: wire.py TRACK PHASEDIR PHASEN TOTAL N FILE LABEL PREVFILE PREVNEXTTITLE"""
import sys,re,subprocess,datetime,glob,os
track,phasedir,phasen,total,n,fname,label,prev,prevtitle=sys.argv[1:10]
total=int(total); phasen=int(phasen)
now=datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
D=f'docs/{track}/pages/{phasedir}'
# 1. phase README row
p=f'{D}/README.md'; s=open(p).read()
pat=re.compile(r'^\| '+re.escape(n)+r' \| (.+?) \| (<span[^|]*?) \| ⬜ not written yet \|$',re.M)
if pat.search(s):
    s=pat.sub(lambda m:f'| {n} | **[{m.group(1)}](./{fname})** | {m.group(2)} | ✅ written |',s,count=1)
else:
    assert f'](./{fname})' in s, 'row not found: '+n
written=len([l for l in s.splitlines() if re.match(r'^\| \d+ \| .*✅ written',l)])
files=len([f for f in glob.glob(f'{D}/*.md') if not f.endswith('README.md')])
s=re.sub(r'^🚧 \*\*\d+ of \d+ topics written\.\*\*$',f'🚧 **{written} of {total} topics written.**',s,count=1,flags=re.M)
open(p,'w').write(s)
# 2. prev footer
if prev!='-':
    p=f'{D}/{prev}'; s=open(p).read()
    old=f'Next → **{prevtitle}** *(not written yet)*'
    assert old in s, 'prev footer text not found'
    s=s.replace(old,f'Next → [{label}]({fname})'); open(p,'w').write(s)
# 3. pages board
p=f'docs/{track}/pages/README.md'; s=open(p).read()
pat=re.compile(r'^(\| '+str(phasen)+r' · \[[^\]]+\]\([^)]+\) \| \d+ \| )🚧 \*\*\d+ of \d+\*\*[^|]*\|$',re.M)
assert pat.search(s), 'board row not found'
s=pat.sub(lambda m:m.group(1)+f'🚧 **{written} of {total}** — {files} files on disk |',s,count=1); open(p,'w').write(s)
# 4. progress.js
p='src/data/progress.js'; s=open(p).read()
key="'system-design': {" if track=='system-design' else 'dsa: {'
i=s.index(key); j=s.index('\n  },',i)
seg=s[i:j]
seg=re.sub(r"updated: '[^']*'",f"updated: '{now}'",seg,count=1)
seg,c=re.subn(r"(\{n: "+str(phasen)+r", slug: '"+re.escape(phasedir)+r"'.*?pages: )\d+",lambda m:m.group(1)+str(written),seg,count=1)
assert c==1, 'progress phase row not found'
s=s[:i]+seg+s[j:]; open(p,'w').write(s)
# 5. docs/README active-work row
p='docs/README.md'; s=open(p).read()
name='System Design' if track=='system-design' else 'DSA'
s,c=re.subn(name+r' phase '+str(phasen)+r', topics? [^;.]*(?: \(\d+ files\))?',f'{name} phase {phasen}, topics 01–{n} written ({files} files)',s,count=1)
assert c==1, 'docs/README row not found'
open(p,'w').write(s)
print(f'wired: {written}/{total} topics, {files} files, updated {now}')
