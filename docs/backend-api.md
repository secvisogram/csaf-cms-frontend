# Backend API & Data Contracts

This documents the **existing** CSAF CMS backend API surface that secvisogram already calls today. Nothing here is new — it is the contract that
csaf-cms-frontend's own API client must reproduce, since it takes over every backend call secvisogram currently makes (via `app/lib/app/shared/api/backend.js` and `app/lib/app/shared/api/appConfig.js` in the secvisogram repository). The features that use it are listed in [features.md](features.md); the architecture is in [spec.md](spec.md).

## Advisory & workflow endpoints (`/api/v1/...`)

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

## External validator service (companion microservice, not the CMS backend)

| Endpoint                         | Method | Purpose                                                  |
| -------------------------------- | ------ | -------------------------------------------------------- |
| `{validatorUrl}/api/v1/validate` | POST   | Server-side CSAF validation, given `{ tests, document }` |

`validatorUrl` is a separate, optional service (its own origin), unrelated to the CSAF CMS backend proper. The element (secvisogram) calls it directly itself; csaf-cms-frontend never proxies this call — see [the embedding contract](embedding-contract.md).

## App-config endpoint

`GET /.well-known/appspecific/de.bsi.secvisogram.json` — today, fetched by secvisogram itself to detect whether it's running standalone or backend-connected. In the target architecture this endpoint has two separate consumers:

- **csaf-cms-frontend** fetches it for the auth/session fields (`loginAvailable`, `loginUrl`, `logoutUrl`, `userInfoUrl`) — the embedded editor no longer needs to know whether a backend exists at all; the host instead passes `validatorUrl`
  directly to it as a property (see [the embedding contract](embedding-contract.md)).
- **secvisogram's standalone build** keeps its own slimmed-down fetch of the same endpoint, reading only `validatorUrl` and dropping the auth fields entirely — standalone mode has no host to hand it a `validatorUrl` property, so it still needs to source the value itself.

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

The fetch never rejects — on network failure it resolves `{ loginAvailable: false }`, which today drives secvisogram's standalone fallback;
the standalone build's own slimmed-down fetch degrades the same way, simply treating a failed/empty response as "no validator configured". csaf-cms-frontend should adopt an equivalent "config not loaded yet" guard on mount before branching on `loginAvailable`, mirroring the current race-condition handling.

## Advisory data shapes

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

All fields other than `csaf` are CMS/workflow concepts owned exclusively by csaf-cms-frontend; the embedded editor never sees or needs them.

## Permission model

| Permission          | Condition (as implemented today)                                      |
| ------------------- | --------------------------------------------------------------------- |
| `changeable`        | user is in the `editor` group                                         |
| `deletable`         | user is in the `editor` group                                         |
| `canCreateVersion`  | user is in the `editor` group **and** `workflowState === 'Published'` |
| create new advisory | `canCreateDocuments(groups)` (secvisogram's `permissions.js`)         |

These checks are implemented by csaf-cms-frontend, not by the embedded editor; see the "Permission gating" row in the [Feature list](features.md#feature-list).
