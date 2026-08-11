import { port } from '#config';
import { connect } from '#db/client';
console.log('no ../../ needed →', port, connect());
