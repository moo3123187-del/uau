import { Expr, LValue, ParsedProgram, parseLuau, Stmt } from './parser';

export type LuaValue =
  | null
  | boolean
  | number
  | string
  | LuaTable
  | LuaFunction
  | LuaThread
  | LuaUserdata;

export interface LuaUserdata {
  __luaType: 'userdata';
  className: string;
  data: unknown;
  getProp?: (key: string) => LuaValue;
  setProp?: (key: string, val: LuaValue) => void;
  callOp?: (op: string, other: LuaValue, selfLeft: boolean) => LuaValue;
  toString?: () => string;
}

export class LuaTable {
  readonly __luaType = 'table' as const;
  map = new Map<string | number | boolean | object, LuaValue>();
  metatable: LuaTable | null = null;
  frozen = false;

  get(key: LuaValue): LuaValue {
    if (key === null || key === undefined) return null;
    if (typeof key === 'number' && Number.isNaN(key)) return null;
    const val = this.map.get(key as string | number | boolean | object);
    return val === undefined ? null : val;
  }

  set(key: LuaValue, val: LuaValue) {
    if (this.frozen) {
      throw new LuaRuntimeError('Attempt to modify a frozen table');
    }
    if (key === null || key === undefined) {
      throw new LuaRuntimeError('Table index is nil');
    }
    if (val === null || val === undefined) {
      this.map.delete(key as string | number | boolean | object);
    } else {
      this.map.set(key as string | number | boolean | object, val);
    }
  }

  length(): number {
    let n = 0;
    while (this.map.has(n + 1)) {
      n++;
    }
    return n;
  }
}

export class LuaMultiValue {
  constructor(public values: LuaValue[]) {}
  first(): LuaValue {
    return this.values.length > 0 ? this.values[0] : null;
  }
}

export type YieldRequest =
  | { kind: 'wait'; seconds: number }
  | { kind: 'coroutine_yield'; values: LuaValue[] }
  | { kind: 'await_promise'; promise: Promise<LuaValue[]> };

export type EvalGen = Generator<YieldRequest, LuaValue | LuaMultiValue, LuaValue[]>;
export type SingleGen = Generator<YieldRequest, LuaValue, LuaValue[]>;

export type NativeLuaFn = (
  args: LuaValue[],
  vm: LuauVM,
  line: number
) => EvalGen | LuaValue | LuaMultiValue | void;

export interface LuaFunction {
  __luaType: 'function';
  name: string;
  isNative: boolean;
  nativeFn?: NativeLuaFn;
  params?: { name: string }[];
  hasVarargs?: boolean;
  body?: Stmt[];
  closureEnv?: EnvScope;
}

export interface LuaThread {
  __luaType: 'thread';
  id: number;
  status: 'suspended' | 'running' | 'dead' | 'normal';
  gen: EvalGen | null;
  cancelled: boolean;
  onComplete?: (results: LuaValue[]) => void;
}

export class LuaRuntimeError extends Error {
  line?: number;
  constructor(message: string, line?: number) {
    super(message);
    this.line = line;
  }
}

class ControlFlowSignal {
  constructor(public kind: 'break' | 'continue' | 'return', public values: LuaValue[] = []) {}
}

export class EnvScope {
  vars = new Map<string, LuaValue>();
  constructor(public parent: EnvScope | null = null) {}

  define(name: string, val: LuaValue) {
    this.vars.set(name, val);
  }

  get(name: string): LuaValue {
    if (this.vars.has(name)) {
      return this.vars.get(name) ?? null;
    }
    if (this.parent) return this.parent.get(name);
    return null;
  }

  set(name: string, val: LuaValue): boolean {
    if (this.vars.has(name)) {
      this.vars.set(name, val);
      return true;
    }
    if (this.parent) {
      return this.parent.set(name, val);
    }
    return false;
  }
}

export function isTruthy(val: LuaValue): boolean {
  return val !== null && val !== false;
}

export function luaToString(val: LuaValue): string {
  if (val === null || val === undefined) return 'nil';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') {
    if (Object.is(val, -0)) return '0';
    return String(val);
  }
  if (typeof val === 'string') return val;
  if (val instanceof LuaTable) {
    return 'table';
  }
  if (typeof val === 'object' && '__luaType' in val) {
    if (val.__luaType === 'function') return `function: ${val.name}`;
    if (val.__luaType === 'thread') return `thread: #${val.id}`;
    if (val.__luaType === 'userdata') return val.toString ? val.toString() : val.className;
  }
  return String(val);
}

export function luaTypeOf(val: LuaValue): string {
  if (val === null || val === undefined) return 'nil';
  if (typeof val === 'boolean') return 'boolean';
  if (typeof val === 'number') return 'number';
  if (typeof val === 'string') return 'string';
  if (val instanceof LuaTable) return 'table';
  if (typeof val === 'object' && '__luaType' in val) {
    if (val.__luaType === 'function') return 'function';
    if (val.__luaType === 'thread') return 'thread';
    if (val.__luaType === 'userdata') return val.className;
  }
  return 'userdata';
}

export function makeNativeFn(name: string, fn: NativeLuaFn): LuaFunction {
  return {
    __luaType: 'function',
    name,
    isNative: true,
    nativeFn: fn,
  };
}

export interface VMOutputCallbacks {
  onPrint: (msg: string, level: 'print' | 'warn' | 'error') => void;
}

export class LuauVM {
  globalEnv: EnvScope;
  cancelled = false;
  private threadSeq = 0;
  private activeTimers = new Set<number>();
  private opsInCurrentSlice = 0;
  private readonly maxOpsPerSlice = 45000;
  private startTime = performance.now();

  constructor(private callbacks: VMOutputCallbacks) {
    this.globalEnv = new EnvScope(null);
    this.installStandardLibraries();
  }

  stop() {
    this.cancelled = true;
    for (const timerId of this.activeTimers) {
      window.clearTimeout(timerId);
    }
    this.activeTimers.clear();
  }

  private bumpOps(line?: number) {
    if (this.cancelled) {
      throw new LuaRuntimeError('Execution stopped', line);
    }
    this.opsInCurrentSlice++;
    if (this.opsInCurrentSlice > this.maxOpsPerSlice) {
      throw new LuaRuntimeError(
        'Script timeout: infinite loop detected. Add task.wait() inside while/repeat loops.',
        line
      );
    }
  }

