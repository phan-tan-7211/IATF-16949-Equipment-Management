function bridgeInvokeV2(request) {
  const actor = requireActor_()
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('BRIDGE_REQUEST_REQUIRED')
  if (request.contractVersion !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')

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
