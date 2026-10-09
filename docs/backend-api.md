# Backend API & CMS Responsibilities

Detail behind [spec.md](spec.md): the features csaf-cms-frontend owns and the existing csaf-cms-backend API it consumes. The embedded editor's contract is in [embedding-contract.md](embedding-contract.md).

## csaf-cms-frontend Responsibilities

The frontend owns everything CMS-related that the standalone secvisogram editor does not do, and every call into the existing backend API (see
[Backend API & Data Contracts](#backend-api--data-contracts)).

### Feature list

| Feature                                                  | Replaces / based on                                                                                   | Backend calls used                                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication/session (login, logout, user info)        | `App.js` auth wiring, `AppConfigContext`'s `loginUrl`/`logoutUrl`/`userInfoUrl`                       | app-config endpoint, OAuth2 flow                                                                                                                                |
| Advisory dashboard (list, filter, view status)           | `DocumentsTab/View.js`                                                                                | `GET /advisories`                                                                                                                                               |
| Advisory create flow (template picker → new editor page) | `DocumentsTab` "new" action + secvisogram's standalone template logic                                 | `GET /advisories/templates`, `GET /advisories/templates/{id}`                                                                                                   |
| Advisory edit page (hosts the embedded editor)           | `DocumentsTab` "edit" action + `View.js` advisory-loading pipeline                                    | `GET /advisories/{id}`                                                                                                                                          |
| Save (create or update)                                  | `View.js` save flow + `VersionSummaryDialog`                                                          | `POST /advisories`, `PATCH /advisories/{id}?revision=`                                                                                                          |
| Delete advisory                                          | `DocumentsTab/View.js` delete action                                                                  | `DELETE /advisories/{id}?revision=`                                                                                                                             |
| Workflow-state management                                | `DocumentsTab/View/EditWorkflowStateDialog.js`                                                        | `PATCH /advisories/{id}/workflowstate/{state}`                                                                                                                  |
| Create new version (from Published)                      | `DocumentsTab/View.js` "create new version" action                                                    | `PATCH /advisories/{id}/createNewVersion`                                                                                                                       |
| Permalink / direct-advisory-link                         | `useDirectAdvisoryLinkRedirect.js` + copy-permalink button                                            | `GET /advisories/{id}` (on landing) — simplified vs. today since there's only one app/origin, no `?tab=` handoff needed                                         |
| Permission gating (who can create/edit/delete)           | `permissions.js` (`canCreateDocuments`) + list-item `changeable`/`deletable`/`canCreateVersion` flags | derived from advisory list/detail responses                                                                                                                     |
| Hosting the embedded editor                              | n/a (new)                                                                                             | none directly — the edit page wires `<secvisogram-editor>`'s `doc` property and `csaf-change`/`csaf-validate` events to its own Save button and the calls above |
| About/version display                                    | `aboutModal`                                                                                          | `GET /about`                                                                                                                                                    |

### Edit-advisory page responsibilities specifically

This is the page that renders `<secvisogram-editor>` (see
[the embedding contract](embedding-contract.md) for the full contract). It
must:

1. Fetch the advisory detail (or template) and set it as the element's initial
   `doc`.
2. Keep the latest `doc` value from `csaf-change` events (or read the property
   directly before saving).
3. Track validity from `csaf-validate` events to enable/disable its own Save
   button.
4. Own the Save UI itself: a save action plus a summary/legacy-version input,
   calling `createAdvisory`/`updateAdvisory` with the tracked `doc`, the
   `revision` it fetched earlier, and the summary text.
5. Show its own success/error toast for the save result (the embedded editor no
   longer has any concept of "saved to backend").

## Backend API & Data Contracts

This documents the **existing** CSAF CMS backend API surface that secvisogram
already calls today. Nothing here is new — it is the contract that
csaf-cms-frontend's own API client must reproduce, since it takes over every
backend call secvisogram currently makes (via
`app/lib/app/shared/api/backend.js` and `app/lib/app/shared/api/appConfig.js` in
the secvisogram repository).

### Advisory & workflow endpoints (`/api/v1/...`)

| Endpoint                                         | Method | Purpose                                        | Key request params                                              | Notes                                                                                                                                           |
| ------------------------------------------------ | ------ | ---------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/advisories`                                    | POST   | Create a new advisory                          | `{ csaf, summary, legacyVersion }`                              | `csaf` is the full CSAF document                                                                                                                |
| `/advisories`                                    | GET    | List all advisories                            | —                                                               | Returns advisory summaries (see shape below)                                                                                                    |
| `/advisories/{advisoryId}`                       | GET    | Get full advisory detail                       | path: `advisoryId`                                              | Returns `csaf` + CMS metadata + `revision`                                                                                                      |
| `/advisories/{advisoryId}`                       | PATCH  | Update an advisory                             | `{ csaf, summary, legacyVersion }`, query: `revision`           | Optimistic concurrency via `revision`                                                                                                           |
| `/advisories/{advisoryId}`                       | DELETE | Delete an advisory                             | query: `revision`                                               |                                                                                                                                                 |
| `/advisories/{advisoryId}/workflowstate/{state}` | PATCH  | Change workflow state                          | `{ documentTrackingStatus?, proposedTime? }`, query: `revision` |                                                                                                                                                 |
| `/advisories/{advisoryId}/createNewVersion`      | PATCH  | Create a new version from a published advisory | query: `revision`                                               |                                                                                                                                                 |
| `/advisories/templates`                          | GET    | List available templates                       | —                                                               |                                                                                                                                                 |
| `/advisories/templates/{templateId}`             | GET    | Get a template's CSAF content                  | path: `templateId`                                              | Used to seed a new advisory                                                                                                                     |
| `/advisories/{advisoryId}/csaf`                  | GET    | Export advisory document                       | query: `format`                                                 | Existing export path; export itself also has a fully local/offline path inside the editor (see [the embedding contract](embedding-contract.md)) |
| `/about`                                         | GET    | Backend version/info                           | —                                                               | Display-only                                                                                                                                    |

### External validator service (companion microservice, not the CMS backend)

| Endpoint                         | Method | Purpose                                                  |
| -------------------------------- | ------ | -------------------------------------------------------- |
| `{validatorUrl}/api/v1/validate` | POST   | Server-side CSAF validation, given `{ tests, document }` |

`validatorUrl` is a separate, optional service (its own origin), unrelated to the
CSAF CMS backend proper. The element (secvisogram) calls it directly itself;
csaf-cms-frontend never proxies this call — see
[the embedding contract](embedding-contract.md).

### App-config endpoint

`GET /.well-known/appspecific/de.bsi.secvisogram.json` — today, fetched by
secvisogram itself to detect whether it's running standalone or backend-connected.
In the target architecture this endpoint has two separate consumers:

- **csaf-cms-frontend** fetches it for the auth/session fields (`loginAvailable`,
  `loginUrl`, `logoutUrl`, `userInfoUrl`) — the embedded editor no longer needs to
  know whether a backend exists at all; the host instead passes `validatorUrl`
  directly to it as a property (see
  [the embedding contract](embedding-contract.md)).
- **secvisogram's standalone build** keeps its own slimmed-down fetch of the same
  endpoint, reading only `validatorUrl` and dropping the auth fields entirely —
  standalone mode has no host to hand it a `validatorUrl` property, so it still
  needs to source the value itself.

Full shape returned by the endpoint (unchanged):

```
{
  loginAvailable: boolean,
  loginUrl?: string,
  logoutUrl?: string,
  userInfoUrl?: string,
  validatorUrl?: string,
  keyBindings?: { ...keyboard-shortcut overrides }
}
```

The fetch never rejects — on network failure it resolves
`{ loginAvailable: false }`, which today drives secvisogram's standalone fallback;
the standalone build's own slimmed-down fetch degrades the same way, simply
treating a failed/empty response as "no validator configured". csaf-cms-frontend
should adopt an equivalent "config not loaded yet" guard on mount before
branching on `loginAvailable`, mirroring the current race-condition handling.

### Advisory data shapes

**List item** (`GET /advisories` → `advisories[]`):

| Field                 | Type     | Meaning                                                            |
| --------------------- | -------- | ------------------------------------------------------------------ |
| `advisoryId`          | string   | Identifier                                                         |
| `workflowState`       | string   | Current lifecycle state                                            |
| `documentTrackingId`  | string   | CSAF `document.tracking.id`                                        |
| `title`               | string   | Document title                                                     |
| `owner`               | string   | Owning user/group                                                  |
| `changeable`          | boolean  | Current user may edit                                              |
| `deletable`           | boolean  | Current user may delete                                            |
| `canCreateVersion`    | boolean  | True when `workflowState === 'Published'` and user has editor role |
| `allowedStateChanges` | string[] | Valid next workflow states                                         |
| `currentReleaseDate`  | string?  | ISO date, if applicable                                            |

**Detail** (`GET /advisories/{id}`): all of the above, plus:

| Field      | Type   | Meaning                                                                                             |
| ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| `revision` | string | CouchDB-style token, required on every mutating call                                                |
| `csaf`     | object | The full CSAF document — this is the only field passed into `<secvisogram-editor>`'s `doc` property |

All fields other than `csaf` are CMS/workflow concepts owned exclusively by
csaf-cms-frontend; the embedded editor never sees or needs them.

### Permission model

| Permission          | Condition (as implemented today)                                      |
| ------------------- | --------------------------------------------------------------------- |
| `changeable`        | user is in the `editor` group                                         |
| `deletable`         | user is in the `editor` group                                         |
| `canCreateVersion`  | user is in the `editor` group **and** `workflowState === 'Published'` |
| create new advisory | `canCreateDocuments(groups)` (secvisogram's `permissions.js`)         |

This model moves wholesale into csaf-cms-frontend; see
[csaf-cms-frontend Responsibilities](#csaf-cms-frontend-responsibilities).
