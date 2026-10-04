# 09 — Monorepos & Collections

This document describes how a single GitHub repository can expose **multiple** indexable projects to the portfolio through nested `project.yml` files.

---

## 1. The two flavours of monorepo

The portfolio distinguishes between two related concepts:

### 1.1 Collection

A repository whose **entire purpose** is to gather multiple small projects under one roof. The classic example is:

```text
riwi_projects/
├── project.yml                 # type: collection
├── python/
│   ├── project.yml             # type: fundamentals
│   ├── calculadora.py
│   └── fibonacci.py
└── javascript/
    ├── project.yml             # type: fundamentals
    └── ...
```

The root `project.yml` represents the collection itself. Each subdirectory contains its own `project.yml` representing an individual project.

### 1.2 Monorepo

A repository that contains several larger projects, typically sharing dependencies or tooling. Examples:

- A single repo holding the frontend, backend and docs site of one product.
- A workspace containing multiple related apps.

The portfolio treats monorepo subprojects the same way it treats collection subprojects: by reading every `project.yml` it finds.

---

## 2. Discovery rules

The discovery workflow walks every indexed repository and treats any `project.yml` it encounters as the metadata for **one project**. The following rules apply:

1. There is exactly **one `project.yml` per indexable project.**
2. The path of the file determines the project URL:
   - `project.yml` at repo root → `/projects/<id>/`
   - `python/project.yml` → `/projects/<id>/` where `id` is unique within the portfolio
3. All `project.yml` files in the same repo must declare **distinct** `id`s.
4. A repo may declare a top-level `project.yml` even when it also contains    subprojects. The top-level project then usually has `type: collection`.

The portfolio walks depth-first and indexes everything it finds. There is no allow-list or deny-list beyond the contract's required fields.

---

## 3. Collection example

```text
riwi_projects/
│
├── project.yml                 # the collection
│
├── python/
│   ├── project.yml             # calculadora
│   ├── calculadora.py
│   ├── fibonacci.py
│   └── bubble_sort.py
│
└── javascript/
    ├── project.yml             # javascript basics
    ├── hola_mundo.js
    └── variables.js
```

### 3.1 `riwi_projects/project.yml`

```yaml
project:
  id: riwi-projects
  name: Riwi Projects
  description: >
    A collection of small projects created during the Riwi training
    program. Each subdirectory contains an independent project with
    its own documentation and demo.
  type: collection
  categories: [Education, Fundamentals]
  tags: [python, javascript, fundamentals]
  status: maintained
  repository:
    provider: github
    owner: SrLampi1001
    name: riwi_projects
    branch: main
  presentation:
    featured: true
    order: 1
```

### 3.2 `riwi_projects/python/project.yml`

```yaml
project:
  id: riwi-python
  name: Riwi — Python
  description: Python exercises from the Riwi program.
  type: fundamentals
  categories: [Education, Fundamentals]
  tags: [python, fundamentals]
  status: maintained
  tech_stack:
    languages: [Python]
  repository:
    provider: github
    owner: SrLampi1001
    name: riwi_projects
    branch: main
  demo:
    enabled: true
    type: python
    runtime: pyodide
    entrypoint: python/calculadora.py
```

### 3.3 `riwi_projects/python/calculadora.py` (a leaf)

This is a real Python program that the portfolio can run in the browser:

```python
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

if __name__ == "__main__":
    x = float(input("Ingrese el primer número: "))
    op = input("Operación (+, -, *, /): ")
    y = float(input("Ingrese el segundo número: "))

    if op == "+":
        print("Resultado:", add(x, y))
    elif op == "-":
        print("Resultado:", subtract(x, y))
    else:
        print("Operación no soportada")
```

This file does **not** contain a `project.yml` of its own; it is a leaf of the `riwi-python` collection.

---

## 4. How the portfolio renders this

When the discovery workflow indexes `riwi_projects`, the portfolio generates:

- a project page for `riwi-projects` that lists its subprojects;
- a project page for `riwi-python` that lists the individual Python exercises;
- a project page for `riwi-calculadora` if `calculadora.py` ever ships its own `project.yml`.

In the cards view, both `Riwi Projects` (collection) and `Riwi — Python` (fundamentals) appear in the index. `Riwi — Python` shows a **Pyodide demo** that runs `calculadora.py` directly in the browser.

---

## 5. ID uniqueness across the portfolio

Because every project in the portfolio shares one global namespace, the combination of `(repository.owner, repository.name, project.yml path, id)` must be unique across the whole portfolio.

The portfolio CI performs this check during validation; collisions fail the build with a clear error message pointing at both projects.

If you want to reuse a name, prefix the `id` with the repo name, e.g.:

```yaml
# riwi_projects/python/project.yml
id: riwi_projects-python

# riwi_projects/javascript/project.yml
id: riwi_projects-javascript
```

---

## 6. What is not a monorepo

A repo that contains exactly **one** project should not declare `type: collection` and should not have multiple `project.yml` files. It should have a single `project.yml` at the root.

```text
react-todo/
├── src/
├── package.json
└── project.yml           # ← one project
```

This avoids forcing the portfolio to render a redundant "collection wrapper" around what is really a single project.

---

## 7. Where to go next

- For the full field reference: [02 — The `project.yml` Contract](./02-project-yml-contract.md)
- For how the Astro app walks repositories to find these files: [03 — Portfolio Setup (Astro)](./03-portfolio-setup.md)
- For validation of nested contracts: [07 — Validation & Schema](./07-validation.md)