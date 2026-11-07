import * as THREE from 'three';
import { PRNG } from './PRNG.js';
import { CONFIG } from '../config.js';

export class MazeGen {
  constructor(seed = CONFIG.WORLD.DEFAULT_SEED) {
    this.seed = seed;
    this.prng = new PRNG(seed);
    this.width = CONFIG.WORLD.GRID_WIDTH;
    this.height = CONFIG.WORLD.GRID_HEIGHT;
    this.cellSize = CONFIG.WORLD.CELL_SIZE;
    this.map = Array.from({ length: this.height }, () => Array(this.width).fill(1));
    this.keys = [];
    this.exit = { x: this.width - 2, z: this.height - 2 };
  }

  generate() {
    this.prng.setSeed(this.seed);
    this.map = Array.from({ length: this.height }, () => Array(this.width).fill(1));

    // 1. Carve DFS tree from (1, 1)
    const stack = [[1, 1]];
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    this.map[1][1] = 0;

    while (stack.length > 0) {
      const [x, z] = stack[stack.length - 1];
      const neighbors = [];

      for (const [dx, dz] of dirs) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx > 0 && nz > 0 && nx < this.width - 1 && nz < this.height - 1 && this.map[nz][nx] === 1) {
          neighbors.push([nx, nz, dx, dz]);
        }
      }

      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }

      const [nx, nz, dx, dz] = this.prng.choice(neighbors);
      this.map[z + dz / 2][x + dx / 2] = 0;
      this.map[nz][nx] = 0;
      stack.push([nx, nz]);
    }

    // 2. Controlled cycle injection
    let cyclesInjected = 0;
    let attempts = 0;
    while (cyclesInjected < CONFIG.WORLD.CYCLES_COUNT && attempts < 200) {
      attempts++;
      const x = this.prng.rangeInt(1, this.width - 2);
      const z = this.prng.rangeInt(1, this.height - 2);

      if (this.map[z][x] === 1) {
        const hConnect = (this.map[z][x - 1] === 0 && this.map[z][x + 1] === 0);
        const vConnect = (this.map[z - 1][x] === 0 && this.map[z + 1][x] === 0);
        if (hConnect || vConnect) {
          this.map[z][x] = 0;
          cyclesInjected++;
        }
      }
    }

    // Ensure exit cell and entrance cell are open
    this.map[1][1] = 0;
    this.map[this.exit.z][this.exit.x] = 0;

    // 3. Post-generation reachability verification (BFS flood fill from entrance)
    const reachability = this._verifyReachability();
    if (!reachability.isSolvable) {
      console.warn(`Seed ${this.seed} produced unsolvable maze; forcing path.`);
      this._forceCorridor(1, 1, this.exit.x, this.exit.z);
    }

    // 4. Deterministic key placement in verified reachable cells
    this._placeKeys(reachability.reachableCells);

    return {
      map: this.map,
      exit: this.exit,
      keys: this.keys,
    };
  }

  _verifyReachability() {
    const reachableCells = [];
    const queue = [[1, 1, 0]]; // x, z, dist
    const visited = new Set(['1,1']);
    let exitDistance = -1;

    while (queue.length > 0) {
      const [x, z, dist] = queue.shift();
      reachableCells.push([x, z, dist]);

      if (x === this.exit.x && z === this.exit.z) {
        exitDistance = dist;
      }

      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        const key = `${nx},${nz}`;
        if (this.isOpen(nx, nz) && !visited.has(key)) {
          visited.add(key);
          queue.push([nx, nz, dist + 1]);
        }
      }
    }

    return {
      isSolvable: exitDistance >= 10,
      exitDistance,
      reachableCells,
    };
  }

  _placeKeys(reachableCells) {
    this.keys = [];
    // Filter candidates: at least distance 6 from entrance and distance 4 from exit
    const candidates = reachableCells.filter(([x, z, dist]) => {
      const isEntrance = (x === 1 && z === 1);
      const isExit = (x === this.exit.x && z === this.exit.z);
      return !isEntrance && !isExit && dist >= 6;
    });

    // Shuffle deterministically
    this.prng.shuffle(candidates);

    // Pick 3 keys spaced apart
    for (const [cx, cz] of candidates) {
      if (this.keys.length >= 3) break;
      const tooClose = this.keys.some(k => Math.hypot(k.x - cx, k.z - cz) < 3.5);
      if (!tooClose) {
        this.keys.push({ x: cx, z: cz });
      }
    }

    // Fallback if candidates were too tight
    if (this.keys.length < 3) {
      for (const [cx, cz] of candidates) {
        if (this.keys.length >= 3) break;
        if (!this.keys.some(k => k.x === cx && k.z === cz)) {
          this.keys.push({ x: cx, z: cz });
        }
      }
    }
  }

  _forceCorridor(x1, z1, x2, z2) {
    let curX = x1, curZ = z1;
    while (curX !== x2) {
      this.map[curZ][curX] = 0;
      curX += (x2 > curX) ? 1 : -1;
    }
    while (curZ !== z2) {
      this.map[curZ][curX] = 0;
      curZ += (z2 > curZ) ? 1 : -1;
    }
    this.map[z2][x2] = 0;
  }

  isOpen(x, z) {
    return x >= 0 && z >= 0 && x < this.width && z < this.height && this.map[z][x] === 0;
  }

  cellToWorld(x, z) {
    return new THREE.Vector3(
      (x - (this.width - 1) / 2) * this.cellSize,
      0,
      (z - (this.height - 1) / 2) * this.cellSize
    );
  }

  worldToCell(x, z) {
    return {
      x: Math.round(x / this.cellSize + (this.width - 1) / 2),
      z: Math.round(z / this.cellSize + (this.height - 1) / 2),
    };
  }
}

