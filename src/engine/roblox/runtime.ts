import { LuauState } from 'luau-web';
import {
  ConsoleEntry,
  NetworkLogEntry,
  RuntimeNodeSnapshot,
  ScriptFile,
  SerializedInstance,
} from '../../types/studio';
import { injectLuauLoopGuard } from '../luau/loopGuard';
import { ROBLOX_LUAU_PRELUDE } from '../luau/robloxPrelude';

export class RBXInstanceNode {
  id: string;
  name: string;
  className: string;
  parent: RBXInstanceNode | null = null;
  children: RBXInstanceNode[] = [];
  properties: Record<string, unknown> = {};
  attributes: Record<string, unknown> = {};
  tags = new Set<string>();

  constructor(
    id: string,
    name: string,
    className: string,
    properties: Record<string, unknown> = {}
  ) {
    this.id = id;
    this.name = name;
    this.className = className;
    this.properties = { ...properties };
  }

  getPath(): string {
    const parts: string[] = [];
    let cur: RBXInstanceNode | null = this;
    while (cur && cur.className !== 'DataModel') {
      parts.unshift(cur.name);
      cur = cur.parent;
    }
    return parts.join('/');
  }

  isA(cls: string): boolean {
    if (this.className === cls || cls === 'Instance') return true;
    if (
      cls === 'BasePart' &&
      ['Part', 'WedgePart', 'CornerWedgePart', 'MeshPart', 'SpawnLocation'].includes(
        this.className
      )
    ) {
      return true;
    }
    if (cls === 'GuiObject' && ['Frame', 'TextLabel', 'TextButton', 'ImageLabel'].includes(this.className)) {
      return true;
    }
    if (
      cls === 'ValueBase' &&
      ['IntValue', 'NumberValue', 'StringValue', 'BoolValue', 'ObjectValue'].includes(
        this.className
      )
    ) {
      return true;
    }
    if (
      cls === 'LuaSourceContainer' &&
      ['Script', 'LocalScript', 'ModuleScript'].includes(this.className)
    ) {
      return true;
    }
    return false;
  }

  toSnapshot(): RuntimeNodeSnapshot {
    return {
      id: this.id,
      name: this.name,
      className: this.className,
      path: this.getPath(),
      properties: { ...this.properties },
      tags: Array.from(this.tags),
      attributes: { ...this.attributes },
      children: this.children.map((c) => c.toSnapshot()),
    };
  }
}

interface TweenInfoSpec {
  Time?: number;
  EasingStyle?: string;
  EasingDirection?: string;
  RepeatCount?: number;
  Reverses?: boolean;
  DelayTime?: number;
}

interface ActiveTween {
  tweenId: string;
  instance: RBXInstanceNode;
  info: TweenInfoSpec;
  startTime: number;
  startProps: Record<string, unknown>;
  goalProps: Record<string, unknown>;
  playing: boolean;
}

interface EncodedValue {
  kind: 'nil' | 'prim' | 'v3' | 'cf' | 'c3' | 'bc' | 'udim2' | 'enum' | 'inst';
  val?: unknown;
  enumType?: string;
}

export interface StudioRuntimeCallbacks {
  onConsole: (entry: ConsoleEntry) => void;
  onNetwork: (entry: NetworkLogEntry) => void;
  onSceneUpdate: () => void;
  onDataStoreUpdate: (stores: Record<string, Record<string, unknown>>) => void;
  onSoundPlay: (soundType: string) => void;
}

let nodeUidCounter = 0;
function nextNodeId(prefix = 'inst'): string {
  nodeUidCounter += 1;
  return `${prefix}_${nodeUidCounter}`;
}

function nowTimeStr(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8);
}

const BRICK_PALETTE: Record<string, string> = {
  'Bright red': '#C4281C',
  'Bright blue': '#0D69AC',
  'Bright green': '#4B974B',
  'Bright yellow': '#F5CD30',
  'Bright orange': '#DA8541',
  'Neon orange': '#D5733D',
  'Really red': '#FF0000',
  'Lime green': '#00FF00',
  Cyan: '#00FFFF',
  White: '#F2F3F3',
  Black: '#1B2A35',
  'Medium stone grey': '#A3A2A5',
  'Dark stone grey': '#635F62',
  'Royal purple': '#6225D1',
  'Hot pink': '#FF00BF',
  'Electric blue': '#0989CF',
};

function defaultPropsForClass(cls: string): Record<string, unknown> {
  if (cls === 'Part' || cls === 'WedgePart' || cls === 'CornerWedgePart' || cls === 'SpawnLocation') {
    return {
      Position: [0, 2, 0],
      Size: [4, 1, 2],
      Color: '#A3A2A5',
      Material: 'Plastic',
      Transparency: 0,
      Anchored: true,
      CanCollide: true,
      Rotation: [0, 0, 0],
      Shape: 'Block',
    };
  }
  if (cls === 'ScreenGui') return { Enabled: true };
  if (cls === 'Frame') {
    return {
      Position: [0.1, 0, 0.1, 0],
      Size: [0, 220, 0, 64],
      BackgroundColor3: '#1E293B',
      BackgroundTransparency: 0.1,
      Visible: true,
    };
  }
  if (cls === 'TextLabel' || cls === 'TextButton') {
    return {
      Position: [0.05, 0, 0.05, 0],
      Size: [0, 200, 0, 42],
      BackgroundColor3: cls === 'TextButton' ? '#2563EB' : '#0F172A',
      BackgroundTransparency: 0,
      Text: cls === 'TextButton' ? 'Button' : 'Label',
      TextColor3: '#FFFFFF',
      TextSize: 16,
      Visible: true,
    };
  }
  if (cls === 'ClickDetector') return { MaxActivationDistance: 32 };
  if (cls === 'ProximityPrompt') {
    return {
      ActionText: 'Interact',
      ObjectText: 'Object',
      HoldDuration: 0,
      MaxActivationDistance: 10,
      Enabled: true,
    };
  }
  if (cls === 'PointLight') return { Color: '#FFFFFF', Brightness: 2, Range: 16, Enabled: true };
  if (cls === 'WeldConstraint') return { Enabled: true };
  if (cls === 'IntValue' || cls === 'NumberValue') return { Value: 0 };
  if (cls === 'StringValue') return { Value: '' };
  if (cls === 'BoolValue') return { Value: false };
  if (cls === 'Sound') return { SoundId: 'rbxassetid://coin', Volume: 0.5 };
  if (cls === 'Humanoid') return { Health: 100, MaxHealth: 100, WalkSpeed: 16, JumpPower: 50 };
  return {};
}

export class RobloxStudioRuntime {
  root: RBXInstanceNode;
  isPlaying = false;
  private callbacks: StudioRuntimeCallbacks;
  private dataStores: Record<string, Record<string, unknown>> = {};
  private keyStates = new Set<string>();
  private activeTweens: ActiveTween[] = [];
  private heartbeatIntervalId: number | null = null;
  private lastTickTime = performance.now();
  private playStartTime = performance.now();

  // Real Luau WASM state & registered Luau bridge functions
  private state: LuauState | null = null;
  private playGeneration = 0;
  private vmQueue: Promise<void> = Promise.resolve();
  private scheduledTimers = new Set<number>();
  private sceneUpdateQueued = false;

  private luauResumeThread: ((co: unknown, elapsedSec?: number) => Promise<void>) | null = null;
  private luauRunScript:
    | ((fn: unknown, scriptId: string, sourceTag: string, scriptName: string) => Promise<void>)
    | null = null;
  private luauFireSignal: ((sigKey: string, argJsonList: string) => Promise<void>) | null = null;
  private luauDispatchAction: ((keyName: string, stateStr: string) => Promise<void>) | null = null;

  // Lightweight rigid-body physics & MoveTo state
  private nodeIndex = new Map<string, RBXInstanceNode>();
  private partVelocities = new Map<string, [number, number, number]>();
  private activeTouchPairs = new Set<string>();
  private humanoidMoveTargets = new Map<string, [number, number, number]>();

  constructor(callbacks: StudioRuntimeCallbacks) {
    this.callbacks = callbacks;
    this.root = this.createEmptyDataModel();
  }

