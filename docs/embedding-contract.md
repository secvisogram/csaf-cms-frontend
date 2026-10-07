# Embedding Contract: `<secvisogram-editor>`

## Purpose

csaf-cms-frontend treats the secvisogram editor exclusively as an opaque custom element, `<secvisogram-editor>`. The host and the element communicate only through the properties and events documented here: properties flow in, events flow out. The element never calls csaf-cms-backend and never receives cookies or tokens; its only direct network call is the optional request to the validator microservice (see `validatorUrl`).

This contract is shared by the host (csaf-cms-frontend) and the editor (secvisogram). Changing it affects both repositories. For the rationale, see ADR 1 and the Custom-Element Embedding Concept in [spec.md](spec.md).

## Properties

All properties are set as JavaScript properties on the element, not as string attributes.

| Property       | Type             | Direction                            | Optional | Description                                                         |
| -------------- | ---------------- | ------------------------------------ | -------- | ------------------------------------------------------------------- |
| `doc`          | CSAF JSON object | host → element, readable by the host | Yes      | The CSAF document being edited.                                     |
| `locale`       | string           | host → element                       | Yes      | Language code of the editor's own UI, for example `'en'`.           |
| `validatorUrl` | string           | host → element                       | Yes      | Base URL of the validator microservice, used for remote validation. |

### `doc`

- The host sets `doc` to load a document and reads it to obtain the latest value, for example before saving.
- Every write loads a new document. The editor resets its state and undo history; the write is not an incremental update and does not emit `csaf-change`.
- A host-supplied document follows the same version detection as a document opened from a file or URL. Loading a CSAF 2.1 document while the editor is not in 2.1 mode shows the existing beta confirmation. Confirming switches to 2.1 and loads the document; canceling leaves the current document unchanged. Other documents are loaded without being rewritten to match the current mode.
- The editor has no public `schemaVersion` property. It starts in CSAF 2.0 until a loaded document changes its mode.
- If `doc` is never set, the editor's own New Document flow stays available with its locally generated minimal and all-fields documents. Templates provided by the CMS are fetched by the host and passed in as `doc`.

### `locale`

- Setting `locale` changes the language of the editor's own i18next instance. The editor keeps its translations independently of the host.
- Locale changes are not reported back to the host.

### `validatorUrl`

- When set, the editor may call `POST {validatorUrl}/api/v1/validate` directly when the user requests remote validation.
- When unset, client-side validation continues and no remote request is made.

## Events

Both events are standard `CustomEvent`s dispatched on the `<secvisogram-editor>` element. Hosts must attach their listeners to the element itself; bubbling is not guaranteed.

| Event           | `detail`            | Fired when                                                                                                      |
| --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `csaf-change`   | `{ doc }`           | The document changes inside the editor, for example by a form edit, a source edit or applying a local template. |
| `csaf-validate` | `{ errors, valid }` | A validation result is ready, after the debounced client-side validation (and the remote check, if requested).  |

### `csaf-change`

- `detail.doc` is the current CSAF document.
- It is not emitted for host-originated `doc` writes.

### `csaf-validate`

- `detail.valid` is `true` only if the client-side result and, when requested, the remote result are both valid.
- Each entry in `detail.errors` has:

  | Field          | Type                                 | Description                                 |
  | -------------- | ------------------------------------ | ------------------------------------------- |
  | `type`         | `'error'` \| `'warning'` \| `'info'` | Severity of the entry.                      |
  | `instancePath` | string                               | JSON pointer to the affected part of `doc`. |
  | `message`      | string                               | Human-readable description.                 |

- A failure to reach the validator microservice is an editor-local notification and does not mark the document as invalid.
- A host that only needs to enable or disable saving can rely on `valid` alone, without interpreting CSAF-specific error paths.

## Minimal host example

Property writes on an element that is not yet defined can be lost, so the host waits for the element definition before writing.

```ts
const editor = document.querySelector('secvisogram-editor')!

editor.addEventListener('csaf-change', (event) => {
  const { doc } = (event as CustomEvent<{ doc: unknown }>).detail
  // keep the latest document for saving
})

editor.addEventListener('csaf-validate', (event) => {
  const { valid, errors } = (
    event as CustomEvent<{
      valid: boolean
      errors: { type: string; instancePath: string; message: string }[]
    }>
  ).detail
  // enable or disable saving based on `valid`
})

await customElements.whenDefined('secvisogram-editor')
editor.locale = 'en'
editor.validatorUrl = 'https://validator.example.com'
editor.doc = csafDocument
```
