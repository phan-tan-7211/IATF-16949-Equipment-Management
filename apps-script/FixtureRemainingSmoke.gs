function fixtureHandoverSmoke() {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')

  expectFixtureError_('HANDOVER_BEFORE_VERIFIED', 'WORK_ORDER_NOT_VERIFIED', function () {
    fixtureAssertWorkOrderVerified_({ status: 'COMPLETED' })
  })
  fixtureAssertWorkOrderVerified_({ status: 'VERIFIED' })

  const recipient = 'fixture-recipient@example.invalid'
  expectFixtureError_('HANDOVER_WRONG_RECIPIENT', 'HANDOVER_RECIPIENT_ONLY', function () {
    fixtureAssertRecipient_({ toPerson: recipient }, { email: 'fixture-other@example.invalid' })
  })
  fixtureAssertRecipient_({ toPerson: recipient }, { email: recipient })

  expectFixtureError_('HANDOVER_NOT_OPERABLE_RELEASE', 'HANDOVER_NOT_OPERABLE', function () {
    fixtureAssertReleaseAllowed_({ accepted: true, condition: 'NOT_OPERABLE' })
  })
  expectFixtureError_('HANDOVER_NOT_ACCEPTED_RELEASE', 'ACCEPTED_HANDOVER_REQUIRED', function () {
    fixtureAssertReleaseAllowed_({ accepted: false, condition: 'NORMAL' })
  })
  fixtureAssertReleaseAllowed_({ accepted: true, condition: 'NORMAL' })

  if (nextMaintenanceStatus_('VERIFIED', 'RELEASE') !== 'RELEASED') {
    throw new Error('FIXTURE_HANDOVER_RELEASE_TRANSITION_FAILED')
  }

  Logger.log(JSON.stringify({
    phase: 'fixture-handover',
    ok: true,
    beforeVerifiedBlocked: true,
    recipientOnly: true,
    notOperableBlocked: true,
    acceptedOperableReleased: true,
  }, null, 2))
}

function fixtureDriveEvidenceGuardSmoke() {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')

  expectFixtureError_('EVIDENCE_FOLDER_DENIAL', 'EVIDENCE_FOLDER_NOT_ALLOWED', function () {
    fixtureAssertEvidenceFolder_('not-allowed-folder')
  })
  EVIDENCE_FOLDER_ALLOWLIST.forEach(function (folder) { fixtureAssertEvidenceFolder_(folder) })

  if (sanitizeEvidenceFileName_('a/b\\c.pdf') !== 'a-b-c.pdf') throw new Error('FIXTURE_EVIDENCE_FILENAME_SANITIZE_FAILED')
  if (EVIDENCE_MAX_BYTES !== 10 * 1024 * 1024) throw new Error('FIXTURE_EVIDENCE_MAX_BYTES_CHANGED')

  expectFixtureError_('EVIDENCE_TOO_LARGE', 'EVIDENCE_FILE_TOO_LARGE', function () {
    fixtureAssertEvidenceSize_(EVIDENCE_MAX_BYTES + 1)
  })
  fixtureAssertEvidenceSize_(EVIDENCE_MAX_BYTES)

  if (EVIDENCE_ENTITY_TYPES.indexOf('CALIBRATION') === -1 || EVIDENCE_ENTITY_TYPES.indexOf('TOOLING') === -1) {
    throw new Error('FIXTURE_EVIDENCE_ENTITY_TYPES_INCOMPLETE')
  }

  Logger.log(JSON.stringify({
    phase: 'fixture-drive-evidence-guard',
    ok: true,
    folders: EVIDENCE_FOLDER_ALLOWLIST.length,
    maxBytes: EVIDENCE_MAX_BYTES,
    filenameSanitize: true,
    entityTypes: true,
  }, null, 2))
}

function fixtureAssertWorkOrderVerified_(workOrder) {
  if (String(workOrder && workOrder.status || '') !== 'VERIFIED') throw new Error('WORK_ORDER_NOT_VERIFIED')
}

function fixtureAssertRecipient_(handover, actor) {
  if (normalizeIdentity_(handover && handover.toPerson) !== normalizeIdentity_(actor && actor.email)) {
    throw new Error('HANDOVER_RECIPIENT_ONLY')
  }
}

function fixtureAssertReleaseAllowed_(handover) {
  if (!handover || !isTruthyCell_(handover.accepted)) throw new Error('ACCEPTED_HANDOVER_REQUIRED')
  if (String(handover.condition || '') === 'NOT_OPERABLE') throw new Error('HANDOVER_NOT_OPERABLE')
}

function fixtureAssertEvidenceFolder_(folderName) {
  if (EVIDENCE_FOLDER_ALLOWLIST.indexOf(String(folderName || '')) === -1) throw new Error('EVIDENCE_FOLDER_NOT_ALLOWED')
}

function fixtureAssertEvidenceSize_(bytesLength) {
  if (Number(bytesLength) > EVIDENCE_MAX_BYTES) throw new Error('EVIDENCE_FILE_TOO_LARGE')
}
