import React, { useEffect, useState } from 'react'
import { useLoaderData } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  getAdvisory,
  isStaleRevisionError,
  updateAdvisory,
} from '~/auth/backend'
import { getAppConfig } from '~/auth/appConfig'
import { EditorPageLayout } from '~/components/EditorPageLayout'
import { SaveFooter, type SaveFields } from '~/components/SaveFooter'
import { StaleRevisionBanner } from '~/components/StaleRevisionBanner'
import { useNotification } from '~/notifications/NotificationContext'
import { useEditorHost } from '~/useEditorHost'
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

const EditPage: React.FC = () => {
  const data = useLoaderData<typeof clientLoader>()
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState({
    csaf: data.csaf,
    revision: data.revision,
  })
  const [conflict, setConflict] = useState(false)
  const { editorRef, doc, valid } = useEditorHost(
    loaded.csaf,
    data.validatorUrl,
  )
  const heading = `${t('editPage.heading')} ${data.advisoryId}`
  const { notify } = useNotification()

  useEffect(() => {
    setLoaded({ csaf: data.csaf, revision: data.revision })
    setConflict(false)
  }, [data.csaf, data.revision])

  const save = async ({ summary, legacyVersion }: SaveFields) => {
    const result = await updateAdvisory(data.advisoryId, loaded.revision, {
      csaf: doc,
      summary,
      ...(legacyVersion.trim() ? { legacyVersion } : {}),
    }).catch((error) => {
      console.error(error)
      return undefined
    })
    if (!result?.ok) {
      if (result && isStaleRevisionError(result.error)) {
        setConflict(true)
      } else {
        notify({ reason: 'saveFooter.saveFailed', variant: 'error' })
      }
      return false
    }
    setLoaded((current) => ({ ...current, revision: result.data.revision }))
    notify({ reason: 'saveFooter.saved', variant: 'success' })
    return true
  }

  // Fetched directly instead of revalidating the route: a failed loader would replace the page and lose the local edits.
  const reload = async () => {
    const detail = await getAdvisory(data.advisoryId).catch((error) => {
      console.error(error)
      return undefined
    })
    if (!detail?.ok) {
      notify({ reason: 'staleRevision.reloadFailed', variant: 'error' })
      return
    }
    setLoaded({ csaf: detail.data.csaf, revision: detail.data.revision })
    setConflict(false)
  }

  return (
    <EditorPageLayout
      editorRef={editorRef}
      heading={heading}
      banner={conflict && <StaleRevisionBanner onReload={reload} />}
    >
      {/* Test-only seam for the tracked doc/validity state; ticket 18 reads this for Save. */}
      <pre data-testid="edit_page_tracked_doc" hidden>
        {JSON.stringify(doc)}
      </pre>
      <p data-testid="edit_page_tracked_valid" hidden>
        {String(valid)}
      </p>
      <SaveFooter
        heading={heading}
        valid={valid}
        saveBlocked={conflict}
        onSave={save}
      />
    </EditorPageLayout>
  )
}

export default EditPage
