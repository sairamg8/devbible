const { EventEmitter } = require('node:events');
class Loader extends EventEmitter {
  load() {
    process.nextTick(() => this.emit('done', 'payload'));
    return this;
  }
}
new Loader().load().on('done', (v) => console.log('received:', v));
