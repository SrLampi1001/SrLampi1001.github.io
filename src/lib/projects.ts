// Data access for the discovered project portfolio.
//
// All Astro pages import from here so the same queries are reused.
// The shape of Project mirrors the schema fields we currently render;
// step 7 will replace this with generated types from
// json-schema-to-typescript.

import projects from '../data/projects.json';
import errors from '../data/errors.json';

export interface ProjectMeta {
  repo: string;
  path: string;
  branch: string;
  url: string;
  html_url: string;
  parent_path: string | null;
}

export interface DeploymentEntry {
  type: string;
  url?: string;
  active?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  type: string;
  categories?: string[];
  tags?: string[];
  status?: string;
  tech_stack?: Record<string, string[]>;
  repository: {
    provider: string;
    owner: string;
    name: string;
    branch?: string;
  };
  documentation?: any;
  presentation?: {
    featured?: boolean;
    order?: number;
    thumbnail?: string;
  };
  components?: Record<string, boolean>;
  deployment?: Record<string, DeploymentEntry>;
  demo?: {
    enabled: boolean;
    type: string;
    runtime?: string;
    entrypoint?: string;
    inputs?: string[];
  };
  created_at?: string;
  _meta?: ProjectMeta;
}

export interface DiscoveryError {
  repo: string;
  path?: string;
  branch?: string;
  stage: string;
  detail?: string | string[];
}

export const allProjects: Project[] = (projects as Project[]) ?? [];
export const allErrors: DiscoveryError[] = (errors as DiscoveryError[]) ?? [];

export function findProjectById(id: string): Project | undefined {
  return allProjects.find((p) => p.id === id);
}

export function projectsByCategory(category: string): Project[] {
  return allProjects.filter((p) => p.categories?.includes(category));
}

export function projectsByTag(tag: string): Project[] {
  return allProjects.filter((p) => p.tags?.includes(tag));
}

export function distinctCategories(): string[] {
  return Array.from(new Set(allProjects.flatMap((p) => p.categories ?? []))).sort();
}

export function distinctTags(): string[] {
  return Array.from(new Set(allProjects.flatMap((p) => p.tags ?? []))).sort();
}

export interface CategoryFacet {
  name: string;
  count: number;
}

export function categoryFacets(): CategoryFacet[] {
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

export function tagFacets(): CategoryFacet[] {
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
export function relatedProjects(project: Project, limit = 3): Project[] {
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
export function projectsByCollection(): { collection: Project; children: Project[] }[] {
  const collections = allProjects
    .filter((p) => p.type === 'collection')
    .sort((a, b) => (a._meta?.parent_path ?? '').localeCompare(b._meta?.parent_path ?? ''));

  return collections
    .filter((c) => c._meta?.parent_path !== null) // skip the root
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

export function findRootCollection(): Project | undefined {
  return allProjects.find((p) => p._meta?.parent_path === null);
}