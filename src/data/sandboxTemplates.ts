import { SandboxTemplate } from '../types/studio';

export const SANDBOX_TEMPLATES: SandboxTemplate[] = [
  {
    id: 'blank',
    title: 'Blank Baseplate',
    subtitle: 'Clean Studio workspace ready for script-driven building and experiments.',
    hierarchy: [
      {
        id: 'ws_base',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [],
      },
      {
        id: 'rep_root',
        name: 'ReplicatedStorage',
        className: 'ReplicatedStorage',
        properties: {},
        children: [],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/MainScript',
        name: 'MainScript',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `-- Welcome to the Model-Free Studio Sandbox!
-- Everything you build here happens strictly through Luau code.

local part = Instance.new("Part")
part.Name = "NeonBlock"
part.Size = Vector3.new(4, 4, 4)
part.Position = Vector3.new(0, 3, 0)
part.Color = Color3.fromRGB(37, 99, 235)
part.Material = Enum.Material.Neon
part.Anchored = true
part.Parent = workspace

print("Spawned NeonBlock at:", part.Position)
`,
      },
    ],
  },
  {
    id: 'spiral_tower',
    title: 'Procedural Spiral Tower',
    subtitle: 'Generates a 24-step color-gradient spiral staircase purely with CFrame math.',
    hierarchy: [
      {
        id: 'ws_spiral',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/TowerBuilder',
        name: 'TowerBuilder',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `--!strict
local towerModel = Instance.new("Model")
towerModel.Name = "SpiralTower"
towerModel.Parent = workspace

local steps = 24
local radius = 9

for i = 1, steps do
\tlocal angle = math.rad(i * 22)
\tlocal height = i * 1.1
\tlocal step = Instance.new("Part")
\tstep.Name = "Step_" .. i
\tstep.Size = Vector3.new(5, 0.7, 2.6)
\tstep.Anchored = true
\tstep.Material = Enum.Material.SmoothPlastic
\tstep.Color = Color3.fromHSV((i / steps) * 0.75, 0.8, 0.95)
\tstep.CFrame = CFrame.new(math.cos(angle) * radius, height, math.sin(angle) * radius)
\t\t* CFrame.Angles(0, -angle, 0)
\tstep.Parent = towerModel
\ttask.wait(0.04)
end

print("Procedural tower complete:", steps, "steps!")
`,
      },
    ],
  },
  {
    id: 'laser_tag',
    title: 'Server-Authoritative Laser Tag',
    subtitle: 'Client input fires RemoteEvent; Server validates cooldown and casts a 3D Raycast.',
    hierarchy: [
      {
        id: 'ws_laser',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [
          {
            id: 'target_block',
            name: 'TargetDummy',
            className: 'Part',
            properties: {
              Position: [0, 3, -10],
              Size: [4, 5, 2],
              Color: '#EF4444',
              Material: 'SmoothPlastic',
              Anchored: true,
              CanCollide: true,
            },
          },
        ],
      },
      {
        id: 'rep_laser',
        name: 'ReplicatedStorage',
        className: 'ReplicatedStorage',
        properties: {},
        children: [
          {
            id: 'rem_fire',
            name: 'FireLaser',
            className: 'RemoteEvent',
            properties: {},
          },
        ],
      },
    ],
    scripts: [
      {
        path: 'ServerScriptService/LaserServer',
        name: 'LaserServer',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")
local fireEvent = ReplicatedStorage:WaitForChild("FireLaser")

local lastShot = {}

fireEvent.OnServerEvent:Connect(function(player, origin, direction)
\tlocal now = os.clock()
\tif lastShot[player.Name] and now - lastShot[player.Name] < 0.3 then
\t\twarn("Rate limited shot from", player.Name)
\t\treturn
\tend
\tlastShot[player.Name] = now

\tlocal result = workspace:Raycast(origin, direction.Unit * 40)
\tlocal beam = Instance.new("Part")
\tbeam.Anchored = true
\tbeam.CanCollide = false
\tbeam.Material = Enum.Material.Neon
\tbeam.Color = Color3.fromRGB(56, 189, 248)
\tbeam.Size = Vector3.new(0.3, 0.3, result and result.Distance or 40)
\tlocal endPos = result and result.Position or (origin + direction.Unit * 40)
\tbeam.CFrame = CFrame.lookAt(origin:Lerp(endPos, 0.5), endPos)
\tbeam.Parent = workspace
\tDebris:AddItem(beam, 0.4)

\tif result then
\t\tprint("Server verified hit on:", result.Instance.Name)
\t\tresult.Instance.Color = Color3.fromRGB(250, 204, 21)
\tend
end)
`,
      },
      {
        path: 'StarterPlayer/StarterPlayerScripts/LaserClient',
        name: 'LaserClient',
        parentPath: 'StarterPlayer/StarterPlayerScripts',
        className: 'LocalScript',
        code: `local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local fireEvent = ReplicatedStorage:WaitForChild("FireLaser")

print("Press F in the 3D Viewport to fire a server-validated laser!")

UserInputService.InputBegan:Connect(function(input)
\tif input.KeyCode == Enum.KeyCode.F then
\t\tfireEvent:FireServer(Vector3.new(0, 3, 10), Vector3.new(0, 0, -1))
\tend
end)
`,
      },
    ],
  },
  {
    id: 'tycoon_dropper',
    title: 'Automated Ore Dropper & HUD',
    subtitle: 'Spawns physics parts, collects them on touch, updates leaderstats, and renders a live ScreenGui.',
    hierarchy: [
      {
        id: 'ws_tycoon',
        name: 'Workspace',
        className: 'Workspace',
        properties: { Gravity: 196.2 },
        children: [
          {
            id: 'collector_pad',
            name: 'CollectorPad',
            className: 'Part',
            properties: {
              Position: [0, 0.5, 0],
              Size: [10, 1, 10],
              Color: '#10B981',
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
        path: 'ServerScriptService/TycoonServer',
        name: 'TycoonServer',
        parentPath: 'ServerScriptService',
        className: 'Script',
        code: `local Players = game:GetService("Players")
local Debris = game:GetService("Debris")

local cashValue = nil

Players.PlayerAdded:Connect(function(player)
\tlocal ls = Instance.new("Folder")
\tls.Name = "leaderstats"
\tls.Parent = player

\tcashValue = Instance.new("IntValue")
\tcashValue.Name = "Cash"
\tcashValue.Value = 0
\tcashValue.Parent = ls
end)

task.spawn(function()
\twhile true do
\t\ttask.wait(1.2)
\t\tlocal ore = Instance.new("Part")
\t\tore.Name = "GoldOre"
\t\tore.Size = Vector3.new(1.5, 1.5, 1.5)
\t\tore.Position = Vector3.new(math.random(-2, 2), 9, math.random(-2, 2))
\t\tore.Color = Color3.fromRGB(250, 204, 21)
\t\tore.Material = Enum.Material.Metal
\t\tore.Anchored = false
\t\tore.Parent = workspace
\t\tDebris:AddItem(ore, 2.5)
\t\tif cashValue then
\t\t\tcashValue.Value += 10
\t\t\tprint("Collected GoldOre! Cash =", cashValue.Value)
\t\tend
\tend
end)
`,
      },
      {
        path: 'StarterPlayer/StarterPlayerScripts/TycoonHUD',
        name: 'TycoonHUD',
        parentPath: 'StarterPlayer/StarterPlayerScripts',
        className: 'LocalScript',
        code: `local Players = game:GetService("Players")
local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local gui = Instance.new("ScreenGui", playerGui)
local label = Instance.new("TextLabel", gui)
label.Position = UDim2.new(0.03, 0, 0.04, 0)
label.Size = UDim2.fromOffset(210, 44)
label.BackgroundColor3 = Color3.fromRGB(15, 23, 42)
label.TextColor3 = Color3.fromRGB(250, 204, 21)
label.Text = "Cash: $0"

task.wait(0.2)
local ls = player:WaitForChild("leaderstats")
local cash = ls:WaitForChild("Cash")
cash.Changed:Connect(function(newVal)
\tlabel.Text = "Cash: $" .. tostring(newVal)
end)
`,
      },
    ],
  },
];
