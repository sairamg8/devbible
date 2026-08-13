declare const s: string | undefined;
declare const n: number | undefined;
function f(x: string | undefined) { return x; }
if (s) { f(s); }
if (n !== undefined) { const r: 1 = n; }
if (n) { const r: 1 = n; }
