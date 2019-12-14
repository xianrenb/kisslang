#!/usr/bin/env node

"use strict";

const binaryen = require("binaryen");
const kisslangParser = require('../pegjs/kisslang.js');

function Kisslang(){
  this.ast = {};
  this.binaryen = binaryen;
  this.parser = kisslangParser;
}

Kisslang.prototype = {
  parse: function(lines){
    this.ast = this.parser.parse(lines);
  },
  visitFunction: function(fn, module, binaryen){
      if (fn.type !== "FunctionDeclaration") throw "Not function";
      const returnType = binaryen[fn.returnType];
      const paramsType = [];

      fn.params.forEach(function(param){
        paramsType.push(binaryen[param.dataType]);
      });

      const typeSignature = module.addFunctionType(
                              fn.id.name, returnType, paramsType
                            );

      const localTypes = [];

      module.addFunction(fn.id.name, typeSignature, localTypes,
        module.block(null, [])
      );
  },
  emitWasmText: function(){
    const module = new binaryen.Module();
    const root = this.ast;
    if (root.type !== "Root") throw 'Not root';
    const that = this;

    this.ast.functions.forEach(function(fn){
      that.visitFunction(fn, module, that.binaryen);
    });

    return module.emitText();
  }
};

// main
if (require.main === module){
  // called directly
  const kisslang = new Kisslang();
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  let lines = '';

  process.stdin.on('data', (chunk) => {
    lines += chunk;
  });

  process.stdin.on('end', function(){
    kisslang.parse(lines);
    const wasmText = kisslang.emitWasmText();
    process.stdout.write(wasmText);
  });
} else {
  // required as a module
  module.exports = {
    Kisslang: Kisslang
  };
}
