import React from 'react'
import { href, redirect, useLoaderData, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { getAppConfig } from '~/auth/appConfig'
import { createAdvisory, getTemplate } from '~/auth/backend'
import { canCreateDocuments, getUserInfo } from '~/auth/userInfo'
import { BLANK_DOCUMENT } from '~/blankDocument'
import { SaveFooter, type SaveFields } from '~/components/SaveFooter'
import { useNotification } from '~/notifications/NotificationContext'
import { useEditorHost } from '~/useEditorHost'
import type { Route } from './+types/NewPage'

export const clientLoader = async ({ request }: Route.ClientLoaderArgs) => {
  const [userInfo, appConfig] = await Promise.all([
    getUserInfo(),
    getAppConfig(),
  ])
  if (!canCreateDocuments(userInfo)) throw redirect(href('/'))

  const templateId = new URL(request.url).searchParams.get('template')
  let seed: unknown = structuredClone(BLANK_DOCUMENT)
  if (templateId) {
    const template = await getTemplate(templateId)
    if (!template.ok) {
      throw new Response(template.error.message, {
        status: template.error.status,
      })
    }
    seed = template.data
  }
  return { seed, validatorUrl: appConfig.validatorUrl }
}

const NewPage: React.FC = () => {
  const data = useLoaderData<typeof clientLoader>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { notify } = useNotification()
  const { editorRef, doc, valid } = useEditorHost(data.seed, data.validatorUrl)

  const save = async ({ summary, legacyVersion }: SaveFields) => {
    const result = await createAdvisory({
      csaf: doc,
      summary,
      ...(legacyVersion.trim() ? { legacyVersion } : {}),
    }).catch(() => undefined)
    if (!result?.ok) {
      notify({ reason: 'newPage.saveFailed', variant: 'error' })
      return false
    }
    notify({ reason: 'newPage.saved', variant: 'success' })
    await navigate(href('/:advisoryId/edit', { advisoryId: result.data.id }), {
      replace: true,
    })
    return true
  }

  return (
    <div className="max-w-4xl mx-auto mt-2 px-4 pb-16">
      <h2 className="text-lg font-bold">{t('newPage.heading')}</h2>
      <secvisogram-editor ref={editorRef}></secvisogram-editor>
      <pre data-testid="new_page_tracked_doc" hidden>
        {JSON.stringify(doc)}
      </pre>
      <SaveFooter valid={valid} onSave={save} />
    </div>
  )
}

export function ErrorBoundary() {
  const { t } = useTranslation()
  return (
    <main className="pt-4 p-4 container mx-auto">
      <p role="alert">{t('newPage.loadFailed')}</p>
    </main>
  )
}

export default NewPage
