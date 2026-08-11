import { execSync } from 'node:child_process';
// demonstrate that quoted interpolation is still dangerous patterns
const user = 'report.txt"; echo INJECTED; echo "';
try {
  // use echo to show expansion without reading secrets
  const out = execSync(`echo "file=${user}"`, {encoding:'utf8'});
  console.log('quoted still expands shell metachar:', out.includes('INJECTED') || out.includes('file='));
  console.log(JSON.stringify(out.trim()));
} catch(e) { console.log('err', e.message); }
const user2 = '$(echo SUBST)';
const out2 = execSync(`echo "x=${user2}"`, {encoding:'utf8', shell:'/bin/bash'});
console.log('dollar-paren inside quotes:', out2.trim());
