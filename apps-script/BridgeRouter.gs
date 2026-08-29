function bridgeInvokeV2(request) {
  const actor = requireActor_()
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new Error('BRIDGE_REQUEST_REQUIRED')
  if (request.contractVersion !== APP_CONFIG.contractVersion) throw new Error('CONTRACT_VERSION_MISMATCH')

  if (request.action === 'dailyInspectionSubmit') {
    return executeDailyInspectionSubmit_(request, actor)
  }

  return executeTransportRequest_(request, actor)
}
