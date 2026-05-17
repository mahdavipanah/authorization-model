# Authorization Model Specification

This repository publishes a **normative specification** for how authorization decisions are expressed and evaluated on the platform. The canonical document is [`authorization-model.md`](authorization-model.md).

## What this specification defines

The spec covers roles, permissions, and policy evaluation. It is intended for implementers of Policy Decision Points (PDPs), Policy Enforcement Points (PEPs), and operators who define or audit access control.

**In scope:**

- Structure of roles and the permission statements they contain
- Principals to which roles may be bound
- Scopes in which roles take effect
- The evaluation algorithm a PDP follows when ruling on a request

**Out of scope:** authentication, token issuance, identity provisioning, and transport security.

## Design principles

| Principle | Summary |
| --- | --- |
| **Default-deny** | If no permission explicitly grants an action, the action is denied. |
| **Deny-overrides** | When grants and denials apply to the same request, denials win. |
| **Explicit over implicit** | Authority comes only from permission statements, not from role names or convention. |
| **Decision / enforcement separation** | PDP logic is independent of PEP call sites; services ask, they do not embed business rules. |
| **Auditability** | Every non-trivial decision is loggable with enough context to reconstruct it. |

## Model at a glance

A request is authorized if and only if, after evaluating every applicable permission, the result is `allow`.

```
Principal ──bound (within Scope)──▶ Role ──contains──▶ Permission ──▶ allow | deny
```

Core entities:

- **Principal** — `user`, `service_account`, or `client`
- **Scope** — built-in, organization, or project tier (roles apply within a scope and inherit downward)
- **Role** — named bundle of permission statements (e.g. `auditor`, `survey-editor`)
- **Binding** — explicit `(principal, role, scope)` assignment; nothing else confers permissions
- **Permission statement** — atomic claim targeting organization, service, resource, optional field/ID, effect, and action

Permissions use a compact string grammar (suitable for JWT claims) and are evaluated with default-deny and deny-overrides semantics. See the spec for the full grammar, EBNF, validation rules, worked examples, and decision logging requirements.

## Repository layout

| Path | Purpose |
| --- | --- |
| `authorization-model.md` | Source-of-truth specification |
| `src/pages/index.astro` | Renders the spec as HTML at build time |
| `.github/workflows/deploy.yml` | Builds and deploys to GitHub Pages on push to `main` |

## Reading and editing the spec

- **Read:** open [`authorization-model.md`](authorization-model.md) in this repo, or use the published site after deployment (see below).
- **Change:** edit `authorization-model.md`, commit, and push; the site rebuilds automatically when GitHub Actions is configured.

## Site rendering and deployment

This repo also includes a small [Astro](https://astro.build/) site that turns the markdown spec into a static HTML page for easier reading on the web.

### How it works

- `authorization-model.md` is the single source of truth.
- `src/pages/index.astro` reads that file and converts markdown to HTML at build time.
- `.github/workflows/deploy.yml` builds `dist/` and deploys to GitHub Pages when you push to `main`.

### Local development

- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Build production output: `npm run build`
- Preview build locally: `npm run preview`

### Publishing on GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch.
2. In GitHub, open **Settings > Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push a commit to `main` (or run the workflow manually from the Actions tab).
5. After deploy finishes, the site is available at:
   - `https://<github-username>.github.io/<repository-name>/`
