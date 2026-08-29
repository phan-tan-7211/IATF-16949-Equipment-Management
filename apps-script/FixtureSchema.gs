function fixtureG1SchemaSmoke() {
  const actor = requireActor_()
  if (!actor || actor.role !== 'ADMIN') throw new Error('FIXTURE_ADMIN_REQUIRED')

  const fixtureId = requireFixtureSpreadsheetId_()
  const spreadsheet = SpreadsheetApp.openById(fixtureId)
  const results = APP_CONFIG.allowedTables.map(function (table) {
    const sheet = spreadsheet.getSheetByName(table)
    if (!sheet) throw new Error('FIXTURE_TABLE_NOT_FOUND:' + table)
    const headers = getHeaders_(sheet)
    if (!headers.length) throw new Error('FIXTURE_HEADERS_REQUIRED:' + table)
    const duplicates = headers.filter(function (header, index) {
      return headers.indexOf(header) !== index
    })
    if (duplicates.length) throw new Error('FIXTURE_DUPLICATE_HEADERS:' + table + ':' + duplicates.join(','))
    return { table: table, columns: headers.length }
  })

  if (results.length !== APP_CONFIG.allowedTables.length) throw new Error('FIXTURE_G1_TABLE_COUNT_MISMATCH')

  Logger.log(JSON.stringify({
    phase: 'fixture-g1-schema',
    ok: true,
    spreadsheetIdProtected: fixtureId !== APP_CONFIG.spreadsheetId,
    tableCount: results.length,
    tables: results,
  }, null, 2))
}
