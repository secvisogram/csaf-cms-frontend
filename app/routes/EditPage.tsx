import React, { useEffect, useRef, useState } from 'react'
import { useLoaderData } from 'react-router'
import { useTranslation } from 'react-i18next'
import { getAdvisory, updateAdvisory } from '~/auth/backend'
import { getAppConfig } from '~/auth/appConfig'
import { SaveFooter, type SaveFields } from '~/components/SaveFooter'
import { useNotification } from '~/notifications/NotificationContext'
import type { Route } from './+types/EditPage'

export const clientLoader = async ({ params }: Route.ClientLoaderArgs) => {
  const [detail, appConfig] = await Promise.all([
    getAdvisory(params.advisoryId),
    getAppConfig(),
  ])
  if (!detail.ok) {
    throw new Response(detail.error.message, { status: detail.error.status })
  }
  return {
    advisoryId: params.advisoryId,
    revision: detail.data.revision,
    csaf: detail.data.csaf,
    validatorUrl: appConfig.validatorUrl,
  }
}

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

const EditPage: React.FC = () => {
  const data = useLoaderData<typeof clientLoader>()
  const { t, i18n } = useTranslation()
  const editorRef = useRef<EditorElement>(null)
  const [doc, setDoc] = useState(data.csaf)
  const [valid, setValid] = useState(true)
  const [revision, setRevision] = useState(data.revision)
  const { notify } = useNotification()

  useEffect(() => {
    setRevision(data.revision)
  }, [data.revision])

  const save = async ({ summary, legacyVersion }: SaveFields) => {
    const result = await updateAdvisory(data.advisoryId, revision, {
      csaf: doc,
      summary,
      ...(legacyVersion.trim() ? { legacyVersion } : {}),
    }).catch(() => undefined)
    if (!result?.ok) {
      notify({ reason: 'saveFooter.saveFailed', variant: 'error' })
      return false
    }
    setRevision(result.data.revision)
    notify({ reason: 'saveFooter.saved', variant: 'success' })
    return true
  }

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
      editor.validatorUrl = data.validatorUrl
      editor.doc = data.csaf
      setDoc(data.csaf)
    })
    return () => controller.abort()
  }, [data.csaf, data.validatorUrl])

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

  return (
    <div className="max-w-4xl mx-auto mt-2 px-4 pb-16">
      <h2 className="text-lg font-bold">
        {t('editPage.heading')} <code>{data.advisoryId}</code>
      </h2>
      <secvisogram-editor ref={editorRef}></secvisogram-editor>
      {/* Test-only seam for the tracked doc/validity state; ticket 18 reads this for Save. */}
      <pre data-testid="edit_page_tracked_doc" hidden>
        {JSON.stringify(doc)}
      </pre>
      <p data-testid="edit_page_tracked_valid" hidden>
        {String(valid)}
      </p>
      <SaveFooter valid={valid} onSave={save} />
    </div>
  )
}

export default EditPage
