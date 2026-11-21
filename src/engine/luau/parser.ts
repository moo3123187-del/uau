import { LexerError, Token, tokenizeLuau } from './lexer';

export type TypeExpr =
  | { kind: 'NamedType'; name: string; generics?: TypeExpr[] }
  | { kind: 'OptionalType'; inner: TypeExpr }
  | { kind: 'UnionType'; types: TypeExpr[] }
  | { kind: 'TableType'; fields: { key: string; optional: boolean; type: TypeExpr }[]; indexer?: { key: TypeExpr; value: TypeExpr } }
  | { kind: 'FunctionType'; params: { name?: string; type: TypeExpr }[]; returnType: TypeExpr }
  | { kind: 'AnyType' };

export type Stmt =
  | { kind: 'Block'; body: Stmt[]; line: number }
  | { kind: 'LocalDecl'; names: { name: string; typeAnnotation?: TypeExpr; line: number }[]; values: Expr[]; line: number }
  | { kind: 'Assign'; targets: LValue[]; values: Expr[]; line: number }
  | { kind: 'CompoundAssign'; target: LValue; op: string; value: Expr; line: number }
  | { kind: 'ExprStmt'; expr: Expr; line: number }
  | { kind: 'IfStmt'; branches: { cond: Expr; body: Stmt[] }[]; elseBody?: Stmt[]; line: number }
  | { kind: 'WhileStmt'; cond: Expr; body: Stmt[]; line: number }
  | { kind: 'RepeatStmt'; body: Stmt[]; cond: Expr; line: number }
  | { kind: 'NumericFor'; varName: string; start: Expr; end: Expr; step?: Expr; body: Stmt[]; line: number }
  | { kind: 'GenericFor'; vars: string[]; iterators: Expr[]; body: Stmt[]; line: number }
  | { kind: 'FunctionDecl'; isLocal: boolean; nameParts: string[]; isMethod: boolean; params: { name: string; typeAnnotation?: TypeExpr }[]; hasVarargs: boolean; returnType?: TypeExpr; body: Stmt[]; line: number }
  | { kind: 'ReturnStmt'; values: Expr[]; line: number }
  | { kind: 'BreakStmt'; line: number }
  | { kind: 'ContinueStmt'; line: number }
  | { kind: 'TypeDecl'; exported: boolean; name: string; generics: string[]; typeExpr: TypeExpr; line: number };

export type LValue =
  | { kind: 'Var'; name: string; line: number }
  | { kind: 'Member'; object: Expr; property: string; line: number }
  | { kind: 'Index'; object: Expr; index: Expr; line: number };

export type Expr =
  | { kind: 'Nil'; line: number }
  | { kind: 'Bool'; value: boolean; line: number }
  | { kind: 'Number'; value: number; line: number }
  | { kind: 'String'; value: string; line: number }
  | { kind: 'Varargs'; line: number }
  | { kind: 'Var'; name: string; line: number }
  | { kind: 'Table'; entries: { key?: Expr; value: Expr }[]; line: number }
  | { kind: 'FunctionExpr'; params: { name: string; typeAnnotation?: TypeExpr }[]; hasVarargs: boolean; returnType?: TypeExpr; body: Stmt[]; line: number }
  | { kind: 'Unary'; op: string; arg: Expr; line: number }
  | { kind: 'Binary'; op: string; left: Expr; right: Expr; line: number }
  | { kind: 'Member'; object: Expr; property: string; line: number }
  | { kind: 'Index'; object: Expr; index: Expr; line: number }
  | { kind: 'Call'; callee: Expr; args: Expr[]; line: number }
  | { kind: 'MethodCall'; object: Expr; method: string; args: Expr[]; line: number }
  | { kind: 'IfExpr'; cond: Expr; thenExpr: Expr; elseIfs: { cond: Expr; expr: Expr }[]; elseExpr: Expr; line: number }
  | { kind: 'TypeCast'; expr: Expr; typeExpr: TypeExpr; line: number }
  | { kind: 'InterpolatedString'; parts: string[]; exprs: Expr[]; line: number };

