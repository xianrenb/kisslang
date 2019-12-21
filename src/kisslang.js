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
  visitFunctionImport: function(fnImport, module, binaryen){
      if (fnImport.type !== "FunctionImport") throw "Not function import";
      const intName = fnImport.id.name;
      const extModuleName = fnImport.extModule.name;
      const extName = fnImport.extId.name;
      const returnType = binaryen[fnImport.returnType];
      const paramTypes = [];

      fnImport.params.forEach(function(param){
        if (param.type === "Void"){
          // do nothing
        } else if (param.type === "Param"){
          paramTypes.push(binaryen[param.paramType]);
        }
      });

      module.addFunctionImport(intName, extModuleName, extName,
        binaryen.createType(paramTypes), returnType);
  },
  visitFunction: function(fn, module, binaryen){
      if (fn.type !== "FunctionDeclaration") throw "Not function";
      const returnType = binaryen[fn.returnType];
      const paramsInfo = new Map();
      const paramTypes = [];

      fn.params.forEach(function(param){
        if (param.type !== "Param") throw "Not param";

        paramsInfo.set(param.id.name, {index: paramTypes.length,
                                       paramType: param.paramType
                                      });

        paramTypes.push(binaryen[param.paramType]);
      });

      this.visitFunctionBody(
        fn.body, module, binaryen, fn.id.name, paramTypes, returnType,
        paramsInfo
      );
  },
  visitFunctionExport: function(fnExport, module, binaryen){
      if (fnExport.type !== "FunctionExport") throw "Not function export";
      const intName = fnExport.id.name;
      const extName = fnExport.extName.name;

      module.addFunctionExport(intName, extName);
  },
  visitFunctionBody: function(
                       fnBody, module, binaryen, fnName, paramTypes,
                       returnType, paramsInfo
                     ){
      if (fnBody.type !== "FunctionBody") throw "Not function body";
      const nParam = paramTypes.length;
      const variablesInfo = new Map();
      const localTypes = [];
      const varIniExpressions = [];

      fnBody.variables.forEach(function(variable){
        if (variable.type !== "VariableDeclaration") throw "Not variable";
        const index = nParam + localTypes.length;
        const variableType = variable.variableType;
        const iniValue = variable.iniValue.value;

        variablesInfo.set(variable.id.name,
                          {index: index,
                           variableType: variableType,
                           iniValue: iniValue
                          });

        localTypes.push(binaryen[variableType]);

        varIniExpressions.push(
          module.local.set(index, module[variableType].const(iniValue))
        );
      });

      const callExpressions = [];
      let outputVarName = "";

      fnBody.calls.forEach(function(call){
        if (call.type !== "CallStatement") throw "Not call";
        const params = [];

        call.params.forEach(function(param){
          if (param.type === "Void"){
            // do nothing
          } else if (param.type === "Identifier"){
            if (paramsInfo.has(param.name)){
              const index = paramsInfo.get(param.name).index;
              const localType = paramsInfo.get(param.name).paramType;
              params.push(module.local.get(index, binaryen[localType]));
            } else if (variablesInfo.has(param.name)){
              const index = variablesInfo.get(param.name).index;
              const localType = variablesInfo.get(param.name).variableType;
              params.push(module.local.get(index, binaryen[localType]));
            } else throw "Param not found";
          } else if (param.type === "f64"){
            params.push(module.f64.const(param.value));
          } else if (param.type === "i32"){
            params.push(module.i32.const(param.value));
          }
        });

        outputVarName = call.variable.name;
        const variable = variablesInfo.get(call.variable.name)
        const resultType = variable.variableType;
        const index = variable.index;

        callExpressions.push(
          module.local.set(
            index,
            module.call(
              call.fn.name, params, binaryen[resultType]
            )
          )
        );
      });

      const outputExpressions = [];

      if (outputVarName === ""){
        throw "No output variable";
      } else {
        const index = variablesInfo.get(outputVarName).index;
        const localType = variablesInfo.get(outputVarName).variableType;

        outputExpressions.push(
          module.return(
            module.local.get(index, binaryen[localType])
          )
        );
      }

      const expressions = varIniExpressions.concat(callExpressions)
                                           .concat(outputExpressions);

      module.addFunction(fnName, binaryen.createType(paramTypes), returnType,
        localTypes, module.block(null, expressions)
      );
  },
  beforeEmit: function(){
    const module = new binaryen.Module();
    const root = this.ast;
    if (root.type !== "Root") throw 'Not root';
    const that = this;

    this.ast.fnImports.forEach(function(fnImport){
      that.visitFunctionImport(fnImport, module, that.binaryen);
    });

    this.ast.functions.forEach(function(fn){
      that.visitFunction(fn, module, that.binaryen);
    });

    this.ast.fnExports.forEach(function(fnExport){
      that.visitFunctionExport(fnExport, module, that.binaryen);
    });

    this.module = module;
  },
  emitWasmText: function(optimized){
    this.beforeEmit();
    const module = this.module;

    if (optimized){
      module.optimize();
    }

    if (!module.validate()){
      throw "Validation error";
    }

    return module.emitText();
  },
  emitWasmBinary: function(){
    this.beforeEmit();
    const module = this.module;
    module.optimize();

    if (!module.validate()){
      throw "Validation error";
    }

    return module.emitBinary();
  }
};

// main
if (require.main === module){
  // called directly
  const myArgs = process.argv.slice(2);
  const kisslang = new Kisslang();
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  let lines = '';

  process.stdin.on('data', (chunk) => {
    lines += chunk;
  });

  process.stdin.on('end', function(){
    kisslang.parse(lines);

    if ((myArgs.length === 0) || (myArgs[0] === "-b")){
      const wasmBinary = kisslang.emitWasmBinary();
      process.stdout.write(wasmBinary);
    } else if (myArgs[0] === "-ot"){
      const wasmText = kisslang.emitWasmText(true);
      process.stdout.write(wasmText);
    } else if (myArgs[0] === "-t"){
      const wasmText = kisslang.emitWasmText(false);
      process.stdout.write(wasmText);
    }
  });
} else {
  // required as a module
  module.exports = {
    Kisslang: Kisslang
  };
}
