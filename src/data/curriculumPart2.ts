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
      : 'Review the unchecked requirement(s) below, update your script, and press Play again.',
    checks,
  };
}

export const CURRICULUM_PART_2: LessonDefinition[] = [
  // =========================================================================
  // MODULE 4: TABLES, MODULESCRIPTS & ERROR RESILIENCE
  // =========================================================================
  {
    id: 'm4_l1_tables',
    moduleId: 'm4',
    moduleNumber: 4,
    moduleTitle: 'Tables, ModuleScripts & Resilience',
    lessonNumber: 13,
    title: 'Arrays & Dictionaries: Storing Game Catalogs',
    tier: 'Intermediate',
    xp: 130,
    estimatedMinutes: 6,
    summary: 'Use Luau tables as both ordered lists (arrays) and key-value maps (dictionaries).',
    explanation: [
      'A Luau table `{ ... }` is a versatile container. As an Array (`{ "Sword", "Shield" }`), items are numbered automatically starting at index `1` (NOT `0`!). As a Dictionary (`{ Sword = 100, Shield = 75 }`), each value has a named key you look up with `shopItems.Sword` or `shopItems["Sword"]`.',
      'Use `ipairs(list)` when looping through numbered arrays in order, and `pairs(dict)` when looping through named dictionary entries (`key, value`).',
      'Shorthand `+=` adds onto an existing variable: `total += price` means `total = total + price`.'
    ],
    beginnerTip: 'Inside a dictionary `{ Sword = 100, Shield = 75 }`, put a comma `,` after each entry—even the last one is allowed in Luau and prevents syntax errors when adding new lines!',
    codeExample: 'local bag = {\n\tApple = 10,\n\tPotion = 25,\n}\n\nlocal sum = 0\nfor itemName, cost in pairs(bag) do\n\tsum += cost -- same as: sum = sum + cost\n\tprint(itemName, "->", cost)\nend\nprint("Total:", sum)',
    objectives: [
      'Inspect how the `shopItems` dictionary maps item names (`Sword`, `Shield`, `Potion`) to prices.',
      'Loop with `pairs(shopItems)` and add each price with `total += price`.',
      'Press Play (or customize items/prices!) and verify all items + `Catalog total` print in Output.'
    ],
    hints: [
      'local shopItems = { Sword = 100, Shield = 75, Potion = 25 }',
      'for item, price in pairs(shopItems) do total += price end'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/ShopCatalog',
        name: 'ShopCatalog',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local shopItems = {
\tSword = 100,
\tShield = 75,
\tPotion = 25,
}

local total = 0
for itemName, price in pairs(shopItems) do
\tprint(itemName, "costs", price)
\ttotal += price
end

print("Catalog total:", total)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const prints = ctx.logs.filter((l) => l.level === 'print');
      const hasTotal = prints.some((l) => l.message.includes('Catalog total:') && /\d+/.test(l.message));
      return passFail(
        [
          { label: 'Print at least 3 catalog items and total cost', passed: ctx.hasRunPlay && prints.length >= 4 && hasTotal },
        ],
        'Tables mastered! Dictionaries power inventories, shops, and player stats.'
      );
    },
  },
  {
    id: 'm4_l2_modules',
    moduleId: 'm4',
    moduleNumber: 4,
    moduleTitle: 'Tables, ModuleScripts & Resilience',
    lessonNumber: 14,
    title: 'ModuleScripts & require(): Clean Shared Architecture',
    tier: 'Intermediate',
    xp: 150,
    estimatedMinutes: 7,
    summary: 'Put reusable functions inside a ModuleScript in ReplicatedStorage so both Server and Client can require() it.',
    explanation: [
      'Unlike a normal Script, a `ModuleScript` does NOT run on its own—it acts as a shared library that returns one table (`return GameConfig`) when another script loads it with `require(moduleScript)`.',
      'Put shared configs, item stats, and math helpers inside `ReplicatedStorage` because BOTH Server Scripts and Client LocalScripts can see and `require()` anything inside `ReplicatedStorage`.',
      'Notice the `return` keyword at the bottom of `GameConfig`: whatever value you `return` there becomes what `require(...)` gives back to `MainServer`!'
    ],
    beginnerTip: 'A `ModuleScript` MUST return exactly one value (usually a table `{ ... }`) at the bottom—forgetting `return GameConfig` will cause `require()` to error.',
    codeExample: '-- Inside ReplicatedStorage/MathConfig (ModuleScript)\nlocal MathConfig = { BonusMultiplier = 2 }\nreturn MathConfig\n\n-- Inside ServerScriptService/GameLoop (Script)\nlocal cfg = require(game:GetService("ReplicatedStorage"):WaitForChild("MathConfig"))\nprint("Multiplier is:", cfg.BonusMultiplier)',
    objectives: [
      'Switch between `ReplicatedStorage/GameConfig` and `ServerScriptService/MainServer` tabs in the editor to see how `return` + `require()` link them.',
      'Press Play so `MainServer` applies `Config.Gravity` (80) to `workspace.Gravity` and prints `StartingCoins = 250`.'
    ],
    hints: [
      'In GameConfig: local Config = { Gravity = 80, StartingCoins = 250 }; return Config',
      'In MainServer: local Config = require(game:GetService("ReplicatedStorage"):WaitForChild("GameConfig"))'
    ],
    initialHierarchy: [
      {
        id: 'rep_m4_2',
        name: 'ReplicatedStorage',
        className: 'ReplicatedStorage',
        properties: {},
        children: [],
      },
    ],
    scripts: [
      {
        path: 'ReplicatedStorage/GameConfig',
        name: 'GameConfig',
        parentPath: 'ReplicatedStorage',
        className: 'ModuleScript',
        code: `local GameConfig = {
\tStartingCoins = 250,
\tGravity = 80,
\tMaxPlayers = 12,
}

return GameConfig
`,
      },
      {
        path: 'ServerScriptService/MainServer',
        name: 'MainServer',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage:WaitForChild("GameConfig"))

workspace.Gravity = Config.Gravity
print("Loaded Config! StartingCoins =", Config.StartingCoins)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const ws = ctx.findInstance('Workspace');
      const loaded = ctx.logs.some((l) => l.message.includes('StartingCoins =') && l.message.includes('250'));
      return passFail(
        [
          { label: 'Require GameConfig ModuleScript', passed: ctx.hasRunPlay && loaded },
          { label: 'Apply Config.Gravity to workspace', passed: ws?.properties.Gravity === 80 },
        ],
        'Modular architecture unlocked! Now you can share clean libraries across scripts.'
      );
    },
  },
  {
    id: 'm4_l3_pcall',
    moduleId: 'm4',
    moduleNumber: 4,
    moduleTitle: 'Tables, ModuleScripts & Resilience',
    lessonNumber: 15,
    title: 'Error Handling: pcall, warn & assert',
    tier: 'Intermediate',
    xp: 150,
    estimatedMinutes: 6,
    summary: 'Wrap risky operations in pcall() (Protected Call) so one unexpected error never crashes your entire server script.',
    explanation: [
      'Normally, if one line fails (like a DataStore outage or dividing by zero), your entire script stops immediately. `pcall(function() ... end)` ("Protected Call") runs the inner function inside a safety net so errors are caught cleanly instead of crashing.',
      '`pcall` returns TWO values stored with commas: `local success, result = pcall(...)`. If it worked, `success` is `true` and `result` is what your function returned. If it failed, `success` is `false` and `result` is the error text!',
      '`assert(condition, message)` intentionally triggers an error if `condition` is false (`b ~= 0` checks "b is not equal to 0"), and `warn(...)` logs an amber warning in Output without stopping your script.'
    ],
    beginnerTip: '`if not success then` flips a boolean: when `success` is `false`, `not success` becomes `true`, entering the error-handling branch.',
    codeExample: 'local ok, dataOrErr = pcall(function()\n\tassert(10 > 20, "Not enough points!") -- fails safely inside pcall\n\treturn 100\nend)\n\nif not ok then\n\twarn("Caught safely:", dataOrErr)\nend\nprint("Script still keeps running!")',
    objectives: [
      'Trace how `divide(10, 0)` fails `assert(b ~= 0, ...)` inside `pcall()`.',
      'Press Play and verify the amber warning (`Handled safely`) AND `"Server stayed alive!"` both log cleanly.'
    ],
    hints: [
      'local success, result = pcall(function() return divide(10, 0) end)',
      'if not success then warn("Handled safely:", result) end'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/SafeExecution',
        name: 'SafeExecution',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local function divide(a, b)
\tassert(b ~= 0, "Cannot divide by zero!")
\treturn a / b
end

local success, result = pcall(function()
\treturn divide(10, 0)
end)

if not success then
\twarn("Handled safely:", result)
else
\tprint("Result:", result)
end

print("Server stayed alive!")
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const warned = ctx.logs.some((l) => l.level === 'warn' && l.message.includes('Handled safely'));
      const alive = ctx.logs.some((l) => l.level === 'print' && l.message.includes('Server stayed alive!'));
      return passFail(
        [
          { label: 'Catch the error via pcall and log a warning', passed: ctx.hasRunPlay && warned },
          { label: 'Continue running to print "Server stayed alive!"', passed: alive },
        ],
        'Module 4 Complete! Your code is now modular and resilient against runtime errors.'
      );
    },
  },

  // =========================================================================
  // MODULE 5: CLIENT VS. SERVER ARCHITECTURE & NETWORKING
  // =========================================================================
  {
    id: 'm5_l1_boundary',
    moduleId: 'm5',
    moduleNumber: 5,
    moduleTitle: 'Client vs. Server & Networking',
    lessonNumber: 16,
    title: 'The Client-Server Boundary',
    tier: 'Intermediate',
    xp: 140,
    estimatedMinutes: 6,
    summary: 'Understand why Roblox runs two separate worlds: the trusted Server and each player’s Client.',
    explanation: [
      'Every multiplayer Roblox game runs in two separate places: ONE trusted **Server** (`Script` files inside `ServerScriptService`) that controls real scores, physics, and saves—and each player’s own **Client** (`LocalScript` files inside `StarterPlayerScripts` or `StarterGui`) that draws their UI and reads their keyboard.',
      'Because hackers can tamper with code on their own Client device, NEVER trust the Client to decide coins or health. Keep game rules on the Server!',
      'Notice `Players.LocalPlayer`: that property ONLY works inside a `LocalScript` on a Client (the Server serves all players, so there is no single "local" player on the Server).'
    ],
    beginnerTip: 'In the script tabs above the code editor, `Server` badges are green (`Script`) and `Client` badges are blue (`LocalScript`).',
    codeExample: '-- In ServerScriptService (Script): runs once for the whole game\nprint("[Server] Checking round timer...")\n\n-- In StarterPlayerScripts (LocalScript): runs per player\nlocal player = game:GetService("Players").LocalPlayer\nprint("[Client] Welcome,", player.Name)',
    objectives: [
      'Open both `ServerBoot` (`Script`) and `ClientBoot` (`LocalScript`) tabs to compare them.',
      'Press Play and observe both `[Server]` and `[Client]` messages in the Output console.'
    ],
    hints: [
      'Run Play and check that both Server and Client print their identities.'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/ServerBoot',
        name: 'ServerBoot',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `print("Hello from the authoritative Server!")
`,
      },
      {
        path: 'StarterPlayer/StarterPlayerScripts/ClientBoot',
        name: 'ClientBoot',
        parentPath: 'StarterPlayer/StarterPlayerScripts',
        className: 'LocalScript',
        code: `local Players = game:GetService("Players")
print("Hello from Client for player:", Players.LocalPlayer.Name)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const serverOk = ctx.logs.some((l) => l.source === 'Server' && l.message.includes('Server'));
      const clientOk = ctx.logs.some((l) => l.source === 'Client' && l.message.includes('Client'));
      return passFail(
        [
          { label: 'Execute Server Script in ServerScriptService', passed: ctx.hasRunPlay && serverOk },
          { label: 'Execute Client LocalScript in StarterPlayerScripts', passed: ctx.hasRunPlay && clientOk },
        ],
        'Crystal clear! You now understand Roblox’s Client-Server split.'
      );
    },
  },
  {
    id: 'm5_l2_players_leaderstats',
    moduleId: 'm5',
    moduleNumber: 5,
    moduleTitle: 'Client vs. Server & Networking',
    lessonNumber: 17,
    title: 'Players, PlayerAdded & leaderstats',
    tier: 'Intermediate',
    xp: 150,
    estimatedMinutes: 7,
    summary: 'Create the official Roblox leaderstats scoreboard folder inside each player as soon as they join.',
    explanation: [
      '`Players.PlayerAdded:Connect(function(player) ... end)` fires on the Server every time a new player joins, automatically giving you their `player` instance.',
      'If you create a `Folder` named exact lowercase `"leaderstats"` (`leaderstats.Name = "leaderstats"`) and set `leaderstats.Parent = player`, Roblox automatically displays any `IntValue` or `StringValue` objects inside it on the top-right scoreboard!',
      'Important: `coins` is an `IntValue` container object—to read or change the actual number inside it, always use `.Value` (`coins.Value = 100`), NOT `coins = 100`.'
    ],
    beginnerTip: 'Spelling matters! `"Leaderstats"` with a capital L will NOT show on the Roblox leaderboard—it must be lowercase `"leaderstats"`.',
    codeExample: 'game:GetService("Players").PlayerAdded:Connect(function(player)\n\tlocal stats = Instance.new("Folder")\n\tstats.Name = "leaderstats" -- exact lowercase required by Roblox!\n\tstats.Parent = player\n\n\tlocal stage = Instance.new("IntValue")\n\tstage.Name = "Stage"\n\tstage.Value = 1            -- always set .Value for IntValue\n\tstage.Parent = stats\nend)',
    objectives: [
      'Inspect how `Leaderstats` creates a `"leaderstats"` `Folder` and `"Coins"` `IntValue` with `Value = 100` on `PlayerAdded`.',
      'Press Play and inspect `Players -> BuilderOne -> leaderstats -> Coins` in the Explorer & Properties panels.'
    ],
    hints: [
      'local ls = Instance.new("Folder"); ls.Name = "leaderstats"; ls.Parent = player',
      'local coins = Instance.new("IntValue"); coins.Name = "Coins"; coins.Value = 100; coins.Parent = ls'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/Leaderstats',
        name: 'Leaderstats',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal coins = Instance.new("IntValue")
\tcoins.Name = "Coins"
\tcoins.Value = 100
\tcoins.Parent = leaderstats

\tprint("Created leaderstats for", player.Name, "Coins =", coins.Value)
end)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const coinsNode = ctx.findInstance('Players/BuilderOne/leaderstats/Coins');
      return passFail(
        [
          { label: 'Create leaderstats Folder under Players/BuilderOne', passed: Boolean(ctx.findInstance('Players/BuilderOne/leaderstats')) },
          { label: 'Create Coins IntValue set to 100', passed: coinsNode?.properties.Value === 100 },
        ],
        'Scoreboard ready! You can inspect Players/BuilderOne/leaderstats right in the Explorer.'
      );
    },
  },
  {
    id: 'm5_l3_remotes',
    moduleId: 'm5',
    moduleNumber: 5,
    moduleTitle: 'Client vs. Server & Networking',
    lessonNumber: 18,
    title: 'RemoteEvent: Client <-> Server Messaging',
    tier: 'Intermediate',
    xp: 160,
    estimatedMinutes: 7,
    summary: 'Send messages across the network between LocalScripts and Server Scripts using RemoteEvents.',
    explanation: [
      'Because Client and Server live on different computers, a `LocalScript` cannot edit server variables directly. Instead, both sides send messages across a `RemoteEvent` stored in `ReplicatedStorage`.',
      'Client -> Server: the `LocalScript` calls `remote:FireServer("SpawnBeacon")`. On the Server, `remote.OnServerEvent:Connect(function(player, action) ... end)` receives that message.',
      'Notice a crucial security detail: the Client only passed 1 argument (`"SpawnBeacon"`), yet the Server receives TWO parameters (`player, action`). Roblox automatically fills in `player` as the 1st argument on the server so no hacker can pretend to be someone else!'
    ],
    beginnerTip: 'After pressing Play, click the **Network** tab at the bottom Output console to watch the live Client -> Server packet!',
    codeExample: '-- Client (LocalScript): sends 1 argument\nlocal buyEvent = game:GetService("ReplicatedStorage"):WaitForChild("BuyItem")\nbuyEvent:FireServer("SpeedCoil")\n\n-- Server (Script): Roblox automatically prepends "player" first!\nbuyEvent.OnServerEvent:Connect(function(player, itemName)\n\tprint(player.Name, "asked to buy", itemName)\nend)',
    objectives: [
      'Compare `RemoteClient` (`:FireServer("SpawnBeacon")`) and `RemoteServer` (`.OnServerEvent`).',
      'Press Play to spawn `NetworkBeacon` in 3D and inspect the delivered packet in the **Network** tab.'
    ],
    hints: [
      'In ClientScript: remote:FireServer("SpawnBeacon")',
      'In ServerScript: remote.OnServerEvent:Connect(function(player, action) ... end)'
    ],
    initialHierarchy: [
      {
        id: 'rep_m5_3',
        name: 'ReplicatedStorage',
        className: 'ReplicatedStorage',
        properties: {},
        children: [
          { id: 'rem_action', name: 'ActionEvent', className: 'RemoteEvent', properties: {} },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/RemoteServer',
        name: 'RemoteServer',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remote = ReplicatedStorage:WaitForChild("ActionEvent")

remote.OnServerEvent:Connect(function(player, action)
\tprint("Server received:", action, "from", player.Name)
\tif action == "SpawnBeacon" then
\t\tlocal p = Instance.new("Part")
\t\tp.Name = "NetworkBeacon"
\t\tp.Size = Vector3.new(2, 5, 2)
\t\tp.Position = Vector3.new(0, 2.5, 0)
\t\tp.Color = Color3.fromRGB(16, 185, 129)
\t\tp.Material = Enum.Material.Neon
\t\tp.Anchored = true
\t\tp.Parent = workspace
\tend
end)
`,
      },
      {
        path: 'StarterPlayer/StarterPlayerScripts/RemoteClient',
        name: 'RemoteClient',
        parentPath: 'StarterPlayer/StarterPlayerScripts',
        className: 'LocalScript',
        code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remote = ReplicatedStorage:WaitForChild("ActionEvent")

task.wait(0.2)
remote:FireServer("SpawnBeacon")
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const packetSent = ctx.networkLogs.some((n) => n.eventName === 'ActionEvent' && n.direction === 'Client -> Server');
      const beacon = ctx.findInstance('Workspace/NetworkBeacon');
      return passFail(
        [
          { label: 'Client fires ActionEvent to Server', passed: ctx.hasRunPlay && packetSent },
          { label: 'Server spawns NetworkBeacon in Workspace', passed: Boolean(beacon) },
        ],
        'Networking verified! Open the Network console tab to inspect the exact packet.'
      );
    },
  },
  {
    id: 'm5_l4_security',
    moduleId: 'm5',
    moduleNumber: 5,
    moduleTitle: 'Client vs. Server & Networking',
    lessonNumber: 19,
    title: 'Server-Authoritative Anti-Exploit & Rate Limiting',
    tier: 'Advanced',
    xp: 180,
    estimatedMinutes: 8,
    summary: 'Defend RemoteEvents against exploiters who spam requests or send negative/fake numbers.',
    explanation: [
      'Golden Rule of multiplayer security: NEVER trust anything coming from `:FireServer()`. Exploiters can call `remote:FireServer(999999)` or spam it 100 times per second!',
      'Type & range validation: `typeof(amount) ~= "number"` checks the incoming value’s real type (`~=` means "not equal"), and `amount < 1 or amount > 50` rejects negative or giant exploit numbers before any coins are added.',
      'Rate limiting: store each player’s last timestamp inside a table (`lastClaim[player.Name] = os.clock()`). `os.clock()` gives precise seconds, so `now - lastClaim[player.Name] < 0.5` blocks burst spam!'
    ],
    beginnerTip: 'Notice how `ExploitTestClient` sends 3 requests: `999999` (blocked by range check), `25` (accepted!), and another `25` right away (blocked by rate limit).',
    codeExample: 'local lastCall = {}\nchatRemote.OnServerEvent:Connect(function(player, text)\n\tif os.clock() - (lastCall[player.Name] or 0) < 1 then\n\t\treturn -- Too fast!\n\tend\n\tif typeof(text) ~= "string" or #text > 100 then\n\t\treturn -- Invalid payload!\n\tend\n\tlastCall[player.Name] = os.clock()\nend)',
    objectives: [
      'Trace how `SecureServer` validates `os.clock()` cooldown and `typeof(amount)` range `1..50`.',
      'Press Play and verify in Output that `999999` and the burst spam are warned/blocked while `25` succeeds.'
    ],
    hints: [
      'if typeof(amount) ~= "number" or amount <= 0 or amount > 50 then warn("Blocked invalid amount!"); return end',
      'Check if lastCall[player.Name] and os.clock() - lastCall[player.Name] < 0.5 then warn("Rate limited!"); return end'
    ],
    initialHierarchy: [
      {
        id: 'rep_m5_4',
        name: 'ReplicatedStorage',
        className: 'ReplicatedStorage',
        properties: {},
        children: [
          { id: 'rem_claim', name: 'ClaimReward', className: 'RemoteEvent', properties: {} },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/SecureServer',
        name: 'SecureServer',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remote = ReplicatedStorage:WaitForChild("ClaimReward")

local lastClaim = {}
local playerCoins = 0

remote.OnServerEvent:Connect(function(player, amount)
\tlocal now = os.clock()
\tif lastClaim[player.Name] and now - lastClaim[player.Name] < 0.5 then
\t\twarn("Rate limited spam from", player.Name)
\t\treturn
\tend
\tif typeof(amount) ~= "number" or amount < 1 or amount > 50 then
\t\twarn("Blocked exploit payload:", amount)
\t\treturn
\tend
\tlastClaim[player.Name] = now
\tplayerCoins += amount
\tprint("Valid claim! Coins =", playerCoins)
end)
`,
      },
      {
        path: 'StarterPlayer/StarterPlayerScripts/ExploitTestClient',
        name: 'ExploitTestClient',
        parentPath: 'StarterPlayer/StarterPlayerScripts',
        className: 'LocalScript',
        code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local remote = ReplicatedStorage:WaitForChild("ClaimReward")

task.wait(0.1)
remote:FireServer(999999) -- Exploit attempt!
remote:FireServer(25)     -- Valid claim!
remote:FireServer(25)     -- Too fast spam attempt!
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const blockedExploit = ctx.logs.some((l) => l.level === 'warn' && l.message.includes('Blocked exploit'));
      const rateLimited = ctx.logs.some((l) => l.level === 'warn' && l.message.includes('Rate limited'));
      const validOk = ctx.logs.some((l) => l.level === 'print' && l.message.includes('Coins = 25'));
      return passFail(
        [
          { label: 'Reject exploit payload (999999)', passed: ctx.hasRunPlay && blockedExploit },
          { label: 'Rate-limit rapid burst FireServer calls', passed: ctx.hasRunPlay && rateLimited },
          { label: 'Accept valid 25-coin claim', passed: ctx.hasRunPlay && validOk },
        ],
        'Module 5 Complete! Your client-server networking is exploit-resistant.'
      );
    },
  },

  // =========================================================================
  // MODULE 6: SCRIPTED UI, TWEENSERVICE, INPUT & LIGHTING
  // =========================================================================
  {
    id: 'm6_l1_screengui',
    moduleId: 'm6',
    moduleNumber: 6,
    moduleTitle: 'UI Scripting, Tweens, Input & Lighting',
    lessonNumber: 20,
    title: 'Scripted UI: ScreenGui, TextLabel & TextButton',
    tier: 'Intermediate',
    xp: 150,
    estimatedMinutes: 7,
    summary: 'Build interactive on-screen HUDs and clickable buttons over the 3D Viewport strictly through Luau.',
    explanation: [
      '2D menus and HUDs live inside a `ScreenGui` placed in `player:WaitForChild("PlayerGui")`. UI elements like `TextLabel` (display text) and `TextButton` (clickable button) sit inside that `ScreenGui`.',
      '`UDim2` sizes and positions UI using BOTH screen percentage (**Scale**, `0` to `1`) and exact pixels (**Offset**): `UDim2.new(xScale, xOffset, yScale, yOffset)`. For quick fixed-pixel sizes, use `UDim2.fromOffset(width, height)`.',
      'Style buttons with `BackgroundColor3`, `TextColor3`, and `Text`, then react to clicks with `btn.MouseButton1Click:Connect(function() ... end)`.'
    ],
    beginnerTip: 'After pressing Play, look at the top-left corner of the 3D Viewport—your live `Spawn Boost Block` UI button is clickable right there!',
    codeExample: 'local gui = Instance.new("ScreenGui", player:WaitForChild("PlayerGui"))\nlocal banner = Instance.new("TextLabel")\nbanner.Position = UDim2.new(0.05, 0, 0.05, 0) -- 5% from top-left\nbanner.Size = UDim2.fromOffset(180, 40)        -- 180px wide x 40px tall\nbanner.BackgroundColor3 = Color3.fromRGB(15, 23, 42)\nbanner.TextColor3 = Color3.fromRGB(255, 255, 255)\nbanner.Text = "Level 1"\nbanner.Parent = gui',
    objectives: [
      'Review how `ScreenGui`, `TextButton`, `UDim2`, and `MouseButton1Click` work together in `HudBuilder`.',
      'Press Play and click the blue **Spawn Boost Block** button on the 3D Viewport to spawn a Neon block!'
    ],
    hints: [
      'local button = Instance.new("TextButton", gui)',
      'button.MouseButton1Click:Connect(function() ... end)'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'StarterPlayer/StarterPlayerScripts/HudBuilder',
        name: 'HudBuilder',
        parentPath: 'StarterPlayer/StarterPlayerScripts',
        className: 'LocalScript',
        code: `local Players = game:GetService("Players")
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui")
gui.Name = "GameHUD"
gui.Parent = playerGui

local btn = Instance.new("TextButton")
btn.Name = "SpawnButton"
btn.Position = UDim2.new(0.03, 0, 0.05, 0)
btn.Size = UDim2.fromOffset(200, 44)
btn.BackgroundColor3 = Color3.fromRGB(37, 99, 235)
btn.TextColor3 = Color3.fromRGB(255, 255, 255)
btn.Text = "Spawn Boost Block"
btn.Parent = gui

local count = 0
btn.MouseButton1Click:Connect(function()
\tcount += 1
\tlocal p = Instance.new("Part")
\tp.Name = "HudSpawned_" .. count
\tp.Size = Vector3.new(2, 2, 2)
\tp.Position = Vector3.new((count - 1) * 3 - 3, 2, 0)
\tp.Color = Color3.fromRGB(56, 189, 248)
\tp.Material = Enum.Material.Neon
\tp.Anchored = true
\tp.Parent = workspace
\tbtn.Text = "Spawned #" .. count
\tprint("UI Button clicked! Total:", count)
end)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const spawned = ctx.getAllParts().some((p) => p.name.startsWith('HudSpawned_'));
      return passFail(
        [
          { label: 'Create ScreenGui and TextButton', passed: ctx.getGuiElements().some((g) => g.className === 'TextButton') },
          { label: 'Click your TextButton on the 3D Viewport in Play mode', passed: ctx.hasRunPlay && spawned },
        ],
        'Live UI scripting works! Notice how your ScreenGui renders right over the 3D world.'
      );
    },
  },
  {
    id: 'm6_l2_tweenservice',
    moduleId: 'm6',
    moduleNumber: 6,
    moduleTitle: 'UI Scripting, Tweens, Input & Lighting',
    lessonNumber: 21,
    title: 'TweenService: Smooth Eased Animations',
    tier: 'Intermediate',
    xp: 150,
    estimatedMinutes: 6,
    summary: 'Animate doors, elevators, and colors with silky easing curves using TweenService.',
    explanation: [
      '`TweenService` smoothly animates properties (like `Position`, `Color`, `Size`, or `Transparency`) from their current values to target values over time—no `while` loop required!',
      '`TweenInfo.new(duration, Enum.EasingStyle, Enum.EasingDirection)` controls the timing curve: `duration` is seconds, `EasingStyle` picks the motion curve (`Quad`, `Linear`, `Bounce`, `Sine`), and `EasingDirection` picks whether it eases at the `In`, `Out`, or `InOut` end.',
      '`TweenService:Create(part, info, goalTable)` returns a Tween object. Call `tween:Play()` to start it, and connect to `tween.Completed` to run code once the animation finishes.'
    ],
    beginnerTip: 'Notice how `goal` is a dictionary `{ Position = ..., Color = ... }` where the keys match the exact property names on `ElevatorPart`!',
    codeExample: 'local TweenService = game:GetService("TweenService")\nlocal info = TweenInfo.new(0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.Out)\n\nlocal fadeTween = TweenService:Create(door, info, {\n\tTransparency = 0.8,\n\tColor = Color3.fromRGB(14, 165, 233),\n})\nfadeTween:Play()',
    objectives: [
      'Inspect `TweenInfo.new(1.2, Enum.EasingStyle.Bounce, Enum.EasingDirection.Out)` and the `goal` table.',
      'Press Play to watch `ElevatorPart` bounce upward to `Y = 8` and trigger `tween.Completed`.'
    ],
    hints: [
      'local tween = TweenService:Create(elevator, info, { Position = Vector3.new(0, 8, 0), Color = Color3.fromRGB(6, 182, 212) })',
      'tween.Completed:Connect(function() print("Elevator arrived!") end); tween:Play()'
    ],
    initialHierarchy: [
      {
        id: 'ws_m6_2',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [
          {
            id: 'elevator_part',
            name: 'ElevatorPart',
            className: 'Part',
            properties: {
              Position: [0, 1, 0],
              Size: [6, 1, 6],
              Color: '#64748B',
              Material: 'SmoothPlastic',
              Anchored: true,
              CanCollide: true,
            },
          },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/ElevatorTween',
        name: 'ElevatorTween',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local TweenService = game:GetService("TweenService")
local elevator = workspace:WaitForChild("ElevatorPart")

local info = TweenInfo.new(1.2, Enum.EasingStyle.Bounce, Enum.EasingDirection.Out)
local goal = {
\tPosition = Vector3.new(0, 8, 0),
\tColor = Color3.fromRGB(6, 182, 212),
}

local tween = TweenService:Create(elevator, info, goal)
tween.Completed:Connect(function()
\tprint("Elevator arrived!")
end)
tween:Play()
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const el = ctx.findInstance('Workspace/ElevatorPart');
      const pos = (el?.properties.Position as number[]) ?? [0, 0, 0];
      const arrived = ctx.logs.some((l) => l.message.includes('Elevator arrived!'));
      return passFail(
        [
          { label: 'Tween ElevatorPart up to Y >= 7.5', passed: ctx.hasRunPlay && pos[1] >= 7.5 },
          { label: 'Fire tween.Completed callback', passed: arrived },
        ],
        'Smooth eased animation achieved!'
      );
    },
  },
  {
    id: 'm6_l3_input_audio',
    moduleId: 'm6',
    moduleNumber: 6,
    moduleTitle: 'UI Scripting, Tweens, Input & Lighting',
    lessonNumber: 22,
    title: 'UserInputService & Procedural Sound Feedback',
    tier: 'Intermediate',
    xp: 150,
    estimatedMinutes: 6,
    summary: 'Bind player keyboard keys (like E or F) to trigger scripted abilities with synthesized sound effects.',
    explanation: [
      '`UserInputService.InputBegan:Connect(function(input) ... end)` fires on the Client whenever the player presses any key or clicks.',
      'Check which key was pressed using `input.KeyCode == Enum.KeyCode.F` (remember `==` compares!).',
      'To make abilities feel responsive, create a `Sound` instance (`sfx:Play()`) and schedule temporary effects to auto-delete using `Debris:AddItem(wave, 2)`—unlike `task.wait(2)` + `:Destroy()`, `Debris` deletes `wave` after 2 seconds in the background without pausing your input handler!'
    ],
    beginnerTip: 'After pressing Play, click once inside the 3D Viewport so it has keyboard focus, then press `F` on your keyboard.',
    codeExample: 'local UserInputService = game:GetService("UserInputService")\nlocal Debris = game:GetService("Debris")\n\nUserInputService.InputBegan:Connect(function(input)\n\tif input.KeyCode == Enum.KeyCode.Q then\n\t\tlocal spark = Instance.new("Part", workspace)\n\t\tDebris:AddItem(spark, 1.5) -- Auto-destroy after 1.5s without pausing!\n\tend\nend)',
    objectives: [
      'Read how `InputBegan`, `Enum.KeyCode.F`, `Sound:Play()`, and `Debris:AddItem()` work together.',
      'Press Play, click the 3D Viewport to focus it, and press `F` on your keyboard to fire a Shockwave!'
    ],
    hints: [
      'Click inside the 3D Viewport during Play and press the F key.'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'StarterPlayer/StarterPlayerScripts/AbilityInput',
        name: 'AbilityInput',
        parentPath: 'StarterPlayer/StarterPlayerScripts',
        className: 'LocalScript',
        code: `local UserInputService = game:GetService("UserInputService")
local Debris = game:GetService("Debris")

local sfx = Instance.new("Sound")
sfx.SoundId = "rbxassetid://laser"
sfx.Parent = workspace

print("Click the 3D Viewport and press F to trigger Shockwave!")

UserInputService.InputBegan:Connect(function(input)
\tif input.KeyCode == Enum.KeyCode.F then
\t\tsfx:Play()
\t\tlocal wave = Instance.new("Part")
\t\twave.Name = "Shockwave"
\t\twave.Size = Vector3.new(6, 0.5, 6)
\t\twave.Position = Vector3.new(0, 1, 6)
\t\twave.Color = Color3.fromRGB(56, 189, 248)
\t\twave.Material = Enum.Material.Neon
\t\twave.Anchored = true
\t\twave.Parent = workspace
\t\tDebris:AddItem(wave, 2)
\t\tprint("Shockwave activated!")
\tend
end)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const fired = ctx.logs.some((l) => l.message.includes('Shockwave activated!'));
      return passFail(
        [
          { label: 'Press F in the 3D Viewport during Play', passed: ctx.hasRunPlay && fired },
        ],
        'Input + audio feedback wired cleanly!'
      );
    },
  },
  {
    id: 'm6_l4_lighting',
    moduleId: 'm6',
    moduleNumber: 6,
    moduleTitle: 'UI Scripting, Tweens, Input & Lighting',
    lessonNumber: 23,
    title: 'Lighting Atmosphere Scripting (Day / Night Cycle)',
    tier: 'Intermediate',
    xp: 140,
    estimatedMinutes: 5,
    summary: 'Control the sky, sun angle, brightness, and atmospheric fog dynamically via the Lighting service.',
    explanation: [
      'The `Lighting` service controls your world’s sun position, sky color, and fog via simple properties—no skybox painting needed.',
      '`Lighting.ClockTime` uses a 24-hour clock (`6` = sunrise, `12` = bright noon, `18` = sunset, `22` = midnight).',
      '`Lighting.FogEnd` sets how many studs away atmospheric fog becomes thick (smaller numbers create moodier close-up mist).'
    ],
    beginnerTip: 'Inside the `for hour = 14, 22, 2 do` loop, the third number `2` steps forward 2 hours at a time (`14, 16, 18, 20, 22`).',
    codeExample: 'local Lighting = game:GetService("Lighting")\nLighting.ClockTime = 18.5 -- Golden sunset!\nLighting.FogEnd = 110     -- Soft evening horizon mist',
    objectives: [
      'Trace how `DayNightCycle` steps `Lighting.ClockTime` from `14` to `22` and tightens `Lighting.FogEnd`.',
      'Press Play and watch the 3D Viewport sky shift smoothly from afternoon into night!'
    ],
    hints: [
      'local Lighting = game:GetService("Lighting")',
      'Lighting.ClockTime = 22; Lighting.FogEnd = 90'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/DayNightCycle',
        name: 'DayNightCycle',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local Lighting = game:GetService("Lighting")

for hour = 14, 22, 2 do
\tLighting.ClockTime = hour
\tLighting.FogEnd = 160 - (hour - 14) * 8
\tprint("ClockTime is now:", hour)
\ttask.wait(0.25)
end
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const lighting = ctx.findInstance('Lighting');
      const ct = Number(lighting?.properties.ClockTime ?? 14);
      return passFail(
        [
          { label: 'Transition Lighting.ClockTime to nighttime (>= 20)', passed: ctx.hasRunPlay && ct >= 20 },
        ],
        'Module 6 Complete! You now control UI, Tweens, Input, Audio, and Atmosphere.'
      );
    },
  },

  // =========================================================================
  // MODULE 7: PERSISTENCE, RAYCASTING & NPC STEERING
  // =========================================================================
  {
    id: 'm7_l1_datastores',
    moduleId: 'm7',
    moduleNumber: 7,
    moduleTitle: 'DataStores, Raycasting & NPC AI',
    lessonNumber: 24,
    title: 'DataStoreService: Saving Player Progress',
    tier: 'Advanced',
    xp: 170,
    estimatedMinutes: 7,
    summary: 'Persist player coins and inventory across sessions using DataStoreService with pcall protection.',
    explanation: [
      'Normal `local` variables vanish as soon as a server restarts. `DataStoreService:GetDataStore("PlayerEconomy")` opens a named cloud database table so player progress persists across sessions.',
      'Use `store:SetAsync(key, value)` to write a table under a player key (`"BuilderOne"`), and `store:GetAsync(key)` to load it back later. (`Async` means it talks over the network and waits for the reply.)',
      'Because cloud requests can occasionally fail, ALWAYS wrap `SetAsync` and `GetAsync` inside `pcall()`. When loading, check `if okLoad and data then` because a brand-new player returns `nil`!'
    ],
    beginnerTip: 'After pressing Play, open the **DataStores** tab in the bottom console to inspect the exact saved JSON/Luau table!',
    codeExample: 'local DataStoreService = game:GetService("DataStoreService")\nlocal scoreStore = DataStoreService:GetDataStore("HighScores")\n\nlocal ok = pcall(function()\n\tscoreStore:SetAsync("BuilderOne", { Best = 900 })\nend)\nif ok then\n\tlocal loadedOk, saved = pcall(function() return scoreStore:GetAsync("BuilderOne") end)\n\tif loadedOk and saved then print("Best:", saved.Best) end\nend',
    objectives: [
      'Trace how `SaveManager` wraps both `SetAsync` and `GetAsync` in `pcall()`.',
      'Press Play and check Output + the **DataStores** console tab to inspect `BuilderOne`’s saved record.'
    ],
    hints: [
      'store:SetAsync("BuilderOne", { Coins = 500, Level = 4 })',
      'Inspect the DataStores tab at the bottom to verify the saved record.'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/SaveManager',
        name: 'SaveManager',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local DataStoreService = game:GetService("DataStoreService")
local economyStore = DataStoreService:GetDataStore("PlayerEconomy")

local okSave, errSave = pcall(function()
\teconomyStore:SetAsync("BuilderOne", { Coins = 500, Level = 4 })
end)

if okSave then
\tlocal okLoad, data = pcall(function()
\t\treturn economyStore:GetAsync("BuilderOne")
\tend)
\tif okLoad and data then
\t\tprint("Loaded from DataStore -> Coins:", data.Coins, "Level:", data.Level)
\tend
else
\twarn("Save failed:", errSave)
end
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const store = ctx.dataStores['PlayerEconomy'] ?? {};
      const rec = store['BuilderOne'] as { Coins?: number } | undefined;
      return passFail(
        [
          { label: 'Save BuilderOne record to PlayerEconomy DataStore', passed: Boolean(rec && rec.Coins === 500) },
          { label: 'Load and print Coins from DataStore', passed: ctx.hasRunPlay && ctx.logs.some((l) => l.message.includes('500')) },
        ],
        'Data persistence verified! Inspect the DataStores tab to see the stored table.'
      );
    },
  },
  {
    id: 'm7_l2_updateasync',
    moduleId: 'm7',
    moduleNumber: 7,
    moduleTitle: 'DataStores, Raycasting & NPC AI',
    lessonNumber: 25,
    title: 'Atomic UpdateAsync & Retry Backoff',
    tier: 'Advanced',
    xp: 190,
    estimatedMinutes: 8,
    summary: 'Prevent item-duplication bugs and race conditions using UpdateAsync with a retry loop.',
    explanation: [
      '`SetAsync` overwrites whatever was stored before—if two servers save at once, one update can be lost! `store:UpdateAsync(key, transformFn)` fixes that by reading the latest cloud data, passing it as `oldData` into your `transformFn`, and saving whatever you `return`.',
      'Look at `local data = oldData or { Coins = 0, Level = 1 }`: using `or` as a fallback means "if `oldData` is `nil` (brand-new player), use this starter table instead."',
      'Wrapping `UpdateAsync` in a `for attempt = 1, 3 do` retry loop with `task.wait(0.1 * attempt)` waits longer on each retry (`0.1s`, `0.2s`, `0.3s`) if the cloud briefly hiccups.'
    ],
    beginnerTip: 'Inside the `UpdateAsync` callback, ALWAYS `return data` at the end—if you forget `return`, nothing gets written back!',
    codeExample: 'store:UpdateAsync("BuilderOne", function(old)\n\tlocal current = old or { Wins = 0 } -- fallback if first time playing\n\tcurrent.Wins += 1\n\treturn current                      -- must return the updated table!\nend)',
    objectives: [
      'Trace how `safeUpdate` combines a 3-attempt `pcall()` retry loop with `UpdateAsync`.',
      'Press Play to atomically update `BuilderOne`’s Coins from `100` to `250` and inspect the **DataStores** tab.'
    ],
    hints: [
      'store:UpdateAsync("BuilderOne", function(old) old = old or { Coins = 0 }; old.Coins += 150; return old end)'
    ],
    initialHierarchy: [],
    starterDataStore: {
      PlayerEconomy: {
        BuilderOne: { Coins: 100, Level: 2 },
      },
    },
    scripts: [
      {
        path: 'ServerScriptService/AtomicSave',
        name: 'AtomicSave',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("PlayerEconomy")

local function safeUpdate(key, transform)
\tfor attempt = 1, 3 do
\t\tlocal ok, res = pcall(function()
\t\t\treturn store:UpdateAsync(key, transform)
\t\tend)
\t\tif ok then
\t\t\treturn true, res
\t\tend
\t\twarn("Retry attempt", attempt, res)
\t\ttask.wait(0.1 * attempt)
\tend
\treturn false, nil
end

local ok, updated = safeUpdate("BuilderOne", function(oldData)
\tlocal data = oldData or { Coins = 0, Level = 1 }
\tdata.Coins += 150
\treturn data
end)

if ok then
\tprint("Atomic UpdateAsync complete! New Coins =", updated.Coins)
end
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const rec = (ctx.dataStores['PlayerEconomy']?.['BuilderOne'] as { Coins?: number } | undefined);
      return passFail(
        [
          { label: 'Atomically update Coins from 100 to 250 via UpdateAsync', passed: ctx.hasRunPlay && rec?.Coins === 250 },
        ],
        'Senior backend DataStore pattern mastered!'
      );
    },
  },
  {
    id: 'm7_l3_raycasting',
    moduleId: 'm7',
    moduleNumber: 7,
    moduleTitle: 'DataStores, Raycasting & NPC AI',
    lessonNumber: 26,
    title: 'Raycasting: workspace:Raycast & RaycastParams',
    tier: 'Advanced',
    xp: 180,
    estimatedMinutes: 8,
    summary: 'Cast invisible 3D math beams to detect obstacles, measure distances, and render laser beams.',
    explanation: [
      '`workspace:Raycast(origin, direction, params)` fires an invisible 3D laser beam starting at `origin` and extending along `direction` (note: `direction` is BOTH direction AND length—`Vector3.new(0, 0, -30)` casts 30 studs along `-Z`, NOT to world point `(0,0,-30)`!).',
      '`RaycastParams.new()` configures what the ray ignores: `Enum.RaycastFilterType.Exclude` + `FilterDescendantsInstances = { emitter }` stops the ray from immediately hitting the Emitter itself.',
      'When the ray hits a Part, `result` contains `.Instance` (hit Part), `.Position` (exact hit point), and `.Distance` (studs traveled). `origin:Lerp(result.Position, 0.5)` finds the exact midpoint halfway between them, and `CFrame.lookAt(mid, result.Position)` aims the visible `LaserBeam` directly at the wall!'
    ],
    beginnerTip: 'Always check `if result then` before reading `result.Position`—if the ray hits nothing, `workspace:Raycast()` returns `nil`.',
    codeExample: 'local params = RaycastParams.new()\nparams.FilterType = Enum.RaycastFilterType.Exclude\nparams.FilterDescendantsInstances = { sensor }\n\n-- Cast 20 studs straight DOWN (0, -20, 0)\nlocal hit = workspace:Raycast(sensor.Position, Vector3.new(0, -20, 0), params)\nif hit then\n\tprint("Ground:", hit.Instance.Name, "Distance:", hit.Distance)\nend',
    objectives: [
      'Inspect how `RaycastParams` excludes `Emitter` and how `origin:Lerp(result.Position, 0.5)` + `CFrame.lookAt` span the laser.',
      'Press Play to fire the raycast against `TargetWall` and spawn `LaserBeam` in 3D.'
    ],
    hints: [
      'local result = workspace:Raycast(origin, Vector3.new(0, 0, -30), params)',
      'If result then beam.Size = Vector3.new(0.25, 0.25, result.Distance) end'
    ],
    initialHierarchy: [
      {
        id: 'ws_m7_3',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [
          {
            id: 'emitter_part',
            name: 'Emitter',
            className: 'Part',
            properties: {
              Position: [0, 3, 10],
              Size: [2, 2, 2],
              Color: '#3B82F6',
              Material: 'Metal',
              Anchored: true,
              CanCollide: true,
            },
          },
          {
            id: 'target_wall',
            name: 'TargetWall',
            className: 'Part',
            properties: {
              Position: [0, 3, -8],
              Size: [10, 6, 2],
              Color: '#EF4444',
              Material: 'SmoothPlastic',
              Anchored: true,
              CanCollide: true,
            },
          },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/LaserRaycast',
        name: 'LaserRaycast',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local emitter = workspace:WaitForChild("Emitter")
local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude
params.FilterDescendantsInstances = { emitter }

local origin = emitter.Position
local direction = Vector3.new(0, 0, -30)
local result = workspace:Raycast(origin, direction, params)

if result then
\tprint("Raycast hit:", result.Instance.Name, "Distance:", math.round(result.Distance))
\tlocal beam = Instance.new("Part")
\tbeam.Name = "LaserBeam"
\tbeam.Anchored = true
\tbeam.CanCollide = false
\tbeam.Material = Enum.Material.Neon
\tbeam.Color = Color3.fromRGB(56, 189, 248)
\tbeam.Size = Vector3.new(0.3, 0.3, result.Distance)
\tbeam.CFrame = CFrame.lookAt(origin:Lerp(result.Position, 0.5), result.Position)
\tbeam.Parent = workspace
end
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const hitTarget = ctx.logs.some((l) => l.message.includes('TargetWall'));
      const beam = ctx.findInstance('Workspace/LaserBeam');
      return passFail(
        [
          { label: 'Raycast detects TargetWall while excluding Emitter', passed: ctx.hasRunPlay && hitTarget },
          { label: 'Spawn LaserBeam spanning the exact distance', passed: Boolean(beam) },
        ],
        '3D Raycasting mastered! You can now code lasers, hitscan weapons, and line-of-sight sensors.'
      );
    },
  },
  {
    id: 'm7_l4_npc_ai',
    moduleId: 'm7',
    moduleNumber: 7,
    moduleTitle: 'DataStores, Raycasting & NPC AI',
    lessonNumber: 27,
    title: 'Script-Built Guard AI & State Machines',
    tier: 'Advanced',
    xp: 200,
    estimatedMinutes: 8,
    summary: 'Build a patrolling 3D Guard strictly by script and steer it between waypoints using CFrame.lookAt and a state machine.',
    explanation: [
      'A State Machine uses a string variable (`state = "Patrol"` vs `"Alert"`) to switch behavior cleanly each frame inside `RunService.Heartbeat`.',
      'Vector math powers steering: subtracting two positions (`dir = targetPos - guard.Position`) gives the vector pointing from the drone to its target. `dir.Magnitude` is the exact distance in studs, and `dir.Unit` is that same direction shrunk to a clean length of `1` stud!',
      'Using `dir.Unit * math.min(dir.Magnitude, dt * 6)` moves 6 studs/second toward `targetPos` without overshooting, while `CFrame.lookAt(newPos, targetPos)` smoothly rotates the drone to face where it is flying.'
    ],
    beginnerTip: 'Press Play and walk near `PatrolDrone` with WASD—when your distance (`Magnitude`) drops under 10 studs, watch it switch to `"Alert"` and turn red!',
    codeExample: 'local offset = targetPos - npc.Position\nlocal distance = offset.Magnitude -- studs away\nlocal direction = offset.Unit     -- length-1 arrow toward target\n\nif distance > 0.5 then\n\tnpc.CFrame = CFrame.lookAt(npc.Position + direction * (dt * 5), targetPos)\nend',
    objectives: [
      'Read how `dir.Magnitude`, `dir.Unit`, and `CFrame.lookAt` drive the Patrol/Alert state machine.',
      'Press Play to watch `PatrolDrone` steer between waypoints (and walk near it with WASD to trigger red Alert mode!).'
    ],
    hints: [
      'Walk toward the Guard with WASD during Play to test the Alert state!'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/GuardAI',
        name: 'GuardAI',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local guard = Instance.new("Part")
guard.Name = "PatrolDrone"
guard.Size = Vector3.new(2.2, 2.2, 2.2)
guard.Position = Vector3.new(-8, 2, -4)
guard.Color = Color3.fromRGB(56, 189, 248)
guard.Material = Enum.Material.Neon
guard.Anchored = true
guard.Parent = workspace

local waypoints = { Vector3.new(-8, 2, -4), Vector3.new(8, 2, -4) }
local wpIndex = 1
local state = "Patrol"

print("PatrolDrone active! Current state:", state)

RunService.Heartbeat:Connect(function(dt)
\tlocal player = Players.LocalPlayer
\tlocal char = player and player.Character
\tlocal hrp = char and char:FindFirstChild("HumanoidRootPart")
\tlocal targetPos = waypoints[wpIndex]

\tif hrp and (hrp.Position - guard.Position).Magnitude < 10 then
\t\tstate = "Alert"
\t\tguard.Color = Color3.fromRGB(239, 68, 68)
\t\ttargetPos = Vector3.new(hrp.Position.X, 2, hrp.Position.Z)
\telse
\t\tstate = "Patrol"
\t\tguard.Color = Color3.fromRGB(56, 189, 248)
\t\tif (targetPos - guard.Position).Magnitude < 0.6 then
\t\t\twpIndex = wpIndex == 1 and 2 or 1
\t\t\ttargetPos = waypoints[wpIndex]
\t\tend
\tend

\tlocal dir = (targetPos - guard.Position)
\tif dir.Magnitude > 0.1 then
\t\tlocal step = dir.Unit * math.min(dir.Magnitude, dt * 6)
\t\tguard.CFrame = CFrame.lookAt(guard.Position + step, targetPos)
\tend
end)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const drone = ctx.findInstance('Workspace/PatrolDrone');
      const pos = (drone?.properties.Position as number[]) ?? [-8, 2, -4];
      return passFail(
        [
          { label: 'Spawn PatrolDrone in Workspace', passed: Boolean(drone) },
          { label: 'Drone actively steers along patrol path (X > -7)', passed: ctx.hasRunPlay && pos[0] > -7 },
        ],
        'Module 7 Complete! You now command persistence, raycasting, and autonomous AI.'
      );
    },
  },

  // =========================================================================
  // MODULE 8: THE HARDEST PARTS OF LUAU & PRO GAME ARCHITECTURE
  // =========================================================================
  {
    id: 'm8_l1_metatables',
    moduleId: 'm8',
    moduleNumber: 8,
    moduleTitle: 'Hardest Luau: Types, Metatables, Coroutines & Capstone',
    lessonNumber: 28,
    title: 'Metatables & Metamethods (__index, __add, __tostring)',
    tier: 'Expert',
    xp: 220,
    estimatedMinutes: 8,
    summary: 'Unlock Luau’s deepest language feature: teaching plain tables to behave like custom mathematical types and smart objects.',
    explanation: [
      'Normally, you cannot write `tableA + tableB` in Luau—it would error! `setmetatable(myTable, metaTable)` attaches a rulebook table (`metaTable`) that tells Luau what special operations should do.',
      'Keys starting with two underscores are called **metamethods**: `__index` (where to look if a key is missing), `__add` (runs automatically when you write `a + b`), and `__tostring` (runs when `tostring(obj)` or `print(obj)` converts your table to text).',
      '`string.format("ATK:%d DEF:%d", ...)` formats numbers neatly into a template string (`%d` inserts a whole integer).'
    ],
    proNote: 'Metatables are how Roblox’s own `Vector3` (`posA + posB`) and Luau OOP classes work under the hood.',
    beginnerTip: 'Notice `Stat.new(atk, def)` returns `setmetatable({ Attack = atk, Defense = def }, Stat)`—so both `sword` and `shield` share `Stat`’s `__add` and `__tostring` rules!',
    codeExample: 'local Vec2 = {}\nVec2.__index = Vec2\nfunction Vec2.__add(a, b)\n\treturn setmetatable({ X = a.X + b.X, Y = a.Y + b.Y }, Vec2)\nend\nfunction Vec2.__tostring(self)\n\treturn `({self.X}, {self.Y})`\nend',
    objectives: [
      'Trace how `sword + shield` triggers `Stat.__add` and `tostring(loadout)` triggers `Stat.__tostring`.',
      'Press Play and confirm `ATK:45 DEF:45` prints in Output.'
    ],
    hints: [
      'StatMeta.__add = function(a, b) return Stat.new(a.Attack + b.Attack, a.Defense + b.Defense) end',
      'StatMeta.__tostring = function(self) return `ATK:{self.Attack} DEF:{self.Defense}` end'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/MetatableLab',
        name: 'MetatableLab',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local Stat = {}
Stat.__index = Stat

function Stat.__add(a, b)
\treturn Stat.new(a.Attack + b.Attack, a.Defense + b.Defense)
end

function Stat.__tostring(self)
\treturn string.format("ATK:%d DEF:%d", self.Attack, self.Defense)
end

function Stat.new(atk, def)
\treturn setmetatable({ Attack = atk, Defense = def }, Stat)
end

local sword = Stat.new(35, 5)
local shield = Stat.new(10, 40)
local loadout = sword + shield

print("Combined Loadout ->", tostring(loadout))
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const ok = ctx.logs.some((l) => l.message.includes('ATK:45 DEF:45'));
      return passFail(
        [
          { label: 'Overload + and tostring via __add and __tostring', passed: ctx.hasRunPlay && ok },
        ],
        'Metamethods conquered! You just built a custom operator-overloaded type in Luau.'
      );
    },
  },
  {
    id: 'm8_l2_oop',
    moduleId: 'm8',
    moduleNumber: 8,
    moduleTitle: 'Hardest Luau: Types, Metatables, Coroutines & Capstone',
    lessonNumber: 29,
    title: 'Object-Oriented Luau & Class Inheritance',
    tier: 'Expert',
    xp: 230,
    estimatedMinutes: 9,
    summary: 'Architect clean OOP class hierarchies with BaseEntity -> LaserTurret inheritance using chained __index metatables.',
    explanation: [
      'Object-Oriented Programming (OOP) bundles data + functions into blueprints called classes: `BaseEntity.__index = BaseEntity` tells every entity created with `setmetatable({}, BaseEntity)` to look up methods on `BaseEntity`.',
      'Dot vs Colon in definitions: `function BaseEntity.new(name)` is called with a dot, while `function BaseEntity:TakeDamage(amount)` uses a colon `:`, which automatically creates a hidden first variable `self` pointing to whichever specific object (`alpha`) called it!',
      'Inheritance: `local Turret = setmetatable({}, BaseEntity)` links `Turret`’s fallback chain to `BaseEntity`. When you call `alpha:TakeDamage(40)`, Luau checks `alpha` -> `Turret` -> `BaseEntity` and finds `:TakeDamage()` automatically!'
    ],
    beginnerTip: 'Inspect both tabs: `EntityOOP` defines `BaseEntity` and `Turret`, while `TestOOP` creates `AlphaTurret` and calls both `:Fire()` and inherited `:TakeDamage(40)`.',
    codeExample: 'local Animal = {}\nAnimal.__index = Animal\nfunction Animal:Speak() print("...") end\n\nlocal Wolf = setmetatable({}, Animal) -- Wolf inherits Animal!\nWolf.__index = Wolf\nfunction Wolf.new() return setmetatable({}, Wolf) end',
    objectives: [
      'Review how `Turret` inherits `TakeDamage` from `BaseEntity` via chained `setmetatable` + `__index`.',
      'Press Play to spawn `AlphaTurret`, fire a pulse, and reduce HP from 100 to 60.'
    ],
    hints: [
      'setmetatable(Turret, BaseEntity) makes Turret inherit BaseEntity:TakeDamage!'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ReplicatedStorage/EntityOOP',
        name: 'EntityOOP',
        parentPath: 'ReplicatedStorage',
        className: 'ModuleScript',
        code: `local BaseEntity = {}
BaseEntity.__index = BaseEntity

function BaseEntity.new(name, maxHp)
\tlocal self = setmetatable({}, BaseEntity)
\tself.Name = name
\tself.Health = maxHp
\treturn self
end

function BaseEntity:TakeDamage(amount)
\tself.Health = math.max(0, self.Health - amount)
\tprint(self.Name, "took", amount, "damage. HP =", self.Health)
end

local Turret = setmetatable({}, BaseEntity)
Turret.__index = Turret

function Turret.new(name, pos)
\tlocal self = setmetatable(BaseEntity.new(name, 100), Turret)
\tlocal body = Instance.new("Part")
\tbody.Name = name
\tbody.Size = Vector3.new(2.5, 3, 2.5)
\tbody.Position = pos
\tbody.Color = Color3.fromRGB(99, 102, 241)
\tbody.Material = Enum.Material.Metal
\tbody.Anchored = true
\tbody.Parent = workspace
\tself.Part = body
\treturn self
end

function Turret:Fire()
\tself.Part.Color = Color3.fromRGB(250, 204, 21)
\tprint(self.Name, "fired a pulse!")
end

return { BaseEntity = BaseEntity, Turret = Turret }
`,
      },
      {
        path: 'ServerScriptService/TestOOP',
        name: 'TestOOP',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local OOP = require(game:GetService("ReplicatedStorage"):WaitForChild("EntityOOP"))

local alpha = OOP.Turret.new("AlphaTurret", Vector3.new(0, 1.5, 0))
alpha:Fire()
alpha:TakeDamage(40)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const fired = ctx.logs.some((l) => l.message.includes('AlphaTurret fired'));
      const damaged = ctx.logs.some((l) => l.message.includes('HP = 60'));
      return passFail(
        [
          { label: 'Spawn AlphaTurret from OOP subclass', passed: Boolean(ctx.findInstance('Workspace/AlphaTurret')) },
          { label: 'Call subclass :Fire() and inherited :TakeDamage(40)', passed: ctx.hasRunPlay && fired && damaged },
        ],
        'Prototype inheritance in Luau mastered!'
      );
    },
  },
  {
    id: 'm8_l3_strict_types',
    moduleId: 'm8',
    moduleNumber: 8,
    moduleTitle: 'Hardest Luau: Types, Metatables, Coroutines & Capstone',
    lessonNumber: 30,
    title: '--!strict Type Checking, Unions & Generics (<T>)',
    tier: 'Master',
    xp: 250,
    estimatedMinutes: 8,
    summary: 'Write production-grade --!strict Luau with custom type aliases, union types, and generic functions <T>.',
    explanation: [
      'Putting `--!strict` on line 1 activates Luau’s static type checker, catching mismatched numbers/strings/missing fields right in the editor BEFORE you press Play!',
      'A colon after a parameter or variable specifies its type (`attacksPerSec: number`), and `type Weapon = { Name: string, Damage: number, ... }` defines a reusable blueprint for a table’s exact shape.',
      'Generics `<T>` act like a type wildcard: `function cloneEntry<T>(value: T): T` accepts ANY type `T` (a `Weapon`, a `string`, etc.) and guarantees the returned value keeps that exact same type instead of losing type info!'
    ],
    proNote: 'Try intentionally changing `Damage = 60` to `Damage = "oops"` to watch the `--!strict` diagnostic flag the bug immediately (then restore `60` to pass).',
    beginnerTip: 'In `function computeDps(w: Weapon, attacksPerSec: number): number`, the `: number` after the closing `)` declares what type the function returns.',
    codeExample: '--!strict\ntype Item = { Name: string, Price: number }\n\nlocal function firstItem<T>(list: { T }): T\n\treturn list[1]\nend\n\nlocal sword: Item = { Name = "Blade", Price = 50 }\nlocal picked: Item = firstItem({ sword })',
    objectives: [
      'Keep `--!strict` on line 1 with 0 static type diagnostics.',
      'Trace how `Weapon`, `cloneEntry<T>`, and `computeDps` enforce strict types, then press Play to print `Strict DPS = 150`.'
    ],
    hints: [
      'Ensure all type annotations match their assigned values so --!strict reports 0 diagnostics.'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ServerScriptService/StrictLuau',
        name: 'StrictLuau',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `--!strict

type Weapon = {
\tName: string,
\tDamage: number,
\tCritChance: number,
}

local function cloneEntry<T>(value: T): T
\treturn value
end

local function computeDps(w: Weapon, attacksPerSec: number): number
\treturn w.Damage * attacksPerSec * (1 + w.CritChance)
end

local railgun: Weapon = {
\tName = "Railgun",
\tDamage = 60,
\tCritChance = 0.25,
}

local copy: Weapon = cloneEntry(railgun)
local dps: number = computeDps(copy, 2)
print(copy.Name, "Strict DPS =", dps)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const code = ctx.scripts['ServerScriptService/StrictLuau'] ?? '';
      const hasStrict = code.trimStart().startsWith('--!strict');
      const noErrors = ctx.diagnostics.filter((d) => d.severity === 'error').length === 0;
      const printed = ctx.logs.some((l) => l.message.includes('Strict DPS = 150'));
      return passFail(
        [
          { label: 'Enable --!strict mode with 0 type diagnostics', passed: hasStrict && noErrors },
          { label: 'Execute generic & typed functions to print Strict DPS = 150', passed: ctx.hasRunPlay && printed },
        ],
        '--!strict static typing and generics mastered!'
      );
    },
  },
  {
    id: 'm8_l4_coroutines_janitor',
    moduleId: 'm8',
    moduleNumber: 8,
    moduleTitle: 'Hardest Luau: Types, Metatables, Coroutines & Capstone',
    lessonNumber: 31,
    title: 'Coroutines & Custom Signal / Janitor Memory Frameworks',
    tier: 'Master',
    xp: 270,
    estimatedMinutes: 10,
    summary: 'Master manual coroutine.create/resume/yield execution and build a custom Signal + Janitor cleanup framework from scratch.',
    explanation: [
      'A Coroutine is a function you can pause halfway through and resume later! `coroutine.create(fn)` builds the thread, `coroutine.resume(co, arg)` runs it until `coroutine.yield(...)` pauses it (`"suspended"` status) and sends back a value, and the next `resume` passes a new value into `bonus` until it finishes (`"dead"`).',
      'In large games, leftover `:Connect()` listeners or spawned `Part`s waste memory after a round ends. A `Janitor` (Maid) class collects temporary objects in `self._tasks` via `:Add(obj)`.',
      'When the round ends, calling `roundJanitor:Cleanup()` checks `typeof(item)`: it calls `:Disconnect()` on connections and `:Destroy()` on 3D `Instance`s, then empties `_tasks` with `table.clear()`.'
    ],
    beginnerTip: 'Notice how `local tempWall = roundJanitor:Add(Instance.new("Part"))` registers AND returns the Part on the same line—super clean!',
    codeExample: 'local co = coroutine.create(function(start)\n\tlocal extra = coroutine.yield(start * 2) -- pauses and returns 10\n\treturn extra + 1\nend)\nlocal ok1, v1 = coroutine.resume(co, 5)  -- ok1=true, v1=10 (suspended)\nlocal ok2, v2 = coroutine.resume(co, 20) -- ok2=true, v2=21 (dead)',
    objectives: [
      'Inspect `JanitorSignal` and `MasterLifecycle` tabs to see coroutine states (`suspended` -> `dead`) and automatic resource cleanup.',
      'Press Play and verify `RoundBarrier` spawns briefly and is cleanly destroyed by `Janitor:Cleanup()`.'
    ],
    hints: [
      'Check how Janitor:Cleanup() calls :Disconnect() on connections and :Destroy() on Instances.'
    ],
    initialHierarchy: [],
    scripts: [
      {
        path: 'ReplicatedStorage/JanitorSignal',
        name: 'JanitorSignal',
        parentPath: 'ReplicatedStorage',
        className: 'ModuleScript',
        code: `local Janitor = {}
Janitor.__index = Janitor

function Janitor.new()
\treturn setmetatable({ _tasks = {} }, Janitor)
end

function Janitor:Add(obj)
\ttable.insert(self._tasks, obj)
\treturn obj
end

function Janitor:Cleanup()
\tlocal cleaned = 0
\tfor _, item in ipairs(self._tasks) do
\t\tif typeof(item) == "RBXScriptConnection" then
\t\t\titem:Disconnect()
\t\t\tcleaned += 1
\t\telseif typeof(item) == "Instance" then
\t\t\titem:Destroy()
\t\t\tcleaned += 1
\t\tend
\tend
\ttable.clear(self._tasks)
\treturn cleaned
end

return Janitor
`,
      },
      {
        path: 'ServerScriptService/MasterLifecycle',
        name: 'MasterLifecycle',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local Janitor = require(game:GetService("ReplicatedStorage"):WaitForChild("JanitorSignal"))

-- 1. Coroutine state machine (pause & resume mid-function)
local waveCo = coroutine.create(function(waveName)
\tprint("Wave Step 1:", waveName)
\tlocal bonus = coroutine.yield("PausedAfterWave1")
\tprint("Wave Step 2 resumed with bonus:", bonus)
\treturn "WaveComplete"
end)

local ok1, msg1 = coroutine.resume(waveCo, "BossPhase")
print("Coroutine yielded:", ok1, msg1, "Status:", coroutine.status(waveCo))
local ok2, msg2 = coroutine.resume(waveCo, 500)
print("Coroutine finished:", ok2, msg2, "Status:", coroutine.status(waveCo))

-- 2. Janitor memory-safe round cleanup
local roundJanitor = Janitor.new()
local tempWall = roundJanitor:Add(Instance.new("Part"))
tempWall.Name = "RoundBarrier"
tempWall.Anchored = true
tempWall.Position = Vector3.new(0, 2, -6)
tempWall.Parent = workspace

task.wait(0.4)
local count = roundJanitor:Cleanup()
print("Janitor cleaned resources:", count)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const coYielded = ctx.logs.some((l) => l.message.includes('PausedAfterWave1') && l.message.includes('suspended'));
      const coDone = ctx.logs.some((l) => l.message.includes('WaveComplete') && l.message.includes('dead'));
      const cleaned = ctx.logs.some((l) => l.message.includes('Janitor cleaned resources: 1'));
      const barrierGone = !ctx.findInstance('Workspace/RoundBarrier');
      return passFail(
        [
          { label: 'Pause and resume coroutine across states', passed: ctx.hasRunPlay && coYielded && coDone },
          { label: 'Janitor cleans up RoundBarrier from Workspace', passed: ctx.hasRunPlay && cleaned && barrierGone },
        ],
        'Master-tier Luau architecture conquered!'
      );
    },
  },
  {
    id: 'm8_l5_capstone',
    moduleId: 'm8',
    moduleNumber: 8,
    moduleTitle: 'Hardest Luau: Types, Metatables, Coroutines & Capstone',
    lessonNumber: 32,
    title: 'Master Capstone: Complete Model-Free Obby & Coin Game',
    tier: 'Master',
    xp: 400,
    estimatedMinutes: 12,
    summary: 'Combine everything you learned into a complete, playable 3D Roblox game built 100% through Luau scripts—zero modeling tools used.',
    explanation: [
      'Welcome to the Master Capstone! Open all 3 script tabs to see how real Roblox studios split a game: (1) `ArenaBuilder` (`ModuleScript` in `ReplicatedStorage`) generates the 3D obby & tagged coins, (2) `CapstoneServer` runs `leaderstats`, `DataStoreService`, coin touches, and `Heartbeat` spinning, and (3) `CapstoneClient` renders the live `ScreenGui` HUD.',
      'Notice the ternary pattern on line 22 of `CapstoneServer`: `(ok and typeof(saved) == "number") and saved or 0` safely uses `saved` if it’s a number, or falls back to `0` if this is a first-time player.',
      'When you touch a coin in 3D, the Server updates `leaderstats.Coins`, saves to `DataStoreService`, and calls `collectEvent:FireClient(p, c.Value)` so your Client HUD tweens smoothly via `OnClientEvent`!'
    ],
    proNote: 'After completing this Capstone, switch to **Sandbox** anytime in the top bar to build and cloud-save your own full model-free Roblox experiences!',
    beginnerTip: 'Try tweaking `PlatformCount` or `Spacing` in `CapstoneServer`, press Play, and walk forward with WASD + Space across your procedural obby to collect coins!',
    codeExample: '-- End-to-end Capstone flow:\n-- 1. ArenaBuilder:Build() -> spawns 6 platforms + "CapstoneCoin" tags\n-- 2. Coin Touched (Server) -> updates DataStore + fires CollectCoin:FireClient\n-- 3. CapstoneClient (LocalScript) -> OnClientEvent updates HUD & plays Tween',
    objectives: [
      'Explore `ArenaBuilder`, `CapstoneServer`, and `CapstoneClient` to trace the full `--!strict` architecture.',
      'Press Play with 0 strict errors to generate `ProceduralObby` + `CapstoneHUD`—and walk forward with WASD + Space to collect coins!'
    ],
    hints: [
      'The full starter architecture is wired—try customizing platform spacing, coin colors, or Tween speeds, then press Play and walk through your game!'
    ],
    initialHierarchy: [
      {
        id: 'rep_cap',
        name: 'ReplicatedStorage',
        className: 'ReplicatedStorage',
        properties: {},
        children: [
          { id: 'rem_coin', name: 'CollectCoin', className: 'RemoteEvent', properties: {} },
        ],
      },
    ],
    scripts: [
      {
        path: 'ReplicatedStorage/ArenaBuilder',
        name: 'ArenaBuilder',
        parentPath: 'ReplicatedStorage',
        className: 'ModuleScript',
        code: `--!strict
local CollectionService = game:GetService("CollectionService")

export type ArenaConfig = {
\tPlatformCount: number,
\tSpacing: number,
}

local ArenaBuilder = {}
ArenaBuilder.__index = ArenaBuilder

function ArenaBuilder.new(config: ArenaConfig)
\treturn setmetatable({ Config = config }, ArenaBuilder)
end

function ArenaBuilder:Build()
\tlocal model = Instance.new("Model")
\tmodel.Name = "ProceduralObby"

\tfor i = 1, self.Config.PlatformCount do
\t\tlocal plat = Instance.new("Part")
\t\tplat.Name = "Platform_" .. i
\t\tplat.Size = Vector3.new(5, 0.8, 5)
\t\tplat.Anchored = true
\t\tplat.Material = Enum.Material.SmoothPlastic
\t\tplat.Color = Color3.fromHSV(i / self.Config.PlatformCount, 0.65, 0.9)
\t\tplat.CFrame = CFrame.new(math.sin(i) * 3, 0.5 + i * 0.4, 8 - i * self.Config.Spacing)
\t\tplat.Parent = model

\t\tif i >= 2 then
\t\t\tlocal coin = Instance.new("Part")
\t\t\tcoin.Name = "Coin_" .. i
\t\t\tcoin.Size = Vector3.new(1.4, 1.4, 0.4)
\t\t\tcoin.Anchored = true
\t\t\tcoin.CanCollide = false
\t\t\tcoin.Material = Enum.Material.Neon
\t\t\tcoin.Color = Color3.fromRGB(250, 204, 21)
\t\t\tcoin.Position = plat.Position + Vector3.new(0, 2.2, 0)
\t\t\tcoin.Parent = model
\t\t\tCollectionService:AddTag(coin, "CapstoneCoin")
\t\tend
\tend

\tmodel.Parent = workspace
\treturn model
end

return ArenaBuilder
`,
      },
      {
        path: 'ServerScriptService/CapstoneServer',
        name: 'CapstoneServer',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `--!strict
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local DataStoreService = game:GetService("DataStoreService")

local ArenaBuilder = require(ReplicatedStorage:WaitForChild("ArenaBuilder"))
local collectEvent = ReplicatedStorage:WaitForChild("CollectCoin")
local coinStore = DataStoreService:GetDataStore("CapstoneCoins")

local builder = ArenaBuilder.new({ PlatformCount = 6, Spacing = 5.5 })
builder:Build()

Players.PlayerAdded:Connect(function(player)
\tlocal ls = Instance.new("Folder")
\tls.Name = "leaderstats"
\tls.Parent = player

\tlocal coins = Instance.new("IntValue")
\tcoins.Name = "Coins"
\tlocal ok, saved = pcall(function() return coinStore:GetAsync(player.Name) end)
\tcoins.Value = (ok and typeof(saved) == "number") and saved or 0
\tcoins.Parent = ls
end)

for _, coin in ipairs(CollectionService:GetTagged("CapstoneCoin")) do
\tlocal collected = false
\tcoin.Touched:Connect(function()
\t\tif collected then return end
\t\tcollected = true
\t\tlocal p = Players.LocalPlayer
\t\tif p and p:FindFirstChild("leaderstats") then
\t\t\tlocal c = p.leaderstats.Coins
\t\t\tc.Value += 10
\t\t\tpcall(function() coinStore:SetAsync(p.Name, c.Value) end)
\t\t\tcollectEvent:FireClient(p, c.Value)
\t\tend
\t\tcoin:Destroy()
\tend)
end

RunService.Heartbeat:Connect(function(dt)
\tfor _, coin in ipairs(CollectionService:GetTagged("CapstoneCoin")) do
\t\tif coin.Parent then
\t\t\tcoin.CFrame *= CFrame.Angles(0, dt * 3, 0)
\t\tend
\tend
end)

print("Capstone Game Online! Walk forward with WASD to collect coins.")
`,
      },
      {
        path: 'StarterPlayer/StarterPlayerScripts/CapstoneClient',
        name: 'CapstoneClient',
        parentPath: 'StarterPlayer/StarterPlayerScripts',
        className: 'LocalScript',
        code: `--!strict
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local collectEvent = ReplicatedStorage:WaitForChild("CollectCoin")

local gui = Instance.new("ScreenGui")
gui.Name = "CapstoneHUD"
gui.Parent = playerGui

local hudLabel = Instance.new("TextLabel")
hudLabel.Position = UDim2.new(0.03, 0, 0.04, 0)
hudLabel.Size = UDim2.fromOffset(210, 44)
hudLabel.BackgroundColor3 = Color3.fromRGB(15, 23, 42)
hudLabel.TextColor3 = Color3.fromRGB(250, 204, 21)
hudLabel.Text = "Coins: 0"
hudLabel.Parent = gui

collectEvent.OnClientEvent:Connect(function(totalCoins)
\thudLabel.Text = "Coins: " .. tostring(totalCoins)
\tTweenService:Create(hudLabel, TweenInfo.new(0.25, Enum.EasingStyle.Bounce), {
\t\tBackgroundColor3 = Color3.fromRGB(30, 58, 138),
\t}):Play()
end)
`,
      },
    ],
    verify: (ctx: VerificationContext) => {
      const obby = ctx.findInstance('Workspace/ProceduralObby');
      const plats = ctx.getAllParts().filter((p) => p.name.startsWith('Platform_'));
      const coins = ctx.getTagged('CapstoneCoin');
      const noStrictErrs = ctx.diagnostics.filter((d) => d.severity === 'error').length === 0;
      const guiReady = ctx.getGuiElements().some((g) => g.className === 'TextLabel');
      return passFail(
        [
          { label: 'Zero --!strict type errors across scripts', passed: noStrictErrs },
          { label: 'Generate ProceduralObby with >= 5 platforms & >= 4 tagged coins', passed: Boolean(obby) && plats.length >= 5 && coins.length >= 4 },
          { label: 'Render live ScreenGui Coins HUD', passed: ctx.hasRunPlay && guiReady },
        ],
        'CAPSTONE COMPLETE! You went from print() to shipping a full, strictly-typed, model-free 3D Roblox game.'
      );
    },
  },
];
