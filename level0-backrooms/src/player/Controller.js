import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Stamina } from './Stamina.js';

export class Controller {
  constructor(camera, input, collidersCheck) {
    this.camera = camera;
    this.input = input;
    this.collidersCheck = collidersCheck;

    this.position = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = 0;

    this.stamina = new Stamina();

    // Locomotion state
    this.isCrouching = false;
    this.isSprinting = false;
    this.currentEyeHeight = CONFIG.PLAYER.EYE_HEIGHT_STAND;
    this.targetEyeHeight = CONFIG.PLAYER.EYE_HEIGHT_STAND;

    this.crouchToggle = false;
  }

  setSpawn(pos) {
    this.position.copy(pos);
    this.position.y = CONFIG.PLAYER.EYE_HEIGHT_STAND;
    this.currentEyeHeight = CONFIG.PLAYER.EYE_HEIGHT_STAND;
    this.targetEyeHeight = CONFIG.PLAYER.EYE_HEIGHT_STAND;
    this.yaw = Math.PI;
    this.pitch = 0;

    this.camera.position.copy(this.position);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  update(dt) {
    // 1. Mouse Look
    const { dx, dy } = this.input.consumeMouseDelta();
    this.yaw -= dx * CONFIG.PLAYER.MOUSE_SENSITIVITY;
    this.pitch -= dy * CONFIG.PLAYER.MOUSE_SENSITIVITY;
    this.pitch = Math.max(-CONFIG.PLAYER.MAX_PITCH, Math.min(CONFIG.PLAYER.MAX_PITCH, this.pitch));

    // 2. Crouch Check: KeyC or ControlLeft / ControlRight
    this.isCrouching = this.input.isDown('KeyC') || this.input.isDown('ControlLeft') || this.input.isDown('ControlRight');
    this.targetEyeHeight = this.isCrouching ? CONFIG.PLAYER.EYE_HEIGHT_CROUCH : CONFIG.PLAYER.EYE_HEIGHT_STAND;

    // Smooth camera height lerp (damped)
    this.currentEyeHeight = THREE.MathUtils.damp(this.currentEyeHeight, this.targetEyeHeight, 14, dt);

    // 3. Sprint & Movement Inputs
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const dir = new THREE.Vector3();

    if (this.input.isDown('KeyW')) dir.add(forward);
    if (this.input.isDown('KeyS')) dir.sub(forward);
    if (this.input.isDown('KeyD')) dir.add(right);
    if (this.input.isDown('KeyA')) dir.sub(right);

    const isMoving = dir.lengthSq() > 0;
    if (isMoving) dir.normalize();

    // Sprinting requires Shift, moving forward/strafing, stamina, and NOT crouching
    const sprintKey = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight');
    this.isSprinting = sprintKey && isMoving && !this.isCrouching && this.stamina.canSprint();

    // Update Stamina
    this.stamina.update(dt, this.isSprinting, isMoving, this.isCrouching);

    // Speed calculation
    let speed = CONFIG.PLAYER.WALK_SPEED;
    if (this.isCrouching) {
      speed = CONFIG.PLAYER.CROUCH_SPEED;
    } else if (this.isSprinting) {
      speed = CONFIG.PLAYER.SPRINT_SPEED;
    }

    // Swept step collision check with radius
    const nx = this.position.x + dir.x * speed * dt;
    const nz = this.position.z + dir.z * speed * dt;

    if (!this.collidersCheck(nx, this.position.z)) {
      this.position.x = nx;
    }
    if (!this.collidersCheck(this.position.x, nz)) {
      this.position.z = nz;
    }

    // Head bobbing (subtle when crouched, intense when sprinting)
    let bobSpeed = CONFIG.PLAYER.HEADBOB_SPEED_WALK;
    let bobAmp = CONFIG.PLAYER.HEADBOB_AMP_WALK;
    if (this.isCrouching) {
      bobSpeed = 0.006;
      bobAmp = 0.012;
    } else if (this.isSprinting) {
      bobSpeed = CONFIG.PLAYER.HEADBOB_SPEED_SPRINT;
      bobAmp = CONFIG.PLAYER.HEADBOB_AMP_SPRINT;
    }

    const bob = isMoving ? Math.sin(performance.now() * bobSpeed) * bobAmp : 0;

    // Apply to camera
    this.camera.position.set(this.position.x, this.currentEyeHeight + bob, this.position.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  // Get current noise emission radius in meters
  getNoiseRadius() {
    if (this.isCrouching) return 0.6; // Slight fabric rustle
    if (this.isSprinting) return 18.0;
    if (this.input.isDown('KeyW') || this.input.isDown('KeyS') || this.input.isDown('KeyA') || this.input.isDown('KeyD')) {
      return 5.5; // Walking footsteps
    }
    return 0.0; // Stationary
  }
}

