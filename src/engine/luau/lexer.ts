export type TokenType =
  | 'EOF'
  | 'IDENT'
  | 'NUMBER'
  | 'STRING'
  | 'INTERP_START'
  | 'INTERP_MID'
  | 'INTERP_END'
  | 'KEYWORD'
  | 'OP'
  | 'PUNCT';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export interface LexerResult {
  tokens: Token[];
  strictMode: boolean;
}

const KEYWORDS = new Set([
  'and',
  'break',
  'continue',
  'do',
  'else',
  'elseif',
  'end',
  'false',
  'for',
  'function',
  'if',
  'in',
  'local',
  'nil',
  'not',
  'or',
  'repeat',
  'return',
  'then',
  'true',
  'until',
  'while',
]);

export class LexerError extends Error {
  line: number;
  column: number;
  constructor(message: string, line: number, column: number) {
    super(message);
    this.line = line;
    this.column = column;
  }
}

export function tokenizeLuau(source: string): LexerResult {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;
  let strictMode = false;

  const len = source.length;

  const peek = (offset = 0) => (i + offset < len ? source[i + offset] : '');
  const advance = () => {
    const ch = source[i++];
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    return ch;
  };

  const matchStr = (s: string) => source.startsWith(s, i);

  const readLongBracket = (startLine: number, startCol: number): string | null => {
    if (peek() !== '[') return null;
    let eqCount = 0;
    let offset = 1;
    while (peek(offset) === '=') {
      eqCount++;
      offset++;
    }
    if (peek(offset) !== '[') return null;
    for (let k = 0; k <= offset; k++) advance();
    if (peek() === '\n') advance();
    const closeTag = ']' + '='.repeat(eqCount) + ']';
    let content = '';
    while (i < len) {
      if (matchStr(closeTag)) {
        for (let k = 0; k < closeTag.length; k++) advance();
        return content;
      }
      content += advance();
    }
    throw new LexerError('Unclosed long string or comment', startLine, startCol);
  };

  const readQuotedString = (quote: string, startLine: number, startCol: number): string => {
    advance(); // opening quote
    let out = '';
    while (i < len) {
      const ch = peek();
      if (ch === '\n' || ch === '\r') {
        throw new LexerError('Unclosed string literal before end of line', startLine, startCol);
      }
      if (ch === quote) {
        advance();
        return out;
      }
      if (ch === '\\') {
        advance();
        const esc = advance();
        switch (esc) {
          case 'n':
            out += '\n';
            break;
          case 't':
            out += '\t';
            break;
          case 'r':
            out += '\r';
            break;
          case '\\':
            out += '\\';
            break;
          case '"':
            out += '"';
            break;
          case "'":
            out += "'";
            break;
          case '`':
            out += '`';
            break;
          case '{':
            out += '{';
            break;
          default:
            out += esc;
        }
      } else {
        out += advance();
      }
    }
    throw new LexerError('Unclosed string literal', startLine, startCol);
  };

  const readNumber = (): string => {
    let raw = '';
    if (peek() === '0' && (peek(1) === 'x' || peek(1) === 'X')) {
      raw += advance() + advance();
      while (/[0-9a-fA-F_]/.test(peek())) raw += advance();
      return raw.replace(/_/g, '');
    }
    if (peek() === '0' && (peek(1) === 'b' || peek(1) === 'B')) {
      raw += advance() + advance();
      while (/[01_]/.test(peek())) raw += advance();
      return String(parseInt(raw.slice(2).replace(/_/g, ''), 2));
    }
    while (/[0-9_]/.test(peek())) raw += advance();
    if (peek() === '.' && /[0-9]/.test(peek(1))) {
      raw += advance();
      while (/[0-9_]/.test(peek())) raw += advance();
    }
    if ((peek() === 'e' || peek() === 'E') && (/[0-9]/.test(peek(1)) || ((peek(1) === '+' || peek(1) === '-') && /[0-9]/.test(peek(2))))) {
      raw += advance();
      if (peek() === '+' || peek() === '-') raw += advance();
      while (/[0-9_]/.test(peek())) raw += advance();
    }
    return raw.replace(/_/g, '');
  };

  // Stack to track interpolated backtick string braces
  const interpBraceStack: number[] = [];

  const readInterpolatedSegment = (isStart: boolean, startLine: number, startCol: number) => {
    let text = '';
    while (i < len) {
      const ch = peek();
      if (ch === '`') {
        advance();
        tokens.push({
          type: isStart ? 'STRING' : 'INTERP_END',
          value: text,
          line: startLine,
          column: startCol,
        });
        return;
      }
      if (ch === '{') {
        advance();
        tokens.push({
          type: isStart ? 'INTERP_START' : 'INTERP_MID',
          value: text,
          line: startLine,
          column: startCol,
        });
        interpBraceStack.push(1);
        return;
      }
      if (ch === '\\') {
        advance();
        const esc = advance();
        if (esc === 'n') text += '\n';
        else if (esc === 't') text += '\t';
        else text += esc;
      } else {
        text += advance();
      }
    }
    throw new LexerError('Unclosed interpolated string', startLine, startCol);
  };

  while (i < len) {
    const ch = peek();
    if (/\s/.test(ch)) {
      advance();
      continue;
    }

    // Comments
    if (ch === '-' && peek(1) === '-') {
      const commentLine = line;
      advance();
      advance();
      if (peek() === '[') {
        const longComment = readLongBracket(commentLine, col);
        if (longComment !== null) continue;
      }
      let commentText = '';
      while (i < len && peek() !== '\n') {
        commentText += advance();
      }
      if (commentText.trim() === '!strict') {
        strictMode = true;
      }
      continue;
    }

    const startLine = line;
    const startCol = col;

    // Interpolated string continuation when closing brace hits top of stack
    if (ch === '}' && interpBraceStack.length > 0 && interpBraceStack[interpBraceStack.length - 1] === 1) {
      advance();
      interpBraceStack.pop();
      readInterpolatedSegment(false, startLine, startCol);
      continue;
    }

    if (ch === '{' && interpBraceStack.length > 0) {
      interpBraceStack[interpBraceStack.length - 1]++;
    } else if (ch === '}' && interpBraceStack.length > 0) {
      interpBraceStack[interpBraceStack.length - 1]--;
    }

    // Backtick interpolated string
    if (ch === '`') {
      advance();
      readInterpolatedSegment(true, startLine, startCol);
      continue;
    }

    // Quoted string
    if (ch === '"' || ch === "'") {
      const val = readQuotedString(ch, startLine, startCol);
      tokens.push({ type: 'STRING', value: val, line: startLine, column: startCol });
      continue;
    }

    // Long string [[...]]
    if (ch === '[' && (peek(1) === '[' || peek(1) === '=')) {
      const longStr = readLongBracket(startLine, startCol);
      if (longStr !== null) {
        tokens.push({ type: 'STRING', value: longStr, line: startLine, column: startCol });
        continue;
      }
    }

    // Number
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(peek(1)))) {
      if (ch === '.') {
        let num = advance();
        while (/[0-9_]/.test(peek())) num += advance();
        tokens.push({ type: 'NUMBER', value: num.replace(/_/g, ''), line: startLine, column: startCol });
      } else {
        const num = readNumber();
        tokens.push({ type: 'NUMBER', value: num, line: startLine, column: startCol });
      }
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (/[a-zA-Z0-9_]/.test(peek())) ident += advance();
      tokens.push({
        type: KEYWORDS.has(ident) ? 'KEYWORD' : 'IDENT',
        value: ident,
        line: startLine,
        column: startCol,
      });
      continue;
    }

    // Multi-char operators
    const threeChar = source.slice(i, i + 3);
    if (threeChar === '...' || threeChar === '..=') {
      advance();
      advance();
      advance();
      tokens.push({ type: 'OP', value: threeChar, line: startLine, column: startCol });
      continue;
    }

    const twoChar = source.slice(i, i + 2);
    if (
      twoChar === '==' ||
      twoChar === '~=' ||
      twoChar === '<=' ||
      twoChar === '>=' ||
      twoChar === '..' ||
      twoChar === '+=' ||
      twoChar === '-=' ||
      twoChar === '*=' ||
      twoChar === '/=' ||
      twoChar === '%=' ||
      twoChar === '//' ||
      twoChar === '::' ||
      twoChar === '->'
    ) {
      advance();
      advance();
      tokens.push({ type: 'OP', value: twoChar, line: startLine, column: startCol });
      continue;
    }

    // Single-char ops / punctuation
    const single = advance();
    if ('+-*/%^#<>='.includes(single)) {
      tokens.push({ type: 'OP', value: single, line: startLine, column: startCol });
    } else if ('(){}[],.:;?|&'.includes(single)) {
      tokens.push({ type: 'PUNCT', value: single, line: startLine, column: startCol });
    } else {
      throw new LexerError(`Unexpected character '${single}'`, startLine, startCol);
    }
  }

  tokens.push({ type: 'EOF', value: '', line, column: col });
  return { tokens, strictMode };
}
