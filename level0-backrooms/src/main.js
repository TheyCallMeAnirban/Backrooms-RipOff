import * as THREE from 'three';
import './style.css';
import { CONFIG } from './config.js';
import { Loop } from './engine/Loop.js';
import { Input } from './engine/Input.js';
import { GameState, GAME_STATES } from './engine/State.js';
import { MazeGen } from './world/MazeGen.js';
import { SpatialAudioSystem } from './audio/SpatialAudioSystem.js';
import { OcclusionRaycaster } from './audio/OcclusionRaycaster.js';
import { VoiceMimic } from './audio/VoiceMimic.js';
import { Controller } from './player/Controller.js';
import { Monster } from './entity/Monster.js';
import { CreatureAI } from './entity/CreatureAI.js';
import { SpawnDirector } from './systems/SpawnDirector.js';
import { FearDirector } from './systems/FearDirector.js';
import { HallucinationDirector } from './systems/HallucinationDirector.js';
import { FearModel } from './systems/FearModel.js';
import { PRNG } from './world/PRNG.js';

// Query param seed support (?seed=4207)
const urlParams = new URLSearchParams(window.location.search);
const hasCustomSeed = urlParams.has('seed');
const activeSeed = hasCustomSeed ? parseInt(urlParams.get('seed'), 10) : Math.floor(Math.random() * 900000) + 100000;
console.log(`[Level0] Active Run Seed: ${activeSeed} (custom: ${hasCustomSeed})`);

// DOM Elements
const app = document.querySelector('#app');
const intro = document.querySelector('#intro');
const hud = document.querySelector('#hud');
const scare = document.querySelector('#scare');
const end = document.querySelector('#end');
const msg = document.querySelector('#message');
const keyCountEl = document.querySelector('#keyCount');
const startBtn = document.querySelector('#start');
const restartBtn = document.querySelector('#restart');

// Subsystems
const state = new GameState(GAME_STATES.TITLE);
const audio = new SpatialAudioSystem();
const prng = new PRNG(activeSeed);
const mazeGen = new MazeGen(activeSeed);
const spawnDirector = new SpawnDirector(mazeGen, activeSeed + 777);
const fearDirector = new FearDirector(mazeGen, audio, prng);
const occlusionRaycaster = new OcclusionRaycaster(mazeGen);
const fearModel = new FearModel();

let hallucinationDirector = null;
let voiceMimic = null;
let input = null;
let loop = null;
let playerController = null;

// Monster & AI
let monster = null;
let creatureAI = null;

// Three.js instances
let scene, camera, renderer;
const colliders = [];
const pickups = [];
const lights = [];

// Game Variables
let keysCollected = 0;
let lastMessageTime = 0;
let flashlightOn = true;
let scareCooldown = 0;

// Flashlight references
let flashlightSpot = null;
let flashlightTarget = null;
let flashlightPoint = null;

// Materials & Geometries
const mat = (color, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness });
const wallMat = mat(CONFIG.RENDER.WALL_COLOR);
const carpetMat = mat(CONFIG.RENDER.CARPET_COLOR);
const ceilingMat = mat(CONFIG.RENDER.CEILING_COLOR);
const trimMat = mat(CONFIG.RENDER.TRIM_COLOR);

const wallGeoZ = new THREE.BoxGeometry(CONFIG.WORLD.CELL_SIZE, CONFIG.WORLD.WALL_HEIGHT, CONFIG.WORLD.WALL_THICKNESS);
const wallGeoX = new THREE.BoxGeometry(CONFIG.WORLD.WALL_THICKNESS, CONFIG.WORLD.WALL_HEIGHT, CONFIG.WORLD.CELL_SIZE);
let exitMesh;

function showMessage(text, ms = 2200) {
  msg.textContent = text;
  lastMessageTime = performance.now() + ms;
}

function collides(x, z) {
  const r = CONFIG.PLAYER.COLLISION_RADIUS;
  for (const c of colliders) {
    if (Math.abs(x - c.x) < c.hx + r && Math.abs(z - c.z) < c.hz + r) return true;
  }
  return false;
}