  private installStandardLibraries() {
    const g = this.globalEnv;

    g.define(
      'print',
      makeNativeFn('print', (args) => {
        const line = args.map((a) => luaToString(a)).join(' ');
        this.callbacks.onPrint(line, 'print');
        return null;
      })
    );

    g.define(
      'warn',
      makeNativeFn('warn', (args) => {
        const line = args.map((a) => luaToString(a)).join(' ');
        this.callbacks.onPrint(line, 'warn');
        return null;
      })
    );

    g.define(
      'error',
      makeNativeFn('error', (args, _vm, line) => {
        throw new LuaRuntimeError(luaToString(args[0] ?? 'Error occurred'), line);
      })
    );

    g.define(
      'assert',
      makeNativeFn('assert', (args, _vm, line) => {
        if (!isTruthy(args[0] ?? null)) {
          throw new LuaRuntimeError(luaToString(args[1] ?? 'assertion failed!'), line);
        }
        return new LuaMultiValue(args);
      })
    );

    g.define(
      'type',
      makeNativeFn('type', (args) => {
        const t = luaTypeOf(args[0] ?? null);
        if (!['nil', 'boolean', 'number', 'string', 'table', 'function', 'thread'].includes(t)) {
          return 'userdata';
        }
        return t;
      })
    );

    g.define(
      'typeof',
      makeNativeFn('typeof', (args) => luaTypeOf(args[0] ?? null))
    );

    g.define(
      'tonumber',
      makeNativeFn('tonumber', (args) => {
        const val = args[0] ?? null;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const base = typeof args[1] === 'number' ? args[1] : undefined;
          const n = base ? parseInt(val.trim(), base) : Number(val.trim());
          return Number.isNaN(n) || val.trim() === '' ? null : n;
        }
        return null;
      })
    );

    g.define(
      'tostring',
      makeNativeFn('tostring', (args) => {
        const val = args[0] ?? null;
        if (val instanceof LuaTable && val.metatable) {
          const ts = val.metatable.get('__tostring');
          if (ts && typeof ts === 'object' && '__luaType' in ts && ts.__luaType === 'function') {
            return this.callFunctionSync(ts, [val]);
          }
        }
        return luaToString(val);
      })
    );

    g.define(
      'select',
      makeNativeFn('select', (args) => {
        const idx = args[0];
        if (idx === '#') return Math.max(0, args.length - 1);
        if (typeof idx === 'number') {
          const start = idx < 0 ? Math.max(1, args.length + idx) : idx;
          return new LuaMultiValue(args.slice(start));
        }
        return null;
      })
    );

    g.define(
      'unpack',
      makeNativeFn('unpack', (args) => this.unpackTable(args[0], args[1], args[2]))
    );

    g.define(
      'ipairs',
      makeNativeFn('ipairs', (args) => {
        const tbl = args[0];
        const iter = makeNativeFn('ipairs_iter', (iArgs) => {
          const t = iArgs[0];
          const prev = typeof iArgs[1] === 'number' ? iArgs[1] : 0;
          const nextIdx = prev + 1;
          if (t instanceof LuaTable) {
            const v = t.get(nextIdx);
            if (v === null) return null;
            return new LuaMultiValue([nextIdx, v]);
          }
          return null;
        });
        return new LuaMultiValue([iter, tbl ?? null, 0]);
      })
    );

    g.define(
      'pairs',
      makeNativeFn('pairs', (args) => {
        const tbl = args[0];
        const keys = tbl instanceof LuaTable ? Array.from(tbl.map.keys()) : [];
        let cursor = 0;
        const iter = makeNativeFn('pairs_iter', () => {
          if (!(tbl instanceof LuaTable)) return null;
          while (cursor < keys.length) {
            const k = keys[cursor++] as LuaValue;
            const v = tbl.get(k);
            if (v !== null) return new LuaMultiValue([k, v]);
          }
          return null;
        });
        return new LuaMultiValue([iter, tbl ?? null, null]);
      })
    );

    g.define(
      'next',
      makeNativeFn('next', (args) => {
        const tbl = args[0];
        const curKey = args[1] ?? null;
        if (!(tbl instanceof LuaTable)) return null;
        const entries = Array.from(tbl.map.entries());
        if (entries.length === 0) return null;
        if (curKey === null) {
          return new LuaMultiValue([entries[0][0] as LuaValue, entries[0][1]]);
        }
        const idx = entries.findIndex(([k]) => k === curKey);
        if (idx >= 0 && idx + 1 < entries.length) {
          return new LuaMultiValue([entries[idx + 1][0] as LuaValue, entries[idx + 1][1]]);
        }
        return null;
      })
    );

    g.define(
      'setmetatable',
      makeNativeFn('setmetatable', (args) => {
        const tbl = args[0];
        const mt = args[1];
        if (!(tbl instanceof LuaTable)) {
          throw new LuaRuntimeError('setmetatable expects a table as first argument');
        }
        tbl.metatable = mt instanceof LuaTable ? mt : null;
        return tbl;
      })
    );

    g.define(
      'getmetatable',
      makeNativeFn('getmetatable', (args) => {
        const tbl = args[0];
        return tbl instanceof LuaTable ? tbl.metatable : null;
      })
    );

