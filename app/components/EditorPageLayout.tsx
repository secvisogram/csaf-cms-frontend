import React from 'react'

type EditorPageLayoutProps = {
  editorRef: React.Ref<HTMLElement>
  heading: string
  children?: React.ReactNode
}

// The editor fills the host and scrolls internally; the bottom padding reserves the space of the fixed SaveFooter.
// overflow-auto keeps editors that still size themselves to 100vh reachable and clear of the footer.
export const EditorPageLayout: React.FC<EditorPageLayoutProps> = ({
  editorRef,
  heading,
  children,
}) => (
  <div className="flex h-full flex-col pb-11">
    <h1 className="sr-only">{heading}</h1>
    <secvisogram-editor
      ref={editorRef}
      className="block min-h-0 flex-1 overflow-auto"
    ></secvisogram-editor>
    {children}
  </div>
)