function addWall(x, z, vertical) {
  const mesh = new THREE.Mesh(vertical ? wallGeoX : wallGeoZ, wallMat);
  const p = mazeGen.cellToWorld(x, z);
  mesh.position.set(p.x, CONFIG.WORLD.WALL_HEIGHT / 2, p.z);
  scene.add(mesh);

  colliders.push({
    x: mesh.position.x,
    z: mesh.position.z,
    hx: vertical ? CONFIG.WORLD.WALL_THICKNESS / 2 : CONFIG.WORLD.CELL_SIZE / 2,
    hz: vertical ? CONFIG.WORLD.CELL_SIZE / 2 : CONFIG.WORLD.WALL_THICKNESS / 2,
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      vertical ? CONFIG.WORLD.WALL_THICKNESS + 0.06 : CONFIG.WORLD.CELL_SIZE,
      0.18,
      vertical ? CONFIG.WORLD.CELL_SIZE : CONFIG.WORLD.WALL_THICKNESS + 0.06
    ),
    trimMat
  );
  base.position.set(mesh.position.x, 0.09, mesh.position.z);
  scene.add(base);
}

function createWorld() {
  const mazeData = mazeGen.generate();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.RENDER.FOG_COLOR);
  scene.fog = new THREE.FogExp2(CONFIG.RENDER.FOG_COLOR, CONFIG.RENDER.FOG_DENSITY);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 180);
  camera.rotation.order = 'YXZ';

  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  app.prepend(renderer.domElement);

  input = new Input(renderer.domElement);
  input.onPointerLockChange((isLocked) => {
    if (state.is(GAME_STATES.PLAYING) && !isLocked) {
      showMessage('CLICK TO REFOCUS');
    }
  });

  playerController = new Controller(camera, input, collides);

  scene.add(new THREE.HemisphereLight(0xe8dfb7, 0x3d3524, 1.15));

  const totalWidth = CONFIG.WORLD.GRID_WIDTH * CONFIG.WORLD.CELL_SIZE;
  const totalHeight = CONFIG.WORLD.GRID_HEIGHT * CONFIG.WORLD.CELL_SIZE;

  // Floor & Ceiling
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, totalHeight), carpetMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(totalWidth, totalHeight), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CONFIG.WORLD.WALL_HEIGHT;
  scene.add(ceiling);

  // Build Walls from Map
  const map = mazeData.map;
  for (let z = 0; z < CONFIG.WORLD.GRID_HEIGHT; z++) {
    for (let x = 0; x < CONFIG.WORLD.GRID_WIDTH; x++) {
      if (map[z][x] === 1) continue;
      const p = mazeGen.cellToWorld(x, z);

      if (z === 0 || map[z - 1][x] === 1) addWall(x, z - 0.5, false);
      if (z === CONFIG.WORLD.GRID_HEIGHT - 1 || map[z + 1][x] === 1) addWall(x, z + 0.5, false);
      if (x === 0 || map[z][x - 1] === 1) addWall(x - 0.5, z, true);
      if (x === CONFIG.WORLD.GRID_WIDTH - 1 || map[z][x + 1] === 1) addWall(x + 0.5, z, true);

      // Light Fixtures
      if (Math.random() < CONFIG.WORLD.LIGHT_FIXTURE_CHANCE) {
        const fixture = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 0.12, 0.55),
          new THREE.MeshBasicMaterial({ color: 0xfff2c3 })
        );
        fixture.position.set(p.x, CONFIG.WORLD.WALL_HEIGHT - 0.12, p.z);
        scene.add(fixture);

        const light = new THREE.PointLight(0xffe7a6, Math.random() < 0.12 ? 0.7 : 1.35, 13, 1.8);
        light.position.set(p.x, CONFIG.WORLD.WALL_HEIGHT - 0.35, p.z);
        scene.add(light);
        lights.push({ light, base: light.intensity, phase: Math.random() * 10 });
      }
    }
  }

  // Set Player Spawn at Entrance (1, 1)
  const spawnPos = mazeGen.cellToWorld(1, 1);
  playerController.setSpawn(spawnPos);

  createPickups(mazeData.keys);
  createExit(mazeData.exit);

  // Initialize Dynamic Creature & AI
  createMonster(mazeData);
  createFlashlight();

  // Initialize Psychological Hallucination System
  hallucinationDirector = new HallucinationDirector(scene, audio, mazeGen, prng);

  // Setup FearDirector environmental listeners
  fearDirector.onFlickerCascade = () => {
    for (let i = 0; i < 4; i++) {
      const l = lights[Math.floor(Math.random() * lights.length)];
      if (l) l.light.intensity = 0.05;
    }
    // Occasional brief electrical silence drops fluorescent hum only
    if (Math.random() < 0.35 && audio.triggerElectricalSilence) {
      audio.triggerElectricalSilence(3.5);
    }
  };

  fearDirector.onPhantomSound = () => {
    // High fear triggers phantom footsteps right behind player
    if (fearModel.getTier() === 'severe') {
      hallucinationDirector.triggerPhantomFootstepsBehind(playerController.position, camera.quaternion);
    } else {
      audio.playTone(55 + prng.range(-8, 8), 0.9, 'sine', 0.08);
      showMessage('...A STRANGE SOUND ECHOES', 1800);
    }
  };

  fearDirector.onDisturbanceLure = (hotSpot) => {
    if (creatureAI && creatureAI.state === 'patrol') {
      creatureAI.patrolDestination = mazeGen.cellToWorld(hotSpot.x, hotSpot.z);
    }
    // Moderate fear triggers peripheral shadow silhouette
    if (fearModel.getTier() !== 'low') {
      hallucinationDirector.spawnPeripheralShadow(playerController.position, camera.quaternion);
    }
  };

  window.addEventListener('resize', () => {
    if (camera && renderer) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  });
}

