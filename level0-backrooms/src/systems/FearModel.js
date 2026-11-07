export class FearModel {
  constructor() {
    this.value = 0.0; // 0.0 to 1.0

    // Rates
    this.decayRate = 0.018; // Under steady light with flashlight ON
    this.darknessRate = 0.025; // Flashlight OFF
    this.proximityRate = 0.045; // When monster is within 12m
    this.extremeProximityRate = 0.09; // When monster is within 6m

    // Gradual Contextual Relief
    this.reliefTimeRemaining = 0;
    this.reliefDecaySpeed = 0.035;
  }

  update(dt, currentDistance, isFlashlightOn, isMonsterHunting) {
    let delta = 0;

    // 1. Proximity Stress
    if (currentDistance < 6) {
      delta += this.extremeProximityRate;
    } else if (currentDistance < 12) {
      delta += this.proximityRate;
    }

    // 2. Darkness Stress
    if (!isFlashlightOn) {
      delta += this.darknessRate;
    } else {
      delta -= this.decayRate;
    }

    // 3. Hunt Shock
    if (isMonsterHunting) {
      delta += 0.06;
    }

    // 4. Gradual Contextual Relief (decay over time when safe)
    if (this.reliefTimeRemaining > 0) {
      this.reliefTimeRemaining -= dt;
      // If monster is far (> 10m), accelerate relief decay
      const safetyFactor = currentDistance > 10 ? 1.5 : 0.5;
      delta -= this.reliefDecaySpeed * safetyFactor;
    }

    this.value = Math.max(0, Math.min(1.0, this.value + delta * dt));
  }

  applyRelief(duration = 10.0) {
    // Replaces instant fear drops with contextual, gradual relief
    this.reliefTimeRemaining = Math.max(this.reliefTimeRemaining, duration);
  }

  getTier() {
    if (this.value < 0.35) return 'low';
    if (this.value < 0.70) return 'moderate';
    return 'severe';
  }
}

