# 11 — Frontend Contract

> The UX contract: which entities the portfolio exposes to visitors, how
> those entities map to pages, what components render them, how navigation
> flows between them, and the design rules the visual layer must follow. >
> This document is **design-focused**, not implementation-focused. It
> describes what visitors see and how they interact with it. The Astro
> mechanics for producing those pages live in
> [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md); the metadata
> that feeds the pages is in
> [02 — The `project.yml` Contract](./02-project-yml-contract.md).

---

## Table of contents

1. [Design principles](#1-design-principles)
2. [Domain entities in UX terms](#2-domain-entities-in-ux-terms)
3. [Entity relationships](#3-entity-relationships)
4. [Information architecture (sitemap)](#4-information-architecture-sitemap)
5. [Page templates](#5-page-templates)
6. [Component inventory](#6-component-inventory)
7. [Navigation system](#7-navigation-system)
8. [Layouts and wireframes](#8-layouts-and-wireframes)
9. [Responsive behaviour](#9-responsive-behaviour)
10. [Interaction patterns](#10-interaction-patterns)
11. [Visual design tokens](#11-visual-design-tokens)
12. [Accessibility](#12-accessibility)
13. [Empty, loading and error states](#13-empty-loading-and-error-states)
14. [Search and filtering UX](#14-search-and-filtering-ux)
15. [Demo interaction UX](#15-demo-interaction-ux)
16. [Internationalisation (future)](#16-internationalisation-future)
17. [Open design questions](#17-open-design-questions)

---

## 1. Design principles  These principles are the **deciding criteria** for any design question that comes up later. When two options conflict, the option that better serves these principles wins.

### 1.1 The portfolio is a doorway, not a destination  Most visitors arrive here to **find** a project, then leave to **use** it. The portfolio's job is to get them to the right project page (or the right deployment URL) as quickly as possible. Anything that delays or distracts from that goal is a tax.

### 1.2 Content over chrome  The most important pixel is the one showing the project's name, what it does, and how to open it. Decorative imagery, animations and chrome must never compete with that information.

### 1.3 Static-first, progressively enhanced  The site is fully static. Every page must render its core content with JavaScript disabled. Interactive features (search, filters, Pyodide demos) are layered on top, but each layer degrades gracefully.

### 1.4 The portfolio does not own the projects  The portfolio must never feel like the project's home. Every project page makes it obvious how to get to the source code, the deployment, and the author's preferred venue. Internal portfolio chrome (breadcrumbs, "back to portfolio") is always present but never dominant.

### 1.5 Consistency over novelty  A portfolio of dozens of projects must feel like **one** site, not dozens of pages each designed differently. Reuse the same components everywhere they apply; avoid one-off layouts.

### 1.6 Calmer than a SaaS landing page  This is a personal portfolio, not a product site. The visual register is quiet, scannable, and respectful of the visitor's time. No pop-ups, no modal-stacking, no autoplay.

---

## 2. Domain entities in UX terms  These are the **nouns the visitor sees**. They map almost 1-to-1 to the metadata defined in [02 — The `project.yml` Contract](./02-project-yml-contract.md), but framed in terms the user perceives.

### 2.1 Project  The primary unit. Anything the portfolio shows a dedicated page for.
 ``` ┌──────────────────────────────────────────────────────┐ │  [Thumbnail]                                         │ │                                                      │ │  Project Name                                        │ │  Short description in 1–2 sentences.                 │ │                                                      │ │  [● active]  [Frontend] [Education]                  │ │                                                      │ │  Languages: Python · TypeScript                      │ │  Frameworks: FastAPI · React                         │ │                                                      │ │  [ View project → ]   [ Source ↗ ]   [ Live ↗ ]      │ └──────────────────────────────────────────────────────┘ ```
 **Attributes the visitor sees:**

- Name
- Description (1–2 lines on cards; full paragraph on detail page)
- Status (colour-coded dot + label)
- Type label (frontend / backend / application / fundamentals / collection)
- Categories (1–3)
- Tags (3–8 visible, "+N more" if longer)
- Tech stack (collapsible on cards; full breakdown on detail page)
- Featured indicator (star or "Featured" badge)
- Thumbnail (when present)
- Last update (relative time, e.g. "Updated 3 days ago")
- Primary CTA: **View project**
- Secondary CTAs: **Source** (GitHub), **Live** (when deployed)

### 2.2 Collection
 A **collection** is a project whose content is "more projects inside". The visitor perceives it as a folder or section.
 ``` ┌──────────────────────────────────────────────────────────────┐ │  Riwi Projects                                               │ │  A collection of small projects from the Riwi training …     │ │  [● maintained] [Education] [Fundamentals]                   │ │                                                              │ │  Contains 6 sub-projects:                                    │ │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │ │  │ Calcula- │ │ Fibonacci│ │ Bubble   │ │ Hola     │  …      │ │  │ dora     │ │          │ │ Sort     │ │ Mundo    │         │ │  │ python   │ │ python   │ │ python   │ │ js       │         │ │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │ └──────────────────────────────────────────────────────────────┘ ```  **Distinction from a regular project page:** collections show a "Contains" section listing child projects. Regular projects never do.

### 2.3 Category  A **broad portfolio classification** (Frontend, Backend, Full Stack, AI, DevOps, Fundamentals, Algorithms, Education, Experiments). Categories are limited, controlled, and few. They appear in the primary navigation and as filter chips on listing pages.

### 2.4 Tag  A **fine-grained searchable keyword** (react, postgresql, jwt, docker). Tags are open-ended; visitors expect to find more over time. They appear as small chips on cards and project pages, and as a cloud on the tags index page.

### 2.5 Tech item  A single technology from a project's `tech_stack`. Six flavours:

| Flavour | Examples |
|---------|----------|
| Language | Python, TypeScript, Rust |
| Framework | React, FastAPI, Astro |
| Library | Pydantic, Zod, NumPy |
| Database | PostgreSQL, Redis, Supabase |
| Infrastructure | Docker, Cloudflare, GitHub Actions |
| Tool | ESLint, Prettier, pytest |  Tech items are grouped under tabs on listing pages so visitors can filter by "what languages are used" vs "what frameworks" vs "what databases".

### 2.6 Demo  An **interactive experience embedded in a project page** (see [15](#15-demo-interaction-ux)). Five flavours:

- `webpage` — iframe of the deployed frontend.
- `api` — interactive API explorer pointing at the project's backend.
- `python` — a Pyodide terminal running a Python script from the repo.
- `terminal` — a generic terminal-style sandbox (Python or another WASM runtime).
- `documentation` — iframe or rendered docs site.  When a project has no demo, the slot is replaced by a "View the source on GitHub" call-to-action.

### 2.7 Deployment  A project's hosted instance. A project can have a frontend deployment, a backend deployment, both, or neither. On the project page, deployments are summarised as "Live" and "API" buttons with status indicators.

### 2.8 Repository  The GitHub repo behind a project. Always one-click away from any project page (a persistent "Source ↗" button in the project hero).

### 2.9 Author  The portfolio currently has **one author** (SrLampi1001). The author appears in:

- the site header (small avatar/name);
- the footer (larger avatar + bio);
- the about page.  When (if) collaborators appear on projects, this entity expands to support multiple authors per project.

### 2.10 Featured projects  A **selection** (not a separate entity) — a subset of projects flagged in `project.yml`. They appear:

- in a hero carousel on the home page;
- in the "Featured" filter on listing pages;
- in a small "Featured" section on category pages.  The list is curated by hand (via `presentation.featured: true`).

---

## 3. Entity relationships  A high-level view of how the entities relate, as the visitor experiences them:
 ```                           ┌──────────────┐                           │   Project    │                           │  (the core)  │                           └──┬───────┬───┘                              │       │               ┌──────────────┘       └──────────────┐               │                                     │               ▼                                     ▼         ┌───────────┐                       ┌──────────────┐         │Category(s)│                       │  Tag(s)      │         │ 1..3      │                       │ 0..N         │         └───────────┘                       └──────────────┘
         Project ──┬─ has 1 ─ Repository                  ├─ has 0..1 ─ Demo                  ├─ has 0..2 ─ Deployment (frontend, backend)                  ├─ has 1 ─ TechStack (6 sub-collections)                  ├─ has 0..1 ─ Documentation references                  ├─ has 0..1 ─ Presentation preferences                  └─ has 0..1 ─ Collection (when type=collection)                                  │                                  ▼                           ┌──────────────┐                           │  Children    │                           │  (Projects)  │                           └──────────────┘
         Category ──┬─ contains 0..N ─ Projects                    └─ labelled 1..N ─ Times in nav
         Tag ─────── contains 0..N ─ Projects
         Tech (per flavour) ──── contains 0..N ─ Projects ```
 **Cardinality rules the visitor can rely on:**

- Every project has **at least one** category (otherwise it's invisible).
- A project's tags and tech stack may be empty (rare, but allowed).
- A collection always has **one or more** child projects.
- A child project can belong to a collection **and** also appear   standalone on category pages — they're not exclusive.

---

## 4. Information architecture (sitemap)
 ``` / │ ├── /                              Home │   ├── #featured                  (in-page section) │   ├── #recent                    (in-page section) │   └── #categories                (in-page section) │ ├── /projects/                     All projects index │ ├── /projects/<id>/                Single project (or collection) │   ├── #overview                  (in-page section) │   ├── #tech                      (in-page section) │   ├── #demo                      (in-page section, when present) │   ├── #docs                      (in-page section, when present) │   └── #related                   (in-page section) │ ├── /collections/                  All collections index │ ├── /categories/                   All categories index ├── /categories/<slug>/            Projects in one category │ ├── /tags/                         All tags index (cloud) ├── /tags/<slug>/                  Projects with one tag │ ├── /tech/                         Tech stack overview │   ├── /tech/languages/ │   │   └── /tech/languages/<name>/ │   ├── /tech/frameworks/ │   ├── /tech/libraries/ │   ├── /tech/databases/ │   ├── /tech/infrastructure/ │   └── /tech/tools/ │ ├── /search/                       Search results (?q=…) │ ├── /about/                        About the author │ ├── /404                           Not found └── /offline                        (PWA / no network) ```

### 4.1 Generated pages vs. static pages

| Path | Generated from |
|------|----------------|
| `/` | Static template. Pulls featured + recent from all projects. |
| `/projects/` | Static template. Lists every project, sorted. |
| `/projects/<id>/` | One per project in the collection. |
| `/collections/` | Static template. Lists every project with `type: collection`. |
| `/categories/` | Static template. Lists every distinct category. |
| `/categories/<slug>/` | One per distinct category. |
| `/tags/`, `/tags/<slug>/` | One per distinct tag. |
| `/tech/…` | One per distinct tech value per flavour. |
| `/search/` | A single static page that reads `?q=` from the URL and filters a pre-built `search-index.json`. |
| `/about/` | Hand-written Markdown in the portfolio repo. |
| `/404` | Astro fallback. |

### 4.2 Sitemap and robots  `@astrojs/sitemap` generates `/sitemap-index.xml`. `/projects/`, `/categories/`, `/tags/`, `/tech/`, `/about/` are listed. `/search/` is **not** indexed by search engines (`<meta name="robots" content="noindex">`).

---

## 5. Page templates  Each template is described in terms of **regions** (visible header bands the visitor can see). Implementation details (Astro components) follow in [section 6](#6-component-inventory).

### 5.1 Home (`/`)
 ``` ┌──────────────────────────────────────────────────────────────┐ │ HEADER  [logo]  Home  Projects  Categories  Tags    🔍  ☾   │ ├──────────────────────────────────────────────────────────────┤ │                                                              │ │   Hero                                                       │ │   "SrLampi1001 — software projects, indexed."                │ │   One sentence. Subtle CTA to /projects/.                    │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │                                                              │ │   ★ Featured                                                 │ │   ┌─────────┐ ┌─────────┐ ┌─────────┐                        │ │   │ card    │ │ card    │ │ card    │   (3–5 cards)           │ │   └─────────┘ └─────────┘ └─────────┘                        │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │                                                              │ │   Recent                                                     │ │   ┌────┐ ┌────┐ ┌────┐ ┌────┐                                │ │   │card│ │card│ │card│ │card│   (4–8 cards, sorted by date)   │ │   └────┘ └────┘ └────┘ └────┘                                │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │                                                              │ │   Browse by category                                         │ │   [Frontend] [Backend] [Full Stack] [Education] …            │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │ FOOTER                                                       │ └──────────────────────────────────────────────────────────────┘ ```
 **Behaviour:**

- Featured carousel: 3–5 cards, simple horizontal scroll on mobile,   grid on desktop. No autoplay.
- "Recent" sorts by repository `pushed_at` (latest commit), not by   `created_at` (which may be older).
- The category list shows all distinct categories as pills. Click → category page.

### 5.2 Projects index (`/projects/`)
 ``` ┌──────────────────────────────────────────────────────────────┐ │ HEADER                                                       │ ├──────────────────────────────────────────────────────────────┤ │   Projects                                              N    │ │                                                              │ │   ┌──────────┐ ┌──────────────────────────────────────────┐  │ │   │ FILTERS  │  ┌────┐ ┌────┐ ┌────┐                       │ │   │          │  │card│ │card│ │card│                       │ │   │ Type     │  └────┘ └────┘ └────┘                       │ │   │ ☐ frnt   │  ┌────┐ ┌────┐ ┌────┐                       │ │   │ ☐ bck    │  │card│ │card│ │card│                       │ │   │ ☐ …      │  └────┘ └────┘ └────┘                       │ │   │          │                                            │ │   │ Langs    │  [ Load more ]                              │ │   │ ☐ py     │                                            │ │   │ ☐ ts     │                                            │ │   │ ☐ …      │                                            │ │   │          │                                            │ │   │ Status   │                                            │ │   │ ● active │                                            │ │   └──────────┘                                            │ ├──────────────────────────────────────────────────────────────┤ │ FOOTER                                                       │ └──────────────────────────────────────────────────────────────┘ ```  **Behaviour:**

- Sidebar (desktop) → bottom sheet (mobile) with filter facets.
- Grid updates live as filters are toggled.
- Pagination: "Load more" button (no infinite scroll) until all are shown.
- Empty result: friendly "No projects match these filters" message with a   "Clear filters" button.

### 5.3 Project detail (`/projects/<id>/`)
 ``` ┌──────────────────────────────────────────────────────────────┐ │ HEADER                                                       │ ├──────────────────────────────────────────────────────────────┤ │                                                              │ │   ← Projects                                                 │ │                                                              │ │   ┌──────────┐   Project Name                                │ │   │ thumbnail│   [● active]  Frontend · Education            │ │   │          │   Description paragraph.                      │ │   └──────────┘                                               │ │                                                              │ │              [ View project → ]  [ Source ↗ ]  [ Live ↗ ]    │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │   #overview   #tech   #demo   #docs   #related               │ │   ──────                                                     │ │                                                              │ │  ┌────────────────────────────┐ ┌─────────────────────────┐   │ │  │                            │ │ Repository              │   │ │  │  Long description          │ │ SrLampi1001/<repo>      │   │ │  │  • bullet                  │ │ Branch: main            │   │ │  │  • bullet                  │ │ Updated 3 days ago      │   │ │  │                            │ │                         │   │ │  │  ## Subhead                │ │ Deployment              │   │ │  │  More prose                │ │ • Frontend: github-pages │   │ │  │                            │ │ • Backend: render        │   │ │  │                            │ │                         │   │ │  │                            │ │ Status                  │   │ │  │                            │ │ ● active                │   │ │  └────────────────────────────┘ └─────────────────────────┘   │ │                                                              │ │  ────── #tech ───────────────────────────────────────        │ │                                                              │ │   Languages      Python, TypeScript                          │ │   Frameworks     FastAPI, React                              │ │   Libraries      Pydantic                                    │ │   Databases      PostgreSQL                                  │ │   Infrastructure Docker, GitHub Actions                      │ │   Tools          ESLint, Prettier                            │ │                                                              │ │  ────── #demo ───────────────────────────────────────        │ │                                                              │ │   [ Pyodide terminal or iframe here ]                        │ │                                                              │ │  ────── #docs ───────────────────────────────────────        │ │                                                              │ │   Rendered docs/architecture.md (Markdown)                   │ │                                                              │ │  ────── #related ───────────────────────────────────        │ │                                                              │ │   ┌────┐ ┌────┐ ┌────┐                                       │ │   │card│ │card│ │card│   (by shared category or tag)         │ │   └────┘ └────┘ └────┘                                       │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │ FOOTER                                                       │ └──────────────────────────────────────────────────────────────┘ ```
 **Behaviour:**

- Hero collapses on mobile: thumbnail becomes smaller or moves below.
- Tab strip (#overview / #tech / #demo / #docs / #related) is sticky on   long project pages; clicking a tab jumps to that section and updates   the URL hash.
- Sidebar collapses to a "Show details" disclosure on mobile.

### 5.4 Collection detail (`/projects/<id>/` where type=collection)
 Same shell as project detail, with one key difference: an additional **Contains** section near the top showing all child projects as cards.

### 5.5 Category page (`/categories/<slug>/`)
 ``` ┌──────────────────────────────────────────────────────────────┐ │ HEADER                                                       │ ├──────────────────────────────────────────────────────────────┤ │   Category: Frontend                                  N      │ │   Short description (optional, from category metadata)       │ │                                                              │ │   ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                  │ │   │card│ │card│ │card│ │card│ │card│ │card│                  │ │   └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                  │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │ FOOTER                                                       │ └──────────────────────────────────────────────────────────────┘ ```  No filters on category pages by default — the category **is** the filter.

### 5.6 Tag page (`/tags/<slug>/`)  Same as category, but the heading is "Tag: react" instead.

### 5.7 Tech page (`/tech/<flavour>/<name>/`)
 ``` ┌──────────────────────────────────────────────────────────────┐ │ HEADER                                                       │ ├──────────────────────────────────────────────────────────────┤ │   Languages › Python                                  N      │ │   Projects using Python as a language.                       │ │                                                              │ │   ┌────┐ ┌────┐ ┌────┐                                       │ │   │card│ │card│ │card│                                       │ │   └────┘ └────┘ └────┘                                       │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │ FOOTER                                                       │ └──────────────────────────────────────────────────────────────┘ ```
 The breadcrumb `Languages › Python` makes the flavour clear.

### 5.8 Search (`/search/`)
 ``` ┌──────────────────────────────────────────────────────────────┐ │ HEADER                                                       │ ├──────────────────────────────────────────────────────────────┤ │   Search                                                      │ │   ┌──────────────────────────────────────────┐  [ Clear ]    │ │   │ calculadora                              │               │ │   └──────────────────────────────────────────┘               │ │   3 results                                                  │ │   ┌──────────────────────────────────────────────────┐       │ │   │ Riwi — Python                                    │       │ │   │ …Python exercises from the Riwi program.         │       │ │   └──────────────────────────────────────────────────┘       │ │   ┌──────────────────────────────────────────────────┐       │ │   │ …                                                │       │ │   └──────────────────────────────────────────────────┘       │ │                                                              │ ├──────────────────────────────────────────────────────────────┤ │ FOOTER                                                       │ └──────────────────────────────────────────────────────────────┘ ```  **Behaviour:**

- The page is a single static HTML file. The `?q=` query string is read   by client-side JS, which fetches `search-index.json` and renders   results.
- For users without JS, the page shows a fallback message + link to   `/projects/` and category listings.
- Empty query → "Start typing to search" + suggested popular tags.

### 5.9 About (`/about/`)  Hand-authored Markdown. Sections:

- The author (avatar, bio, links)
- How the portfolio works (1 paragraph)
- How to add a project (link to the repo + schema)
- Contact (GitHub, optional email)

### 5.10 404  A friendly page that says "This page is missing", with a prominent link back to `/projects/` and a search box.

---

## 6. Component inventory  Components are the **reusable visual units** the templates compose. Names follow a `<Domain><Variant>` convention so they map cleanly to the entities above.

### 6.1 Layout primitives

| Component | Purpose | Used in |
|-----------|---------|---------|
| `BaseLayout` | The outer HTML shell, `<head>`, fonts, theme bootstrap. | All pages |
| `SiteHeader` | Top bar with logo, primary nav, search trigger, theme toggle. | All pages |
| `SiteFooter` | Bottom bar with secondary nav, repo link, social. | All pages |
| `Container` | Centered max-width wrapper. | All pages |
| `Section` | Vertical rhythm + optional heading. | Home, listings |
| `Stack` / `Cluster` | Flex helpers for one-direction layout. | All pages |
| `Grid` | CSS grid wrapper with responsive columns. | Listings |
| `Breadcrumbs` | Path indicator. | Detail pages |

### 6.2 Content primitives

| Component | Purpose | Used in |
|-----------|---------|---------|
| `Heading` | h1–h6 with consistent typography. | All pages |
| `MarkdownContent` | Rendered prose with anchored headings. | Project detail |
| `Prose` | Wrapper styling for arbitrary Markdown content. | Project detail |
| `CodeBlock` | Syntax-highlighted code (Shiki via Astro). | Project detail, docs |
| `Callout` | Info / warning / success / note. | Docs pages |
| `Figure` | Image + caption. | Project detail |
| `DefinitionList` | `dt`/`dd` pairs for sidebar facts. | Project sidebar |

### 6.3 Entity components

| Component | Purpose | Used in |
|-----------|---------|---------|
| `ProjectCard` | Compact card on listings. | Home, listings, related, collection "contains" |
| `ProjectHero` | Large header for detail page. | Project detail, collection detail |
| `ProjectSidebar` | Repo / deployment / status facts. | Project detail |
| `ProjectTabs` | Anchor-tab strip across the detail page. | Project detail |
| `CollectionContains` | Grid of child projects. | Collection detail |
| `CategoryCard` | Compact card for category landing. | Categories index |
| `TagChip` | Small pill linking to the tag page. | Cards, hero, footer of detail |
| `TagCloud` | Weighted list of all tags. | Tags index |
| `TechBadge` | One technology with optional icon. | Cards, hero, tech section |
| `TechBadgeGroup` | Grouped list under a tech-flavour heading. | Tech section |
| `TechFacetGroup` | One facet (e.g. "Languages") in the filter sidebar. | Projects index |
| `StatusIndicator` | Coloured dot + label. | Cards, hero |
| `FeaturedStar` | Small star icon. | Cards |

### 6.4 Demo components

| Component | Purpose | Used in |
|-----------|---------|---------|
| `DemoFrame` | Generic iframe with title + fallback link. | Project detail, `#demo` |
| `PyodideTerminal` | xterm.js + Pyodide wrapper. | Project detail, `#demo` |
| `ApiExplorer` | Form + response renderer for a REST endpoint. | Project detail, `#demo` |
| `DemoPlaceholder` | "No demo available" message with source link. | Project detail, when demo absent |

### 6.5 Action components

| Component | Purpose | Used in |
|-----------|---------|---------|
| `Button` | Primary / secondary / ghost variants. | All pages |
| `IconButton` | Square button for header actions. | Header, search |
| `ExternalLink` | A link decorated with an "external" icon. | Anywhere leaving the site |
| `CopyButton` | Copy-to-clipboard button. | Docs of API endpoints |
| `FilterToggle` | A facet toggle in the sidebar. | Projects index |
| `SearchInput` | Type-as-you-search input. | Header (modal), `/search/` |
| `SearchModal` | Cmd+K-style search overlay. | All pages |
| `ThemeToggle` | Light / dark / system. | Header |

### 6.6 Loading & state components

| Component | Purpose | Used in |
|-----------|---------|---------|
| `Spinner` | Indeterminate progress. | Demos |
| `ProgressBar` | Determinate progress (Pyodide download). | PyodideTerminal |
| `EmptyState` | Friendly message when there's nothing to show. | Listings, search, filters |
| `ErrorState` | Friendly message when something went wrong. | Demos, search |
| `SkeletonCard` | Placeholder while content loads. | Listings (rare; static-first) |

---

## 7. Navigation system  The portfolio uses **four** navigation mechanisms. Each has a clear role.

### 7.1 Primary navigation (header)  Persistent across all pages.
 ``` ┌────────────────────────────────────────────────────────────────┐ │  [logo]  Home   Projects   Categories   Tags        🔍   ☾    │ └────────────────────────────────────────────────────────────────┘ ```

- **Logo** → home `/`
- **Home** → `/`
- **Projects** → `/projects/`
- **Categories** → `/categories/`
- **Tags** → `/tags/`
- **🔍** → opens search modal (`Cmd+K` / `Ctrl+K`)
- **☾** → theme toggle (light / dark / system)
 On mobile (≤ 640 px), the primary nav collapses to a hamburger menu. The search and theme icons stay visible.

### 7.2 Breadcrumbs
 Shown on detail pages only.
 ``` Home  ›  Projects  ›  Riwi — Python  ›  Calculadora ```

- The home crumb links to `/`.
- "Projects" links to `/projects/`.
- A collection crumb links to the collection's page.
- The current page crumb is non-interactive.

### 7.3 In-page navigation (tabs)  On project detail pages, a sticky tab strip jumps to sections:
 ```
#overview   #tech   #demo   #docs   #related ```
 The active tab is determined by the URL hash and by IntersectionObserver as the user scrolls. Clicking a tab updates the URL hash and scrolls smoothly.

### 7.4 Footer navigation
 ``` SrLampi1001  •  GitHub ↗  •  RSS  •  About  •  Last build: 2026-10-04 ```

- Repository link to `SrLampi1001.github.io`
- RSS feed of recently updated projects
- About link
- A subtle "Last build" timestamp (from CI) for transparency

### 7.5 Search overlay (modal)  Triggered by:

- clicking the 🔍 icon in the header;
- pressing `Cmd+K` / `Ctrl+K` from anywhere;
- typing `/` when the page has no focused input.  The modal contains:

- a single text input (auto-focused);
- a results list (max 8 visible, with a "see all" link to `/search/?q=…`);
- keyboard nav (`↑`/`↓` to move, `Enter` to open, `Esc` to close).

### 7.6 Navigation flow patterns  **Discovery flow (most common):**
 ``` Home  └─ Featured or Recent card click      └─ Project detail          └─ Click "Source" or "Live"              └─ Leaves the portfolio ```
 **Filter flow:**
 ``` Projects  └─ Sidebar: tick "Python"      └─ Filtered grid updates live          └─ Click a card              └─ Project detail ```  **Search flow:**
 ``` Any page  └─ Cmd+K      └─ Type "fib"          └─ Results appear in modal              └─ Enter                  └─ Project detail (or /search/ if no modal match) ```
 **Drill-down flow:**
 ``` Project detail  └─ Click a tag chip ("python")      └─ Tag page          └─ Click another project              └─ Project detail ```

---

## 8. Layouts and wireframes

### 8.1 Two main grid systems  The portfolio uses **two** CSS grid systems, chosen by page type.  **Listing grid** (home, projects, category, tag, tech, related):
 ``` Desktop (>1024 px): ┌──────┬──────┬──────┬──────┐ │ card │ card │ card │ card │ ├──────┼──────┼──────┼──────┤ │ card │ card │ card │ card │ └──────┴──────┴──────┴──────┘
 Tablet (640–1024 px): ┌──────┬──────┬──────┐ │ card │ card │ card │ ├──────┼──────┼──────┤ │ card │ card │ card │ └──────┴──────┴──────┘
 Mobile (<640 px): ┌──────────┐ │   card   │ ├──────────┤ │   card   │ ├──────────┤ │   card   │ └──────────┘ ```
 **Detail grid** (project, collection):
 ``` Desktop: ┌────────────────────┬──────────────┐ │                    │              │ │   main content     │   sidebar    │ │                    │              │ └────────────────────┴──────────────┘  Mobile: ┌────────────────────┐ │   main content     │ ├────────────────────┤ │   sidebar (below)  │ └────────────────────┘ ```

### 8.2 Spacing scale  A consistent 4 px-based scale:
 ``` --space-1:   4px --space-2:   8px --space-3:   12px --space-4:   16px --space-5:   24px --space-6:   32px --space-7:   48px --space-8:   64px --space-9:   96px ```
 Cards use `--space-5` internal padding. Sections use `--space-7` between them on desktop, `--space-5` on mobile.

### 8.3 Hero treatment on project detail
 The hero is **not** a full-bleed banner. It's a contained header block that respects the page's max width:
 ``` ┌────────────────────────────────────────────────────────┐ │ ← Projects                                            │ │                                                      │ │ ┌────────┐                                           │ │ │ thumb  │  Project Name                            │ │ │ 96x96  │  Description paragraph...                │ │ │        │                                          │ │ └────────┘  [ View project ]  [ Source ↗ ]  [ Live ↗ ]│ └────────────────────────────────────────────────────────┘ ```  On mobile, the thumbnail moves above the title and shrinks to 64x64.

---

## 9. Responsive behaviour  The portfolio is **mobile-first**. The base styles target the smallest viewport; enhancements layer on for larger screens.

### 9.1 Breakpoints
 ``` --bp-sm:  640px    phone → phablet --bp-md:  768px    phablet → tablet --bp-lg:  1024px   tablet → small desktop --bp-xl:  1280px   small desktop → desktop --bp-2xl: 1536px   desktop → wide desktop ```
 Astro and CSS handle the responsive logic. The portfolio does not need JS-driven responsive behaviour except for:

- the mobile menu toggle;
- the search modal;
- the filter sidebar → bottom-sheet transition.

### 9.2 Per-component behaviour

| Component | <640 px | 640–1024 px | >1024 px |
|-----------|---------|-------------|----------|
| Header nav | hamburger | full nav | full nav |
| Project card grid | 1 column | 2 columns | 3–4 columns |
| Filter sidebar | bottom sheet | collapsible | always visible |
| Project hero | stacked, small thumb | side-by-side | side-by-side, large thumb |
| Tag cloud | compact, 2-col | 3-col | 5-col |
| Demo iframe | full-width, scroll | fixed 16:9 | fixed 16:9 |
| Pyodide terminal | full-width, smaller font | 80x24 | 100x30 |
| Footer | stacked | 2-col | 3-col |

### 9.3 Touch targets
 All interactive elements have a minimum tap target of **44×44 px** on mobile. Spacing between adjacent targets is at least **8 px**.

---

## 10. Interaction patterns

### 10.1 Search (Cmd+K modal)

| Trigger | Behaviour |
|---------|-----------|
| `Cmd+K` / `Ctrl+K` | Opens the modal regardless of focused element (unless inside a text input where it does the platform default). |
| Click 🔍 icon | Opens the modal. |
| `/` | Opens the modal if no input is focused. |
| `Esc` | Closes the modal and restores focus. |
| `↑` / `↓` | Move selection in results. |
| `Enter` | Opens the selected result. |
 The modal fetches `search-index.json` lazily on first open; subsequent opens are instant. The matcher is a small fuzzy substring match (~50 LOC), no external library.

### 10.2 Filters (project index)

- Filters are **instant**: changing a checkbox updates the grid on the   next animation frame.
- The filter state is reflected in the URL via query string   (`?type=frontend&lang=python`). Visitors can share filtered views.
- "Clear all" button resets state and URL.
- Filters are **AND across categories** (type=frontend AND lang=python),   **OR within a category** (lang=python OR lang=rust).

### 10.3 Demo launch
 A demo is launched by clicking the `#demo` tab on the project page. The demo section is **lazy-loaded**:

- iframes (`webpage`, `documentation`) → set `loading="lazy"`.
- Pyodide (`python`) → Pyodide is not loaded until the tab is visible   AND the user clicks "Run".
- API explorer → the endpoint URL is fetched on first render.
 If the demo fails to load, an `ErrorState` replaces it with:

> "Demo unavailable. View the source on GitHub ↗"

### 10.4 Theme toggle

- Three states: `light`, `dark`, `system` (default).
- Stored in `localStorage` under `theme`.
- Applied via `data-theme` on `<html>` to prevent flash-of-wrong-theme.
- System theme follows `prefers-color-scheme` and updates live.

### 10.5 Reduced motion
 If `prefers-reduced-motion: reduce` is set:

- the page-load fade is disabled;
- the demo "Run" progress bar becomes instant;
- the carousel scroll-snap is preserved but smooth-scroll becomes instant.

---

## 11. Visual design tokens
 The portfolio uses a small, deliberate token system. No framework required; design tokens live as CSS custom properties on `:root`.

### 11.1 Color
 A neutral palette with a single accent. The accent colour is a teal-blue (`oklch(0.6 0.15 220)`) chosen for sufficient contrast against both light and dark backgrounds.
 ```css :root {   --color-bg:        oklch(0.99 0 0);            /* near-white */   --color-fg:        oklch(0.2 0 0);             /* near-black */   --color-muted:     oklch(0.55 0 0);            /* secondary text */   --color-border:    oklch(0.92 0 0);   --color-surface:   oklch(0.97 0 0);            /* cards, sidebars */   --color-accent:    oklch(0.6 0.15 220);   --color-accent-fg: oklch(0.99 0 0);            /* text on accent */    /* Status colours */   --color-status-active:        oklch(0.7 0.15 150);  /* green */   --color-status-maintained:    oklch(0.7 0.1 250);   /* blue */   --color-status-archived:      oklch(0.6 0.05 0);    /* grey */   --color-status-experimental:  oklch(0.75 0.18 80);   /* amber */ }  :root[data-theme="dark"] {   --color-bg:        oklch(0.16 0 0);   --color-fg:        oklch(0.96 0 0);   --color-muted:     oklch(0.7 0 0);   --color-border:    oklch(0.3 0 0);   --color-surface:   oklch(0.22 0 0);   --color-accent:    oklch(0.7 0.15 220);   --color-accent-fg: oklch(0.16 0 0); } ```

### 11.2 Typography  A single sans-serif family for everything; system font stack by default to keep the bundle small:
 ```css font-family:   ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,   "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; ```
 Monospace (for code):
 ```css font-family:   ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace; ```  Scale:
 ``` --text-xs:    0.75rem   (12px)   tags, meta --text-sm:    0.875rem  (14px)   card body --text-base:  1rem      (16px)   body --text-lg:    1.125rem  (18px)   lead paragraphs --text-xl:    1.25rem   (20px)   card title --text-2xl:   1.5rem    (24px)   section heading --text-3xl:   1.875rem  (30px)   page title --text-4xl:   2.25rem   (36px)   hero (desktop) ```
 Line height 1.6 for body, 1.2 for headings. Max measure 70ch for prose.

### 11.3 Borders, radii, shadows
 ```css --radius-sm:   4px; --radius-md:   8px; --radius-lg:   12px; --radius-full: 9999px;     /* pills */  --shadow-sm:   0 1px 2px rgb(0 0 0 / 0.04); --shadow-md:   0 4px 12px rgb(0 0 0 / 0.06); --shadow-lg:   0 12px 32px rgb(0 0 0 / 0.08); ```  Cards use `--radius-md` and `--shadow-sm`. Hover lifts to `--shadow-md`.

### 11.4 Motion
 ```css --duration-fast:   120ms; --duration-base:   200ms; --duration-slow:   320ms; --easing-standard: cubic-bezier(0.2, 0, 0.2, 1); --easing-emphasis: cubic-bezier(0.3, 0, 0, 1); ```

---

## 12. Accessibility
 The portfolio targets **WCAG 2.1 AA** as a floor; specific targets:

- **Color contrast**: 4.5:1 for body text, 3:1 for large text and   non-text elements.
- **Keyboard**: every interactive element is reachable and operable via   keyboard. Focus is always visible (a 2 px ring using `--color-accent`).
- **Screen readers**: all meaningful images have `alt` text; decorative   icons have `aria-hidden="true"`; status indicators have   `aria-label="Active project"` etc.
- **Skip to content**: a hidden link at the top of every page jumps past   the header to `<main>`.
- **Reduced motion**: see [section 10.5](#105-reduced-motion).
- **Heading order**: each page has exactly one `<h1>`; headings nest   without skipping levels.
- **Form labels**: the search input has a visible label and a   programmatically associated `<label>`.
- **No keyboard trap**: modals trap focus while open but release it on   close.

### 12.1 Demo accessibility

- Pyodide terminals: announce "Python runtime loaded" via an   `aria-live="polite"` region when ready.
- Iframe demos: each has a meaningful `title`; the surrounding demo   section offers a "Open in new tab" link as an alternative.

---

## 13. Empty, loading and error states

### 13.1 Empty states

| Context | Message | Action |
|---------|---------|--------|
| No projects in category | "No projects in this category yet." | "Browse all projects →" |
| No search results | "Nothing matches '…'." | "Clear search" + "Browse categories" |
| Filter combination returns nothing | "No projects match these filters." | "Clear filters" |
| Tag page with one project | (no special state) | — |
| Collection with no children (data error) | "This collection has no projects listed." | "View on GitHub ↗" |

### 13.2 Loading states
 Because the site is fully static, **most pages have no loading state**. The exceptions:

| Context | Indicator |
|---------|-----------|
| Pyodide download (6 MB) | Progress bar in the terminal section with "Downloading Python runtime (X%)" |
| Iframe demo loading | Skeleton with the project name |
| Search index loading | "Loading search index…" then fades out |

### 13.3 Error states

| Context | Behaviour |
|---------|-----------|
| `project.yml` failed validation | The portfolio build fails entirely — this state is unreachable on production. (Logged in CI.) |
| Demo iframe fails to load | Replace with "Demo unavailable — view source on GitHub ↗" |
| Pyodide fails to initialise | Replace with "Python runtime unavailable — view source on GitHub ↗" |
| API explorer CORS error | "The API didn't allow this request. Try opening it directly ↗" |
| Search index fails to load | "Search is temporarily unavailable. Use the navigation above." |
| 404 | Dedicated page with search box + link to `/projects/` |
| Offline (PWA, future) | Cached page + "You're offline" banner |

---

## 14. Search and filtering UX

### 14.1 The search index
 At the Astro build step, a `search-index.json` file is generated containing every project's searchable fields:
 ```json [   {     "id": "riwi-python",     "name": "Riwi — Python",     "description": "Python exercises from the Riwi program.",     "categories": ["Education", "Fundamentals"],     "tags": ["python", "fundamentals"],     "languages": ["Python"],     "frameworks": [],     "libraries": [],     "databases": [],     "infrastructure": [],     "tools": []   } ] ```

### 14.2 Match ranking  The matcher scores each entry by:

1. Exact match in `name` — 100 points.
2. Prefix match in `name` — 50 points.
3. Substring match in `name` — 25 points.
4. Substring match in `description` — 10 points.
5. Exact match in any tag, category, language or framework — 5 points.  Results are sorted descending; ties broken by last update. The top 8 appear in the modal; the full list is on `/search/?q=…`.

### 14.3 Filter facets  On `/projects/`, the sidebar exposes:

- **Type**: frontend / backend / application / fundamentals / collection   (checkboxes).
- **Language**: every distinct `tech_stack.languages` value (checkboxes).
- **Framework**: every distinct `tech_stack.frameworks` value (checkboxes).
- **Database**: every distinct `tech_stack.databases` value (checkboxes).
- **Status**: active / maintained / archived / experimental (radio).
- **Featured**: only featured (toggle).  Facets are AND-combined across groups; within a group, OR-combined. The active filter set is encoded in the URL (`?type=frontend&lang=python`).

### 14.4 Why no fancy filter UI library  The filter logic is a small JavaScript function (~40 LOC) that intersects two arrays. A library would add tens of KB for no functionality gain. The visual side is plain HTML checkboxes styled with CSS.

---

## 15. Demo interaction UX

### 15.1 What the visitor sees
 ``` ┌─────────────────────────────────────────────────────────┐ │  Demo · python                                          │ │                                                         │ │  ┌─────────────────────────────────────────────────┐    │ │  │  $ python calculadora.py                        │    │ │  │  Ingrese el primer número: 5_                   │    │ │  │  Operación (+, -, *, /): +                      │    │ │  │  Ingrese el segundo número: 3                   │    │ │  │  Resultado: 8                                   │    │ │  │  $                                               │    │ │  └─────────────────────────────────────────────────┘    │ │                                                         │ │  Powered by Pyodide. [ View source on GitHub ↗ ]        │ └─────────────────────────────────────────────────────────┘ ```

### 15.2 Steps to first run

1. Visitor scrolls to `#demo`.
2. The section shows a "Run calculadora.py" button + a description of    what the demo does.
3. Visitor clicks **Run**.
4. A spinner appears with "Downloading Python runtime (~6 MB) …"
6. Once loaded, the terminal mounts and the script runs.
7. Output streams into the terminal.
8. On completion, a "Run again" button replaces "Run".

### 15.3 Demo failure
 If Pyodide fails to load (no network, blocked CDN, browser incompatibility):

- the terminal section shows "Python runtime unavailable";
- a "View source on GitHub ↗" link is prominent;
- the rest of the project page is unaffected.

### 15.4 Iframe demos
 ``` ┌─────────────────────────────────────────────────────────┐ │  Demo · webpage                                         │ │                                                         │ │  ┌─────────────────────────────────────────────────┐    │ │  │                                                 │    │ │  │           [ embedded app ]                      │    │ │  │                                                 │    │ │  └─────────────────────────────────────────────────┘    │ │                                                         │ │  Opens the deployed version at example.com.              │ │  [ Open in new tab ↗ ]   [ View source on GitHub ↗ ]    │ └─────────────────────────────────────────────────────────┘ ```  Iframes use a 16:9 aspect ratio on desktop and full-width on mobile. The "Open in new tab" link is always present — many demos are better in a full window.

---

## 16. Internationalisation (future)  The initial portfolio is **English-only**. The contract and content are authored to make future translation possible without re-architecture: all user-facing strings in templates live in one of two places:

- **Inline strings** in `.astro` files, easy to grep and replace later.
- **`i18n.ts` module** for any string that repeats (button labels,   status names, "No projects found", etc.).  If/when translation is added, the routing strategy is:

- `src/pages/en/`, `src/pages/es/`, etc.
- Default language served at the root.
- `<html lang="…">` set per page.
- `<link rel="alternate" hreflang="…">` per language.

---

## 17. Open design questions  These are decisions still on the table. They do **not** block implementation; they can be settled during the design phase.

### 17.1 Should the homepage have a hero image?  **Option A**: text-only hero (current proposal) — fast, calm, scannable. **Option B**: large illustration or photo of the author — warmer, personal, but distracts from the project grid below.  **Recommendation**: A. The portfolio's job is to send visitors to projects, not to showcase the author visually.

### 17.2 Should categories be predefined or free-form?  **Option A**: a strict enum of ~9 categories (current contract). **Option B**: free-form strings, displayed as typed.  **Recommendation**: A. Free-form categories produce inconsistent naming (e.g. "Backend" vs "back-end" vs "server"). The portfolio can always add new categories by extending the schema.

### 17.3 Should featured projects be one per page or a carousel?  **Option A**: 3–5 in a horizontal grid (no carousel). **Option B**: a true carousel with auto-advance.  **Recommendation**: A. Carousels have low engagement and high a11y cost. A small grid is sufficient for 5 featured projects.

### 17.4 Should the demo be in a modal or inline?  **Option A**: inline in the project page (current proposal). **Option B**: modal launched from the card.  **Recommendation**: A. Inline is more discoverable and avoids modal overload. A modal can be added later if demos grow long enough to demand focus.

### 17.5 Should the footer show "last build" timestamp?  **Option A**: yes — transparent, debuggable. **Option B**: no — clutters the footer.  **Recommendation**: A. The portfolio is automated; showing the build timestamp signals to visitors (and to recruiters) that the site is alive and not abandoned.

### 17.6 Should `/tech/<flavour>/<name>/` exist for every flavour, or only the most common?  **Option A**: all six flavours, always generated. **Option B**: only `languages`, `frameworks`, `databases` (skip `libraries`, `infrastructure`, `tools`).  **Recommendation**: A. The visitor does not need to know our internal "common" list. If a project uses a single library, that library should be discoverable.

### 17.7 Should we add a "Recently active" feed on the home page?  **Option A**: yes — a strip of "updated in the last 30 days". **Option B**: no — keep home to Featured + Recent + Categories.  **Recommendation**: A *if* the GitHub API is queried at build time to derive `pushed_at` per project (no extra cost; the metadata is already fetched). Otherwise, omit and rely on "Recent" alone.

---

## Where to go next

- The Astro implementation that produces these pages: [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md)
- The contract that defines what data is available to render: [02 — The `project.yml` Contract](./02-project-yml-contract.md)
- The Pyodide demo runtime: [05 — Demo System (Pyodide & Terminals)](./05-demo-system.md)
- The overall architecture context: [01 — Architecture](./01-architecture.md)