import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MONSTERS } from '../data/campaign';
import {
  GameSettings,
  HudSnapshot,
  MapDefinition,
  MonsterType,
  RemotePlayerState,
} from '../types/game';
import { audioEngine } from './audioEngine';
import {
  AnimatedMonsterRig,
  createCollectibleModel,
  createHidingSpotModel,
  createLocomotiveModel,
  createMonsterModel,
  createPlayerAvatarModel,
  createPuzzleStationModel,
  createStreetlampModel,
} from './models';
import { createThemeTextures } from './textures';

const TILE_SIZE = 4;
const PLAYER_EYE_Y = 1.72;
const PLAYER_RADIUS = 0.55;

// Pre-allocated scratch math objects (zero GC in loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

interface CollectibleEntity {
  id: string;
  kind: 'primary' | 'coin';
  x: number;
  z: number;
  collected: boolean;
  mesh: THREE.Group;
}

interface HidingEntity {
  id: string;
  x: number;
  z: number;
  label: string;
  mesh: THREE.Group;
}

interface MonsterEntity {
  id: string;
  type: MonsterType;
  rig: AnimatedMonsterRig;
  x: number;
  z: number;
  yaw: number;
  state: 'patrol' | 'chase' | 'decoy';
  targetX: number;
  targetZ: number;
  repathTimer: number;
  seenPlayerHiding: boolean;
}

interface RemoteAvatar {
  id: string;
  skinId: string;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetYaw: number;
  flashlightOn: boolean;
  hiding: boolean;
  model: ReturnType<typeof createPlayerAvatarModel>;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onOpenPuzzle: () => void;
  onGameEnd: (victory: boolean, killedBy: string | null, snapshot: HudSnapshot) => void;
  onCollectItem?: (itemId: string) => void;
  onSendPlayerState?: (state: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    flashlightOn: boolean;
    sprinting: boolean;
    hiding: boolean;
    hp: number;
  }) => void;
  onSendMonsters?: (monsters: Array<{ id: string; x: number; z: number; yaw: number; state: string }>) => void;
}

export class HorrorGameEngine {
  private container: HTMLElement;
  private mapDef: MapDefinition;
  private settings: GameSettings;
  private equippedItems: Set<string>;
  private callbacks: EngineCallbacks;
  private isCoopHost: boolean;
  private isCoopClient: boolean;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private paused = false;
  private puzzleOpen = false;
  private gameEnded = false;

  private grid: string[][] = [];
  private gridSize = 20;
  private worldHalf = 40;

  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private snowPoints: THREE.Points | null = null;
  private escapeLight: THREE.PointLight | null = null;
  private escapeGateMesh: THREE.Mesh | null = null;

  private collectibles: CollectibleEntity[] = [];
  private hidingSpots: HidingEntity[] = [];
  private monsters: MonsterEntity[] = [];
  private remoteAvatars = new Map<string, RemoteAvatar>();
  private walkableCells: Array<{ r: number; c: number; x: number; z: number }> = [];

  private puzzlePos = { x: 0, z: 0 };
  private escapePos = { x: 0, z: 0 };

  // Player state
  private playerX = 0;
  private playerZ = 0;
  private yaw = 0;
  private pitch = 0;
  private hp = 3;
  private maxHp = 3;
  private stamina = 100;
  private maxStamina = 100;
  private battery = 100;
  private maxBattery = 100;
  private flashlightOn = true;
  private hiding = false;
  private activeHideSpot: HidingEntity | null = null;
  private preHidePos = { x: 0, z: 0 };
  private invulnTimer = 0;
  private hitFlashTimer = 0;
  private bobTime = 0;
  private elapsedSeconds = 0;
  private bonusCoinsCollected = 0;
  private collectedPrimaryCount = 0;
  private puzzleSolved = false;
  private decoyTimer = 0;
  private decoyPos = { x: 0, z: 0 };
  private activeConsumable: 'peppermint_adrenaline' | 'jingle_decoy' | null = null;
  private consumableUsesLeft = 0;
  private statusToast: string | null = null;
  private toastTimer = 0;

  // Input state
  private keys = new Set<string>();
  private pointerLocked = false;
  private draggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastHudPush = 0;
  private lastNetPush = 0;
  private lastTime = performance.now();

