const css = String.raw
const html = String.raw

const styles = new CSSStyleSheet()
styles.replaceSync(css`
  /* Like the real editor: fills the host and scrolls internally. */
  .root {
    height: 100%;
    overflow: auto;
  }

  .tall-content {
    height: 150vh;
  }

  .container {
    display: block;
    border: solid 1px black;
    border-radius: 8px;
    padding-block: 1rem;
    padding-inline: 1rem;
    margin-inline: 1rem;
    margin-block: 1rem;

    > .title {
      font-size: 1.25rem;
      font-weight: bold;
    }
  }
`)

class SecvisogramEditorElement extends HTMLElement {
  #doc = null
  #valid = true
  #docEditor
  #validToggle

  get doc() {
    return this.#doc
  }

  set doc(value) {
    this.#doc = value
    this.#valid = true // each doc write loads a new document, resetting validity state
    this.#render()
  }

  connectedCallback() {
    const shadowRoot = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    shadowRoot.adoptedStyleSheets = [styles]

    shadowRoot.innerHTML = html`
      <div class="root">
        <div class="container">
          <span class="title">Secvisogram Mock</span>
          <p>
            This is a mock for testing purposes. In future in a production
            setup, this will be replaced by the real downstripped secvisogram
            editor.
          </p>
          <textarea data-testid="secvisogram-mock-doc"></textarea>
          <label>
            <input
              type="checkbox"
              data-testid="secvisogram-mock-valid-toggle"
            />
            Document is valid (uncheck to simulate an invalid document)
          </label>
          <div class="tall-content"></div>
        </div>
      </div>
    `

    this.#docEditor = shadowRoot.querySelector(
      '[data-testid="secvisogram-mock-doc"]',
    )
    this.#validToggle = shadowRoot.querySelector(
      '[data-testid="secvisogram-mock-valid-toggle"]',
    )

    this.#docEditor.addEventListener('input', () => this.#handleEdit())
    this.#validToggle.addEventListener('change', () =>
      this.#handleValidToggle(),
    )

    this.#render()
  }

  #render() {
    if (!this.#docEditor) return
    this.#docEditor.value = JSON.stringify(this.#doc ?? null, null, 2)
    this.#validToggle.checked = this.#valid
  }

  #handleEdit() {
    let parsed
    try {
      parsed = JSON.parse(this.#docEditor.value)
    } catch {
      return // the stand-in editor only reacts to well-formed JSON edits
    }
    this.#doc = parsed
    this.dispatchEvent(
      new CustomEvent('csaf-change', {
        bubbles: true,
        detail: { doc: this.#doc },
      }),
    )
    this.#dispatchValidate()
  }

  #handleValidToggle() {
    this.#valid = this.#validToggle.checked
    this.#dispatchValidate()
  }

  #dispatchValidate() {
    const errors = this.#valid
      ? []
      : [{ type: 'error', instancePath: '', message: 'Mock validation error' }]
    this.dispatchEvent(
      new CustomEvent('csaf-validate', {
        bubbles: true,
        detail: { errors, valid: this.#valid },
      }),
    )
  }
}

customElements.define('secvisogram-editor', SecvisogramEditorElement)
