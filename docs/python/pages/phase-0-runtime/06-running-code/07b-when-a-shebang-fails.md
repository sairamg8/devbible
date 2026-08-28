---
title: "Four mechanical ways a shebang line fails — a second argument, a missing execute bit, a carriage return or a BOM, and a path past the kernel's 255-character buffer — each of which reports a path that looks correct"
sidebar_label: "7b · When a shebang fails"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Linux
> [`execve(2)` manual page](https://man7.org/linux/man-pages/man2/execve.2.html)
> (the single-argument rule and the length limit), the GNU coreutils `env(1)`
> manual page (`-S`, quoted from the installed page), the Python 3.14
> [tutorial appendix](https://docs.python.org/3.14/tutorial/appendix.html)
> (executable scripts and line endings) and the Python 3.14
> [lexical analysis reference](https://docs.python.org/3.14/reference/lexical_analysis.html)
> (the UTF-8 byte order mark).
> Version spine: **Python 3.14.7**.

**[Chunk 7](07-shebangs-and-launchers.md) established that the kernel reads the
shebang. This chunk is the consequence: because the kernel's handling is a fixed,
narrow piece of C, there are exactly four ways to write a line that *looks*
correct and does not work, and all four report a failure naming a path you can see
on screen and would swear exists. Recognising which of the four you are in takes
seconds once you know they are the whole list.**

## 1 · The single-argument rule, and `env -S`

This is the trap that produces the least helpful message in the area.

> *"On Linux, the entire string following the interpreter name is passed as a
> single argument to the interpreter, and this string can include white space."*
>
> *"behavior differs on some other systems. Some systems use the first white space
> to terminate optional-arg."*
>
> *"For portable use, optional-arg should either be absent, or be specified as a
> single word (i.e., it should not contain white space)"*

So this line does not do what it appears to:

```python
#!/usr/bin/env python3 -u        # ❌ Linux: env is asked to run a program
                                 #    literally named "python3 -u"
```

The kernel passes `python3 -u` to `/usr/bin/env` as **one** argument, and `env`
searches `PATH` for a file with that exact name, space included. There is no such
file, so execution fails before Python is involved — and the message names the
whole string, which reads like a typo rather than a structural rule.

GNU coreutils added the fix. From `env(1)`:

> *"`-S`, `--split-string=S`   process and split S into separate arguments; used
> to pass multiple arguments on shebang lines"*

```python
#!/usr/bin/env -S python3 -u        # ✅ env splits the string itself
```

```python
#!/usr/bin/env -S uv run --script   # ✅ same mechanism, three arguments
```

`-S` is a GNU/BSD extension, not POSIX. It is present in GNU coreutils and in
current macOS and the BSDs; it is **not** guaranteed on busybox or on very old
systems. Where the target host is unknown, the portable alternatives are to put
the setting in the program, in the environment, or in a console script:

```python
# instead of -u in the shebang
import sys
sys.stdout.reconfigure(line_buffering=True)
```

```bash
# or, from outside
PYTHONUNBUFFERED=1 ./report
```

Note also the middle quote above: some non-Linux kernels split at the *first*
whitespace, so `#!/usr/bin/env python3 -u` is not merely broken — it is broken
*differently* on different systems, which is why the manual page's advice is that
the argument *"should not contain white space"* at all.

## 2 · The execute bit, and the leading `./`

```bash
chmod +x report            # without this, the kernel never looks at line 1
./report                   # not `report` — the current directory is not on PATH
```

Without the execute bit the kernel refuses before parsing anything, so the shebang
is irrelevant; the error is about permission, not about Python. Without the `./`
the shell searches `PATH`, which on any sane system does not include `.`, so the
error is about the command not existing.

The mode bit is tracked by git, which means it can be lost in a way that is
invisible in a diff:

```bash
git update-index --chmod=+x bin/report     # fix it in the index, not just on disk
git ls-files -s bin/report                 # 100755 = executable, 100644 = not
```

A file committed without the bit arrives without it on every clone, on every CI
runner, and in every Docker build — and `chmod +x` in your working copy alone does
not fix any of those.

## 3 · Carriage returns and byte order marks

The tutorial states the formatting requirement:

> *"The `#!` must be the first two characters of the file. On some platforms, this
> first line must end with a Unix-style line ending (`'\n'`), not a Windows
> (`'\r\n'`) line ending."*

A file edited on Windows, or checked out with a `.gitattributes` that forces CRLF,
carries a trailing `\r` on the shebang line. The kernel then looks for an
interpreter whose name ends in a carriage return, does not find it, and reports
that the interpreter does not exist — naming a path that is visibly correct on
screen, because `\r` is invisible.

```bash
file report                      # names CRLF line terminators explicitly
cat -A report | head -1          # shows the ^M
sed -i 's/\r$//' report          # strip CRLF from the file
```

```
# .gitattributes — stop it recurring
*.py       text eol=lf
bin/*      text eol=lf
```

**"The `#!` must be the first two characters"** is the other half. A UTF-8 byte
order mark puts three bytes ahead of the `#!`, and the kernel stops treating the
file as an interpreter script at all. What makes this one confusing is that
Python itself is perfectly happy with it — the lexical analysis reference says
that *"if the implicit or explicit encoding of a file is UTF-8, an initial UTF-8
byte-order mark (`b'\xef\xbb\xbf'`) is ignored rather than being a syntax error"*.
So the file imports fine, runs fine under `python script.py`, and fails only when
executed directly.

```bash
head -c 3 report | xxd           # efbbbf means there is a BOM
sed -i '1s/^\xEF\xBB\xBF//' report
```

## 4 · The length limit

The kernel copies the shebang line into a fixed buffer:

> *"Before Linux 5.1, the limit is 127 characters. Since Linux 5.1, the limit is
> 255 characters."*

Past that, the line is truncated, the truncated path does not exist, and the shell
reports that the interpreter cannot be found. Nothing in the message mentions
length. This is a real problem for CI runners and Jenkins workspaces, where a
project path can be six directories deep before the `.venv/bin/python` part even
begins; the venv-specific version is worked through in
[`../05-virtual-environments/05-not-relocatable.md`](../05-virtual-environments/05-not-relocatable.md).

```bash
head -1 .venv/bin/pytest | wc -c     # how close are you to the limit
```

The reliable escape hatch is to stop using a shebang for that invocation
altogether:

```bash
.venv/bin/python -m pytest      # the interpreter is an argument, not an exec header
```

`python -m` never involves the kernel's script handling, which is one more reason
[chunk 3](03-m-packages-and-main-py.md) argues for `python -m pip` over `pip`.

## The four, as a checklist

```bash
head -1 report | cat -A          # 1 & 3: extra argument? trailing ^M?
head -c 3 report | xxd           # 3: BOM?
ls -l report                     # 2: is the x bit set?
head -1 report | wc -c           # 4: near 127/255?
```

## Gotchas

**★ `./script.py` reports that the interpreter does not exist, but the path is
visibly correct.**
Three candidates, in order of likelihood: CRLF line endings, so the interpreter
name has an invisible `\r` appended; the line exceeded the kernel's 127/255
character limit and was truncated; or a byte order mark ahead of the `#!`. All
three produce a path that looks right and is not.

**★ `#!/usr/bin/env python3 -u` fails and the message names `python3 -u`.**
On Linux the entire string after the interpreter is *one* argument, so `env` is
looking for a program with a space in its name. Use `#!/usr/bin/env -S python3 -u`,
or set `PYTHONUNBUFFERED=1`, or call `sys.stdout.reconfigure(line_buffering=True)`
in the program.

**★ `env -S` works on your machine and not in an Alpine container.**
`-S` is a GNU/BSD extension. busybox's `env` — which is what a minimal Alpine
image provides unless coreutils is installed — does not implement it. Install
coreutils, or move the option out of the shebang.

**★ `Permission denied` on a script that is obviously there.**
The execute bit is not set. `chmod +x script.py`, and record it in git with
`git update-index --chmod=+x script.py`, or every clone will have the same
problem.

**★ `command not found` for a script in the directory you are standing in.**
The current directory is not on `PATH` on any sane system. Type `./script.py`.

**★ A BOM before the `#!` disables the shebang while leaving the file importable.**
The kernel needs `#!` as the first two bytes; Python's lexer explicitly ignores an
initial UTF-8 BOM. So `python script.py` works, `import` works, and only `./script`
fails — which is exactly the wrong signal for finding the cause.

**★ A `.gitattributes` change fixed the file for you and not for anyone else.**
Line-ending normalisation applies at checkout. Colleagues with an existing working
copy keep their CRLF files until they re-checkout: `git add --renormalize .` and a
fresh checkout, or `git rm --cached -r . && git reset --hard`.

**★ The shebang was under the limit until the project moved into a deeper
directory.**
Nothing about the file changed; the absolute path in an installer-generated
console script did. Keep environments shallow (`~/.venvs/<project>` rather than six
levels inside a workspace), or invoke through `python -m`.

**★ Someone "fixed" a truncation by shortening the interpreter path with a
symlink.**
That works, and it is fine as a stopgap, but the console scripts still contain the
long path until they are regenerated. Reinstall the package (or the environment)
so the installer writes the new shebang.

**★ A shebang with a quoted path.**
`#!"/opt/my python/bin/python3"` does not work: the kernel does no quote
processing at all, and treats the quotes as part of the interpreter name. There is
no way to put a space in the interpreter path portably. Move the interpreter, or
use `#!/usr/bin/env -S ...` and let `env` do the lookup.

## Interview questions

**★ Why does `#!/usr/bin/env python3 -u` not work on Linux, and what does?**
Because the kernel passes *"the entire string following the interpreter name […]
as a single argument"*, so `env` searches for a program literally named
`python3 -u`. `#!/usr/bin/env -S python3 -u` works: GNU/BSD `env`'s `-S` is
documented as splitting the string into separate arguments, *"used to pass
multiple arguments on shebang lines"*. `-S` is not POSIX, so where portability
matters, set `PYTHONUNBUFFERED=1` or configure buffering inside the program
instead.

**★ A script fails to execute with a message naming an interpreter path that is
obviously correct. What are your hypotheses, and how do you test each?**
A carriage return at the end of the shebang line — check with `cat -A` or `file`.
A line past the kernel's shebang length limit (127 characters before Linux 5.1,
255 after) — check with `head -1 file | wc -c`. A byte order mark ahead of the
`#!` — check with `head -c 3 file | xxd`. All three yield a path that renders
correctly and does not exist.

**★ What is the shebang length limit, and how do you design around it?**
127 characters before Linux 5.1 and 255 since, applied to the text after `#!`, and
the line is silently truncated rather than rejected. You design around it by
keeping virtual environments shallow, and by preferring `python -m tool` to
`tool`, because `-m` never goes through the kernel's interpreter-script path at
all. Installer-generated console scripts are where this bites, since their shebang
is an absolute path into the environment.

**★ Why does a file run fine with `python script.py` but not as `./script.py`?**
Because only the second form involves the kernel's shebang handling. The candidate
causes are all things the kernel cares about and Python does not: the execute bit,
a BOM before `#!`, a `\r` at the end of the line, a truncated line, an extra
argument that `env` cannot resolve, or an interpreter path that does not exist on
that machine.

**★ Why is the execute bit a source of CI-only failures?**
Because git tracks the mode, so a file committed as `100644` arrives
non-executable on every clone, container build and CI runner, regardless of what
`chmod +x` you ran locally. `git ls-files -s` shows the recorded mode and
`git update-index --chmod=+x` fixes it in the index.

**★ Can an interpreter path contain a space?**
Not portably, and not with quoting — the kernel does no quote or escape
processing on the shebang line, so quotes become part of the name it looks for.
The workaround is to let `env` resolve the name from `PATH` (`#!/usr/bin/env
python3`), or to place the interpreter somewhere without spaces.

---

← Prev: [Shebangs](07-shebangs-and-launchers.md) · Index: [Running code](README.md) · Next → [Generated shebangs](07c-console-scripts-and-launchers.md)

{/* FOOTER */}
