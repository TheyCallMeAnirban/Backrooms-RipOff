import { CONFIG } from '../config.js';

export class Stamina {
  constructor() {
    this.capacity = 100;
    this.current = this.capacity;
    this.isExhausted = false;
    this.exhaustionTimer = 0;

    // Rates per second
    this.drainRate = 20; // Sprint drain
    this.recoverRateWalk = 10;
    this.recoverRateCrouch = 12;
    this.recoverRateIdle = 15;
    this.exhaustionDuration = 3.5;
  }

  update(dt, isSprinting, isMoving, isCrouching) {
    if (this.isExhausted) {
      this.exhaustionTimer -= dt;
      if (this.exhaustionTimer <= 0) {
        this.isExhausted = false;
        this.exhaustionTimer = 0;
      }
      // Slow recovery during exhaustion
      this.current = Math.min(this.capacity, this.current + this.recoverRateWalk * 0.5 * dt);
      return;
    }

    if (isSprinting && isMoving && !isCrouching) {
      this.current = Math.max(0, this.current - this.drainRate * dt);
      if (this.current <= 0) {
        this.isExhausted = true;
        this.exhaustionTimer = this.exhaustionDuration;
      }
    } else {
      let recovery = this.recoverRateIdle;
      if (isCrouching) recovery = this.recoverRateCrouch;
      else if (isMoving) recovery = this.recoverRateWalk;

      this.current = Math.min(this.capacity, this.current + recovery * dt);
    }
  }

  canSprint() {
    return !this.isExhausted && this.current > 5;
  }

  getRatio() {
    return this.current / this.capacity;
  }
}

