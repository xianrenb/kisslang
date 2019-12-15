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
      const paramsInfo = {};
      const paramTypes = [];

      fn.params.forEach(function(param){
        if (param.type !== "Param") throw "Not param";

        paramsInfo[param.id.name] = {position: paramTypes.length,
                                     paramType: param.paramType
                                    };

        paramTypes.push(binaryen[param.paramType]);
      });

      const typeSignature = module.addFunctionType(
                              fn.id.name, returnType, paramTypes
                            );

      this.visitFunctionBody(
        fn.body, module, binaryen, fn.id.name, typeSignature, paramTypes.length,
        paramsInfo
      );
  },
  visitFunctionBody: function(
                       fnBody, module, binaryen, fnName, typeSignature,
                       nParam, paramsInfo
                     ){
      if (fnBody.type !== "FunctionBody") throw "Not function body";
      const variablesInfo = {};
      const localTypes = [];

      fnBody.variables.forEach(function(variable){
        if (variable.type !== "VariableDeclaration") throw "Not variable";

        variablesInfo[variable.id.name] = {position: nParam + localTypes.length,
                                           variableType: variable.variableType
                                          };

        localTypes.push(binaryen[variable.variableType]);
      });

      const callExpressions = [];

      fnBody.calls.forEach(function(call){
        if (call.type !== "CallStatement") throw "Not call";
        const params = [];

        call.params.forEach(function(param){
          if (param.type === "Identifier"){
            if (paramsInfo.hasOwnProperty(param.name)){
              const position = paramsInfo[param.name].position;
              const localType = paramsInfo[param.name].paramType;
              params.push(module.local.get(position, binaryen[localType]));
            } else if (variablesInfo.hasOwnProperty(param.name)){
              const position = variablesInfo[param.name].position;
              const localType = variablesInfo[param.name].variableType;
              params.push(module.local.get(position, binaryen[localType]));
            } else throw "Param not found";
          } else if (param.type === "f64"){
            params.push(module.f64.const(param.value));
          } else if (param.type === "i64"){
            params.push(module.i64.const(param.value));
          }
        });

        const resultType = variablesInfo[call.variable.name].variableType;

        callExpressions.push(module.call(
          call.fn.name, params, binaryen[resultType]
        ));
      });

      module.addFunction(fnName, typeSignature, localTypes,
        module.block(null, callExpressions)
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