  private registerNode(node: RBXInstanceNode): RBXInstanceNode {
    this.nodeIndex.set(node.id, node);
    return node;
  }

  private createEmptyDataModel(): RBXInstanceNode {
    this.nodeIndex.clear();
    const dm = this.registerNode(new RBXInstanceNode('game', 'game', 'DataModel'));
    const services = [
      ['Workspace', 'Workspace', { Gravity: 196.2 }],
      ['Players', 'Players', {}],
      ['Lighting', 'Lighting', { ClockTime: 14, Brightness: 2, FogEnd: 1000 }],
      ['ReplicatedStorage', 'ReplicatedStorage', {}],
      ['ServerScriptService', 'ServerScriptService', {}],
      ['StarterGui', 'StarterGui', {}],
      ['StarterPlayer', 'StarterPlayer', {}],
      ['SoundService', 'SoundService', {}],
      ['DataStoreService', 'DataStoreService', {}],
      ['TweenService', 'TweenService', {}],
      ['RunService', 'RunService', {}],
      ['UserInputService', 'UserInputService', {}],
      ['ContextActionService', 'ContextActionService', {}],
      ['CollectionService', 'CollectionService', {}],
      ['Debris', 'Debris', {}],
    ] as const;

    for (const [name, cls, props] of services) {
      const svc = this.registerNode(new RBXInstanceNode(name.toLowerCase(), name, cls, props));
      this.attachChild(dm, svc);
      if (name === 'StarterPlayer') {
        const sps = this.registerNode(
          new RBXInstanceNode('starterplayerscripts', 'StarterPlayerScripts', 'StarterPlayerScripts')
        );
        this.attachChild(svc, sps);
      }
    }
    return dm;
  }

  private attachChild(parent: RBXInstanceNode, child: RBXInstanceNode) {
    this.registerNode(child);
    if (child.parent) {
      child.parent.children = child.parent.children.filter((c) => c !== child);
    }
    child.parent = parent;
    parent.children.push(child);
  }

  private requestSceneUpdate() {
    if (this.sceneUpdateQueued) return;
    this.sceneUpdateQueued = true;
    queueMicrotask(() => {
      this.sceneUpdateQueued = false;
      this.callbacks.onSceneUpdate();
    });
  }

  private emitConsole(
    level: ConsoleEntry['level'],
    source: ConsoleEntry['source'],
    scriptName: string,
    message: string,
    line?: number
  ) {
    this.callbacks.onConsole({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: nowTimeStr(),
      level,
      source,
      scriptName,
      message,
      line,
    });
  }

  loadScene(
    hierarchy: SerializedInstance[],
    scripts: ScriptFile[],
    starterDataStore?: Record<string, Record<string, unknown>>
  ) {
    this.stop();
    this.root = this.createEmptyDataModel();
    this.dataStores = starterDataStore ? JSON.parse(JSON.stringify(starterDataStore)) : {};
    this.callbacks.onDataStoreUpdate(this.getDataStoreSnapshot());

    for (const top of hierarchy) {
      const service = this.root.children.find(
        (c) => c.name === top.name || c.className === top.className
      );
      if (service) {
        Object.assign(service.properties, top.properties || {});
        if (top.children) {
          for (const ch of top.children) {
            this.hydrateInstance(service, ch);
          }
        }
      }
    }

    for (const sf of scripts) {
      const existing = this.findByPath(sf.path);
      if (existing) {
        existing.properties.Source = sf.code;
      } else {
        const parentNode = this.ensurePathFolder(sf.parentPath);
        const sNode = new RBXInstanceNode(nextNodeId('scr'), sf.name, sf.className, {
          Source: sf.code,
          Enabled: true,
        });
        this.attachChild(parentNode, sNode);
      }
    }

    this.callbacks.onSceneUpdate();
  }

  private hydrateInstance(parent: RBXInstanceNode, ser: SerializedInstance) {
    const existing = parent.children.find(
      (c) => c.name === ser.name && c.className === ser.className
    );
    const node =
      existing ?? new RBXInstanceNode(ser.id || nextNodeId(), ser.name, ser.className, ser.properties);
    if (existing) {
      Object.assign(node.properties, ser.properties);
    } else {
      this.attachChild(parent, node);
    }
    if (ser.tags) ser.tags.forEach((t) => node.tags.add(t));
    if (ser.attributes) Object.assign(node.attributes, ser.attributes);
    if (ser.children) {
      for (const ch of ser.children) {
        this.hydrateInstance(node, ch);
      }
    }
  }

  private ensurePathFolder(path: string): RBXInstanceNode {
    const segments = path.split('/').filter(Boolean);
    let cur = this.root;
    for (const seg of segments) {
      let next = cur.children.find((c) => c.name === seg);
      if (!next) {
        next = new RBXInstanceNode(nextNodeId('fld'), seg, 'Folder');
        this.attachChild(cur, next);
      }
      cur = next;
    }
    return cur;
  }

  findByPath(path: string): RBXInstanceNode | null {
    const clean = path.replace(/^game\//, '').replace(/^game\./, '');
    const segments = clean.split(/[/.]/).filter(Boolean);
    let cur: RBXInstanceNode | undefined = this.root;
    for (const seg of segments) {
      if (seg === 'workspace' && cur === this.root) {
        cur = this.root.children.find((c) => c.name === 'Workspace');
      } else {
        cur = cur?.children.find((c) => c.name === seg);
      }
      if (!cur) return null;
    }
    return cur ?? null;
  }

  getSnapshotTree(): RuntimeNodeSnapshot[] {
    return this.root.children.map((c) => c.toSnapshot());
  }

  getAllParts(): RBXInstanceNode[] {
    const out: RBXInstanceNode[] = [];
    const ws = this.findByPath('Workspace');
    if (!ws) return out;
    const walk = (n: RBXInstanceNode) => {
      if (n.isA('BasePart')) out.push(n);
      n.children.forEach(walk);
    };
    walk(ws);
    return out;
  }

  getGuiElements(): RBXInstanceNode[] {
    const out: RBXInstanceNode[] = [];
    const sg = this.findByPath('StarterGui');
    const players = this.findByPath('Players');
    const lp = players?.children.find((c) => c.className === 'Player');
    const playerGui = lp?.children.find((c) => c.name === 'PlayerGui');
    const walk = (n: RBXInstanceNode) => {
      if (n.className === 'ScreenGui' || n.isA('GuiObject')) out.push(n);
      n.children.forEach(walk);
    };
    if (playerGui) walk(playerGui);
    else if (sg) walk(sg);
    return out;
  }

  getDataStoreSnapshot(): Record<string, Record<string, unknown>> {
    return JSON.parse(JSON.stringify(this.dataStores));
  }

  getTaggedNodes(tag: string): RBXInstanceNode[] {
    const out: RBXInstanceNode[] = [];
    const walk = (n: RBXInstanceNode) => {
      if (n.tags.has(tag)) out.push(n);
      n.children.forEach(walk);
    };
    walk(this.root);
    return out;
  }

  updateInstanceProperty(nodeId: string, prop: string, val: unknown) {
    const node = this.findNodeById(nodeId);
    if (!node) return;
    if (prop === 'Name') {
      node.name = String(val);
    } else {
      node.properties[prop] = val;
    }
    this.callbacks.onSceneUpdate();
  }

  findNodeById(id: string, cur: RBXInstanceNode = this.root): RBXInstanceNode | null {
    const indexed = this.nodeIndex.get(id);
    if (indexed) return indexed;
    if (cur.id === id) return cur;
    for (const ch of cur.children) {
      const f = this.findNodeById(id, ch);
      if (f) return f;
    }
    return null;
  }

  private encodeStoredProp(key: string, val: unknown): EncodedValue {
    if (val === null || val === undefined) return { kind: 'nil' };
    if (val instanceof RBXInstanceNode) return { kind: 'inst', val: val.id };

    if ((key === 'Position' || key === 'Size') && Array.isArray(val) && val.length === 4) {
      return { kind: 'udim2', val: val.map((n) => Number(n ?? 0)) };
    }
    if (
      key === 'Position' ||
      key === 'Size' ||
      key === 'Orientation' ||
      key === 'Rotation' ||
      key === 'Velocity' ||
      key === 'AssemblyLinearVelocity'
    ) {
      const arr = Array.isArray(val) ? val : [0, 0, 0];
      return { kind: 'v3', val: [Number(arr[0] ?? 0), Number(arr[1] ?? 0), Number(arr[2] ?? 0)] };
    }
    if (key === 'CFrame') {
      if (Array.isArray(val)) {
        return {
          kind: 'cf',
          val: [
            Number(val[0] ?? 0),
            Number(val[1] ?? 0),
            Number(val[2] ?? 0),
            Number(val[3] ?? 0),
            Number(val[4] ?? 0),
            Number(val[5] ?? 0),
          ],
        };
      }
      return { kind: 'cf', val: [0, 0, 0, 0, 0, 0] };
    }
    if (
      key === 'Color' ||
      key === 'BackgroundColor3' ||
      key === 'TextColor3' ||
      key === 'Ambient' ||
      key === 'FogColor'
    ) {
      return { kind: 'c3', val: String(val) };
    }
    if (key === 'BrickColor') {
      return { kind: 'bc', val: String(val) };
    }
    if (key === 'Material') {
      return { kind: 'enum', enumType: 'Material', val: String(val) };
    }
    if (key === 'Shape') {
      return { kind: 'enum', enumType: 'PartType', val: String(val) };
    }
    if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') {
      return { kind: 'prim', val };
    }
    return { kind: 'prim', val: String(val) };
  }

