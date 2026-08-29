function bridgeInvokeV2(request) {
  const actor = requireActor_()
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('BRIDGE_REQUEST_REQUIRED')
  if (request.contractVersion !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')

  if (request.action === 'sessionInfo') {
    return {
      ok: true,
      email: actor.email,
      role: actor.role,
      contractVersion: APP_CONFIG.contractVersion,
    }
  }

  if (request.action === 'auditRead') {
    if (actor.role !== 'ADMIN') throw new Error('ROLE_NOT_ALLOWED')
    return { ok: true, rows: readTable_('Audit_Log') }
  }

  if (request.action === 'dailyInspectionSubmit') {
    return executeDailyInspectionSubmit_(request, actor)
  }

  if (request.action === 'toolingCreate') {
    return toolingCreate(request)
  }

  if (request.action === 'toolingPlanCreate') {
    return toolingPlanCreate(request)
  }

  if (request.action === 'toolingModificationCreate') {
    return toolingModificationCreate(request)
  }

  if (request.action === 'toolingModificationApprove') {
    return toolingModificationApprove(request)
  }

  if (request.action === 'toolingModificationConfirmQuality') {
    return toolingModificationConfirmQuality(request)
  }

  if (request.action === 'toolingModificationComplete') {
    return toolingModificationComplete(request)
  }

  return executeTransportRequest_(request, actor)
}
