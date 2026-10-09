# Features & Responsibilities

What csaf-cms-frontend owns: everything CMS-related that the standalone secvisogram editor does not do, plus every call into the existing backend API (see [backend-api.md](backend-api.md)). The embedded editor's contract is in [embedding-contract.md](embedding-contract.md); the architecture is in [spec.md](spec.md).

## Feature list

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
| Permission gating (who can create/edit/delete)           | `permissions.js` (`canCreateDocuments`) + list-item `changeable`/`deletable`/`canCreateVersion` flags | derived from advisory list/detail responses (see the [permission model](backend-api.md#permission-model))                                                       |
| Hosting the embedded editor                              | n/a (new)                                                                                             | none directly — the edit page wires `<secvisogram-editor>`'s `doc` property and `csaf-change`/`csaf-validate` events to its own Save button and the calls above |
| About/version display                                    | `aboutModal`                                                                                          | `GET /about`                                                                                                                                                    |

## Edit-advisory page responsibilities specifically

This is the page that renders `<secvisogram-editor>` (see [the embedding contract](embedding-contract.md) for the full contract). It must:

1. Fetch the advisory detail (or template) and set it as the element's initial `doc`.
2. Keep the latest `doc` value from `csaf-change` events (or read the property directly before saving).
3. Track validity from `csaf-validate` events to enable/disable its own Save button.
4. Own the Save UI itself: a save action plus a summary/legacy-version input, calling `createAdvisory`/`updateAdvisory` with the tracked `doc`, the `revision` it fetched earlier, and the summary text.
5. Show its own success/error toast for the save result (the embedded editor no longer has any concept of "saved to backend").
