const EVIDENCE_FOLDER_ALLOWLIST = Object.freeze([
  'equipment-photos',
  'manuals-and-setup',
  'maintenance-before-after',
  'calibration-certificates',
  'calibration-label-photos',
  'tooling-drawings',
  'tooling-change-attachments',
  'handover-records',
  'official-pdf-snapshots',
])

const EVIDENCE_ENTITY_TYPES = Object.freeze([
  'EQUIPMENT',
  'INSPECTION',
  'MAINTENANCE',
  'HANDOVER',
  'DOWNTIME',
  'TOOLING',
  'CALIBRATION',
  'MOVEMENT',
  'APPROVAL',
])

const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024

function evidenceUpload(request) {
  const actor = requireActor_()
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('EVIDENCE_REQUEST_REQUIRED')
  if (request.contractVersion !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')
  return executeEvidenceUpload_(request, actor)
}

function executeEvidenceUpload_(request, actor) {
  const operationId = String(request.operationId || '').trim()
  const input = request.input
  if (!operationId) throw new Error('OPERATION_ID_REQUIRED')
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('EVIDENCE_INPUT_REQUIRED')

  const folderName = String(input.folderName || '').trim()
  const entityType = String(input.entityType || '').trim().toUpperCase()
  const entityId = String(input.entityId || '').trim()
  const fileName = sanitizeEvidenceFileName_(input.fileName)
  const mimeType = String(input.mimeType || 'application/octet-stream').trim()
  const base64 = String(input.base64 || '').replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '')

  if (EVIDENCE_FOLDER_ALLOWLIST.indexOf(folderName) === -1) throw new Error('EVIDENCE_FOLDER_NOT_ALLOWED')
  if (EVIDENCE_ENTITY_TYPES.indexOf(entityType) === -1) throw new Error('EVIDENCE_ENTITY_TYPE_INVALID')
  if (!entityId) throw new Error('EVIDENCE_ENTITY_ID_REQUIRED')
  if (!fileName) throw new Error('EVIDENCE_FILE_NAME_REQUIRED')
  if (!base64) throw new Error('EVIDENCE_FILE_CONTENT_REQUIRED')

  const bytes = Utilities.base64Decode(base64)
  if (!bytes.length) throw new Error('EVIDENCE_FILE_EMPTY')
  if (bytes.length > EVIDENCE_MAX_BYTES) throw new Error('EVIDENCE_FILE_TOO_LARGE')

  const lock = LockService.getScriptLock()
  lock.waitLock(30000)

  try {
    const previous = findOperationResult_('UPLOAD_EVIDENCE', operationId)
    if (previous) {
      return { ok: true, duplicate: true, operationId: operationId, result: previous }
    }

    const folder = findEvidenceFolder_(folderName)
    const blob = Utilities.newBlob(bytes, mimeType, fileName)
    let file = null

    try {
      file = folder.createFile(blob)
      const auditId = Utilities.getUuid()
      const result = {
        fileId: file.getId(),
        fileName: file.getName(),
        mimeType: mimeType,
        folderName: folderName,
        entityType: entityType,
        entityId: entityId,
        url: file.getUrl(),
        auditId: auditId,
      }

      appendAudit_({
        auditId: auditId,
        userId: actor.email,
        action: operationAuditAction_('UPLOAD_EVIDENCE', operationId),
        entityType: entityType,
        entityId: entityId,
        newValueJson: JSON.stringify({
          operationId: operationId,
          result: result,
        }),
      })

      return { ok: true, duplicate: false, operationId: operationId, result: result }
    } catch (error) {
      if (file) {
        compensateOrThrow_(error, function () {
          file.setTrashed(true)
        })
      }
      throw error
    }
  } finally {
    lock.releaseLock()
  }
}

function findEvidenceFolder_(folderName) {
  const projectFolder = DriveApp.getFolderById(APP_CONFIG.projectFolderId)
  const folders = projectFolder.getFoldersByName(folderName)
  if (!folders.hasNext()) throw new Error('EVIDENCE_FOLDER_NOT_FOUND:' + folderName)
  const folder = folders.next()
  if (folders.hasNext()) throw new Error('EVIDENCE_FOLDER_AMBIGUOUS:' + folderName)
  return folder
}

function sanitizeEvidenceFileName_(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/[\u0000-\u001f\u007f]+/g, '')
    .slice(0, 180)
}
