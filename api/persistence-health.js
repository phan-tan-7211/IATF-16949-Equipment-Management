const REQUIRED_SERVER_ENV = ['GOOGLE_SERVICE_ACCOUNT_JSON']

export default function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  }

  const missingEnvironment = REQUIRED_SERVER_ENV.filter((name) => !process.env[name])

  return response.status(200).json({
    ok: true,
    boundary: 'BACKEND_REQUIRED',
    provider: 'GOOGLE_SHEETS_DRIVE',
    credentialsConfigured: missingEnvironment.length === 0,
    missingEnvironment,
    secretsExposed: false,
  })
}
