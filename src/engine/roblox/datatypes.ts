import { LuaRuntimeError, LuaTable, LuaUserdata, LuaValue, makeNativeFn } from '../luau/interpreter';

export interface Vec3Data {
  x: number;
  y: number;
  z: number;
}

export interface CFrameData {
  x: number;
  y: number;
  z: number;
  // Euler XYZ in radians for clean Three.js & LookVector interop
  rx: number;
  ry: number;
  rz: number;
  // Orthonormal basis columns
  right: Vec3Data;
  up: Vec3Data;
  back: Vec3Data; // -LookVector
}

export interface Color3Data {
  r: number; // 0..1
  g: number;
  b: number;
}

export interface UDim2Data {
  xScale: number;
  xOffset: number;
  yScale: number;
  yOffset: number;
}

export interface TweenInfoData {
  time: number;
  easingStyle: string;
  easingDirection: string;
  repeatCount: number;
  reverses: boolean;
  delayTime: number;
}

export interface RaycastParamsData {
  filterType: 'Exclude' | 'Include';
  filterInstances: unknown[];
  ignoreWater: boolean;
}

function basisFromEulerXYZ(rx: number, ry: number, rz: number): { right: Vec3Data; up: Vec3Data; back: Vec3Data } {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);

  // Rotation matrix R = Rx * Ry * Rz
  const m00 = cy * cz;
  const m01 = -cy * sz;
  const m02 = sy;

  const m10 = sx * sy * cz + cx * sz;
  const m11 = -sx * sy * sz + cx * cz;
  const m12 = -sx * cy;

  const m20 = -cx * sy * cz + sx * sz;
  const m21 = cx * sy * sz + sx * cz;
  const m22 = cx * cy;

  return {
    right: { x: m00, y: m10, z: m20 },
    up: { x: m01, y: m11, z: m21 },
    back: { x: m02, y: m12, z: m22 },
  };
}

function eulerFromBasis(right: Vec3Data, up: Vec3Data, back: Vec3Data): { rx: number; ry: number; rz: number } {
  const sy = Math.max(-1, Math.min(1, back.x));
  const ry = Math.asin(sy);
  let rx = 0;
  let rz = 0;
  if (Math.abs(sy) < 0.99999) {
    rx = Math.atan2(-back.y, back.z);
    rz = Math.atan2(-up.x, right.x);
  } else {
    rx = Math.atan2(right.y, up.y);
    rz = 0;
  }
  return { rx, ry, rz };
}

function rotateVecByBasis(v: Vec3Data, b: { right: Vec3Data; up: Vec3Data; back: Vec3Data }): Vec3Data {
  return {
    x: b.right.x * v.x + b.up.x * v.y + b.back.x * v.z,
    y: b.right.y * v.x + b.up.y * v.y + b.back.y * v.z,
    z: b.right.z * v.x + b.up.z * v.y + b.back.z * v.z,
  };
}