  constructor(
    container: HTMLElement,
    mapDef: MapDefinition,
    settings: GameSettings,
    equippedItems: string[],
    callbacks: EngineCallbacks,
    coopMode: 'solo' | 'host' | 'peer' = 'solo',
  ) {
    this.container = container;
    this.mapDef = mapDef;
    this.settings = settings;
    this.equippedItems = new Set(equippedItems);
    this.callbacks = callbacks;
    this.isCoopHost = coopMode === 'host';
    this.isCoopClient = coopMode === 'peer';

    if (this.equippedItems.has('arctic_parka')) {
      this.maxStamina = 150;
      this.stamina = 150;
    }
    if (this.equippedItems.has('brass_flashlight')) {
      this.maxBattery = 160;
      this.battery = 160;
    }
    if (this.equippedItems.has('peppermint_adrenaline')) {
      this.activeConsumable = 'peppermint_adrenaline';
      this.consumableUsesLeft = 2;
    } else if (this.equippedItems.has('jingle_decoy')) {
      this.activeConsumable = 'jingle_decoy';
      this.consumableUsesLeft = 2;
    }

    this.initRendererAndScene();
    this.buildWorld();
    this.bindEvents();
    audioEngine.startAmbience();
    this.showToast(`Entered ${mapDef.title}. Find objectives & survive!`);
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene() {
    this.isSoftwareGl = this.detectSoftwareGl();
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && this.settings.graphicsQuality === 'high',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio, this.settings.graphicsQuality === 'high' ? 2 : 1.25),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.graphicsQuality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const skyColors: Record<string, number> = {
      village: 0x09101a,
      forest: 0x07121b,
      factory: 0x0e0c10,
      mansion: 0x0a0912,
      station: 0x080f18,
    };
    const fogColor = skyColors[this.mapDef.theme] ?? 0x09101a;
    this.scene.background = new THREE.Color(fogColor);
    this.scene.fog = new THREE.FogExp2(fogColor, this.mapDef.theme === 'forest' ? 0.042 : 0.032);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(74, width / height, 0.1, 140);

    // Balanced moonlight + cool hemisphere fill
    const hemi = new THREE.HemisphereLight(0x8bb4e8, 0x161b26, 0.55);
    this.scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xc7dcf7, 0.85);
    moon.position.set(22, 38, 16);
    if (!this.isSoftwareGl && this.settings.graphicsQuality === 'high') {
      moon.castShadow = true;
      moon.shadow.mapSize.set(1024, 1024);
      moon.shadow.camera.left = -45;
      moon.shadow.camera.right = 45;
      moon.shadow.camera.top = 45;
      moon.shadow.camera.bottom = -45;
      moon.shadow.bias = -0.0005;
      moon.shadow.normalBias = 0.02;
    }
    this.scene.add(moon);