function createPickups(keysCoords) {
  for (const coord of keysCoords) {
    const p = mazeGen.cellToWorld(coord.x, coord.z);
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.28, 0.055, 8, 20),
      new THREE.MeshStandardMaterial({
        color: 0xe3c76b,
        emissive: 0x80621e,
        emissiveIntensity: 1.2,
        metalness: 0.7,
      })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    group.position.set(p.x, 0.85, p.z);
    scene.add(group);

    const glow = new THREE.PointLight(0xd7ad4e, 0.8, 3);
    glow.position.copy(group.position);
    scene.add(glow);

    pickups.push({ group, x: p.x, z: p.z, glow, taken: false });
  }
}

function createExit(exitCoord) {
  const p = mazeGen.cellToWorld(exitCoord.x, exitCoord.z);
  exitMesh = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 3, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x26251d, roughness: 0.8 })
  );
  const portal = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 2.5),
    new THREE.MeshBasicMaterial({ color: 0x14231d })
  );
  portal.position.z = 0.14;
  exitMesh.add(frame, portal);
  exitMesh.position.set(p.x, 1.5, p.z);
  scene.add(exitMesh);

  const glow = new THREE.PointLight(0x69bd8c, 1.3, 8);
  glow.position.set(p.x, 2, p.z);
  scene.add(glow);
}

function createMonster(mazeData) {
  monster = new Monster(scene);
  creatureAI = new CreatureAI(monster, mazeGen, fearDirector, prng);

  // Dynamic spawn location evaluation via SpawnDirector
  const playerSpawnCell = { x: 1, z: 1 };
  const spawnCell = spawnDirector.selectSpawnPosition(
    playerSpawnCell,
    mazeData.exit,
    mazeData.keys
  );

  creatureAI.init(spawnCell);
}

function createFlashlight() {
  flashlightSpot = new THREE.SpotLight(
    0xfff3cf,
    CONFIG.FLASHLIGHT.INTENSITY,
    CONFIG.FLASHLIGHT.DISTANCE,
    CONFIG.FLASHLIGHT.ANGLE,
    CONFIG.FLASHLIGHT.PENUMBRA,
    CONFIG.FLASHLIGHT.DECAY
  );

  flashlightTarget = new THREE.Object3D();
  scene.add(flashlightTarget);
  flashlightSpot.target = flashlightTarget;

  flashlightPoint = new THREE.PointLight(0xfff3cf, 0.4, 4);

  camera.add(flashlightSpot);
  camera.add(flashlightPoint);
  scene.add(camera);
}