export class ParseError extends Error {
  line: number;
  column: number;
  constructor(message: string, line: number, column: number) {
    super(message);
    this.line = line;
    this.column = column;
  }
}

export interface ParsedProgram {
  body: Stmt[];
  strictMode: boolean;
}

const BLOCK_TERMINATORS = new Set(['end', 'else', 'elseif', 'until']);

const BINARY_PRECEDENCE: Record<string, { prec: number; rightAssoc?: boolean }> = {
  or: { prec: 1 },
  and: { prec: 2 },
  '<': { prec: 3 },
  '>': { prec: 3 },
  '<=': { prec: 3 },
  '>=': { prec: 3 },
  '~=': { prec: 3 },
  '==': { prec: 3 },
  '..': { prec: 4, rightAssoc: true },
  '+': { prec: 5 },
  '-': { prec: 5 },
  '*': { prec: 6 },
  '/': { prec: 6 },
  '//': { prec: 6 },
  '%': { prec: 6 },
  '^': { prec: 8, rightAssoc: true },
};

export function parseLuau(source: string): ParsedProgram {
  let tokens: Token[];
  let strictMode = false;
  try {
    const res = tokenizeLuau(source);
    tokens = res.tokens;
    strictMode = res.strictMode;
  } catch (err) {
    if (err instanceof LexerError) {
      throw new ParseError(err.message, err.line, err.column);
    }
    throw err;
  }

  let pos = 0;
  const peek = (offset = 0): Token => tokens[Math.min(pos + offset, tokens.length - 1)];
  const advance = (): Token => tokens[pos++];

  const check = (value: string, type?: Token['type']): boolean => {
    const t = peek();
    if (type && t.type !== type) return false;
    return t.value === value;
  };

  const match = (value: string, type?: Token['type']): boolean => {
    if (check(value, type)) {
      advance();
      return true;
    }
    return false;
  };

  const expect = (value: string, msg?: string): Token => {
    const t = peek();
    if (t.value !== value) {
      throw new ParseError(msg || `Expected '${value}', got '${t.value || 'EOF'}'`, t.line, t.column);
    }
    return advance();
  };

  const expectIdent = (msg?: string): Token => {
    const t = peek();
    if (t.type !== 'IDENT') {
      throw new ParseError(msg || `Expected identifier, got '${t.value || 'EOF'}'`, t.line, t.column);
    }
    return advance();
  };

  // Type expression parser (handles primitives, tables, generics, unions, optionals, function types)
  const parseTypeExpr = (): TypeExpr => {
    let left = parseSingleType();
    while (match('|')) {
      const right = parseSingleType();
      if (left.kind === 'UnionType') {
        left.types.push(right);
      } else {
        left = { kind: 'UnionType', types: [left, right] };
      }
    }
    return left;
  };

  const parseSingleType = (): TypeExpr => {
    let base: TypeExpr;
    if (match('(')) {
      // Function type or parenthesized type
      const params: { name?: string; type: TypeExpr }[] = [];
      if (!check(')')) {
        do {
          if (peek().type === 'IDENT' && peek(1).value === ':') {
            const pName = advance().value;
            advance(); // :
            params.push({ name: pName, type: parseTypeExpr() });
          } else {
            params.push({ type: parseTypeExpr() });
          }
        } while (match(','));
      }
      expect(')');
      if (match('->')) {
        const ret = parseTypeExpr();
        base = { kind: 'FunctionType', params, returnType: ret };
      } else if (params.length === 1) {
        base = params[0].type;
      } else {
        base = { kind: 'AnyType' };
      }
    } else if (match('{')) {
      const fields: { key: string; optional: boolean; type: TypeExpr }[] = [];
      let indexer: { key: TypeExpr; value: TypeExpr } | undefined;
      while (!check('}') && peek().type !== 'EOF') {
        if (match('[')) {
          const keyType = parseTypeExpr();
          expect(']');
          expect(':');
          const valType = parseTypeExpr();
          indexer = { key: keyType, value: valType };
        } else if (peek().type === 'IDENT' && peek(1).value === ':') {
          const key = advance().value;
          advance(); // :
          const valType = parseTypeExpr();
          fields.push({ key, optional: false, type: valType });
        } else {
          // Array shorthand { number }
          const valType = parseTypeExpr();
          indexer = { key: { kind: 'NamedType', name: 'number' }, value: valType };
        }
        if (!match(',') && !match(';')) break;
      }
      expect('}');
      base = { kind: 'TableType', fields, indexer };
    } else if (peek().type === 'IDENT' || peek().value === 'nil') {
      const name = advance().value;
      const generics: TypeExpr[] = [];
      if (match('<')) {
        do {
          generics.push(parseTypeExpr());
        } while (match(','));
        expect('>');
      }
      base = { kind: 'NamedType', name, generics: generics.length > 0 ? generics : undefined };
    } else if (peek().type === 'STRING' || peek().value === 'true' || peek().value === 'false') {
      advance();
      base = { kind: 'AnyType' };
    } else {
      const t = peek();
      throw new ParseError(`Expected type annotation, got '${t.value || 'EOF'}'`, t.line, t.column);
    }

    while (match('?')) {
      base = { kind: 'OptionalType', inner: base };
    }
    return base;
  };

  const skipGenericParams = () => {
    if (!match('<')) return [] as string[];
    const generics: string[] = [];
    if (!check('>')) {
      do {
        generics.push(expectIdent('Expected generic type parameter').value);
      } while (match(','));
    }
    expect('>');
    return generics;
  };

  const parseParamList = (): { params: { name: string; typeAnnotation?: TypeExpr }[]; hasVarargs: boolean; returnType?: TypeExpr } => {
    expect('(');
    const params: { name: string; typeAnnotation?: TypeExpr }[] = [];
    let hasVarargs = false;
    if (!check(')')) {
      do {
        if (match('...')) {
          hasVarargs = true;
          if (match(':')) parseTypeExpr();
          break;
        }
        const pTok = expectIdent('Expected parameter name');
        let typeAnnotation: TypeExpr | undefined;
        if (match(':')) {
          typeAnnotation = parseTypeExpr();
        }
        params.push({ name: pTok.value, typeAnnotation });
      } while (match(','));
    }
    expect(')');
    let returnType: TypeExpr | undefined;
    if (match(':')) {
      // Handle multi-return tuple `(a, b)` or single type
      if (check('(')) {
        returnType = parseTypeExpr();
      } else {
        returnType = parseTypeExpr();
      }
    }
    return { params, hasVarargs, returnType };
  };

  const parseBlock = (stopAtTop = false): Stmt[] => {
    const stmts: Stmt[] = [];
    while (peek().type !== 'EOF') {
      while (match(';')) {
        // skip optional semicolons
      }
      const cur = peek();
      if (cur.type === 'EOF') break;
      if (!stopAtTop && cur.type === 'KEYWORD' && BLOCK_TERMINATORS.has(cur.value)) {
        break;
      }
      stmts.push(parseStatement());
    }
    return stmts;
  };

  const parseStatement = (): Stmt => {
    const tok = peek();

    // `export type Foo = ...` or `type Foo = ...`
    if (tok.type === 'IDENT' && tok.value === 'export' && peek(1).type === 'IDENT' && peek(1).value === 'type') {
      advance(); // export
      return parseTypeDecl(true);
    }
    if (tok.type === 'IDENT' && tok.value === 'type' && peek(1).type === 'IDENT') {
      return parseTypeDecl(false);
    }

    if (tok.type === 'KEYWORD') {
      switch (tok.value) {
        case 'local':
          return parseLocal();
        case 'function':
          return parseFunctionDecl(false);
        case 'if':
          return parseIfStmt();
        case 'while':
          return parseWhileStmt();
        case 'repeat':
          return parseRepeatStmt();
        case 'for':
          return parseForStmt();
        case 'do': {
          advance();
          const body = parseBlock();
          expect('end');
          return { kind: 'Block', body, line: tok.line };
        }
        case 'return': {
          advance();
          const values: Expr[] = [];
          const next = peek();
          if (next.type !== 'EOF' && next.value !== ';' && !(next.type === 'KEYWORD' && BLOCK_TERMINATORS.has(next.value))) {
            values.push(parseExpr());
            while (match(',')) values.push(parseExpr());
          }
          match(';');
          return { kind: 'ReturnStmt', values, line: tok.line };
        }
        case 'break':
          advance();
          return { kind: 'BreakStmt', line: tok.line };
        case 'continue':
          advance();
          return { kind: 'ContinueStmt', line: tok.line };
      }
    }

    // Expression statement or assignment / compound assignment
    const expr = parseSuffixedExpr();

    if (check('=') || check(',')) {
      const targets: LValue[] = [toLValue(expr)];
      while (match(',')) {
        targets.push(toLValue(parseSuffixedExpr()));
      }
      expect('=');
      const values = [parseExpr()];
      while (match(',')) values.push(parseExpr());
      return { kind: 'Assign', targets, values, line: tok.line };
    }

    const compoundOps = ['+=', '-=', '*=', '/=', '%=', '..='];
    if (compoundOps.includes(peek().value)) {
      const op = advance().value;
      const value = parseExpr();
      return { kind: 'CompoundAssign', target: toLValue(expr), op, value, line: tok.line };
    }

    if (expr.kind !== 'Call' && expr.kind !== 'MethodCall') {
      throw new ParseError(`Unexpected expression as statement near '${tok.value}'`, tok.line, tok.column);
    }
    return { kind: 'ExprStmt', expr, line: tok.line };
  };

  const toLValue = (expr: Expr): LValue => {
    if (expr.kind === 'Var' || expr.kind === 'Member' || expr.kind === 'Index') {
      return expr;
    }
    throw new ParseError('Invalid assignment target', expr.line, 1);
  };

  const parseTypeDecl = (exported: boolean): Stmt => {
    const start = advance(); // type
    const name = expectIdent('Expected type name').value;
    const generics = skipGenericParams();
    expect('=');
    const typeExpr = parseTypeExpr();
    return { kind: 'TypeDecl', exported, name, generics, typeExpr, line: start.line };
  };

  const parseLocal = (): Stmt => {
    const start = advance(); // local
    if (check('function', 'KEYWORD')) {
      return parseFunctionDecl(true);
    }
    const names: { name: string; typeAnnotation?: TypeExpr; line: number }[] = [];
    do {
      const id = expectIdent('Expected variable name after local');
      let typeAnnotation: TypeExpr | undefined;
      if (match(':')) {
        typeAnnotation = parseTypeExpr();
      }
      names.push({ name: id.value, typeAnnotation, line: id.line });
    } while (match(','));

    const values: Expr[] = [];
    if (match('=')) {
      values.push(parseExpr());
      while (match(',')) values.push(parseExpr());
    }
    return { kind: 'LocalDecl', names, values, line: start.line };
  };

  const parseFunctionDecl = (isLocal: boolean): Stmt => {
    const start = advance(); // function
    const nameParts: string[] = [expectIdent('Expected function name').value];
    let isMethod = false;
    if (!isLocal) {
      while (match('.')) {
        nameParts.push(expectIdent('Expected field name').value);
      }
      if (match(':')) {
        isMethod = true;
        nameParts.push(expectIdent('Expected method name').value);
      }
    }
    skipGenericParams();
    const { params, hasVarargs, returnType } = parseParamList();
    const body = parseBlock();
    expect('end', "Expected 'end' to close function");
    return {
      kind: 'FunctionDecl',
      isLocal,
      nameParts,
      isMethod,
      params,
      hasVarargs,
      returnType,
      body,
      line: start.line,
    };
  };

  const parseIfStmt = (): Stmt => {
    const start = advance(); // if
    const branches: { cond: Expr; body: Stmt[] }[] = [];
    const cond = parseExpr();
    expect('then', "Expected 'then' after if condition");
    branches.push({ cond, body: parseBlock() });
    while (match('elseif', 'KEYWORD')) {
      const eCond = parseExpr();
      expect('then', "Expected 'then' after elseif condition");
      branches.push({ cond: eCond, body: parseBlock() });
    }
    let elseBody: Stmt[] | undefined;
    if (match('else', 'KEYWORD')) {
      elseBody = parseBlock();
    }
    expect('end', "Expected 'end' to close if statement");
    return { kind: 'IfStmt', branches, elseBody, line: start.line };
  };

  const parseWhileStmt = (): Stmt => {
    const start = advance(); // while
    const cond = parseExpr();
    expect('do', "Expected 'do' after while condition");
    const body = parseBlock();
    expect('end', "Expected 'end' to close while loop");
    return { kind: 'WhileStmt', cond, body, line: start.line };
  };

  const parseRepeatStmt = (): Stmt => {
    const start = advance(); // repeat
    const body = parseBlock();
    expect('until', "Expected 'until' to close repeat loop");
    const cond = parseExpr();
    return { kind: 'RepeatStmt', body, cond, line: start.line };
  };

  const parseForStmt = (): Stmt => {
    const start = advance(); // for
    const firstVar = expectIdent('Expected loop variable name').value;
    if (match(':')) parseTypeExpr();
    if (match('=')) {
      const startExpr = parseExpr();
      expect(',');
      const endExpr = parseExpr();
      let stepExpr: Expr | undefined;
      if (match(',')) stepExpr = parseExpr();
      expect('do', "Expected 'do' in numeric for loop");
      const body = parseBlock();
      expect('end', "Expected 'end' to close for loop");
      return { kind: 'NumericFor', varName: firstVar, start: startExpr, end: endExpr, step: stepExpr, body, line: start.line };
    }
    const vars = [firstVar];
    while (match(',')) {
      vars.push(expectIdent('Expected loop variable').value);
      if (match(':')) parseTypeExpr();
    }
    expect('in', "Expected 'in' or '=' in for loop");
    const iterators = [parseExpr()];
    while (match(',')) iterators.push(parseExpr());
    expect('do', "Expected 'do' in generic for loop");
    const body = parseBlock();
    expect('end', "Expected 'end' to close for loop");
    return { kind: 'GenericFor', vars, iterators, body, line: start.line };
  };

  const parseExpr = (): Expr => parseBinaryExpr(1);

  const parseBinaryExpr = (minPrec: number): Expr => {
    let left = parseUnaryExpr();

    while (true) {
      // Handle Luau `:: Type` type cast
      if (peek().value === '::') {
        const opTok = advance();
        const typeExpr = parseTypeExpr();
        left = { kind: 'TypeCast', expr: left, typeExpr, line: opTok.line };
        continue;
      }

      const opTok = peek();
      const info = BINARY_PRECEDENCE[opTok.value];
      if (!info || info.prec < minPrec) break;

      advance();
      const nextMinPrec = info.rightAssoc ? info.prec : info.prec + 1;
      const right = parseBinaryExpr(nextMinPrec);
      left = { kind: 'Binary', op: opTok.value, left, right, line: opTok.line };
    }

    return left;
  };

  const parseUnaryExpr = (): Expr => {
    const t = peek();
    if (t.value === 'not' || t.value === '-' || t.value === '#') {
      advance();
      const arg = parseUnaryExpr();
      return { kind: 'Unary', op: t.value, arg, line: t.line };
    }
    return parseSuffixedExpr();
  };

  const parseSuffixedExpr = (): Expr => {
    let expr = parsePrimaryExpr();

    while (true) {
      const t = peek();
      if (match('.')) {
        const prop = expectIdent('Expected property name after "."');
        expr = { kind: 'Member', object: expr, property: prop.value, line: t.line };
      } else if (match('[')) {
        const idx = parseExpr();
        expect(']');
        expr = { kind: 'Index', object: expr, index: idx, line: t.line };
      } else if (match(':')) {
        const method = expectIdent('Expected method name after ":"');
        const args = parseCallArgs();
        expr = { kind: 'MethodCall', object: expr, method: method.value, args, line: t.line };
      } else if (check('(') || check('{') || peek().type === 'STRING') {
        const args = parseCallArgs();
        expr = { kind: 'Call', callee: expr, args, line: t.line };
      } else {
        break;
      }
    }

    return expr;
  };

  const parseCallArgs = (): Expr[] => {
    if (match('(')) {
      const args: Expr[] = [];
      if (!check(')')) {
        args.push(parseExpr());
        while (match(',')) args.push(parseExpr());
      }
      expect(')');
      return args;
    }
    if (check('{')) {
      return [parseTableConstructor()];
    }
    if (peek().type === 'STRING') {
      const s = advance();
      return [{ kind: 'String', value: s.value, line: s.line }];
    }
    const t = peek();
    throw new ParseError(`Expected function arguments, got '${t.value || 'EOF'}'`, t.line, t.column);
  };

  const parsePrimaryExpr = (): Expr => {
    const t = peek();
    if (t.type === 'KEYWORD') {
      if (t.value === 'nil') {
        advance();
        return { kind: 'Nil', line: t.line };
      }
      if (t.value === 'true' || t.value === 'false') {
        advance();
        return { kind: 'Bool', value: t.value === 'true', line: t.line };
      }
      if (t.value === 'function') {
        advance();
        skipGenericParams();
        const { params, hasVarargs, returnType } = parseParamList();
        const body = parseBlock();
        expect('end');
        return { kind: 'FunctionExpr', params, hasVarargs, returnType, body, line: t.line };
      }
      if (t.value === 'if') {
        advance();
        const cond = parseExpr();
        expect('then');
        const thenExpr = parseExpr();
        const elseIfs: { cond: Expr; expr: Expr }[] = [];
        while (match('elseif', 'KEYWORD')) {
          const c = parseExpr();
          expect('then');
          const e = parseExpr();
          elseIfs.push({ cond: c, expr: e });
        }
        expect('else');
        const elseExpr = parseExpr();
        return { kind: 'IfExpr', cond, thenExpr, elseIfs, elseExpr, line: t.line };
      }
    }

    if (t.type === 'NUMBER') {
      advance();
      return { kind: 'Number', value: Number(t.value), line: t.line };
    }
    if (t.type === 'STRING') {
      advance();
      return { kind: 'String', value: t.value, line: t.line };
    }
    if (t.type === 'INTERP_START') {
      advance();
      const parts: string[] = [t.value];
      const exprs: Expr[] = [];
      while (true) {
        exprs.push(parseExpr());
        const next = peek();
        if (next.type === 'INTERP_MID') {
          advance();
          parts.push(next.value);
        } else if (next.type === 'INTERP_END') {
          advance();
          parts.push(next.value);
          break;
        } else {
          throw new ParseError('Malformed interpolated string', next.line, next.column);
        }
      }
      return { kind: 'InterpolatedString', parts, exprs, line: t.line };
    }
    if (t.value === '...') {
      advance();
      return { kind: 'Varargs', line: t.line };
    }
    if (t.type === 'IDENT') {
      advance();
      return { kind: 'Var', name: t.value, line: t.line };
    }
    if (match('(')) {
      const inner = parseExpr();
      expect(')');
      return inner;
    }
    if (check('{')) {
      return parseTableConstructor();
    }

    throw new ParseError(`Unexpected token '${t.value || 'EOF'}'`, t.line, t.column);
  };

  const parseTableConstructor = (): Expr => {
    const start = expect('{');
    const entries: { key?: Expr; value: Expr }[] = [];
    while (!check('}') && peek().type !== 'EOF') {
      if (match('[')) {
        const key = parseExpr();
        expect(']');
        expect('=');
        const value = parseExpr();
        entries.push({ key, value });
      } else if (peek().type === 'IDENT' && peek(1).value === '=') {
        const keyTok = advance();
        advance(); // =
        const value = parseExpr();
        entries.push({ key: { kind: 'String', value: keyTok.value, line: keyTok.line }, value });
      } else {
        const value = parseExpr();
        entries.push({ value });
      }
      if (!match(',') && !match(';')) break;
    }
    expect('}');
    return { kind: 'Table', entries, line: start.line };
  };

  const body = parseBlock(true);
  return { body, strictMode };
}
