function sessionInfo() {
  const actor = requireActor_()
  return {
    ok: true,
    email: actor.email,
    role: actor.role,
    contractVersion: APP_CONFIG.contractVersion,
  }
}
