const t = setTimeout(() => {}, 1000);
console.log(process.getActiveResourcesInfo());
t.unref();
console.log('after unref:', process.getActiveResourcesInfo());