  private decodeIncomingProp(key: string, spec: EncodedValue | null | undefined): unknown {
    if (!spec || spec.kind === 'nil') return null;
    if (spec.kind === 'inst') {
      return this.findNodeById(String(spec.val ?? ''));
    }
    if (spec.kind === 'v3' || spec.kind === 'cf' || spec.kind === 'udim2') {
      return Array.isArray(spec.val) ? spec.val.map(Number) : [0, 0, 0];
    }
    if (spec.kind === 'c3') {
      return String(spec.val ?? '#FFFFFF');
    }
    if (spec.kind === 'bc') {
      return String(spec.val ?? 'Medium stone grey');
    }
    if (key === 'Value' && (spec.val === null || spec.val === undefined)) {
      return null;
    }
    return spec.val;
  }

  private enqueueVmCall(gen: number, taskFn: () => Promise<void>): Promise<void> {
    this.vmQueue = this.vmQueue
      .catch(() => undefined)
      .then(async () => {
        if (
          gen !== this.playGeneration ||
          !this.isPlaying ||
          !this.state ||
          this.state.destroyed
        ) {
          return;
        }
        try {
          await taskFn();
        } catch (err) {
          if (gen === this.playGeneration && this.isPlaying) {
            this.emitConsole(
              'error',
              'Studio',
              'Luau',
              err instanceof Error ? err.message : String(err)
            );
          }
        }
      });
    return this.vmQueue;
  }

  private fireSignal(sigKey: string, args: { kind: 'inst' | 'input' | 'prim'; val: unknown }[]) {
    const gen = this.playGeneration;
    if (!this.isPlaying || !this.luauFireSignal || !this.state || this.state.destroyed) return;
    const fn = this.luauFireSignal;
    const payload = JSON.stringify(args);
    void this.enqueueVmCall(gen, () => fn(sigKey, payload));
  }

