declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'secvisogram-editor': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        doc?: unknown
        locale?: string
        validatorUrl?: string
      }
    }
  }
}
