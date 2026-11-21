import { DiagnosticItem } from '../../types/studio';
import { Expr, ParsedProgram, ParseError, parseLuau, Stmt, TypeExpr } from './parser';

type InferredType =
  | { kind: 'any' }
  | { kind: 'nil' }
  | { kind: 'boolean' }
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'table'; fields: Record<string, InferredType> }
  | { kind: 'function'; params: InferredType[]; returnType: InferredType }
  | { kind: 'named'; name: string }
  | { kind: 'union'; types: InferredType[] };

const ANY_TYPE: InferredType = { kind: 'any' };

function formatType(t: InferredType): string {
  switch (t.kind) {
    case 'any':
      return 'any';
    case 'nil':
      return 'nil';
    case 'boolean':
      return 'boolean';
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'named':
      return t.name;
    case 'table':
      return 'table';
    case 'function':
      return 'function';
    case 'union':
      return t.types.map(formatType).join(' | ');
  }
}

function isAssignable(expected: InferredType, actual: InferredType): boolean {
  if (expected.kind === 'any' || actual.kind === 'any') return true;
  if (expected.kind === 'union') {
    return expected.types.some((opt) => isAssignable(opt, actual));
  }
  if (actual.kind === 'union') {
    return actual.types.every((opt) => isAssignable(expected, opt));
  }
  if (expected.kind !== actual.kind) {
    if (expected.kind === 'named' && expected.name === 'Instance' && actual.kind === 'named') {
      return [
        'Part',
        'WedgePart',
        'Model',
        'Folder',
        'Script',
        'LocalScript',
        'ModuleScript',
        'RemoteEvent',
        'RemoteFunction',
        'ClickDetector',
        'ProximityPrompt',
        'WeldConstraint',
        'ScreenGui',
        'Frame',
        'TextLabel',
        'TextButton',
        'Player',
        'Humanoid',
        'PointLight',
        'Sound',
        'IntValue',
        'NumberValue',
        'StringValue',
        'BoolValue',
      ].includes(actual.name);
    }
    return false;
  }
  if (expected.kind === 'named' && actual.kind === 'named') {
    return expected.name === actual.name || expected.name === 'any' || actual.name === 'any';
  }
  if (expected.kind === 'table' && actual.kind === 'table') {
    for (const [key, expField] of Object.entries(expected.fields)) {
      const actField = actual.fields[key];
      if (!actField) {
        if (!isAssignable(expField, { kind: 'nil' })) return false;
      } else if (!isAssignable(expField, actField)) {
        return false;
      }
    }
    return true;
  }
  return true;
}

