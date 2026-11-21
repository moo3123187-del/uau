/**
 * Pure Luau runtime prelude executed inside the real C++ Luau WASM VM (`luau-web`).
 * Implements Roblox datatypes (`Vector3`, `CFrame`, `Color3`, `BrickColor`, `UDim`, `UDim2`,
 * `TweenInfo`, `RaycastParams`, `Random`, `Enum`), `RBXScriptSignal`, `task` coroutine scheduler,
 * `Instance` userdata proxy, `require()` ModuleScript caching, and JSON serialization.
 */
export const ROBLOX_LUAU_PRELUDE = `
-- ============================================================================
-- 1. Loop Guard & Coroutine Task Scheduler
-- ============================================================================
local __sliceOps = 0
local __MAX_SLICE_OPS = 250000

function __loopTick()
	__sliceOps += 1
	if __sliceOps > __MAX_SLICE_OPS then
		error("Script timeout: exhausted allowed execution time (did you forget task.wait() inside a loop?)", 2)
	end
end

function __resetSliceOps()
	__sliceOps = 0
end

local __pendingCoros = {}
local __coroTokenSeq = 0

local function __resumeThread(coOrToken, ...)
	local co = coOrToken
	if type(coOrToken) == "number" then
		co = __pendingCoros[coOrToken]
		__pendingCoros[coOrToken] = nil
	end
	if type(co) ~= "thread" then return end
	if coroutine.status(co) == "dead" then return end
	__sliceOps = 0
	local ok, err = coroutine.resume(co, ...)
	if not ok then
		__jsLog("error", "Studio", "Luau", tostring(err))
	end
end
__registerResume(__resumeThread)

task = {}
function task.wait(seconds)
	local co = coroutine.running()
	__coroTokenSeq += 1
	local token = __coroTokenSeq
	__pendingCoros[token] = co
	__scheduleResume(token, seconds or 0)
	return coroutine.yield()
end

function task.spawn(fn, ...)
	local co = if type(fn) == "thread" then fn else coroutine.create(fn)
	__resumeThread(co, ...)
	return co
end

function task.delay(seconds, fn, ...)
	local args = table.pack(...)
	local co = coroutine.create(function()
		task.wait(seconds or 0)
		fn(table.unpack(args, 1, args.n))
	end)
	task.spawn(co)
	return co
end

function task.defer(fn, ...)
	return task.delay(0, fn, ...)
end

function task.cancel(co)
	if type(co) == "thread" and coroutine.close then
		pcall(coroutine.close, co)
	end
end

wait = task.wait
spawn = task.spawn
delay = task.delay
tick = __jsNow
if os then
	local origOs = os
	os = setmetatable({
		clock = __jsClock,
		time = (origOs and origOs.time) or function()
			return math.floor(__jsNow())
		end,
	}, { __index = origOs })
end

-- ============================================================================
-- 2. Lightweight JSON Encoder / Decoder for JS <-> Luau Bridge
-- ============================================================================
local function __jsonEscape(s)
	s = string.gsub(s, "\\\\", "\\\\\\\\")
	s = string.gsub(s, '"', '\\\\"')
	s = string.gsub(s, "\\n", "\\\\n")
	s = string.gsub(s, "\\r", "\\\\r")
	s = string.gsub(s, "\\t", "\\\\t")
	return s
end

local __origTypeof = typeof
function typeof(v)
	local t = __origTypeof(v)
	if t == "table" then
		local mt = getmetatable(v)
		if type(mt) == "table" and mt.__type then
			return mt.__type
		end
	end
	return t
end

local function __newud()
	return {}
end

local function __setmt(t, mt)
	return setmetatable(t, mt)
end

local __udData = setmetatable({}, { __mode = "k" })

local function __jsonEncode(val, seen)
	local t = typeof(val)
	if val == nil then
		return "null"
	elseif t == "boolean" then
		return if val then "true" else "false"
	elseif t == "number" then
		if val ~= val then return "0" end
		if val == math.huge or val == -math.huge then return "0" end
		return tostring(val)
	elseif t == "string" then
		return '"' .. __jsonEscape(val) .. '"'
	elseif t == "Vector3" then
		local d = __udData[val]
		return string.format("[%g,%g,%g]", d.x, d.y, d.z)
	elseif t == "Color3" then
		local d = __udData[val]
		return string.format('"#%02X%02X%02X"', math.floor(d.r * 255 + 0.5), math.floor(d.g * 255 + 0.5), math.floor(d.b * 255 + 0.5))
	elseif t == "EnumItem" then
		return '"' .. __jsonEscape(val.Name) .. '"'
	elseif t == "Instance" then
		return '"' .. __jsonEscape(val.Name) .. '"'
	elseif t == "table" then
		seen = seen or {}
		if seen[val] then return "null" end
		seen[val] = true
		local n = #val
		local isArr = n > 0
		if isArr then
			for k in pairs(val) do
				if type(k) ~= "number" or k < 1 or k > n or math.floor(k) ~= k then
					isArr = false
					break
				end
			end
		else
			local hasAny = false
			for _ in pairs(val) do hasAny = true break end
			if not hasAny then
				return "{}"
			end
		end
		if isArr then
			local parts = {}
			for i = 1, n do
				table.insert(parts, __jsonEncode(val[i], seen))
			end
			return "[" .. table.concat(parts, ",") .. "]"
		else
			local parts = {}
			for k, v in pairs(val) do
				table.insert(parts, '"' .. __jsonEscape(tostring(k)) .. '":' .. __jsonEncode(v, seen))
			end
			return "{" .. table.concat(parts, ",") .. "}"
		end
	else
		return '"' .. __jsonEscape(tostring(val)) .. '"'
	end
end

local function __jsonDecode(str)
	if not str or str == "" or str == "null" then return nil end
	local pos = 1
	local len = #str

	local function skipWs()
		while pos <= len do
			local b = string.byte(str, pos)
			if b == 32 or b == 9 or b == 10 or b == 13 then
				pos += 1
			else
				break
			end
		end
	end

	local parseVal

	local function parseStr()
		pos += 1 -- skip opening quote
		local out = {}
		while pos <= len do
			local ch = string.sub(str, pos, pos)
			if ch == '"' then
				pos += 1
				return table.concat(out)
			elseif ch == "\\\\" then
				local nxt = string.sub(str, pos + 1, pos + 1)
				if nxt == "n" then table.insert(out, "\\n")
				elseif nxt == "r" then table.insert(out, "\\r")
				elseif nxt == "t" then table.insert(out, "\\t")
				else table.insert(out, nxt)
				end
				pos += 2
			else
				table.insert(out, ch)
				pos += 1
			end
		end
		return table.concat(out)
	end

	local function parseArr()
		pos += 1 -- [
		local arr = {}
		skipWs()
		if string.sub(str, pos, pos) == "]" then
			pos += 1
			return arr
		end
		local idx = 1
		while pos <= len do
			arr[idx] = parseVal()
			idx += 1
			skipWs()
			local ch = string.sub(str, pos, pos)
			if ch == "," then
				pos += 1
			elseif ch == "]" then
				pos += 1
				break
			else
				break
			end
		end
		return arr
	end

	local function parseObj()
		pos += 1 -- {
		local obj = {}
		skipWs()
		if string.sub(str, pos, pos) == "}" then
			pos += 1
			return obj
		end
		while pos <= len do
			skipWs()
			local key = parseStr()
			skipWs()
			pos += 1 -- :
			obj[key] = parseVal()
			skipWs()
			local ch = string.sub(str, pos, pos)
			if ch == "," then
				pos += 1
			elseif ch == "}" then
				pos += 1
				break
			else
				break
			end
		end
		return obj
	end

	parseVal = function()
		skipWs()
		local ch = string.sub(str, pos, pos)
		if ch == '"' then return parseStr()
		elseif ch == "[" then return parseArr()
		elseif ch == "{" then return parseObj()
		elseif string.sub(str, pos, pos + 3) == "true" then pos += 4 return true
		elseif string.sub(str, pos, pos + 4) == "false" then pos += 5 return false
		elseif string.sub(str, pos, pos + 3) == "null" then pos += 4 return nil
		else
			local s = string.match(str, "^-?%d+%.?%d*[eE]?[+-]?%d*", pos)
			if s and #s > 0 then
				pos += #s
				return tonumber(s)
			end
			pos += 1
			return nil
		end
	end

	return parseVal()
end

-- ============================================================================
-- 3. Vector3
-- ============================================================================
Vector3 = {}
local Vector3Methods = {}
local Vector3MT

local function newVec3(x, y, z)
	local ud = __newud()
	__udData[ud] = { x = x or 0, y = y or 0, z = z or 0 }
	__setmt(ud, Vector3MT)
	return ud
end

function Vector3Methods:Dot(other)
	local a, b = __udData[self], __udData[other]
	return a.x * b.x + a.y * b.y + a.z * b.z
end

function Vector3Methods:Cross(other)
	local a, b = __udData[self], __udData[other]
	return newVec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
end

function Vector3Methods:Lerp(goal, alpha)
	local a, b = __udData[self], __udData[goal]
	return newVec3(a.x + (b.x - a.x) * alpha, a.y + (b.y - a.y) * alpha, a.z + (b.z - a.z) * alpha)
end

function Vector3Methods:FuzzyEq(other, eps)
	eps = eps or 1e-5
	local a, b = __udData[self], __udData[other]
	return math.abs(a.x - b.x) <= eps and math.abs(a.y - b.y) <= eps and math.abs(a.z - b.z) <= eps
end

Vector3MT = {
	__type = "Vector3",
	__index = function(self, k)
		local d = __udData[self]
		if k == "X" or k == "x" then return d.x
		elseif k == "Y" or k == "y" then return d.y
		elseif k == "Z" or k == "z" then return d.z
		elseif k == "Magnitude" then return math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)
		elseif k == "Unit" then
			local m = math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)
			if m == 0 then return newVec3(0, 0, 0) end
			return newVec3(d.x / m, d.y / m, d.z / m)
		end
		return Vector3Methods[k]
	end,
	__add = function(a, b)
		local da, db = __udData[a], __udData[b]
		return newVec3(da.x + db.x, da.y + db.y, da.z + db.z)
	end,
	__sub = function(a, b)
		local da, db = __udData[a], __udData[b]
		return newVec3(da.x - db.x, da.y - db.y, da.z - db.z)
	end,
	__mul = function(a, b)
		if type(a) == "number" then
			local db = __udData[b]
			return newVec3(a * db.x, a * db.y, a * db.z)
		elseif type(b) == "number" then
			local da = __udData[a]
			return newVec3(da.x * b, da.y * b, da.z * b)
		else
			local da, db = __udData[a], __udData[b]
			return newVec3(da.x * db.x, da.y * db.y, da.z * db.z)
		end
	end,
	__div = function(a, b)
		if type(b) == "number" then
			local da = __udData[a]
			return newVec3(da.x / b, da.y / b, da.z / b)
		end
		local da, db = __udData[a], __udData[b]
		return newVec3(da.x / db.x, da.y / db.y, da.z / db.z)
	end,
	__unm = function(a)
		local da = __udData[a]
		return newVec3(-da.x, -da.y, -da.z)
	end,
	__eq = function(a, b)
		local da, db = __udData[a], __udData[b]
		if not da or not db then return false end
		return math.abs(da.x - db.x) < 1e-5 and math.abs(da.y - db.y) < 1e-5 and math.abs(da.z - db.z) < 1e-5
	end,
	__tostring = function(self)
		local d = __udData[self]
		return string.format("%g, %g, %g", d.x, d.y, d.z)
	end,
}

function Vector3.new(x, y, z) return newVec3(x, y, z) end
Vector3.zero = newVec3(0, 0, 0)
Vector3.one = newVec3(1, 1, 1)
Vector3.xAxis = newVec3(1, 0, 0)
Vector3.yAxis = newVec3(0, 1, 0)
Vector3.zAxis = newVec3(0, 0, 1)

-- ============================================================================
-- 4. CFrame (Full 3x3 Rotation Matrix + Translation)
-- ============================================================================
CFrame = {}
local CFrameMethods = {}
local CFrameMT

local function basisFromEulerXYZ(rx, ry, rz)
	local cx, sx = math.cos(rx or 0), math.sin(rx or 0)
	local cy, sy = math.cos(ry or 0), math.sin(ry or 0)
	local cz, sz = math.cos(rz or 0), math.sin(rz or 0)
	return
		cy * cz, -cy * sz, sy,
		cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
		sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy
end

local function eulerFromBasis(r00, r01, r02, r10, r11, r12, r20, r21, r22)
	local ry = math.asin(math.clamp(r02, -1, 1))
	local rx, rz
	if math.abs(r02) < 0.99999 then
		rx = math.atan2(-r12, r22)
		rz = math.atan2(-r01, r00)
	else
		rx = math.atan2(r21, r11)
		rz = 0
	end
	return rx, ry, rz
end

local function newCFMatrix(x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22)
	local ud = __newud()
	__udData[ud] = {
		x = x or 0, y = y or 0, z = z or 0,
		r00 = r00 or 1, r01 = r01 or 0, r02 = r02 or 0,
		r10 = r10 or 0, r11 = r11 or 1, r12 = r12 or 0,
		r20 = r20 or 0, r21 = r21 or 0, r22 = r22 or 1,
	}
	__setmt(ud, CFrameMT)
	return ud
end

local function newCFEuler(x, y, z, rx, ry, rz)
	local r00, r01, r02, r10, r11, r12, r20, r21, r22 = basisFromEulerXYZ(rx or 0, ry or 0, rz or 0)
	return newCFMatrix(x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22)
end

local function lookAtCF(pos, target, up)
	local p = __udData[pos]
	local t = __udData[target]
	local upV = if up then __udData[up] else { x = 0, y = 1, z = 0 }
	local fx, fy, fz = t.x - p.x, t.y - p.y, t.z - p.z
	local fl = math.sqrt(fx * fx + fy * fy + fz * fz)
	if fl < 1e-6 then return newCFEuler(p.x, p.y, p.z, 0, 0, 0) end
	fx /= fl; fy /= fl; fz /= fl
	-- Back = -Look
	local bx, by, bz = -fx, -fy, -fz
	-- Right = Up x Back
	local rx = upV.y * bz - upV.z * by
	local ry = upV.z * bx - upV.x * bz
	local rz = upV.x * by - upV.y * bx
	local rl = math.sqrt(rx * rx + ry * ry + rz * rz)
	if rl < 1e-6 then
		rx, ry, rz = 1, 0, 0
	else
		rx /= rl; ry /= rl; rz /= rl
	end
	-- True Up = Back x Right
	local ux = by * rz - bz * ry
	local uy = bz * rx - bx * rz
	local uz = bx * ry - by * rx
	return newCFMatrix(p.x, p.y, p.z, rx, ux, bx, ry, uy, by, rz, uz, bz)
end

function CFrameMethods:Inverse()
	local d = __udData[self]
	local r00, r01, r02 = d.r00, d.r10, d.r20
	local r10, r11, r12 = d.r01, d.r11, d.r21
	local r20, r21, r22 = d.r02, d.r12, d.r22
	local ix = -(r00 * d.x + r01 * d.y + r02 * d.z)
	local iy = -(r10 * d.x + r11 * d.y + r12 * d.z)
	local iz = -(r20 * d.x + r21 * d.y + r22 * d.z)
	return newCFMatrix(ix, iy, iz, r00, r01, r02, r10, r11, r12, r20, r21, r22)
end

function CFrameMethods:ToEulerAnglesXYZ()
	local d = __udData[self]
	return eulerFromBasis(d.r00, d.r01, d.r02, d.r10, d.r11, d.r12, d.r20, d.r21, d.r22)
end

function CFrameMethods:ToOrientation()
	return self:ToEulerAnglesXYZ()
end

function CFrameMethods:GetComponents()
	local d = __udData[self]
	return d.x, d.y, d.z, d.r00, d.r01, d.r02, d.r10, d.r11, d.r12, d.r20, d.r21, d.r22
end

function CFrameMethods:Lerp(goal, alpha)
	local a, b = __udData[self], __udData[goal]
	local rxA, ryA, rzA = eulerFromBasis(a.r00, a.r01, a.r02, a.r10, a.r11, a.r12, a.r20, a.r21, a.r22)
	local rxB, ryB, rzB = eulerFromBasis(b.r00, b.r01, b.r02, b.r10, b.r11, b.r12, b.r20, b.r21, b.r22)
	return newCFEuler(
		a.x + (b.x - a.x) * alpha,
		a.y + (b.y - a.y) * alpha,
		a.z + (b.z - a.z) * alpha,
		rxA + (rxB - rxA) * alpha,
		ryA + (ryB - ryA) * alpha,
		rzA + (rzB - rzA) * alpha
	)
end

function CFrameMethods:ToWorldSpace(cf) return self * cf end
function CFrameMethods:ToObjectSpace(cf) return self:Inverse() * cf end
function CFrameMethods:PointToWorldSpace(v) return self * v end
function CFrameMethods:PointToObjectSpace(v) return self:Inverse() * v end
function CFrameMethods:VectorToWorldSpace(v)
	local d = __udData[self]
	local dv = __udData[v]
	return newVec3(
		d.r00 * dv.x + d.r01 * dv.y + d.r02 * dv.z,
		d.r10 * dv.x + d.r11 * dv.y + d.r12 * dv.z,
		d.r20 * dv.x + d.r21 * dv.y + d.r22 * dv.z
	)
end

CFrameMT = {
	__type = "CFrame",
	__index = function(self, k)
		local d = __udData[self]
		if k == "Position" or k == "p" then return newVec3(d.x, d.y, d.z)
		elseif k == "X" then return d.x
		elseif k == "Y" then return d.y
		elseif k == "Z" then return d.z
		elseif k == "LookVector" then return newVec3(-d.r02, -d.r12, -d.r22)
		elseif k == "RightVector" or k == "XVector" then return newVec3(d.r00, d.r10, d.r20)
		elseif k == "UpVector" or k == "YVector" then return newVec3(d.r01, d.r11, d.r21)
		elseif k == "ZVector" then return newVec3(d.r02, d.r12, d.r22)
		elseif k == "Rotation" then return newCFMatrix(0, 0, 0, d.r00, d.r01, d.r02, d.r10, d.r11, d.r12, d.r20, d.r21, d.r22)
		end
		return CFrameMethods[k]
	end,
	__add = function(a, v)
		local da, dv = __udData[a], __udData[v]
		return newCFMatrix(da.x + dv.x, da.y + dv.y, da.z + dv.z, da.r00, da.r01, da.r02, da.r10, da.r11, da.r12, da.r20, da.r21, da.r22)
	end,
	__sub = function(a, v)
		local da, dv = __udData[a], __udData[v]
		return newCFMatrix(da.x - dv.x, da.y - dv.y, da.z - dv.z, da.r00, da.r01, da.r02, da.r10, da.r11, da.r12, da.r20, da.r21, da.r22)
	end,
	__mul = function(a, b)
		local da = __udData[a]
		local tb = typeof(b)
		if tb == "Vector3" then
			local db = __udData[b]
			return newVec3(
				da.x + da.r00 * db.x + da.r01 * db.y + da.r02 * db.z,
				da.y + da.r10 * db.x + da.r11 * db.y + da.r12 * db.z,
				da.z + da.r20 * db.x + da.r21 * db.y + da.r22 * db.z
			)
		end
		local db = __udData[b]
		local nx = da.x + da.r00 * db.x + da.r01 * db.y + da.r02 * db.z
		local ny = da.y + da.r10 * db.x + da.r11 * db.y + da.r12 * db.z
		local nz = da.z + da.r20 * db.x + da.r21 * db.y + da.r22 * db.z
		return newCFMatrix(
			nx, ny, nz,
			da.r00 * db.r00 + da.r01 * db.r10 + da.r02 * db.r20,
			da.r00 * db.r01 + da.r01 * db.r11 + da.r02 * db.r21,
			da.r00 * db.r02 + da.r01 * db.r12 + da.r02 * db.r22,
			da.r10 * db.r00 + da.r11 * db.r10 + da.r12 * db.r20,
			da.r10 * db.r01 + da.r11 * db.r11 + da.r12 * db.r21,
			da.r10 * db.r02 + da.r11 * db.r12 + da.r12 * db.r22,
			da.r20 * db.r00 + da.r21 * db.r10 + da.r22 * db.r20,
			da.r20 * db.r01 + da.r21 * db.r11 + da.r22 * db.r21,
			da.r20 * db.r02 + da.r21 * db.r12 + da.r22 * db.r22
		)
	end,
	__eq = function(a, b)
		local da, db = __udData[a], __udData[b]
		if not da or not db then return false end
		return math.abs(da.x - db.x) < 1e-4 and math.abs(da.y - db.y) < 1e-4 and math.abs(da.z - db.z) < 1e-4
	end,
	__tostring = function(self)
		local d = __udData[self]
		return string.format("%.2f, %.2f, %.2f", d.x, d.y, d.z)
	end,
}

function CFrame.new(a, b, c)
	if typeof(a) == "Vector3" and typeof(b) == "Vector3" then
		return lookAtCF(a, b)
	elseif typeof(a) == "Vector3" then
		local da = __udData[a]
		return newCFEuler(da.x, da.y, da.z, 0, 0, 0)
	end
	return newCFEuler(a or 0, b or 0, c or 0, 0, 0, 0)
end
function CFrame.Angles(rx, ry, rz) return newCFEuler(0, 0, 0, rx, ry, rz) end
CFrame.fromEulerAnglesXYZ = CFrame.Angles
CFrame.fromEulerAnglesYXZ = CFrame.Angles
function CFrame.lookAt(at, target, up) return lookAtCF(at, target, up) end
CFrame.identity = newCFEuler(0, 0, 0, 0, 0, 0)

-- ============================================================================
-- 5. Color3, BrickColor, UDim, UDim2, TweenInfo, RaycastParams, Random, Enum
-- ============================================================================
Color3 = {}
local Color3MT

local function newColor3(r, g, b)
	local ud = __newud()
	__udData[ud] = { r = math.clamp(r or 1, 0, 1), g = math.clamp(g or 1, 0, 1), b = math.clamp(b or 1, 0, 1) }
	__setmt(ud, Color3MT)
	return ud
end

Color3MT = {
	__type = "Color3",
	__index = function(self, k)
		local d = __udData[self]
		if k == "R" then return d.r
		elseif k == "G" then return d.g
		elseif k == "B" then return d.b
		elseif k == "Lerp" then
			return function(_, goal, alpha)
				local g = __udData[goal]
				return newColor3(d.r + (g.r - d.r) * alpha, d.g + (g.g - d.g) * alpha, d.b + (g.b - d.b) * alpha)
			end
		elseif k == "ToHex" then
			return function()
				return string.format("%02x%02x%02x", math.floor(d.r * 255 + 0.5), math.floor(d.g * 255 + 0.5), math.floor(d.b * 255 + 0.5))
			end
		end
		return nil
	end,
	__eq = function(a, b)
		local da, db = __udData[a], __udData[b]
		if not da or not db then return false end
		return math.abs(da.r - db.r) < 1e-4 and math.abs(da.g - db.g) < 1e-4 and math.abs(da.b - db.b) < 1e-4
	end,
	__tostring = function(self)
		local d = __udData[self]
		return string.format("%d, %d, %d", math.floor(d.r * 255 + 0.5), math.floor(d.g * 255 + 0.5), math.floor(d.b * 255 + 0.5))
	end,
}

function Color3.new(r, g, b) return newColor3(r or 0, g or 0, b or 0) end
function Color3.fromRGB(r, g, b) return newColor3((r or 0) / 255, (g or 0) / 255, (b or 0) / 255) end
function Color3.fromHex(hex)
	hex = string.gsub(tostring(hex or "ffffff"), "#", "")
	local n = tonumber(hex, 16) or 0xffffff
	return Color3.fromRGB(math.floor(n / 65536) % 256, math.floor(n / 256) % 256, n % 256)
end
function Color3.fromHSV(h, s, v)
	local i = math.floor(h * 6)
	local f = h * 6 - i
	local p = v * (1 - s)
	local q = v * (1 - f * s)
	local t = v * (1 - (1 - f) * s)
	local mod = i % 6
	if mod == 0 then return newColor3(v, t, p)
	elseif mod == 1 then return newColor3(q, v, p)
	elseif mod == 2 then return newColor3(p, v, t)
	elseif mod == 3 then return newColor3(p, q, v)
	elseif mod == 4 then return newColor3(t, p, v)
	else return newColor3(v, p, q) end
end

local BRICK_PALETTE = {
	["Bright red"] = "#C4281C",
	["Bright blue"] = "#0D69AC",
	["Bright green"] = "#4B974B",
	["Bright yellow"] = "#F5CD30",
	["Bright orange"] = "#DA8541",
	["Neon orange"] = "#D5733D",
	["Really red"] = "#FF0000",
	["Lime green"] = "#00FF00",
	["Cyan"] = "#00FFFF",
	["White"] = "#F2F3F3",
	["Black"] = "#1B2A35",
	["Medium stone grey"] = "#A3A2A5",
	["Dark stone grey"] = "#635F62",
	["Royal purple"] = "#6225D1",
	["Hot pink"] = "#FF00BF",
	["Electric blue"] = "#0989CF",
}

BrickColor = {}
local BrickColorMT = {
	__type = "BrickColor",
	__index = function(self, k)
		local d = __udData[self]
		if k == "Name" then return d.name
		elseif k == "Color" then return d.color
		end
		return nil
	end,
	__tostring = function(self) return __udData[self].name end,
}

function BrickColor.new(name)
	local n = tostring(name or "Medium stone grey")
	local hex = BRICK_PALETTE[n] or "#3B82F6"
	local ud = __newud()
	__udData[ud] = { name = n, color = Color3.fromHex(hex) }
	__setmt(ud, BrickColorMT)
	return ud
end
function BrickColor.random()
	local names = {}
	for k in pairs(BRICK_PALETTE) do table.insert(names, k) end
	return BrickColor.new(names[math.random(1, #names)])
end

UDim = {}
function UDim.new(scale, offset)
	return { Scale = scale or 0, Offset = offset or 0 }
end

UDim2 = {}
local UDim2MT
local function newUDim2(xs, xo, ys, yo)
	local ud = __newud()
	__udData[ud] = { xs = xs or 0, xo = xo or 0, ys = ys or 0, yo = yo or 0 }
	__setmt(ud, UDim2MT)
	return ud
end
UDim2MT = {
	__type = "UDim2",
	__index = function(self, k)
		local d = __udData[self]
		if k == "X" then return UDim.new(d.xs, d.xo)
		elseif k == "Y" then return UDim.new(d.ys, d.yo)
		elseif k == "Lerp" then
			return function(_, goal, a)
				local g = __udData[goal]
				return newUDim2(d.xs + (g.xs - d.xs) * a, d.xo + (g.xo - d.xo) * a, d.ys + (g.ys - d.ys) * a, d.yo + (g.yo - d.yo) * a)
			end
		end
		return nil
	end,
	__add = function(a, b)
		local da, db = __udData[a], __udData[b]
		return newUDim2(da.xs + db.xs, da.xo + db.xo, da.ys + db.ys, da.yo + db.yo)
	end,
	__sub = function(a, b)
		local da, db = __udData[a], __udData[b]
		return newUDim2(da.xs - db.xs, da.xo - db.xo, da.ys - db.ys, da.yo - db.yo)
	end,
	__tostring = function(self)
		local d = __udData[self]
		return string.format("{%g, %d}, {%g, %d}", d.xs, d.xo, d.ys, d.yo)
	end,
}
function UDim2.new(xs, xo, ys, yo) return newUDim2(xs, xo, ys, yo) end
function UDim2.fromScale(xs, ys) return newUDim2(xs, 0, ys, 0) end
function UDim2.fromOffset(xo, yo) return newUDim2(0, xo, 0, yo) end

Enum = {}
local EnumItemMT = {
	__type = "EnumItem",
	__index = function(self, k)
		local d = __udData[self]
		if k == "Name" then return d.name
		elseif k == "Value" then return d.value
		elseif k == "EnumType" then return d.enumType
		end
		return nil
	end,
	__eq = function(a, b)
		local da, db = __udData[a], __udData[b]
		return da and db and da.full == db.full
	end,
	__tostring = function(self) return __udData[self].full end,
}

local __enumCache = {}
setmetatable(Enum, {
	__index = function(_, enumName)
		if __enumCache[enumName] then return __enumCache[enumName] end
		local enumTbl = {}
		local itemCache = {}
		setmetatable(enumTbl, {
			__index = function(_, itemName)
				if itemCache[itemName] then return itemCache[itemName] end
				local ud = __newud()
				__udData[ud] = { name = itemName, value = 0, enumType = enumTbl, full = "Enum." .. enumName .. "." .. itemName }
				__setmt(ud, EnumItemMT)
				itemCache[itemName] = ud
				return ud
			end,
			__tostring = function() return "Enum." .. enumName end,
		})
		__enumCache[enumName] = enumTbl
		return enumTbl
	end,
})

TweenInfo = {}
local TweenInfoMT = {
	__type = "TweenInfo",
	__index = function(self, k)
		return __udData[self][k]
	end,
}
function TweenInfo.new(time, easingStyle, easingDirection, repeatCount, reverses, delayTime)
	local ud = __newud()
	__udData[ud] = {
		Time = time or 1,
		EasingStyle = if typeof(easingStyle) == "EnumItem" then easingStyle.Name else (easingStyle or "Quad"),
		EasingDirection = if typeof(easingDirection) == "EnumItem" then easingDirection.Name else (easingDirection or "Out"),
		RepeatCount = repeatCount or 0,
		Reverses = reverses or false,
		DelayTime = delayTime or 0,
	}
	__setmt(ud, TweenInfoMT)
	return ud
end

RaycastParams = {}
local RaycastParamsMT = {
	__type = "RaycastParams",
	__index = function(self, k) return __udData[self][k] end,
	__newindex = function(self, k, v) __udData[self][k] = v end,
}
function RaycastParams.new()
	local ud = __newud()
	__udData[ud] = {
		FilterType = Enum.RaycastFilterType.Exclude,
		FilterDescendantsInstances = {},
		IgnoreWater = true,
	}
	__setmt(ud, RaycastParamsMT)
	return ud
end

Random = {}
local RandomMethods = {}
function RandomMethods:NextNumber(min, max)
	if min and max then return min + math.random() * (max - min) end
	return math.random()
end
function RandomMethods:NextInteger(min, max)
	return math.random(min, max)
end
function RandomMethods:NextUnitVector()
	local z = math.random() * 2 - 1
	local a = math.random() * math.pi * 2
	local r = math.sqrt(1 - z * z)
	return newVec3(r * math.cos(a), z, r * math.sin(a))
end
function Random.new(seed)
	if seed then math.randomseed(seed) end
	return setmetatable({}, { __index = RandomMethods })
end

-- ============================================================================
-- 6. RBXScriptSignal & RBXScriptConnection
-- ============================================================================
local __signals = {} -- [signalKey] = { listeners = {}, waiters = {}, seq = 0 }
local SignalMT, ConnMT

local function getOrCreateSignal(sigKey)
	if not __signals[sigKey] then
		local ud = __newud()
		local state = { key = sigKey, listeners = {}, waiters = {}, seq = 0 }
		__udData[ud] = state
		__setmt(ud, SignalMT)
		state.ud = ud
		__signals[sigKey] = state
	end
	return __signals[sigKey].ud
end

ConnMT = {
	__type = "RBXScriptConnection",
	__index = function(self, k)
		local d = __udData[self]
		if k == "Connected" then return d.connected
		elseif k == "Disconnect" then
			return function()
				d.connected = false
				d.sig.listeners[d.id] = nil
			end
		end
		return nil
	end,
}

SignalMT = {
	__type = "RBXScriptSignal",
	__index = function(self, k)
		local sig = __udData[self]
		if k == "Connect" then
			return function(_, fn)
				sig.seq += 1
				local id = sig.seq
				local listener = { id = id, fn = fn, once = false, connected = true, sig = sig }
				sig.listeners[id] = listener
				local connUd = __newud()
				__udData[connUd] = listener
				__setmt(connUd, ConnMT)
				return connUd
			end
		elseif k == "Once" then
			return function(_, fn)
				sig.seq += 1
				local id = sig.seq
				local listener = { id = id, fn = fn, once = true, connected = true, sig = sig }
				sig.listeners[id] = listener
				local connUd = __newud()
				__udData[connUd] = listener
				__setmt(connUd, ConnMT)
				return connUd
			end
		elseif k == "Wait" then
			return function()
				local co = coroutine.running()
				table.insert(sig.waiters, co)
				return coroutine.yield()
			end
		end
		return nil
	end,
}

local function fireSignalRaw(sigKey, ...)
	local sig = __signals[sigKey]
	if not sig then return end
	local snapshot = {}
	for _, l in pairs(sig.listeners) do
		table.insert(snapshot, l)
	end
	for _, l in ipairs(snapshot) do
		if l.connected then
			if l.once then
				l.connected = false
				sig.listeners[l.id] = nil
			end
			task.spawn(l.fn, ...)
		end
	end
	local waiters = sig.waiters
	if #waiters > 0 then
		sig.waiters = {}
		for _, co in ipairs(waiters) do
			__resumeThread(co, ...)
		end
	end
end

-- ============================================================================
-- 7. Instance Proxy, Services, DataStore, TweenService & require()
-- ============================================================================
local __instCache = setmetatable({}, { __mode = "v" })
local __instMeta = setmetatable({}, { __mode = "k" })
local __onServerInvokeMap = {} -- [remoteFuncId] = fn
local __boundActions = {} -- [actionName] = { fn = fn, keys = {...} }
local __moduleCache = {} -- [modId] = exportedVal
local InstanceMT

local function wrapInst(nodeId)
	if not nodeId or nodeId == "" then return nil end
	if __instCache[nodeId] then return __instCache[nodeId] end
	local raw = __jsonDecode(__jsInstMeta(nodeId))
	if not raw then return nil end
	local ud = __newud()
	__instMeta[ud] = raw
	__setmt(ud, InstanceMT)
	__instCache[nodeId] = ud
	return ud
end

local function decodePropValue(encodedJson)
	local p = __jsonDecode(encodedJson)
	if not p or p.kind == "nil" then return nil end
	if p.kind == "prim" then return p.val
	elseif p.kind == "v3" then return newVec3(p.val[1], p.val[2], p.val[3])
	elseif p.kind == "cf" then return newCFEuler(p.val[1], p.val[2], p.val[3], p.val[4], p.val[5], p.val[6])
	elseif p.kind == "c3" then return Color3.fromHex(p.val)
	elseif p.kind == "bc" then return BrickColor.new(p.val)
	elseif p.kind == "udim2" then return newUDim2(p.val[1], p.val[2], p.val[3], p.val[4])
	elseif p.kind == "enum" then return Enum[p.enumType or "Material"][p.val]
	elseif p.kind == "inst" then return wrapInst(p.val)
	end
	return p.val
end

local function encodePropValue(val)
	local t = typeof(val)
	if val == nil then return __jsonEncode({ kind = "nil" })
	elseif t == "Vector3" then
		local d = __udData[val]
		return __jsonEncode({ kind = "v3", val = { d.x, d.y, d.z } })
	elseif t == "CFrame" then
		local d = __udData[val]
		local rx, ry, rz = eulerFromBasis(d.r00, d.r01, d.r02, d.r10, d.r11, d.r12, d.r20, d.r21, d.r22)
		return __jsonEncode({ kind = "cf", val = { d.x, d.y, d.z, rx, ry, rz } })
	elseif t == "Color3" then
		local d = __udData[val]
		local hex = string.format("#%02X%02X%02X", math.floor(d.r * 255 + 0.5), math.floor(d.g * 255 + 0.5), math.floor(d.b * 255 + 0.5))
		return __jsonEncode({ kind = "c3", val = hex })
	elseif t == "BrickColor" then
		return __jsonEncode({ kind = "bc", val = __udData[val].name })
	elseif t == "UDim2" then
		local d = __udData[val]
		return __jsonEncode({ kind = "udim2", val = { d.xs, d.xo, d.ys, d.yo } })
	elseif t == "EnumItem" then
		return __jsonEncode({ kind = "prim", val = __udData[val].name })
	elseif t == "Instance" then
		return __jsonEncode({ kind = "inst", val = __instMeta[val].id })
	else
		return __jsonEncode({ kind = "prim", val = val })
	end
end

local SIGNAL_NAMES = {
	Touched = true, TouchEnded = true, MouseClick = true, Triggered = true,
	MouseButton1Click = true, Changed = true, CharacterAdded = true,
	Died = true, HealthChanged = true, PlayerAdded = true, PlayerRemoving = true,
	Heartbeat = true, RenderStepped = true, Stepped = true,
	InputBegan = true, InputEnded = true, OnServerEvent = true, OnClientEvent = true,
}

local __tweenSeq = 0
local TweenMT = {
	__type = "Tween",
	__index = function(self, k)
		local d = __udData[self]
		if k == "Completed" then return getOrCreateSignal("tween:" .. d.tweenId)
		elseif k == "Play" then
			return function()
				__jsTweenPlay(d.nodeId, d.infoJson, d.goalJson, d.tweenId)
			end
		elseif k == "Cancel" or k == "Pause" then
			return function()
				__jsTweenCancel(d.tweenId)
			end
		end
		return nil
	end,
}

InstanceMT = {
	__type = "Instance",
	__index = function(self, k)
		local meta = __instMeta[self]
		local id = meta.id
		local cls = meta.className

		if k == "Name" then return __jsInstMetaName(id)
		elseif k == "ClassName" then return cls
		elseif k == "Parent" then return wrapInst(__jsInstParentId(id))
		elseif k == "GetChildren" then
			return function()
				local ids = __jsonDecode(__jsInstChildren(id)) or {}
				local out = {}
				for i, cid in ipairs(ids) do out[i] = wrapInst(cid) end
				return out
			end
		elseif k == "GetDescendants" then
			return function()
				local ids = __jsonDecode(__jsInstDescendants(id)) or {}
				local out = {}
				for i, cid in ipairs(ids) do out[i] = wrapInst(cid) end
				return out
			end
		elseif k == "FindFirstChild" then
			return function(_, name, recursive)
				return wrapInst(__jsInstFindChild(id, tostring(name or ""), not not recursive))
			end
		elseif k == "FindFirstChildOfClass" then
			return function(_, targetCls)
				return wrapInst(__jsInstFindChildOfClass(id, tostring(targetCls or "")))
			end
		elseif k == "FindFirstChildWhichIsA" then
			return function(_, targetCls)
				return wrapInst(__jsInstFindChildWhichIsA(id, tostring(targetCls or "")))
			end
		elseif k == "WaitForChild" then
			return function(_, name, timeout)
				local childId = __jsInstFindChild(id, tostring(name or ""), false)
				if childId ~= "" then return wrapInst(childId) end
				local deadline = __jsClock() + (timeout or 2)
				while __jsClock() < deadline do
					task.wait(0.05)
					childId = __jsInstFindChild(id, tostring(name or ""), false)
					if childId ~= "" then return wrapInst(childId) end
				end
				return nil
			end
		elseif k == "IsA" then
			return function(_, targetCls) return __jsInstIsA(id, tostring(targetCls or "")) end
		elseif k == "IsDescendantOf" then
			return function(_, anc)
				if typeof(anc) ~= "Instance" then return false end
				return __jsInstIsDescendantOf(id, __instMeta[anc].id)
			end
		elseif k == "Clone" then
			return function() return wrapInst(__jsInstClone(id)) end
		elseif k == "Destroy" then
			return function() __jsInstDestroy(id) end
		elseif k == "ClearAllChildren" then
			return function() __jsInstClearChildren(id) end
		elseif k == "GetAttribute" then
			return function(_, attr) return decodePropValue(__jsInstAttr(id, "get", tostring(attr), "")) end
		elseif k == "SetAttribute" then
			return function(_, attr, val) __jsInstAttr(id, "set", tostring(attr), encodePropValue(val)) end
		elseif k == "AddTag" and cls ~= "CollectionService" then
			return function(_, tag)
				local t = tostring(tag or "")
				__jsInstTag(id, "add", t)
				fireSignalRaw("tagAdded:" .. t, self)
			end
		elseif k == "RemoveTag" and cls ~= "CollectionService" then
			return function(_, tag)
				local t = tostring(tag or "")
				__jsInstTag(id, "remove", t)
				fireSignalRaw("tagRemoved:" .. t, self)
			end
		elseif k == "HasTag" and cls ~= "CollectionService" then
			return function(_, tag) return __jsInstTag(id, "has", tostring(tag or "")) end
		elseif k == "GetTags" then
			return function() return __jsonDecode(__jsInstTag(id, "getAll", "")) or {} end
		elseif k == "GetPropertyChangedSignal" then
			return function(_, propName) return getOrCreateSignal("prop:" .. id .. ":" .. tostring(propName)) end
		elseif cls == "DataModel" and k == "GetService" then
			return function(_, svcName) return wrapInst(__jsInstGetService(tostring(svcName or ""))) end
		elseif cls == "Workspace" and k == "Raycast" then
			return function(_, origin, dir, params)
				local od, dd = __udData[origin], __udData[dir]
				local pData = { filterType = "Exclude", filterIds = {} }
				if params and __udData[params] then
					local pd = __udData[params]
					pData.filterType = if typeof(pd.FilterType) == "EnumItem" then pd.FilterType.Name else tostring(pd.FilterType or "Exclude")
					for _, inst in ipairs(pd.FilterDescendantsInstances or {}) do
						if typeof(inst) == "Instance" then
							table.insert(pData.filterIds, __instMeta[inst].id)
						end
					end
				end
				local resJson = __jsRaycast(
					__jsonEncode({ od.x, od.y, od.z }),
					__jsonEncode({ dd.x, dd.y, dd.z }),
					__jsonEncode(pData)
				)
				local res = __jsonDecode(resJson)
				if not res then return nil end
				return {
					Instance = wrapInst(res.instId),
					Position = newVec3(res.pos[1], res.pos[2], res.pos[3]),
					Normal = newVec3(res.norm[1], res.norm[2], res.norm[3]),
					Distance = res.dist,
					Material = Enum.Material[res.mat or "Plastic"],
				}
			end
		elseif cls == "Players" and k == "LocalPlayer" then
			return wrapInst(__jsLocalPlayerId())
		elseif cls == "Players" and k == "GetPlayers" then
			return function()
				local ids = __jsonDecode(__jsGetPlayers()) or {}
				local out = {}
				for i, pid in ipairs(ids) do out[i] = wrapInst(pid) end
				return out
			end
		elseif cls == "Players" and k == "GetPlayerFromCharacter" then
			return function(_, charInst)
				if typeof(charInst) ~= "Instance" then return nil end
				return wrapInst(__jsGetPlayerFromChar(__instMeta[charInst].id))
			end
		elseif cls == "TweenService" and k == "Create" then
			return function(_, targetInst, info, goalTbl)
				__tweenSeq += 1
				local tid = "tw_" .. __tweenSeq
				local goalMap = {}
				for gk, gv in pairs(goalTbl or {}) do
					goalMap[tostring(gk)] = __jsonDecode(encodePropValue(gv))
				end
				local infoTbl = if info and __udData[info] then __udData[info] else { Time = 1, EasingStyle = "Quad", EasingDirection = "Out", DelayTime = 0 }
				local twUd = __newud()
				__udData[twUd] = {
					tweenId = tid,
					nodeId = __instMeta[targetInst].id,
					infoJson = __jsonEncode(infoTbl),
					goalJson = __jsonEncode(goalMap),
				}
				__setmt(twUd, TweenMT)
				return twUd
			end
		elseif cls == "RunService" and (k == "IsServer" or k == "IsClient" or k == "IsStudio") then
			return function() return true end
		elseif cls == "UserInputService" and k == "IsKeyDown" then
			return function(_, keyCode)
				local kn = if typeof(keyCode) == "EnumItem" then keyCode.Name else tostring(keyCode or "")
				return __jsIsKeyDown(kn)
			end
		elseif cls == "ContextActionService" and k == "BindAction" then
			return function(_, actionName, fn, _touch, ...)
				local keys = {}
				for i = 1, select("#", ...) do
					local kc = select(i, ...)
					table.insert(keys, if typeof(kc) == "EnumItem" then kc.Name else tostring(kc))
				end
				__boundActions[tostring(actionName)] = { fn = fn, keys = keys }
			end
		elseif cls == "ContextActionService" and k == "UnbindAction" then
			return function(_, actionName) __boundActions[tostring(actionName)] = nil end
		elseif cls == "CollectionService" then
			if k == "AddTag" then
				return function(_, inst, tag) inst:AddTag(tag) end
			elseif k == "RemoveTag" then
				return function(_, inst, tag) inst:RemoveTag(tag) end
			elseif k == "HasTag" then
				return function(_, inst, tag) return inst:HasTag(tag) end
			elseif k == "GetTagged" then
				return function(_, tag)
					local ids = __jsonDecode(__jsInstTag("", "getTagged", tostring(tag or ""))) or {}
					local out = {}
					for i, cid in ipairs(ids) do out[i] = wrapInst(cid) end
					return out
				end
			elseif k == "GetInstanceAddedSignal" then
				return function(_, tag) return getOrCreateSignal("tagAdded:" .. tostring(tag or "")) end
			elseif k == "GetInstanceRemovedSignal" then
				return function(_, tag) return getOrCreateSignal("tagRemoved:" .. tostring(tag or "")) end
			end
		elseif cls == "DataStoreService" and k == "GetDataStore" then
			return function(_, storeName)
				local sName = tostring(storeName or "DefaultStore")
				return {
					GetAsync = function(_, key)
						task.wait(0.03)
						return __jsonDecode(__jsDataStore(sName, "get", tostring(key), ""))
					end,
					SetAsync = function(_, key, val)
						task.wait(0.03)
						__jsDataStore(sName, "set", tostring(key), __jsonEncode(val))
						return "ok"
					end,
					UpdateAsync = function(_, key, transformFn)
						task.wait(0.03)
						local oldVal = __jsonDecode(__jsDataStore(sName, "get", tostring(key), ""))
						local newVal = transformFn(oldVal)
						if newVal ~= nil then
							__jsDataStore(sName, "set", tostring(key), __jsonEncode(newVal))
						end
						return newVal
					end,
					IncrementAsync = function(_, key, delta)
						task.wait(0.03)
						return tonumber(__jsDataStore(sName, "inc", tostring(key), tostring(delta or 1)))
					end,
					RemoveAsync = function(_, key)
						task.wait(0.03)
						return __jsonDecode(__jsDataStore(sName, "remove", tostring(key), ""))
					end,
				}
			end
		elseif cls == "Debris" and k == "AddItem" then
			return function(_, inst, lifetime)
				if typeof(inst) == "Instance" then
					__jsDebrisAdd(__instMeta[inst].id, lifetime or 1)
				end
			end
		elseif cls == "Model" and (k == "PivotTo" or k == "SetPrimaryPartCFrame") then
			return function(_, cf)
				local d = __udData[cf]
				__jsModelPivot(id, "pivotTo", __jsonEncode({ d.x, d.y, d.z }))
			end
		elseif cls == "Model" and k == "GetPivot" then
			return function()
				local p = __jsonDecode(__jsModelPivot(id, "getPivot", "")) or { 0, 0, 0 }
				return newCFEuler(p[1], p[2], p[3], 0, 0, 0)
			end
		elseif cls == "Humanoid" and k == "TakeDamage" then
			return function(_, amount) __jsHumanoidOp(id, "takeDamage", tonumber(amount or 0), 0, 0) end
		elseif cls == "Humanoid" and k == "MoveTo" then
			return function(_, vec)
				local d = __udData[vec]
				__jsHumanoidOp(id, "moveTo", d.x, d.y, d.z)
			end
		elseif cls == "RemoteEvent" then
			if k == "FireServer" then
				return function(_, ...)
					local args = table.pack(...)
					local parts = {}
					for i = 1, args.n do table.insert(parts, __jsonEncode(args[i])) end
					__jsNetworkLog("Client -> Server", __jsInstMetaName(id), table.concat(parts, ", "), "Delivered")
					local lp = wrapInst(__jsLocalPlayerId())
					fireSignalRaw("inst:" .. id .. ":OnServerEvent", lp, table.unpack(args, 1, args.n))
				end
			elseif k == "FireClient" then
				return function(_, _player, ...)
					local args = table.pack(...)
					local parts = {}
					for i = 1, args.n do table.insert(parts, __jsonEncode(args[i])) end
					__jsNetworkLog("Server -> Client", __jsInstMetaName(id), table.concat(parts, ", "), "Delivered")
					fireSignalRaw("inst:" .. id .. ":OnClientEvent", table.unpack(args, 1, args.n))
				end
			elseif k == "FireAllClients" then
				return function(_, ...)
					local args = table.pack(...)
					local parts = {}
					for i = 1, args.n do table.insert(parts, __jsonEncode(args[i])) end
					__jsNetworkLog("Server -> AllClients", __jsInstMetaName(id), table.concat(parts, ", "), "Delivered")
					fireSignalRaw("inst:" .. id .. ":OnClientEvent", table.unpack(args, 1, args.n))
				end
			end
		elseif cls == "RemoteFunction" and k == "InvokeServer" then
			return function(_, ...)
				local args = table.pack(...)
				local parts = {}
				for i = 1, args.n do table.insert(parts, __jsonEncode(args[i])) end
				__jsNetworkLog("Client -> Server", __jsInstMetaName(id) .. " (Invoke)", table.concat(parts, ", "), "Delivered")
				local cb = __onServerInvokeMap[id]
				if not cb then return nil end
				local lp = wrapInst(__jsLocalPlayerId())
				return cb(lp, table.unpack(args, 1, args.n))
			end
		elseif cls == "Sound" and k == "Play" then
			return function() __jsSoundPlay(id) end
		end

		if SIGNAL_NAMES[k] then
			return getOrCreateSignal("inst:" .. id .. ":" .. k)
		end

		local propVal = decodePropValue(__jsInstGetProp(id, tostring(k)))
		if propVal ~= nil then return propVal end

		local childId = __jsInstFindChild(id, tostring(k), false)
		if childId ~= "" then return wrapInst(childId) end

		return nil
	end,
	__newindex = function(self, k, v)
		local id = __instMeta[self].id
		if k == "OnServerInvoke" then
			__onServerInvokeMap[id] = v
			return
		end
		__jsInstSetProp(id, tostring(k), encodePropValue(v))
		fireSignalRaw("prop:" .. id .. ":" .. tostring(k))
		if k == "Value" then
			fireSignalRaw("inst:" .. id .. ":Changed", v)
		end
	end,
	__eq = function(a, b)
		local ma, mb = __instMeta[a], __instMeta[b]
		return ma ~= nil and mb ~= nil and ma.id == mb.id
	end,
	__tostring = function(self)
		return __jsInstMetaName(__instMeta[self].id)
	end,
}

Instance = {}
function Instance.new(className, parent)
	local pId = if typeof(parent) == "Instance" then __instMeta[parent].id else ""
	return wrapInst(__jsInstNew(tostring(className or "Part"), pId))
end

game = wrapInst("game")
workspace = wrapInst("workspace")

local __preludeEnv = getfenv(1)

function require(modScript)
	if typeof(modScript) ~= "Instance" or modScript.ClassName ~= "ModuleScript" then
		error("Attempted to require a non-ModuleScript", 2)
	end
	local modId = __instMeta[modScript].id
	if __moduleCache[modId] ~= nil then
		return __moduleCache[modId]
	end
	local info = __jsonDecode(__jsGetModuleSource(modId))
	local compiled = __compileLua(info.source or "return {}", info.name or "ModuleScript")
	if type(compiled) ~= "function" then
		error("ModuleScript compile error (" .. tostring(info.name) .. "): " .. tostring(compiled), 2)
	end
	local env = setmetatable({
		script = modScript,
		print = function(...)
			local parts = {}
			for i = 1, select("#", ...) do parts[i] = tostring(select(i, ...)) end
			__jsLog("print", "Server", info.name or "ModuleScript", table.concat(parts, " "))
		end,
		warn = function(...)
			local parts = {}
			for i = 1, select("#", ...) do parts[i] = tostring(select(i, ...)) end
			__jsLog("warn", "Server", info.name or "ModuleScript", table.concat(parts, " "))
		end,
	}, { __index = __preludeEnv })
	setfenv(compiled, env)
	local exported = compiled()
	if exported == nil then exported = {} end
	__moduleCache[modId] = exported
	return exported
end

-- Bridge helpers callable from TypeScript runtime
function __runScriptInEnv(compiledFn, scriptId, sourceTag, scriptName)
	local scriptInst = wrapInst(scriptId)
	local env = setmetatable({
		script = scriptInst,
		print = function(...)
			local parts = {}
			for i = 1, select("#", ...) do parts[i] = tostring(select(i, ...)) end
			__jsLog("print", sourceTag, scriptName, table.concat(parts, " "))
		end,
		warn = function(...)
			local parts = {}
			for i = 1, select("#", ...) do parts[i] = tostring(select(i, ...)) end
			__jsLog("warn", sourceTag, scriptName, table.concat(parts, " "))
		end,
	}, { __index = __preludeEnv })
	setfenv(compiledFn, env)
	task.spawn(compiledFn)
end

function __fireSignalFromJS(sigKey, argJsonList)
	__resetSliceOps()
	local specs = __jsonDecode(argJsonList) or {}
	local args = {}
	for i, sp in ipairs(specs) do
		if sp.kind == "inst" then
			args[i] = wrapInst(sp.val)
		elseif sp.kind == "input" then
			local kcName = sp.val
			args[i] = { KeyCode = Enum.KeyCode[kcName], UserInputType = Enum.UserInputType.Keyboard }
		else
			args[i] = sp.val
		end
	end
	fireSignalRaw(sigKey, table.unpack(args, 1, #specs))
end

function __dispatchBoundAction(keyName, stateStr)
	__resetSliceOps()
	local inputObj = { KeyCode = Enum.KeyCode[keyName], UserInputType = Enum.UserInputType.Keyboard }
	for name, act in pairs(__boundActions) do
		for _, k in ipairs(act.keys) do
			if k == keyName then
				task.spawn(act.fn, name, Enum.UserInputState[stateStr], inputObj)
			end
		end
	end
end

__registerBridge(__runScriptInEnv, __fireSignalFromJS, __dispatchBoundAction)
`;
