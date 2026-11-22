import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, FileCode2, Replace, Search, Sparkles, X } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { DiagnosticItem, ScriptFile } from '../types/studio';

interface CodeEditorProps {
  scripts: ScriptFile[];
  activePath: string;
  onSelectScript: (path: string) => void;
  onChangeCode: (path: string, nextCode: string) => void;
  diagnostics: DiagnosticItem[];
}

interface AutocompleteItem {
  label: string;
  matchText?: string;
  insertText: string;
  kind: 'service' | 'method' | 'property' | 'datatype' | 'keyword' | 'enum' | 'snippet';
  detail?: string;
}

const LUAU_KEYWORDS = new Set([
  'local',
  'function',
  'end',
  'if',
  'then',
  'elseif',
  'else',
  'for',
  'in',
  'do',
  'while',
  'repeat',
  'until',
  'break',
  'continue',
  'return',
  'and',
  'or',
  'not',
  'true',
  'false',
  'nil',
  'type',
  'export',
]);

const ROBLOX_GLOBALS = new Set([
  'game',
  'workspace',
  'script',
  'Instance',
  'Vector3',
  'CFrame',
  'Color3',
  'BrickColor',
  'UDim',
  'UDim2',
  'TweenInfo',
  'RaycastParams',
  'Random',
  'Enum',
  'task',
  'coroutine',
  'math',
  'string',
  'table',
  'os',
  'print',
  'warn',
  'error',
  'assert',
  'pcall',
  'xpcall',
  'require',
  'setmetatable',
  'getmetatable',
  'ipairs',
  'pairs',
  'typeof',
  'tostring',
  'tonumber',
  'wait',
  'spawn',
  'delay',
]);

const CALLABLE_GLOBALS: Record<string, { insertText: string; detail: string }> = {
  print: { insertText: 'print($0)', detail: 'Print to Output' },
  warn: { insertText: 'warn($0)', detail: 'Warning to Output' },
  error: { insertText: 'error("$0")', detail: 'Throw runtime error' },
  assert: { insertText: 'assert($0)', detail: 'Assert condition' },
  pcall: { insertText: 'pcall(function()\n\t$0\nend)', detail: 'Protected call' },
  xpcall: { insertText: 'xpcall(function()\n\t$0\nend, warn)', detail: 'Protected call + handler' },
  require: { insertText: 'require($0)', detail: 'Load ModuleScript' },
  typeof: { insertText: 'typeof($0)', detail: 'Roblox/Luau type' },
  tostring: { insertText: 'tostring($0)', detail: 'Convert to string' },
  tonumber: { insertText: 'tonumber($0)', detail: 'Convert to number' },
  ipairs: { insertText: 'ipairs($0)', detail: 'Iterate array' },
  pairs: { insertText: 'pairs($0)', detail: 'Iterate table' },
};

