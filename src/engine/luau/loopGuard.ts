import { tokenizeLuau } from './lexer';

/**
 * Injects `__loopTick()` at the start of `while ... do`, `for ... do`, and `repeat` loop bodies
 * on the exact same source line so line numbers in compile errors and tracebacks remain untouched.
 */
export function injectLuauLoopGuard(source: string): string {
  let tokens;
  try {
    tokens = tokenizeLuau(source).tokens;
  } catch {
    return source;
  }

  const lines = source.split('\n');
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const ln of lines) {
    lineOffsets.push(offset);
    offset += ln.length + 1;
  }

  const insertions: { pos: number; text: string }[] = [];
  let awaitingLoopDo = false;
  let parenDepth = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type === 'PUNCT') {
      if (tok.value === '(' || tok.value === '{' || tok.value === '[') parenDepth++;
      if (tok.value === ')' || tok.value === '}' || tok.value === ']') {
        parenDepth = Math.max(0, parenDepth - 1);
      }
    }

    if (tok.type === 'KEYWORD') {
      if (tok.value === 'while' || tok.value === 'for') {
        awaitingLoopDo = true;
      } else if (tok.value === 'do' && awaitingLoopDo && parenDepth === 0) {
        awaitingLoopDo = false;
        const base = lineOffsets[tok.line - 1];
        if (base !== undefined) {
          insertions.push({ pos: base + (tok.column - 1) + 2, text: ' __loopTick();' });
        }
      } else if (tok.value === 'repeat') {
        const base = lineOffsets[tok.line - 1];
        if (base !== undefined) {
          insertions.push({ pos: base + (tok.column - 1) + 6, text: ' __loopTick();' });
        }
      }
    }
  }

  if (insertions.length === 0) return source;

  let result = source;
  for (let i = insertions.length - 1; i >= 0; i--) {
    const ins = insertions[i];
    result = result.slice(0, ins.pos) + ins.text + result.slice(ins.pos);
  }
  return result;
}
