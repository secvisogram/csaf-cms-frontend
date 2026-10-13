import React from 'react'
import { useLoaderData } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Route } from './+types/EditPage'

export const clientLoader = ({ params }: Route.ClientLoaderArgs) => {
  return { id: params.advisoryId }
}

const EditPage: React.FC = () => {
  const data = useLoaderData<typeof clientLoader>()
  const { t } = useTranslation()

  return (
    <div className="max-w-4xl mx-auto mt-2 px-4">
      <h2 className="text-lg font-bold">
        {t('editPage.heading')} <code>{data.id}</code>
      </h2>
      <secvisogram-editor locale="en"></secvisogram-editor>
    </div>
  )
}

export default EditPage