const CONTEXT_SUGGESTIONS: Record<string, AutocompleteItem[]> = {
  'game:': [
    { label: 'GetService("Workspace")', insertText: 'GetService("Workspace")', kind: 'service', detail: 'Workspace service' },
    { label: 'GetService("Players")', insertText: 'GetService("Players")', kind: 'service', detail: 'Players service' },
    { label: 'GetService("ReplicatedStorage")', insertText: 'GetService("ReplicatedStorage")', kind: 'service', detail: 'Shared storage' },
    { label: 'GetService("ServerScriptService")', insertText: 'GetService("ServerScriptService")', kind: 'service', detail: 'Server scripts' },
    { label: 'GetService("TweenService")', insertText: 'GetService("TweenService")', kind: 'service', detail: 'Smooth animations' },
    { label: 'GetService("RunService")', insertText: 'GetService("RunService")', kind: 'service', detail: 'Frame loops' },
    { label: 'GetService("UserInputService")', insertText: 'GetService("UserInputService")', kind: 'service', detail: 'Keyboard input' },
    { label: 'GetService("ContextActionService")', insertText: 'GetService("ContextActionService")', kind: 'service', detail: 'Bound actions' },
    { label: 'GetService("CollectionService")', insertText: 'GetService("CollectionService")', kind: 'service', detail: 'Instance tags' },
    { label: 'GetService("DataStoreService")', insertText: 'GetService("DataStoreService")', kind: 'service', detail: 'Persistent saves' },
    { label: 'GetService("Debris")', insertText: 'GetService("Debris")', kind: 'service', detail: 'Timed cleanup' },
    { label: 'GetService("Lighting")', insertText: 'GetService("Lighting")', kind: 'service', detail: 'Atmosphere & time' },
  ],
  'Instance.': [
    { label: 'new("Part")', insertText: 'new("Part")', kind: 'method', detail: '3D Box part' },
    { label: 'new("WedgePart")', insertText: 'new("WedgePart")', kind: 'method', detail: '3D Ramp wedge' },
    { label: 'new("Model")', insertText: 'new("Model")', kind: 'method', detail: 'Group container' },
    { label: 'new("Folder")', insertText: 'new("Folder")', kind: 'method', detail: 'Organizer container' },
    { label: 'new("ScreenGui")', insertText: 'new("ScreenGui")', kind: 'method', detail: 'HUD root' },
    { label: 'new("Frame")', insertText: 'new("Frame")', kind: 'method', detail: 'UI container' },
    { label: 'new("TextLabel")', insertText: 'new("TextLabel")', kind: 'method', detail: 'UI text' },
    { label: 'new("TextButton")', insertText: 'new("TextButton")', kind: 'method', detail: 'Clickable UI' },
    { label: 'new("ClickDetector")', insertText: 'new("ClickDetector")', kind: 'method', detail: '3D click event' },
    { label: 'new("ProximityPrompt")', insertText: 'new("ProximityPrompt")', kind: 'method', detail: '[E] prompt' },
    { label: 'new("IntValue")', insertText: 'new("IntValue")', kind: 'method', detail: 'Integer value' },
    { label: 'new("RemoteEvent")', insertText: 'new("RemoteEvent")', kind: 'method', detail: 'Client-Server bridge' },
  ],
  'Vector3.': [
    { label: 'new(x, y, z)', insertText: 'new($0)', kind: 'datatype', detail: '3D vector' },
    { label: 'zero', insertText: 'zero', kind: 'property', detail: 'Vector3(0, 0, 0)' },
    { label: 'one', insertText: 'one', kind: 'property', detail: 'Vector3(1, 1, 1)' },
    { label: 'yAxis', insertText: 'yAxis', kind: 'property', detail: 'Vector3(0, 1, 0)' },
  ],
  'CFrame.': [
    { label: 'new(x, y, z)', insertText: 'new($0)', kind: 'datatype', detail: 'Position CFrame' },
    { label: 'Angles(rx, ry, rz)', insertText: 'Angles(0, math.rad($0), 0)', kind: 'method', detail: 'Rotation in radians' },
    { label: 'lookAt(pos, target)', insertText: 'lookAt($0)', kind: 'method', detail: 'Aim CFrame at target' },
    { label: 'identity', insertText: 'identity', kind: 'property', detail: 'Origin CFrame' },
  ],
  'Color3.': [
    { label: 'fromRGB(r, g, b)', insertText: 'fromRGB($0)', kind: 'method', detail: '0..255 color' },
    { label: 'fromHex("#hex")', insertText: 'fromHex("#$0")', kind: 'method', detail: 'Hex string color' },
    { label: 'fromHSV(h, s, v)', insertText: 'fromHSV($0)', kind: 'method', detail: 'HSV color' },
    { label: 'new(r, g, b)', insertText: 'new($0)', kind: 'datatype', detail: '0..1 color' },
  ],
  'UDim2.': [
    { label: 'new(xs, xo, ys, yo)', insertText: 'new($0)', kind: 'datatype', detail: 'Scale + offset' },
    { label: 'fromScale(xs, ys)', insertText: 'fromScale($0)', kind: 'method', detail: 'Responsive UI' },
    { label: 'fromOffset(xo, yo)', insertText: 'fromOffset($0)', kind: 'method', detail: 'Pixel UI size' },
  ],
  'Enum.': [
    { label: 'Material', insertText: 'Material.', kind: 'enum', detail: 'Surface material' },
    { label: 'KeyCode', insertText: 'KeyCode.', kind: 'enum', detail: 'Keyboard keys' },
    { label: 'EasingStyle', insertText: 'EasingStyle.', kind: 'enum', detail: 'Tween curve' },
    { label: 'EasingDirection', insertText: 'EasingDirection.', kind: 'enum', detail: 'In / Out / InOut' },
    { label: 'RaycastFilterType', insertText: 'RaycastFilterType.', kind: 'enum', detail: 'Exclude / Include' },
    { label: 'PartType', insertText: 'PartType.', kind: 'enum', detail: 'Block / Ball / Cylinder' },
  ],
  'Enum.Material.': [
    { label: 'Plastic', insertText: 'Plastic', kind: 'enum' },
    { label: 'SmoothPlastic', insertText: 'SmoothPlastic', kind: 'enum' },
    { label: 'Neon', insertText: 'Neon', kind: 'enum' },
    { label: 'Metal', insertText: 'Metal', kind: 'enum' },
    { label: 'Wood', insertText: 'Wood', kind: 'enum' },
    { label: 'Glass', insertText: 'Glass', kind: 'enum' },
    { label: 'ForceField', insertText: 'ForceField', kind: 'enum' },
  ],
  'Enum.KeyCode.': [
    { label: 'F', insertText: 'F', kind: 'enum' },
    { label: 'E', insertText: 'E', kind: 'enum' },
    { label: 'Q', insertText: 'Q', kind: 'enum' },
    { label: 'R', insertText: 'R', kind: 'enum' },
    { label: 'Space', insertText: 'Space', kind: 'enum' },
    { label: 'W', insertText: 'W', kind: 'enum' },
    { label: 'A', insertText: 'A', kind: 'enum' },
    { label: 'S', insertText: 'S', kind: 'enum' },
    { label: 'D', insertText: 'D', kind: 'enum' },
  ],
  'Enum.EasingStyle.': [
    { label: 'Quad', insertText: 'Quad', kind: 'enum' },
    { label: 'Linear', insertText: 'Linear', kind: 'enum' },
    { label: 'Cubic', insertText: 'Cubic', kind: 'enum' },
    { label: 'Sine', insertText: 'Sine', kind: 'enum' },
    { label: 'Bounce', insertText: 'Bounce', kind: 'enum' },
  ],
  'Enum.EasingDirection.': [
    { label: 'Out', insertText: 'Out', kind: 'enum' },
    { label: 'In', insertText: 'In', kind: 'enum' },
    { label: 'InOut', insertText: 'InOut', kind: 'enum' },
  ],
  'task.': [
    { label: 'wait(seconds)', insertText: 'wait($0)', kind: 'method', detail: 'Yield coroutine' },
    { label: 'spawn(fn)', insertText: 'spawn(function()\n\t$0\nend)', kind: 'method', detail: 'Run concurrently' },
    { label: 'delay(seconds, fn)', insertText: 'delay(1, function()\n\t$0\nend)', kind: 'method', detail: 'Schedule later' },
    { label: 'defer(fn)', insertText: 'defer(function()\n\t$0\nend)', kind: 'method', detail: 'Run next cycle' },
    { label: 'cancel(thread)', insertText: 'cancel($0)', kind: 'method', detail: 'Stop thread' },
  ],
  'math.': [
    { label: 'rad(deg)', insertText: 'rad($0)', kind: 'method', detail: 'Degrees to radians' },
    { label: 'clamp(x, min, max)', insertText: 'clamp($0)', kind: 'method', detail: 'Clamp number' },
    { label: 'random(min, max)', insertText: 'random($0)', kind: 'method', detail: 'Random integer' },
    { label: 'sin(rad)', insertText: 'sin($0)', kind: 'method' },
    { label: 'cos(rad)', insertText: 'cos($0)', kind: 'method' },
    { label: 'floor(x)', insertText: 'floor($0)', kind: 'method' },
    { label: 'abs(x)', insertText: 'abs($0)', kind: 'method' },
    { label: 'sqrt(x)', insertText: 'sqrt($0)', kind: 'method' },
  ],
  'table.': [
    { label: 'insert(t, val)', insertText: 'insert($0)', kind: 'method' },
    { label: 'remove(t, index)', insertText: 'remove($0)', kind: 'method' },
    { label: 'find(t, val)', insertText: 'find($0)', kind: 'method' },
    { label: 'sort(t)', insertText: 'sort($0)', kind: 'method' },
    { label: 'concat(t, sep)', insertText: 'concat($0)', kind: 'method' },
    { label: 'clear(t)', insertText: 'clear($0)', kind: 'method' },
  ],
  'string.': [
    { label: 'format(fmt, ...)', insertText: 'format("$0")', kind: 'method' },
    { label: 'split(str, sep)', insertText: 'split($0)', kind: 'method' },
    { label: 'sub(str, i, j)', insertText: 'sub($0)', kind: 'method' },
    { label: 'lower(str)', insertText: 'lower($0)', kind: 'method' },
    { label: 'upper(str)', insertText: 'upper($0)', kind: 'method' },
  ],
};

