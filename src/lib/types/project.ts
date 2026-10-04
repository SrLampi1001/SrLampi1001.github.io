/**
 * AUTO-GENERATED from schema/project.schema.json by
 * scripts/generate-types.mjs -- do not edit by hand.
 *
 * Runtime schema validation is still performed by ajv at build time;
 * this file gives you compile-time type safety for the same shape.
 */

/**
 * URL-safe kebab-case identifier used in /projects/<id>/.
 *
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Id".
 */
export type Id = string;
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "ProjectType".
 */
export type ProjectType =
  | 'frontend'
  | 'backend'
  | 'application'
  | 'fundamentals'
  | 'collection'
  | 'script'
  | 'library'
  | 'experiment'
  | 'tool'
  | 'tutorial'
  | 'docs'
  | 'documentation'
  | 'static-site'
  | 'cli'
  | 'automation'
  | 'api'
  | 'web-app';
/**
 * Lowercase kebab-case string used for categories, tags, etc.
 *
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Slug".
 */
export type Slug = string;
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Status".
 */
export type Status =
  | 'active'
  | 'maintained'
  | 'archived'
  | 'experimental'
  | 'completed'
  | 'wip'
  | 'incomplete'
  | 'in-progress'
  | 'in progress';
/**
 * A free-form technology name. Acceptable in any of the tech_stack.* slots.
 *
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "LanguageString".
 */
export type LanguageString = string;
/**
 * This interface was referenced by `Deployment`'s JSON-Schema definition
 * via the `patternProperty` "^[a-z][a-z0-9-]*$".
 *
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "DeploymentEntry".
 */
export type DeploymentEntry = DeploymentEntry1 & {
  type: DeploymentType;
  url?: string;
  /**
   * Whether this deployment is currently live.
   */
  active?: boolean;
};
export type DeploymentEntry1 =
  | {
      type?: 'github-pages';
    }
  | {
      type?: {
        [k: string]: unknown;
      };
    };
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "DeploymentType".
 */
export type DeploymentType =
  'github-pages' | 'cloudflare-pages' | 'cloudflare-worker' | 'vercel' | 'render' | 'static-site' | 'other';
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "DemoType".
 */
export type DemoType = 'none' | 'webpage' | 'api' | 'python' | 'terminal' | 'documentation';
/**
 * Per-project documentation references. The 'folders' key is the canonical name; 'documentation-folder' is accepted as a legacy alias used by some early projects.
 *
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Documentation".
 */
export type Documentation = Documentation1 & {
  readme?: boolean | string;
  architecture?: {
    path: string;
  };
  api?: {
    path: string;
  };
  folders?: DocumentationFolder[];
  /**
   * Legacy alias for 'folders'. Prefer 'folders' in new projects.
   */
  'documentation-folder'?: DocumentationFolder[];
};
export type Documentation1 = {
  [k: string]: unknown;
};

/**
 * Metadata contract for projects indexed by SrLampi1001.github.io. Step 3 schema — absorbs the five divergences surfaced by the smoke test (see docs/STEP-3-RESULT.md).
 */
export interface PortfolioProject {
  id: Id;
  name: string;
  description: string;
  type: ProjectType;
  components?: Components;
  /**
   * Free-form strings. Casing is not enforced; both 'Frontend' and 'frontend' are acceptable. See docs/02-project-yml-contract.md §9.
   *
   * @minItems 1
   */
  categories: [string, ...string[]];
  tags: Slug[];
  status?: Status;
  /**
   * ISO 8601 date (YYYY-MM-DD). When omitted, the portfolio falls back to the GitHub repository creation date.
   */
  created_at?: string;
  tech_stack: TechStack;
  repository: Repository;
  deployment?: Deployment;
  demo?: Demo;
  documentation?: Documentation;
  presentation?: Presentation;
}
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Components".
 */
export interface Components {
  frontend?: boolean;
  backend?: boolean;
  database?: boolean;
  cli?: boolean;
  wasm?: boolean;
}
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "TechStack".
 */
export interface TechStack {
  languages?: LanguageString[];
  frameworks?: LanguageString[];
  libraries?: LanguageString[];
  databases?: LanguageString[];
  infrastructure?: LanguageString[];
  ai?: LanguageString[];
  tools?: LanguageString[];
}
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Repository".
 */
export interface Repository {
  provider: 'github';
  owner: string;
  name: string;
  branch?: string;
}
/**
 * Map of deployment slot name (frontend, backend, docusaurus, …) to a DeploymentEntry. The slot name is a free-form kebab-case label; the value describes the deployment.
 *
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Deployment".
 */
export interface Deployment {
  frontend?: DeploymentEntry;
  backend?: DeploymentEntry;
  [k: string]: DeploymentEntry | undefined;
}
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Demo".
 */
export interface Demo {
  enabled: boolean;
  type: DemoType;
  runtime?: string;
  entrypoint?: string;
  inputs?: string[];
}
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "DocumentationFolder".
 */
export interface DocumentationFolder {
  path: string;
}
/**
 * This interface was referenced by `PortfolioProject`'s JSON-Schema
 * via the `definition` "Presentation".
 */
export interface Presentation {
  featured?: boolean;
  order?: number;
  thumbnail?: string;
}

