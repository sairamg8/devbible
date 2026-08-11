---
title: "Streaming and downloads"
sidebar_label: "08 · Streams · downloads"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

**`res.sendFile` and `res.download` stream files with safer path options.
For big dynamic bodies, pipe a stream and handle errors mid-flight.**

```js
import path from 'node:path';

app.get('/report', (req, res) => {
  const file = path.join(reportsDir, 'latest.pdf');
  res.download(file, 'report.pdf', (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
});
```

Always set `root` / resolve paths carefully — path traversal is a Node Phase 4/8
concern. Prefer object storage signed URLs when files are large or private.

## Compression

`compression` middleware can help JSON APIs; many production stacks terminate
gzip at Nginx instead. Do not double-compress.

## Interview questions

**★ sendFile vs download?**  
`download` suggests a filename for the Save dialog; both stream from disk.

---

← Prev: [Cookies out](07-cookies-out.md) · Index: [Phase 4](README.md)