const COLON_SUGGESTIONS: AutocompleteItem[] = [
  { label: 'Connect(function(...) end)', matchText: 'Connect', insertText: 'Connect(function()\n\t$0\nend)', kind: 'method', detail: 'Subscribe to signal' },
  { label: 'Once(function(...) end)', matchText: 'Once', insertText: 'Once(function()\n\t$0\nend)', kind: 'method', detail: 'Fire once & disconnect' },
  { label: 'Wait()', matchText: 'Wait', insertText: 'Wait()', kind: 'method', detail: 'Yield until signal fires' },
  { label: 'FindFirstChild(name)', matchText: 'FindFirstChild', insertText: 'FindFirstChild("$0")', kind: 'method', detail: 'Safe child lookup' },
  { label: 'WaitForChild(name)', matchText: 'WaitForChild', insertText: 'WaitForChild("$0")', kind: 'method', detail: 'Yield for child' },
  { label: 'GetChildren()', matchText: 'GetChildren', insertText: 'GetChildren()', kind: 'method', detail: 'Direct children array' },
  { label: 'GetDescendants()', matchText: 'GetDescendants', insertText: 'GetDescendants()', kind: 'method', detail: 'Full subtree array' },
  { label: 'Clone()', matchText: 'Clone', insertText: 'Clone()', kind: 'method', detail: 'Duplicate instance' },
  { label: 'Destroy()', matchText: 'Destroy', insertText: 'Destroy()', kind: 'method', detail: 'Remove instance' },
  { label: 'IsA(className)', matchText: 'IsA', insertText: 'IsA("$0")', kind: 'method', detail: 'Type check' },
  { label: 'GetAttribute(name)', matchText: 'GetAttribute', insertText: 'GetAttribute("$0")', kind: 'method' },
  { label: 'SetAttribute(name, val)', matchText: 'SetAttribute', insertText: 'SetAttribute("$0", 0)', kind: 'method' },
  { label: 'GetService(name)', matchText: 'GetService', insertText: 'GetService("$0")', kind: 'method' },
  { label: 'Raycast(origin, dir, params)', matchText: 'Raycast', insertText: 'Raycast($0)', kind: 'method' },
  { label: 'Create(inst, info, goals)', matchText: 'Create', insertText: 'Create($0)', kind: 'method' },
  { label: 'Play()', matchText: 'Play', insertText: 'Play()', kind: 'method' },
  { label: 'FireServer(...)', matchText: 'FireServer', insertText: 'FireServer($0)', kind: 'method' },
  { label: 'FireClient(player, ...)', matchText: 'FireClient', insertText: 'FireClient($0)', kind: 'method' },
  { label: 'FireAllClients(...)', matchText: 'FireAllClients', insertText: 'FireAllClients($0)', kind: 'method' },
  { label: 'TakeDamage(amount)', matchText: 'TakeDamage', insertText: 'TakeDamage($0)', kind: 'method' },
  { label: 'PivotTo(cframe)', matchText: 'PivotTo', insertText: 'PivotTo($0)', kind: 'method' },
];

const GENERAL_ITEMS: AutocompleteItem[] = [
  ...Array.from(ROBLOX_GLOBALS).map((g): AutocompleteItem => {
    const callable = CALLABLE_GLOBALS[g];
    if (callable) {
      return {
        label: `${g}(...)`,
        matchText: g,
        insertText: callable.insertText,
        kind: 'method',
        detail: callable.detail,
      };
    }
    return {
      label: g,
      matchText: g,
      insertText: g,
      kind: 'datatype',
    };
  }),
  ...Array.from(LUAU_KEYWORDS).map((k): AutocompleteItem => ({
    label: k,
    matchText: k,
    insertText: k,
    kind: 'keyword',
  })),
];

const AUTO_PAIRS: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
  '"': '"',
  "'": "'",
  '`': '`',
};

const CLOSING_TO_OPEN: Record<string, string> = {
  ')': '(',
  ']': '[',
  '}': '{',
  '"': '"',
  "'": "'",
  '`': '`',
};

function stripCommentsAndStringsForBalance(source: string): string {
  let out = '';
  let i = 0;
  const len = source.length;

  while (i < len) {
    // Block comment --[[ ... ]]
    if (source.slice(i, i + 4) === '--[[') {
      const close = source.indexOf(']]', i + 4);
      if (close === -1) break;
      out += ' ';
      i = close + 2;
      continue;
    }
    // Single-line comment -- ...
    if (source[i] === '-' && source[i + 1] === '-') {
      while (i < len && source[i] !== '\n') i++;
      continue;
    }
    // Long string [[ ... ]]
    if (source[i] === '[' && source[i + 1] === '[') {
      const close = source.indexOf(']]', i + 2);
      if (close === -1) break;
      out += ' "" ';
      i = close + 2;
      continue;
    }
    // Quoted strings
    if (source[i] === '"' || source[i] === "'" || source[i] === '`') {
      const quote = source[i];
      i += 1;
      while (i < len && source[i] !== quote && source[i] !== '\n') {
        if (source[i] === '\\') i += 1;
        i += 1;
      }
      if (source[i] === quote) i += 1;
      out += ' "" ';
      continue;
    }
    out += source[i];
    i += 1;
  }
  return out;
}

function countUnclosedLuauBlocks(source: string): number {
  const clean = stripCommentsAndStringsForBalance(source);
  let blockDepth = 0;
  let repeatDepth = 0;

  const tokenRe = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(clean)) !== null) {
    const word = match[0];
    const idx = match.index;

    // Ignore table member identifiers such as obj.end or tbl:do
    let prevPos = idx - 1;
    while (prevPos >= 0 && (clean[prevPos] === ' ' || clean[prevPos] === '\t')) prevPos--;
    const prevChar = prevPos >= 0 ? clean[prevPos] : '';
    if (prevChar === '.' || prevChar === ':') continue;

    if (word === 'function' || word === 'do') {
      blockDepth += 1;
    } else if (word === 'if') {
      // Distinguish block `if ... then` from inline `if ... then ... else ...` ternary expression
      const isExpression = prevChar === '=' || prevChar === '(' || prevChar === ',' || prevChar === '{';
      if (!isExpression) {
        blockDepth += 1;
      }
    } else if (word === 'end') {
      blockDepth = Math.max(0, blockDepth - 1);
    } else if (word === 'repeat') {
      repeatDepth += 1;
    } else if (word === 'until') {
      repeatDepth = Math.max(0, repeatDepth - 1);
    }
  }

  return blockDepth + repeatDepth;
}

