import { LessonDefinition, VerificationContext } from '../types/studio';

function passFail(
  checks: { label: string; passed: boolean; detail?: string }[],
  successMsg: string
) {
  const passed = checks.every((c) => c.passed);
  return {
    passed,
    summary: passed
      ? successMsg
      : 'Almost there—review the unfinished checklist item(s) below and press Play again.',
    checks,
  };
}

export const CURRICULUM_PART_1: LessonDefinition[] = [
  // =========================================================================
  // MODULE 1: ABSOLUTE ZERO — FIRST CODE & LUAU BASICS
  // =========================================================================
  {
    id: 'm1_l1_print',
    moduleId: 'm1',
    moduleNumber: 1,
    moduleTitle: 'Absolute Zero: First Code & Luau Basics',
    lessonNumber: 1,
    title: 'Your Very First Line of Code: print()',
    tier: 'Absolute Zero',
    xp: 50,
    estimatedMinutes: 3,
    summary: 'Learn what a Script is, what text strings are, and how to make Roblox Studio talk to you in the Output console.',
    explanation: [
      'Welcome! If you have never written a single line of code before, you are in the exact right place. In Roblox Studio, you control the game by writing instructions inside a Script.',
      'The simplest instruction in Luau (Roblox’s programming language) is print(). Whatever text you put inside quotation marks "..." inside the parentheses will appear in the Output console below when you press Play.',
      'Think of quotation marks as a wrapper telling Roblox: "This is plain human words, not a command."'
    ],
    beginnerTip: 'Always match your opening and closing quotation marks ("Hello!") and parentheses ( ). If one is missing, Roblox cannot read the sentence.',
    codeExample: 'print("Hello, Roblox!")\nprint("My first game starts here!")',
    objectives: [
      'Click Play to run the starter print() line.',
      'Add a second print("...") line with any custom message you want.',
      'Confirm at least 2 messages appear in the Output console.'
    ],
    hints: [
      'On line 3, type: print("I am learning Luau!")',
      'Make sure your text is wrapped in double quotes "like this" inside the parentheses.'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/FirstScript',
        name: 'FirstScript',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `-- Welcome to your very first Roblox Script!
-- Anything starting with "--" is a human note (a comment) that Roblox ignores.

print("Hello, Roblox!")
-- Add your own print("...") line below and press Play!
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const prints = ctx.logs.filter((l) => l.level === 'print');
      return passFail(
        [
          { label: 'Press Play to execute your script', passed: ctx.hasRunPlay },
          { label: 'Print at least 2 messages to Output', passed: prints.length >= 2, detail: `Found ${prints.length} printed line(s)` },
        ],
        'Awesome! You just wrote and executed your first Luau program.'
      );
    },
  },
  {
    id: 'm1_l2_variables',
    moduleId: 'm1',
    moduleNumber: 1,
    moduleTitle: 'Absolute Zero: First Code & Luau Basics',
    lessonNumber: 2,
    title: 'Variables: Storing Names, Numbers & True/False',
    tier: 'Absolute Zero',
    xp: 60,
    estimatedMinutes: 5,
    summary: 'Store numbers, text strings, and booleans inside labeled boxes called variables.',
    explanation: [
      'Games constantly need to remember things: how many coins a player has, their username, or whether a door is open. We store those values in variables using the keyword local.',
      'Every variable has a data type: strings (text in quotes like "Knight"), numbers (like 100 or 3.5), and booleans (true or false).',
      'Luau also lets you blend variables straight into backtick text using curly braces: `Coins: {coins}`.'
    ],
    beginnerTip: 'Variable names cannot have spaces. Use camelCase like playerHealth or isAlive.',
    codeExample: 'local heroName = "Alex"\nlocal coins = 50\nlocal isVip = true\nprint(`{heroName} has {coins} coins`)',
    objectives: [
      'Create a local variable named playerName holding a string.',
      'Create a local variable named coins holding a number greater than 0.',
      'Print both values using `...` string interpolation or commas.'
    ],
    hints: [
      'Example: local playerName = "BuilderOne"',
      'Example: local coins = 100',
      'Then write: print(`{playerName} has {coins} coins`)'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/VariablesScript',
        name: 'VariablesScript',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `-- Create your variables below:
local playerName = "Starter"
local coins = 0

-- Change coins above to a number > 0, add a boolean like: local hasKey = true
-- Then print a message combining playerName and coins!
print(playerName, coins)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const code = ctx.scripts['ServerScriptService/VariablesScript'] ?? '';
      const prints = ctx.logs.filter((l) => l.level === 'print');
      const hasNonZeroPrint = prints.some((p) => /[1-9]\d*/.test(p.message));
      return passFail(
        [
          { label: 'Declare local playerName and local coins', passed: /local\s+playerName\s*=/.test(code) && /local\s+coins\s*=/.test(code) },
          { label: 'Run Play and print a non-zero coin value', passed: ctx.hasRunPlay && hasNonZeroPrint },
        ],
        'Variables mastered! You can now store and format game data.'
      );
    },
  },
  {
    id: 'm1_l3_decisions',
    moduleId: 'm1',
    moduleNumber: 1,
    moduleTitle: 'Absolute Zero: First Code & Luau Basics',
    lessonNumber: 3,
    title: 'Math & Decisions: if / elseif / else',
    tier: 'Absolute Zero',
    xp: 75,
    estimatedMinutes: 6,
    summary: 'Teach your game to make choices based on scores, keys, or player health.',
    explanation: [
      'A game needs rules: "IF the player has at least 50 coins, open the gate; ELSE tell them they need more coins."',
      'In Luau, we write decisions with if ... then ... elseif ... else ... end. Notice how every if block closes with the word end.',
      'Use == to check if two things are equal, ~= for not equal, >= for greater-or-equal, and "and" / "or" to combine conditions.'
    ],
    beginnerTip: 'A single = stores a value (local x = 5). A double == asks a question (if x == 5 then).',
    codeExample: 'local coins = 60\nif coins >= 50 then\n\tprint("Gate unlocked!")\nelse\n\tprint("Need more coins")\nend',
    objectives: [
      'Set coins to 75 (or higher) and level to 3 (or higher).',
      'Write an if / else check verifying coins >= 50 and level >= 2.',
      'Print "VIP Access Granted" when both conditions pass.'
    ],
    hints: [
      'Combine two checks with "and": if coins >= 50 and level >= 2 then',
      'Don’t forget the closing "end" keyword!'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/VipGateScript',
        name: 'VipGateScript',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local coins = 20
local level = 1

-- Update coins and level above, and fix the condition to require coins >= 50 and level >= 2
if coins >= 50 then
\tprint("VIP Access Granted")
else
\tprint("Access Denied")
end
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const code = ctx.scripts['ServerScriptService/VipGateScript'] ?? '';
      const granted = ctx.logs.some((l) => l.level === 'print' && l.message.includes('VIP Access Granted'));
      const usesAnd = /and\s+level\s*>=/.test(code) || /level\s*>=\s*2\s+and/.test(code);
      return passFail(
        [
          { label: 'Use both coins and level in the if condition with "and"', passed: usesAnd },
          { label: 'Print "VIP Access Granted" in Output', passed: ctx.hasRunPlay && granted },
        ],
        'Great logic! Your scripts can now enforce real game rules.'
      );
    },
  },
  {
    id: 'm1_l4_loops_funcs',
    moduleId: 'm1',
    moduleNumber: 1,
    moduleTitle: 'Absolute Zero: First Code & Luau Basics',
    lessonNumber: 4,
    title: 'Functions & Loops: Timers with task.wait()',
    tier: 'Absolute Zero',
    xp: 90,
    estimatedMinutes: 7,
    summary: 'Package reusable actions into functions and repeat actions cleanly using for loops and task.wait().',
    explanation: [
      'Instead of copying and pasting the same 5 lines over and over, wrap them in a function! Functions take inputs (parameters) and can return an output.',
      'To repeat something—like a 3-2-1 round countdown—use a numeric for loop: for i = 3, 1, -1 do ... end. The third number (-1) means count backwards by 1.',
      'Inside loops, task.wait(0.3) pauses politely so the player can actually see each step happen in real time.'
    ],
    beginnerTip: 'Never write a "while true do" loop without task.wait() inside it—otherwise your game will freeze!',
    codeExample: 'local function announce(text)\n\tprint("[ROUND]", text)\nend\n\nfor i = 3, 1, -1 do\n\tannounce("Starting in " .. i)\n\ttask.wait(0.3)\nend',
    objectives: [
      'Write a local function named countdown(startNum) that loops from startNum down to 1.',
      'Pause with task.wait(0.2) inside the loop and print each number.',
      'After the loop finishes, print "GO!" and call countdown(3).'
    ],
    hints: [
      'Numeric backward loop: for i = startNum, 1, -1 do',
      'Call your function at the bottom with: countdown(3)'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/CountdownScript',
        name: 'CountdownScript',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local function countdown(startNum)
\t-- Loop from startNum down to 1, print i, and call task.wait(0.2)
\tfor i = startNum, 1, -1 do
\t\tprint(i)
\t\ttask.wait(0.2)
\tend
\tprint("GO!")
end

-- Call countdown(3) below!
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const prints = ctx.logs.filter((l) => l.level === 'print').map((l) => l.message.trim());
      const has3 = prints.includes('3');
      const has2 = prints.includes('2');
      const has1 = prints.includes('1');
      const hasGo = prints.includes('GO!');
      return passFail(
        [
          { label: 'Print countdown numbers 3, 2, 1', passed: has3 && has2 && has1 },
          { label: 'Print "GO!" after the loop completes', passed: hasGo },
        ],
        'Module 1 Complete! You now understand core programming from scratch.'
      );
    },
  },

  // =========================================================================
  // MODULE 2: STUDIO EXPLORER & PROCEDURAL "SCRIPT MODELING"
  // =========================================================================
  {
    id: 'm2_l1_explorer',
    moduleId: 'm2',
    moduleNumber: 2,
    moduleTitle: 'Roblox Explorer & Script Modeling',
    lessonNumber: 5,
    title: 'Navigating game, workspace & Properties',
    tier: 'Beginner',
    xp: 90,
    estimatedMinutes: 5,
    summary: 'Control objects sitting inside the Explorer tree using Luau scripts instead of mouse clicks.',
    explanation: [
      'Look at the Explorer panel on the right: every Roblox game is a family tree starting at game. Inside game are specialized folders called Services—like Workspace (everything visible in 3D), Players, Lighting, and ServerScriptService.',
      'From a scripter’s perspective, you never need modeling tools to change the world. You can grab any Part in workspace by name (workspace:WaitForChild("TargetPad")) and change its Color, Material, Size, or Transparency on the fly!'
    ],
    beginnerTip: 'Click any Part in the 3D Viewport or Explorer to inspect its exact property names in the Properties panel.',
    objectives: [
      'Find TargetPad inside workspace.',
      'Change TargetPad.Color to Color3.fromRGB(16, 185, 129) (Emerald).',
      'Change TargetPad.Material to Enum.Material.Neon.'
    ],
    hints: [
      'local pad = workspace:WaitForChild("TargetPad")',
      'pad.Color = Color3.fromRGB(16, 185, 129)',
      'pad.Material = Enum.Material.Neon'
    ],
    initialHierarchy: [
      {
        id: 'ws_m2_1',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [
          {
            id: 'target_pad_1',
            name: 'TargetPad',
            className: 'Part',
            properties: {
              Position: [0, 1, 0],
              Size: [6, 1, 6],
              Color: '#64748B',
              Material: 'Plastic',
              Anchored: true,
              CanCollide: true,
              Transparency: 0,
            },
          },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/StylePart',
        name: 'StylePart',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local pad = workspace:WaitForChild("TargetPad")

-- Change Color to Color3.fromRGB(16, 185, 129) and Material to Enum.Material.Neon!
print("Found pad:", pad.Name)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const pad = ctx.findInstance('Workspace/TargetPad');
      const isNeon = pad?.properties.Material === 'Neon';
      const isGreen = String(pad?.properties.Color ?? '').toLowerCase() === '#10b981';
      return passFail(
        [
          { label: 'Set TargetPad.Material to Enum.Material.Neon', passed: Boolean(isNeon) },
          { label: 'Set TargetPad.Color to RGB(16, 185, 129)', passed: Boolean(isGreen) },
        ],
        'Look at that glow in the 3D Viewport! You just controlled the 3D scene by script.'
      );
    },
  },
  {
    id: 'm2_l2_instance_new',
    moduleId: 'm2',
    moduleNumber: 2,
    moduleTitle: 'Roblox Explorer & Script Modeling',
    lessonNumber: 6,
    title: 'Instance.new("Part"): Building Geometry by Script',
    tier: 'Beginner',
    xp: 100,
    estimatedMinutes: 6,
    summary: 'Spawn brand-new 3D blocks out of thin air using Instance.new() without touching any modeling tools.',
    explanation: [
      'Why rely on pre-made models when Luau can generate entire structures? Instance.new("Part") creates a brand-new 3D block in memory.',
      'Always configure Size, Position, Color, and Anchored = true BEFORE setting Parent = workspace (that’s a pro Roblox performance habit).',
      'Notice Anchored = true: without it, Roblox gravity pulls the Part down!'
    ],
    objectives: [
      'Create a Part named "ScriptPillar" with Instance.new("Part").',
      'Set Size to Vector3.new(3, 8, 3), Position to Vector3.new(0, 4, 0), and Anchored = true.',
      'Set Parent = workspace so it appears in the 3D Viewport.'
    ],
    hints: [
      'local pillar = Instance.new("Part")',
      'pillar.Name = "ScriptPillar"',
      'pillar.Size = Vector3.new(3, 8, 3)',
      'pillar.Position = Vector3.new(0, 4, 0)',
      'pillar.Anchored = true',
      'pillar.Parent = workspace'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/SpawnPillar',
        name: 'SpawnPillar',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `-- Create a Part named "ScriptPillar", Size (3, 8, 3), Position (0, 4, 0), Anchored = true, Parent = workspace
local pillar = Instance.new("Part")
pillar.Name = "ScriptPillar"

`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const pillar = ctx.findInstance('Workspace/ScriptPillar');
      const size = (pillar?.properties.Size as number[]) ?? [];
      const pos = (pillar?.properties.Position as number[]) ?? [];
      return passFail(
        [
          { label: 'Spawn "ScriptPillar" inside Workspace', passed: Boolean(pillar) },
          { label: 'Size is (3, 8, 3) and Anchored is true', passed: size[0] === 3 && size[1] === 8 && size[2] === 3 && pillar?.properties.Anchored === true },
          { label: 'Position is (0, 4, 0)', passed: pos[0] === 0 && pos[1] === 4 && pos[2] === 0 },
        ],
        'Script-modeling unlocked! You built 3D geometry with zero modeling UI.'
      );
    },
  },
  {
    id: 'm2_l3_cframe_math',
    moduleId: 'm2',
    moduleNumber: 2,
    moduleTitle: 'Roblox Explorer & Script Modeling',
    lessonNumber: 7,
    title: '3D Math: Vector3 & CFrame Procedural Staircase',
    tier: 'Beginner',
    xp: 120,
    estimatedMinutes: 8,
    summary: 'Combine loops with CFrame position + rotation math to build a curved 3D staircase automatically.',
    explanation: [
      'Position only moves a Part. CFrame (Coordinate Frame) controls BOTH position and 3D rotation in one value!',
      'You combine CFrames by multiplying them: CFrame.new(x, y, z) * CFrame.Angles(0, math.rad(angle), 0).',
      'By putting Instance.new("Part") inside a for loop, 10 lines of Luau can construct bridges, spiral towers, and arenas in milliseconds.'
    ],
    objectives: [
      'Use a for loop from 1 to 10 to spawn 10 Part steps inside workspace.',
      'Position each step higher on Y (e.g., y = i * 1.2) and rotated with CFrame.Angles.',
      'Ensure every step is Anchored = true.'
    ],
    hints: [
      'Inside the loop: step.CFrame = CFrame.new(math.cos(a) * 6, i * 1.1, math.sin(a) * 6) * CFrame.Angles(0, -a, 0)',
      'Remember to set step.Parent = workspace inside the loop!'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/StairBuilder',
        name: 'StairBuilder',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `-- Build a 10-step spiral staircase strictly from Luau!
for i = 1, 10 do
\tlocal angle = math.rad(i * 25)
\tlocal step = Instance.new("Part")
\tstep.Name = "Step_" .. i
\tstep.Size = Vector3.new(4, 0.6, 2)
\tstep.Anchored = true
\tstep.Color = Color3.fromHSV(i / 10, 0.75, 0.95)
\t-- Set step.CFrame below using CFrame.new(...) * CFrame.Angles(...)
\tstep.CFrame = CFrame.new(0, i, 0)
\tstep.Parent = workspace
\ttask.wait(0.05)
end
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const steps = ctx.getAllParts().filter((p) => p.name.startsWith('Step_'));
      const rotated = steps.some((s) => {
        const rot = (s.properties.Rotation as number[]) ?? [0, 0, 0];
        return Math.abs(rot[0]) + Math.abs(rot[1]) + Math.abs(rot[2]) > 1;
      });
      return passFail(
        [
          { label: 'Spawn at least 10 staircase parts', passed: steps.length >= 10, detail: `Found ${steps.length} step(s)` },
          { label: 'Apply CFrame.Angles rotation to the steps', passed: rotated },
        ],
        'Beautiful procedural geometry! That staircase exists 100% from math.'
      );
    },
  },
  {
    id: 'm2_l4_models_welds',
    moduleId: 'm2',
    moduleNumber: 2,
    moduleTitle: 'Roblox Explorer & Script Modeling',
    lessonNumber: 8,
    title: 'Model, PrimaryPart, WeldConstraint & :Clone()',
    tier: 'Beginner',
    xp: 125,
    estimatedMinutes: 7,
    summary: 'Assemble multi-part structures into a Model, weld them together, clone them, and move the whole assembly with :PivotTo().',
    explanation: [
      'When you build an object out of 3 script-created Parts (like a glowing beacon or crate), group them inside a Model and assign Model.PrimaryPart.',
      'A WeldConstraint locks Part0 and Part1 together so they act as one rigid unit. Calling model:Clone() duplicates the entire assembly, and model:PivotTo(cframe) teleports the whole group cleanly!'
    ],
    objectives: [
      'Create a Model named "Beacon" containing at least 2 Parts (Base and Core).',
      'Assign Beacon.PrimaryPart = basePart and create a WeldConstraint linking Base and Core.',
      'Clone the Beacon once into workspace and move the clone with :PivotTo(CFrame.new(8, 1, 0)).'
    ],
    hints: [
      'local weld = Instance.new("WeldConstraint", base); weld.Part0 = base; weld.Part1 = core',
      'local copy = beacon:Clone(); copy.Name = "BeaconClone"; copy.Parent = workspace; copy:PivotTo(CFrame.new(8, 1, 0))'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/ModelAssembler',
        name: 'ModelAssembler',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local beacon = Instance.new("Model")
beacon.Name = "Beacon"

local base = Instance.new("Part")
base.Name = "Base"
base.Size = Vector3.new(3, 1, 3)
base.Position = Vector3.new(-6, 0.5, 0)
base.Anchored = true
base.Color = Color3.fromRGB(51, 65, 85)
base.Parent = beacon

local core = Instance.new("Part")
core.Name = "Core"
core.Size = Vector3.new(1.4, 3, 1.4)
core.Position = Vector3.new(-6, 2.5, 0)
core.Anchored = true
core.Material = Enum.Material.Neon
core.Color = Color3.fromRGB(56, 189, 248)
core.Parent = beacon

-- 1. Set beacon.PrimaryPart = base
-- 2. Create a WeldConstraint connecting base and core
-- 3. Parent beacon to workspace, then :Clone() it and call :PivotTo(CFrame.new(8, 1, 0))
beacon.Parent = workspace
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const b1 = ctx.findInstance('Workspace/Beacon');
      const models = (ctx.findInstance('Workspace')?.children ?? []).filter((c) => c.className === 'Model' && c.name.includes('Beacon'));
      const hasWeld = Boolean(b1 && JSON.stringify(b1).includes('WeldConstraint'));
      const movedClone = models.some((m) => {
        const base = m.children.find((c) => c.name === 'Base');
        const pos = (base?.properties.Position as number[]) ?? [0, 0, 0];
        return pos[0] > 4;
      });
      return passFail(
        [
          { label: 'Create Beacon Model with WeldConstraint', passed: Boolean(b1) && hasWeld },
          { label: 'Clone the Beacon and :PivotTo() the clone to X > 4', passed: models.length >= 2 && movedClone },
        ],
        'Module 2 Complete! You can assemble, weld, clone, and move multi-part builds strictly in code.'
      );
    },
  },

  // =========================================================================
  // MODULE 3: EVENTS, TRIGGERS & REAL-TIME GAME LOOPS
  // =========================================================================
  {
    id: 'm3_l1_touched',
    moduleId: 'm3',
    moduleNumber: 3,
    moduleTitle: 'Events, Triggers & Game Loops',
    lessonNumber: 9,
    title: 'Signals & :Connect(): Touched Traps & Debouncing',
    tier: 'Intermediate',
    xp: 130,
    estimatedMinutes: 7,
    summary: 'React the instant a player touches a Part using :Connect() and prevent spam with a debounce cooldown.',
    explanation: [
      'Games don’t run top-to-bottom once and stop—they react to events! Every Roblox signal has a :Connect(function(...) end) method.',
      'When a character steps on a Part, Part.Touched fires. Because characters have multiple limbs, Touched can fire dozens of times in 1 second unless you add a debounce boolean (local cooldown = false).'
    ],
    beginnerTip: 'In the 3D Viewport during Play, click "Avatar" or use WASD to walk onto the red LavaPad (or click it to test Touch)!',
    objectives: [
      'Connect a function to LavaPad.Touched.',
      'Use a debounce variable so it prints "Ouch! Touched lava" at most once every 1 second.',
      'Walk onto or trigger LavaPad in the 3D Viewport while Playing.'
    ],
    hints: [
      'local debounce = false',
      'if debounce then return end; debounce = true; print("Ouch! Touched lava"); task.wait(1); debounce = false'
    ],
    initialHierarchy: [
      {
        id: 'ws_m3_1',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [
          {
            id: 'lava_pad',
            name: 'LavaPad',
            className: 'Part',
            properties: {
              Position: [0, 0.5, 4],
              Size: [6, 1, 6],
              Color: '#EF4444',
              Material: 'Neon',
              Anchored: true,
              CanCollide: true,
            },
          },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/LavaScript',
        name: 'LavaScript',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local lava = workspace:WaitForChild("LavaPad")
local debounce = false

-- Connect to lava.Touched and use debounce so it waits 1 second between triggers!
lava.Touched:Connect(function(hit)
\tif debounce then return end
\tdebounce = true
\tprint("Ouch! Touched lava:", hit.Name)
\ttask.wait(1)
\tdebounce = false
end)

print("Walk onto the red LavaPad with WASD during Play!")
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const code = ctx.scripts['ServerScriptService/LavaScript'] ?? '';
      const triggered = ctx.logs.some((l) => l.message.includes('Ouch! Touched lava'));
      return passFail(
        [
          { label: 'Implement debounce check inside Touched:Connect', passed: /debounce/.test(code) && /Touched:Connect/.test(code) },
          { label: 'Walk onto LavaPad in Play mode to trigger Touched', passed: ctx.hasRunPlay && triggered },
        ],
        'Event-driven scripting! Debouncing is one of the most important habits in Roblox.'
      );
    },
  },
  {
    id: 'm3_l2_interactions',
    moduleId: 'm3',
    moduleNumber: 3,
    moduleTitle: 'Events, Triggers & Game Loops',
    lessonNumber: 10,
    title: 'ClickDetector & ProximityPrompt Interactions',
    tier: 'Intermediate',
    xp: 130,
    estimatedMinutes: 6,
    summary: 'Create interactive doors, chests, and switches by attaching ClickDetector or ProximityPrompt by script.',
    explanation: [
      'ClickDetector lets players click a 3D Part directly with their mouse (MouseClick). ProximityPrompt pops up a clean [E] interaction prompt when a player walks close (Triggered).',
      'You can create and attach both strictly via Instance.new() in your script!'
    ],
    objectives: [
      'Create a ProximityPrompt inside ChestPart with ActionText = "Open Chest".',
      'Connect to prompt.Triggered so triggering it turns ChestPart gold and prints "Chest opened!".',
      'Walk near ChestPart in Play mode and press E (or click the prompt button) to trigger it.'
    ],
    hints: [
      'local prompt = Instance.new("ProximityPrompt", chest)',
      'prompt.ActionText = "Open Chest"',
      'prompt.Triggered:Connect(function(player) ... end)'
    ],
    initialHierarchy: [
      {
        id: 'ws_m3_2',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [
          {
            id: 'chest_part',
            name: 'ChestPart',
            className: 'Part',
            properties: {
              Position: [0, 1.5, 4],
              Size: [3, 2, 2],
              Color: '#78350F',
              Material: 'Wood',
              Anchored: true,
              CanCollide: true,
            },
          },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/ChestScript',
        name: 'ChestScript',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local chest = workspace:WaitForChild("ChestPart")

local prompt = Instance.new("ProximityPrompt")
prompt.ActionText = "Open Chest"
prompt.ObjectText = "Treasure"
prompt.MaxActivationDistance = 12
prompt.Parent = chest

prompt.Triggered:Connect(function(player)
\tchest.Color = Color3.fromRGB(250, 204, 21)
\tchest.Material = Enum.Material.Neon
\tprint("Chest opened by", player.Name)
end)

print("Walk near the chest with WASD and press E to open it!")
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const opened = ctx.logs.some((l) => l.message.includes('Chest opened'));
      return passFail(
        [
          { label: 'Attach ProximityPrompt to ChestPart', passed: Boolean(ctx.findInstance('Workspace/ChestPart/ProximityPrompt')) },
          { label: 'Trigger the prompt in Play mode', passed: ctx.hasRunPlay && opened },
        ],
        'Interactive world objects mastered!'
      );
    },
  },
  {
    id: 'm3_l3_runservice',
    moduleId: 'm3',
    moduleNumber: 3,
    moduleTitle: 'Events, Triggers & Game Loops',
    lessonNumber: 11,
    title: 'RunService.Heartbeat & Frame-Independent Motion',
    tier: 'Intermediate',
    xp: 140,
    estimatedMinutes: 7,
    summary: 'Animate spinning blades and hovering platforms smoothly every frame using deltaTime.',
    explanation: [
      'A while loop with task.wait(0.1) looks choppy. Pro Roblox scripters use RunService.Heartbeat, which fires every single simulation frame and passes deltaTime (the fraction of a second since the last frame).',
      'Multiplying speed by deltaTime (dt * 2) guarantees your spinner rotates at the exact same real-world speed on both a 60Hz laptop and a 240Hz monitor.'
    ],
    objectives: [
      'Create or reference Spinner in workspace.',
      'Connect to RunService.Heartbeat and rotate Spinner using CFrame.Angles(0, dt * 2.5, 0).',
      'Watch it spin smoothly in the 3D Viewport.'
    ],
    hints: [
      'local RunService = game:GetService("RunService")',
      'RunService.Heartbeat:Connect(function(dt) spinner.CFrame *= CFrame.Angles(0, dt * 2.5, 0) end)'
    ],
    initialHierarchy: [
      {
        id: 'ws_m3_3',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [
          {
            id: 'spinner_part',
            name: 'Spinner',
            className: 'Part',
            properties: {
              Position: [0, 3, 0],
              Size: [10, 0.8, 1.5],
              Color: '#F59E0B',
              Material: 'Neon',
              Anchored: true,
              CanCollide: true,
            },
          },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/SpinnerLoop',
        name: 'SpinnerLoop',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local RunService = game:GetService("RunService")
local spinner = workspace:WaitForChild("Spinner")

-- Connect RunService.Heartbeat and multiply spinner.CFrame by CFrame.Angles(0, dt * 2.5, 0)
RunService.Heartbeat:Connect(function(dt)
\tspinner.CFrame = spinner.CFrame * CFrame.Angles(0, dt * 2.5, 0)
end)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const spinner = ctx.findInstance('Workspace/Spinner');
      const rot = (spinner?.properties.Rotation as number[]) ?? [0, 0, 0];
      const moved = Math.abs(rot[1]) > 1;
      const code = ctx.scripts['ServerScriptService/SpinnerLoop'] ?? '';
      return passFail(
        [
          { label: 'Use RunService.Heartbeat:Connect', passed: /Heartbeat:Connect/.test(code) },
          { label: 'Run Play and confirm Spinner rotates in 3D', passed: ctx.hasRunPlay && moved },
        ],
        'Smooth framerate-independent motion achieved!'
      );
    },
  },
  {
    id: 'm3_l4_collection',
    moduleId: 'm3',
    moduleNumber: 3,
    moduleTitle: 'Events, Triggers & Game Loops',
    lessonNumber: 12,
    title: 'CollectionService: One Script for 100 Objects',
    tier: 'Intermediate',
    xp: 150,
    estimatedMinutes: 7,
    summary: 'Stop duplicating scripts inside every coin or trap—tag them with CollectionService and manage all of them from one script.',
    explanation: [
      'A classic beginner mistake is pasting 20 copies of the same Script inside 20 different Coins. If you need to change one number, you have to edit 20 scripts!',
      'CollectionService lets you attach a string tag (like "Coin") to Parts. One single script calls CollectionService:GetTagged("Coin") and animates all of them at once.'
    ],
    objectives: [
      'Spawn 6 Parts in a circle and tag each one with CollectionService:AddTag(part, "Coin").',
      'Loop over CollectionService:GetTagged("Coin") in Heartbeat to spin every coin.',
      'Print the total count of tagged coins.'
    ],
    hints: [
      'local CollectionService = game:GetService("CollectionService")',
      'CollectionService:AddTag(coin, "Coin")',
      'for _, coin in ipairs(CollectionService:GetTagged("Coin")) do ... end'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/CoinManager',
        name: 'CoinManager',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

for i = 1, 6 do
\tlocal angle = math.rad(i * 60)
\tlocal coin = Instance.new("Part")
\tcoin.Name = "Coin_" .. i
\tcoin.Size = Vector3.new(1.6, 1.6, 0.4)
\tcoin.Position = Vector3.new(math.cos(angle) * 7, 2.5, math.sin(angle) * 7)
\tcoin.Color = Color3.fromRGB(250, 204, 21)
\tcoin.Material = Enum.Material.Neon
\tcoin.Anchored = true
\tcoin.Parent = workspace
\tCollectionService:AddTag(coin, "Coin")
end

local tagged = CollectionService:GetTagged("Coin")
print("Managing coins via 1 script:", #tagged)

RunService.Heartbeat:Connect(function(dt)
\tfor _, coin in ipairs(CollectionService:GetTagged("Coin")) do
\t\tcoin.CFrame *= CFrame.Angles(0, dt * 3, 0)
\tend
end)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const coins = ctx.getTagged('Coin');
      return passFail(
        [
          { label: 'Tag at least 6 Parts with "Coin" via CollectionService', passed: coins.length >= 6, detail: `Tagged count: ${coins.length}` },
          { label: 'Run Play and log tagged coin count', passed: ctx.hasRunPlay && ctx.logs.some((l) => l.message.includes('6')) },
        ],
        'Module 3 Complete! You now write clean, scalable event-driven Roblox systems.'
      );
    },
  },
];