export function createVector3(x = 0, y = 0, z = 0): LuaUserdata {
  const data: Vec3Data = { x, y, z };
  const ud: LuaUserdata = {
    __luaType: 'userdata',
    className: 'Vector3',
    data,
    toString: () => `${data.x.toFixed(2)}, ${data.y.toFixed(2)}, ${data.z.toFixed(2)}`,
    getProp: (key: string) => {
      if (key === 'X' || key === 'x') return data.x;
      if (key === 'Y' || key === 'y') return data.y;
      if (key === 'Z' || key === 'z') return data.z;
      if (key === 'Magnitude') return Math.hypot(data.x, data.y, data.z);
      if (key === 'Unit') {
        const len = Math.hypot(data.x, data.y, data.z);
        return len > 1e-6 ? createVector3(data.x / len, data.y / len, data.z / len) : createVector3(0, 0, 0);
      }
      if (key === 'Dot') {
        return makeNativeFn('Vector3:Dot', (args) => {
          const other = extractVec3(args[1]);
          return data.x * other.x + data.y * other.y + data.z * other.z;
        });
      }
      if (key === 'Cross') {
        return makeNativeFn('Vector3:Cross', (args) => {
          const b = extractVec3(args[1]);
          return createVector3(
            data.y * b.z - data.z * b.y,
            data.z * b.x - data.x * b.z,
            data.x * b.y - data.y * b.x
          );
        });
      }
      if (key === 'Lerp') {
        return makeNativeFn('Vector3:Lerp', (args) => {
          const b = extractVec3(args[1]);
          const alpha = Number(args[2] ?? 0);
          return createVector3(
            data.x + (b.x - data.x) * alpha,
            data.y + (b.y - data.y) * alpha,
            data.z + (b.z - data.z) * alpha
          );
        });
      }
      return null;
    },
    callOp: (op, other, selfLeft) => {
      if (op === 'unm') return createVector3(-data.x, -data.y, -data.z);
      if (op === '==') {
        if (other && typeof other === 'object' && '__luaType' in other && other.__luaType === 'userdata' && other.className === 'Vector3') {
          const o = other.data as Vec3Data;
          return Math.abs(data.x - o.x) < 1e-5 && Math.abs(data.y - o.y) < 1e-5 && Math.abs(data.z - o.z) < 1e-5;
        }
        return false;
      }
      if (typeof other === 'number') {
        if (op === '*') return createVector3(data.x * other, data.y * other, data.z * other);
        if (op === '/') {
          if (!selfLeft) throw new LuaRuntimeError('Cannot divide number by Vector3');
          return createVector3(data.x / other, data.y / other, data.z / other);
        }
      }
      const o = extractVec3(other);
      if (op === '+') return createVector3(data.x + o.x, data.y + o.y, data.z + o.z);
      if (op === '-') return selfLeft ? createVector3(data.x - o.x, data.y - o.y, data.z - o.z) : createVector3(o.x - data.x, o.y - data.y, o.z - data.z);
      if (op === '*') return createVector3(data.x * o.x, data.y * o.y, data.z * o.z);
      if (op === '/') return createVector3(data.x / o.x, data.y / o.y, data.z / o.z);
      throw new LuaRuntimeError(`Unsupported Vector3 operation '${op}'`);
    },
  };
  return ud;
}

export function extractVec3(val: LuaValue | undefined): Vec3Data {
  if (val && typeof val === 'object' && '__luaType' in val && val.__luaType === 'userdata' && val.className === 'Vector3') {
    return val.data as Vec3Data;
  }
  throw new LuaRuntimeError('Expected Vector3');
}

