import { PRNG } from '../world/PRNG.js';

export class SpawnDirector {
  constructor(mazeGen, seed = null) {
    this.mazeGen = mazeGen;
    this.prng = new PRNG(seed !== null ? seed : Math.floor(Math.random() * 1000000));
  }

  setSeed(seed) {
    this.prng.setSeed(seed);
  }

  // BFS flood fill calculating shortest path distances from a start grid cell
  getDistances(startCell) {
    const distMap = new Map();
    const queue = [[startCell.x, startCell.z, 0]];
    distMap.set(`${startCell.x},${startCell.z}`, 0);

    while (queue.length > 0) {
      const [x, z, d] = queue.shift();
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        const key = `${nx},${nz}`;
        if (this.mazeGen.isOpen(nx, nz) && !distMap.has(key)) {
          distMap.set(key, d + 1);
          queue.push([nx, nz, d + 1]);
        }
      }
    }
    return distMap;
  }

  // Check line-of-sight on 2D grid between two cells
  hasLineOfSight(x0, z0, x1, z1) {
    if (x0 === x1) {
      const minZ = Math.min(z0, z1);
      const maxZ = Math.max(z0, z1);
      for (let z = minZ; z <= maxZ; z++) {
        if (!this.mazeGen.isOpen(x0, z)) return false;
      }
      return true;
    }
    if (z0 === z1) {
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      for (let x = minX; x <= maxX; x++) {
        if (!this.mazeGen.isOpen(x, z0)) return false;
      }
      return true;
    }
    // Diagonal or non-straight corridor sight lines are blocked by Backrooms walls
    return false;
  }

  selectSpawnPosition(playerSpawn, exitCell, keysList, previousSpawn = null) {
    const playerDistances = this.getDistances(playerSpawn);
    const exitDistances = this.getDistances(exitCell);

    const candidates = [];

    for (let z = 1; z < this.mazeGen.height - 1; z++) {
      for (let x = 1; x < this.mazeGen.width - 1; x++) {
        if (!this.mazeGen.isOpen(x, z)) continue;

        const pDist = playerDistances.get(`${x},${z}`) || 0;
        const eDist = exitDistances.get(`${x},${z}`) || 0;

        // 1. Exclude player spawn and immediate zone (must be >= 8 cells away topological path)
        if (pDist < 8) continue;

        // 2. Exclude cells with direct unobstructed line of sight to player spawn
        if (this.hasLineOfSight(x, z, playerSpawn.x, playerSpawn.z)) continue;

        // 3. Exclude key cells and immediate 1-cell radius
        let nearKey = false;
        for (const k of keysList) {
          if (Math.hypot(x - k.x, z - k.z) <= 1.5) {
            nearKey = true;
            break;
          }
        }
        if (nearKey) continue;

        // 4. Exclude exit cell and immediate surroundings (distance < 2)
        if (eDist < 2) continue;

        // 5. Penalize previous spawn to avoid repetitive starts across runs
        let score = pDist * 1.5 + eDist * 0.5;
        if (previousSpawn && previousSpawn.x === x && previousSpawn.z === z) {
          score -= 20;
        }

        candidates.push({ x, z, score, pDist, eDist });
      }
    }

    if (candidates.length === 0) {
      console.warn('[SpawnDirector] No strict candidate found, falling back to farthest cell.');
      return { x: this.mazeGen.width - 2, z: 1 };
    }

    // Shuffle and pick from top candidates
    this.prng.shuffle(candidates);
    candidates.sort((a, b) => b.score - a.score);

    // Pick among the top 35% suitable candidate locations
    const topN = Math.max(1, Math.floor(candidates.length * 0.35));
    const selected = candidates[this.prng.rangeInt(0, topN - 1)];

    console.log(
      `[SpawnDirector] Entity spawned at (${selected.x}, ${selected.z}) [topological dist to player: ${selected.pDist} cells, to exit: ${selected.eDist} cells]`
    );

    return { x: selected.x, z: selected.z };
  }
}