export function checkLuauDiagnostics(scriptPath: string, source: string): DiagnosticItem[] {
  const diagnostics: DiagnosticItem[] = [];
  let parsed: ParsedProgram;

  try {
    parsed = parseLuau(source);
  } catch (err) {
    if (err instanceof ParseError) {
      diagnostics.push({
        scriptPath,
        line: err.line,
        column: err.column,
        severity: 'error',
        message: err.message,
      });
    }
    return diagnostics;
  }

  if (!parsed.strictMode) {
    return diagnostics;
  }

  const typeAliases = new Map<string, InferredType>();

  const resolveTypeExpr = (te?: TypeExpr): InferredType => {
    if (!te) return ANY_TYPE;
    switch (te.kind) {
      case 'AnyType':
        return ANY_TYPE;
      case 'OptionalType':
        return { kind: 'union', types: [resolveTypeExpr(te.inner), { kind: 'nil' }] };
      case 'UnionType':
        return { kind: 'union', types: te.types.map(resolveTypeExpr) };
      case 'TableType': {
        const fields: Record<string, InferredType> = {};
        for (const f of te.fields) {
          fields[f.key] = resolveTypeExpr(f.type);
        }
        return { kind: 'table', fields };
      }
      case 'FunctionType':
        return {
          kind: 'function',
          params: te.params.map((p) => resolveTypeExpr(p.type)),
          returnType: resolveTypeExpr(te.returnType),
        };
      case 'NamedType': {
        if (te.name === 'number') return { kind: 'number' };
        if (te.name === 'string') return { kind: 'string' };
        if (te.name === 'boolean') return { kind: 'boolean' };
        if (te.name === 'nil') return { kind: 'nil' };
        if (te.name === 'any') return ANY_TYPE;
        const alias = typeAliases.get(te.name);
        if (alias) return alias;
        return { kind: 'named', name: te.name };
      }
    }
  };

  type Scope = Map<string, InferredType>;
  const scopes: Scope[] = [new Map()];

  // Seed common Roblox globals
  const rootScope = scopes[0];
  rootScope.set('game', { kind: 'named', name: 'DataModel' });
  rootScope.set('workspace', { kind: 'named', name: 'Workspace' });
  rootScope.set('script', { kind: 'named', name: 'Instance' });

  const lookupVar = (name: string): InferredType | undefined => {
    for (let i = scopes.length - 1; i >= 0; i--) {
      const found = scopes[i].get(name);
      if (found) return found;
    }
    return undefined;
  };

  const inferExpr = (expr: Expr): InferredType => {
    switch (expr.kind) {
      case 'Nil':
        return { kind: 'nil' };
      case 'Bool':
        return { kind: 'boolean' };
      case 'Number':
        return { kind: 'number' };
      case 'String':
      case 'InterpolatedString':
        return { kind: 'string' };
      case 'Var':
        return lookupVar(expr.name) ?? ANY_TYPE;
      case 'TypeCast':
        return resolveTypeExpr(expr.typeExpr);
      case 'FunctionExpr':
        return {
          kind: 'function',
          params: expr.params.map((p) => resolveTypeExpr(p.typeAnnotation)),
          returnType: resolveTypeExpr(expr.returnType),
        };
      case 'Table': {
        const fields: Record<string, InferredType> = {};
        for (const entry of expr.entries) {
          if (entry.key && entry.key.kind === 'String') {
            fields[entry.key.value] = inferExpr(entry.value);
          }
        }
        return { kind: 'table', fields };
      }
      case 'Unary':
        if (expr.op === 'not') return { kind: 'boolean' };
        if (expr.op === '-' || expr.op === '#') return { kind: 'number' };
        return ANY_TYPE;
      case 'Binary': {
        const lt = inferExpr(expr.left);
        const rt = inferExpr(expr.right);
        if (['+', '-', '*', '/', '//', '%', '^'].includes(expr.op)) {
          if (
            (lt.kind !== 'any' && lt.kind !== 'number' && lt.kind !== 'named') ||
            (rt.kind !== 'any' && rt.kind !== 'number' && rt.kind !== 'named')
          ) {
            diagnostics.push({
              scriptPath,
              line: expr.line,
              column: 1,
              severity: 'error',
              message: `Type Error (--!strict): Operator '${expr.op}' cannot be applied to '${formatType(lt)}' and '${formatType(rt)}'.`,
            });
          }
          if (lt.kind === 'named') return lt;
          return { kind: 'number' };
        }
        if (expr.op === '..') return { kind: 'string' };
        if (['==', '~=', '<', '>', '<=', '>='].includes(expr.op)) return { kind: 'boolean' };
        return ANY_TYPE;
      }
      case 'Member': {
        if (expr.object.kind === 'Var' && expr.object.name === 'Instance' && expr.property === 'new') {
          return ANY_TYPE;
        }
        const objType = inferExpr(expr.object);
        if (objType.kind === 'table' && objType.fields[expr.property]) {
          return objType.fields[expr.property];
        }
        return ANY_TYPE;
      }
      case 'Call': {
        if (
          expr.callee.kind === 'Member' &&
          expr.callee.object.kind === 'Var' &&
          expr.callee.object.name === 'Instance' &&
          expr.callee.property === 'new' &&
          expr.args[0]?.kind === 'String'
        ) {
          return { kind: 'named', name: expr.args[0].value };
        }
        if (expr.callee.kind === 'Member' && expr.callee.object.kind === 'Var') {
          const base = expr.callee.object.name;
          if (base === 'Vector3' && expr.callee.property === 'new') return { kind: 'named', name: 'Vector3' };
          if (base === 'CFrame' && ['new', 'Angles', 'lookAt'].includes(expr.callee.property)) {
            return { kind: 'named', name: 'CFrame' };
          }
          if (base === 'Color3' && ['new', 'fromRGB', 'fromHSV', 'fromHex'].includes(expr.callee.property)) {
            return { kind: 'named', name: 'Color3' };
          }
          if (base === 'UDim2') return { kind: 'named', name: 'UDim2' };
        }
        const calleeType = inferExpr(expr.callee);
        if (calleeType.kind === 'function') {
          const genericBindings = new Map<string, InferredType>();
          const substituteGenerics = (t: InferredType): InferredType => {
            if (t.kind === 'named' && genericBindings.has(t.name)) {
              return genericBindings.get(t.name)!;
            }
            if (t.kind === 'union') {
              return { kind: 'union', types: t.types.map(substituteGenerics) };
            }
            return t;
          };

          expr.args.forEach((arg, idx) => {
            const rawExpParam = calleeType.params[idx];
            if (rawExpParam) {
              const actArg = inferExpr(arg);
              if (
                rawExpParam.kind === 'named' &&
                /^[A-Z][A-Za-z0-9]*$/.test(rawExpParam.name) &&
                rawExpParam.name.length <= 2 &&
                !typeAliases.has(rawExpParam.name) &&
                !genericBindings.has(rawExpParam.name)
              ) {
                genericBindings.set(rawExpParam.name, actArg);
              }
              const expParam = substituteGenerics(rawExpParam);
              if (!isAssignable(expParam, actArg)) {
                diagnostics.push({
                  scriptPath,
                  line: arg.line,
                  column: 1,
                  severity: 'error',
                  message: `Type Error (--!strict): Argument #${idx + 1} expected '${formatType(expParam)}', got '${formatType(actArg)}'.`,
                });
              }
            }
          });
          return substituteGenerics(calleeType.returnType);
        }
        return ANY_TYPE;
      }
      case 'IfExpr':
        return inferExpr(expr.thenExpr);
      default:
        return ANY_TYPE;
    }
  };

  const checkStmts = (stmts: Stmt[], expectedReturn?: InferredType) => {
    for (const stmt of stmts) {
      switch (stmt.kind) {
        case 'TypeDecl': {
          typeAliases.set(stmt.name, resolveTypeExpr(stmt.typeExpr));
          break;
        }
        case 'LocalDecl': {
          stmt.names.forEach((decl, idx) => {
            const valExpr = stmt.values[idx];
            const inferred = valExpr ? inferExpr(valExpr) : ({ kind: 'nil' } as InferredType);
            if (decl.typeAnnotation) {
              const declared = resolveTypeExpr(decl.typeAnnotation);
              if (valExpr && !isAssignable(declared, inferred)) {
                diagnostics.push({
                  scriptPath,
                  line: decl.line,
                  column: 1,
                  severity: 'error',
                  message: `Type Error (--!strict): Cannot assign '${formatType(inferred)}' to '${decl.name}: ${formatType(declared)}'.`,
                });
              }
              scopes[scopes.length - 1].set(decl.name, declared);
            } else {
              scopes[scopes.length - 1].set(decl.name, inferred);
            }
          });
          break;
        }
        case 'Assign': {
          stmt.targets.forEach((target, idx) => {
            const valExpr = stmt.values[idx];
            if (!valExpr) return;
            const actual = inferExpr(valExpr);
            if (target.kind === 'Var') {
              const declared = lookupVar(target.name);
              if (declared && !isAssignable(declared, actual)) {
                diagnostics.push({
                  scriptPath,
                  line: stmt.line,
                  column: 1,
                  severity: 'error',
                  message: `Type Error (--!strict): Variable '${target.name}' expects '${formatType(declared)}', got '${formatType(actual)}'.`,
                });
              }
            }
          });
          break;
        }
        case 'FunctionDecl': {
          const fnType: InferredType = {
            kind: 'function',
            params: stmt.params.map((p) => resolveTypeExpr(p.typeAnnotation)),
            returnType: resolveTypeExpr(stmt.returnType),
          };
          if (stmt.nameParts.length === 1) {
            scopes[scopes.length - 1].set(stmt.nameParts[0], fnType);
          }
          const fnScope: Scope = new Map();
          stmt.params.forEach((p) => {
            fnScope.set(p.name, resolveTypeExpr(p.typeAnnotation));
          });
          scopes.push(fnScope);
          checkStmts(stmt.body, stmt.returnType ? resolveTypeExpr(stmt.returnType) : undefined);
          scopes.pop();
          break;
        }
        case 'ReturnStmt': {
          if (expectedReturn && expectedReturn.kind !== 'any') {
            const actual = stmt.values[0] ? inferExpr(stmt.values[0]) : ({ kind: 'nil' } as InferredType);
            if (!isAssignable(expectedReturn, actual)) {
              diagnostics.push({
                scriptPath,
                line: stmt.line,
                column: 1,
                severity: 'error',
                message: `Type Error (--!strict): Expected return type '${formatType(expectedReturn)}', got '${formatType(actual)}'.`,
              });
            }
          }
          break;
        }
        case 'IfStmt':
          for (const br of stmt.branches) {
            inferExpr(br.cond);
            scopes.push(new Map());
            checkStmts(br.body, expectedReturn);
            scopes.pop();
          }
          if (stmt.elseBody) {
            scopes.push(new Map());
            checkStmts(stmt.elseBody, expectedReturn);
            scopes.pop();
          }
          break;
        case 'WhileStmt':
        case 'RepeatStmt':
        case 'Block':
          scopes.push(new Map());
          checkStmts(stmt.body, expectedReturn);
          scopes.pop();
          break;
        case 'NumericFor':
        case 'GenericFor':
          scopes.push(new Map());
          if (stmt.kind === 'NumericFor') {
            scopes[scopes.length - 1].set(stmt.varName, { kind: 'number' });
          }
          checkStmts(stmt.body, expectedReturn);
          scopes.pop();
          break;
        case 'ExprStmt':
          inferExpr(stmt.expr);
          break;
      }
    }
  };

  checkStmts(parsed.body);
  return diagnostics;
}
