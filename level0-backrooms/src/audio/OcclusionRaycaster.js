export class OcclusionRaycaster {
  constructor(mazeGen) {
    this.mazeGen = mazeGen;
  }

  // Count intervening solid wall grid cells between two world-space coordinates
  countInterveningWalls(posA, posB) {
    const cA = this.mazeGen.worldToCell(posA.x, posA.z);
    const cB = this.mazeGen.worldToCell(posB.x, posB.z);

    // Fast Bresenham ray traversal through the 2D logical maze grid
    let x0 = cA.x;
    let z0 = cA.z;
    const x1 = cB.x;
    const z1 = cB.z;

    const dx = Math.abs(x1 - x0);
    const dz = Math.abs(z1 - z0);
    const sx = x0 < x1 ? 1 : -1;
    const sz = z0 < z1 ? 1 : -1;
    let err = dx - dz;

    let wallCount = 0;

    while (true) {
      // Don't count endpoints
      if (!(x0 === cA.x && z0 === cA.z) && !(x0 === cB.x && z0 === cB.z)) {
        if (!this.mazeGen.isOpen(x0, z0)) {
          wallCount++;
        }
      }

      if (x0 === x1 && z0 === z1) break;

      const e2 = 2 * err;
      if (e2 > -dz) {
        err -= dz;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        z0 += sz;
      }
    }

    return wallCount;
  }
}

