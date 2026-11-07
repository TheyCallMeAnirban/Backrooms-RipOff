import * as THREE from 'three';

export class HallucinationDirector {
  constructor(scene, spatialAudioSystem, mazeGen, prng) {
    this.scene = scene;
    this.audioSystem = spatialAudioSystem;
    this.mazeGen = mazeGen;
    this.prng = prng;

    // Peripheral shadow billboard mesh
    this.shadowMesh = null;
    this.shadowActive = false;
    this.shadowLife = 0;

    // Phantom footstep sequence state
    this.phantomSequence = null;

    this._createShadowMesh();
  }

  _createShadowMesh() {
    const geo = new THREE.PlaneGeometry(0.75, 2.1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x050504,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.shadowMesh = new THREE.Mesh(geo, mat);
    this.shadowMesh.visible = false;
    this.scene.add(this.shadowMesh);
  }

  // Trigger phantom footsteps right behind player's current view
  triggerPhantomFootstepsBehind(playerPos, cameraQuaternion) {
    if (this.phantomSequence) return;

    // Direction directly behind camera
    const back = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraQuaternion);
    back.y = 0;
    back.normalize();

    const startPos = playerPos.clone().addScaledVector(back, 6.0);

    this.phantomSequence = {
      pos: startPos,
      dir: back.clone().negate(), // approaches toward player
      stepsRemaining: 4,
      stepInterval: 0.38,
      stepTimer: 0,
      initialCameraYaw: this._extractYaw(cameraQuaternion),
      // Randomize turn behavior:
      // 'rush': sudden rapid footsteps flanking past the player to adjacent corridor
      // 'pause': steps freeze in place right behind the player, lingering ominously
      // 'evaporate': quick exponential fade
      turnReaction: null,
      turnReactionTriggered: false,
    };
  }

  // Spawn brief peripheral shadow silhouette at corner of vision
  spawnPeripheralShadow(playerPos, cameraQuaternion) {
    if (this.shadowActive) return;

    // Calculate position at 70 degrees peripheral angle
    const side = Math.random() < 0.5 ? 1 : -1;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternion);
    forward.y = 0;
    right.y = 0;

    const angleVector = forward
      .clone()
      .multiplyScalar(Math.cos((70 * Math.PI) / 180))
      .add(right.clone().multiplyScalar(Math.sin((70 * Math.PI) / 180) * side))
      .normalize();

    const spawnPos = playerPos.clone().addScaledVector(angleVector, 5.5);
    spawnPos.y = 1.05;

    this.shadowMesh.position.copy(spawnPos);
    this.shadowMesh.quaternion.copy(cameraQuaternion);
    this.shadowMesh.visible = true;
    this.shadowMesh.material.opacity = 0.75;
    this.shadowActive = true;
    this.shadowLife = 1.4; // Dissolves quickly
  }

  _extractYaw(quaternion) {
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'YXZ');
    return euler.y;
  }

  update(dt, playerPos, cameraQuaternion) {
    // 1. Process Phantom Footsteps
    if (this.phantomSequence) {
      const currentYaw = this._extractYaw(cameraQuaternion);
      const yawDelta = Math.abs(currentYaw - this.phantomSequence.initialCameraYaw);

      // Player turned around (> 45 degrees / ~0.8 rads)
      if (yawDelta > 0.8 && !this.phantomSequence.turnReactionTriggered) {
        this.phantomSequence.turnReactionTriggered = true;
        const r = this.prng ? this.prng.random() : Math.random();
        if (r < 0.35) {
          // Behavior A: Rapid flank / rush past the player
          this.phantomSequence.turnReaction = 'rush';
          this.phantomSequence.stepInterval = 0.14; // rapid sprint
          this.phantomSequence.stepsRemaining = 3;
          // Flank laterally
          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraQuaternion);
          right.y = 0;
          right.normalize();
          this.phantomSequence.dir = right.multiplyScalar(r < 0.175 ? 1 : -1);
        } else if (r < 0.70) {
          // Behavior B: Abrupt pause - footsteps freeze right behind the player
          this.phantomSequence.turnReaction = 'pause';
          this.phantomSequence.stepsRemaining = 0;
          this.phantomSequence = null;
        } else {
          // Behavior C: Evaporate / fade
          this.phantomSequence.turnReaction = 'evaporate';
          this.phantomSequence = null;
        }
      }

      if (this.phantomSequence) {
        this.phantomSequence.stepTimer -= dt;
        if (this.phantomSequence.stepTimer <= 0) {
          this.phantomSequence.stepTimer = this.phantomSequence.stepInterval;
          this.phantomSequence.pos.addScaledVector(this.phantomSequence.dir, 0.9);

          const vol = this.phantomSequence.turnReaction === 'rush' ? 0.65 : 0.45;
          this.audioSystem.playOneShotAt('footstep_carpet', this.phantomSequence.pos, vol);

          this.phantomSequence.stepsRemaining--;
          if (this.phantomSequence.stepsRemaining <= 0) {
            this.phantomSequence = null;
          }
        }
      }
    }

    // 2. Process Peripheral Shadow
    if (this.shadowActive) {
      this.shadowLife -= dt;

      // Check if player looked directly at the shadow
      const toShadow = this.shadowMesh.position.clone().sub(playerPos).normalize();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion).normalize();
      const dot = forward.dot(toShadow);

      // Direct gaze (dot > 0.82) causes immediate evaporation
      if (dot > 0.82 || this.shadowLife <= 0) {
        this.shadowMesh.material.opacity -= dt * 4.0;
        if (this.shadowMesh.material.opacity <= 0) {
          this.shadowMesh.visible = false;
          this.shadowActive = false;
        }
      }
    }
  }
}

