---
title: Authorization Model Specification
titleLines: Authorization|Model Specification
subtitle: Roles, permissions, and policy evaluation.
docMark: Technical Specification
version: "1.0"
status: Initial
published: May 17, 2026
description: Specification defining how authorization decisions are expressed and evaluated — roles, permissions, scopes, and policy evaluation.
---

## 1. Purpose

This specification defines how authorization decisions are expressed and evaluated in systems that adopt this model. It establishes:

- the structure of roles and the permission statements they contain;
- the principals to which roles may be bound;
- the scopes in which roles take effect;
- the evaluation algorithm a **Policy Decision Point (PDP)** follows when ruling on a request.

**Not in scope:** authentication, token issuance, identity provisioning, transport security.

---

## 2. Design principles


| #   | Principle                             | Implication                                                                                                                         |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Default-deny**                      | If no permission explicitly grants an action, the action is denied.                                                                 |
| P2  | **Deny-overrides**                    | When grants and denials apply to the same request, denials win.                                                                     |
| P3  | **Explicit over implicit**            | Authority is never inferred from role names, group membership, or convention; it is read from permission statements only.           |
| P4  | **Decision / enforcement separation** | Decision logic (PDP) is independent of the call site (PEP). Services do not embed business rules about who may act — they only ask. |
| P5  | **Auditability**                      | Every non-trivial decision is loggable with sufficient context to reconstruct it.                                                   |


The combination of P1 and P2 means: a permission set that contains both allow and deny for the same action **denies** the action.

---

## 3. Model at a glance

A request is authorized if and only if, after evaluating every applicable permission, the result is `allow`.

```
       Principal
           │
           │  bound (within a Scope)
           ▼
          Role
           │
           │  contains
           ▼
       Permission
           │
           │  evaluates to
           ▼
      allow  |  deny

```

---

## 4. Core entities

### 4.1 Principal

A subject that may be granted roles. Principal types:

- `user` — a human identity, typically a person with credentials.
- `service_account` — a non-human identity owned by an application or workload.
- `client` — a machine-to-machine API consumer.

### 4.2 Scope

A hierarchical container that bounds *where* a role applies. Three tiers, in order of breadth:


| Tier         | Identifier pattern                      |
| ------------ | --------------------------------------- |
| Built-in     | `roles/IDENTIFIER`                      |
| Organization | `organizations/ORG_ID/roles/IDENTIFIER` |
| Project      | `projects/PROJECT_ID/roles/IDENTIFIER`  |


A role bound at a broader tier takes effect in every scope nested within it. A role bound at organization level applies to every project within that organization.

### 4.3 Role

A named bundle of permission statements that expresses a job function or capability set — for example, `auditor`, `editor`, `billing-admin`.

Each role has:

- **Identifier** — the qualified name (see §4.2).
- **Description** — a human-readable purpose statement.
- **Permissions** — the list of permission statements the role contains.
- **Bindings** — the principals to whom the role has been granted. Bindings are not part of the role definition itself; see §4.4.

### 4.4 Binding

A binding is the explicit assignment of a principal to a role within a scope. Bindings are the join between identity and authority; **nothing else confers permissions**.

A binding is a triple `(principal, role, scope)`.

### 4.5 Permission statement

An atomic authorization claim with the following components:


| Component    | Required | Default | Notes                                               |
| ------------ | -------- | ------- | --------------------------------------------------- |
| Organization | yes      | —       | The owning organization namespace.                  |
| Service      | yes      | —       | The service or API the permission targets.          |
| Resource     | yes      | —       | The resource type, e.g. `suppliers`.                |
| Field        | no       | `*`     | Restricts the statement to a single resource field. |
| Resource ID  | no       | `*`     | Restricts the statement to a single instance.       |
| Effect       | yes      | —       | `allow` or `deny`.                                  |
| Action       | yes      | —       | The verb, e.g. `read`, `update`, `delete`.          |


If a permission's field or resource-ID component is set on an action where it cannot apply — for example, an `allow:create` permission carrying a resource ID, when the instance does not yet exist — the component is **ignored** by the evaluator rather than treated as an error.

---

## 5. Permission grammar

Permission statements are serialized as a single string. The string form is compact enough for transport in JWT claims while remaining readable to operators.

### 5.1 String form

```
<organization>:<service>/<resource>[:<field>[:<resource_id>]]/<effect>/<action>

```

Reading the parts:

- `<organization>:<service>` — the **service group**: who owns the API and which API.
- `<resource>[:<field>[:<resource_id>]]` — the **resource group**: what the action targets.
- `<effect>/<action>` — the **decision group**: what the statement claims.

### 5.2 Character set

Each segment matches `[A-Za-z0-9_-]+`, or the single wildcard character `*`.

