import type { Rng } from './rng';

export interface DependencyEdge {
  blocker: string;
  blocked: string;
}

export interface DependencyGraph {
  nodes: string[];
  /** Topological order = intended solution order (first escapes first). */
  solutionOrder: string[];
  edges: DependencyEdge[];
}

/**
 * Build a dependency DAG with branching that scales with difficulty.
 * Always includes a spanning chain so a solution order exists.
 */
export function generateDependencyGraph(
  rng: Rng,
  arrowIds: string[],
  options: { branchChance: number; maxParents: number },
): DependencyGraph {
  const nodes = arrowIds.slice();
  const edges: DependencyEdge[] = [];

  if (nodes.length === 0) {
    return { nodes, solutionOrder: [], edges };
  }

  // Spanning chain: A → B → C → ... guarantees reverse construction works.
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({ blocker: nodes[i], blocked: nodes[i + 1] });
  }

  // Extra cross edges for branching (earlier blocker → later blocked).
  for (let i = 2; i < nodes.length; i++) {
    if (!rng.chance(options.branchChance)) continue;
    const parentCount = 1 + rng.int(Math.min(options.maxParents, i));
    const candidates = rng.shuffle(nodes.slice(0, i));
    for (let p = 0; p < parentCount; p++) {
      const blocker = candidates[p];
      if (!blocker) break;
      if (edges.some((e) => e.blocker === blocker && e.blocked === nodes[i])) continue;
      // Skip if already direct chain predecessor.
      if (blocker === nodes[i - 1]) continue;
      edges.push({ blocker, blocked: nodes[i] });
    }
  }

  return {
    nodes,
    solutionOrder: nodes.slice(),
    edges,
  };
}

export function blockersOf(graph: DependencyGraph, blockedId: string): string[] {
  return graph.edges.filter((e) => e.blocked === blockedId).map((e) => e.blocker);
}

export function blockedBy(graph: DependencyGraph, blockerId: string): string[] {
  return graph.edges.filter((e) => e.blocker === blockerId).map((e) => e.blocked);
}
