import { cellKey, getEscapeSweep } from '../game/geometry';
import type { Level } from '../game/types';

export interface DependencyEdge {
  blocker: string;
  blocked: string;
}

export interface DependencyGraph {
  nodes: string[];
  edges: DependencyEdge[];
}

/** `blocker` occupies a cell in the escape ray of `blocked`, so it has to leave first. */
export function buildDependencyGraph(level: Level): DependencyGraph {
  const owner = new Map<string, string>();
  for (const arrow of level.arrows) {
    for (const cell of arrow.path) owner.set(cellKey(cell), arrow.id);
  }

  const edges: DependencyEdge[] = [];
  for (const arrow of level.arrows) {
    const seen = new Set<string>();
    for (const cell of getEscapeSweep(arrow, level.gridSize)) {
      const blocker = owner.get(cellKey(cell));
      if (!blocker || blocker === arrow.id || seen.has(blocker)) continue;
      seen.add(blocker);
      edges.push({ blocker, blocked: arrow.id });
    }
  }

  return { nodes: level.arrows.map((a) => a.id), edges };
}

/**
 * Number of rounds needed when every free arrow is removed each round
 * (the solution depth). Returns null when the graph has a cycle.
 */
export function dependencyLayers(graph: DependencyGraph): number | null {
  const indegree = new Map<string, number>(graph.nodes.map((n) => [n, 0]));
  const next = new Map<string, string[]>(graph.nodes.map((n) => [n, []]));
  for (const { blocker, blocked } of graph.edges) {
    indegree.set(blocked, (indegree.get(blocked) ?? 0) + 1);
    next.get(blocker)?.push(blocked);
  }

  let frontier = graph.nodes.filter((n) => indegree.get(n) === 0);
  let layers = 0;
  let removed = 0;

  while (frontier.length > 0) {
    layers++;
    removed += frontier.length;
    const following: string[] = [];
    for (const node of frontier) {
      for (const blocked of next.get(node) ?? []) {
        const left = (indegree.get(blocked) ?? 0) - 1;
        indegree.set(blocked, left);
        if (left === 0) following.push(blocked);
      }
    }
    frontier = following;
  }

  return removed === graph.nodes.length ? layers : null;
}
