type Status = 'pending' | 'shipped' | 'cancelled';
declare const s: Status;

// all three handled: the else branch holds `never`, which assigns to anything
function complete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {} else if (x === 'cancelled') {}
  else { const impossible: 1 = x; }
}

// one branch missing: the leftover type is named in the error
function incomplete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {}
  else { const impossible: 1 = x; }
}