export function createCFrame(
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  customBasis?: { right: Vec3Data; up: Vec3Data; back: Vec3Data }
): LuaUserdata {
  const basis = customBasis ?? basisFromEulerXYZ(rx, ry, rz);
  const euler = customBasis ? eulerFromBasis(basis.right, basis.up, basis.back) : { rx, ry, rz };
  const data: CFrameData = {
    x,
    y,
    z,
    rx: euler.rx,
    ry: euler.ry,
    rz: euler.rz,
    right: basis.right,
    up: basis.up,
    back: basis.back,
  };

  const ud: LuaUserdata = {
    __luaType: 'userdata',
    className: 'CFrame',
    data,
    toString: () => `${data.x.toFixed(2)}, ${data.y.toFixed(2)}, ${data.z.toFixed(2)}`,
    getProp: (key) => {
      if (key === 'Position' || key === 'p') return createVector3(data.x, data.y, data.z);
      if (key === 'X') return data.x;
      if (key === 'Y') return data.y;
      if (key === 'Z') return data.z;
      if (key === 'LookVector') return createVector3(-data.back.x, -data.back.y, -data.back.z);
      if (key === 'RightVector') return createVector3(data.right.x, data.right.y, data.right.z);
      if (key === 'UpVector') return createVector3(data.up.x, data.up.y, data.up.z);
      if (key === 'ToEulerAnglesXYZ') {
        return makeNativeFn('CFrame:ToEulerAnglesXYZ', () => [data.rx, data.ry, data.rz] as unknown as LuaValue);
      }
      if (key === 'Inverse') {
        return makeNativeFn('CFrame:Inverse', () => {
          const invRight = { x: data.right.x, y: data.up.x, z: data.back.x };
          const invUp = { x: data.right.y, y: data.up.y, z: data.back.y };
          const invBack = { x: data.right.z, y: data.up.z, z: data.back.z };
          const p = { x: -data.x, y: -data.y, z: -data.z };
          const tp = rotateVecByBasis(p, { right: invRight, up: invUp, back: invBack });
          return createCFrame(tp.x, tp.y, tp.z, 0, 0, 0, { right: invRight, up: invUp, back: invBack });
        });
      }
      if (key === 'Lerp') {
        return makeNativeFn('CFrame:Lerp', (args) => {
          const goal = extractCFrame(args[1]);
          const alpha = Number(args[2] ?? 0);
          return createCFrame(
            data.x + (goal.x - data.x) * alpha,
            data.y + (goal.y - data.y) * alpha,
            data.z + (goal.z - data.z) * alpha,
            data.rx + (goal.rx - data.rx) * alpha,
            data.ry + (goal.ry - data.ry) * alpha,
            data.rz + (goal.rz - data.rz) * alpha
          );
        });
      }
      return null;
    },
    callOp: (op, other, selfLeft) => {
      if (op === '+' && other && typeof other === 'object' && '__luaType' in other && other.__luaType === 'userdata' && other.className === 'Vector3') {
        const v = other.data as Vec3Data;
        return createCFrame(data.x + v.x, data.y + v.y, data.z + v.z, data.rx, data.ry, data.rz, {
          right: data.right,
          up: data.up,
          back: data.back,
        });
      }
      if (op === '-' && other && typeof other === 'object' && '__luaType' in other && other.__luaType === 'userdata' && other.className === 'Vector3') {
        const v = other.data as Vec3Data;
        return createCFrame(data.x - v.x, data.y - v.y, data.z - v.z, data.rx, data.ry, data.rz, {
          right: data.right,
          up: data.up,
          back: data.back,
        });
      }
      if (op === '*' && selfLeft && other && typeof other === 'object' && '__luaType' in other && other.__luaType === 'userdata') {
        if (other.className === 'Vector3') {
          const v = other.data as Vec3Data;
          const r = rotateVecByBasis(v, { right: data.right, up: data.up, back: data.back });
          return createVector3(data.x + r.x, data.y + r.y, data.z + r.z);
        }
        if (other.className === 'CFrame') {
          const b = other.data as CFrameData;
          const trans = rotateVecByBasis({ x: b.x, y: b.y, z: b.z }, { right: data.right, up: data.up, back: data.back });
          const newRight = rotateVecByBasis(b.right, { right: data.right, up: data.up, back: data.back });
          const newUp = rotateVecByBasis(b.up, { right: data.right, up: data.up, back: data.back });
          const newBack = rotateVecByBasis(b.back, { right: data.right, up: data.up, back: data.back });
          return createCFrame(data.x + trans.x, data.y + trans.y, data.z + trans.z, 0, 0, 0, {
            right: newRight,
            up: newUp,
            back: newBack,
          });
        }
      }
      throw new LuaRuntimeError(`Unsupported CFrame operation '${op}'`);
    },
  };
  return ud;
}

export function extractCFrame(val: LuaValue | undefined): CFrameData {
  if (val && typeof val === 'object' && '__luaType' in val && val.__luaType === 'userdata' && val.className === 'CFrame') {
    return val.data as CFrameData;
  }
  throw new LuaRuntimeError('Expected CFrame');
}

export function createColor3(r = 1, g = 1, b = 1): LuaUserdata {
  const data: Color3Data = {
    r: Math.max(0, Math.min(1, r)),
    g: Math.max(0, Math.min(1, g)),
    b: Math.max(0, Math.min(1, b)),
  };
  return {
    __luaType: 'userdata',
    className: 'Color3',
    data,
    toString: () => `${Math.round(data.r * 255)}, ${Math.round(data.g * 255)}, ${Math.round(data.b * 255)}`,
    getProp: (key) => {
      if (key === 'R') return data.r;
      if (key === 'G') return data.g;
      if (key === 'B') return data.b;
      if (key === 'Lerp') {
        return makeNativeFn('Color3:Lerp', (args) => {
          const goal = extractColor3(args[1]);
          const a = Number(args[2] ?? 0);
          return createColor3(
            data.r + (goal.r - data.r) * a,
            data.g + (goal.g - data.g) * a,
            data.b + (goal.b - data.b) * a
          );
        });
      }
      if (key === 'ToHex') {
        return makeNativeFn('Color3:ToHex', () => color3ToHex(data).replace('#', ''));
      }
      return null;
    },
  };
}