    g.define(
      'pcall',
      makeNativeFn('pcall', function* (args, vm, line): EvalGen {
        const fn = args[0];
        if (!fn || typeof fn !== 'object' || !('__luaType' in fn) || fn.__luaType !== 'function') {
          return new LuaMultiValue([false, 'attempt to call a non-function value']);
        }
        try {
          const res = yield* vm.callFunctionGen(fn, args.slice(1), line);
          const list = res instanceof LuaMultiValue ? res.values : [res];
          return new LuaMultiValue([true, ...list]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return new LuaMultiValue([false, msg]);
        }
      })
    );

    g.define(
      'xpcall',
      makeNativeFn('xpcall', function* (args, vm, line): EvalGen {
        const fn = args[0];
        const handler = args[1];
        if (!fn || typeof fn !== 'object' || !('__luaType' in fn) || fn.__luaType !== 'function') {
          return new LuaMultiValue([false, 'attempt to call a non-function value']);
        }
        try {
          const res = yield* vm.callFunctionGen(fn, args.slice(2), line);
          const list = res instanceof LuaMultiValue ? res.values : [res];
          return new LuaMultiValue([true, ...list]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (handler && typeof handler === 'object' && '__luaType' in handler && handler.__luaType === 'function') {
            const handled = yield* vm.callFunctionGen(handler, [msg], line);
            return new LuaMultiValue([false, handled instanceof LuaMultiValue ? handled.first() : handled]);
          }
          return new LuaMultiValue([false, msg]);
        }
      })
    );

    g.define(
      'tick',
      makeNativeFn('tick', () => Date.now() / 1000)
    );

    // math library
    const mathTbl = new LuaTable();
    mathTbl.set('pi', Math.PI);
    mathTbl.set('huge', Infinity);
    mathTbl.set('abs', makeNativeFn('math.abs', (a) => Math.abs(Number(a[0] ?? 0))));
    mathTbl.set('floor', makeNativeFn('math.floor', (a) => Math.floor(Number(a[0] ?? 0))));
    mathTbl.set('ceil', makeNativeFn('math.ceil', (a) => Math.ceil(Number(a[0] ?? 0))));
    mathTbl.set('round', makeNativeFn('math.round', (a) => Math.round(Number(a[0] ?? 0))));
    mathTbl.set('sqrt', makeNativeFn('math.sqrt', (a) => Math.sqrt(Number(a[0] ?? 0))));
    mathTbl.set('sin', makeNativeFn('math.sin', (a) => Math.sin(Number(a[0] ?? 0))));
    mathTbl.set('cos', makeNativeFn('math.cos', (a) => Math.cos(Number(a[0] ?? 0))));
    mathTbl.set('tan', makeNativeFn('math.tan', (a) => Math.tan(Number(a[0] ?? 0))));
    mathTbl.set('asin', makeNativeFn('math.asin', (a) => Math.asin(Number(a[0] ?? 0))));
    mathTbl.set('acos', makeNativeFn('math.acos', (a) => Math.acos(Number(a[0] ?? 0))));
    mathTbl.set('atan2', makeNativeFn('math.atan2', (a) => Math.atan2(Number(a[0] ?? 0), Number(a[1] ?? 1))));
    mathTbl.set('rad', makeNativeFn('math.rad', (a) => (Number(a[0] ?? 0) * Math.PI) / 180));
    mathTbl.set('deg', makeNativeFn('math.deg', (a) => (Number(a[0] ?? 0) * 180) / Math.PI));
    mathTbl.set('pow', makeNativeFn('math.pow', (a) => Math.pow(Number(a[0] ?? 0), Number(a[1] ?? 1))));
    mathTbl.set('min', makeNativeFn('math.min', (a) => Math.min(...a.map(Number))));
    mathTbl.set('max', makeNativeFn('math.max', (a) => Math.max(...a.map(Number))));
    mathTbl.set(
      'clamp',
      makeNativeFn('math.clamp', (a) => Math.min(Math.max(Number(a[0] ?? 0), Number(a[1] ?? 0)), Number(a[2] ?? 1)))
    );
    mathTbl.set(
      'random',
      makeNativeFn('math.random', (a) => {
        if (a.length === 0) return Math.random();
        if (a.length === 1) return Math.floor(Math.random() * Number(a[0])) + 1;
        const m = Number(a[0]);
        const n = Number(a[1]);
        return Math.floor(Math.random() * (n - m + 1)) + m;
      })
    );
    mathTbl.set(
      'noise',
      makeNativeFn('math.noise', (a) => {
        const x = Number(a[0] ?? 0);
        const y = Number(a[1] ?? 0);
        const z = Number(a[2] ?? 0);
        return Math.sin(x * 1.7 + y * 2.3 + z * 3.1) * 0.5;
      })
    );
    g.define('math', mathTbl);

    // string library
    const strTbl = new LuaTable();
    strTbl.set('len', makeNativeFn('string.len', (a) => String(a[0] ?? '').length));
    strTbl.set('upper', makeNativeFn('string.upper', (a) => String(a[0] ?? '').toUpperCase()));
    strTbl.set('lower', makeNativeFn('string.lower', (a) => String(a[0] ?? '').toLowerCase()));
    strTbl.set('rep', makeNativeFn('string.rep', (a) => String(a[0] ?? '').repeat(Math.max(0, Number(a[1] ?? 0)))));
    strTbl.set(
      'sub',
      makeNativeFn('string.sub', (a) => {
        const s = String(a[0] ?? '');
        let i = Number(a[1] ?? 1);
        let j = a[2] !== undefined && a[2] !== null ? Number(a[2]) : s.length;
        if (i < 0) i = s.length + i + 1;
        if (j < 0) j = s.length + j + 1;
        i = Math.max(1, i);
        j = Math.min(s.length, j);
        if (i > j) return '';
        return s.slice(i - 1, j);
      })
    );
    strTbl.set(
      'split',
      makeNativeFn('string.split', (a) => {
        const s = String(a[0] ?? '');
        const sep = String(a[1] ?? ',');
        const t = new LuaTable();
        s.split(sep).forEach((part, idx) => t.set(idx + 1, part));
        return t;
      })
    );
    strTbl.set(
      'find',
      makeNativeFn('string.find', (a) => {
        const s = String(a[0] ?? '');
        const pat = String(a[1] ?? '');
        const init = Math.max(1, Number(a[2] ?? 1));
        const idx = s.indexOf(pat, init - 1);
        if (idx === -1) return null;
        return new LuaMultiValue([idx + 1, idx + pat.length]);
      })
    );
    strTbl.set(
      'format',
      makeNativeFn('string.format', (a) => {
        let fmt = String(a[0] ?? '');
        let argIdx = 1;
        fmt = fmt.replace(/%(\.\d+)?([dfsx])/g, (_m, prec, spec) => {
          const val = a[argIdx++];
          if (spec === 's') return luaToString(val ?? null);
          const num = Number(val ?? 0);
          if (spec === 'd') return String(Math.trunc(num));
          if (spec === 'x') return Math.trunc(num).toString(16);
          if (spec === 'f') {
            const digits = prec ? Number(prec.slice(1)) : 6;
            return num.toFixed(digits);
          }
          return luaToString(val ?? null);
        });
        return fmt;
      })
    );
    g.define('string', strTbl);

    // table library
    const tblLib = new LuaTable();
    tblLib.set(
      'insert',
      makeNativeFn('table.insert', (a) => {
        const t = a[0];
        if (!(t instanceof LuaTable)) throw new LuaRuntimeError('table.insert expects a table');
        const len = t.length();
        if (a.length === 2) {
          t.set(len + 1, a[1]);
        } else {
          const pos = Number(a[1]);
          for (let i = len; i >= pos; i--) {
            t.set(i + 1, t.get(i));
          }
          t.set(pos, a[2]);
        }
        return null;
      })
    );
    tblLib.set(
      'remove',
      makeNativeFn('table.remove', (a) => {
        const t = a[0];
        if (!(t instanceof LuaTable)) throw new LuaRuntimeError('table.remove expects a table');
        const len = t.length();
        if (len === 0) return null;
        const pos = a[1] !== undefined && a[1] !== null ? Number(a[1]) : len;
        const removed = t.get(pos);
        for (let i = pos; i < len; i++) {
          t.set(i, t.get(i + 1));
        }
        t.set(len, null);
        return removed;
      })
    );
    tblLib.set(
      'find',
      makeNativeFn('table.find', (a) => {
        const t = a[0];
        const needle = a[1];
        const init = Math.max(1, Number(a[2] ?? 1));
        if (!(t instanceof LuaTable)) return null;
        const len = t.length();
        for (let i = init; i <= len; i++) {
          if (t.get(i) === needle) return i;
        }
        return null;
      })
    );
    tblLib.set(
      'concat',
      makeNativeFn('table.concat', (a) => {
        const t = a[0];
        const sep = String(a[1] ?? '');
        if (!(t instanceof LuaTable)) return '';
        const parts: string[] = [];
        const len = t.length();
        for (let i = 1; i <= len; i++) {
          parts.push(luaToString(t.get(i)));
        }
        return parts.join(sep);
      })
    );
    tblLib.set(
      'sort',
      makeNativeFn('table.sort', function* (a, vm): EvalGen {
        const t = a[0];
        const comp = a[1];
        if (!(t instanceof LuaTable)) return null;
        const items: LuaValue[] = [];
        const len = t.length();
        for (let i = 1; i <= len; i++) items.push(t.get(i));
        if (comp && typeof comp === 'object' && '__luaType' in comp && comp.__luaType === 'function') {
          // Simple bubble/insertion sort to support yielding if needed
          for (let i = 1; i < items.length; i++) {
            const key = items[i];
            let j = i - 1;
            while (j >= 0) {
              const res = yield* vm.callFunctionGen(comp, [key, items[j]]);
              const first = res instanceof LuaMultiValue ? res.first() : res;
              if (isTruthy(first)) {
                items[j + 1] = items[j];
                j--;
              } else {
                break;
              }
            }
            items[j + 1] = key;
          }
        } else {
          items.sort((x, y) => {
            if (typeof x === 'number' && typeof y === 'number') return x - y;
            return luaToString(x).localeCompare(luaToString(y));
          });
        }
        items.forEach((v, idx) => t.set(idx + 1, v));
        return null;
      })
    );
    tblLib.set(
      'clone',
      makeNativeFn('table.clone', (a) => {
        const t = a[0];
        if (!(t instanceof LuaTable)) return new LuaTable();
        const copy = new LuaTable();
        t.map.forEach((v, k) => copy.map.set(k, v));
        copy.metatable = t.metatable;
        return copy;
      })
    );
    tblLib.set(
      'clear',
      makeNativeFn('table.clear', (a) => {
        if (a[0] instanceof LuaTable) a[0].map.clear();
        return null;
      })
    );
    tblLib.set(
      'freeze',
      makeNativeFn('table.freeze', (a) => {
        if (a[0] instanceof LuaTable) a[0].frozen = true;
        return a[0] ?? null;
      })
    );
    tblLib.set('unpack', makeNativeFn('table.unpack', (a) => this.unpackTable(a[0], a[1], a[2])));
    g.define('table', tblLib);

    // os library
    const osTbl = new LuaTable();
    osTbl.set('clock', makeNativeFn('os.clock', () => (performance.now() - this.startTime) / 1000));
    osTbl.set('time', makeNativeFn('os.time', () => Math.floor(Date.now() / 1000)));
    g.define('os', osTbl);

    // task library
    const taskTbl = new LuaTable();
    taskTbl.set(
      'wait',
      makeNativeFn('task.wait', function* (a): EvalGen {
        const secs = Math.max(0.016, Number(a[0] ?? 0.016));
        const t0 = performance.now();
        yield { kind: 'wait', seconds: secs };
        return (performance.now() - t0) / 1000;
      })
    );
    taskTbl.set(
      'spawn',
      makeNativeFn('task.spawn', (a, vm, line) => {
        const fn = a[0];
        if (!fn || typeof fn !== 'object' || !('__luaType' in fn) || fn.__luaType !== 'function') {
          throw new LuaRuntimeError('task.spawn expects a function', line);
        }
        return vm.spawnThread(fn, a.slice(1));
      })
    );
    taskTbl.set(
      'defer',
      makeNativeFn('task.defer', (a, vm, line) => {
        const fn = a[0];
        if (!fn || typeof fn !== 'object' || !('__luaType' in fn) || fn.__luaType !== 'function') {
          throw new LuaRuntimeError('task.defer expects a function', line);
        }
        const thread: LuaThread = {
          __luaType: 'thread',
          id: ++vm.threadSeq,
          status: 'suspended',
          gen: null,
          cancelled: false,
        };
        const timerId = window.setTimeout(() => {
          vm.activeTimers.delete(timerId);
          if (!thread.cancelled && !vm.cancelled) {
            vm.runThreadWithArgs(thread, fn, a.slice(1));
          }
        }, 0);
        vm.activeTimers.add(timerId);
        return thread;
      })
    );
    taskTbl.set(
      'delay',
      makeNativeFn('task.delay', (a, vm, line) => {
        const secs = Math.max(0, Number(a[0] ?? 0));
        const fn = a[1];
        if (!fn || typeof fn !== 'object' || !('__luaType' in fn) || fn.__luaType !== 'function') {
          throw new LuaRuntimeError('task.delay expects a function as second argument', line);
        }
        const thread: LuaThread = {
          __luaType: 'thread',
          id: ++vm.threadSeq,
          status: 'suspended',
          gen: null,
          cancelled: false,
        };
        const timerId = window.setTimeout(() => {
          vm.activeTimers.delete(timerId);
          if (!thread.cancelled && !vm.cancelled) {
            vm.runThreadWithArgs(thread, fn, a.slice(2));
          }
        }, secs * 1000);
        vm.activeTimers.add(timerId);
        return thread;
      })
    );
    taskTbl.set(
      'cancel',
      makeNativeFn('task.cancel', (a) => {
        const thread = a[0];
        if (thread && typeof thread === 'object' && '__luaType' in thread && thread.__luaType === 'thread') {
          thread.cancelled = true;
          thread.status = 'dead';
        }
        return null;
      })
    );
    g.define('task', taskTbl);
    g.define('wait', taskTbl.get('wait'));

    // coroutine library
    const coTbl = new LuaTable();
    coTbl.set(
      'create',
      makeNativeFn('coroutine.create', (a, vm, line) => {
        const fn = a[0];
        if (!fn || typeof fn !== 'object' || !('__luaType' in fn) || fn.__luaType !== 'function') {
          throw new LuaRuntimeError('coroutine.create expects a function', line);
        }
        const thread: LuaThread = {
          __luaType: 'thread',
          id: ++vm.threadSeq,
          status: 'suspended',
          gen: null,
          cancelled: false,
        };
        // Wrap generator factory lazily when resumed first time
        thread.gen = (function* (initialArgs: LuaValue[]): EvalGen {
          return yield* vm.callFunctionGen(fn, initialArgs, line);
        })([]);
        // Actually we store a starter wrapper so first resume passes args
        let started = false;
        const starterGen = (function* (): EvalGen {
          const firstArgs = yield { kind: 'coroutine_yield', values: [] };
          started = true;
          return yield* vm.callFunctionGen(fn, firstArgs, line);
        })();
        starterGen.next(); // Prime to first yield so first coroutine.resume(co, ...) injects args!
        void started;
        thread.gen = starterGen;
        return thread;
      })
    );
    coTbl.set(
      'resume',
      makeNativeFn('coroutine.resume', (a) => {
        const thread = a[0];
        if (!thread || typeof thread !== 'object' || !('__luaType' in thread) || thread.__luaType !== 'thread') {
          return new LuaMultiValue([false, 'bad argument #1 to resume (thread expected)']);
        }
        if (thread.status === 'dead' || !thread.gen) {
          return new LuaMultiValue([false, 'cannot resume dead coroutine']);
        }
        try {
          thread.status = 'running';
          const step = thread.gen.next(a.slice(1));
          if (step.done) {
            thread.status = 'dead';
            const res = step.value;
            const list = res instanceof LuaMultiValue ? res.values : [res];
            return new LuaMultiValue([true, ...list]);
          }
          if (step.value.kind === 'coroutine_yield') {
            thread.status = 'suspended';
            return new LuaMultiValue([true, ...step.value.values]);
          }
          thread.status = 'suspended';
          return new LuaMultiValue([true]);
        } catch (err) {
          thread.status = 'dead';
          const msg = err instanceof Error ? err.message : String(err);
          return new LuaMultiValue([false, msg]);
        }
      })
    );
    coTbl.set(
      'yield',
      makeNativeFn('coroutine.yield', function* (a): EvalGen {
        const resumeArgs = yield { kind: 'coroutine_yield', values: a };
        return new LuaMultiValue(resumeArgs ?? []);
      })
    );
    coTbl.set(
      'status',
      makeNativeFn('coroutine.status', (a) => {
        const thread = a[0];
        if (thread && typeof thread === 'object' && '__luaType' in thread && thread.__luaType === 'thread') {
          return thread.status;
        }
        return 'dead';
      })
    );
    g.define('coroutine', coTbl);
  }

  private unpackTable(tbl: LuaValue | undefined, iVal: LuaValue | undefined, jVal: LuaValue | undefined): LuaMultiValue {
    if (!(tbl instanceof LuaTable)) return new LuaMultiValue([]);
    const start = typeof iVal === 'number' ? iVal : 1;
    const end = typeof jVal === 'number' ? jVal : tbl.length();
    const out: LuaValue[] = [];
    for (let i = start; i <= end; i++) {
      out.push(tbl.get(i));
    }
    return new LuaMultiValue(out);
  }

  runScript(source: string, env?: EnvScope): Promise<LuaValue[]> {
    let parsed: ParsedProgram;
    try {
      parsed = parseLuau(source);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks.onPrint(msg, 'error');
      return Promise.reject(err);
    }

    const scriptScope = env ?? new EnvScope(this.globalEnv);
    const thread: LuaThread = {
      __luaType: 'thread',
      id: ++this.threadSeq,
      status: 'running',
      gen: null,
      cancelled: false,
    };

    return new Promise<LuaValue[]>((resolve, reject) => {
      const gen = this.evalBlockTopLevel(parsed.body, scriptScope);
      thread.gen = gen;
      this.driveThread(thread, [], (vals, err) => {
        if (err) reject(err);
        else resolve(vals);
      });
    });
  }

  spawnThread(fn: LuaFunction, args: LuaValue[], onDone?: (vals: LuaValue[]) => void): LuaThread {
    const thread: LuaThread = {
      __luaType: 'thread',
      id: ++this.threadSeq,
      status: 'running',
      gen: null,
      cancelled: false,
      onComplete: onDone,
    };
    this.runThreadWithArgs(thread, fn, args);
    return thread;
  }

  private runThreadWithArgs(thread: LuaThread, fn: LuaFunction, args: LuaValue[]) {
    if (this.cancelled || thread.cancelled) return;
    const gen = this.callFunctionGen(fn, args);
    thread.gen = gen;
    thread.status = 'running';
    this.driveThread(thread, []);
  }

  private driveThread(
    thread: LuaThread,
    resumeInput: LuaValue[],
    doneCb?: (vals: LuaValue[], err?: unknown) => void
  ) {
    if (this.cancelled || thread.cancelled || !thread.gen) {
      thread.status = 'dead';
      doneCb?.([]);
      return;
    }

    this.opsInCurrentSlice = 0;

    try {
      let nextRes = thread.gen.next(resumeInput);
      while (!nextRes.done) {
        const req = nextRes.value;
        if (req.kind === 'wait') {
          thread.status = 'suspended';
          const timerId = window.setTimeout(() => {
            this.activeTimers.delete(timerId);
            if (!this.cancelled && !thread.cancelled) {
              this.driveThread(thread, [], doneCb);
            }
          }, req.seconds * 1000);
          this.activeTimers.add(timerId);
          return;
        }
        if (req.kind === 'await_promise') {
          thread.status = 'suspended';
          req.promise
            .then((vals) => {
              if (!this.cancelled && !thread.cancelled) {
                this.driveThread(thread, vals, doneCb);
              }
            })
            .catch((err) => {
              thread.status = 'dead';
              const msg = err instanceof Error ? err.message : String(err);
              this.callbacks.onPrint(msg, 'error');
              doneCb?.([], err);
            });
          return;
        }
        if (req.kind === 'coroutine_yield') {
          // Top-level task yielded via coroutine.yield without wrapper
          thread.status = 'suspended';
          return;
        }
        nextRes = thread.gen.next([]);
      }

      thread.status = 'dead';
      const val = nextRes.value;
      const results = val instanceof LuaMultiValue ? val.values : [val];
      thread.onComplete?.(results);
      doneCb?.(results);
    } catch (err) {
      thread.status = 'dead';
      if (!this.cancelled) {
        const msg = err instanceof LuaRuntimeError && err.line ? `Line ${err.line}: ${err.message}` : err instanceof Error ? err.message : String(err);
        this.callbacks.onPrint(msg, 'error');
      }
      doneCb?.([], err);
    }
  }

  private callFunctionSync(fn: LuaFunction, args: LuaValue[], line?: number): LuaValue {
    const gen = this.callFunctionGen(fn, args, line);
    const step = gen.next([]);
    if (step.done) {
      return step.value instanceof LuaMultiValue ? step.value.first() : step.value;
    }
    return null;
  }

  private *evalBlockTopLevel(stmts: Stmt[], env: EnvScope): EvalGen {
    try {
      yield* this.evalStmts(stmts, env);
      return null;
    } catch (err) {
      if (err instanceof ControlFlowSignal && err.kind === 'return') {
        return new LuaMultiValue(err.values);
      }
      throw err;
    }
  }

  private *evalStmts(stmts: Stmt[], env: EnvScope): EvalGen {
    for (const stmt of stmts) {
      this.bumpOps(stmt.line);
      switch (stmt.kind) {
        case 'TypeDecl':
          break;
        case 'Block': {
          const blockScope = new EnvScope(env);
          yield* this.evalStmts(stmt.body, blockScope);
          break;
        }
        case 'LocalDecl': {
          const evalVals = yield* this.evalExprList(stmt.values, env);
          stmt.names.forEach((decl, idx) => {
            env.define(decl.name, evalVals[idx] ?? null);
          });
          break;
        }
        case 'Assign': {
          const evalVals = yield* this.evalExprList(stmt.values, env);
          for (let i = 0; i < stmt.targets.length; i++) {
            yield* this.assignTarget(stmt.targets[i], evalVals[i] ?? null, env, stmt.line);
          }
          break;
        }
        case 'CompoundAssign': {
          const curVal = yield* this.evalLValue(stmt.target, env);
          const rhsVal = yield* this.evalSingle(stmt.value, env);
          const op = stmt.op.slice(0, -1); // += -> +, ..= -> ..
          const nextVal = yield* this.evalBinaryOp(op, curVal, rhsVal, stmt.line);
          yield* this.assignTarget(stmt.target, nextVal, env, stmt.line);
          break;
        }
        case 'ExprStmt': {
          yield* this.evalExpr(stmt.expr, env);
          break;
        }
        case 'IfStmt': {
          let matched = false;
          for (const br of stmt.branches) {
            const condVal = yield* this.evalSingle(br.cond, env);
            if (isTruthy(condVal)) {
              matched = true;
              const inner = new EnvScope(env);
              yield* this.evalStmts(br.body, inner);
              break;
            }
          }
          if (!matched && stmt.elseBody) {
            const inner = new EnvScope(env);
            yield* this.evalStmts(stmt.elseBody, inner);
          }
          break;
        }
        case 'WhileStmt': {
          while (isTruthy(yield* this.evalSingle(stmt.cond, env))) {
            this.bumpOps(stmt.line);
            const inner = new EnvScope(env);
            try {
              yield* this.evalStmts(stmt.body, inner);
            } catch (sig) {
              if (sig instanceof ControlFlowSignal) {
                if (sig.kind === 'break') break;
                if (sig.kind === 'continue') continue;
              }
              throw sig;
            }
          }
          break;
        }
        case 'RepeatStmt': {
          const inner = new EnvScope(env);
          do {
            this.bumpOps(stmt.line);
            try {
              yield* this.evalStmts(stmt.body, inner);
            } catch (sig) {
              if (sig instanceof ControlFlowSignal) {
                if (sig.kind === 'break') break;
                if (sig.kind === 'continue') continue;
              }
              throw sig;
            }
          } while (!isTruthy(yield* this.evalSingle(stmt.cond, inner)));
          break;
        }
        case 'NumericFor': {
          const startNum = Number(yield* this.evalSingle(stmt.start, env));
          const endNum = Number(yield* this.evalSingle(stmt.end, env));
          const stepNum = stmt.step ? Number(yield* this.evalSingle(stmt.step, env)) : 1;
          if (Number.isNaN(startNum) || Number.isNaN(endNum) || Number.isNaN(stepNum) || stepNum === 0) {
            throw new LuaRuntimeError('Invalid numeric for bounds', stmt.line);
          }
          for (
            let i = startNum;
            stepNum > 0 ? i <= endNum : i >= endNum;
            i += stepNum
          ) {
            this.bumpOps(stmt.line);
            const inner = new EnvScope(env);
            inner.define(stmt.varName, i);
            try {
              yield* this.evalStmts(stmt.body, inner);
            } catch (sig) {
              if (sig instanceof ControlFlowSignal) {
                if (sig.kind === 'break') break;
                if (sig.kind === 'continue') continue;
              }
              throw sig;
            }
          }
          break;
        }
        case 'GenericFor': {
          const iterVals = yield* this.evalExprList(stmt.iterators, env);
          let iterFn = iterVals[0];
          const stateObj = iterVals[1] ?? null;
          let controlVar = iterVals[2] ?? null;

          // Generalized table iteration in Luau (`for k, v in tbl do`)
          if (iterFn instanceof LuaTable) {
            const tbl = iterFn;
            const entries = Array.from(tbl.map.entries());
            let cursor = 0;
            iterFn = makeNativeFn('generalized_iter', () => {
              if (cursor >= entries.length) return null;
              const [k, v] = entries[cursor++];
              return new LuaMultiValue([k as LuaValue, v]);
            });
          }

          if (!iterFn || typeof iterFn !== 'object' || !('__luaType' in iterFn) || iterFn.__luaType !== 'function') {
            throw new LuaRuntimeError('attempt to iterate over a non-function / non-table value', stmt.line);
          }

          while (true) {
            this.bumpOps(stmt.line);
            const stepRes = yield* this.callFunctionGen(iterFn, [stateObj, controlVar], stmt.line);
            const stepList = stepRes instanceof LuaMultiValue ? stepRes.values : [stepRes];
            if (stepList.length === 0 || stepList[0] === null || stepList[0] === undefined) {
              break;
            }
            controlVar = stepList[0];
            const inner = new EnvScope(env);
            stmt.vars.forEach((vName, idx) => {
              inner.define(vName, stepList[idx] ?? null);
            });
            try {
              yield* this.evalStmts(stmt.body, inner);
            } catch (sig) {
              if (sig instanceof ControlFlowSignal) {
                if (sig.kind === 'break') break;
                if (sig.kind === 'continue') continue;
              }
              throw sig;
            }
          }
          break;
        }
        case 'FunctionDecl': {
          const params = stmt.isMethod ? [{ name: 'self' }, ...stmt.params] : stmt.params;
          const fn: LuaFunction = {
            __luaType: 'function',
            name: stmt.nameParts.join(stmt.isMethod ? ':' : '.'),
            isNative: false,
            params,
            hasVarargs: stmt.hasVarargs,
            body: stmt.body,
            closureEnv: env,
          };
          if (stmt.isLocal) {
            env.define(stmt.nameParts[0], fn);
          } else if (stmt.nameParts.length === 1) {
            if (!env.set(stmt.nameParts[0], fn)) {
              this.globalEnv.define(stmt.nameParts[0], fn);
            }
          } else {
            let targetObj: LuaValue = env.get(stmt.nameParts[0]);
            for (let i = 1; i < stmt.nameParts.length - 1; i++) {
              targetObj = yield* this.getMember(targetObj, stmt.nameParts[i], stmt.line);
            }
            yield* this.setMember(targetObj, stmt.nameParts[stmt.nameParts.length - 1], fn, stmt.line);
          }
          break;
        }
        case 'ReturnStmt': {
          const vals = yield* this.evalExprList(stmt.values, env);
          throw new ControlFlowSignal('return', vals);
        }
        case 'BreakStmt':
          throw new ControlFlowSignal('break');
        case 'ContinueStmt':
          throw new ControlFlowSignal('continue');
      }
    }
    return null;
  }

  private *evalExprList(exprs: Expr[], env: EnvScope): Generator<YieldRequest, LuaValue[], LuaValue[]> {
    const out: LuaValue[] = [];
    for (let i = 0; i < exprs.length; i++) {
      const res = yield* this.evalExpr(exprs[i], env);
      if (i === exprs.length - 1 && res instanceof LuaMultiValue) {
        out.push(...res.values);
      } else {
        out.push(res instanceof LuaMultiValue ? res.first() : res);
      }
    }
    return out;
  }

  private *evalSingle(expr: Expr, env: EnvScope): SingleGen {
    const res = yield* this.evalExpr(expr, env);
    return res instanceof LuaMultiValue ? res.first() : res;
  }

  private *evalLValue(lv: LValue, env: EnvScope): SingleGen {
    if (lv.kind === 'Var') return env.get(lv.name);
    if (lv.kind === 'Member') {
      const obj = yield* this.evalSingle(lv.object, env);
      return yield* this.getMember(obj, lv.property, lv.line);
    }
    const obj = yield* this.evalSingle(lv.object, env);
    const idx = yield* this.evalSingle(lv.index, env);
    return yield* this.getMember(obj, idx, lv.line);
  }

  private *assignTarget(lv: LValue, val: LuaValue, env: EnvScope, line: number): SingleGen {
    if (lv.kind === 'Var') {
      if (!env.set(lv.name, val)) {
        this.globalEnv.define(lv.name, val);
      }
      return null;
    }
    if (lv.kind === 'Member') {
      const obj = yield* this.evalSingle(lv.object, env);
      yield* this.setMember(obj, lv.property, val, line);
      return null;
    }
    const obj = yield* this.evalSingle(lv.object, env);
    const idx = yield* this.evalSingle(lv.index, env);
    yield* this.setMember(obj, idx, val, line);
    return null;
  }

  private *evalExpr(expr: Expr, env: EnvScope): EvalGen {
    this.bumpOps(expr.line);
    switch (expr.kind) {
      case 'Nil':
        return null;
      case 'Bool':
        return expr.value;
      case 'Number':
        return expr.value;
      case 'String':
        return expr.value;
      case 'Varargs': {
        const va = env.get('...');
        return va instanceof LuaTable
          ? this.unpackTable(va, 1, va.length())
          : new LuaMultiValue([]);
      }
      case 'Var':
        return env.get(expr.name);
      case 'TypeCast':
        return yield* this.evalExpr(expr.expr, env);
      case 'InterpolatedString': {
        let result = expr.parts[0] ?? '';
        for (let i = 0; i < expr.exprs.length; i++) {
          const val = yield* this.evalSingle(expr.exprs[i], env);
          result += luaToString(val) + (expr.parts[i + 1] ?? '');
        }
        return result;
      }
      case 'IfExpr': {
        const cond = yield* this.evalSingle(expr.cond, env);
        if (isTruthy(cond)) return yield* this.evalSingle(expr.thenExpr, env);
        for (const eif of expr.elseIfs) {
          if (isTruthy(yield* this.evalSingle(eif.cond, env))) {
            return yield* this.evalSingle(eif.expr, env);
          }
        }
        return yield* this.evalSingle(expr.elseExpr, env);
      }
      case 'FunctionExpr':
        return {
          __luaType: 'function',
          name: 'anonymous',
          isNative: false,
          params: expr.params,
          hasVarargs: expr.hasVarargs,
          body: expr.body,
          closureEnv: env,
        };
      case 'Table': {
        const tbl = new LuaTable();
        let nextArrayIdx = 1;
        for (let i = 0; i < expr.entries.length; i++) {
          const entry = expr.entries[i];
          if (entry.key) {
            const k = yield* this.evalSingle(entry.key, env);
            const v = yield* this.evalSingle(entry.value, env);
            tbl.set(k, v);
          } else if (i === expr.entries.length - 1) {
            const raw = yield* this.evalExpr(entry.value, env);
            if (raw instanceof LuaMultiValue) {
              for (const mv of raw.values) {
                tbl.set(nextArrayIdx++, mv);
              }
            } else {
              tbl.set(nextArrayIdx++, raw);
            }
          } else {
            const v = yield* this.evalSingle(entry.value, env);
            tbl.set(nextArrayIdx++, v);
          }
        }
        return tbl;
      }
      case 'Unary': {
        const val = yield* this.evalSingle(expr.arg, env);
        if (expr.op === 'not') return !isTruthy(val);
        if (expr.op === '-') {
          if (typeof val === 'number') return -val;
          if (val && typeof val === 'object' && '__luaType' in val && val.__luaType === 'userdata' && val.callOp) {
            return val.callOp('unm', null, true);
          }
          throw new LuaRuntimeError(`attempt to perform arithmetic (unm) on ${luaTypeOf(val)}`, expr.line);
        }
        if (expr.op === '#') {
          if (typeof val === 'string') return val.length;
          if (val instanceof LuaTable) {
            if (val.metatable) {
              const lenMeta = val.metatable.get('__len');
              if (lenMeta && typeof lenMeta === 'object' && '__luaType' in lenMeta && lenMeta.__luaType === 'function') {
                return yield* this.callFunctionGen(lenMeta, [val], expr.line);
              }
            }
            return val.length();
          }
          throw new LuaRuntimeError(`attempt to get length of ${luaTypeOf(val)}`, expr.line);
        }
        return null;
      }
      case 'Binary': {
        if (expr.op === 'and') {
          const left = yield* this.evalSingle(expr.left, env);
          return isTruthy(left) ? yield* this.evalSingle(expr.right, env) : left;
        }
        if (expr.op === 'or') {
          const left = yield* this.evalSingle(expr.left, env);
          return isTruthy(left) ? left : yield* this.evalSingle(expr.right, env);
        }
        const left = yield* this.evalSingle(expr.left, env);
        const right = yield* this.evalSingle(expr.right, env);
        return yield* this.evalBinaryOp(expr.op, left, right, expr.line);
      }
      case 'Member': {
        const obj = yield* this.evalSingle(expr.object, env);
        return yield* this.getMember(obj, expr.property, expr.line);
      }
      case 'Index': {
        const obj = yield* this.evalSingle(expr.object, env);
        const idx = yield* this.evalSingle(expr.index, env);
        return yield* this.getMember(obj, idx, expr.line);
      }
      case 'Call': {
        const callee = yield* this.evalSingle(expr.callee, env);
        const args = yield* this.evalExprList(expr.args, env);
        return yield* this.callAny(callee, args, expr.line);
      }
      case 'MethodCall': {
        const obj = yield* this.evalSingle(expr.object, env);
        const methodFn = yield* this.getMember(obj, expr.method, expr.line);
        const args = yield* this.evalExprList(expr.args, env);
        return yield* this.callAny(methodFn, [obj, ...args], expr.line);
      }
    }
  }

  private *evalBinaryOp(op: string, left: LuaValue, right: LuaValue, line: number): SingleGen {
    if (op === '..') {
      return luaToString(left) + luaToString(right);
    }
    if (op === '==') {
      if (left === right) return true;
      if (left instanceof LuaTable && right instanceof LuaTable && left.metatable) {
        const eq = left.metatable.get('__eq');
        if (eq && typeof eq === 'object' && '__luaType' in eq && eq.__luaType === 'function') {
          const eqRes = yield* this.callFunctionGen(eq, [left, right], line);
          return isTruthy(eqRes instanceof LuaMultiValue ? eqRes.first() : eqRes);
        }
      }
      if (
        left &&
        right &&
        typeof left === 'object' &&
        typeof right === 'object' &&
        '__luaType' in left &&
        '__luaType' in right &&
        left.__luaType === 'userdata' &&
        right.__luaType === 'userdata' &&
        left.callOp
      ) {
        return left.callOp('==', right, true);
      }
      return false;
    }
    if (op === '~=') {
      return !(yield* this.evalBinaryOp('==', left, right, line));
    }
    if (['<', '>', '<=', '>='].includes(op)) {
      if (typeof left === 'number' && typeof right === 'number') {
        if (op === '<') return left < right;
        if (op === '>') return left > right;
        if (op === '<=') return left <= right;
        return left >= right;
      }
      if (typeof left === 'string' && typeof right === 'string') {
        if (op === '<') return left < right;
        if (op === '>') return left > right;
        if (op === '<=') return left <= right;
        return left >= right;
      }
      throw new LuaRuntimeError(`attempt to compare ${luaTypeOf(left)} with ${luaTypeOf(right)}`, line);
    }

    if (typeof left === 'number' && typeof right === 'number') {
      switch (op) {
        case '+':
          return left + right;
        case '-':
          return left - right;
        case '*':
          return left * right;
        case '/':
          return left / right;
        case '//':
          return Math.floor(left / right);
        case '%':
          return ((left % right) + right) % right;
        case '^':
          return Math.pow(left, right);
      }
    }

    // Userdata arithmetic (Vector3, CFrame)
    if (left && typeof left === 'object' && '__luaType' in left && left.__luaType === 'userdata' && left.callOp) {
      return left.callOp(op, right, true);
    }
    if (right && typeof right === 'object' && '__luaType' in right && right.__luaType === 'userdata' && right.callOp) {
      return right.callOp(op, left, false);
    }

    // Table metamethods (__add, __sub, __mul, __div)
    const metaKeyMap: Record<string, string> = {
      '+': '__add',
      '-': '__sub',
      '*': '__mul',
      '/': '__div',
    };
    const metaKey = metaKeyMap[op];
    if (metaKey) {
      const mt = (left instanceof LuaTable && left.metatable) || (right instanceof LuaTable && right.metatable) || null;
      if (mt) {
        const metaFn = mt.get(metaKey);
        if (metaFn && typeof metaFn === 'object' && '__luaType' in metaFn && metaFn.__luaType === 'function') {
          const metaRes = yield* this.callFunctionGen(metaFn, [left, right], line);
          return metaRes instanceof LuaMultiValue ? metaRes.first() : metaRes;
        }
      }
    }

    throw new LuaRuntimeError(`attempt to perform arithmetic (${op}) on ${luaTypeOf(left)} and ${luaTypeOf(right)}`, line);
  }

  private *getMember(obj: LuaValue, key: LuaValue, line: number): SingleGen {
    if (obj === null || obj === undefined) {
      throw new LuaRuntimeError(`attempt to index nil with '${luaToString(key)}'`, line);
    }
    if (typeof obj === 'string') {
      const strLib = this.globalEnv.get('string');
      if (strLib instanceof LuaTable && typeof key === 'string') {
        const fn = strLib.get(key);
        if (fn) return fn;
      }
    }
    if (obj instanceof LuaTable) {
      const direct = obj.get(key);
      if (direct !== null) return direct;
      if (obj.metatable) {
        const indexMeta = obj.metatable.get('__index');
        if (indexMeta instanceof LuaTable) {
          return yield* this.getMember(indexMeta, key, line);
        }
        if (indexMeta && typeof indexMeta === 'object' && '__luaType' in indexMeta && indexMeta.__luaType === 'function') {
          const res = yield* this.callFunctionGen(indexMeta, [obj, key], line);
          return res instanceof LuaMultiValue ? res.first() : res;
        }
      }
      return null;
    }
    if (typeof obj === 'object' && '__luaType' in obj && obj.__luaType === 'userdata' && obj.getProp) {
      return obj.getProp(luaToString(key));
    }
    throw new LuaRuntimeError(`attempt to index ${luaTypeOf(obj)} with '${luaToString(key)}'`, line);
  }

  private *setMember(obj: LuaValue, key: LuaValue, val: LuaValue, line: number): SingleGen {
    if (obj === null || obj === undefined) {
      throw new LuaRuntimeError(`attempt to index nil with '${luaToString(key)}'`, line);
    }
    if (obj instanceof LuaTable) {
      if (!obj.map.has(key as string | number | boolean | object) && obj.metatable) {
        const newIdx = obj.metatable.get('__newindex');
        if (newIdx && typeof newIdx === 'object' && '__luaType' in newIdx && newIdx.__luaType === 'function') {
          yield* this.callFunctionGen(newIdx, [obj, key, val], line);
          return null;
        }
        if (newIdx instanceof LuaTable) {
          yield* this.setMember(newIdx, key, val, line);
          return null;
        }
      }
      obj.set(key, val);
      return null;
    }
    if (typeof obj === 'object' && '__luaType' in obj && obj.__luaType === 'userdata' && obj.setProp) {
      obj.setProp(luaToString(key), val);
      return null;
    }
    throw new LuaRuntimeError(`attempt to set property '${luaToString(key)}' on ${luaTypeOf(obj)}`, line);
  }

  private *callAny(callee: LuaValue, args: LuaValue[], line: number): EvalGen {
    if (callee && typeof callee === 'object' && '__luaType' in callee && callee.__luaType === 'function') {
      return yield* this.callFunctionGen(callee, args, line);
    }
    if (callee instanceof LuaTable && callee.metatable) {
      const callMeta = callee.metatable.get('__call');
      if (callMeta && typeof callMeta === 'object' && '__luaType' in callMeta && callMeta.__luaType === 'function') {
        return yield* this.callFunctionGen(callMeta, [callee, ...args], line);
      }
    }
    throw new LuaRuntimeError(`attempt to call a ${luaTypeOf(callee)} value`, line);
  }

  *callFunctionGen(fn: LuaFunction, args: LuaValue[], line?: number): EvalGen {
    this.bumpOps(line);
    if (fn.isNative && fn.nativeFn) {
      const res = fn.nativeFn(args, this, line ?? 0);
      if (res && typeof res === 'object' && Symbol.iterator in (res as object)) {
        return yield* res as EvalGen;
      }
      return (res as LuaValue | LuaMultiValue) ?? null;
    }

    const fnScope = new EnvScope(fn.closureEnv ?? this.globalEnv);
    const params = fn.params ?? [];
    params.forEach((p, idx) => {
      fnScope.define(p.name, args[idx] ?? null);
    });
    if (fn.hasVarargs) {
      const va = new LuaTable();
      args.slice(params.length).forEach((v, idx) => va.set(idx + 1, v));
      fnScope.define('...', va);
    }

    try {
      yield* this.evalStmts(fn.body ?? [], fnScope);
      return null;
    } catch (sig) {
      if (sig instanceof ControlFlowSignal && sig.kind === 'return') {
        return new LuaMultiValue(sig.values);
      }
      throw sig;
    }
  }
}
