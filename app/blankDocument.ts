/**
 * The host-defined seed for an unsaved document when no template is chosen.
 * Deliberately not read from the backend: templates are operator-configurable
 * and may be absent.
 */
export const BLANK_DOCUMENT = {
  document: { category: 'csaf_security_advisory', csaf_version: '2.0' },
} as const
