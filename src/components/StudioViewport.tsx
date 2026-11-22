import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Compass, Crosshair, Eye, Gamepad2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { RuntimeNodeSnapshot } from '../types/studio';

interface StudioViewportProps {
  tree: RuntimeNodeSnapshot[];
  selectedNodeId: string | null;
  isPlaying: boolean;
  onSelectNode: (nodeId: string) => void;
  onTriggerClickDetector: (partId: string) => void;
  onTriggerProximityPrompt: (promptId: string) => void;
  onTriggerPartTouched: (partId: string) => void;
  onTriggerGuiButton: (buttonId: string) => void;
  onKeyInput: (keyCode: string, isDown: boolean) => void;
  onCharacterMove: (x: number, y: number, z: number) => void;
}

const _vec3 = new THREE.Vector3();

function createStudBaseplateTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#1E293B';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle grid lines
  ctx.strokeStyle = '#273449';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }

  // Classic subtle Roblox studs
  for (let x = 32; x < 256; x += 64) {
    for (let y = 32; y < 256; y += 64) {
      ctx.fillStyle = '#243146';
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.anisotropy = Math.min(8, maxAniso || 1);
  return tex;
}

function buildCompositeAvatar(): {
  group: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.name = 'BuilderOneAvatar';

  const torsoMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45, metalness: 0.1 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.5, metalness: 0.05 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.1 });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.4,
    roughness: 0.2,
    metalness: 0.6,
  });

  // Legs (pivot near hip)
  const legGeo = new THREE.BoxGeometry(0.65, 1.3, 0.65);
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.36, 0.65, 0);
  leftLeg.castShadow = true;

  const rightLeg = new THREE.Mesh(legGeo, legMat);
  rightLeg.position.set(0.36, 0.65, 0);
  rightLeg.castShadow = true;

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.75), torsoMat);
  torso.position.set(0, 2.0, 0);
  torso.castShadow = true;

  // Arms
  const armGeo = new THREE.BoxGeometry(0.55, 1.3, 0.6);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-1.05, 2.0, 0);
  leftArm.castShadow = true;

  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.set(1.05, 2.0, 0);
  rightArm.castShadow = true;

  // Head + Visor
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), skinMat);
  head.position.set(0, 3.22, 0);
  head.castShadow = true;

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.28, 0.14), visorMat);
  visor.position.set(0, 3.28, -0.46);

  group.add(leftLeg, rightLeg, torso, leftArm, rightArm, head, visor);
  group.position.set(0, 0, 12);
  return { group, leftArm, rightArm, leftLeg, rightLeg };
}

function createMaterialForRoblox(props: Record<string, unknown>, isSelected: boolean): THREE.MeshStandardMaterial {
  const colorHex = String(props.Color ?? '#A3A2A5');
  const matName = String(props.Material ?? 'Plastic');
  const transparency = Math.max(0, Math.min(1, Number(props.Transparency ?? 0)));

  let roughness = 0.55;
  let metalness = 0.08;
  let emissive = 0x000000;
  let emissiveIntensity = 0;

  if (matName === 'SmoothPlastic') {
    roughness = 0.25;
    metalness = 0.05;
  } else if (matName === 'Neon') {
    roughness = 0.2;
    metalness = 0.1;
    emissive = new THREE.Color(colorHex).getHex();
    emissiveIntensity = 0.85;
  } else if (matName === 'Metal') {
    roughness = 0.22;
    metalness = 0.85;
  } else if (matName === 'Wood') {
    roughness = 0.85;
    metalness = 0.02;
  } else if (matName === 'Glass' || matName === 'ForceField') {
    roughness = 0.1;
    metalness = 0.15;
  }

  if (isSelected && matName !== 'Neon') {
    emissive = 0x1d4ed8;
    emissiveIntensity = 0.35;
  }

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
    transparent: transparency > 0 || matName === 'Glass',
    opacity: matName === 'Glass' ? Math.min(0.45, 1 - transparency) : 1 - transparency,
  });
}

