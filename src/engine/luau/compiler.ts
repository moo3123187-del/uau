import { LuauState } from 'luau-web';
import { DiagnosticItem } from '../../types/studio';
import { checkLuauDiagnostics } from './typechecker';

let sharedCompileVmPromise: Promise<LuauState> | null = null;
let sharedCompileVm: LuauState | null = null;

export async function ensureLuauWasmReady(): Promise<LuauState> {
  if (sharedCompileVm && !sharedCompileVm.destroyed) {
    return sharedCompileVm;
  }
  if (!sharedCompileVmPromise) {
    sharedCompileVmPromise = LuauState.createAsync().then((vm) => {
      sharedCompileVm = vm;
      return vm;
    });
  }
  return sharedCompileVmPromise;
}

export function isLuauWasmLoaded(): boolean {
  return Boolean(sharedCompileVm && !sharedCompileVm.destroyed);
}

/**
 * Compiles Luau source using the real C++ Luau compiler (via luau-web WASM)
 * and combines real compiler syntax diagnostics with --!strict type diagnostics.
 */
export function checkRealLuauDiagnostics(
  scriptPath: string,
  source: string
): DiagnosticItem[] {
  const chunkName = scriptPath.split('/').pop() || 'Script';
  const strictDiags = checkLuauDiagnostics(scriptPath, source);

  if (!sharedCompileVm || sharedCompileVm.destroyed) {
    void ensureLuauWasmReady();
    return strictDiags;
  }

  const res = sharedCompileVm.loadstring(source, chunkName, false);
  if (typeof res === 'string') {
    const match = res.match(/^\[string "[^"]*"\]:(\d+):\s*(.+)$/);
    const line = match ? Math.max(1, Number(match[1])) : 1;
    const message = match ? match[2] : res;
    const compilerDiag: DiagnosticItem = {
      scriptPath,
      line,
      column: 1,
      severity: 'error',
      message: `Luau Compile Error: ${message}`,
    };
    return [compilerDiag];
  }

  return strictDiags.filter((d) => !d.message.startsWith('Expected') && !d.message.startsWith('Unexpected'));
}
