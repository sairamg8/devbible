// sloppy mode (CJS with no directive)
function dupes(a, a) { return a; }
console.log('1 duplicate params allowed:', dupes(1, 2));
function argsLink(x) { x = 99; return arguments[0]; }
console.log('2 arguments stays linked to params:', argsLink(1));
console.log('3 legacy octal literal 0755 ->', eval('0755'));
console.log('4 this in plain fn === globalThis:', (function(){ return this === globalThis; })());
var o = {a:1}; with (o) { console.log('5 `with` works:', a); }
console.log('6 delete a var returns:', eval('var q = 1; delete q'));