function updateFlashlight() {
  if (!flashlightSpot || !flashlightTarget) return;

  const forward = new THREE.Vector3(0, 0, -1);
  forward.applyQuaternion(camera.quaternion);

  flashlightTarget.position.copy(camera.position).addScaledVector(forward, 5.0);
  flashlightTarget.updateMatrixWorld();

  const targetIntensity = flashlightOn ? CONFIG.FLASHLIGHT.INTENSITY : 0;
  flashlightSpot.intensity = targetIntensity;
  flashlightPoint.intensity = flashlightOn ? 0.4 : 0;
}

function jumpscare() {
  state.set(GAME_STATES.JUMPSCARE);
  scareCooldown = 99;
  input.exitPointerLock();
  scare.classList.remove('hidden');

  if (voiceMimic) {
    voiceMimic.playRoar();
  }

  audio.playNoise(0.8, 0.65);
  audio.playTone(42, 0.9, 'sawtooth', 0.6);
  audio.playTone(880, 0.35, 'square', 0.2);

  setTimeout(() => {
    state.set(GAME_STATES.DEAD);
    scare.classList.add('hidden');
    end.classList.remove('hidden');
    document.querySelector('#endTitle').textContent = 'IT FOUND YOU';
    document.querySelector('#endCopy').textContent = 'The buzzing never stops.';
  }, 1050);
}

function checkPickups() {
  const pPos = playerController.position;
  for (const p of pickups) {
    if (!p.taken && Math.hypot(pPos.x - p.x, pPos.z - p.z) < 1.35) {
      p.taken = true;
      p.group.visible = false;
      p.glow.visible = false;
      keysCollected++;
      keyCountEl.textContent = keysCollected;

      // Relief reduces psychological fear gradually over 10 seconds
      fearModel.applyRelief(10.0);

      audio.playTone(660, 0.16, 'sine', 0.18);
      audio.playTone(880, 0.22, 'sine', 0.12);
      showMessage('KEY ACQUIRED');
    }
  }

  if (Math.hypot(pPos.x - exitMesh.position.x, pPos.z - exitMesh.position.z) < 2.2) {
    if (keysCollected === 3) {
      state.set(GAME_STATES.ESCAPED);
      input.exitPointerLock();
      end.classList.remove('hidden');
      document.querySelector('#endTitle').textContent = 'YOU ESCAPED';
      document.querySelector('#endCopy').textContent = 'For now.';
      audio.playTone(440, 0.5);
      audio.playTone(660, 0.8);
    } else {
      showMessage(`THE EXIT IS LOCKED · ${3 - keysCollected} KEY(S) REMAIN`);
    }
  }
}

function fixedUpdate(dt) {
  if (!state.is(GAME_STATES.PLAYING)) return;

  // 1. Update Player Controller
  playerController.update(dt);
  const pPos = playerController.position;
  const pCell = mazeGen.worldToCell(pPos.x, pPos.z);

  // 2. Flashlight target orientation tracking
  updateFlashlight();

  // 3. Record presence in FearDirector heatmap
  fearDirector.recordPlayerPresence(
    pCell,
    playerController.isSprinting,
    playerController.isCrouching,
    dt
  );

  // 4. Update Fear Director & Continuous Fear Model
  const currentDist = monster ? monster.position.distanceTo(pPos) : 99;
  const isMonsterHunting = creatureAI ? creatureAI.state === 'hunt' : false;
  fearModel.update(dt, currentDist, flashlightOn, isMonsterHunting);
  fearDirector.update(dt, pPos, monster ? monster.position : null, currentDist);

  // 5. Compute Wall Occlusion Count Between Player and Monster
  let wallCount = 0;
  if (monster) {
    wallCount = occlusionRaycaster.countInterveningWalls(pPos, monster.position);
  }

  // 6. Update Creature AI & Sensory System
  if (creatureAI) {
    creatureAI.update(
      dt,
      pPos,
      playerController.getNoiseRadius(),
      flashlightOn,
      jumpscare
    );
  }

  // 7. Update VoiceMimic Spatial Audio Foley
  if (voiceMimic && creatureAI) {
    voiceMimic.update(dt, creatureAI.state, creatureAI.currentSpeed, wallCount);
  }

  // 8. Update Hallucination Director (Phantom footsteps, dissolving shadows)
  if (hallucinationDirector) {
    hallucinationDirector.update(dt, pPos, camera.quaternion);
  }

  // 9. Pickups check
  checkPickups();
}

