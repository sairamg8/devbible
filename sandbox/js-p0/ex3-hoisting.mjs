// The creation phase, observed
console.log('1 fn decl before definition:', typeof hoistedFn, hoistedFn());
function hoistedFn() { return 'callable'; }

console.log('2 var before assignment:', typeof varX, varX);
var varX = 'assigned';

try { console.log(letY); } catch (e) { console.log('3 let before init:', e.constructor.name + ':', e.message); }
let letY = 'assigned';

try { console.log(typeof letZ); } catch (e) { console.log('4 typeof on TDZ binding:', e.constructor.name + ':', e.message); }
let letZ = 1;

console.log('5 typeof on never-declared:', typeof neverDeclared);

// var is function-scoped, let is block-scoped
function scopes() {
  if (true) { var v = 'var'; let l = 'let'; }
  console.log('6 var escapes the block:', v);
  try { console.log(l); } catch (e) { console.log('7 let does not:', e.constructor.name + ':', e.message); }
}
scopes();
