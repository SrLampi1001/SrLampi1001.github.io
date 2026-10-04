// Data access for the discovered project portfolio.
//
// The Project shape comes from the JSON Schema (auto-generated into
// src/lib/types/project.ts). The discoverer adds a _meta block at
// runtime that this module exposes via the DiscoveredProject type.

import projectsJson from '../data/projects.json';
import errorsJson from '../data/errors.json';
import type {
  PortfolioProject,
  Status,
  ProjectType,
  DeploymentEntry,
} from './types/project';

// Re-export so pages can import from a single module.
export type { PortfolioProject, Status, ProjectType, DeploymentEntry };

/**
 * Runtime metadata added by scripts/discover-projects.mjs after
 * validation. Not in the schema because it's derived (it's the
 * provenance of where this entry came from).
 */
export interface ProjectMeta {
  repo: string;
  path: string;
  branch: string;
  url: string;
  html_url: string;
  parent_path: string | null;
}

/** A project as known at runtime: schema fields + discoverer metadata. */
export type DiscoveredProject = PortfolioProject & {
  _meta: ProjectMeta;
};

export interface DiscoveryError {
  repo: string;
  path?: string;
  branch?: string;
  stage: string;
  detail?: string | string[];
}

export const allProjects: DiscoveredProject[] = (projectsJson as DiscoveredProject[]) ?? [];
export const allErrors: DiscoveryError[] = (errorsJson as DiscoveryError[]) ?? [];

export function findProjectById(id: string): DiscoveredProject | undefined {
  return allProjects.find((p) => p.id === id);
}

export function projectsByCategory(category: string): DiscoveredProject[] {
  return allProjects.filter((p) => p.categories?.includes(category));
}

export function projectsByTag(tag: string): DiscoveredProject[] {
  return allProjects.filter((p) => p.tags?.includes(tag));
}

export function distinctCategories(): string[] {
  return Array.from(new Set(allProjects.flatMap((p) => p.categories ?? []))).sort();
}

export function distinctTags(): string[] {
  return Array.from(new Set(allProjects.flatMap((p) => p.tags ?? []))).sort();
}

export interface Facet {
  name: string;
  count: number;
}

export function categoryFacets(): Facet[] {
  const counts = new Map<string, number>();
  for (const p of allProjects) {
    for (const c of p.categories ?? []) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function tagFacets(): Facet[] {
  const counts = new Map<string, number>();
  for (const p of allProjects) {
    for (const t of p.tags ?? []) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Find projects related to the given one by shared categories and tags.
 * Categories count double, tags single. Returns the top N (default 3).
 */
export function relatedProjects(project: DiscoveredProject, limit = 3): DiscoveredProject[] {
  const others = allProjects.filter((p) => p.id !== project.id);
  const projectCategories = new Set(project.categories ?? []);
  const projectTags = new Set(project.tags ?? []);

  const scored = others
    .map((p) => {
      const sharedCategories = (p.categories ?? []).filter((c) => projectCategories.has(c)).length;
      const sharedTags = (p.tags ?? []).filter((t) => projectTags.has(t)).length;
      return { p, score: sharedCategories * 2 + sharedTags };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name));

  return scored.slice(0, limit).map((s) => s.p);
}

/**
 * Group all projects by their parent collection (path-prefix match).
 * Returns an array of { collection, children } suitable for rendering.
 */
export function projectsByCollection(): { collection: DiscoveredProject; children: DiscoveredProject[] }[] {
  const collections = allProjects
    .filter((p) => p.type === 'collection')
    .sort((a, b) => (a._meta?.parent_path ?? '').localeCompare(b._meta?.parent_path ?? ''));

  return collections
    .filter((c) => c._meta?.parent_path !== null)
    .map((c) => {
      const dir = c._meta?.parent_path ?? '';
      const children = allProjects.filter((p) => {
        if (p === c) return false;
        const pParent = p._meta?.parent_path ?? '';
        return pParent.startsWith(dir + '/');
      });
      return { collection: c, children };
    });
}

export function findRootCollection(): DiscoveredProject | undefined {
  return allProjects.find((p) => p._meta?.parent_path === null);
}