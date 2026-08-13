console.log('default Error.stackTraceLimit:', Error.stackTraceLimit);

// Deep recursion vs an iterative loop over the same work
function sumRecursive(n) { return n === 0 ? 0 : n + sumRecursive(n - 1); }
function sumIterative(n) { let t = 0; for (let i = n; i > 0; i--) t += i; return t; }
try { console.log('recursive 100000:', sumRecursive(100000)); }
catch (e) { console.log('recursive 100000:', e.constructor.name + ':', e.message); }
console.log('iterative 100000:', sumIterative(100000));

// Stack depth is not a fixed number of calls — frame size matters
function small(){ small(); }
function big(a,b,c,d,e,f,g,h){ const x=[a,b,c,d,e,f,g,h]; big(x[0],1,2,3,4,5,6,7); }
const depthOf = (fn) => { let d=0; const probe = () => { d++; try { probe(); } catch { throw new Error(String(d)); } }; return d; };
let dSmall=0; function s(){ dSmall++; s(); }
try { s(); } catch {}
let dBig=0; function b(p1,p2,p3,p4,p5,p6){ const local=[p1,p2,p3,p4,p5,p6]; dBig++; b(local[0],1,2,3,4,5); }
try { b(0,1,2,3,4,5); } catch {}
console.log('frames, no locals:', dSmall, '| frames, 6 args + array local:', dBig);

// async does not consume stack
async function tick(n) { if (n === 0) return 0; await null; return tick(n - 1); }
tick(200000).then(v => console.log('async recursion 200000 frames deep: ok, returned', v));
