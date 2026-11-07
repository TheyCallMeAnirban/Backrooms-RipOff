import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export class Monster {
  constructor(scene) {
    this.scene = scene;

    // Dedicated Monster Root Group for global position & rotation in the world
    this.root = new THREE.Group();
    this.root.name = 'MonsterRoot';
    this.scene.add(this.root);
    this.root.visible = false;

    // Inner mesh container for local centering and height offset
    this.modelContainer = new THREE.Group();
    this.modelContainer.name = 'ModelContainer';
    this.root.add(this.modelContainer);

    this.mixer = null;
    this.actions = new Map();
    this.currentAction = null;
    this.currentState = 'idle';

    this.isLoaded = false;
    this.loadError = null;

    this.fbxLoader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();

    // Cache textures for pre-initialization
    this.textures = [];

    // Final measured dimensions
    this.measuredDimensions = null;
  }

  get position() {
    return this.root.position;
  }

  get rotation() {
    return this.root.rotation;
  }

  get visible() {
    return this.root.visible;
  }

  set visible(val) {
    this.root.visible = val;
  }

  load(fbxPath = '/preview/Creep.fbx', skinFolder = 'tex', onProgress = null) {
    return new Promise((resolve, reject) => {
      let isTimedOut = false;
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        const err = new Error(`FBX load timed out after 25s: ${fbxPath}`);
        console.error('[Monster]', err);
        this.loadError = err;
        reject(err);
      }, 25000);

      this.fbxLoader.load(
        fbxPath,
        (fbx) => {
          if (isTimedOut) return;
          clearTimeout(timeoutId);
          try {
            this._setupMeshAndMaterials(fbx, skinFolder);
            this._setupScaleAndCentering(fbx);
            this._setupAnimations(fbx);

            this.modelContainer.add(fbx);
            this.isLoaded = true;
            console.log('[Monster] Creep 3D model loaded and normalized successfully.');
            resolve(this);
          } catch (err) {
            console.error('[Monster] Error configuring Creep model:', err);
            this.loadError = err;
            reject(err);
          }
        },
        (xhr) => {
          if (onProgress && xhr.total) {
            onProgress(xhr.loaded / xhr.total);
          }
        },
        (err) => {
          if (isTimedOut) return;
          clearTimeout(timeoutId);
          console.error('[Monster] Failed to load Creep FBX file:', err);
          this.loadError = err;
          reject(err);
        }
      );
    });
  }

  _setupMeshAndMaterials(fbx, skinFolder) {
    const baseColor = this.textureLoader.load(`/preview/${skinFolder}/Creep_BaseColor.png`);
    baseColor.colorSpace = THREE.SRGBColorSpace;
    baseColor.minFilter = THREE.LinearMipmapLinearFilter;
    baseColor.magFilter = THREE.LinearFilter;
    baseColor.generateMipmaps = true;

    const normalMap = this.textureLoader.load(`/preview/${skinFolder}/Creep_Normal_OpenGL.png`);
    normalMap.minFilter = THREE.LinearMipmapLinearFilter;
    normalMap.magFilter = THREE.LinearFilter;
    normalMap.generateMipmaps = true;

    const roughnessMap = this.textureLoader.load(`/preview/${skinFolder}/Creep_Roughness.png`);
    roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
    roughnessMap.magFilter = THREE.LinearFilter;
    roughnessMap.generateMipmaps = true;

    this.textures = [baseColor, normalMap, roughnessMap];

    fbx.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry && !child.geometry.attributes.uv2 && child.geometry.attributes.uv) {
          child.geometry.setAttribute('uv2', child.geometry.attributes.uv);
        }

        child.material = new THREE.MeshStandardMaterial({
          map: baseColor,
          normalMap: normalMap,
          normalScale: new THREE.Vector2(1.0, 1.0),
          roughnessMap: roughnessMap,
          roughness: 0.85,
          metalness: 0.05,
          side: THREE.DoubleSide,
        });
        child.material.needsUpdate = true;
      }
    });
  }

  _setupScaleAndCentering(fbx) {
    // 1. Measure raw geometry bounding box before any scaling
    const rawBbox = new THREE.Box3().setFromObject(fbx);
    const rawSize = rawBbox.getSize(new THREE.Vector3());
    console.log('[Monster] Raw FBX bounds:', rawSize);

    // Target standing height: exactly 2.10 metres
    const TARGET_HEIGHT = 2.10;
    const scaleFactor = TARGET_HEIGHT / rawSize.y;
    fbx.scale.setScalar(scaleFactor);

    // 2. Compute post-scale bounding box to ground feet precisely at Y = 0
    const scaledBbox = new THREE.Box3().setFromObject(fbx);
    const scaledCenter = scaledBbox.getCenter(new THREE.Vector3());
    const scaledSize = scaledBbox.getSize(new THREE.Vector3());

    // Center horizontally and ground vertically
    fbx.position.x = -scaledCenter.x;
    fbx.position.z = -scaledCenter.z;
    fbx.position.y = -scaledBbox.min.y;

    this.measuredDimensions = {
      width: scaledSize.x,
      height: scaledSize.y,
      depth: scaledSize.z,
      scaleFactor,
    };
    console.log('[Monster] Final normalized dimensions:', this.measuredDimensions);
  }

  _setupAnimations(fbx) {
    if (!fbx.animations || fbx.animations.length === 0) {
      console.warn('[Monster] No animation clips found in FBX.');
      return;
    }

    this.mixer = new THREE.AnimationMixer(fbx);

    for (const clip of fbx.animations) {
      const action = this.mixer.clipAction(clip);
      this.actions.set(clip.name, action);

      if (clip.name.includes('|')) {
        const shortName = clip.name.split('|')[1];
        this.actions.set(shortName, action);
      }
    }

    // Tune action playback speeds to match physical gait
    // Walk1 (Stalk): 1.4 m/s physical gait -> speed factor 1.1x
    const walk1 = this.actions.get('Walk1_Action');
    if (walk1) walk1.setEffectiveTimeScale(1.1);

    // Walk2 (Hunt): 6.4 m/s chase sprint -> speed factor 1.85x
    const walk2 = this.actions.get('Walk2_Action');
    if (walk2) walk2.setEffectiveTimeScale(1.85);

    // Default to Idle1_Action
    this.playAnimation('Idle1_Action', 0);
  }

  playAnimation(animKey, fadeDuration = 0.3) {
    if (!this.mixer) return;

    let action = this.actions.get(animKey);
    if (!action) {
      action = this.actions.get(`Creep|${animKey}`);
    }

    if (!action) {
      console.warn(`[Monster] Animation "${animKey}" not found.`);
      return;
    }

    if (this.currentAction === action) return;

    if (this.currentAction) {
      this.currentAction.fadeOut(fadeDuration);
    }

    action.reset();
    action.fadeIn(fadeDuration);
    action.play();
    this.currentAction = action;
  }

  setState(state) {
    if (this.currentState === state) return;
    this.currentState = state;

    switch (state) {
      case 'idle':
        this.playAnimation('Idle1_Action', 0.4);
        break;
      case 'stalk':
        this.playAnimation('Walk1_Action', 0.35);
        break;
      case 'hunt':
        this.playAnimation('Walk2_Action', 0.2);
        break;
      case 'sniff':
        this.playAnimation('Sniff_Action', 0.3);
        break;
      case 'bite':
      case 'attack':
        this.playAnimation('Bite_Action', 0.12);
        break;
      case 'death':
        this.playAnimation('Death_Action', 0.2);
        break;
      default:
        this.playAnimation('Idle1_Action', 0.3);
        break;
    }
  }

  // Pre-warm WebGL GPU textures and precompile shaders ahead of gameplay
  async prewarm(renderer, camera) {
    if (!renderer || !this.isLoaded) return;

    // 1. Initialize GPU textures
    for (const tex of this.textures) {
      if (tex && renderer.initTexture) {
        try {
          renderer.initTexture(tex);
        } catch (e) {
          console.warn('[Monster] initTexture warning:', e);
        }
      }
    }

    // 2. Precompile shaders asynchronously with safety timeout
    if (renderer.compileAsync) {
      const compilePromise = renderer.compileAsync(this.root, camera);
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 3500));
      await Promise.race([compilePromise, timeoutPromise]);
      console.log('[Monster] Creature shaders compilation step finished.');
    } else if (renderer.compile) {
      renderer.compile(this.root, camera);
    }
  }

  update(dt) {
    if (this.mixer) {
      this.mixer.update(dt);
    }
  }
}
