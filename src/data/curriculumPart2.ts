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
      'A table in Luau { ... } is the universal data structure. It can act as an Array (numbered 1, 2, 3—remember Luau starts counting at 1, not 0!) or a Dictionary (named keys like { Sword = 100, Shield = 75 }).',
      'Use ipairs() to loop over arrays in order, or pairs() (or Luau’s clean "for k, v in tbl do") to loop over dictionaries.'
    ],
    objectives: [
      'Define a shopItems dictionary mapping at least 3 item names to prices.',
      'Loop through shopItems and print each item and price.',
      'Calculate and print the total price of all items.'
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
      'A ModuleScript does not run automatically—instead, it returns a table of functions or settings when another script calls require(moduleScript).',
      'Because ReplicatedStorage is visible to both Server and Client, placing shared math, item catalogs, and config inside ReplicatedStorage is the backbone of clean Roblox architecture.'
    ],
    objectives: [
      'Edit ReplicatedStorage/GameConfig to export a table with Gravity and StartingCoins.',
      'Require GameConfig from ServerScriptService/MainServer and print StartingCoins.',
      'Apply GameConfig.Gravity to workspace.Gravity.'
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
      'Normally, if a line throws an error, the whole script halts immediately. When calling DataStores, HTTP APIs, or parsing unpredictable player input, you MUST wrap calls in pcall(function() ... end).',
      'pcall returns two values: a boolean (success) and either the return value or the error message.'
    ],
    objectives: [
      'Wrap the risky divide(10, 0) call in pcall().',
      'Check if not success then warn("Handled safely:", result) end.',
      'Ensure the final print("Server stayed alive!") still executes.'
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
      'Every multiplayer Roblox game is split in two: the Server (running Scripts in ServerScriptService) owns the truth—coins, health, physics, and DataStores. Each player’s device is a Client (running LocalScripts in StarterPlayerScripts or StarterGui) that handles UI, camera, and keyboard input.',
      'Why? Hackers can edit anything on their own Client, but they CANNOT edit ServerScriptService!'
    ],
    objectives: [
      'Inspect both ServerScriptService/ServerScript and StarterPlayerScripts/ClientScript.',
      'Press Play and observe both [Server] and [Client] tags in the Output console.'
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
      'When a player joins a server, Players.PlayerAdded fires with that Player object.',
      'If you create a Folder named exact lowercase "leaderstats" inside player and put IntValue objects inside it (like "Coins" and "Stage"), Roblox automatically displays them on the top-right player leaderboard!'
    ],
    objectives: [
      'Listen to Players.PlayerAdded.',
      'Create a Folder named "leaderstats" parented to player.',
      'Create an IntValue named "Coins" with Value = 100 inside leaderstats.'
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
      'Because Clients and Server run on different computers, a LocalScript cannot directly change server data. Instead, both sides talk through a RemoteEvent placed in ReplicatedStorage.',
      'Client calls remote:FireServer(data). Server listens with remote.OnServerEvent:Connect(function(player, data) ... end). Notice Roblox automatically injects "player" as the first argument on the server so nobody can fake who sent it!'
    ],
    objectives: [
      'Send "SpawnBeacon" from ClientScript using remote:FireServer("SpawnBeacon").',
      'Handle it in ServerScript OnServerEvent to spawn a neon green Part in workspace.',
      'Check the Network tab in the bottom console to watch the live packet.'
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
      'Rule #1 of Roblox security: NEVER trust the Client. An exploiter can call FireServer(999999999) or fire a RemoteEvent 500 times per second.',
      'Your server handler must validate every argument (typeof(amount) == "number", clamp ranges, check ownership) AND enforce a per-player rate-limit cooldown using os.clock().'
    ],
    objectives: [
      'Validate that requested amount is a number between 1 and 50 (reject 999999).',
      'Enforce a 0.5-second per-player rate limit so rapid burst calls are blocked with warn().',
      'Confirm only valid requests award coins.'
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
      'ScreenGui containers inside PlayerGui render 2D HUD elements right on top of the 3D world. Sizes and positions use UDim2.new(xScale, xOffset, yScale, yOffset) or UDim2.fromOffset(w, h).',
      'Clicking a TextButton fires button.MouseButton1Click—try clicking the button directly on the 3D Viewport!'
    ],
    objectives: [
      'Create a ScreenGui inside player:WaitForChild("PlayerGui").',
      'Add a TextButton with Text = "Spawn Boost Block" and connect MouseButton1Click.',
      'Click the rendered button on the 3D Viewport during Play to spawn a Neon block!'
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
      'TweenService interpolates properties smoothly over time without manual loops. You describe the timing with TweenInfo.new(duration, EasingStyle, EasingDirection) and pass a table of goal properties.',
      'You can even listen to tween.Completed to chain animations together!'
    ],
    objectives: [
      'Create a TweenInfo with duration 1.2s and Enum.EasingStyle.Bounce.',
      'Tween ElevatorPart.Position to Vector3.new(0, 8, 0) and Color to bright cyan.',
      'Play the tween and print "Elevator arrived!" when tween.Completed fires.'
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
      'UserInputService listens to keyboard, mouse, and touch inputs on the Client. Check input.KeyCode == Enum.KeyCode.F inside InputBegan:Connect().',
      'Combine input with a Sound instance (:Play()) so every ability feels responsive.'
    ],
    objectives: [
      'Listen to UserInputService.InputBegan for Enum.KeyCode.F.',
      'Play the Sound instance and spawn a glowing Shockwave part when F is pressed.',
      'Focus the 3D Viewport during Play and press F on your keyboard!'
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
      'Even without modeling a single cloud, changing Lighting.ClockTime, Lighting.Brightness, and Lighting.FogEnd completely transforms a game’s mood—from bright noon to moody midnight.',
      'Watch the 3D Viewport sky and shadows shift live as your script updates Lighting!'
    ],
    objectives: [
      'Get the Lighting service via game:GetService("Lighting").',
      'Animate or set Lighting.ClockTime to 22 (nighttime) and Lighting.FogEnd to 90.',
      'Observe the 3D Viewport shift into night atmosphere.'
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
      'Variables vanish when a server shuts down. DataStoreService saves data to Roblox’s cloud database so players keep their coins and items next time they join.',
      'Because network calls can fail, ALWAYS wrap GetAsync and SetAsync inside pcall(). Check the DataStores tab in the bottom console after pressing Play!'
    ],
    objectives: [
      'Open DataStoreService:GetDataStore("PlayerEconomy").',
      'Save { Coins = 500, Level = 4 } for key "BuilderOne" using pcall + SetAsync.',
      'Read it back with GetAsync and print the loaded Coins.'
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
      'Using SetAsync blindly can overwrite newer data if two servers save at once. Senior Roblox engineers use UpdateAsync(key, transformFunction), which reads the latest value atomically before writing.',
      'Wrapping it in a bounded retry helper with exponential backoff ensures transient cloud hiccups never lose player progress.'
    ],
    objectives: [
      'Write a retry helper that attempts UpdateAsync up to 3 times inside pcall().',
      'Atomically add +150 Coins to BuilderOne’s existing saved balance (starting at 100 -> 250).',
      'Verify final stored Coins == 250 in the DataStores inspector.'
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
      'A Raycast shoots an invisible mathematical line from an origin in a direction vector. If it hits a Part, workspace:Raycast() returns a RaycastResult with .Instance, .Position, .Normal, and .Distance!',
      'Use RaycastParams with FilterType = Enum.RaycastFilterType.Exclude so a laser doesn’t hit the turret that fired it.'
    ],
    objectives: [
      'Configure RaycastParams to exclude the Emitter part.',
      'Cast a ray from Emitter.Position toward TargetWall.',
      'Print the hit Instance name and render a visible Neon LaserBeam spanning the exact hit distance.'
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
      'You don’t need pre-rigged character models to create AI enemies or drones! A clean state machine ("Patrol" vs "Alert") moves a script-built Guard smoothly toward waypoints using CFrame.lookAt() and checks distance to the player.',
      'This is how autonomous drones, turrets, and boss mechanics are engineered in pure Luau.'
    ],
    objectives: [
      'Patrol the Guard between Waypoint A (-8, 2, -4) and Waypoint B (8, 2, -4).',
      'Face the movement direction using CFrame.lookAt().',
      'Switch state to "Alert" and turn the Guard red if the player is within 10 studs.'
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
      'A metatable gives a regular table custom superpowers via special keys called metamethods: __index (fallback lookup), __add (what happens when you write a + b), __tostring (custom print formatting), and __call (calling a table like a function!).',
      'In this lesson, you’ll engineer a custom 2D StatVector type that supports + addition and clean string formatting.'
    ],
    proNote: 'Metatables are how Roblox’s own Vector3 and Luau OOP classes work under the hood.',
    objectives: [
      'Create a metatable with __add and __tostring metamethods.',
      'Add two custom tables (a + b) to produce a combined StatVector.',
      'Print the result using tostring() / print() and verify __tostring fires.'
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
      'Real Roblox studios organize complex enemies, weapons, and vehicles into Object-Oriented classes inside ModuleScripts.',
      'By setting setmetatable(SubClass, BaseClass), any method not found on SubClass automatically delegates up the prototype chain to BaseClass—true inheritance in pure Luau!'
    ],
    objectives: [
      'Define BaseEntity in ReplicatedStorage/EntityOOP with :TakeDamage(amount).',
      'Inherit Turret from BaseEntity via setmetatable(Turret, BaseEntity) and add :Fire().',
      'Instantiate a Turret, spawn its 3D Part, call :Fire() and :TakeDamage(40), and print remaining HP.'
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
      'At the top of professional Roblox scripts, you will see "--!strict". This activates Luau’s static type checker to catch bugs BEFORE you even press Play!',
      'You can define custom object shapes (type Weapon = { Name: string, Damage: number }), optional/union types (number | nil), and generic functions (function wrap<T>(value: T)) that work safely across any type.'
    ],
    proNote: 'Try intentionally changing "local dmg: number = 45" to a string "oops" to watch the --!strict diagnostic catch it instantly!',
    objectives: [
      'Keep --!strict at line 1 with zero static type errors.',
      'Define a custom Weapon type and a generic function cloneEntry<T>(entry: T): T.',
      'Print the strictly-typed weapon damage calculation.'
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
      'Memory leaks happen in large Roblox games when rounds end but old RBXScriptConnections or spawned Parts stay alive forever. Pro frameworks solve this with a Janitor (Maid) class and custom Signals.',
      'And under the hood of task.spawn() are Luau Coroutines: threads you can pause mid-function with coroutine.yield() and wake back up with coroutine.resume().'
    ],
    objectives: [
      'Run a multi-step coroutine using coroutine.create, coroutine.resume, and coroutine.yield.',
      'Implement Janitor:Add(item) and Janitor:Cleanup() to disconnect connections and destroy temporary Parts.',
      'Verify both the coroutine state progression and clean Janitor teardown in Output.'
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
      'Congratulations on reaching the final Capstone! Here, a --!strict OOP ModuleScript, procedural CFrame obstacle platforms, CollectionService spinning coins, RemoteEvent server-authoritative collection, ScreenGui HUD, TweenService win gate, and DataStoreService saving all work together as one cohesive game.',
      'Press Play, walk across the procedural platforms with WASD + Space, collect coins, and watch your HUD and DataStore update live!'
    ],
    proNote: 'After completing this Capstone, open the Freeplay Sandbox anytime to build and cloud-save your own full model-free Roblox games!',
    objectives: [
      'Generate at least 5 procedural obby platforms and 4 tagged "CapstoneCoin" collectibles.',
      'Wire ServerScriptService/CapstoneServer with Players leaderstats + DataStore saving + RemoteEvent validation.',
      'Wire StarterPlayerScripts/CapstoneClient with a live ScreenGui Coin HUD.',
      'Press Play and verify the full game boots cleanly with 0 strict errors!'
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
