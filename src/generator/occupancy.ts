/** Square occupancy grid backed by a typed array: cell index → owning arrow index (-1 = empty). */
export class OccupancyGrid {
  readonly size: number;
  private owner: Int32Array;
  private empty: number;

  constructor(size: number) {
    this.size = size;
    this.owner = new Int32Array(size * size).fill(-1);
    this.empty = size * size;
  }

  index(x: number, y: number): number {
    return y * this.size + x;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  isFree(x: number, y: number): boolean {
    return this.owner[this.index(x, y)] === -1;
  }

  ownerAt(x: number, y: number): number {
    return this.owner[this.index(x, y)];
  }

  set(x: number, y: number, arrow: number): void {
    const i = this.index(x, y);
    if (this.owner[i] === -1) this.empty--;
    this.owner[i] = arrow;
  }

  get freeCount(): number {
    return this.empty;
  }
}
