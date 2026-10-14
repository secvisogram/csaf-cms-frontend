export function EditorScript() {
  // `VITE_EMBED_EDITOR` is set only by `build:prod`.
  return import.meta.env.VITE_EMBED_EDITOR === 'true' ? (
    <script defer src="/secvisogram-editor/secvisogram-editor.js"></script>
  ) : null
}
