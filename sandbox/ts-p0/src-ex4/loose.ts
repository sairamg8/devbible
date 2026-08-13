function findUser(id) {
  return id === 1 ? { name: 'Asha' } : null;
}

const user = findUser(1);
console.log(user.name.toUpperCase());

class Session {
  token: string;
  start() { this.token = 'abc'; }
}

try { start(); } catch (err) { console.log(err.message); }
function start() { throw new Error('nope'); }