function highlightLuauLine(
  line: string,
  inBlockComment: boolean
): { nodes: React.ReactNode[]; endsInBlockComment: boolean } {
  const nodes: React.ReactNode[] = [];
  let i = 0;
  const len = line.length;
  let key = 0;

  if (inBlockComment) {
    const closeIdx = line.indexOf(']]');
    if (closeIdx === -1) {
      return {
        nodes: [
          <span key={0} className="text-slate-500 italic">
            {line}
          </span>,
        ],
        endsInBlockComment: true,
      };
    }
    const commentPart = line.slice(0, closeIdx + 2);
    nodes.push(
      <span key={key++} className="text-slate-500 italic">
        {commentPart}
      </span>
    );
    i = closeIdx + 2;
  }

  while (i < len) {
    if (line.slice(i, i + 4) === '--[[') {
      const closeIdx = line.indexOf(']]', i + 4);
      if (closeIdx === -1) {
        nodes.push(
          <span key={key++} className="text-slate-500 italic">
            {line.slice(i)}
          </span>
        );
        return { nodes, endsInBlockComment: true };
      }
      nodes.push(
        <span key={key++} className="text-slate-500 italic">
          {line.slice(i, closeIdx + 2)}
        </span>
      );
      i = closeIdx + 2;
      continue;
    }

    if (line[i] === '-' && line[i + 1] === '-') {
      const rest = line.slice(i);
      const isDirective = rest.trimStart().startsWith('--!');
      nodes.push(
        <span
          key={key++}
          className={isDirective ? 'text-amber-300 font-semibold' : 'text-slate-500 italic'}
        >
          {rest}
        </span>
      );
      break;
    }

    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
      let j = i + 1;
      while (j < len && line[j] !== quote) {
        if (line[j] === '\\') j++;
        j++;
      }
      const str = line.slice(i, Math.min(len, j + 1));
      nodes.push(
        <span key={key++} className="text-emerald-300">
          {str}
        </span>
      );
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(line[i])) {
      let j = i;
      while (j < len && /[0-9a-fA-FxXbB_.]/.test(line[j])) j++;
      nodes.push(
        <span key={key++} className="text-amber-300">
          {line.slice(i, j)}
        </span>
      );
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (LUAU_KEYWORDS.has(word)) {
        nodes.push(
          <span key={key++} className="text-sky-400 font-medium">
            {word}
          </span>
        );
      } else if (ROBLOX_GLOBALS.has(word)) {
        nodes.push(
          <span key={key++} className="text-indigo-300">
            {word}
          </span>
        );
      } else {
        nodes.push(<span key={key++}>{word}</span>);
      }
      i = j;
      continue;
    }

    let j = i + 1;
    while (j < len && !/[-"'`0-9a-zA-Z_]/.test(line[j])) j++;
    nodes.push(<span key={key++}>{line.slice(i, j)}</span>);
    i = j;
  }

  return { nodes, endsInBlockComment: false };
}

function getAutocompleteContext(
  code: string,
  cursor: number,
  forceOpen: boolean
): { replaceStart: number; items: AutocompleteItem[]; exactTypedWord: boolean } | null {
  const before = code.slice(0, cursor);
  const currentLine = before.split('\n').pop() ?? '';

  const trimmed = currentLine.trimStart();
  if (trimmed.startsWith('--') && !forceOpen) return null;

  // Member chains e.g. `Enum.Material.Pl` or `game:GetS` or `Vector3.n`
  const memberMatch = before.match(
    /([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*[.:])([A-Za-z0-9_]*)$/
  );
  if (memberMatch) {
    const chain = memberMatch[1];
    const prefix = memberMatch[2].toLowerCase();
    const replaceStart = cursor - memberMatch[2].length;

    if (CONTEXT_SUGGESTIONS[chain]) {
      const matches = CONTEXT_SUGGESTIONS[chain].filter(
        (it) => !prefix || (it.matchText ?? it.label).toLowerCase().startsWith(prefix)
      );
      return matches.length > 0
        ? { replaceStart, items: matches.slice(0, 10), exactTypedWord: false }
        : null;
    }

    if (chain.endsWith(':')) {
      const matches = COLON_SUGGESTIONS.filter(
        (it) => !prefix || (it.matchText ?? it.label).toLowerCase().startsWith(prefix)
      );
      return matches.length > 0
        ? { replaceStart, items: matches.slice(0, 8), exactTypedWord: false }
        : null;
    }
  }

  // Match bare identifier >= 2 chars (or forced via Ctrl+Space)
  const wordMatch = before.match(/([A-Za-z_][A-Za-z0-9_]*)$/);
  if (wordMatch && (wordMatch[1].length >= 2 || forceOpen)) {
    const raw = wordMatch[1];
    const prefix = raw.toLowerCase();
    const replaceStart = cursor - raw.length;
    const matches = GENERAL_ITEMS.filter((it) => {
      const target = (it.matchText ?? it.label).toLowerCase();
      if (!target.startsWith(prefix)) return false;
      // Hide exact-match keywords/non-callables while typing normally so Enter never hijacks `end`, `if`, `local`, etc.
      if (!forceOpen && target === prefix && it.kind !== 'method') return false;
      return true;
    });
    if (matches.length === 0) return null;
    const topTarget = (matches[0].matchText ?? matches[0].label).toLowerCase();
    return {
      replaceStart,
      items: matches.slice(0, 8),
      exactTypedWord: topTarget === prefix,
    };
  }

  if (forceOpen) {
    return { replaceStart: cursor, items: GENERAL_ITEMS.slice(0, 8), exactTypedWord: false };
  }
  return null;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  scripts,
  activePath,
  onSelectScript,
  onChangeCode,
  diagnostics,
}) => {
  const { settings } = useSettings();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  const activeScript = scripts.find((s) => s.path === activePath) ?? scripts[0];
  const code = activeScript?.code ?? '';

  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [completion, setCompletion] = useState<{
    replaceStart: number;
    cursor: number;
    items: AutocompleteItem[];
    selectedIdx: number;
    exactTypedWord: boolean;
    top: number;
    left: number;
  } | null>(null);

  const lines = useMemo(() => code.split('\n'), [code]);

  const findMatches = useMemo(() => {
    if (!findOpen || !findQuery) return [] as { start: number; end: number }[];
    const q = findQuery.toLowerCase();
    const hay = code.toLowerCase();
    const matches: { start: number; end: number }[] = [];
    let idx = 0;
    while (idx <= hay.length - q.length) {
      const found = hay.indexOf(q, idx);
      if (found === -1) break;
      matches.push({ start: found, end: found + q.length });
      idx = found + Math.max(1, q.length);
      if (matches.length >= 500) break;
    }
    return matches;
  }, [code, findOpen, findQuery]);

  const highlightedLines = useMemo(() => {
    let inBlock = false;
    return lines.map((ln) => {
      const res = highlightLuauLine(ln, inBlock);
      inBlock = res.endsInBlockComment;
      return res.nodes;
    });
  }, [lines]);

  const activeDiagnostics = useMemo(
    () => diagnostics.filter((d) => d.scriptPath === activeScript?.path),
    [diagnostics, activeScript?.path]
  );

  const errorLines = useMemo(() => {
    const map = new Map<number, DiagnosticItem>();
    for (const d of activeDiagnostics) map.set(d.line, d);
    return map;
  }, [activeDiagnostics]);

  useEffect(() => {
    setCompletion(null);
    setCursorPos({ line: 1, col: 1 });
  }, [activeScript?.path]);

  const syncCursorPos = (src: string, pos: number) => {
    const before = src.slice(0, pos);
    const split = before.split('\n');
    const line = split.length;
    const col = (split[split.length - 1] ?? '').length + 1;
    setCursorPos({ line, col });
  };

  const computePopupCoords = (src: string, cursor: number) => {
    const el = textareaRef.current;
    const before = src.slice(0, cursor);
    const linesBefore = before.split('\n');
    const lineIdx = linesBefore.length - 1;
    const rawColText = linesBefore[lineIdx] ?? '';
    const tabSpaces = ' '.repeat(settings.tabSize);
    const visualCols = rawColText.replace(/\t/g, tabSpaces).length;

    const fontPx = settings.editorFontSize;
    const lineHeightPx = fontPx * 1.65;
    const charWidthPx = fontPx * 0.6;
    const scrollTop = el?.scrollTop ?? 0;
    const scrollLeft = el?.scrollLeft ?? 0;
    const maxW = Math.max(240, (el?.clientWidth ?? 480) - 270);
    const maxH = Math.max(80, (el?.clientHeight ?? 320) - 190);

    const rawTop = 14 + (lineIdx + 1) * lineHeightPx - scrollTop + 4;
    const rawLeft = 16 + visualCols * charWidthPx - scrollLeft;

    return {
      top: Math.max(12, Math.min(maxH, rawTop)),
      left: Math.max(12, Math.min(maxW, rawLeft)),
    };
  };

  const refreshAutocomplete = (src: string, cursor: number, forceOpen = false) => {
    if (!settings.autocompleteEnabled && !forceOpen) {
      setCompletion(null);
      return;
    }
    const ctx = getAutocompleteContext(src, cursor, forceOpen);
    if (!ctx) {
      setCompletion(null);
      return;
    }
    const coords = computePopupCoords(src, cursor);
    setCompletion({
      replaceStart: ctx.replaceStart,
      cursor,
      items: ctx.items,
      selectedIdx: 0,
      exactTypedWord: ctx.exactTypedWord,
      top: coords.top,
      left: coords.left,
    });
  };

  const applyEdit = (
    nextCode: string,
    selStart: number,
    selEnd = selStart,
    checkAutocomplete = false
  ) => {
    if (!activeScript) return;
    onChangeCode(activeScript.path, nextCode);
    syncCursorPos(nextCode, selStart);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.selectionStart = selStart;
        el.selectionEnd = selEnd;
      }
      if (checkAutocomplete) {
        refreshAutocomplete(nextCode, selStart, false);
      }
    });
  };

  const acceptCompletion = (item: AutocompleteItem) => {
    if (!activeScript || !completion) return;
    const lineStart = code.lastIndexOf('\n', completion.replaceStart - 1) + 1;
    const baseIndent = code.slice(lineStart, completion.replaceStart).match(/^[\t ]*/)?.[0] ?? '';

    const expanded = item.insertText.replace(/\n/g, `\n${baseIndent}`);
    const markerIdx = expanded.indexOf('$0');
    const cleanText = markerIdx >= 0 ? expanded.replace('$0', '') : expanded;
    const cursorOffset = markerIdx >= 0 ? markerIdx : cleanText.length;

    const next =
      code.slice(0, completion.replaceStart) +
      cleanText +
      code.slice(completion.cursor);
    const nextCursor = completion.replaceStart + cursorOffset;

    setCompletion(null);
    applyEdit(next, nextCursor, nextCursor, cleanText.endsWith('.'));
  };

  const jumpToLine = (lineNum: number) => {
    const el = textareaRef.current;
    if (!el) return;
    const split = code.split('\n');
    const targetIdx = Math.max(0, Math.min(split.length - 1, lineNum - 1));
    let pos = 0;
    for (let i = 0; i < targetIdx; i++) pos += split[i].length + 1;
    el.focus();
    el.selectionStart = el.selectionEnd = pos;
    syncCursorPos(code, pos);
  };

  const jumpToFindMatch = (dir: 1 | -1) => {
    if (findMatches.length === 0) return;
    const el = textareaRef.current;
    const curStart = el?.selectionStart ?? 0;
    let target = findMatches[0];
    if (dir === 1) {
      target = findMatches.find((m) => m.start > curStart) ?? findMatches[0];
    } else {
      const prev = [...findMatches].reverse().find((m) => m.start < curStart);
      target = prev ?? findMatches[findMatches.length - 1];
    }
    if (el) {
      el.focus();
      el.selectionStart = target.start;
      el.selectionEnd = target.end;
      syncCursorPos(code, target.start);
    }
  };

  const handleReplaceCurrent = () => {
    if (!activeScript || !findQuery || findMatches.length === 0) return;
    const el = textareaRef.current;
    const selStart = el?.selectionStart ?? 0;
    const selEnd = el?.selectionEnd ?? 0;
    const selectedText = code.slice(selStart, selEnd);
    const match =
      selectedText.toLowerCase() === findQuery.toLowerCase()
        ? { start: selStart, end: selEnd }
        : findMatches.find((m) => m.start >= selStart) ?? findMatches[0];
    const next = code.slice(0, match.start) + replaceQuery + code.slice(match.end);
    applyEdit(next, match.start, match.start + replaceQuery.length);
  };

  const handleReplaceAll = () => {
    if (!activeScript || !findQuery || findMatches.length === 0) return;
    let out = '';
    let last = 0;
    for (const m of findMatches) {
      out += code.slice(last, m.start) + replaceQuery;
      last = m.end;
    }
    out += code.slice(last);
    applyEdit(out, 0, 0);
  };

  const handleScroll = () => {
    if (!textareaRef.current) return;
    const { scrollTop, scrollLeft } = textareaRef.current;
    if (backdropRef.current) {
      backdropRef.current.scrollTop = scrollTop;
      backdropRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop;
    }
    setCompletion(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeScript) return;
    let nextCode = e.target.value;
    let cursor = e.target.selectionStart ?? nextCode.length;

    // Auto-dedent when finishing `end`, `else`, `elseif`, or `until` on an indented line
    const lineStart = nextCode.lastIndexOf('\n', cursor - 1) + 1;
    const beforeInLine = nextCode.slice(lineStart, cursor);
    const afterInLine = nextCode.slice(
      cursor,
      nextCode.indexOf('\n', cursor) === -1 ? nextCode.length : nextCode.indexOf('\n', cursor)
    );
    if (
      settings.autoIndentBlocks &&
      /^\t+(end|else|elseif|until)$/.test(beforeInLine) &&
      afterInLine.trim() === ''
    ) {
      // Remove one leading tab so it aligns cleanly with its opener
      nextCode = nextCode.slice(0, lineStart) + nextCode.slice(lineStart + 1);
      cursor = Math.max(lineStart, cursor - 1);
      onChangeCode(activeScript.path, nextCode);
      syncCursorPos(nextCode, cursor);
      setCompletion(null);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = cursor;
        }
      });
      return;
    }

    onChangeCode(activeScript.path, nextCode);
    syncCursorPos(nextCode, cursor);
    refreshAutocomplete(nextCode, cursor, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!activeScript) return;
    const el = e.currentTarget;
    const start = el.selectionStart;
    const end = el.selectionEnd;

    // Ctrl+F / Cmd+F opens Find & Replace bar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      const selected = code.slice(start, end);
      if (selected && !selected.includes('\n')) setFindQuery(selected);
      setFindOpen(true);
      requestAnimationFrame(() => findInputRef.current?.focus());
      return;
    }

    // Ctrl+/ or Cmd+/ toggles `-- ` comment on current/selected lines
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      setCompletion(null);
      const blockStart = code.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = code.indexOf('\n', end);
      const blockEnd = lineEndIdx === -1 ? code.length : lineEndIdx;
      const selectedBlock = code.slice(blockStart, blockEnd);
      const blockLines = selectedBlock.split('\n');
      const allCommented = blockLines.every((ln) => ln.trim() === '' || /^\s*--/.test(ln));

      let deltaTotal = 0;
      const updated = blockLines.map((ln) => {
        if (ln.trim() === '') return ln;
        if (allCommented) {
          const nextLn = ln.replace(/^(\s*)--\s?/, '$1');
          deltaTotal -= ln.length - nextLn.length;
          return nextLn;
        }
        const m = ln.match(/^(\s*)(.*)$/);
        const indent = m?.[1] ?? '';
        const body = m?.[2] ?? ln;
        deltaTotal += 3;
        return `${indent}-- ${body}`;
      });
      const next = code.slice(0, blockStart) + updated.join('\n') + code.slice(blockEnd);
      const nextPos = Math.max(blockStart, end + deltaTotal);
      applyEdit(next, nextPos, nextPos);
      return;
    }

    // Ctrl+D / Cmd+D duplicates current line or selection
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      setCompletion(null);
      const blockStart = code.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = code.indexOf('\n', end);
      const blockEnd = lineEndIdx === -1 ? code.length : lineEndIdx;
      const chunk = code.slice(blockStart, blockEnd);
      const next = code.slice(0, blockEnd) + '\n' + chunk + code.slice(blockEnd);
      applyEdit(next, blockEnd + 1, blockEnd + 1 + chunk.length);
      return;
    }

    // Alt+ArrowUp / Alt+ArrowDown moves selected line(s) up or down (Roblox Studio QoL)
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setCompletion(null);
      const blockStart = code.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = code.indexOf('\n', end);
      const blockEnd = lineEndIdx === -1 ? code.length : lineEndIdx;

      if (e.key === 'ArrowUp' && blockStart > 0) {
        const prevLineStart = code.lastIndexOf('\n', blockStart - 2) + 1;
        const prevLine = code.slice(prevLineStart, blockStart - 1);
        const curBlock = code.slice(blockStart, blockEnd);
        const next = code.slice(0, prevLineStart) + curBlock + '\n' + prevLine + code.slice(blockEnd);
        const shift = -(prevLine.length + 1);
        applyEdit(next, start + shift, end + shift);
      } else if (e.key === 'ArrowDown' && blockEnd < code.length) {
        const nextLineEndIdx = code.indexOf('\n', blockEnd + 1);
        const nextLineEnd = nextLineEndIdx === -1 ? code.length : nextLineEndIdx;
        const nextLine = code.slice(blockEnd + 1, nextLineEnd);
        const curBlock = code.slice(blockStart, blockEnd);
        const next = code.slice(0, blockStart) + nextLine + '\n' + curBlock + code.slice(nextLineEnd);
        const shift = nextLine.length + 1;
        applyEdit(next, start + shift, end + shift);
      }
      return;
    }

    // Ctrl+Space opens IntelliSense manually
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      refreshAutocomplete(code, start, true);
      return;
    }

    // Escape closes autocomplete
    if (completion && e.key === 'Escape') {
      e.preventDefault();
      setCompletion(null);
      return;
    }

    // Autocomplete keyboard navigation & acceptance
    if (completion && completion.items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCompletion((prev) =>
          prev ? { ...prev, selectedIdx: (prev.selectedIdx + 1) % prev.items.length } : null
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCompletion((prev) =>
          prev
            ? {
                ...prev,
                selectedIdx: (prev.selectedIdx - 1 + prev.items.length) % prev.items.length,
              }
            : null
        );
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        acceptCompletion(completion.items[completion.selectedIdx] ?? completion.items[0]);
        return;
      }
      // Enter accepts autocomplete ONLY if the user hasn't already finished typing an exact identifier
      if (e.key === 'Enter' && !completion.exactTypedWord) {
        e.preventDefault();
        acceptCompletion(completion.items[completion.selectedIdx] ?? completion.items[0]);
        return;
      }
    }

    // Auto-close pairs & wrap selection
    if (settings.autoClosePairs && !e.ctrlKey && !e.metaKey && !e.altKey && e.key in AUTO_PAIRS) {
      const openChar = e.key;
      const closeChar = AUTO_PAIRS[openChar];
      const nextChar = code[end] ?? '';
      const prevChar = code[start - 1] ?? '';

      // Wrap selected text
      if (start !== end) {
        e.preventDefault();
        const selected = code.slice(start, end);
        const next = code.slice(0, start) + openChar + selected + closeChar + code.slice(end);
        applyEdit(next, start + 1, end + 1);
        return;
      }

      // Quote overtype: typing closing quote when already sitting on it steps over it
      if (openChar === closeChar && nextChar === closeChar) {
        e.preventDefault();
        el.selectionStart = el.selectionEnd = start + 1;
        syncCursorPos(code, start + 1);
        setCompletion(null);
        return;
      }

      const isQuote = openChar === '"' || openChar === "'" || openChar === '`';
      const shouldAutoCloseQuote =
        isQuote &&
        !/[A-Za-z0-9_"'`]/.test(prevChar) &&
        (!nextChar || /[\s)\]},;.]/.test(nextChar));
      const shouldAutoCloseBracket =
        !isQuote && (!nextChar || /[\s)\]},;.]/.test(nextChar));

      if (shouldAutoCloseQuote || shouldAutoCloseBracket) {
        e.preventDefault();
        const next = code.slice(0, start) + openChar + closeChar + code.slice(end);
        setCompletion(null);
        applyEdit(next, start + 1, start + 1);
        return;
      }
    }

    // Overtype closing bracket when cursor is already before it
    if (settings.autoClosePairs && !e.ctrlKey && !e.metaKey && !e.altKey && e.key in CLOSING_TO_OPEN && start === end) {
      if (code[start] === e.key) {
        e.preventDefault();
        el.selectionStart = el.selectionEnd = start + 1;
        syncCursorPos(code, start + 1);
        setCompletion(null);
        return;
      }
    }

    // Backspace deletes matching empty pair (`(|)`, `"|"`, `{|}`, `[|]`)
    if (settings.autoClosePairs && e.key === 'Backspace' && start === end && start > 0) {
      const prevChar = code[start - 1];
      const nextChar = code[start];
      if (AUTO_PAIRS[prevChar] === nextChar) {
        e.preventDefault();
        const next = code.slice(0, start - 1) + code.slice(start + 1);
        setCompletion(null);
        applyEdit(next, start - 1, start - 1);
        return;
      }
    }

    // Roblox Studio Smart Enter: split pairs `{|}`/`(|)`, indent blocks, and auto-insert `end`
    if (e.key === 'Enter' && settings.autoIndentBlocks) {
      e.preventDefault();
      setCompletion(null);

      const lineStart = code.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = code.indexOf('\n', end);
      const lineEnd = lineEndIdx === -1 ? code.length : lineEndIdx;

      const lineBefore = code.slice(lineStart, start);
      const lineAfter = code.slice(end, lineEnd);
      const baseIndent = lineBefore.match(/^[\t ]*/)?.[0] ?? '';
      const trimmedBefore = lineBefore.trim();
      const trimmedAfter = lineAfter.trim();

      const prevChar = code[start - 1];
      const nextChar = code[end];

      // 1. Splitting `{|}` or `(|)` (non-function) across 3 lines
      if ((prevChar === '{' && nextChar === '}') || (prevChar === '(' && nextChar === ')' && !/function\s*\(\s*$/.test(trimmedBefore))) {
        const insert = `\n${baseIndent}\t\n${baseIndent}`;
        const next = code.slice(0, start) + insert + code.slice(end);
        applyEdit(next, start + 1 + baseIndent.length + 1);
        return;
      }

      // 2. Check if current line opens a Luau block
      const opensAutoEndBlock =
        /\b(then|do)$/.test(trimmedBefore) ||
        /^(?:local\s+)?function\b.*\)\s*(?::\s*[\w.<>\[\]?|]+\s*)?$/.test(trimmedBefore) ||
        /(?:=|return|\(|,)\s*function\s*\([^)]*\)\s*(?::\s*[\w.<>\[\]?|]+\s*)?$/.test(trimmedBefore);

      const opensIndentOnly =
        /\b(else|repeat)$/.test(trimmedBefore) || /[{(]\s*$/.test(trimmedBefore);

      // Handle `Connect(function(hit)|)` where `)` sits right after cursor
      const isCallbackWithTrailingParen =
        opensAutoEndBlock && /^\)\s*,?\s*$/.test(trimmedAfter);

      if (opensAutoEndBlock && (trimmedAfter === '' || isCallbackWithTrailingParen)) {
        // Only auto-insert `end` when the file currently has an unclosed block
        const unclosed = countUnclosedLuauBlocks(code);
        if (unclosed > 0) {
          const insert = `\n${baseIndent}\t\n${baseIndent}end`;
          const next = code.slice(0, start) + insert + code.slice(end);
          applyEdit(next, start + 1 + baseIndent.length + 1);
          return;
        }
      }

      const nextIndent =
        opensAutoEndBlock || opensIndentOnly ? `${baseIndent}\t` : baseIndent;
      const insert = `\n${nextIndent}`;
      const next = code.slice(0, start) + insert + code.slice(end);
      applyEdit(next, start + insert.length);
      return;
    }

    // Roblox Studio Tab / Shift+Tab (supports multi-line selections cleanly)
    if (e.key === 'Tab') {
      e.preventDefault();
      setCompletion(null);

      const blockStart = code.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = code.indexOf('\n', end);
      const blockEnd = lineEndIdx === -1 ? code.length : lineEndIdx;
      const hasMultiLine = start !== end && code.slice(start, end).includes('\n');

      if (e.shiftKey || hasMultiLine) {
        const selectedBlock = code.slice(blockStart, blockEnd);
        const blockLines = selectedBlock.split('\n');
        let firstLineDelta = 0;
        let totalDelta = 0;

        const updatedLines = blockLines.map((ln, idx) => {
          if (e.shiftKey) {
            let removed = 0;
            if (ln.startsWith('\t')) removed = 1;
            else if (ln.startsWith('  ')) removed = 2;
            else if (ln.startsWith(' ')) removed = 1;
            if (idx === 0) firstLineDelta = -removed;
            totalDelta -= removed;
            return ln.slice(removed);
          } else {
            if (idx === 0) firstLineDelta = 1;
            totalDelta += 1;
            return `\t${ln}`;
          }
        });

        const next = code.slice(0, blockStart) + updatedLines.join('\n') + code.slice(blockEnd);
        const nextStart = Math.max(blockStart, start + firstLineDelta);
        const nextEnd = Math.max(nextStart, end + totalDelta);
        applyEdit(next, nextStart, nextEnd);
      } else {
        const next = code.slice(0, start) + '\t' + code.slice(end);
        applyEdit(next, start + 1, start + 1);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0F1520] min-h-0">
      {/* Multi-file Script Tabs + Find Toggle */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-[#121824] border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto min-w-0">
          {scripts.map((s) => {
            const isActive = s.path === activeScript?.path;
            const hasErr = diagnostics.some((d) => d.scriptPath === s.path);
            const badgeColor =
              s.className === 'Script'
                ? 'text-emerald-400'
                : s.className === 'LocalScript'
                ? 'text-sky-400'
                : 'text-violet-400';

            return (
              <button
                key={s.path}
                type="button"
                onClick={() => onSelectScript(s.path)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#1D273B] text-slate-100 border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <FileCode2 className={`w-3.5 h-3.5 ${badgeColor}`} />
                <span>{s.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {s.className === 'Script' ? 'Server' : s.className === 'LocalScript' ? 'Client' : 'Module'}
                </span>
                {hasErr && <AlertCircle className="w-3 h-3 text-rose-400" />}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setFindOpen((v) => !v);
            requestAnimationFrame(() => findInputRef.current?.focus());
          }}
          title="Find & Replace (Ctrl+F)"
          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium shrink-0 transition-colors cursor-pointer ${
            findOpen
              ? 'bg-[#1D273B] text-sky-300 border border-slate-700'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Find</span>
        </button>
      </div>

      {/* Inline Find & Replace Bar */}
      {findOpen && (
        <div className="px-3 py-1.5 bg-[#0C111A] border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5 bg-[#121824] border border-slate-700 rounded px-2 py-1">
            <Search className="w-3 h-3 text-slate-500 shrink-0" />
            <input
              ref={findInputRef}
              type="text"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  jumpToFindMatch(e.shiftKey ? -1 : 1);
                } else if (e.key === 'Escape') {
                  setFindOpen(false);
                  textareaRef.current?.focus();
                }
              }}
              placeholder="Find in script..."
              className="bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-36 sm:w-44"
            />
            {findQuery && (
              <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                {findMatches.length}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => jumpToFindMatch(-1)}
            disabled={findMatches.length === 0}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
            title="Previous match (Shift+Enter)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => jumpToFindMatch(1)}
            disabled={findMatches.length === 0}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-40 cursor-pointer"
            title="Next match (Enter)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setShowReplace((r) => !r)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium cursor-pointer ${
              showReplace ? 'bg-slate-800 text-sky-300' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Replace"
          >
            <Replace className="w-3 h-3" />
            <span>Replace</span>
          </button>

          {showReplace && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setFindOpen(false);
                    textareaRef.current?.focus();
                  }
                }}
                placeholder="Replace with..."
                className="bg-[#121824] border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-32"
              />
              <button
                type="button"
                onClick={handleReplaceCurrent}
                disabled={findMatches.length === 0}
                className="px-2 py-1 rounded bg-[#192233] hover:bg-[#233047] disabled:opacity-40 text-slate-200 text-[11px] font-medium cursor-pointer"
              >
                One
              </button>
              <button
                type="button"
                onClick={handleReplaceAll}
                disabled={findMatches.length === 0}
                className="px-2 py-1 rounded bg-[#2563EB] hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-medium cursor-pointer"
              >
                All
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setFindOpen(false);
              textareaRef.current?.focus();
            }}
            className="ml-auto p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            aria-label="Close find bar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Synchronized Line Numbers + Highlighted Backdrop + Editable Textarea + Luau Autocomplete */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div
          ref={gutterRef}
          className="w-12 py-3.5 pb-8 bg-[#0C111A] border-r border-slate-800/80 text-right pr-3 select-none overflow-hidden font-mono leading-[1.65] text-slate-600 tabular-nums shrink-0"
          style={{ fontSize: `${settings.editorFontSize}px` }}
        >
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const err = errorLines.get(lineNum);
            const isActiveLine = settings.highlightActiveLine && cursorPos.line === lineNum;
            return (
              <div
                key={lineNum}
                title={err?.message}
                className={
                  err
                    ? 'text-rose-400 font-semibold bg-rose-500/15 -mr-3 pr-3'
                    : isActiveLine
                    ? 'text-slate-300 bg-slate-800/35 -mr-3 pr-3'
                    : ''
                }
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        <div className="relative flex-1 min-w-0 overflow-hidden">
          <div
            ref={backdropRef}
            aria-hidden="true"
            className={`absolute inset-0 py-3.5 pb-8 px-4 font-mono leading-[1.65] text-slate-200 overflow-hidden pointer-events-none ${
              settings.wordWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
            }`}
            style={{ tabSize: settings.tabSize, fontSize: `${settings.editorFontSize}px` }}
          >
            {highlightedLines.map((nodes, idx) => {
              const hasErr = errorLines.has(idx + 1);
              const isActiveLine = settings.highlightActiveLine && cursorPos.line === idx + 1;
              return (
                <div
                  key={idx}
                  className={
                    hasErr
                      ? 'bg-rose-500/10'
                      : isActiveLine
                      ? 'bg-slate-800/30 -mx-4 px-4'
                      : ''
                  }
                >
                  {lines[idx].length > 0 ? nodes : ' '}
                </div>
              );
            })}
          </div>

          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              setCompletion(null);
              syncCursorPos(code, e.currentTarget.selectionStart ?? 0);
            }}
            onKeyUp={(e) => {
              if (
                e.key === 'ArrowLeft' ||
                e.key === 'ArrowRight' ||
                e.key === 'Home' ||
                e.key === 'End' ||
                ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !completion)
              ) {
                syncCursorPos(code, e.currentTarget.selectionStart ?? 0);
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label="Luau code editor"
            className={`relative z-10 w-full h-full py-3.5 pb-8 px-4 bg-transparent text-transparent caret-blue-400 font-mono leading-[1.65] resize-none focus:outline-none ${
              settings.wordWrap
                ? 'whitespace-pre-wrap break-words overflow-y-auto overflow-x-hidden'
                : 'whitespace-pre overflow-auto'
            }`}
            style={{ tabSize: settings.tabSize, fontSize: `${settings.editorFontSize}px` }}
          />

          {/* Floating Roblox Studio IntelliSense Autocomplete */}
          {completion && completion.items.length > 0 && (
            <div
              className="absolute z-30 w-64 bg-[#111927] border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
              style={{ top: completion.top, left: completion.left }}
            >
              <div className="px-2.5 py-1 bg-[#0B101B] border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                <span className="flex items-center gap-1 font-medium text-sky-300">
                  <Sparkles className="w-3 h-3" />
                  Luau IntelliSense
                </span>
                <span>Tab{completion.exactTypedWord ? '' : ' / Enter'}</span>
              </div>
              <div className="max-h-44 overflow-y-auto py-1">
                {completion.items.map((item, idx) => {
                  const selected = idx === completion.selectedIdx;
                  return (
                    <button
                      key={`${item.label}_${idx}`}
                      type="button"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        acceptCompletion(item);
                      }}
                      className={`w-full px-2.5 py-1 text-left flex items-center justify-between gap-2 text-xs font-mono cursor-pointer ${
                        selected
                          ? 'bg-blue-600/30 text-white'
                          : 'text-slate-300 hover:bg-slate-800/70'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.detail && (
                        <span className="text-[10px] font-sans text-slate-500 shrink-0">
                          {item.detail}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed-Height Studio Status Footer (no layout shift when errors appear) */}
      <div className="h-6 px-3 bg-[#0C111A] border-t border-slate-800/80 flex items-center justify-between gap-3 text-[11px] shrink-0">
        {activeDiagnostics.length > 0 ? (
          <button
            type="button"
            onClick={() => jumpToLine(activeDiagnostics[0].line)}
            className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 truncate cursor-pointer text-left"
            title={activeDiagnostics[0].message}
          >
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span className="truncate">
              Line {activeDiagnostics[0].line}: {activeDiagnostics[0].message}
            </span>
          </button>
        ) : (
          <span className="text-slate-500 truncate">
            Luau · Ctrl+Space IntelliSense
          </span>
        )}
        <span className="text-slate-500 font-mono tabular-nums shrink-0">
          Ln {cursorPos.line}, Col {cursorPos.col}
        </span>
      </div>
    </div>
  );
};

