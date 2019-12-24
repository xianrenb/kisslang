#!/usr/bin/env node

"use strict";

const fs = require('fs');
const bytes = fs.readFileSync('./test.wasm');
const imports = {
  js: {
    nop: () => {return;},
    myfn: (a, b, c) => (a + Math.floor(b) + c),
    add: (a, b) => (a + b),
    sub: (a, b) => (a - b)
  }
};

(async () => {
  const module = await WebAssembly.compile(bytes);
  const instance = await WebAssembly.instantiate(module, imports);
  const wasmExports = instance.exports;
  const view1 = new DataView(wasmExports._mem.buffer);
  view1.setInt32(12, 42, true);
  view1.setFloat64(20, 3.14, true);
  process.stdout.write('f1(0): ' + wasmExports.f1(2) + '\n');
  process.stdout.write('f2(2, 3.14): ' + wasmExports.f2(2, 3.14) + '\n');
  wasmExports.f3(0);
  process.stdout.write('view1.getInt32(16, true): ' +
    view1.getInt32(16, true) + '\n');
  process.stdout.write('view1.getFloat64(28, true): ' +
    view1.getFloat64(28, true) + '\n');
  process.stdout.write('f4(1): ' + wasmExports.f4(1) + '\n');
  process.stdout.write('f4(2): ' + wasmExports.f4(2) + '\n');
  process.stdout.write('f4(3): ' + wasmExports.f4(3) + '\n');
  process.stdout.write('f4(4): ' + wasmExports.f4(4) + '\n');
})();
