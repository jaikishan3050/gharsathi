Ghar Sathi React application

The React/Vite frontend connects to the Django API configured by
`VITE_API_BASE_URL`. Customer sign-in uses mobile SMS OTP; technicians register
through OTP and subsequently use mobile/password; administrators use their
server-managed Django credentials. Protected API calls use a Bearer JWT held in
tab-scoped sessionStorage. Backend permissions and record ownership remain the
authority for access.

```powershell
npm ci
npm run dev
npm run test
npm run build
```

Local development defaults to `http://127.0.0.1:8000/api`. Production configuration
is in `.env.production`. No server secrets belong in Vite environment variables.

Online checkout saves a Pending booking first, uses its database-confirmed
reference and amount for the order, and reports payment success only after
backend verification. The customer flow has no simulated checkout fallback.
Backend or checkout failures leave payment unconfirmed. Cash bookings also
require successful database persistence.

Production OTP codes are delivered through the server's configured SMS provider.
Code display is limited to backend development mode with `OTP_EXPOSE_DEBUG_CODE`
enabled; it is not a production phone-verification mechanism. Live job sockets
authenticate the session token before joining dispatch groups.

The build emits `build-info.json` with the Git commit and dirty flag. See
`../DEPLOYMENT.md` for the existing Firebase/Render targets, deployment checks and
required provider configuration. A successful build is not proof of deployment
or production readiness.

`legacy-source/` preserves the original prototype for reference and is not the
current authentication or payment implementation.
