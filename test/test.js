#!/usr/bin/env node

"use strict";

const fs = require('fs');
const bytes = fs.readFileSync('./test.wasm');
const imports = {
  js: {
    nop: () => {return;},
    myfn: (a, b, c) => (a + Math.floor(b) + c)
  }
};

(async () => {
  const module = await WebAssembly.compile(bytes);
  const instance = await WebAssembly.instantiate(module, imports);
  const wasmExports = instance.exports;
  process.stdout.write('f1(0): ' + wasmExports.f1(2) + '\n');
  process.stdout.write('f2(2, 3.14): ' + wasmExports.f2(2, 3.14) + '\n');
})();