  private buildBridgeEnv(gen: number): Record<string, unknown> {
    return {
      __registerResume: (fn: (co: unknown, elapsed?: number) => Promise<void>) => {
        this.luauResumeThread = fn;
      },
      __registerBridge: (
        runFn: (fn: unknown, id: string, tag: string, name: string) => Promise<void>,
        fireFn: (sigKey: string, argJsonList: string) => Promise<void>,
        actionFn: (keyName: string, stateStr: string) => Promise<void>
      ) => {
        this.luauRunScript = runFn;
        this.luauFireSignal = fireFn;
        this.luauDispatchAction = actionFn;
      },
      __scheduleResume: (co: unknown, seconds: number) => {
        if (gen !== this.playGeneration || !this.isPlaying) return;
        const delayMs = Math.max(0, Number(seconds ?? 0) * 1000);
        const startTs = performance.now();
        const timerId = window.setTimeout(() => {
          this.scheduledTimers.delete(timerId);
          if (gen !== this.playGeneration || !this.isPlaying) return;
          const elapsed = (performance.now() - startTs) / 1000;
          const resumeFn = this.luauResumeThread;
          if (resumeFn) {
            void this.enqueueVmCall(gen, () => resumeFn(co, elapsed));
          }
        }, delayMs);
        this.scheduledTimers.add(timerId);
      },
      __jsLog: (level: string, sourceTag: string, scriptName: string, message: string) => {
        const lvl: ConsoleEntry['level'] =
          level === 'warn' || level === 'error' || level === 'info' ? level : 'print';
        const src: ConsoleEntry['source'] =
          sourceTag === 'Client' || sourceTag === 'Strict' || sourceTag === 'Studio'
            ? sourceTag
            : 'Server';
        this.emitConsole(lvl, src, String(scriptName || 'Script'), String(message ?? ''));
      },
      __jsNetworkLog: (
        direction: string,
        eventName: string,
        payloadSummary: string,
        status: string
      ) => {
        const dir: NetworkLogEntry['direction'] =
          direction === 'Server -> Client' || direction === 'Server -> AllClients'
            ? direction
            : 'Client -> Server';
        this.callbacks.onNetwork({
          id: `net_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: nowTimeStr(),
          direction: dir,
          eventName: String(eventName || 'RemoteEvent'),
          payloadSummary: String(payloadSummary || '(empty)') || '(empty)',
          status:
            status === 'Blocked' || status === 'RateLimited' ? status : 'Delivered',
        });
      },
      __jsNow: () => Date.now() / 1000,
      __jsClock: () => (performance.now() - this.playStartTime) / 1000,

      // Instance lookup & hierarchy helpers
      __jsInstMeta: (id: string) => {
        const n = this.findNodeById(String(id));
        return n ? JSON.stringify({ id: n.id, className: n.className }) : 'null';
      },
      __jsInstMetaName: (id: string) => this.findNodeById(String(id))?.name ?? '',
      __jsInstParentId: (id: string) => this.findNodeById(String(id))?.parent?.id ?? '',
      __jsInstChildren: (id: string) => {
        const n = this.findNodeById(String(id));
        return JSON.stringify(n ? n.children.map((c) => c.id) : []);
      },
      __jsInstDescendants: (id: string) => {
        const n = this.findNodeById(String(id));
        const ids: string[] = [];
        const walk = (cur: RBXInstanceNode) => {
          for (const ch of cur.children) {
            ids.push(ch.id);
            walk(ch);
          }
        };
        if (n) walk(n);
        return JSON.stringify(ids);
      },
      __jsInstFindChild: (id: string, name: string, recursive: boolean) => {
        const n = this.findNodeById(String(id));
        if (!n) return '';
        const find = (cur: RBXInstanceNode): RBXInstanceNode | null => {
          for (const ch of cur.children) {
            if (ch.name === name) return ch;
            if (recursive) {
              const r = find(ch);
              if (r) return r;
            }
          }
          return null;
        };
        return find(n)?.id ?? '';
      },
      __jsInstFindChildOfClass: (id: string, cls: string) => {
        const n = this.findNodeById(String(id));
        return n?.children.find((c) => c.className === cls)?.id ?? '';
      },
      __jsInstFindChildWhichIsA: (id: string, cls: string) => {
        const n = this.findNodeById(String(id));
        return n?.children.find((c) => c.isA(cls))?.id ?? '';
      },
      __jsInstIsA: (id: string, cls: string) => {
        const n = this.findNodeById(String(id));
        return n ? n.isA(String(cls)) : false;
      },
      __jsInstIsDescendantOf: (id: string, ancId: string) => {
        let cur = this.findNodeById(String(id));
        const anc = this.findNodeById(String(ancId));
        if (!cur || !anc) return false;
        while (cur) {
          if (cur === anc) return true;
          cur = cur.parent;
        }
        return false;
      },
      __jsInstClone: (id: string) => {
        const n = this.findNodeById(String(id));
        if (!n) return '';
        const cloned = this.cloneNodeTree(n);
        return cloned.id;
      },
      __jsInstDestroy: (id: string) => {
        const n = this.findNodeById(String(id));
        if (!n) return;
        if (n.parent) {
          n.parent.children = n.parent.children.filter((c) => c !== n);
          n.parent = null;
        }
        this.partVelocities.delete(n.id);
        this.requestSceneUpdate();
      },
      __jsInstClearChildren: (id: string) => {
        const n = this.findNodeById(String(id));
        if (!n) return;
        n.children.forEach((c) => {
          c.parent = null;
          this.partVelocities.delete(c.id);
        });
        n.children = [];
        this.requestSceneUpdate();
      },
      __jsInstGetService: (svcName: string) => {
        const svc = this.root.children.find(
          (c) => c.name === svcName || c.className === svcName
        );
        if (!svc) {
          throw new Error(`'${svcName}' is not a valid Service name`);
        }
        return svc.id;
      },
      __jsInstNew: (cls: string, parentId: string) => {
        const node = this.registerNode(
          new RBXInstanceNode(
            nextNodeId(cls.toLowerCase()),
            cls,
            cls,
            defaultPropsForClass(cls)
          )
        );
        if (parentId) {
          const p = this.findNodeById(parentId);
          if (p) {
            this.attachChild(p, node);
            this.requestSceneUpdate();
          }
        }
        return node.id;
      },
      __jsInstGetProp: (id: string, key: string) => {
        const n = this.findNodeById(String(id));
        if (!n) return JSON.stringify({ kind: 'nil' });
        if (key === 'CFrame' && n.isA('BasePart')) {
          if (Array.isArray(n.properties.CFrame)) {
            return JSON.stringify(this.encodeStoredProp('CFrame', n.properties.CFrame));
          }
          const pos = Array.isArray(n.properties.Position)
            ? (n.properties.Position as number[])
            : [0, 0, 0];
          const rot = Array.isArray(n.properties.Rotation)
            ? (n.properties.Rotation as number[])
            : [0, 0, 0];
          return JSON.stringify({
            kind: 'cf',
            val: [
              Number(pos[0] ?? 0),
              Number(pos[1] ?? 0),
              Number(pos[2] ?? 0),
              (Number(rot[0] ?? 0) * Math.PI) / 180,
              (Number(rot[1] ?? 0) * Math.PI) / 180,
              (Number(rot[2] ?? 0) * Math.PI) / 180,
            ],
          });
        }
        if (key in n.properties) {
          return JSON.stringify(this.encodeStoredProp(key, n.properties[key]));
        }
        return JSON.stringify({ kind: 'nil' });
      },
      __jsInstSetProp: (id: string, key: string, encodedJson: string) => {
        const n = this.findNodeById(String(id));
        if (!n) return;
        let spec: EncodedValue = { kind: 'nil' };
        try {
          spec = JSON.parse(encodedJson || 'null') ?? { kind: 'nil' };
        } catch {
          spec = { kind: 'nil' };
        }

        if (key === 'Name') {
          n.name = String(spec.val ?? n.name);
        } else if (key === 'Parent') {
          if (spec.kind === 'nil' || !spec.val) {
            if (n.parent) {
              n.parent.children = n.parent.children.filter((c) => c !== n);
              n.parent = null;
            }
          } else if (spec.kind === 'inst') {
            const target = this.findNodeById(String(spec.val));
            if (target) this.attachChild(target, n);
          }
        } else if (key === 'PrimaryPart' || key === 'Part0' || key === 'Part1') {
          n.properties[key] =
            spec.kind === 'inst' ? this.findNodeById(String(spec.val ?? '')) : null;
        } else {
          const decoded = this.decodeIncomingProp(key, spec);
          n.properties[key] = decoded;

          if (key === 'CFrame' && Array.isArray(decoded)) {
            n.properties.Position = [Number(decoded[0] ?? 0), Number(decoded[1] ?? 0), Number(decoded[2] ?? 0)];
            n.properties.Rotation = [
              (Number(decoded[3] ?? 0) * 180) / Math.PI,
              (Number(decoded[4] ?? 0) * 180) / Math.PI,
              (Number(decoded[5] ?? 0) * 180) / Math.PI,
            ];
          } else if (key === 'Position' && Array.isArray(decoded) && decoded.length === 3) {
            const rot = Array.isArray(n.properties.Rotation)
              ? (n.properties.Rotation as number[])
              : [0, 0, 0];
            n.properties.CFrame = [
              Number(decoded[0] ?? 0),
              Number(decoded[1] ?? 0),
              Number(decoded[2] ?? 0),
              (Number(rot[0] ?? 0) * Math.PI) / 180,
              (Number(rot[1] ?? 0) * Math.PI) / 180,
              (Number(rot[2] ?? 0) * Math.PI) / 180,
            ];
          } else if (key === 'Orientation' && Array.isArray(decoded) && decoded.length === 3) {
            n.properties.Rotation = [Number(decoded[0] ?? 0), Number(decoded[1] ?? 0), Number(decoded[2] ?? 0)];
          } else if (key === 'BrickColor') {
            n.properties.Color = BRICK_PALETTE[String(decoded)] ?? '#3B82F6';
          } else if (key === 'AssemblyLinearVelocity' || key === 'Velocity') {
            if (Array.isArray(decoded)) {
              this.partVelocities.set(n.id, [
                Number(decoded[0] ?? 0),
                Number(decoded[1] ?? 0),
                Number(decoded[2] ?? 0),
              ]);
            }
          }
        }
        this.requestSceneUpdate();
      },
      __jsInstAttr: (id: string, op: string, key: string, encodedJson: string) => {
        const n = this.findNodeById(String(id));
        if (!n) return JSON.stringify({ kind: 'nil' });
        if (op === 'set') {
          try {
            const spec = JSON.parse(encodedJson || 'null') as EncodedValue;
            n.attributes[key] = this.decodeIncomingProp(key, spec);
          } catch {
            n.attributes[key] = null;
          }
          this.requestSceneUpdate();
          return JSON.stringify({ kind: 'nil' });
        }
        return JSON.stringify(this.encodeStoredProp(key, n.attributes[key]));
      },
      __jsInstTag: (id: string, op: string, tag: string) => {
        if (op === 'getTagged') {
          return JSON.stringify(this.getTaggedNodes(tag).map((node) => node.id));
        }
        const n = this.findNodeById(String(id));
        if (!n) return op === 'getAll' ? '[]' : false;
        if (op === 'add') {
          n.tags.add(tag);
          this.requestSceneUpdate();
          return true;
        }
        if (op === 'remove') {
          n.tags.delete(tag);
          this.requestSceneUpdate();
          return true;
        }
        if (op === 'has') return n.tags.has(tag);
        if (op === 'getAll') return JSON.stringify(Array.from(n.tags));
        return false;
      },
      __jsRaycast: (originJson: string, dirJson: string, paramsJson: string) => {
        const origin = JSON.parse(originJson) as [number, number, number];
        const dir = JSON.parse(dirJson) as [number, number, number];
        const params = JSON.parse(paramsJson || '{}') as {
          filterType?: string;
          filterIds?: string[];
        };
        return JSON.stringify(this.performRaycast(origin, dir, params));
      },
      __jsLocalPlayerId: () => {
        const players = this.findByPath('Players');
        return players?.children.find((c) => c.className === 'Player')?.id ?? '';
      },
      __jsGetPlayers: () => {
        const players = this.findByPath('Players');
        const ids = players
          ? players.children.filter((c) => c.className === 'Player').map((c) => c.id)
          : [];
        return JSON.stringify(ids);
      },
      __jsGetPlayerFromChar: (charId: string) => {
        const char = this.findNodeById(String(charId));
        if (!char) return '';
        const players = this.findByPath('Players');
        const owner = players?.children.find(
          (p) => p.className === 'Player' && p.properties.Character === char
        );
        return owner?.id ?? '';
      },
      __jsTweenPlay: (nodeId: string, infoJson: string, goalJson: string, tweenId: string) => {
        const target = this.findNodeById(String(nodeId));
        if (!target) return;
        const info = JSON.parse(infoJson || '{}') as TweenInfoSpec;
        const rawGoals = JSON.parse(goalJson || '{}') as Record<string, EncodedValue>;
        const goalProps: Record<string, unknown> = {};
        const startProps: Record<string, unknown> = {};
        for (const [k, spec] of Object.entries(rawGoals)) {
          goalProps[k] = this.decodeIncomingProp(k, spec);
          startProps[k] = target.properties[k];
        }
        // Remove any prior tween on the same id
        this.activeTweens = this.activeTweens.filter((t) => t.tweenId !== tweenId);
        this.activeTweens.push({
          tweenId,
          instance: target,
          info,
          startTime: performance.now() + Number(info.DelayTime ?? 0) * 1000,
          startProps,
          goalProps,
          playing: true,
        });
      },
      __jsTweenCancel: (tweenId: string) => {
        this.activeTweens = this.activeTweens.filter((t) => t.tweenId !== tweenId);
      },
      __jsIsKeyDown: (keyName: string) => {
        const short = String(keyName).replace(/^Enum\.KeyCode\./, '');
        return this.keyStates.has(short) || this.keyStates.has(keyName);
      },
      __jsDataStore: (storeName: string, op: string, key: string, valJson: string) => {
        if (!this.dataStores[storeName]) this.dataStores[storeName] = {};
        const store = this.dataStores[storeName];
        if (op === 'get') {
          return store[key] !== undefined ? JSON.stringify(store[key]) : 'null';
        }
        if (op === 'set') {
          store[key] = valJson ? JSON.parse(valJson) : null;
          this.callbacks.onDataStoreUpdate(this.getDataStoreSnapshot());
          return 'ok';
        }
        if (op === 'inc') {
          const delta = Number(valJson || 1);
          const next = Number(store[key] ?? 0) + delta;
          store[key] = next;
          this.callbacks.onDataStoreUpdate(this.getDataStoreSnapshot());
          return String(next);
        }
        if (op === 'remove') {
          const old = store[key] !== undefined ? JSON.stringify(store[key]) : 'null';
          delete store[key];
          this.callbacks.onDataStoreUpdate(this.getDataStoreSnapshot());
          return old;
        }
        return 'null';
      },
      __jsDebrisAdd: (nodeId: string, lifetime: number) => {
        const inst = this.findNodeById(String(nodeId));
        if (!inst) return;
        const ms = Math.max(20, Number(lifetime ?? 1) * 1000);
        const timerId = window.setTimeout(() => {
          this.scheduledTimers.delete(timerId);
          if (gen !== this.playGeneration || !this.isPlaying) return;
          if (inst.parent) {
            inst.parent.children = inst.parent.children.filter((c) => c !== inst);
            inst.parent = null;
            this.partVelocities.delete(inst.id);
            this.requestSceneUpdate();
          }
        }, ms);
        this.scheduledTimers.add(timerId);
      },
      __jsModelPivot: (nodeId: string, op: string, cfJson: string) => {
        const model = this.findNodeById(String(nodeId));
        if (!model) return '[0,0,0]';
        const primary = model.properties.PrimaryPart as RBXInstanceNode | undefined;
        const findFirstPart = (n: RBXInstanceNode): RBXInstanceNode | null => {
          if (n.isA('BasePart')) return n;
          for (const c of n.children) {
            const p = findFirstPart(c);
            if (p) return p;
          }
          return null;
        };
        const anchor = primary ?? findFirstPart(model);
        const anchorPos =
          anchor && Array.isArray(anchor.properties.Position)
            ? (anchor.properties.Position as number[])
            : [0, 0, 0];

        if (op === 'getPivot') {
          return JSON.stringify([
            Number(anchorPos[0] ?? 0),
            Number(anchorPos[1] ?? 0),
            Number(anchorPos[2] ?? 0),
          ]);
        }

        const targetPos = JSON.parse(cfJson || '[0,0,0]') as number[];
        const dx = Number(targetPos[0] ?? 0) - Number(anchorPos[0] ?? 0);
        const dy = Number(targetPos[1] ?? 0) - Number(anchorPos[1] ?? 0);
        const dz = Number(targetPos[2] ?? 0) - Number(anchorPos[2] ?? 0);
        const moveRec = (n: RBXInstanceNode) => {
          if (n.isA('BasePart')) {
            const p = Array.isArray(n.properties.Position)
              ? (n.properties.Position as number[])
              : [0, 0, 0];
            n.properties.Position = [Number(p[0] ?? 0) + dx, Number(p[1] ?? 0) + dy, Number(p[2] ?? 0) + dz];
          }
          n.children.forEach(moveRec);
        };
        moveRec(model);
        this.requestSceneUpdate();
        return 'ok';
      },
      __jsHumanoidOp: (nodeId: string, op: string, a: number, b: number, c: number) => {
        const hum = this.findNodeById(String(nodeId));
        if (!hum) return;
        if (op === 'takeDamage') {
          const prev = Number(hum.properties.Health ?? 100);
          const next = Math.max(0, prev - Math.max(0, Number(a ?? 0)));
          hum.properties.Health = next;
          this.fireSignal(`inst:${hum.id}:HealthChanged`, [{ kind: 'prim', val: next }]);
          if (prev > 0 && next <= 0) {
            this.fireSignal(`inst:${hum.id}:Died`, []);
          }
          this.requestSceneUpdate();
        } else if (op === 'moveTo') {
          this.humanoidMoveTargets.set(hum.id, [Number(a ?? 0), Number(b ?? 0), Number(c ?? 0)]);
        }
      },
      __jsSoundPlay: (nodeId: string) => {
        const s = this.findNodeById(String(nodeId));
        this.callbacks.onSoundPlay(String(s?.properties.SoundId ?? 'coin'));
      },
      __jsGetModuleSource: (nodeId: string) => {
        const m = this.findNodeById(String(nodeId));
        return JSON.stringify({
          name: m?.name ?? 'ModuleScript',
          source: String(m?.properties.Source ?? 'return {}'),
        });
      },
      __compileLua: (source: string, chunkName: string) => {
        if (!this.state || this.state.destroyed) {
          return 'Luau VM is stopped';
        }
        const guarded = injectLuauLoopGuard(String(source ?? ''));
        return this.state.loadstring(guarded, String(chunkName || 'ModuleScript'), false);
      },
    };
  }

  private performRaycast(
    originArr: [number, number, number],
    dirArr: [number, number, number],
    params?: { filterType?: string; filterIds?: string[] }
  ) {
    const origin = { x: originArr[0], y: originArr[1], z: originArr[2] };
    const dir = { x: dirArr[0], y: dirArr[1], z: dirArr[2] };
    const dirLen = Math.hypot(dir.x, dir.y, dir.z);
    if (dirLen < 1e-6) return null;
    const nd = { x: dir.x / dirLen, y: dir.y / dirLen, z: dir.z / dirLen };

    const parts = this.getAllParts();
    let closestT = dirLen;
    let hitPart: RBXInstanceNode | null = null;
    let hitNormal = { x: 0, y: 1, z: 0 };

    const filterIds = Array.isArray(params?.filterIds) ? params.filterIds : [];
    const filterNodes = filterIds
      .map((id) => this.findNodeById(id))
      .filter((n): n is RBXInstanceNode => n !== null);

    const isDescendant = (node: RBXInstanceNode, ancestor: RBXInstanceNode): boolean => {
      let cur: RBXInstanceNode | null = node;
      while (cur) {
        if (cur === ancestor) return true;
        cur = cur.parent;
      }
      return false;
    };

    for (const part of parts) {
      if (params && filterNodes.length > 0) {
        const matched = filterNodes.some((f) => isDescendant(part, f));
        if (params.filterType === 'Exclude' && matched) continue;
        if (params.filterType === 'Include' && !matched) continue;
      }
      const pos = (part.properties.Position as number[]) ?? [0, 0, 0];
      const size = (part.properties.Size as number[]) ?? [4, 1, 2];
      const min = [pos[0] - size[0] / 2, pos[1] - size[1] / 2, pos[2] - size[2] / 2];
      const max = [pos[0] + size[0] / 2, pos[1] + size[1] / 2, pos[2] + size[2] / 2];

      let tMin = 0;
      let tMax = closestT;
      let normal = { x: 0, y: 1, z: 0 };
      let hit = true;

      for (let axis = 0; axis < 3; axis++) {
        const o = axis === 0 ? origin.x : axis === 1 ? origin.y : origin.z;
        const d = axis === 0 ? nd.x : axis === 1 ? nd.y : nd.z;
        if (Math.abs(d) < 1e-8) {
          if (o < min[axis] || o > max[axis]) {
            hit = false;
            break;
          }
        } else {
          let t1 = (min[axis] - o) / d;
          let t2 = (max[axis] - o) / d;
          let sign = -1;
          if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
            sign = 1;
          }
          if (t1 > tMin) {
            tMin = t1;
            normal =
              axis === 0
                ? { x: sign, y: 0, z: 0 }
                : axis === 1
                ? { x: 0, y: sign, z: 0 }
                : { x: 0, y: 0, z: sign };
          }
          tMax = Math.min(tMax, t2);
          if (tMin > tMax) {
            hit = false;
            break;
          }
        }
      }

      if (hit && tMin >= 0 && tMin < closestT) {
        closestT = tMin;
        hitPart = part;
        hitNormal = normal;
      }
    }

    if (!hitPart) return null;
    return {
      instId: hitPart.id,
      pos: [origin.x + nd.x * closestT, origin.y + nd.y * closestT, origin.z + nd.z * closestT],
      norm: [hitNormal.x, hitNormal.y, hitNormal.z],
      dist: closestT,
      mat: String(hitPart.properties.Material ?? 'Plastic'),
    };
  }

  async play(scripts: ScriptFile[]) {
    this.stop();
    const gen = ++this.playGeneration;
    this.isPlaying = true;
    this.playStartTime = performance.now();
    this.vmQueue = Promise.resolve();

    // Sync latest editor source code into DataModel
    for (const sf of scripts) {
      const node = this.findByPath(sf.path);
      if (node) node.properties.Source = sf.code;
    }

    // Spawn LocalPlayer ("BuilderOne") and Character in Workspace
    const playersSvc = this.findByPath('Players')!;
    const workspaceSvc = this.findByPath('Workspace')!;
    const starterGuiSvc = this.findByPath('StarterGui')!;

    const localPlayer = new RBXInstanceNode('player_local', 'BuilderOne', 'Player', {
      UserId: 1001,
    });
    const playerGui = new RBXInstanceNode('playergui', 'PlayerGui', 'PlayerGui');
    this.attachChild(localPlayer, playerGui);
    for (const gui of starterGuiSvc.children) {
      this.attachChild(playerGui, this.cloneNodeTree(gui));
    }

    const character = new RBXInstanceNode('char_local', 'BuilderOne', 'Model', {});
    const hrp = new RBXInstanceNode('hrp_local', 'HumanoidRootPart', 'Part', {
      Position: [0, 3, 12],
      Size: [2, 2, 1],
      Color: '#3B82F6',
      Material: 'SmoothPlastic',
      Anchored: true,
      CanCollide: true,
      Transparency: 1,
    });
    const humanoid = new RBXInstanceNode('hum_local', 'Humanoid', 'Humanoid', {
      Health: 100,
      MaxHealth: 100,
      WalkSpeed: 16,
      JumpPower: 50,
    });
    this.attachChild(character, hrp);
    this.attachChild(character, humanoid);
    character.properties.PrimaryPart = hrp;
    this.attachChild(workspaceSvc, character);
    localPlayer.properties.Character = character;
    this.attachChild(playersSvc, localPlayer);

    this.callbacks.onSceneUpdate();

    // Boot real C++ Luau WASM VM and install Roblox prelude
    const vm = await LuauState.createAsync(this.buildBridgeEnv(gen));
    if (gen !== this.playGeneration || !this.isPlaying) {
      if (!vm.destroyed) vm.destroy();
      return;
    }
    this.state = vm;

    const preludeChunk = vm.loadstring(ROBLOX_LUAU_PRELUDE, 'RobloxPrelude', false);
    if (typeof preludeChunk !== 'function') {
      this.emitConsole('error', 'Studio', 'RobloxPrelude', String(preludeChunk));
      return;
    }
    await this.enqueueVmCall(gen, async () => {
      await (preludeChunk as () => Promise<void>)();
    });

    if (gen !== this.playGeneration || !this.isPlaying) return;

    // Collect Server scripts & Client LocalScripts
    const serverScripts: RBXInstanceNode[] = [];
    const clientScripts: RBXInstanceNode[] = [];
    const walkScripts = (n: RBXInstanceNode) => {
      if (n.className === 'Script' && n.properties.Enabled !== false) serverScripts.push(n);
      if (n.className === 'LocalScript' && n.properties.Enabled !== false) clientScripts.push(n);
      n.children.forEach(walkScripts);
    };
    walkScripts(this.root);

    // Run Server scripts first
    for (const scr of serverScripts) {
      if (gen !== this.playGeneration || !this.isPlaying) break;
      await this.executeScriptNode(scr, 'Server', gen);
    }

    // Fire Players.PlayerAdded & CharacterAdded
    if (gen === this.playGeneration && this.isPlaying) {
      this.fireSignal(`inst:${playersSvc.id}:PlayerAdded`, [
        { kind: 'inst', val: localPlayer.id },
      ]);
      this.fireSignal(`inst:${localPlayer.id}:CharacterAdded`, [
        { kind: 'inst', val: character.id },
      ]);
      await this.vmQueue;
    }

    // Run Client LocalScripts
    for (const lscr of clientScripts) {
      if (gen !== this.playGeneration || !this.isPlaying) break;
      await this.executeScriptNode(lscr, 'Client', gen);
    }

    await this.vmQueue;
    if (gen !== this.playGeneration || !this.isPlaying) return;

    this.callbacks.onSceneUpdate();

    // Start 30Hz physics, TweenService, Humanoid:MoveTo, and RunService loop
    this.lastTickTime = performance.now();
    this.heartbeatIntervalId = window.setInterval(() => {
      if (gen !== this.playGeneration || !this.isPlaying || !this.state || this.state.destroyed) {
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.008, (now - this.lastTickTime) / 1000));
      this.lastTickTime = now;

      this.stepPhysics(dt);
      this.stepHumanoidMoveTo(dt);
      this.stepTweens(now);

      const runSvc = this.findByPath('RunService');
      if (runSvc) {
        const elapsed = (now - this.playStartTime) / 1000;
        this.fireSignal(`inst:${runSvc.id}:Stepped`, [
          { kind: 'prim', val: elapsed },
          { kind: 'prim', val: dt },
        ]);
        this.fireSignal(`inst:${runSvc.id}:Heartbeat`, [{ kind: 'prim', val: dt }]);
        this.fireSignal(`inst:${runSvc.id}:RenderStepped`, [{ kind: 'prim', val: dt }]);
      }
    }, 33);
  }

  private async executeScriptNode(
    node: RBXInstanceNode,
    sourceTag: 'Server' | 'Client',
    gen: number
  ) {
    if (!this.state || this.state.destroyed || gen !== this.playGeneration) return;
    const rawSource = String(node.properties.Source ?? '');
    const guarded = injectLuauLoopGuard(rawSource);
    const compiled = this.state.loadstring(guarded, node.name, false);

    if (typeof compiled !== 'function') {
      const msg = String(compiled);
      const match = msg.match(/^\[string "[^"]*"\]:(\d+):\s*(.+)$/);
      const line = match ? Math.max(1, Number(match[1])) : 1;
      const cleanMsg = match ? `Line ${line}: ${match[2]}` : msg;
      this.emitConsole('error', sourceTag, node.name, cleanMsg, line);
      return;
    }

    const runner = this.luauRunScript;
    if (!runner) return;
    await this.enqueueVmCall(gen, () => runner(compiled, node.id, sourceTag, node.name));
  }

  private stepPhysics(dt: number) {
    const ws = this.findByPath('Workspace');
    if (!ws) return;
    const gravity = Number(ws.properties.Gravity ?? 196.2);
    const allParts = this.getAllParts();
    const anchoredColliders = allParts.filter(
      (p) => p.id !== 'hrp_local' && p.properties.Anchored !== false && p.properties.CanCollide !== false
    );

    let changed = false;

    for (const part of allParts) {
      if (part.id === 'hrp_local') continue;
      if (part.properties.Anchored !== false) continue;

      const pos = Array.isArray(part.properties.Position)
        ? [...(part.properties.Position as number[])]
        : [0, 2, 0];
      const size = Array.isArray(part.properties.Size)
        ? (part.properties.Size as number[])
        : [4, 1, 2];
      const vel = this.partVelocities.get(part.id) ?? [0, 0, 0];
      const sx = Number(size[0] ?? 4);
      const sy = Number(size[1] ?? 1);
      const sz = Number(size[2] ?? 2);

      const prevBottom = pos[1] - sy / 2;
      vel[1] -= gravity * dt;
      pos[0] += vel[0] * dt;
      pos[1] += vel[1] * dt;
      pos[2] += vel[2] * dt;

      const canCollide = part.properties.CanCollide !== false;
      if (canCollide) {
        // Collide with anchored Workspace parts first
        for (const other of anchoredColliders) {
          if (other === part) continue;
          const op = (other.properties.Position as number[]) ?? [0, 0, 0];
          const os = (other.properties.Size as number[]) ?? [4, 1, 2];
          const overlapX = Math.abs(pos[0] - op[0]) < (sx + os[0]) / 2;
          const overlapZ = Math.abs(pos[2] - op[2]) < (sz + os[2]) / 2;
          if (!overlapX || !overlapZ) continue;

          const otherTop = op[1] + os[1] / 2;
          const otherBottom = op[1] - os[1] / 2;
          const curBottom = pos[1] - sy / 2;
          const curTop = pos[1] + sy / 2;

          if (prevBottom >= otherTop - 0.6 && curBottom <= otherTop && vel[1] <= 0) {
            pos[1] = otherTop + sy / 2;
            vel[1] = Math.abs(vel[1]) > 8 ? -vel[1] * 0.18 : 0;
            vel[0] *= 0.85;
            vel[2] *= 0.85;
            this.fireTouchOnce(part, other);
          } else if (curBottom < otherTop && curTop > otherBottom) {
            this.fireTouchOnce(part, other);
          }
        }

        // Collide with Studio Baseplate at y = 0
        if (pos[1] - sy / 2 < 0) {
          pos[1] = sy / 2;
          vel[1] = Math.abs(vel[1]) > 8 ? -vel[1] * 0.18 : 0;
          vel[0] *= 0.82;
          vel[2] *= 0.82;
        }
      }

      // FallenPartsDestroyHeight cleanup
      if (pos[1] < -100) {
        if (part.parent) {
          part.parent.children = part.parent.children.filter((c) => c !== part);
          part.parent = null;
        }
        this.partVelocities.delete(part.id);
        changed = true;
        continue;
      }

      this.partVelocities.set(part.id, vel);
      part.properties.Position = [pos[0], pos[1], pos[2]];
      part.properties.AssemblyLinearVelocity = [vel[0], vel[1], vel[2]];
      part.properties.Velocity = [vel[0], vel[1], vel[2]];
      changed = true;
    }

    if (changed) this.callbacks.onSceneUpdate();
  }

  private fireTouchOnce(partA: RBXInstanceNode, partB: RBXInstanceNode) {
    const key = partA.id < partB.id ? `${partA.id}:${partB.id}` : `${partB.id}:${partA.id}`;
    if (this.activeTouchPairs.has(key)) return;
    this.activeTouchPairs.add(key);
    this.fireSignal(`inst:${partA.id}:Touched`, [{ kind: 'inst', val: partB.id }]);
    this.fireSignal(`inst:${partB.id}:Touched`, [{ kind: 'inst', val: partA.id }]);
  }

  private checkCharacterOverlaps(hrp: RBXInstanceNode) {
    const hPos = (hrp.properties.Position as number[]) ?? [0, 3, 12];
    const hSize = (hrp.properties.Size as number[]) ?? [2, 2, 1];
    for (const part of this.getAllParts()) {
      if (part === hrp || part.parent?.id === 'char_local') continue;
      const pPos = (part.properties.Position as number[]) ?? [0, 0, 0];
      const pSize = (part.properties.Size as number[]) ?? [4, 1, 2];
      const touchX = Math.abs(hPos[0] - pPos[0]) <= (hSize[0] + pSize[0]) / 2 + 0.35;
      const touchY = Math.abs(hPos[1] - pPos[1]) <= (hSize[1] + pSize[1]) / 2 + 1.1;
      const touchZ = Math.abs(hPos[2] - pPos[2]) <= (hSize[2] + pSize[2]) / 2 + 0.35;
      const key = `${hrp.id}:${part.id}`;
      if (touchX && touchY && touchZ) {
        if (!this.activeTouchPairs.has(key)) {
          this.activeTouchPairs.add(key);
          this.fireSignal(`inst:${part.id}:Touched`, [{ kind: 'inst', val: hrp.id }]);
        }
      } else if (this.activeTouchPairs.has(key)) {
        this.activeTouchPairs.delete(key);
        this.fireSignal(`inst:${part.id}:TouchEnded`, [{ kind: 'inst', val: hrp.id }]);
      }
    }
  }

  private stepHumanoidMoveTo(dt: number) {
    if (this.humanoidMoveTargets.size === 0) return;
    let moved = false;
    for (const [humId, target] of this.humanoidMoveTargets.entries()) {
      const hum = this.findNodeById(humId);
      const hrp =
        hum?.parent?.children.find((c) => c.name === 'HumanoidRootPart' && c.isA('BasePart')) ??
        null;
      if (!hum || !hrp) {
        this.humanoidMoveTargets.delete(humId);
        continue;
      }
      const speed = Number(hum.properties.WalkSpeed ?? 16);
      const pos = Array.isArray(hrp.properties.Position)
        ? [...(hrp.properties.Position as number[])]
        : [0, 3, 0];
      const dx = target[0] - pos[0];
      const dz = target[2] - pos[2];
      const dist = Math.hypot(dx, dz);
      const step = speed * dt;
      if (dist <= step || dist < 0.05) {
        hrp.properties.Position = [target[0], pos[1], target[2]];
        this.humanoidMoveTargets.delete(humId);
      } else {
        hrp.properties.Position = [
          pos[0] + (dx / dist) * step,
          pos[1],
          pos[2] + (dz / dist) * step,
        ];
      }
      moved = true;
    }
    if (moved) this.callbacks.onSceneUpdate();
  }

  private cloneNodeTree(src: RBXInstanceNode): RBXInstanceNode {
    const copy = this.registerNode(
      new RBXInstanceNode(
        nextNodeId(src.className.toLowerCase()),
        src.name,
        src.className,
        JSON.parse(JSON.stringify(src.properties))
      )
    );
    src.tags.forEach((t) => copy.tags.add(t));
    Object.assign(copy.attributes, src.attributes);
    for (const ch of src.children) {
      this.attachChild(copy, this.cloneNodeTree(ch));
    }
    return copy;
  }

  private stepTweens(now: number) {
    if (this.activeTweens.length === 0) return;
    let updated = false;
    const remaining: ActiveTween[] = [];

    for (const tw of this.activeTweens) {
      if (!tw.playing) continue;
      if (now < tw.startTime) {
        remaining.push(tw);
        continue;
      }
      const durationMs = Math.max(16, (Number(tw.info.Time ?? 1)) * 1000);
      const rawT = Math.min(1, (now - tw.startTime) / durationMs);
      const eased = easeValue(
        rawT,
        String(tw.info.EasingStyle ?? 'Quad'),
        String(tw.info.EasingDirection ?? 'Out')
      );

      for (const [prop, goalVal] of Object.entries(tw.goalProps)) {
        const startVal = tw.startProps[prop];
        if (typeof startVal === 'number' && typeof goalVal === 'number') {
          tw.instance.properties[prop] = startVal + (goalVal - startVal) * eased;
        } else if (Array.isArray(startVal) && Array.isArray(goalVal)) {
          tw.instance.properties[prop] = startVal.map(
            (s, idx) => Number(s) + (Number(goalVal[idx] ?? s) - Number(s)) * eased
          );
          if (prop === 'CFrame' && Array.isArray(tw.instance.properties[prop])) {
            const cf = tw.instance.properties[prop] as number[];
            tw.instance.properties.Position = [cf[0], cf[1], cf[2]];
            tw.instance.properties.Rotation = [
              ((cf[3] ?? 0) * 180) / Math.PI,
              ((cf[4] ?? 0) * 180) / Math.PI,
              ((cf[5] ?? 0) * 180) / Math.PI,
            ];
          }
        } else if (
          typeof startVal === 'string' &&
          typeof goalVal === 'string' &&
          startVal.startsWith('#') &&
          goalVal.startsWith('#')
        ) {
          tw.instance.properties[prop] = lerpHex(startVal, goalVal, eased);
        }
      }
      updated = true;

      if (rawT >= 1) {
        tw.playing = false;
        this.fireSignal(`tween:${tw.tweenId}`, [{ kind: 'prim', val: 'Completed' }]);
      } else {
        remaining.push(tw);
      }
    }

    this.activeTweens = remaining;
    if (updated) this.callbacks.onSceneUpdate();
  }

  stop() {
    this.playGeneration += 1;
    this.isPlaying = false;
    this.activeTweens = [];
    this.partVelocities.clear();
    this.activeTouchPairs.clear();
    this.humanoidMoveTargets.clear();
    this.luauResumeThread = null;
    this.luauRunScript = null;
    this.luauFireSignal = null;
    this.luauDispatchAction = null;

    for (const timerId of this.scheduledTimers) {
      window.clearTimeout(timerId);
    }
    this.scheduledTimers.clear();

    if (this.heartbeatIntervalId !== null) {
      window.clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    if (this.state && !this.state.destroyed) {
      try {
        this.state.destroy();
      } catch {
        // Ignore teardown warnings on rapid restart
      }
    }
    this.state = null;
  }

  // Interactive viewport triggers
  triggerClickDetector(partId: string) {
    if (!this.isPlaying) return;
    const part = this.findNodeById(partId);
    if (!part) return;
    const cd = part.children.find((c) => c.className === 'ClickDetector');
    const lp = this.findByPath('Players')?.children.find((c) => c.className === 'Player');
    if (cd) {
      this.fireSignal(`inst:${cd.id}:MouseClick`, lp ? [{ kind: 'inst', val: lp.id }] : []);
    }
  }

  triggerProximityPrompt(promptId: string) {
    if (!this.isPlaying) return;
    const prompt = this.findNodeById(promptId);
    const lp = this.findByPath('Players')?.children.find((c) => c.className === 'Player');
    if (prompt && prompt.className === 'ProximityPrompt') {
      this.fireSignal(
        `inst:${prompt.id}:Triggered`,
        lp ? [{ kind: 'inst', val: lp.id }] : []
      );
    }
  }

  triggerPartTouched(partId: string) {
    if (!this.isPlaying) return;
    const part = this.findNodeById(partId);
    const hrp = this.findByPath('Workspace/BuilderOne/HumanoidRootPart');
    if (part && hrp) {
      this.fireSignal(`inst:${part.id}:Touched`, [{ kind: 'inst', val: hrp.id }]);
    }
  }

  triggerGuiButton(buttonId: string) {
    if (!this.isPlaying) return;
    const btn = this.findNodeById(buttonId);
    if (btn && btn.className === 'TextButton') {
      this.fireSignal(`inst:${btn.id}:MouseButton1Click`, []);
    }
  }

  triggerKeyInput(keyCode: string, isDown: boolean) {
    const shortKey = keyCode.replace(/^Enum\.KeyCode\./, '');
    if (isDown) this.keyStates.add(shortKey);
    else this.keyStates.delete(shortKey);

    if (!this.isPlaying) return;
    const uis = this.findByPath('UserInputService');
    if (uis) {
      this.fireSignal(`inst:${uis.id}:${isDown ? 'InputBegan' : 'InputEnded'}`, [
        { kind: 'input', val: shortKey },
        { kind: 'prim', val: false },
      ]);
    }
    const dispatch = this.luauDispatchAction;
    const gen = this.playGeneration;
    if (dispatch) {
      void this.enqueueVmCall(gen, () => dispatch(shortKey, isDown ? 'Begin' : 'End'));
    }
  }

  updateCharacterPosition(x: number, y: number, z: number) {
    const hrp = this.findByPath('Workspace/BuilderOne/HumanoidRootPart');
    if (hrp) {
      hrp.properties.Position = [x, y, z];
      if (this.isPlaying) {
        this.checkCharacterOverlaps(hrp);
      }
    }
  }

  async runCommandBar(rawCode: string): Promise<void> {
    const code = rawCode.trim();
    if (!code) return;

    this.emitConsole('info', 'Studio', 'CommandBar', `> ${code}`);
    const guarded = injectLuauLoopGuard(code);

    // If Playtest is active, execute directly inside the running Luau VM
    if (this.isPlaying && this.state && !this.state.destroyed && this.luauRunScript) {
      const compiled = this.state.loadstring(guarded, 'CommandBar', false);
      if (typeof compiled !== 'function') {
        const msg = String(compiled);
        const match = msg.match(/^\[string "[^"]*"\]:(\d+):\s*(.+)$/);
        const cleanMsg = match ? `Line ${match[1]}: ${match[2]}` : msg;
        this.emitConsole('error', 'Studio', 'CommandBar', cleanMsg);
        return;
      }
      const gen = this.playGeneration;
      const runner = this.luauRunScript;
      await this.enqueueVmCall(gen, () => runner(compiled, 'command_bar', 'Server', 'CommandBar'));
      this.callbacks.onSceneUpdate();
      return;
    }

    // In Edit Mode, run against a transient Luau VM bound to the current DataModel
    const gen = this.playGeneration;
    let tempVm: LuauState | null = null;
    try {
      tempVm = await LuauState.createAsync(this.buildBridgeEnv(gen));
      const preludeChunk = tempVm.loadstring(ROBLOX_LUAU_PRELUDE, 'RobloxPrelude', false);
      if (typeof preludeChunk === 'function') {
        await (preludeChunk as () => Promise<void>)();
      }
      const chunk = tempVm.loadstring(guarded, 'CommandBar', false);
      if (typeof chunk !== 'function') {
        const msg = String(chunk);
        const match = msg.match(/^\[string "[^"]*"\]:(\d+):\s*(.+)$/);
        const cleanMsg = match ? `Line ${match[1]}: ${match[2]}` : msg;
        this.emitConsole('error', 'Studio', 'CommandBar', cleanMsg);
        return;
      }
      if (this.luauRunScript) {
        await this.luauRunScript(chunk, 'command_bar', 'Server', 'CommandBar');
      } else {
        await (chunk as () => Promise<void>)();
      }
      this.callbacks.onSceneUpdate();
    } catch (err) {
      this.emitConsole(
        'error',
        'Studio',
        'CommandBar',
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      if (tempVm && !tempVm.destroyed) {
        try {
          tempVm.destroy();
        } catch {
          // Ignore teardown errors
        }
      }
    }
  }
}

function easeValue(t: number, style: string, dir: string): number {
  if (style === 'Linear') return t;
  const quad = (x: number) => x * x;
  const cubic = (x: number) => x * x * x;
  const bounceOut = (x: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  };

  if (style === 'Bounce') return dir === 'In' ? 1 - bounceOut(1 - t) : bounceOut(t);
  if (style === 'Sine') {
    if (dir === 'In') return 1 - Math.cos((t * Math.PI) / 2);
    if (dir === 'Out') return Math.sin((t * Math.PI) / 2);
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }
  const fn = style === 'Cubic' ? cubic : quad;
  if (dir === 'In') return fn(t);
  if (dir === 'Out') return 1 - fn(1 - t);
  return t < 0.5 ? fn(t * 2) / 2 : 1 - fn((1 - t) * 2) / 2;
}

function lerpHex(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.replace('#', ''), 16);
  const b = parseInt(hexB.replace('#', ''), 16);
  const r = Math.round(((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = Math.round(((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * t);
  const toH = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toH(r)}${toH(g)}${toH(bl)}`;
}