function collectPartsFromTree(tree: RuntimeNodeSnapshot[]): RuntimeNodeSnapshot[] {
  const ws = tree.find((n) => n.name === 'Workspace');
  if (!ws) return [];
  const out: RuntimeNodeSnapshot[] = [];
  const walk = (n: RuntimeNodeSnapshot) => {
    if (n.name === 'HumanoidRootPart') return;
    if (['Part', 'WedgePart', 'CornerWedgePart'].includes(n.className)) {
      out.push(n);
    }
    n.children.forEach(walk);
  };
  ws.children.forEach(walk);
  return out;
}

function collectGuiTree(tree: RuntimeNodeSnapshot[], isPlaying: boolean): RuntimeNodeSnapshot[] {
  if (isPlaying) {
    const players = tree.find((n) => n.name === 'Players');
    const lp = players?.children.find((c) => c.className === 'Player');
    const pg = lp?.children.find((c) => c.name === 'PlayerGui');
    if (pg) return pg.children;
  }
  const sg = tree.find((n) => n.name === 'StarterGui');
  return sg?.children ?? [];
}

function extractClockLighting(tree: RuntimeNodeSnapshot[]): { clockTime: number; brightness: number; fogEnd: number } {
  const lighting = tree.find((n) => n.name === 'Lighting');
  return {
    clockTime: Number(lighting?.properties.ClockTime ?? 14),
    brightness: Number(lighting?.properties.Brightness ?? 2),
    fogEnd: Number(lighting?.properties.FogEnd ?? 160),
  };
}

