import { createRoot, type Root } from 'react-dom/client'

const SecvisogramEditor: React.FC = () => {
  return <div>A placeholder for the secvisogram</div>
}

class SecvisogramEditorElement extends HTMLElement {
  #root: Root | undefined

  connectedCallback() {
    this.#root?.unmount()

    const shadowRoot = this.shadowRoot ?? this.attachShadow({ mode: 'open' })

    this.#root = createRoot(shadowRoot)
    this.#root.render(<SecvisogramEditor />)
  }
}

customElements.define('secvisogram-editor', SecvisogramEditorElement)
