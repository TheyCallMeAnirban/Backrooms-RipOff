import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class CreatureAI {
  constructor(monster, mazeGen, fearDirector, prng) {
    this.monster = monster;
    this.mazeGen = mazeGen;
    this.fearDirector = fearDirector;
    this.prng = prng;

    // 6 States: Dormant, Patrol, Stalk, Hunt, Search, Kill
    this.state = 'dormant';
    this.stateTimer = 0;

    // Navigation targets in world space
    this.currentWaypoint = null;
    this.patrolDestination = null;
    this.lastKnownPlayerPosition = null;

    // Movement speeds & kinematics
    this.currentSpeed = 0;

    // Sight & sensory memory
    this.timeSinceLastSeen = 999;
    this.searchTimer = 0;
  }

  init(spawnCell) {
    const worldP = this.mazeGen.cellToWorld(spawnCell.x, spawnCell.z);
    this.monster.position.copy(worldP);
    this.monster.position.y = 0;
    this.monster.visible = true;

    this.state = 'dormant';
    this.stateTimer = this.prng.range(6, 14); // Stays dormant for 6-14s initially
    this.monster.setState('idle');

    this._pickNewPatrolDestination();
  }

  _pickNewPatrolDestination() {
    // 1. Check if FearDirector heatmap has a player activity territory to investigate
    const hotSpot = this.fearDirector.getHottestTerritory();
    if (hotSpot && this.prng.random() < 0.65) {
      this.patrolDestination = this.mazeGen.cellToWorld(hotSpot.x, hotSpot.z);
      return;
    }

    // 2. Otherwise pick an open reachable cell in another sector
    const candidates = [];
    for (let z = 1; z < this.mazeGen.height - 1; z++) {
      for (let x = 1; x < this.mazeGen.width - 1; x++) {
        if (this.mazeGen.isOpen(x, z)) {
          candidates.push({ x, z });
        }
      }
    }

    if (candidates.length > 0) {
      const chosen = this.prng.choice(candidates);
      this.patrolDestination = this.mazeGen.cellToWorld(chosen.x, chosen.z);
    }
  }

  // BFS pathfinding to compute the next corridor node to step toward
  _getNextStep(fromPos, toPos) {
    const sc = this.mazeGen.worldToCell(fromPos.x, fromPos.z);
    const tc = this.mazeGen.worldToCell(toPos.x, toPos.z);

    const q = [[sc.x, sc.z]];
    const seen = new Set([`${sc.x},${sc.z}`]);
    const prev = new Map();

    while (q.length > 0) {
      const [x, z] = q.shift();
      if (x === tc.x && z === tc.z) break;

      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        const k = `${nx},${nz}`;
        if (this.mazeGen.isOpen(nx, nz) && !seen.has(k)) {
          seen.add(k);
          prev.set(k, [x, z]);
          q.push([nx, nz]);
        }
      }
    }

    let cur = [tc.x, tc.z];
    let k = `${tc.x},${tc.z}`;
    if (!prev.has(k) && !(sc.x === tc.x && sc.z === tc.z)) {
      return this.mazeGen.cellToWorld(sc.x, sc.z);
    }

    while (prev.has(k)) {
      const p = prev.get(k);
      if (p[0] === sc.x && p[1] === sc.z) break;
      cur = p;
      k = `${cur[0]},${cur[1]}`;
    }
    return this.mazeGen.cellToWorld(cur[0], cur[1]);
  }

  // Check 2D corridor line of sight
  _hasCorridorLOS(posA, posB) {
    const cA = this.mazeGen.worldToCell(posA.x, posA.z);
    const cB = this.mazeGen.worldToCell(posB.x, posB.z);

    if (cA.x === cB.x) {
      const minZ = Math.min(cA.z, cB.z);
      const maxZ = Math.max(cA.z, cB.z);
      for (let z = minZ; z <= maxZ; z++) {
        if (!this.mazeGen.isOpen(cA.x, z)) return false;
      }
      return true;
    }
    if (cA.z === cB.z) {
      const minX = Math.min(cA.x, cB.x);
      const maxX = Math.max(cA.x, cB.x);
      for (let x = minX; x <= maxX; x++) {
        if (!this.mazeGen.isOpen(x, cA.z)) return false;
      }
      return true;
    }
    return false;
  }

  // Sensory Perception Check (Hearing & Vision)
  checkPerception(playerPos, playerNoiseRadius, isFlashlightOn) {
    const dist = this.monster.position.distanceTo(playerPos);
    const hasLOS = this._hasCorridorLOS(this.monster.position, playerPos);

    let canSee = false;
    let canHear = false;

    // Vision: in lit hallways or if player shines flashlight
    const visionRange = isFlashlightOn ? 28 : 16;
    if (hasLOS && dist < visionRange) {
      canSee = true;
      this.timeSinceLastSeen = 0;
      this.lastKnownPlayerPosition = playerPos.clone();
    }

    // Hearing: footstep sound radius
    if (dist < playerNoiseRadius) {
      canHear = true;
      this.lastKnownPlayerPosition = playerPos.clone();
    }

    return { canSee, canHear, dist, hasLOS };
  }

  update(dt, playerPos, playerNoiseRadius, isFlashlightOn, onJumpscare) {
    this.timeSinceLastSeen += dt;
    this.stateTimer -= dt;

    const { canSee, canHear, dist } = this.checkPerception(
      playerPos,
      playerNoiseRadius,
      isFlashlightOn
    );

    let targetSpeed = CONFIG.MONSTER.SPEED_PATROL;
    let navTarget = null;

    // === 6-STATE FINITE STATE MACHINE ===
    switch (this.state) {
      case 'dormant':
        targetSpeed = 0;
        this.monster.setState('idle');
        if (canSee || canHear || this.stateTimer <= 0) {
          this.state = 'patrol';
          this.monster.setState('stalk');
          this._pickNewPatrolDestination();
        }
        break;

      case 'patrol':
        targetSpeed = CONFIG.MONSTER.SPEED_PATROL;
        this.monster.setState('stalk');

        if (canSee && dist < 18) {
          this.state = 'stalk';
        } else if (canHear && dist < 12) {
          this.state = 'stalk';
        }

        if (!this.patrolDestination || this.monster.position.distanceTo(this.patrolDestination) < 1.5) {
          this._pickNewPatrolDestination();
        }
        navTarget = this.patrolDestination;
        break;

      case 'stalk':
        targetSpeed = CONFIG.MONSTER.SPEED_STALK;
        this.monster.setState('stalk');

        // Escalate to Hunt if in close range or observed
        if (canSee && dist < 11) {
          this.state = 'hunt';
        } else if (dist < 7) {
          this.state = 'hunt';
        }

        if (this.lastKnownPlayerPosition) {
          navTarget = this.lastKnownPlayerPosition;
        } else {
          this.state = 'patrol';
        }
        break;

      case 'hunt':
        targetSpeed = CONFIG.MONSTER.SPEED_HUNT;
        this.monster.setState('hunt');

        // Direct pursuit
        if (canSee) {
          navTarget = playerPos;
        } else if (this.lastKnownPlayerPosition) {
          navTarget = this.lastKnownPlayerPosition;
          // Lost visual contact for > 3.2 seconds -> Search
          if (this.timeSinceLastSeen > 3.2) {
            this.state = 'search';
            this.searchTimer = 6.0;
            this.monster.setState('sniff');
          }
        }

        // Fatal attack proximity
        if (dist < 2.5) {
          this.state = 'kill';
          this.monster.setState('bite');
          if (onJumpscare) onJumpscare();
        }
        break;

      case 'search':
        targetSpeed = 0.8;
        this.monster.setState('sniff');
        this.searchTimer -= dt;

        if (canSee || (canHear && dist < 9)) {
          this.state = 'hunt';
        } else if (this.searchTimer <= 0) {
          this.state = 'patrol';
          this._pickNewPatrolDestination();
        }
        break;

      case 'kill':
        targetSpeed = 0;
        break;
    }

    // === ACCELERATION & GAIT MATCHING ===
    this.currentSpeed = THREE.MathUtils.damp(
      this.currentSpeed,
      targetSpeed,
      CONFIG.MONSTER.ACCELERATION_HUNT,
      dt
    );

    // === PHYSICAL NAVIGATION (NO TELEPORTATION) ===
    if (navTarget && this.currentSpeed > 0.05) {
      const step = this._getNextStep(this.monster.position, navTarget);
      const mDir = step.clone().sub(this.monster.position);
      mDir.y = 0;

      if (mDir.length() > 0.1) {
        mDir.normalize();
        this.monster.position.addScaledVector(mDir, this.currentSpeed * dt);
        this.monster.rotation.y = Math.atan2(mDir.x, mDir.z);
      }
    }

    // Keep model animations updated
    this.monster.update(dt);
  }
}

