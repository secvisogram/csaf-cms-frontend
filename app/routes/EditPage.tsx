import React, { useEffect, useRef, useState } from 'react'
import { useLoaderData } from 'react-router'
import { useTranslation } from 'react-i18next'
import { getAdvisory } from '~/auth/backend'
import { getAppConfig } from '~/auth/appConfig'
import type { Route } from './+types/EditPage'

const LOCALE = 'en'

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

const EditPage: React.FC = () => {
  const data = useLoaderData<typeof clientLoader>()
  const { t } = useTranslation()
  const editorRef = useRef<EditorElement>(null)
  const [doc, setDoc] = useState(data.csaf)
  const [valid, setValid] = useState(true)

  useEffect(() => {
    let cancelled = false
    customElements.whenDefined('secvisogram-editor').then(() => {
      const editor = editorRef.current
      if (cancelled || !editor) return
      editor.locale = LOCALE
      editor.validatorUrl = data.validatorUrl
      editor.doc = data.csaf
      setDoc(data.csaf)
    })
    return () => {
      cancelled = true
    }
  }, [data.csaf, data.validatorUrl])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const handleChange = (event: Event) => {
      setDoc((event as CustomEvent<{ doc: unknown }>).detail.doc)
    }
    const handleValidate = (event: Event) => {
      setValid((event as CustomEvent<{ valid: boolean }>).detail.valid)
    }
    editor.addEventListener('csaf-change', handleChange)
    editor.addEventListener('csaf-validate', handleValidate)
    return () => {
      editor.removeEventListener('csaf-change', handleChange)
      editor.removeEventListener('csaf-validate', handleValidate)
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto mt-2 px-4">
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
    </div>
  )
}

export default EditPage
