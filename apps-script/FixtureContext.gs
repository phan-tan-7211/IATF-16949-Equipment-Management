var FIXTURE_SPREADSHEET_CONTEXT_ID_ = ''
var FIXTURE_ACTOR_CONTEXT_ = null

function requireFixtureSpreadsheetId_() {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')

  const fixtureId = String(
    PropertiesService.getScriptProperties().getProperty('TEST_SPREADSHEET_ID') || ''
  ).trim()
  if (!fixtureId) throw new Error('TEST_SPREADSHEET_ID_NOT_CONFIGURED')
  if (fixtureId === APP_CONFIG.spreadsheetId) throw new Error('FIXTURE_MUST_NOT_USE_PRODUCTION_SPREADSHEET')
  return fixtureId
}

function withFixtureSpreadsheet_(action) {
  if (typeof action !== 'function') throw new Error('FIXTURE_ACTION_REQUIRED')
  const fixtureId = requireFixtureSpreadsheetId_()
  if (FIXTURE_SPREADSHEET_CONTEXT_ID_) throw new Error('FIXTURE_CONTEXT_ALREADY_ACTIVE')

  FIXTURE_SPREADSHEET_CONTEXT_ID_ = fixtureId
  try {
    return action()
  } finally {
    FIXTURE_SPREADSHEET_CONTEXT_ID_ = ''
    FIXTURE_ACTOR_CONTEXT_ = null
  }
}

function withFixtureActor_(email, role, action) {
  if (!FIXTURE_SPREADSHEET_CONTEXT_ID_) throw new Error('FIXTURE_CONTEXT_REQUIRED')
  if (typeof action !== 'function') throw new Error('FIXTURE_ACTION_REQUIRED')
  const next = {
    email: String(email || '').trim().toLowerCase(),
    role: String(role || '').trim().toUpperCase(),
  }
  if (!next.email || !next.role) throw new Error('FIXTURE_ACTOR_REQUIRED')

  const previous = FIXTURE_ACTOR_CONTEXT_
  FIXTURE_ACTOR_CONTEXT_ = next
  try {
    return action()
  } finally {
    FIXTURE_ACTOR_CONTEXT_ = previous
  }
}

function getFixtureSpreadsheetContextId_() {
  return FIXTURE_SPREADSHEET_CONTEXT_ID_
}

function getFixtureActorContext_() {
  return FIXTURE_ACTOR_CONTEXT_
}

function fixtureContextGuardSmoke() {
  const actor = requireActor_()
  if (actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')

  const fixtureId = requireFixtureSpreadsheetId_()
  const before = getFixtureSpreadsheetContextId_()
  if (before) throw new Error('FIXTURE_CONTEXT_DIRTY_BEFORE_TEST')

  const inside = withFixtureSpreadsheet_(function () {
    if (getFixtureSpreadsheetContextId_() !== fixtureId) throw new Error('FIXTURE_CONTEXT_NOT_ACTIVE')
    const simulated = withFixtureActor_('fixture-quality@example.invalid', 'QUALITY', function () {
      const current = getFixtureActorContext_()
      if (!current || current.role !== 'QUALITY') throw new Error('FIXTURE_ACTOR_CONTEXT_NOT_ACTIVE')
      return current
    })
    if (getFixtureActorContext_()) throw new Error('FIXTURE_ACTOR_CONTEXT_NOT_CLEARED')
    return simulated
  })

  if (getFixtureSpreadsheetContextId_()) throw new Error('FIXTURE_CONTEXT_NOT_CLEARED')
  if (getFixtureActorContext_()) throw new Error('FIXTURE_ACTOR_CONTEXT_NOT_CLEARED')

  Logger.log(JSON.stringify({
    phase: 'fixture-context-guard',
    ok: true,
    productionSpreadsheetIdProtected: fixtureId !== APP_CONFIG.spreadsheetId,
    fixtureContextCleared: true,
    actorContextCleared: true,
    simulatedActor: inside,
  }, null, 2))
}
