let calls = 0;
function log(msg) { calls += 1; console.log(`[${calls}] ${msg}`); }
module.exports = { log, get calls() { return calls; } };
