---
title: "trust proxy"
sidebar_label: "01 · trust proxy"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Without `trust proxy`, `req.ip` is the load balancer. Rate limits and secure cookies misbehave.**

```js
// one hop of reverse proxy you control
app.set('trust proxy', 1);
```

Never set `true` on an open internet edge without understanding spoofed
`X-Forwarded-For`. Nginx syllabus covers termination in depth.

## Interview questions

**★ Why does rate limiting ban everyone as one IP?**  
All traffic appears as the proxy when trust is off.


---

← Index: [Phase 9](README.md) · Next → [CORS](02-cors.md)
