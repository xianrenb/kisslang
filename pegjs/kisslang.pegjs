/*
 * kisslang Grammar
 * =================
 *
 * Accepts kisslang source code and output kisslang AST.
 */

Root
  = fnImports:FunctionImports ws
    functions:FunctionDeclarations ws
    fnExports:FunctionExports
    {
      return {
        type: "Root",
        fnImports: fnImports,
        functions: functions,
        fnExports: fnExports
      };
    }

FunctionImports
  = head:FunctionImport tail:(ws v:FunctionImport { return v; })* ws
    {
      return [head].concat(tail);
    }

FunctionDeclarations
  = head:FunctionDeclaration tail:(ws v:FunctionDeclaration { return v; })* ws
    {
      return [head].concat(tail);
    }

FunctionExports
  = head:FunctionExport tail:(ws v:FunctionExport { return v; })* ws
    {
      return [head].concat(tail);
    }

FunctionImport
  = "$fnImport" _ ws
    id:Identifier ":" returnType:DataType ws
    "(" params:(NoParam / ParamList) ")" ws
    "<-" ws
    extModule:Identifier "."
    extId:Identifier ";"
    {
      return {
        type: "FunctionImport",
        id: id,
        returnType: returnType,
        params: params,
        extModule: extModule,
        extId: extId
      };
    }

FunctionDeclaration
  = "$fn" _ ws
    id:Identifier ":" returnType:DataType ws
    "(" params:ParamList ")" ws
    "{" ws
    body:FunctionBody ws
    "}" ";"
    {
      return {
        type: "FunctionDeclaration",
        id: id,
        returnType: returnType,
        params: params,
        body: body
      };
    }

FunctionExport
  = "$fnExport" _ ws
    extName:Identifier ws
    "<-" ws
    id:Identifier ";"
    {
      return {
        type: "FunctionExport",
        extName: extName,
        id: id
      };
    }

_ "_" = [ \t\n\r]

Identifier
  = !ReservedWord head:IdentifierStart tail:IdentifierPart*
    {
      return {
        type: "Identifier",
        name: head + tail.join("")
      };
    }

ReservedWord
  = "$fn"
  / "$var"
  / "$fnImport"
  / "$fnExport"

IdentifierStart
  = [a-z]i
  / "_"
  / "$"

IdentifierPart
  = [a-z]i
  / [0-9]
  / "_"
  / "$"

DataType
  = "i" { return "i32"; }
  / "f" { return "f64"; }

ParamList
  = head:Param tail:(_ ws v:Param { return v; })*
    { return [head].concat(tail); }

Param
  = id:Identifier ":" paramType:DataType
    {
      return {
        type: "Param",
        id: id,
        paramType: paramType
      }
    }

FunctionBody
  = variables:VariableDeclarations ws calls:CallStatements
    {
      return {
        type: "FunctionBody",
        variables: variables,
        calls: calls
      };
    }

VariableDeclarations
  = head:VariableDeclaration tail:(ws v:VariableDeclaration { return v; })*
    {
      return [head].concat(tail);
    }

VariableDeclaration
  = "$var" _ ws
    id:Identifier ":" variableType:DataType ws
    "<-" ws
    iniValue:(Identifier / f64number / i32number) ";"
    {
      return {
        type: "VariableDeclaration",
        id: id,
        variableType: variableType,
        iniValue: iniValue
      };
    }

CallStatements
  = head:CallStatement tail:(ws v:CallStatement { return v; })*
    {
      return [head].concat(tail);
    }

CallStatement
  = variable:Identifier ws
    "<-" ws
    fn:Identifier _ ws
    params:(NoParam / ParamListWithoutType) ";"
    {
      return {
        type: "CallStatement",
        variable: variable,
        fn: fn,
        params: params
      };
    }

NoParam
  = "void"
    {
      return [{
        type: "Void"
      }];
    }

ParamListWithoutType
  = head:ParamWithoutType tail:(_ ws v:ParamWithoutType { return v; })*
    {
      return [head].concat(tail);
    }

ParamWithoutType
  = variable:Identifier { return variable; }
  / f64number
  / i32number

ws "whitespace" = [ \t\n\r]*

i32number "i32number"
  = minus? int exp?
    {
      return {
        type: "i32",
        value: parseInt(text())
      };
    }

f64number "f64number"
  = minus? int frac exp?
    {
      return {
        type: "f64",
        value: parseFloat(text())
      };
    }

decimal_point = "."
digit1_9      = [1-9]
e             = [eE]
exp           = e (minus / plus)? DIGIT+
frac          = decimal_point DIGIT+
int           = zero / (digit1_9 DIGIT*)
minus         = "-"
plus          = "+"
zero          = "0"
DIGIT         = [0-9]
