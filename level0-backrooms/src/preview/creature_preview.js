import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const container = document.querySelector('#canvas-container');
const loadingEl = document.querySelector('#loading');
const lodSelect = document.querySelector('#lodSelect');
const skinSelect = document.querySelector('#skinSelect');
const animSelect = document.querySelector('#animSelect');
const toggleWireframeBtn = document.querySelector('#toggleWireframe');
const resetCamBtn = document.querySelector('#resetCam');

const triCountEl = document.querySelector('#triCount');
const boneCountEl = document.querySelector('#boneCount');
const meshCountEl = document.querySelector('#meshCount');

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1814);
scene.fog = new THREE.FogExp2(0x1a1814, 0.015);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.5, 6.0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.2, 0);

// Robust Multi-Angle Studio Lighting
const ambientLight = new THREE.AmbientLight(0xfff6e6, 1.4);
scene.add(ambientLight);

const mainKeyLight = new THREE.DirectionalLight(0xfffaed, 2.8);
mainKeyLight.position.set(4, 6, 5);
scene.add(mainKeyLight);

const fillLight = new THREE.DirectionalLight(0xb5c9d6, 1.8);
fillLight.position.set(-4, 3, -3);
scene.add(fillLight);

const bottomLight = new THREE.DirectionalLight(0x736142, 1.0);
bottomLight.position.set(0, -3, 2);
scene.add(bottomLight);

// Liminal floor grid
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x242017, roughness: 0.85 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0;
scene.add(floor);

const gridHelper = new THREE.GridHelper(30, 30, 0x6e6144, 0x3d3525);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

// Loaders & State
const fbxLoader = new FBXLoader();
const textureLoader = new THREE.TextureLoader();

let currentModel = null;
let mixer = null;
let animations = [];
let activeAction = null;
let isWireframe = false;
let clock = new THREE.Clock();

const textureCache = new Map();

function getTexture(path, isColor = false) {
  if (!textureCache.has(path)) {
    const tex = textureLoader.load(
      path,
      undefined,
      undefined,
      (err) => console.warn(`Texture load warning for ${path}:`, err)
    );
    if (isColor) {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    textureCache.set(path, tex);
  }
  return textureCache.get(path);
}

function applySkin(model, skinFolder) {
  const baseColor = getTexture(`/preview/${skinFolder}/Creep_BaseColor.png`, true);
  const normalMap = getTexture(`/preview/${skinFolder}/Creep_Normal_OpenGL.png`, false);
  const roughnessMap = getTexture(`/preview/${skinFolder}/Creep_Roughness.png`, false);

  model.traverse((child) => {
    if (child.isMesh) {
      // Ensure uv2 exists if ambient occlusion is used, or share uv
      if (child.geometry && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
        child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
      }

      child.material = new THREE.MeshStandardMaterial({
        map: baseColor,
        normalMap: normalMap,
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughnessMap: roughnessMap,
        roughness: 0.9,
        metalness: 0.05,
        wireframe: isWireframe,
        side: THREE.DoubleSide, // Prevent missing faces if normals are flipped
      });
      child.material.needsUpdate = true;
    }
  });
}

function loadModel(fbxPath, skinFolder) {
  loadingEl.style.display = 'block';
  loadingEl.textContent = 'LOADING FBX CREATURE...';

  if (currentModel) {
    scene.remove(currentModel);
    if (mixer) mixer.stopAllAction();
    currentModel = null;
  }

  fbxLoader.load(
    fbxPath,
    (fbx) => {
      console.log('FBX loaded successfully:', fbx);
      currentModel = fbx;

      // 1. Calculate raw geometry bounding box
      let rawBbox = new THREE.Box3().setFromObject(fbx);
      let size = rawBbox.getSize(new THREE.Vector3());
      let center = rawBbox.getCenter(new THREE.Vector3());
      console.log('Raw FBX Bounding Box Size:', size, 'Center:', center);

      // 2. Adjust scale based on size
      if (size.y > 50) {
        // Modeled in cm (e.g. 200cm tall) -> convert to meters
        fbx.scale.setScalar(0.01);
      } else if (size.y < 0.1) {
        fbx.scale.setScalar(10.0);
      } else {
        fbx.scale.setScalar(1.0);
      }

      // 3. Center model so feet touch y = 0
      const scaledBbox = new THREE.Box3().setFromObject(fbx);
      const scaledCenter = scaledBbox.getCenter(new THREE.Vector3());
      fbx.position.x = -scaledCenter.x;
      fbx.position.z = -scaledCenter.z;
      fbx.position.y = -scaledBbox.min.y;

      // 4. Update camera and orbit controls target to frame creature comfortably
      const finalBbox = new THREE.Box3().setFromObject(fbx);
      const finalSize = finalBbox.getSize(new THREE.Vector3());
      const finalCenter = finalBbox.getCenter(new THREE.Vector3());
      controls.target.copy(finalCenter);
      camera.position.set(finalCenter.x, finalCenter.y + finalSize.y * 0.4, finalCenter.z + finalSize.y * 2.2);
      controls.update();

      // 5. Apply materials
      applySkin(fbx, skinFolder);
      scene.add(fbx);

      // 6. Animation Setup
      mixer = new THREE.AnimationMixer(fbx);
      animations = fbx.animations || [];
      console.log(`Loaded ${animations.length} animation clips`);
      populateAnimSelect();

      // 7. Stats
      let triCount = 0;
      let boneCount = 0;
      let meshCount = 0;

      fbx.traverse((child) => {
        if (child.isMesh) {
          meshCount++;
          if (child.geometry) {
            triCount += child.geometry.index
              ? child.geometry.index.count / 3
              : child.geometry.attributes.position.count / 3;
          }
        }
        if (child.isBone) {
          boneCount++;
        }
      });

      triCountEl.textContent = triCount.toLocaleString();
      boneCountEl.textContent = boneCount.toString();
      meshCountEl.textContent = meshCount.toString();

      loadingEl.style.display = 'none';
    },
    (xhr) => {
      if (xhr.total) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        loadingEl.textContent = `LOADING FBX: ${pct}%`;
      }
    },
    (err) => {
      console.error('FBX Load Error:', err);
      loadingEl.textContent = `ERROR LOADING FBX: ${err.message || 'Check Console'}`;
    }
  );
}