export const StudioViewport: React.FC<StudioViewportProps> = ({
  tree,
  selectedNodeId,
  isPlaying,
  onSelectNode,
  onTriggerClickDetector,
  onTriggerProximityPrompt,
  onTriggerPartTouched,
  onTriggerGuiButton,
  onKeyInput,
  onCharacterMove,
}) => {
  const { settings, updateSetting } = useSettings();
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState(true);
  const [webglError, setWebglError] = useState(false);
  const [nearbyPrompt, setNearbyPrompt] = useState<{ id: string; actionText: string; objectText: string } | null>(null);

  const propsRef = useRef({
    tree,
    selectedNodeId,
    isPlaying,
    showAxes: settings.showAxes,
    showBaseplateGrid: settings.showBaseplateGrid,
    cameraSpeed: settings.cameraSpeed,
    onSelectNode,
    onTriggerClickDetector,
    onTriggerProximityPrompt,
    onTriggerPartTouched,
    onKeyInput,
    onCharacterMove,
  });
  propsRef.current = {
    tree,
    selectedNodeId,
    isPlaying,
    showAxes: settings.showAxes,
    showBaseplateGrid: settings.showBaseplateGrid,
    cameraSpeed: settings.cameraSpeed,
    onSelectNode,
    onTriggerClickDetector,
    onTriggerProximityPrompt,
    onTriggerPartTouched,
    onKeyInput,
    onCharacterMove,
  };

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    partsGroup: THREE.Group;
    axesHelper: THREE.AxesHelper;
    baseplate: THREE.Mesh;
    baseTex: THREE.CanvasTexture;
    keyLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    avatar: ReturnType<typeof buildCompositeAvatar>;
    meshMap: Map<string, THREE.Mesh>;
    avatarPos: THREE.Vector3;
    avatarVelY: number;
    touchCooldown: Map<string, number>;
    cameraTargetGoal: { pos: THREE.Vector3; target: THREE.Vector3 } | null;
  } | null>(null);

  // Initialize Three.js WebGL stage once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 640;
    const height = container.clientHeight || 400;
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1526);
    scene.fog = new THREE.Fog(0x0d1526, 45, 160);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(settings.cameraFov, width / height, 0.2, 400);
    camera.position.set(16, 12, 20);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minDistance = 4;
    controls.maxDistance = 120;
    controls.target.set(0, 2, 0);

    controls.addEventListener('start', () => {
      if (sceneRefs.current) sceneRefs.current.cameraTargetGoal = null;
    });

    // Studio 3-point lighting
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.65);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.5);
    keyLight.position.set(18, 28, 16);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left = -28;
    keyLight.shadow.camera.right = 28;
    keyLight.shadow.camera.top = 28;
    keyLight.shadow.camera.bottom = -28;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.45);
    rimLight.position.set(-16, 10, -18);
    scene.add(rimLight);

    // Roblox Studded Baseplate
    const baseTex = createStudBaseplateTexture(renderer.capabilities.getMaxAnisotropy());
    const baseplate = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshStandardMaterial({
        map: settings.showBaseplateGrid ? baseTex : null,
        color: settings.showBaseplateGrid ? 0xffffff : 0x1e293b,
        roughness: 0.72,
        metalness: 0.05,
      })
    );
    baseplate.rotation.x = -Math.PI / 2;
    baseplate.position.y = -0.01;
    baseplate.receiveShadow = true;
    scene.add(baseplate);

    const axesHelper = new THREE.AxesHelper(4);
    axesHelper.position.set(0, 0.03, 0);
    scene.add(axesHelper);

    const partsGroup = new THREE.Group();
    scene.add(partsGroup);

    const avatar = buildCompositeAvatar();
    scene.add(avatar.group);

    sceneRefs.current = {
      scene,
      camera,
      controls,
      partsGroup,
      axesHelper,
      baseplate,
      baseTex,
      keyLight,
      hemiLight,
      avatar,
      meshMap: new Map(),
      avatarPos: new THREE.Vector3(0, 0, 12),
      avatarVelY: 0,
      touchCooldown: new Map(),
      cameraTargetGoal: null,
    };

    // Raycast click picking on canvas
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 5 || !sceneRefs.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(sceneRefs.current.partsGroup.children, false);
      if (hits.length > 0) {
        const hitMesh = hits[0].object as THREE.Mesh;
        const partId = String(hitMesh.userData.nodeId ?? '');
        if (partId) {
          propsRef.current.onSelectNode(partId);
          if (propsRef.current.isPlaying) {
            propsRef.current.onTriggerClickDetector(partId);
          }
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Keyboard state for avatar + UserInputService
    const keysDown = new Set<string>();
    const mapCodeToRobloxKey = (code: string): string | null => {
      if (code === 'KeyW') return 'W';
      if (code === 'KeyA') return 'A';
      if (code === 'KeyS') return 'S';
      if (code === 'KeyD') return 'D';
      if (code === 'KeyE') return 'E';
      if (code === 'KeyF') return 'F';
      if (code === 'KeyQ') return 'Q';
      if (code === 'KeyR') return 'R';
      if (code === 'Space') return 'Space';
      return null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      keysDown.add(e.code);

      // Roblox Studio `F` shortcut: focus camera on selected Part (or origin) in Edit Mode
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !propsRef.current.isPlaying && sceneRefs.current) {
        const refs = sceneRefs.current;
        const selectedMesh = propsRef.current.selectedNodeId
          ? refs.meshMap.get(propsRef.current.selectedNodeId)
          : null;
        if (selectedMesh) {
          const t = selectedMesh.position.clone();
          const radius = Math.max(4, selectedMesh.scale.length() * 1.4);
          refs.cameraTargetGoal = {
            target: t,
            pos: t.clone().add(new THREE.Vector3(radius, radius * 0.75, radius * 1.1)),
          };
        } else {
          refs.cameraTargetGoal = {
            pos: new THREE.Vector3(16, 12, 20),
            target: new THREE.Vector3(0, 2, 0),
          };
        }
      }

      const rKey = mapCodeToRobloxKey(e.code);
      if (rKey) {
        propsRef.current.onKeyInput(rKey, true);
        if (rKey === 'E' && propsRef.current.isPlaying) {
          // Trigger nearest ProximityPrompt
          const parts = collectPartsFromTree(propsRef.current.tree);
          for (const part of parts) {
            const prompt = part.children.find((c) => c.className === 'ProximityPrompt');
            if (prompt && sceneRefs.current) {
              const pPos = (part.properties.Position as number[]) ?? [0, 0, 0];
              const maxD = Number(prompt.properties.MaxActivationDistance ?? 12);
              const d = Math.hypot(
                sceneRefs.current.avatarPos.x - pPos[0],
                sceneRefs.current.avatarPos.z - pPos[2]
              );
              if (d <= maxD) {
                propsRef.current.onTriggerProximityPrompt(prompt.id);
              }
            }
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.delete(e.code);
      const rKey = mapCodeToRobloxKey(e.code);
      if (rKey) propsRef.current.onKeyInput(rKey, false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ResizeObserver for split-pane flexibility
    const resizeObs = new ResizeObserver(() => {
      if (!container) return;
      const w = Math.max(100, container.clientWidth);
      const h = Math.max(100, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObs.observe(container);

    // Animation loop with software WebGL pacing
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let walkPhase = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;

      const refs = sceneRefs.current;
      if (refs) {
        refs.axesHelper.visible = propsRef.current.showAxes;
        refs.avatar.group.visible = propsRef.current.isPlaying;

        // Smooth camera preset damping
        if (refs.cameraTargetGoal) {
          const factor = 1 - Math.exp(-8 * dt);
          camera.position.lerp(refs.cameraTargetGoal.pos, factor);
          controls.target.lerp(refs.cameraTargetGoal.target, factor);
          if (camera.position.distanceTo(refs.cameraTargetGoal.pos) < 0.05) {
            refs.cameraTargetGoal = null;
          }
        }

        // Avatar WASD movement & collision/touch detection when Playing
        if (propsRef.current.isPlaying) {
          let moveX = 0;
          let moveZ = 0;
          if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) moveZ -= 1;
          if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) moveZ += 1;
          if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) moveX -= 1;
          if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) moveX += 1;

          if (moveX !== 0 || moveZ !== 0) {
            _vec3.set(moveX, 0, moveZ).normalize();
            const speed = 11;
            refs.avatarPos.x += _vec3.x * speed * dt;
            refs.avatarPos.z += _vec3.z * speed * dt;
            refs.avatar.group.rotation.y = Math.atan2(-_vec3.x, -_vec3.z);
            walkPhase += dt * 12;
            const swing = Math.sin(walkPhase) * 0.55;
            refs.avatar.leftLeg.rotation.x = swing;
            refs.avatar.rightLeg.rotation.x = -swing;
            refs.avatar.leftArm.rotation.x = -swing * 0.8;
            refs.avatar.rightArm.rotation.x = swing * 0.8;
          } else {
            refs.avatar.leftLeg.rotation.x = 0;
            refs.avatar.rightLeg.rotation.x = 0;
            refs.avatar.leftArm.rotation.x = 0;
            refs.avatar.rightArm.rotation.x = 0;
          }

          if (keysDown.has('Space') && refs.avatarPos.y <= 0.01) {
            refs.avatarVelY = 12;
          }
          refs.avatarVelY -= 32 * dt;
          refs.avatarPos.y = Math.max(0, refs.avatarPos.y + refs.avatarVelY * dt);
          if (refs.avatarPos.y === 0 && refs.avatarVelY < 0) refs.avatarVelY = 0;

          refs.avatar.group.position.copy(refs.avatarPos);
          propsRef.current.onCharacterMove(
            refs.avatarPos.x,
            refs.avatarPos.y + 2,
            refs.avatarPos.z
          );

          // Check Touched + Nearby ProximityPrompts
          const parts = collectPartsFromTree(propsRef.current.tree);
          let foundPrompt: { id: string; actionText: string; objectText: string } | null = null;

          for (const part of parts) {
            const pPos = (part.properties.Position as number[]) ?? [0, 0, 0];
            const pSize = (part.properties.Size as number[]) ?? [4, 1, 2];

            // Simple AABB overlap with avatar bounds
            const dx = Math.abs(refs.avatarPos.x - pPos[0]);
            const dy = Math.abs(refs.avatarPos.y + 1.5 - pPos[1]);
            const dz = Math.abs(refs.avatarPos.z - pPos[2]);
            if (dx <= pSize[0] / 2 + 0.85 && dy <= pSize[1] / 2 + 1.6 && dz <= pSize[2] / 2 + 0.85) {
              const lastHit = refs.touchCooldown.get(part.id) ?? 0;
              if (now - lastHit > 350) {
                refs.touchCooldown.set(part.id, now);
                propsRef.current.onTriggerPartTouched(part.id);
              }
            }

            const prompt = part.children.find((c) => c.className === 'ProximityPrompt');
            if (prompt && prompt.properties.Enabled !== false) {
              const maxD = Number(prompt.properties.MaxActivationDistance ?? 10);
              const dist = Math.hypot(refs.avatarPos.x - pPos[0], refs.avatarPos.z - pPos[2]);
              if (dist <= maxD) {
                foundPrompt = {
                  id: prompt.id,
                  actionText: String(prompt.properties.ActionText ?? 'Interact'),
                  objectText: String(prompt.properties.ObjectText ?? part.name),
                };
              }
            }
          }
          setNearbyPrompt((prev) =>
            prev?.id === foundPrompt?.id ? prev : foundPrompt
          );
        } else {
          refs.avatarPos.set(0, 0, 12);
          refs.avatarVelY = 0;
          setNearbyPrompt(null);

          // Roblox Studio Edit Mode Camera Fly (WASD + Q/E, Shift for slow precision)
          let fwd = 0;
          let strafe = 0;
          let elev = 0;
          if (keysDown.has('KeyW')) fwd += 1;
          if (keysDown.has('KeyS')) fwd -= 1;
          if (keysDown.has('KeyD')) strafe += 1;
          if (keysDown.has('KeyA')) strafe -= 1;
          if (keysDown.has('KeyE')) elev += 1;
          if (keysDown.has('KeyQ')) elev -= 1;

          if (fwd !== 0 || strafe !== 0 || elev !== 0) {
            refs.cameraTargetGoal = null;
            const slowFactor = keysDown.has('ShiftLeft') || keysDown.has('ShiftRight') ? 0.35 : 1;
            const flySpeed = 20 * propsRef.current.cameraSpeed * slowFactor * dt;

            const forwardVec = new THREE.Vector3();
            camera.getWorldDirection(forwardVec);
            const rightVec = new THREE.Vector3().crossVectors(forwardVec, camera.up).normalize();

            const deltaMove = new THREE.Vector3()
              .addScaledVector(forwardVec, fwd * flySpeed)
              .addScaledVector(rightVec, strafe * flySpeed);
            deltaMove.y += elev * flySpeed;

            camera.position.add(deltaMove);
            controls.target.add(deltaMove);
          }
        }

        // Unanchored simple gravity simulation while playing
        refs.meshMap.forEach((mesh) => {
          if (propsRef.current.isPlaying && mesh.userData.anchored === false) {
            const halfH = (mesh.scale.y || 1) / 2;
            if (mesh.position.y > halfH) {
              mesh.position.y = Math.max(halfH, mesh.position.y - 16 * dt);
            }
          }
        });
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObs.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      baseTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync DataModel Parts & Lighting into Three.js Scene
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;

    // Update Lighting atmosphere
    const { clockTime, brightness, fogEnd } = extractClockLighting(tree);
    const isNight = clockTime < 6 || clockTime >= 19;
    const skyHex = isNight ? 0x060913 : 0x0d1526;
    refs.scene.background = new THREE.Color(skyHex);
    refs.scene.fog = new THREE.Fog(skyHex, Math.max(15, fogEnd * 0.25), Math.max(40, fogEnd));
    refs.keyLight.intensity = isNight ? 0.5 : Math.max(0.5, brightness * 0.75);
    refs.hemiLight.intensity = isNight ? 0.35 : 0.65;

    // Sync workspace parts
    const parts = collectPartsFromTree(tree);
    const activeIds = new Set(parts.map((p) => p.id));

    // Remove deleted parts
    refs.meshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        refs.partsGroup.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        refs.meshMap.delete(id);
      }
    });

    // Add or update existing parts
    for (const part of parts) {
      const pos = (part.properties.Position as number[]) ?? [0, 2, 0];
      const size = (part.properties.Size as number[]) ?? [4, 1, 2];
      const rotDeg = (part.properties.Rotation as number[]) ?? [0, 0, 0];
      const shape = String(part.properties.Shape ?? 'Block');

      let mesh = refs.meshMap.get(part.id);
      if (!mesh || mesh.userData.shape !== shape) {
        if (mesh) {
          refs.partsGroup.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        }
        const geo =
          shape === 'Ball'
            ? new THREE.SphereGeometry(0.5, 24, 16)
            : shape === 'Cylinder'
            ? new THREE.CylinderGeometry(0.5, 0.5, 1, 24)
            : new THREE.BoxGeometry(1, 1, 1);

        const mat = createMaterialForRoblox(part.properties, part.id === selectedNodeId);
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { nodeId: part.id, shape, anchored: part.properties.Anchored !== false };
        refs.partsGroup.add(mesh);
        refs.meshMap.set(part.id, mesh);
      } else {
        (mesh.material as THREE.Material).dispose();
        mesh.material = createMaterialForRoblox(part.properties, part.id === selectedNodeId);
        mesh.userData.anchored = part.properties.Anchored !== false;
      }

      mesh.position.set(Number(pos[0] ?? 0), Number(pos[1] ?? 0), Number(pos[2] ?? 0));
      mesh.scale.set(
        Math.max(0.05, Number(size[0] ?? 1)),
        Math.max(0.05, Number(size[1] ?? 1)),
        Math.max(0.05, Number(size[2] ?? 1))
      );
      mesh.rotation.set(
        THREE.MathUtils.degToRad(Number(rotDeg[0] ?? 0)),
        THREE.MathUtils.degToRad(Number(rotDeg[1] ?? 0)),
        THREE.MathUtils.degToRad(Number(rotDeg[2] ?? 0))
      );
    }
  }, [tree, selectedNodeId]);

  // Sync Studio Settings (FOV & Baseplate Grid) live to Three.js camera & baseplate
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    if (refs.camera.fov !== settings.cameraFov) {
      refs.camera.fov = settings.cameraFov;
      refs.camera.updateProjectionMatrix();
    }
    const mat = refs.baseplate.material as THREE.MeshStandardMaterial;
    const nextMap = settings.showBaseplateGrid ? refs.baseTex : null;
    if (mat.map !== nextMap) {
      mat.map = nextMap;
      mat.color.setHex(settings.showBaseplateGrid ? 0xffffff : 0x1e293b);
      mat.needsUpdate = true;
    }
  }, [settings.cameraFov, settings.showBaseplateGrid]);

  const focusSelected = () => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const selectedMesh = selectedNodeId ? refs.meshMap.get(selectedNodeId) : null;
    if (selectedMesh) {
      const t = selectedMesh.position.clone();
      const radius = Math.max(4, selectedMesh.scale.length() * 1.4);
      refs.cameraTargetGoal = {
        target: t,
        pos: t.clone().add(new THREE.Vector3(radius, radius * 0.75, radius * 1.1)),
      };
    } else {
      refs.cameraTargetGoal = {
        pos: new THREE.Vector3(16, 12, 20),
        target: new THREE.Vector3(0, 2, 0),
      };
    }
  };

  const setCameraPreset = (preset: 'iso' | 'top' | 'front') => {
    const refs = sceneRefs.current;
    if (!refs) return;
    if (preset === 'iso') {
      refs.cameraTargetGoal = {
        pos: new THREE.Vector3(16, 12, 20),
        target: new THREE.Vector3(0, 2, 0),
      };
    } else if (preset === 'top') {
      refs.cameraTargetGoal = {
        pos: new THREE.Vector3(0, 28, 0.01),
        target: new THREE.Vector3(0, 0, 0),
      };
    } else {
      refs.cameraTargetGoal = {
        pos: new THREE.Vector3(0, 6, 22),
        target: new THREE.Vector3(0, 2, 0),
      };
    }
  };

  const guiNodes = collectGuiTree(tree, isPlaying);

  return (
    <div className="relative w-full h-full bg-[#0D1526] overflow-hidden select-none">
      {/* Isolated WebGL Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0D1526] text-slate-300 p-6 text-center">
          <p className="text-sm font-medium text-slate-200">3D Viewport Unavailable</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            WebGL could not be initialized in this browser tab. Your Luau scripts, Explorer, and Output console remain fully operational.
          </p>
        </div>
      )}

      {/* Live StarterGui / PlayerGui Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        {guiNodes
          .filter((g) => g.className === 'ScreenGui' && g.properties.Enabled !== false)
          .map((screenGui) => (
            <div key={screenGui.id} className="absolute inset-0">
              {screenGui.children.map((el) => {
                if (el.properties.Visible === false) return null;
                const pos = (el.properties.Position as number[]) ?? [0.05, 0, 0.05, 0];
                const size = (el.properties.Size as number[]) ?? [0, 180, 0, 44];
                const bg = String(el.properties.BackgroundColor3 ?? '#0F172A');
                const bgAlpha = 1 - Number(el.properties.BackgroundTransparency ?? 0);
                const textColor = String(el.properties.TextColor3 ?? '#FFFFFF');
                const text = String(el.properties.Text ?? '');
                const leftStyle = `calc(${Number(pos[0] ?? 0) * 100}% + ${Number(pos[1] ?? 0)}px)`;
                const topStyle = `calc(${Number(pos[2] ?? 0) * 100}% + ${Number(pos[3] ?? 0)}px)`;
                const widthStyle = `calc(${Number(size[0] ?? 0) * 100}% + ${Number(size[1] ?? 0)}px)`;
                const heightStyle = `calc(${Number(size[2] ?? 0) * 100}% + ${Number(size[3] ?? 0)}px)`;

                if (el.className === 'TextButton') {
                  return (
                    <button
                      key={el.id}
                      type="button"
                      onClick={() => onTriggerGuiButton(el.id)}
                      style={{
                        left: leftStyle,
                        top: topStyle,
                        width: widthStyle,
                        height: heightStyle,
                        backgroundColor: bg,
                        opacity: bgAlpha,
                        color: textColor,
                      }}
                      className="pointer-events-auto absolute rounded-md border border-white/15 px-3 py-1.5 text-sm font-semibold shadow-md hover:brightness-110 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      {text}
                    </button>
                  );
                }

                return (
                  <div
                    key={el.id}
                    style={{
                      left: leftStyle,
                      top: topStyle,
                      width: widthStyle,
                      height: heightStyle,
                      backgroundColor: bg,
                      opacity: bgAlpha,
                      color: textColor,
                    }}
                    className="absolute rounded-md border border-white/10 px-3 py-1.5 text-sm font-semibold flex items-center"
                  >
                    {text}
                  </div>
                );
              })}
            </div>
          ))}
      </div>

      {/* Nearby ProximityPrompt Interactive Badge */}
      {isPlaying && nearbyPrompt && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={() => onTriggerProximityPrompt(nearbyPrompt.id)}
            className="flex items-center gap-2.5 rounded-lg bg-slate-950/95 border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-100 shadow-lg hover:border-blue-500 transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white font-mono text-[11px] font-bold">
              E
            </span>
            <span>{nearbyPrompt.actionText}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">{nearbyPrompt.objectText}</span>
          </button>
        </div>
      )}

      {/* Minimal Top-Left Viewport Context */}
      <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2 text-[11px] font-medium text-slate-300 bg-slate-950/80 border border-slate-800 rounded-md px-2.5 py-1">
        <span>3D Studio Viewport</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span className={isPlaying ? 'text-emerald-400' : 'text-slate-400'}>
          {isPlaying ? 'Playing (WASD + Space)' : 'Edit Mode'}
        </span>
      </div>

      {/* Collapsible Bottom Control Dock */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="mb-1 flex items-center gap-1.5 rounded-t-md bg-slate-900/95 border border-b-0 border-slate-700/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Show Controls' : 'Hide Controls'}</span>
        </button>

        {!dockCollapsed && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-900/95 border border-slate-700/80 px-3 py-1.5 shadow-xl">
            <div className="flex items-center gap-1 border-r border-slate-700/80 pr-2">
              <Compass className="w-3.5 h-3.5 text-slate-400 mr-1" />
              <button
                type="button"
                onClick={() => setCameraPreset('iso')}
                className="px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 rounded whitespace-nowrap shrink-0 cursor-pointer"
              >
                Orbit View
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('top')}
                className="px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 rounded whitespace-nowrap shrink-0 cursor-pointer"
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => setCameraPreset('front')}
                className="px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-800 rounded whitespace-nowrap shrink-0 cursor-pointer"
              >
                Front
              </button>
              <button
                type="button"
                onClick={focusSelected}
                title="Focus camera on selected Part (F)"
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-slate-800 rounded whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Crosshair className="w-3 h-3" />
                Focus (F)
              </button>
            </div>

            <button
              type="button"
              onClick={() => updateSetting('showAxes', !settings.showAxes)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded whitespace-nowrap shrink-0 cursor-pointer ${
                settings.showAxes ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Axes</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 pl-1 text-[11px] text-slate-400 whitespace-nowrap shrink-0">
              <Gamepad2 className="w-3.5 h-3.5 text-slate-400" />
              <span>WASD+Q/E: Fly · Shift: Slow · F: Focus</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
