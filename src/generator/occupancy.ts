import { cellKey } from '../game/geometry';
import type { ArrowDef, Cell } from '../game/types';

/** Fast occupancy grid: cell key → arrow id. */
export class OccupancyGrid {
  private map = new Map<string, string>();

  has(cell: Cell): boolean {
    return this.map.has(cellKey(cell));
  }

  get(cell: Cell): string | undefined {
    return this.map.get(cellKey(cell));
  }

  occupy(arrow: ArrowDef): void {
    for (const cell of arrow.path) {
      this.map.set(cellKey(cell), arrow.id);
    }
  }

  wouldOverlap(path: Cell[]): boolean {
    return path.some((c) => this.map.has(cellKey(c)));
  }

  clone(): OccupancyGrid {
    const g = new OccupancyGrid();
    for (const [k, v] of this.map) g.map.set(k, v);
    return g;
  }

  get size(): number {
    return this.map.size;
  }

  keys(): IterableIterator<string> {
    return this.map.keys();
  }
}