function populateAnimSelect() {
  animSelect.innerHTML = '';
  if (animations.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No Clips in File';
    animSelect.appendChild(opt);
    return;
  }

  animations.forEach((clip, idx) => {
    const opt = document.createElement('option');
    opt.value = idx.toString();
    opt.textContent = `${clip.name} (${clip.duration.toFixed(2)}s)`;
    animSelect.appendChild(opt);
  });

  // Default to Idle or Walk clip
  let defaultIdx = 0;
  const idleIdx = animations.findIndex((c) => c.name.toLowerCase().includes('idle'));
  const walkIdx = animations.findIndex((c) => c.name.toLowerCase().includes('walk'));
  if (idleIdx !== -1) defaultIdx = idleIdx;
  else if (walkIdx !== -1) defaultIdx = walkIdx;

  animSelect.value = defaultIdx.toString();
  playClip(defaultIdx);
}

function playClip(index) {
  if (!mixer || !animations[index]) return;
  const clip = animations[index];

  if (activeAction) {
    activeAction.fadeOut(0.25);
  }

  const action = mixer.clipAction(clip);
  action.reset().fadeIn(0.25).play();
  activeAction = action;
}

// UI Listeners
lodSelect.addEventListener('change', (e) => {
  loadModel(e.target.value, skinSelect.value);
});

skinSelect.addEventListener('change', (e) => {
  if (currentModel) {
    applySkin(currentModel, e.target.value);
  }
});

animSelect.addEventListener('change', (e) => {
  playClip(parseInt(e.target.value, 10));
});

toggleWireframeBtn.addEventListener('click', () => {
  isWireframe = !isWireframe;
  if (currentModel) {
    currentModel.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = isWireframe;
      }
    });
  }
});

resetCamBtn.addEventListener('click', () => {
  if (currentModel) {
    const bbox = new THREE.Box3().setFromObject(currentModel);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    controls.target.copy(center);
    camera.position.set(center.x, center.y + size.y * 0.4, center.z + size.y * 2.2);
    controls.update();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render Loop
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (mixer) mixer.update(dt);
  controls.update();
  renderer.render(scene, camera);
}

// Initial Load
loadModel(lodSelect.value, skinSelect.value);
animate();
