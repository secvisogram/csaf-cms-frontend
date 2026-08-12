const css = String.raw
const html = String.raw

const styles = new CSSStyleSheet()
styles.replaceSync(css`
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
  connectedCallback() {
    const shadowRoot = this.shadowRoot ?? this.attachShadow({ mode: 'open' })
    shadowRoot.adoptedStyleSheets = [styles]

    shadowRoot.innerHTML = html`
      <div class="container">
        <span class="title">Secvisogram Mock</span>
        <p>
          This is a mock for testing purposes. In future in a production setup,
          this will be replaced by the real downstripped secvisogram editor.
        </p>
      </div>
    `
  }
}

customElements.define('secvisogram-editor', SecvisogramEditorElement)
