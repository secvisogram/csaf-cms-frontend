declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'secvisogram-editor': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        doc?: unknown
        schemaVersion?: string
        locale?: string
        validatorUrl?: string
      }
    }
  }
}
