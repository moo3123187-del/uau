export interface ApiDocEntry {
  name: string;
  category: 'Luau Core' | '3D & Math' | 'Studio Services' | 'Instances & UI' | 'Advanced Luau';
  signature: string;
  summary: string;
  example: string;
}

export const API_REFERENCE: ApiDocEntry[] = [
  {
    name: 'print / warn',
    category: 'Luau Core',
    signature: 'print(...any) · warn(...any)',
    summary: 'Writes text or values into the Roblox Studio Output console for debugging.',
    example: 'local coins = 25\nprint(`Player has {coins} coins`)',
  },
  {
    name: 'local & functions',
    category: 'Luau Core',
    signature: 'local name = value · local function fn(a, b)',
    summary: 'Declares block-scoped variables and reusable functions.',
    example: 'local function add(a: number, b: number): number\n\treturn a + b\nend',
  },
  {
    name: 'task.wait / task.spawn',
    category: 'Luau Core',
    signature: 'task.wait(seconds?) · task.spawn(fn, ...)',
    summary: 'Pauses the current thread safely or launches a concurrent thread without blocking.',
    example: 'task.spawn(function()\n\ttask.wait(1)\n\tprint("Done waiting!")\nend)',
  },
  {
    name: 'Instance.new',
    category: 'Instances & UI',
    signature: 'Instance.new(className: string, parent?: Instance)',
    summary: 'Creates any Roblox object strictly by script—no 3D modeling tools needed.',
    example: 'local part = Instance.new("Part")\npart.Size = Vector3.new(6, 1, 6)\npart.Anchored = true\npart.Parent = workspace',
  },
  {
    name: 'Vector3',
    category: '3D & Math',
    signature: 'Vector3.new(x, y, z)',
    summary: 'Represents a 3D point, size, or direction vector with Magnitude and Unit.',
    example: 'local pos = Vector3.new(0, 5, -10)\nlocal up = Vector3.new(0, 1, 0)',
  },
  {
    name: 'CFrame',
    category: '3D & Math',
    signature: 'CFrame.new(x, y, z) · CFrame.Angles(rx, ry, rz) · CFrame.lookAt(at, target)',
    summary: 'Combines 3D position and rotation matrix for precise script-based building and movement.',
    example: 'part.CFrame = CFrame.new(0, 4, 0) * CFrame.Angles(0, math.rad(45), 0)',
  },
  {
    name: 'Color3',
    category: '3D & Math',
    signature: 'Color3.fromRGB(r, g, b) · Color3.fromHex("#RRGGBB")',
    summary: 'Defines RGB colors for Parts, Lights, and ScreenGui elements.',
    example: 'part.Color = Color3.fromRGB(37, 99, 235)',
  },
  {
    name: 'TweenService',
    category: 'Studio Services',
    signature: 'TweenService:Create(instance, TweenInfo.new(...), goalTable):Play()',
    summary: 'Smoothly interpolates Part positions, colors, sizes, or UI frames over time.',
    example: 'local ts = game:GetService("TweenService")\nlocal info = TweenInfo.new(1, Enum.EasingStyle.Bounce)\nts:Create(part, info, { Position = Vector3.new(0, 8, 0) }):Play()',
  },
  {
    name: 'RunService',
    category: 'Studio Services',
    signature: 'RunService.Heartbeat:Connect(function(dt) ... end)',
    summary: 'Fires every frame with deltaTime so motion stays smooth at any framerate.',
    example: 'game:GetService("RunService").Heartbeat:Connect(function(dt)\n\tpart.CFrame *= CFrame.Angles(0, dt * 2, 0)\nend)',
  },
  {
    name: 'CollectionService',
    category: 'Studio Services',
    signature: 'CollectionService:AddTag(inst, tag) · GetTagged(tag)',
    summary: 'Tags instances so one script can drive dozens of coins, traps, or doors.',
    example: 'local cs = game:GetService("CollectionService")\nfor _, coin in ipairs(cs:GetTagged("Coin")) do\n\tcoin.Color = Color3.fromRGB(250, 204, 21)\nend',
  },
  {
    name: 'RemoteEvent',
    category: 'Instances & UI',
    signature: 'remote:FireServer(...) · remote.OnServerEvent:Connect(function(player, ...))',
    summary: 'Bridges Client LocalScripts and Server Scripts securely via ReplicatedStorage.',
    example: 'local remote = game:GetService("ReplicatedStorage"):WaitForChild("ActionEvent")\nremote:FireServer("JumpBoost")',
  },
  {
    name: 'DataStoreService',
    category: 'Studio Services',
    signature: 'DataStoreService:GetDataStore(name):GetAsync(key) / SetAsync / UpdateAsync',
    summary: 'Persists player inventory, coins, and progress safely across game sessions.',
    example: 'local ds = game:GetService("DataStoreService"):GetDataStore("PlayerCoins")\nlocal ok, val = pcall(function() return ds:GetAsync("BuilderOne") end)',
  },
  {
    name: 'workspace:Raycast',
    category: '3D & Math',
    signature: 'workspace:Raycast(origin: Vector3, direction: Vector3, params?: RaycastParams)',
    summary: 'Casts a 3D math ray to detect exact surface hits, normals, and distances.',
    example: 'local hit = workspace:Raycast(Vector3.new(0, 10, 0), Vector3.new(0, -20, 0))\nif hit then print("Hit:", hit.Instance.Name) end',
  },
  {
    name: 'ScreenGui & UDim2',
    category: 'Instances & UI',
    signature: 'UDim2.new(xScale, xOffset, yScale, yOffset)',
    summary: 'Creates live on-screen HUD labels and clickable TextButtons via script.',
    example: 'local btn = Instance.new("TextButton", screenGui)\nbtn.Size = UDim2.fromOffset(180, 44)\nbtn.Text = "Buy Speed"',
  },
  {
    name: 'Metatables & OOP',
    category: 'Advanced Luau',
    signature: 'setmetatable(tbl, { __index = Class })',
    summary: 'Enables object-oriented classes, inheritance, and operator overloading (__add, __tostring).',
    example: 'local Hero = {}\nHero.__index = Hero\nfunction Hero.new(name)\n\treturn setmetatable({ Name = name }, Hero)\nend',
  },
  {
    name: '--!strict & Generics',
    category: 'Advanced Luau',
    signature: '--!strict · type MyType = { ... } · function fn<T>(x: T): T',
    summary: 'Enables static type analysis to catch type mismatches before pressing Play.',
    example: '--!strict\ntype Stats = { Coins: number, Level: number }\nlocal function wrap<T>(v: T): { value: T } return { value = v } end',
  },
  {
    name: 'Coroutines',
    category: 'Advanced Luau',
    signature: 'coroutine.create(fn) · coroutine.resume(co, ...) · coroutine.yield(...)',
    summary: 'Pauses and resumes execution state manually for custom schedulers and state machines.',
    example: 'local co = coroutine.create(function(x)\n\tlocal y = coroutine.yield(x * 2)\n\treturn y + 1\nend)',
  },
];