export function extractColor3(val: LuaValue | undefined): Color3Data {
  if (val && typeof val === 'object' && '__luaType' in val && val.__luaType === 'userdata' && val.className === 'Color3') {
    return val.data as Color3Data;
  }
  if (val && typeof val === 'object' && '__luaType' in val && val.__luaType === 'userdata' && val.className === 'BrickColor') {
    return (val.data as { color: Color3Data }).color;
  }
  throw new LuaRuntimeError('Expected Color3');
}

export function color3ToHex(c: Color3Data): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(1, n)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}`;
}

const BRICK_COLORS: Record<string, [number, number, number]> = {
  'Bright red': [196, 40, 28],
  'Bright blue': [13, 105, 172],
  'Bright green': [75, 151, 75],
  'Bright yellow': [245, 205, 48],
  'Really red': [255, 0, 0],
  'Lime green': [0, 255, 0],
  'Electric blue': [9, 137, 207],
  'Institutional white': [248, 248, 248],
  'Really black': [17, 17, 17],
  'Medium stone grey': [163, 162, 165],
  'Dark stone grey': [99, 95, 98],
  'Gold': [239, 184, 56],
  'Cyan': [4, 175, 236],
  'Magenta': [170, 0, 170],
  'Deep orange': [255, 176, 0],
};

export function createBrickColor(name = 'Medium stone grey'): LuaUserdata {
  const rgb = BRICK_COLORS[name] ?? [163, 162, 165];
  const color: Color3Data = { r: rgb[0] / 255, g: rgb[1] / 255, b: rgb[2] / 255 };
  return {
    __luaType: 'userdata',
    className: 'BrickColor',
    data: { name, color },
    toString: () => name,
    getProp: (key) => {
      if (key === 'Name') return name;
      if (key === 'Color') return createColor3(color.r, color.g, color.b);
      return null;
    },
  };
}

export function createUDim2(xScale = 0, xOffset = 0, yScale = 0, yOffset = 0): LuaUserdata {
  const data: UDim2Data = { xScale, xOffset, yScale, yOffset };
  return {
    __luaType: 'userdata',
    className: 'UDim2',
    data,
    toString: () => `{${data.xScale}, ${data.xOffset}}, {${data.yScale}, ${data.yOffset}}`,
    getProp: (key) => {
      if (key === 'X') return createUDim(data.xScale, data.xOffset);
      if (key === 'Y') return createUDim(data.yScale, data.yOffset);
      return null;
    },
  };
}

function createUDim(scale: number, offset: number): LuaUserdata {
  return {
    __luaType: 'userdata',
    className: 'UDim',
    data: { scale, offset },
    getProp: (k) => (k === 'Scale' ? scale : k === 'Offset' ? offset : null),
  };
}

export function createTweenInfo(
  time = 1,
  easingStyle = 'Quad',
  easingDirection = 'Out',
  repeatCount = 0,
  reverses = false,
  delayTime = 0
): LuaUserdata {
  const data: TweenInfoData = { time, easingStyle, easingDirection, repeatCount, reverses, delayTime };
  return {
    __luaType: 'userdata',
    className: 'TweenInfo',
    data,
    getProp: (key) => {
      if (key === 'Time') return data.time;
      if (key === 'EasingStyle') return data.easingStyle;
      if (key === 'EasingDirection') return data.easingDirection;
      if (key === 'RepeatCount') return data.repeatCount;
      if (key === 'Reverses') return data.reverses;
      if (key === 'DelayTime') return data.delayTime;
      return null;
    },
  };
}

export function createRaycastParams(): LuaUserdata {
  const data: RaycastParamsData = {
    filterType: 'Exclude',
    filterInstances: [],
    ignoreWater: true,
  };
  return {
    __luaType: 'userdata',
    className: 'RaycastParams',
    data,
    getProp: (key) => {
      if (key === 'FilterType') return data.filterType;
      if (key === 'IgnoreWater') return data.ignoreWater;
      if (key === 'FilterDescendantsInstances') {
        const t = new LuaTable();
        data.filterInstances.forEach((inst, i) => t.set(i + 1, inst as LuaValue));
        return t;
      }
      return null;
    },
    setProp: (key, val) => {
      if (key === 'FilterType') {
        const s = String(val);
        data.filterType = s.includes('Include') ? 'Include' : 'Exclude';
      } else if (key === 'IgnoreWater') {
        data.ignoreWater = Boolean(val);
      } else if (key === 'FilterDescendantsInstances' && val instanceof LuaTable) {
        const arr: unknown[] = [];
        const len = val.length();
        for (let i = 1; i <= len; i++) arr.push(val.get(i));
        data.filterInstances = arr;
      }
    },
  };
}

export function createRobloxGlobals(): Record<string, LuaValue> {
  const Vector3Lib = new LuaTable();
  Vector3Lib.set('new', makeNativeFn('Vector3.new', (a) => createVector3(Number(a[0] ?? 0), Number(a[1] ?? 0), Number(a[2] ?? 0))));
  Vector3Lib.set('zero', createVector3(0, 0, 0));
  Vector3Lib.set('one', createVector3(1, 1, 1));

  const CFrameLib = new LuaTable();
  CFrameLib.set(
    'new',
    makeNativeFn('CFrame.new', (a) => {
      if (a.length >= 2 && a[0] && typeof a[0] === 'object' && '__luaType' in a[0] && a[0].__luaType === 'userdata') {
        const pos = extractVec3(a[0]);
        const lookAt = extractVec3(a[1]);
        return lookAtCFrame(pos, lookAt);
      }
      return createCFrame(Number(a[0] ?? 0), Number(a[1] ?? 0), Number(a[2] ?? 0));
    })
  );
  CFrameLib.set(
    'Angles',
    makeNativeFn('CFrame.Angles', (a) => createCFrame(0, 0, 0, Number(a[0] ?? 0), Number(a[1] ?? 0), Number(a[2] ?? 0)))
  );
  CFrameLib.set(
    'fromEulerAnglesXYZ',
    makeNativeFn('CFrame.fromEulerAnglesXYZ', (a) => createCFrame(0, 0, 0, Number(a[0] ?? 0), Number(a[1] ?? 0), Number(a[2] ?? 0)))
  );
  CFrameLib.set(
    'lookAt',
    makeNativeFn('CFrame.lookAt', (a) => {
      const at = extractVec3(a[0]);
      const target = extractVec3(a[1]);
      return lookAtCFrame(at, target);
    })
  );

  const Color3Lib = new LuaTable();
  Color3Lib.set('new', makeNativeFn('Color3.new', (a) => createColor3(Number(a[0] ?? 0), Number(a[1] ?? 0), Number(a[2] ?? 0))));
  Color3Lib.set(
    'fromRGB',
    makeNativeFn('Color3.fromRGB', (a) => createColor3(Number(a[0] ?? 0) / 255, Number(a[1] ?? 0) / 255, Number(a[2] ?? 0) / 255))
  );
  Color3Lib.set(
    'fromHSV',
    makeNativeFn('Color3.fromHSV', (a) => {
      const h = ((Number(a[0] ?? 0) % 1) + 1) % 1;
      const s = Math.max(0, Math.min(1, Number(a[1] ?? 1)));
      const v = Math.max(0, Math.min(1, Number(a[2] ?? 1)));
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);
      const mod = i % 6;
      const [r, g, b] =
        mod === 0 ? [v, t, p] :
        mod === 1 ? [q, v, p] :
        mod === 2 ? [p, v, t] :
        mod === 3 ? [p, q, v] :
        mod === 4 ? [t, p, v] : [v, p, q];
      return createColor3(r, g, b);
    })
  );
  Color3Lib.set(
    'fromHex',
    makeNativeFn('Color3.fromHex', (a) => {
      const hex = String(a[0] ?? '#FFFFFF').replace('#', '');
      const n = parseInt(hex, 16);
      if (Number.isNaN(n)) return createColor3(1, 1, 1);
      return createColor3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
    })
  );

  const BrickColorLib = new LuaTable();
  BrickColorLib.set('new', makeNativeFn('BrickColor.new', (a) => createBrickColor(String(a[0] ?? 'Medium stone grey'))));
  BrickColorLib.set(
    'Random',
    makeNativeFn('BrickColor.Random', () => {
      const names = Object.keys(BRICK_COLORS);
      return createBrickColor(names[Math.floor(Math.random() * names.length)]);
    })
  );

  const UDim2Lib = new LuaTable();
  UDim2Lib.set('new', makeNativeFn('UDim2.new', (a) => createUDim2(Number(a[0] ?? 0), Number(a[1] ?? 0), Number(a[2] ?? 0), Number(a[3] ?? 0))));
  UDim2Lib.set('fromScale', makeNativeFn('UDim2.fromScale', (a) => createUDim2(Number(a[0] ?? 0), 0, Number(a[1] ?? 0), 0)));
  UDim2Lib.set('fromOffset', makeNativeFn('UDim2.fromOffset', (a) => createUDim2(0, Number(a[0] ?? 0), 0, Number(a[1] ?? 0))));

  const TweenInfoLib = new LuaTable();
  TweenInfoLib.set(
    'new',
    makeNativeFn('TweenInfo.new', (a) =>
      createTweenInfo(
        Number(a[0] ?? 1),
        String(a[1] ?? 'Quad'),
        String(a[2] ?? 'Out'),
        Number(a[3] ?? 0),
        Boolean(a[4] ?? false),
        Number(a[5] ?? 0)
      )
    )
  );

  const RaycastParamsLib = new LuaTable();
  RaycastParamsLib.set('new', makeNativeFn('RaycastParams.new', () => createRaycastParams()));

  // Enum tables
  const makeEnum = (items: string[]) => {
    const t = new LuaTable();
    for (const item of items) t.set(item, item);
    return t;
  };
  const EnumLib = new LuaTable();
  EnumLib.set('Material', makeEnum(['Plastic', 'SmoothPlastic', 'Neon', 'Metal', 'Wood', 'Glass', 'Marble', 'Slate', 'Grass', 'Cobblestone', 'ForceField']));
  EnumLib.set('EasingStyle', makeEnum(['Linear', 'Sine', 'Quad', 'Cubic', 'Quart', 'Bounce', 'Elastic']));
  EnumLib.set('EasingDirection', makeEnum(['In', 'Out', 'InOut']));
  EnumLib.set('KeyCode', makeEnum(['W', 'A', 'S', 'D', 'E', 'F', 'Q', 'R', 'Space', 'LeftShift', 'One', 'Two', 'Three', 'Return']));
  EnumLib.set('UserInputType', makeEnum(['Keyboard', 'MouseButton1', 'MouseButton2', 'Touch']));
  EnumLib.set('RaycastFilterType', makeEnum(['Exclude', 'Include', 'Blacklist', 'Whitelist']));
  EnumLib.set('PartType', makeEnum(['Block', 'Ball', 'Cylinder']));
  EnumLib.set('Font', makeEnum(['GothamBold', 'Gotham', 'SourceSansBold', 'Code']));

  return {
    Vector3: Vector3Lib,
    CFrame: CFrameLib,
    Color3: Color3Lib,
    BrickColor: BrickColorLib,
    UDim2: UDim2Lib,
    TweenInfo: TweenInfoLib,
    RaycastParams: RaycastParamsLib,
    Enum: EnumLib,
  };
}

function lookAtCFrame(at: Vec3Data, target: Vec3Data): LuaUserdata {
  const fx = target.x - at.x;
  const fy = target.y - at.y;
  const fz = target.z - at.z;
  const len = Math.hypot(fx, fy, fz);
  if (len < 1e-6) return createCFrame(at.x, at.y, at.z);
  // back = -forward
  const back = { x: -fx / len, y: -fy / len, z: -fz / len };
  const worldUp = Math.abs(back.y) > 0.99 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  // right = normalize(cross(worldUp, back))
  const rx = worldUp.y * back.z - worldUp.z * back.y;
  const ry = worldUp.z * back.x - worldUp.x * back.z;
  const rz = worldUp.x * back.y - worldUp.y * back.x;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  const right = { x: rx / rLen, y: ry / rLen, z: rz / rLen };
  const up = {
    x: back.y * right.z - back.z * right.y,
    y: back.z * right.x - back.x * right.z,
    z: back.x * right.y - back.y * right.x,
  };
  return createCFrame(at.x, at.y, at.z, 0, 0, 0, { right, up, back });
}
