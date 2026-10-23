import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type EditorElement = HTMLElement & {
  doc?: unknown
  locale?: string | undefined
  validatorUrl?: string | undefined
}

/** Property writes on an undefined custom element are lost, so wait for its definition. */
async function whenEditorReady(
  ref: React.RefObject<EditorElement | null>,
  signal: AbortSignal,
): Promise<EditorElement | undefined> {
  await customElements.whenDefined('secvisogram-editor')
  return signal.aborted ? undefined : (ref.current ?? undefined)
}

/**
 * Hosts `<secvisogram-editor>`: passes `locale`, `validatorUrl` and the initial
 * `doc`, and tracks the latest `doc` and validity from the editor's events.
 */
export function useEditorHost(initialDoc: unknown, validatorUrl?: string) {
  const { i18n } = useTranslation()
  const editorRef = useRef<EditorElement>(null)
  const [doc, setDoc] = useState(initialDoc)
  const [valid, setValid] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    whenEditorReady(editorRef, controller.signal).then((editor) => {
      if (editor) editor.locale = i18n.language
    })
    return () => controller.abort()
  }, [i18n.language])

  useEffect(() => {
    const controller = new AbortController()
    whenEditorReady(editorRef, controller.signal).then((editor) => {
      if (!editor) return
      editor.validatorUrl = validatorUrl
      editor.doc = initialDoc
      setDoc(initialDoc)
    })
    return () => controller.abort()
  }, [initialDoc, validatorUrl])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const controller = new AbortController()
    const { signal } = controller
    editor.addEventListener(
      'csaf-change',
      (event) => {
        setDoc((event as CustomEvent<{ doc: unknown }>).detail.doc)
      },
      { signal },
    )
    editor.addEventListener(
      'csaf-validate',
      (event) => {
        setValid((event as CustomEvent<{ valid: boolean }>).detail.valid)
      },
      { signal },
    )
    return () => controller.abort()
  }, [])

  return { editorRef, doc, valid }
}
