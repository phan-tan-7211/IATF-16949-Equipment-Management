import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const root = process.cwd()
const srcRoot = resolve(root, 'src')
const equipmentRoot = resolve(srcRoot, 'equipment')
const violations = []

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

function text(path) {
  return readFileSync(path, 'utf8')
}

function report(path, message) {
  violations.push(`${relative(root, path)}: ${message}`)
}

const sourceFiles = walk(srcRoot).filter((path) => ['.ts', '.tsx', '.js', '.jsx', '.css'].includes(extname(path)))
const equipmentFiles = sourceFiles.filter((path) => path.startsWith(equipmentRoot))

for (const path of sourceFiles) {
  const body = text(path)
  if (body.includes('LiveEquipmentPanel')) report(path, 'legacy mixed LiveEquipmentPanel reference is forbidden')
}

for (const path of equipmentFiles) {
  const body = text(path)
  const normalized = path.replaceAll('\\', '/')

  if (normalized.includes('/equipment/desktop/')) {
    if (/from\s+['"][^'"]*mobile\//.test(body) || /import\(['"][^'"]*mobile\//.test(body)) {
      report(path, 'desktop must not import mobile code')
    }
  }

  if (normalized.includes('/equipment/mobile/')) {
    if (/from\s+['"][^'"]*desktop\//.test(body) || /import\(['"][^'"]*desktop\//.test(body)) {
      report(path, 'mobile must not import desktop code')
    }
  }

  if (normalized.includes('/equipment/shared/')) {
    if (/from\s+['"][^'"]*(desktop|mobile)\//.test(body) || /import\(['"][^'"]*(desktop|mobile)\//.test(body)) {
      report(path, 'shared layer must not import platform presentation')
    }
    if (/supabaseClient|@supabase\/supabase-js/.test(body)) {
      report(path, 'shared UI/controller must use repositories/services instead of importing Supabase client directly')
    }
    if (extname(path) === '.css' && /@media\b/.test(body)) {
      report(path, 'shared CSS must not contain viewport media queries')
    }
  }
}

const required = [
  'src/equipment/EquipmentWorkspace.tsx',
  'src/equipment/desktop/EquipmentDesktopWorkspace.tsx',
  'src/equipment/desktop/EquipmentDesktopPanel.tsx',
  'src/equipment/mobile/EquipmentMobileWorkspace.tsx',
  'src/equipment/mobile/EquipmentMobilePanel.tsx',
  'src/equipment/shared/styles/EquipmentPrimitives.css',
  'src/equipment/shared/styles/EquipmentSheetPrimitives.css',
]
for (const requiredPath of required) {
  const absolute = resolve(root, requiredPath)
  if (!existsSync(absolute)) violations.push(`${requiredPath}: required architecture file is missing`)
}

const compatibilityEntrypoints = {
  'src/Equipment.css': "@import './equipment/shared/styles/EquipmentPrimitives.css';",
  'src/EquipmentSheetView.css': "@import './equipment/shared/styles/EquipmentSheetPrimitives.css';",
}
for (const [path, expectedImport] of Object.entries(compatibilityEntrypoints)) {
  const absolute = resolve(root, path)
  if (!existsSync(absolute) || !text(absolute).includes(expectedImport)) {
    violations.push(`${path}: must remain a thin compatibility entrypoint until all legacy consumers are migrated`)
  }
}

if (violations.length) {
  console.error('\nPlatform architecture violations:\n')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log('Platform architecture check passed.')
