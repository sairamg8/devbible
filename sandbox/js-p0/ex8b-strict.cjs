'use strict';
try { eval('function dupes(a, a) { return a; }'); } catch (e) { console.log('1 duplicate params:', e.constructor.name + ':', e.message); }
function argsLink(x) { x = 99; return arguments[0]; }
console.log('2 arguments decoupled from params:', argsLink(1));
try { eval('0755'); } catch (e) { console.log('3 legacy octal:', e.constructor.name + ':', e.message); }
console.log('4 this in plain fn:', (function(){ return this; })());
try { eval('var o={a:1}; with(o){}'); } catch (e) { console.log('5 `with`:', e.constructor.name + ':', e.message); }
try { eval('var q = 1; delete q'); } catch (e) { console.log('6 delete a var:', e.constructor.name + ':', e.message); }