function render(delta, alpha) {
  if (!renderer || state.is(GAME_STATES.TITLE)) return;

  // Ceiling Light flicker
  for (const l of lights) {
    l.phase += delta;
    const flicker = Math.random() < 0.004 ? Math.random() * 0.2 : 1;
    l.light.intensity = l.base * flicker * (0.96 + 0.04 * Math.sin(l.phase * 2.1));
  }

  // Pickup bobbing
  for (const p of pickups) {
    if (!p.taken) {
      p.group.rotation.y += delta * 0.9;
      p.group.position.y = 0.85 + Math.sin(performance.now() * 0.002) * 0.08;
    }
  }

  // Dynamic audio tension driven by continuous Fear Model
  audio.setHumIntensity(fearModel.value);

  // Message expiry
  if (performance.now() > lastMessageTime) {
    msg.textContent = '';
  }

  renderer.render(scene, camera);
}

// Global Key Listeners for Flashlight (KeyF)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF' && state.is(GAME_STATES.PLAYING)) {
    flashlightOn = !flashlightOn;
    audio.playTone(flashlightOn ? 440 : 180, 0.08, 'square', 0.06);
    showMessage(flashlightOn ? 'FLASHLIGHT ON' : 'FLASHLIGHT OFF', 1200);
  }
});

async function startGameSequence() {
  const setStage = (label, pct) => {
    startBtn.textContent = `${label} (${pct}%)`;
    console.log(`[Startup] ${label} - ${pct}%`);
  };

  try {
    // Stage 1: World & Maze Init
    setStage('LOADING WORLD', 15);
    const tStart = performance.now();
    if (!renderer) {
      createWorld();
    }
    console.log(`[Startup] World created in ${(performance.now() - tStart).toFixed(1)}ms`);

    // Stage 2: Audio Context & Procedural Buses
    setStage('INITIALIZING AUDIO', 35);
    const tAudio = performance.now();
    await audio.init(camera);
    voiceMimic = new VoiceMimic(monster, audio);
    console.log(`[Startup] Audio initialized in ${(performance.now() - tAudio).toFixed(1)}ms`);

    // Stage 3: Loading Creature Skeletal Model
    setStage('LOADING CREATURE', 55);
    const tMonster = performance.now();
    await monster.load('/preview/Creep.fbx', 'tex', (progress) => {
      const p = Math.round(55 + progress * 20);
      setStage('LOADING CREATURE', p);
    });
    console.log(`[Startup] Monster loaded in ${(performance.now() - tMonster).toFixed(1)}ms`);

    // Stage 4: Compiling Shaders & Textures
    setStage('COMPILING SHADERS', 85);
    const tShaders = performance.now();
    await monster.prewarm(renderer, camera);
    console.log(`[Startup] Shaders compiled in ${(performance.now() - tShaders).toFixed(1)}ms`);

    // Stage 5: Preparing Environment & Launching
    setStage('PREPARING ENVIRONMENT', 100);
    await new Promise((r) => setTimeout(r, 80));

    // Launch game
    intro.classList.add('hidden');
    hud.classList.remove('hidden');
    state.set(GAME_STATES.PLAYING);
    input.requestPointerLock();

    loop = new Loop({
      onFixedUpdate: fixedUpdate,
      onRender: render,
      fixedStep: 1 / 60,
    });
    loop.start();
    console.log(`[Startup] Game launched successfully in ${(performance.now() - tStart).toFixed(1)}ms total.`);
  } catch (err) {
    console.error('[Startup] Failed at startup stage:', err);
    startBtn.textContent = `RETRY: ${err.message || 'FAILED'}`;
    startBtn.style.pointerEvents = 'auto';
    startBtn.style.backgroundColor = '#6d2b2b';
  }
}

startBtn.addEventListener('click', () => {
  startBtn.style.pointerEvents = 'none';
  startBtn.style.backgroundColor = '';
  startGameSequence();
});

restartBtn.addEventListener('click', () => {
  location.reload();
});
