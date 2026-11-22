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
      'In Roblox Studio, scripts are lists of instructions that run top-to-bottom when you click Play.',
      'print(...) is a built-in command that writes whatever is inside the parentheses ( ) into the Output console below.',
      'Words inside double quotes "..." are called strings—the quotes tell Luau "this is literal text, not a command name."',
      'Any line starting with `--` is a comment: a human note that Roblox completely skips when running your game.'
    ],
    beginnerTip: 'Every opening quote " and parenthesis ( must have a matching closing " and ). Watch the syntax colors in the editor—strings turn green!',
    codeExample: '-- Two dashes make a human comment (Roblox ignores this)\nprint("Hello, Roblox!")\nprint("Score:", 100) -- commas print multiple values with a space',
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
      'Games need to remember changing info like coins, health, or player names. You create a named storage box using `local`, followed by a name, an `=`, and a value.',
      'In Luau, `=` does NOT ask "are these equal?"—it means "store/assign the value on the right INTO the variable on the left." For example, `local coins = 50` puts 50 inside `coins`. Later, `coins = 75` replaces 50 with 75.',
      'Common data types: strings (text in `"..."`), numbers (`100` or `3.5`), and booleans (`true` or `false` on/off switches).',
      'Backticks `` `...` `` let you insert any variable straight into text using curly braces: `` `Coins: {coins}` ``.'
    ],
    beginnerTip: 'Variable names cannot start with a number or have spaces. Pick clear camelCase names like `playerName` or `hasKey`, and write `local` only the first time you create it.',
    codeExample: 'local heroName = "Alex" -- stores text (string) into heroName\nlocal coins = 50        -- stores a number into coins\nlocal isVip = true      -- stores a true/false switch (boolean)\n\ncoins = 75              -- updates coins (no "local" needed when reassigning)\nprint(`{heroName} now has {coins} coins`)',
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
      'Game rules are decisions: "IF the player has enough coins AND high enough level, unlock the VIP gate; ELSE keep it locked."',
      'Always keep `=` and `==` separate: a single `=` sets a value (`coins = 75`), while a double `==` asks a question ("is coins equal to 75?"). Use `~=` for "not equal", `>=` for "greater or equal", and `<=` for "less or equal".',
      'Combine multiple checks using `and` (BOTH sides must be true) or `or` (AT LEAST ONE side must be true).',
      'Every `if` statement needs `then` after its condition and `end` at the bottom so Luau knows where the conditional block finishes.'
    ],
    beginnerTip: 'Think of `if ... then ... else ... end` like a fork in the road. Use `Tab` to indent the lines inside so you can see which code belongs inside the block.',
    codeExample: 'local gold = 80\nlocal hasPass = true\n\nif gold >= 50 and hasPass == true then\n\tprint("Gate unlocked!")\nelseif gold >= 50 then\n\tprint("Need the pass!")\nelse\n\tprint("Need more gold")\nend',
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
      'A `function` is a reusable recipe with a name. `local function countdown(startNum)` defines the recipe and names an input slot (`startNum`)—nothing runs yet until you call it later with `countdown(3)`, which puts `3` into `startNum`.',
      'A numeric `for` loop repeats code automatically: `for i = start, stop, step do ... end`. Here `start` is the first number, `stop` is where to end, and `step` (`-1`) tells Luau how much to add each turn (counting down by 1).',
      'The `..` operator glues strings and numbers together into one message (e.g. `"Round " .. i` becomes `"Round 3"`).',
      'Inside loops, `task.wait(0.2)` pauses your script politely for 0.2 seconds so players see each count instead of everything flashing in 0.001s.'
    ],
    beginnerTip: 'Defining a function is like writing a recipe on paper—you still have to call `countdown(3)` below it to actually cook it! And never write `while true do` without `task.wait()` inside.',
    codeExample: '-- Define a function named "announce" with 1 input: message\nlocal function announce(message)\n\tprint("[ROUND] " .. message) -- ".." glues text together\nend\n\n-- Count from 3 down to 1 (step = -1)\nfor i = 3, 1, -1 do\n\tannounce("Starting in " .. i)\n\ttask.wait(0.3)\nend',
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
      'Look at the Explorer panel on the right: every Roblox experience is a tree starting at `game`, containing Services like `Workspace` (visible 3D parts), `Players`, `Lighting`, and `ServerScriptService`.',
      'Dot `.` vs Colon `:` — You use a colon `:` to ask an object to run an action (`workspace:WaitForChild("TargetPad")` waits until `"TargetPad"` loads and gives it back to you). You use a dot `.` to read or change a property stored on that object (`pad.Color` or `pad.Material`).',
      'Using `=` on a property changes it live in 3D: `pad.Color = ...` means "set TargetPad’s Color to the new color on the right."',
      '`Color3.fromRGB(r, g, b)` builds a 3D color by mixing Red, Green, and Blue light from `0` (none) to `255` (max). `Enum.Material` is Roblox’s built-in menu of official surface presets (`Neon`, `Metal`, `Wood`, `SmoothPlastic`), preventing spelling mistakes.'
    ],
    beginnerTip: 'Click any Part in the 3D Viewport or Explorer to see its exact property names in the Properties panel—and type `Enum.Material.` in the editor to pick materials from IntelliSense!',
    codeExample: '-- ":" calls a method; "=" stores the returned Part inside wall\nlocal wall = workspace:WaitForChild("BlueWall")\n\n-- "." accesses a property; "=" assigns a new value to it\nwall.Color = Color3.fromRGB(59, 130, 246) -- Red=59, Green=130, Blue=246\nwall.Material = Enum.Material.Metal       -- Official Material preset from Enum',
    objectives: [
      'Notice how line 1 uses `=` and `:WaitForChild("TargetPad")` to store TargetPad inside `pad`.',
      'Use `=` and `Color3.fromRGB(16, 185, 129)` to set `pad.Color` to Emerald green.',
      'Use `=` and `Enum.Material.Neon` to set `pad.Material` so TargetPad glows.'
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
      '`Instance.new("Part")` creates a brand-new 3D block in your script’s memory—it is completely invisible in the world until you assign `part.Parent = workspace`!',
      '`Vector3.new(x, y, z)` stores 3 numbers for 3D Size or Position measured in studs: `X` = left/right, `Y` = up/down height, and `Z` = forward/back.',
      'Every `=` line sets one property on `pillar`: `pillar.Anchored = true` locks the Part in midair (otherwise Roblox gravity drops it!), and `pillar.Parent = workspace` moves it into the visible 3D scene.'
    ],
    beginnerTip: 'Always configure Size, Position, Color, and `Anchored = true` BEFORE setting `Parent = workspace`—putting an object into the world last is faster and prevents flicker.',
    codeExample: 'local marker = Instance.new("Part")\nmarker.Name = "BeaconMarker"\nmarker.Size = Vector3.new(2, 2, 2)      -- 2 studs wide, tall, and deep\nmarker.Position = Vector3.new(4, 2, 0)  -- 4 right, 2 up, 0 front/back\nmarker.Anchored = true                  -- Don\'t fall from gravity\nmarker.Parent = workspace               -- Now it appears in 3D & Explorer!',
    objectives: [
      'Set `pillar.Size = Vector3.new(3, 8, 3)` and `pillar.Position = Vector3.new(0, 4, 0)`.',
      'Set `pillar.Anchored = true` so gravity does not knock the pillar over.',
      'Set `pillar.Parent = workspace` as the final step so it spawns in the 3D Viewport.'
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
      '`Position` (`Vector3`) only sets where a Part sits, whereas `CFrame` (Coordinate Frame) stores BOTH 3D Position AND 3D Rotation in a single value.',
      'You combine a position and a rotation by multiplying CFrames with `*`: `CFrame.new(x, y, z) * CFrame.Angles(rx, ry, rz)`.',
      '`CFrame.Angles` expects radians instead of degrees, so wrap degrees inside `math.rad(degrees)` (e.g. `math.rad(45)`). Using `math.cos(angle) * radius` and `math.sin(angle) * radius` places parts cleanly around a circle!',
      '`Color3.fromHSV(hue, sat, val)` picks colors smoothly around a rainbow wheel using `0` to `1` numbers (great inside loops!).'
    ],
    beginnerTip: 'Inside the starter loop, `angle` is already calculated in radians (`math.rad(i * 25)`). Notice how `CFrame.Angles(0, -angle, 0)` spins around the vertical Y axis so each step turns along the spiral.',
    codeExample: 'local ramp = Instance.new("Part")\nramp.Size = Vector3.new(4, 0.5, 6)\nramp.Anchored = true\n-- Place at (0, 2, 0), then tilt 20 degrees on X and turn 45 degrees on Y\nramp.CFrame = CFrame.new(0, 2, 0) * CFrame.Angles(math.rad(20), math.rad(45), 0)\nramp.Parent = workspace',
    objectives: [
      'Replace line 9 (`step.CFrame = CFrame.new(0, i, 0)`) so steps curve in a circle using `math.cos(angle) * 6` and `math.sin(angle) * 6`.',
      'Raise each step along Y (`i * 1.1`) and multiply `* CFrame.Angles(0, -angle, 0)` so every step faces the curve.',
      'Keep every step `Anchored = true` and press Play to build the spiral staircase.'
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
      'A `Model` acts like a group folder for multi-part builds (like a beacon, crate, or turret). Setting `model.PrimaryPart = base` chooses which Part acts as the Model’s main anchor point.',
      'A `WeldConstraint` glues two Parts together rigidly: set `weld.Part0 = base` and `weld.Part1 = core` (passing `base` as the 2nd argument to `Instance.new("WeldConstraint", base)` sets `weld.Parent = base` automatically).',
      '`beacon:Clone()` duplicates the Model and all its welded children in memory—just like `Instance.new()`, remember to set `copy.Parent = workspace` so the clone appears!',
      '`copy:PivotTo(CFrame.new(8, 1, 0))` moves the ENTIRE cloned Model as one connected unit without breaking its parts apart.'
    ],
    beginnerTip: 'Always set `copy.Parent = workspace` (and give it a new `Name` if you want to distinguish them in Explorer) right after calling `:Clone()`.',
    codeExample: 'local crate = Instance.new("Model")\nlocal body = Instance.new("Part", crate)\nlocal lid = Instance.new("Part", crate)\n\ncrate.PrimaryPart = body\nlocal weld = Instance.new("WeldConstraint", body)\nweld.Part0 = body\nweld.Part1 = lid\ncrate.Parent = workspace\n\nlocal secondCrate = crate:Clone()\nsecondCrate.Parent = workspace\nsecondCrate:PivotTo(CFrame.new(6, 1, 0))',
    objectives: [
      'Set `beacon.PrimaryPart = base` so the Model has a main pivot Part.',
      'Create a `WeldConstraint` parented to `base` with `Part0 = base` and `Part1 = core`.',
      'Parent `beacon` to `workspace`, then `:Clone()` it, parent the clone to `workspace`, and call `:PivotTo(CFrame.new(8, 1, 0))`.'
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
      'Most game code is event-driven: instead of checking constantly, you attach a listener function to a signal with `:Connect(function(...) ... end)`. Whenever that event happens, Roblox runs your connected function automatically.',
      'When a player touches a Part, `lava.Touched` fires and passes `hit` (the exact body Part that touched it, like `"LeftFoot"` or `"HumanoidRootPart"`).',
      'Because multiple limbs touch at once, `Touched` can fire 20 times in a split second! A `debounce` boolean (`true`/`false` lock) fixes that: `if debounce then return end` immediately exits the function early (`return` stops the rest of the callback from running), then we set `debounce = true`, wait `task.wait(1)`, and unlock `debounce = false`.'
    ],
    beginnerTip: 'In the 3D Viewport during Play, use WASD to walk your character onto the red LavaPad (or click LavaPad in the 3D Viewport to test a touch event).',
    codeExample: 'local pad = workspace:WaitForChild("HealPad")\nlocal cooldown = false\n\npad.Touched:Connect(function(hit)\n\tif cooldown then return end -- Exit early while locked!\n\tcooldown = true\n\tprint("Healed by:", hit.Name)\n\ttask.wait(2)              -- Wait 2 seconds before unlocking\n\tcooldown = false\nend)',
    objectives: [
      'Read how `lava.Touched:Connect(function(hit)` uses `debounce` and early `return` to prevent spam.',
      'Press Play and walk onto the red LavaPad in the 3D Viewport using WASD so it prints "Ouch! Touched lava".'
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
      '`ProximityPrompt` adds an interactive `[E]` key prompt over a 3D Part when a player walks close (`MaxActivationDistance` controls how many studs away it appears, `ActionText` sets the button label, and `ObjectText` sets the item title).',
      'Its signal `prompt.Triggered:Connect(function(player) ... end)` automatically hands your function the exact `player` who pressed `E`—no `hit` limb guessing needed!',
      'Inside the callback, you can modify the Part (`Color`, `Material`) and read `player.Name` using dot `.` property access.'
    ],
    beginnerTip: 'When you walk close to ChestPart during Play, either press `E` on your keyboard or click the floating `[E] Open Chest` prompt directly in the 3D Viewport.',
    codeExample: 'local door = workspace:WaitForChild("Door")\nlocal click = Instance.new("ClickDetector", door)\n\n-- ClickDetector fires MouseClick and passes the clicking player\nclick.MouseClick:Connect(function(player)\n\tprint(player.Name, "clicked the door!")\nend)',
    objectives: [
      'Inspect how `Instance.new("ProximityPrompt")` configures `ActionText`, `ObjectText`, `MaxActivationDistance`, and `Parent = chest`.',
      'Press Play, walk near ChestPart with WASD, and press `E` (or click the prompt) to turn it Neon Gold and print `"Chest opened by ..."`.'
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
      '`game:GetService("ServiceName")` is the safe, official way to fetch any Roblox Service (like `RunService`, `Players`, or `TweenService`).',
      'Instead of choppy `while` loops with `task.wait()`, `RunService.Heartbeat:Connect(function(dt) ... end)` runs every single frame and hands you `dt` (`deltaTime`: the tiny fraction of a second since the previous frame, e.g. `0.016`).',
      'Multiplying rotation speed by `dt` (`dt * 2.5`) guarantees your blade turns at the exact same speed whether someone plays at 30 FPS or 240 FPS!',
      'Shorthand `*=` means "multiply and assign back": `spinner.CFrame *= ...` is identical to `spinner.CFrame = spinner.CFrame * ...`.'
    ],
    beginnerTip: 'Because `CFrame.Angles(x, y, z)` takes radians, `dt * 2.5` rotates 2.5 radians (~143 degrees) per second around the vertical Y axis.',
    codeExample: 'local RunService = game:GetService("RunService")\nlocal fan = workspace:WaitForChild("Fan")\n\nRunService.Heartbeat:Connect(function(dt)\n\t-- Multiply current CFrame by a tiny Y rotation scaled by deltaTime\n\tfan.CFrame *= CFrame.Angles(0, dt * 3, 0)\nend)',
    objectives: [
      'Review how `RunService.Heartbeat:Connect(function(dt)` passes frame deltaTime `dt`.',
      'Press Play and verify `Spinner` rotates smoothly in the 3D Viewport.'
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
      'Instead of copying 20 scripts inside 20 coins, `CollectionService:AddTag(coin, "Coin")` stamps a text label onto each Part so ONE central script can control all of them.',
      '`CollectionService:GetTagged("Coin")` returns a list (array) of every tagged Part. Putting `#` in front of a list (`#tagged`) counts how many items are inside it!',
      '`for _, coin in ipairs(list) do ... end` visits every item in that list one by one. Using `_` as the first variable name is a Luau convention meaning "I know there is an index number `1, 2, 3...`, I just don’t need to use it."'
    ],
    beginnerTip: 'Notice line 19 uses `coin.CFrame *= CFrame.Angles(0, dt * 3, 0)`—inside the `Heartbeat` loop, all 6 tagged coins animate from one single loop!',
    codeExample: 'local CollectionService = game:GetService("CollectionService")\n\n-- Stamp the tag "Hazard" onto a part\nCollectionService:AddTag(part, "Hazard")\n\n-- Get all tagged parts and count them with "#"\nlocal hazards = CollectionService:GetTagged("Hazard")\nprint("Total hazards:", #hazards)\n\nfor _, trap in ipairs(hazards) do\n\ttrap.Color = Color3.fromRGB(239, 68, 68)\nend',
    objectives: [
      'Spawn 6 Parts in a circle and tag each one with `CollectionService:AddTag(coin, "Coin")`.',
      'Count them with `#tagged` and spin all tagged coins inside one `Heartbeat` loop.'
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
