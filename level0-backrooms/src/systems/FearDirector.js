import { PRNG } from '../world/PRNG.js';

export class FearDirector {
  constructor(mazeGen, audioSystem, prng = null) {
    this.mazeGen = mazeGen;
    this.audio = audioSystem;
    this.prng = prng || new PRNG();

    // Accumulated presence tension in corridors
    this.tension = 0;
    this.cooldown = 0;

    // Heatmap of player activity across grid cells (cell key -> { heat, lastUpdated })
    this.activityHeatmap = new Map();

    // Decay rate per second: 12% decay per second
    this.decayRate = 0.12;

    // Environmental event callbacks
    this.onFlickerCascade = null;
    this.onPhantomSound = null;
    this.onDisturbanceLure = null;
  }

  recordPlayerPresence(playerCell, isSprinting, isCrouching, dt) {
    const key = `${playerCell.x},${playerCell.z}`;
    const now = performance.now() / 1000;

    let cellData = this.activityHeatmap.get(key) || { heat: 0, lastUpdated: now };

    // Strict time-based exponential decay
    const elapsed = now - cellData.lastUpdated;
    cellData.heat = Math.max(0, cellData.heat * Math.exp(-this.decayRate * elapsed));
    cellData.lastUpdated = now;

    // Heat radiation rate
    let heatRate = 1.2;
    if (isSprinting) heatRate = 5.0; // Sprinting leaves heavy sonic reverberations
    else if (isCrouching) heatRate = 0.2; // Crouching leaves very faint disturbance

    cellData.heat += heatRate * dt;
    this.activityHeatmap.set(key, cellData);

    // Passive decay for all inactive cells
    for (const [k, data] of this.activityHeatmap.entries()) {
      if (k !== key) {
        const timeDiff = now - data.lastUpdated;
        data.heat = Math.max(0, data.heat * Math.exp(-this.decayRate * timeDiff));
        data.lastUpdated = now;
        if (data.heat < 0.1) {
          this.activityHeatmap.delete(k);
        }
      }
    }
  }

  // Get the most active cell territory currently drawing the predator's curiosity
  getHottestTerritory(excludeCell = null) {
    let maxHeat = 0;
    let hottest = null;

    for (const [key, data] of this.activityHeatmap.entries()) {
      const [x, z] = key.split(',').map(Number);
      if (excludeCell && excludeCell.x === x && excludeCell.z === z) continue;
      if (data.heat > maxHeat) {
        maxHeat = data.heat;
        hottest = { x, z, heat: data.heat };
      }
    }

    return hottest;
  }

  update(dt, playerPos, monsterPos, currentDistance) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.tension += dt * 0.5;

    // Stochastic environmental events
    if (this.cooldown === 0 && this.tension > 18) {
      this.tension = 0;
      this.cooldown = this.prng.range(22, 45); // enforce rest cooldown

      const roll = this.prng.random();

      if (roll < 0.40) {
        // Event 1: Phantom distant footsteps
        if (this.onPhantomSound) this.onPhantomSound();
        if (this.audio) this.audio.playTone(55 + this.prng.range(-8, 8), 0.9, 'sine', 0.08);
      } else if (roll < 0.75) {
        // Event 2: Local fluorescent drop or flicker surge
        if (this.onFlickerCascade) this.onFlickerCascade();
      } else {
        // Event 3: Structural settling / disturbance lure
        const hot = this.getHottestTerritory();
        if (hot && this.onDisturbanceLure) {
          this.onDisturbanceLure(hot);
        }
      }
    }
  }
}
