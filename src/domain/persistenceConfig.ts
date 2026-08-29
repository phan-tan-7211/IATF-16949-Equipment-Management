import { EVIDENCE_FOLDERS, PERSISTENCE_CONTRACT_VERSION, PERSISTENCE_TABLES } from './persistenceContract'

const DEFAULT_APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzykTZpW60nZEdwXC3Wn2nRZe1ePrvhUwoER1cHjciiDNGZ34kWv_vfvhEpwSor-f95/exec'

export const GOOGLE_PERSISTENCE_CONFIG = {
  contractVersion: PERSISTENCE_CONTRACT_VERSION,
  spreadsheetId: '1zvrMyGDnXy3HMRzFrLYS4IFyuYPsSUTROy22M6Le9VE',
  projectFolderId: '1hxow8p4gir4KRJZUMhEntsrazjAqfVGI',
  tables: PERSISTENCE_TABLES,
  evidenceFolders: {
    'equipment-photos': '1ex_k2dVfqF7r5sVEvJ49HOon-OEwZElV',
    'manuals-and-setup': '1uAqmf5OixXPTGsFtc3uET0GPaQbQ3qna',
    'maintenance-before-after': '1XAgHhU2ivvmVHpUmb55YAhdo46QsMva_',
    'calibration-certificates': '1OnZeZahc0Ik1tzw_6aLNKYL5WptDG45p',
    'calibration-label-photos': '1w-FW9zgE1w6BMaCZCcgzaRZZgT0Kh9R8',
    'tooling-drawings': '1H5RNdmkDp7WpnD-KB_i7TaxoIfdOrtkT',
    'tooling-change-attachments': '15fVIryWNI5HXYUT0ZqitGWAgnZSJrEHy',
    'handover-records': '1Q38dxWv-jh4l4nK0_Yii8WfPnhZ0cpPD',
    'official-pdf-snapshots': '1B-x4wnMLJIxu_mc-XVOHrbRVbhtXE7Im',
  } satisfies Record<(typeof EVIDENCE_FOLDERS)[number], string>,
  frontendDirectGoogleApiAllowed: false,
  persistenceBoundary: 'APPS_SCRIPT_WEB_APP',
  browserTransport: 'APPS_SCRIPT_HTML_BRIDGE',
  deploymentUrlEnv: 'VITE_APPS_SCRIPT_WEB_APP_URL',
  defaultWebAppUrl: DEFAULT_APPS_SCRIPT_WEB_APP_URL,
} as const

export type GooglePersistenceConfig = typeof GOOGLE_PERSISTENCE_CONFIG