Segments should be written in **camelCase**. Use **snake_case** only where required to match an external schema, such as an existing API field name. Other casing styles should not be used.

### 5.3 Wildcards

The `*` token substitutes for any value of a segment, **except** `<effect>`, which must always be a literal `allow` or `deny`.

Wildcards are powerful and easy to misuse. A statement of the form `*:*/*/allow/`* confers superuser authority and violates P1 unless deliberately scoped. Wildcards should not appear in the `<organization>` segment of an end-user role.

### 5.4 EBNF grammar

```ebnf
permission       = service_group "/" resource_group "/" effect "/" action ;
service_group    = org_segment ":" service_segment ;
resource_group   = resource_segment [ ":" field_segment [ ":" id_segment ] ] ;
org_segment      = identifier | "*" ;
service_segment  = identifier | "*" ;
resource_segment = identifier | "*" ;
field_segment    = identifier | "*" ;
id_segment       = identifier | "*" ;
action           = identifier | "*" ;
effect           = "allow" | "deny" ;
identifier       = ( letter | digit | "_" | "-" )+ ;

```

### 5.5 Validation regex

```
/^([\w\-]+|\*):([\w\-]+|\*)\/([\w\-]+|\*)(?::([\w\-]+|\*))?(?::([\w\-]+|\*))?\/(allow|deny)\/([\w\-]+|\*)$/

```

Non-capturing groups enclose the optional segments.

---

## 6. Evaluation algorithm

Given a request `(principal, action, resource_uri)` and the principal's effective permission set `P`, the PDP returns `allow` if and only if the procedure below produces it:

1. **Filter applicable statements.** For each statement `s ∈ P`, retain `s` if the organization, service, resource, field, and resource-id segments of `s` either match the corresponding parts of `resource_uri` exactly or are `*`; and the action segment equals the requested action or is `*`.
2. **Apply deny-overrides.** Among retained statements, if any has `effect = deny`, return **deny**.
3. **Apply default-deny.** If at least one retained statement has `effect = allow` and no retained statement has `effect = deny`, return **allow**. Otherwise, return **deny**.

Pseudocode:

```python
def evaluate(request, permissions):
    applicable = [p for p in permissions if matches(p, request)]
    if any(p.effect == "deny" for p in applicable):
        return Decision.DENY
    if any(p.effect == "allow" for p in applicable):
        return Decision.ALLOW
    return Decision.DENY  # default

```

The evaluator is **specificity-agnostic**: a wildcard `allow` and a specific `deny` do not interact via specificity ordering — the deny wins because of P2.

---

## 7. Conditions (optional, non-normative)

For scenarios beyond pure RBAC — time-bound access, IP restrictions, attribute checks on the resource — the model may be extended with a fourth group:

```
<service_group>/<resource_group>/<effect>/<action>?<condition_id>

```

where `<condition_id>` references a condition expression stored separately. Condition expressions are evaluated as additional predicates during step 1 of the algorithm; a statement whose condition is false is dropped from the applicable set.

This section is non-normative; conditions are a planned extension and should be introduced only when a concrete use case requires them.

---

## 8. Worked examples

The examples below assume an organization named `acme` operating a service `api`.


| #   | Goal                                             | Permission statement(s)                                                             |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 1   | Allow updating any supplier                      | `acme:api/suppliers/allow/update`                                                   |
| 2   | Allow reading all suppliers except `12345`       | `acme:api/suppliers/allow/read` <br> `acme:api/suppliers:*:12345/deny/read`         |
| 3   | Allow every action on suppliers except deletion  | `acme:api/suppliers/allow/*` <br> `acme:api/suppliers/deny/delete`                  |
| 4   | Allow reading only the `email` field of contacts | `acme:api/contacts:email/allow/read`                                                |
| 5   | Equivalent forms (defaults applied)              | `acme:api/suppliers/allow/read` ≡ `acme:api/suppliers:*:*/allow/read`               |
| 6   | Conflict — `read` is denied (P2)                 | `acme:api/suppliers/allow/read` <br> `acme:api/suppliers/deny/read` <br> → **deny** |


---

## 9. Decision logging

Every authorization decision should be logged with at least:

- timestamp;
- principal identifier;
- requested action and resource URI;
- the retained set of permission statements;
- the decision returned;
- the binding(s) that produced the deciding statement(s).

Logs **must not** contain the user's bearer token. Where the resource URI may contain personal data, implementers should apply their organization's privacy and data-retention policies before persistence.

---

## 10. Schema versioning

The permission string format is itself a contract. Breaking changes — adding required segments, changing delimiters, redefining the effect set — require a version bump and a migration plan.

This document is **v1.0**. Implementations must reject permission strings whose form does not match the regex in §5.5 rather than guess at intent.

---

## 11. Changelog

- **v1.0** — May 17, 2026 — Initial version.
