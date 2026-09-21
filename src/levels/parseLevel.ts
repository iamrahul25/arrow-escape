import { arrowFromWaypoints } from '../game/geometry';
import type { Level, LevelJson } from '../game/types';

/**
 * Convert a JSON level (waypoint-authored) into the runtime Level model.
 */
export function parseLevel(json: LevelJson): Level {
  if (!Number.isInteger(json.gridSize) || json.gridSize < 2) {
    throw new Error(`Invalid gridSize: ${json.gridSize}`);
  }
  if (!Array.isArray(json.arrows) || json.arrows.length === 0) {
    throw new Error(`Level ${json.id}: must have at least one arrow`);
  }

  return {
    id: json.id,
    name: json.name,
    gridSize: json.gridSize,
    hintQuota: json.hintQuota,
    arrows: json.arrows.map((a) => {
      if (!a.id || !Array.isArray(a.waypoints) || a.waypoints.length < 2) {
        throw new Error(
          `Level ${json.id} arrow ${a.id ?? '?'}: waypoints need at least 2 cells`,
        );
      }
      return arrowFromWaypoints(a.id, a.waypoints);
    }),
  };
}