    // Player Flashlight
    const beamAngle = this.equippedItems.has('brass_flashlight') ? Math.PI / 4.2 : Math.PI / 5.2;
    const beamDist = this.equippedItems.has('shadow_lantern') ? 34 : 26;
    const beamColor = this.equippedItems.has('shadow_lantern') ? 0xffe6a3 : 0xfff5db;
    this.flashlight = new THREE.SpotLight(beamColor, 4.8, beamDist, beamAngle, 0.45, 1.35);
    this.flashlightTarget = new THREE.Object3D();
    this.flashlight.target = this.flashlightTarget;
    this.scene.add(this.flashlight, this.flashlightTarget);
  }

  private tileToWorld(r: number, c: number) {
    return {
      x: (c - this.gridSize / 2 + 0.5) * TILE_SIZE,
      z: (r - this.gridSize / 2 + 0.5) * TILE_SIZE,
    };
  }

  private buildWorld() {
    this.grid = this.mapDef.gridRows.map((row) => row.split(''));
    this.gridSize = this.grid.length;
    this.worldHalf = (this.gridSize * TILE_SIZE) / 2;

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const tex = createThemeTextures(this.mapDef.theme, maxAniso);

    // Extended natural ground plane beyond playable zone (never floating in void)
    const groundGeo = new THREE.PlaneGeometry(180, 180);
    const groundMat = new THREE.MeshStandardMaterial({
      map: tex.ground,
      roughness: this.mapDef.theme === 'factory' ? 0.55 : 0.88,
      metalness: this.mapDef.theme === 'factory' ? 0.25 : 0.02,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Ceiling for indoor maps (factory & mansion)
    if (this.mapDef.theme === 'factory' || this.mapDef.theme === 'mansion') {
      const ceilMat = new THREE.MeshStandardMaterial({
        color: this.mapDef.theme === 'factory' ? 0x161920 : 0x1a1316,
        roughness: 0.9,
      });
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(this.gridSize * TILE_SIZE + 8, this.gridSize * TILE_SIZE + 8), ceilMat);
      ceil.rotation.x = Math.PI / 2;
      ceil.position.y = 4.6;
      this.scene.add(ceil);
    }

    const wallMat = new THREE.MeshStandardMaterial({
      map: tex.wall,
      roughness: 0.82,
      metalness: this.mapDef.theme === 'factory' ? 0.2 : 0.05,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: this.mapDef.theme === 'village' ? 0xdbeafe : 0x1e293b,
      roughness: 0.85,
    });

    const wallGeo = new THREE.BoxGeometry(TILE_SIZE, 4.4, TILE_SIZE);
    const roofCapGeo = new THREE.BoxGeometry(TILE_SIZE + 0.25, 0.28, TILE_SIZE + 0.25);

    const monsterSpawns: Array<{ x: number; z: number }> = [];
    const treePositions: Array<{ x: number; z: number; scale: number }> = [];
    let collectibleIndex = 0;
    let coinIndex = 0;
    let lampCount = 0;

    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const ch = this.grid[r][c];
        const pos = this.tileToWorld(r, c);

        if (ch === '#') {
          const wall = new THREE.Mesh(wallGeo, wallMat);
          wall.position.set(pos.x, 2.2, pos.z);
          wall.castShadow = true;
          wall.receiveShadow = true;
          this.scene.add(wall);

          if (this.mapDef.theme !== 'factory' && this.mapDef.theme !== 'mansion') {
            const cap = new THREE.Mesh(roofCapGeo, roofMat);
            cap.position.set(pos.x, 4.5, pos.z);
            this.scene.add(cap);
          }
          continue;
        }

        if (ch === 'T') {
          treePositions.push({ x: pos.x, z: pos.z, scale: 0.9 + ((r + c) % 3) * 0.15 });
          continue;
        }

        this.walkableCells.push({ r, c, x: pos.x, z: pos.z });

        if (ch === 'S') {
          this.playerX = pos.x;
          this.playerZ = pos.z;
        } else if (ch === 'M') {
          monsterSpawns.push(pos);
        } else if (ch === 'H') {
          const spot = createHidingSpotModel(this.mapDef.theme);
          spot.position.set(pos.x, 0, pos.z);
          this.scene.add(spot);
          const label =
            this.mapDef.theme === 'forest'
              ? 'Snowdrift Hollow'
              : this.mapDef.theme === 'factory' || this.mapDef.theme === 'station'
                ? 'Iron Locker'
                : 'Oak Wardrobe';
          this.hidingSpots.push({
            id: `hide_${r}_${c}`,
            x: pos.x,
            z: pos.z,
            label,
            mesh: spot,
          });
        } else if (ch === 'G') {
          const item = createCollectibleModel(this.mapDef.id, tex.gift, false);
          item.position.set(pos.x, 0, pos.z);
          this.scene.add(item);
          this.collectibles.push({
            id: `obj_${collectibleIndex++}_${r}_${c}`,
            kind: 'primary',
            x: pos.x,
            z: pos.z,
            collected: false,
            mesh: item,
          });
        } else if (ch === 'C') {
          const coin = createCollectibleModel(this.mapDef.id, tex.gift, true);
          coin.position.set(pos.x, 0, pos.z);
          this.scene.add(coin);
          this.collectibles.push({
            id: `coin_${coinIndex++}_${r}_${c}`,
            kind: 'coin',
            x: pos.x,
            z: pos.z,
            collected: false,
            mesh: coin,
          });
        } else if (ch === 'P') {
          const puzzle = createPuzzleStationModel(this.mapDef.id);
          puzzle.position.set(pos.x, 0, pos.z);
          this.scene.add(puzzle);
          this.puzzlePos = { x: pos.x, z: pos.z };
        } else if (ch === 'L') {
          const lamp = createStreetlampModel();
          lamp.position.set(pos.x, 0, pos.z);
          this.scene.add(lamp);
          if (lampCount < 6) {
            const pLight = new THREE.PointLight(0xfbbf24, 1.8, 14, 2);
            pLight.position.set(pos.x, 3.6, pos.z);
            this.scene.add(pLight);
            lampCount++;
          }
        } else if (ch === 'E') {
          this.escapePos = { x: pos.x, z: pos.z };
          if (this.mapDef.id === 'station') {
            const train = createLocomotiveModel();
            train.position.set(pos.x, 0, pos.z - 2.8);
            train.rotation.y = Math.PI / 2;
            this.scene.add(train);
          }
          const gateGeo = new THREE.BoxGeometry(3.4, 3.6, 0.45);
          const gateMat = new THREE.MeshStandardMaterial({
            color: 0x991b1b,
            emissive: 0x7f1d1d,
            emissiveIntensity: 1.4,
            transparent: true,
            opacity: 0.72,
          });
          this.escapeGateMesh = new THREE.Mesh(gateGeo, gateMat);
          this.escapeGateMesh.position.set(pos.x, 1.8, pos.z);
          this.scene.add(this.escapeGateMesh);

          this.escapeLight = new THREE.PointLight(0xef4444, 2.5, 16, 2);
          this.escapeLight.position.set(pos.x, 3.1, pos.z + 1.2);
          this.scene.add(this.escapeLight);
        }
      }
    }

    // Outer perimeter natural pine forest ring (beyond playable boundary)
    const ringRadius = this.worldHalf + 6;
    for (let i = 0; i < 64; i++) {
      const ang = (i / 64) * Math.PI * 2;
      const r = ringRadius + (i % 3) * 4.5;
      treePositions.push({
        x: Math.cos(ang) * r,
        z: Math.sin(ang) * r,
        scale: 1.15 + (i % 4) * 0.22,
      });
    }

    if (treePositions.length > 0) {
      this.buildInstancedPineTrees(treePositions);
    }

    // Snowfall particles for outdoor themes
    if (this.mapDef.theme !== 'factory' && this.mapDef.theme !== 'mansion') {
      const snowCount = 700;
      const posArr = new Float32Array(snowCount * 3);
      for (let i = 0; i < snowCount; i++) {
        posArr[i * 3] = (Math.random() - 0.5) * 90;
        posArr[i * 3 + 1] = Math.random() * 18;
        posArr[i * 3 + 2] = (Math.random() - 0.5) * 90;
      }
      const snowGeo = new THREE.BufferGeometry();
      snowGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      const snowMat = new THREE.PointsMaterial({
        color: 0xe2e8f0,
        size: 0.16,
        transparent: true,
        opacity: 0.72,
      });
      this.snowPoints = new THREE.Points(snowGeo, snowMat);
      this.scene.add(this.snowPoints);
    }

    // Spawn Monsters
    this.mapDef.monsters.forEach((mType, idx) => {
      const spawn = monsterSpawns[idx % Math.max(1, monsterSpawns.length)] || { x: 0, z: -12 };
      const rig = createMonsterModel(mType);
      rig.group.position.set(spawn.x, 0, spawn.z);
      this.scene.add(rig.group);
      const randCell = this.pickRandomWalkableCell();
      this.monsters.push({
        id: `m_${idx}_${mType}`,
        type: mType,
        rig,
        x: spawn.x,
        z: spawn.z,
        yaw: 0,
        state: 'patrol',
        targetX: randCell.x,
        targetZ: randCell.z,
        repathTimer: 2,
        seenPlayerHiding: false,
      });
    });

    this.camera.position.set(this.playerX, PLAYER_EYE_Y, this.playerZ);
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private buildInstancedPineTrees(positions: Array<{ x: number; z: number; scale: number }>) {
    const count = positions.length;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.34, 2.2, 7);
    trunkGeo.translate(0, 1.1, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3b2619, roughness: 0.92 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);

    const foliageGeo = new THREE.ConeGeometry(1.55, 4.6, 8);
    foliageGeo.translate(0, 4.1, 0);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x163024, roughness: 0.88 });
    const foliage = new THREE.InstancedMesh(foliageGeo, foliageMat, count);

    const snowCapGeo = new THREE.ConeGeometry(1.15, 1.8, 8);
    snowCapGeo.translate(0, 5.5, 0);
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.9 });
    const snowCaps = new THREE.InstancedMesh(snowCapGeo, snowCapMat, count);

    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();

    positions.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.y = (i * 1.7) % (Math.PI * 2);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      foliage.setMatrixAt(i, dummy.matrix);
      snowCaps.setMatrixAt(i, dummy.matrix);

      tint.setHSL(0.42, 0.36, 0.14 + (i % 3) * 0.03);
      foliage.setColorAt(i, tint);
    });

    trunks.instanceMatrix.needsUpdate = true;
    foliage.instanceMatrix.needsUpdate = true;
    snowCaps.instanceMatrix.needsUpdate = true;
    if (foliage.instanceColor) foliage.instanceColor.needsUpdate = true;

    trunks.computeBoundingSphere();
    foliage.computeBoundingSphere();
    snowCaps.computeBoundingSphere();

    this.scene.add(trunks, foliage, snowCaps);
  }

  private pickRandomWalkableCell() {
    if (this.walkableCells.length === 0) return { x: 0, z: 0 };
    return this.walkableCells[Math.floor(Math.random() * this.walkableCells.length)];
  }

  private isSolidAtWorld(wx: number, wz: number): boolean {
    const col = Math.floor((wx + this.worldHalf) / TILE_SIZE);
    const row = Math.floor((wz + this.worldHalf) / TILE_SIZE);
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return true;
    const ch = this.grid[row][col];
    return ch === '#' || ch === 'T';
  }

  private canOccupy(wx: number, wz: number, radius = PLAYER_RADIUS): boolean {
    return (
      !this.isSolidAtWorld(wx - radius, wz - radius) &&
      !this.isSolidAtWorld(wx + radius, wz - radius) &&
      !this.isSolidAtWorld(wx - radius, wz + radius) &&
      !this.isSolidAtWorld(wx + radius, wz + radius)
    );
  }

  private hasLineOfSight(x1: number, z1: number, x2: number, z2: number): boolean {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / 1.0);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolidAtWorld(x1 + dx * t, z1 + dz * t)) return false;
    }
    return true;
  }

  public showToast(msg: string) {
    this.statusToast = msg;
    this.toastTimer = 3.6;
  }

  public requestPointerLock() {
    if (this.paused || this.puzzleOpen || this.gameEnded) return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // fallback drag look still works
    }
  }

  public setPaused(paused: boolean) {
    this.paused = paused;
    if (paused && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  public setPuzzleOpen(open: boolean) {
    this.puzzleOpen = open;
    if (open && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  public markPuzzleSolved(byTeammate?: string) {
    if (this.puzzleSolved) return;
    this.puzzleSolved = true;
    audioEngine.playCollect(false);
    this.updateEscapeGateVisual();
    this.showToast(
      byTeammate
        ? `${byTeammate} solved ${this.mapDef.puzzleTitle}!`
        : `${this.mapDef.puzzleTitle} solved!`,
    );
  }

  public applyRemoteObjective(itemId: string, byName: string) {
    const item = this.collectibles.find((c) => c.id === itemId);
    if (!item || item.collected) return;
    item.collected = true;
    item.mesh.visible = false;
    if (item.kind === 'primary') {
      this.collectedPrimaryCount++;
      this.updateEscapeGateVisual();
      this.showToast(`${byName} recovered an objective item!`);
    }
  }

  public applyRemotePlayerState(player: RemotePlayerState) {
    let avatar = this.remoteAvatars.get(player.id);
    if (!avatar) {
      const model = createPlayerAvatarModel(player.skinId);
      this.scene.add(model.group);
      avatar = {
        id: player.id,
        skinId: player.skinId,
        targetX: player.x,
        targetY: player.y,
        targetZ: player.z,
        targetYaw: player.yaw,
        flashlightOn: player.flashlightOn,
        hiding: player.hiding,
        model,
      };
      this.remoteAvatars.set(player.id, avatar);
    }
    avatar.targetX = player.x;
    avatar.targetY = player.y;
    avatar.targetZ = player.z;
    avatar.targetYaw = player.yaw;
    avatar.flashlightOn = player.flashlightOn;
    avatar.hiding = player.hiding;
  }

  public removeRemotePlayer(playerId: string) {
    const avatar = this.remoteAvatars.get(playerId);
    if (avatar) {
      this.scene.remove(avatar.model.group);
      this.remoteAvatars.delete(playerId);
    }
  }

  public applyRemoteMonsters(states: Array<{ id: string; x: number; z: number; yaw: number; state: string }>) {
    if (!this.isCoopClient) return;
    for (const st of states) {
      const m = this.monsters.find((item) => item.id === st.id);
      if (m) {
        m.targetX = st.x;
        m.targetZ = st.z;
        m.yaw = st.yaw;
        m.state = st.state === 'chase' ? 'chase' : 'patrol';
      }
    }
  }

  private updateEscapeGateVisual() {
    const unlocked =
      this.collectedPrimaryCount >= this.mapDef.requiredCollectibles && this.puzzleSolved;
    if (unlocked && this.escapeGateMesh && this.escapeLight) {
      const mat = this.escapeGateMesh.material as THREE.MeshStandardMaterial;
      mat.color.setHex(0x10b981);
      mat.emissive.setHex(0x059669);
      mat.opacity = 0.35;
      this.escapeLight.color.setHex(0x34d399);
      this.escapeLight.intensity = 4.2;
      this.showToast(`ESCAPE UNLOCKED! Run to ${this.mapDef.escapeLabel}!`);
    }
  }

  private bindEvents() {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
  }

  private onResize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
  };

  private onMouseDown = (e: MouseEvent) => {
    audioEngine.init();
    if (this.paused || this.puzzleOpen || this.gameEnded) return;
    if (!this.pointerLocked) {
      this.draggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.requestPointerLock();
    }
  };

  private onMouseUp = () => {
    this.draggingLook = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.paused || this.puzzleOpen || this.gameEnded) return;
    const sens = 0.0022 * this.settings.mouseSensitivity;
    const ySign = this.settings.invertY ? -1 : 1;

    if (this.pointerLocked) {
      this.yaw -= e.movementX * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * sens * ySign, -1.25, 1.25);
    } else if (this.draggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.yaw -= dx * sens * 1.4;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * sens * 1.4 * ySign, -1.25, 1.25);
    }
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.gameEnded) return;
    const code = e.code;
    this.keys.add(code);

    if (this.puzzleOpen || this.paused) return;

    if (code === 'KeyF') {
      if (this.battery > 0) {
        this.flashlightOn = !this.flashlightOn;
        audioEngine.playClick();
      }
    } else if (code === 'KeyE') {
      this.triggerInteract();
    } else if (code === 'KeyQ') {
      this.useConsumable();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
  };

  private useConsumable() {
    if (!this.activeConsumable || this.consumableUsesLeft <= 0) return;
    this.consumableUsesLeft--;

    if (this.activeConsumable === 'peppermint_adrenaline') {
      this.hp = Math.min(this.maxHp, this.hp + 1);
      this.stamina = this.maxStamina;
      audioEngine.playCollect(true);
      this.showToast('Peppermint Adrenaline: +1 Health & Full Stamina!');
    } else {
      this.decoyTimer = 6.0;
      this.decoyPos = { x: this.playerX, z: this.playerZ };
      audioEngine.playDecoyBell();
      this.showToast('Jingle Decoy Bell rung! Monsters lured away for 6s.');
    }
  }

  private getInteractionContext(): {
    prompt: string | null;
    action: HudSnapshot['interactAction'];
    target?: CollectibleEntity | HidingEntity;
  } {
    if (this.hiding) {
      return { prompt: '[E] Exit Hiding Spot', action: 'unhide' };
    }

    // Check Escape Gate
    const escapeDist = Math.hypot(this.playerX - this.escapePos.x, this.playerZ - this.escapePos.z);
    const unlocked =
      this.collectedPrimaryCount >= this.mapDef.requiredCollectibles && this.puzzleSolved;
    if (escapeDist < 3.4) {
      if (unlocked) {
        return { prompt: `[E] Escape via ${this.mapDef.escapeLabel}`, action: 'escape' };
      }
      return {
        prompt: `Locked — Need ${this.mapDef.requiredCollectibles - this.collectedPrimaryCount} items${this.puzzleSolved ? '' : ' & Puzzle'}`,
        action: null,
      };
    }

    // Check Collectibles
    for (const c of this.collectibles) {
      if (c.collected) continue;
      if (Math.hypot(this.playerX - c.x, this.playerZ - c.z) < 2.6) {
        return {
          prompt: c.kind === 'coin' ? '[E] Collect Candy Coin' : `[E] Collect ${this.mapDef.objectiveLabel.split(' ')[0]} Item`,
          action: c.kind === 'coin' ? 'coin' : 'collect',
          target: c,
        };
      }
    }

    // Check Puzzle Station
    if (!this.puzzleSolved && Math.hypot(this.playerX - this.puzzlePos.x, this.playerZ - this.puzzlePos.z) < 3.0) {
      return { prompt: `[E] Open ${this.mapDef.puzzleTitle}`, action: 'puzzle' };
    }

    // Check Hiding Spots
    for (const h of this.hidingSpots) {
      if (Math.hypot(this.playerX - h.x, this.playerZ - h.z) < 2.7) {
        return { prompt: `[E] Hide in ${h.label}`, action: 'hide', target: h };
      }
    }

    return { prompt: null, action: null };
  }

  public triggerInteract() {
    const ctx = this.getInteractionContext();
    if (!ctx.action) return;

    if (ctx.action === 'unhide') {
      this.hiding = false;
      this.playerX = this.preHidePos.x;
      this.playerZ = this.preHidePos.z;
      this.activeHideSpot = null;
      audioEngine.playClick();
      return;
    }

    if (ctx.action === 'hide' && ctx.target && 'label' in ctx.target) {
      this.preHidePos = { x: this.playerX, z: this.playerZ };
      this.hiding = true;
      this.activeHideSpot = ctx.target;
      this.flashlightOn = false;
      // Check if any monster directly witnessed player entering
      for (const m of this.monsters) {
        const d = Math.hypot(m.x - this.playerX, m.z - this.playerZ);
        m.seenPlayerHiding = d < 6.5 && this.hasLineOfSight(m.x, m.z, this.playerX, this.playerZ);
      }
      audioEngine.playClick();
      return;
    }

    if ((ctx.action === 'collect' || ctx.action === 'coin') && ctx.target && 'kind' in ctx.target) {
      const item = ctx.target;
      item.collected = true;
      item.mesh.visible = false;
      if (item.kind === 'coin') {
        this.bonusCoinsCollected++;
        audioEngine.playCollect(true);
        this.showToast('+15 Candy Coins!');
      } else {
        this.collectedPrimaryCount++;
        audioEngine.playCollect(false);
        this.callbacks.onCollectItem?.(item.id);
        this.updateEscapeGateVisual();
        this.showToast(
          `${this.mapDef.objectiveLabel}: ${this.collectedPrimaryCount}/${this.mapDef.requiredCollectibles}`,
        );
      }
      return;
    }

    if (ctx.action === 'puzzle') {
      audioEngine.playClick();
      this.setPuzzleOpen(true);
      this.callbacks.onOpenPuzzle();
      return;
    }

    if (ctx.action === 'escape') {
      this.finishGame(true, null);
    }
  }

  private finishGame(victory: boolean, killedBy: string | null) {
    if (this.gameEnded) return;
    this.gameEnded = true;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
    if (victory) {
      audioEngine.playTrainEscapeHorn();
    } else {
      audioEngine.playDamageSting();
    }
    audioEngine.stopAmbience();
    this.callbacks.onGameEnd(victory, killedBy, this.buildHudSnapshot(999, null, 0, 0));
  }

  private buildHudSnapshot(
    nearestMonsterDist: number,
    nearestMonsterName: string | null,
    freezeLevel: number,
    shadowStatic: number,
  ): HudSnapshot {
    const ctx = this.getInteractionContext();
    const sprinting =
      !this.hiding &&
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) &&
      this.stamina > 1 &&
      (this.keys.has('KeyW') || this.keys.has('KeyA') || this.keys.has('KeyS') || this.keys.has('KeyD') ||
        this.keys.has('ArrowUp') || this.keys.has('ArrowDown'));

    return {
      hp: this.hp,
      maxHp: this.maxHp,
      stamina: this.stamina,
      maxStamina: this.maxStamina,
      battery: this.battery,
      maxBattery: this.maxBattery,
      flashlightOn: this.flashlightOn,
      sprinting,
      hiding: this.hiding,
      hidingSpotLabel: this.activeHideSpot?.label || '',
      collectedCount: this.collectedPrimaryCount,
      requiredCount: this.mapDef.requiredCollectibles,
      bonusCoinsCollected: this.bonusCoinsCollected,
      puzzleSolved: this.puzzleSolved,
      escapeUnlocked:
        this.collectedPrimaryCount >= this.mapDef.requiredCollectibles && this.puzzleSolved,
      elapsedSeconds: Math.floor(this.elapsedSeconds),
      nearestMonsterDist,
      nearestMonsterName,
      interactPrompt: ctx.prompt,
      interactAction: ctx.action,
      pointerLocked: this.pointerLocked,
      activeConsumableName:
        this.activeConsumable === 'peppermint_adrenaline'
          ? 'Peppermint Adrenaline'
          : this.activeConsumable === 'jingle_decoy'
            ? 'Jingle Decoy Bell'
            : null,
      consumableUsesLeft: this.consumableUsesLeft,
      statusToast: this.toastTimer > 0 ? this.statusToast : null,
      freezeLevel,
      shadowStatic,
    };
  }

  private startLoop() {
    this.lastTime = performance.now();
    const tick = () => {
      if (this.disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;

      if (!this.paused && !this.puzzleOpen && !this.gameEnded) {
        this.update(dt, now);
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private update(dt: number, now: number) {
    this.elapsedSeconds += dt;
    if (this.invulnTimer > 0) this.invulnTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.toastTimer > 0) this.toastTimer -= dt;
    if (this.decoyTimer > 0) this.decoyTimer -= dt;

    // ArrowLeft/Right fallback yaw look
    if (this.keys.has('ArrowLeft')) this.yaw += 2.1 * dt;
    if (this.keys.has('ArrowRight')) this.yaw -= 2.1 * dt;

    // Player movement
    let moveForward = 0;
    let moveRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveForward -= 1;
    if (this.keys.has('KeyD')) moveRight += 1;
    if (this.keys.has('KeyA')) moveRight -= 1;

    const moving = !this.hiding && (moveForward !== 0 || moveRight !== 0);
    const wantsSprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const sprinting = moving && wantsSprint && this.stamina > 2;

    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - 24 * dt);
    } else {
      const regenRate = this.hiding ? 26 : 16;
      this.stamina = Math.min(this.maxStamina, this.stamina + regenRate * dt);
    }

    if (moving) {
      const bootsMult = this.equippedItems.has('frostbite_boots') ? 1.15 : 1.0;
      const baseSpeed = sprinting ? 7.4 : 4.65;
      const speed = baseSpeed * bootsMult;
      const len = Math.hypot(moveForward, moveRight);
      const nf = moveForward / len;
      const nr = moveRight / len;

      const sinY = Math.sin(this.yaw);
      const cosY = Math.cos(this.yaw);
      const vx = (-sinY * nf + cosY * nr) * speed * dt;
      const vz = (-cosY * nf - sinY * nr) * speed * dt;

      if (this.canOccupy(this.playerX + vx, this.playerZ)) {
        this.playerX += vx;
      }
      if (this.canOccupy(this.playerX, this.playerZ + vz)) {
        this.playerZ += vz;
      }

      this.bobTime += dt * (sprinting ? 14 : 9);
      audioEngine.playFootstep(sprinting);
    } else {
      this.bobTime = THREE.MathUtils.damp(this.bobTime, 0, 6, dt);
    }

    // Camera position & hiding pose
    if (this.hiding && this.activeHideSpot) {
      this.camera.position.set(
        THREE.MathUtils.damp(this.camera.position.x, this.activeHideSpot.x, 10, dt),
        THREE.MathUtils.damp(this.camera.position.y, 1.28, 10, dt),
        THREE.MathUtils.damp(this.camera.position.z, this.activeHideSpot.z + 0.15, 10, dt),
      );
    } else {
      const bobY = moving ? Math.sin(this.bobTime) * (sprinting ? 0.08 : 0.045) : 0;
      const shakeX = this.hitFlashTimer > 0 ? (Math.random() - 0.5) * 0.12 : 0;
      this.camera.position.set(this.playerX + shakeX, PLAYER_EYE_Y + bobY, this.playerZ);
    }

    _euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(_euler);

    // Flashlight update
    if (this.flashlightOn && this.battery > 0 && !this.hiding) {
      this.battery = Math.max(0, this.battery - 1.45 * dt);
      if (this.battery <= 0) this.flashlightOn = false;
    } else if (!this.flashlightOn) {
      // Slow passive battery trickle recharge
      this.battery = Math.min(this.maxBattery, this.battery + 1.8 * dt);
    }

    this.flashlight.position.copy(this.camera.position);
    _v1.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.flashlightTarget.position.copy(this.camera.position).addScaledVector(_v1, 10);

    // Animate collectibles bobbing
    const tSec = now * 0.002;
    for (const c of this.collectibles) {
      if (!c.collected) {
        c.mesh.rotation.y = tSec * 0.85;
        c.mesh.position.y = Math.sin(tSec * 1.8 + c.x) * 0.12;
      }
    }

    // Animate snow particles
    if (this.snowPoints) {
      const posAttr = this.snowPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - 3.4 * dt;
        let x = posAttr.getX(i) + Math.sin(tSec + i) * 0.6 * dt;
        if (y < 0) y = 18;
        if (x > 45) x = -45;
        posAttr.setXY(i, x, y);
      }
      posAttr.needsUpdate = true;
    }

    // Update Monsters & compute proximity effects
    let nearestDist = 999;
    let nearestName: string | null = null;
    let freezeLevel = 0;
    let shadowStatic = 0;

    for (const m of this.monsters) {
      const d = Math.hypot(m.x - this.playerX, m.z - this.playerZ);
      if (d < nearestDist) {
        nearestDist = d;
        nearestName = MONSTERS[m.type].name;
      }

      // Special Monster Auras
      if (m.type === 'frozen_snowman' && d < 10) {
        const intensity = 1 - d / 10;
        const resist = this.equippedItems.has('arctic_parka') ? 0.55 : 1.0;
        freezeLevel = Math.max(freezeLevel, intensity * resist);
        this.stamina = Math.max(0, this.stamina - 14 * intensity * resist * dt);
      }
      if (m.type === 'christmas_shadow' && d < 11) {
        const intensity = 1 - d / 11;
        const resist = this.equippedItems.has('shadow_lantern') ? 0.35 : 1.0;
        shadowStatic = Math.max(shadowStatic, intensity * resist);
        if (this.flashlightOn) {
          this.battery = Math.max(0, this.battery - 12 * intensity * resist * dt);
        }
      }

      if (this.isCoopClient) {
        // Interpolate towards host authoritative position
        m.x = THREE.MathUtils.damp(m.x, m.targetX, 8, dt);
        m.z = THREE.MathUtils.damp(m.z, m.targetZ, 8, dt);
      } else {
        this.stepMonsterAI(m, dt, d, sprinting);
      }

      m.rig.group.position.set(m.x, 0, m.z);
      m.rig.group.rotation.y = m.yaw;

      // Procedural limb walk cycle
      const strideSpeed = m.state === 'chase' ? 11 : 6;
      const swing = Math.sin(tSec * strideSpeed) * (m.state === 'chase' ? 0.65 : 0.35);
      m.rig.leftLeg.rotation.x = swing;
      m.rig.rightLeg.rotation.x = -swing;
      m.rig.leftArm.rotation.x = -swing * 0.8;
      m.rig.rightArm.rotation.x = swing * 0.8;
      m.rig.head.rotation.z = Math.sin(tSec * 2.1) * 0.08;

      // Damage check
      if (
        d < 1.38 &&
        this.invulnTimer <= 0 &&
        (!this.hiding || m.seenPlayerHiding)
      ) {
        this.hp = Math.max(0, this.hp - 1);
        this.invulnTimer = 2.6;
        this.hitFlashTimer = 0.6;
        if (this.hiding) {
          this.hiding = false;
          this.playerX = this.preHidePos.x;
          this.playerZ = this.preHidePos.z;
          this.activeHideSpot = null;
        }
        audioEngine.playDamageSting();
        this.showToast(`${MONSTERS[m.type].name} struck you! Run!`);
        if (this.hp <= 0) {
          this.finishGame(false, MONSTERS[m.type].name);
          return;
        }
      }
    }

    // Flashlight flicker near monsters
    if (this.flashlightOn && this.battery > 0 && !this.hiding) {
      const flicker =
        nearestDist < 11 && Math.random() < (1 - nearestDist / 11) * 0.35 ? 0.6 : 4.8;
      this.flashlight.intensity = flicker;
    } else {
      this.flashlight.intensity = 0;
    }

    // Spatial Horror Audio
    audioEngine.updateHeartbeat(nearestDist);
    if (nearestDist < 20) {
      const closestMonster = this.monsters.reduce(
        (best, cur) =>
          Math.hypot(cur.x - this.playerX, cur.z - this.playerZ) <
          Math.hypot(best.x - this.playerX, best.z - this.playerZ)
            ? cur
            : best,
        this.monsters[0],
      );
      if (closestMonster) {
        audioEngine.playMonsterProximityCue(closestMonster.type, nearestDist);
      }
    }

    // Interpolate Remote Multiplayer Avatars
    for (const avatar of this.remoteAvatars.values()) {
      avatar.model.group.visible = !avatar.hiding;
      avatar.model.group.position.set(
        THREE.MathUtils.damp(avatar.model.group.position.x, avatar.targetX, 12, dt),
        0,
        THREE.MathUtils.damp(avatar.model.group.position.z, avatar.targetZ, 12, dt),
      );
      avatar.model.group.rotation.y = avatar.targetYaw + Math.PI;
      avatar.model.flashlightSpot.intensity = avatar.flashlightOn ? 3.2 : 0;
    }

    // Push HUD snapshot at 15Hz
    if (now - this.lastHudPush > 66) {
      this.lastHudPush = now;
      this.callbacks.onHudUpdate(
        this.buildHudSnapshot(nearestDist, nearestName, freezeLevel, shadowStatic),
      );
    }

    // Push Multiplayer Net Sync at 15Hz
    if (now - this.lastNetPush > 66) {
      this.lastNetPush = now;
      this.callbacks.onSendPlayerState?.({
        x: this.playerX,
        y: this.camera.position.y,
        z: this.playerZ,
        yaw: this.yaw,
        pitch: this.pitch,
        flashlightOn: this.flashlightOn,
        sprinting,
        hiding: this.hiding,
        hp: this.hp,
      });
      if (this.isCoopHost) {
        this.callbacks.onSendMonsters?.(
          this.monsters.map((m) => ({
            id: m.id,
            x: m.x,
            z: m.z,
            yaw: m.yaw,
            state: m.state,
          })),
        );
      }
    }
  }

  private stepMonsterAI(m: MonsterEntity, dt: number, distToPlayer: number, playerSprinting: boolean) {
    const cfg = MONSTERS[m.type];

    // Decoy bell overrides aggro!
    if (this.decoyTimer > 0) {
      m.state = 'decoy';
      m.targetX = this.decoyPos.x;
      m.targetZ = this.decoyPos.z;
    } else {
      const detectRange =
        (this.flashlightOn ? cfg.sightRange : cfg.sightRange * 0.55) +
        (playerSprinting ? 5.5 : 0);
      const canDetect =
        (!this.hiding || m.seenPlayerHiding) &&
        distToPlayer < detectRange &&
        this.hasLineOfSight(m.x, m.z, this.playerX, this.playerZ);

      if (canDetect) {
        m.state = 'chase';
        m.targetX = this.playerX;
        m.targetZ = this.playerZ;
      } else if (m.state === 'chase' && distToPlayer > detectRange + 4) {
        m.state = 'patrol';
        m.seenPlayerHiding = false;
        const cell = this.pickRandomWalkableCell();
        m.targetX = cell.x;
        m.targetZ = cell.z;
      }
    }

    m.repathTimer -= dt;
    const distToTarget = Math.hypot(m.targetX - m.x, m.targetZ - m.z);
    if (m.state === 'patrol' && (distToTarget < 1.2 || m.repathTimer <= 0)) {
      const cell = this.pickRandomWalkableCell();
      m.targetX = cell.x;
      m.targetZ = cell.z;
      m.repathTimer = 4.5;
    }

    const speed = m.state === 'chase' ? cfg.chaseSpeed : cfg.speed;
    if (distToTarget > 0.25) {
      const dirX = (m.targetX - m.x) / distToTarget;
      const dirZ = (m.targetZ - m.z) / distToTarget;
      const step = speed * dt;

      let moved = false;
      if (this.canOccupy(m.x + dirX * step, m.z, 0.45)) {
        m.x += dirX * step;
        moved = true;
      }
      if (this.canOccupy(m.x, m.z + dirZ * step, 0.45)) {
        m.z += dirZ * step;
        moved = true;
      }

      if (!moved && m.state === 'patrol') {
        const cell = this.pickRandomWalkableCell();
        m.targetX = cell.x;
        m.targetZ = cell.z;
      } else if (!moved && m.state === 'chase') {
        // Slide tangentially around wall corners toward player
        const perpX = -dirZ * step;
        const perpZ = dirX * step;
        if (this.canOccupy(m.x + perpX, m.z + perpZ, 0.45)) {
          m.x += perpX;
          m.z += perpZ;
        } else if (this.canOccupy(m.x - perpX, m.z - perpZ, 0.45)) {
          m.x -= perpX;
          m.z -= perpZ;
        }
      }

      m.yaw = Math.atan2(dirX, dirZ);
    }
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    audioEngine.stopAmbience();

    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    this.renderer.dispose();
  }
}
