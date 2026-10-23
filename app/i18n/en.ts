export default {
  nav: {
    dashboard: 'Dashboard',
    new: 'New',
    logout: 'Logout',
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
  newDialog: {
    title: 'New document',
    blank: 'Blank document',
    useTemplate: 'Use a template',
    template: 'Template',
    loadingTemplates: 'Loading templates…',
    templatesUnavailable: 'No templates are available.',
    cancel: 'Cancel',
    create: 'Create',
  },
  newPage: {
    heading: 'New document',
    loadFailed: 'The new document could not be loaded.',
    saved: 'Advisory created.',
    saveFailed: 'The advisory could not be created.',
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
