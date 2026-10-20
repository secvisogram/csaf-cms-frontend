export default {
  nav: {
    dashboard: 'Dashboard',
    new: 'New',
    export: 'Export',
  },
  statusBar: {
    documentInvalid: 'Document is invalid:',
    documentValid: 'Document is valid:',
    errors: 'errors',
    warnings: 'warnings',
    infos: 'infos',
  },
  dashboard: {
    heading: 'Advisory Dashboard',
    loadFailed: 'The advisory list could not be loaded.',
    filterLabel: 'Filter advisories',
    columns: {
      title: 'Title',
      trackingId: 'Tracking ID',
      workflowState: 'Workflow State',
      owner: 'Owner',
      currentReleaseDate: 'Current Release Date',
    },
  },
  editPage: {
    heading: 'Edit Page for Advisory with id',
  },
  saveFooter: {
    valid: 'Document is valid',
    invalid: 'Document is invalid',
    save: 'Save…',
    summary: 'Summary',
    legacyVersion: 'Legacy version',
    cancel: 'Cancel',
    submit: 'Save',
    saved: 'Advisory saved',
    saveFailed: 'Could not save the advisory',
  },
  appConfigError: {
    heading: 'Configuration unavailable',
    body: 'The application configuration could not be loaded.',
    retry: 'Retry',
  },
  notifications: {
    dismiss: 'Dismiss',
  },
} as const
