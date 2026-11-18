# User management service

This Express service implements institution-managed account registration,
login, logout, and institution-scoped password changes. Compose runs it as
`users-service:3000` on the internal network. The browser calls the gateway
rather than the service directly.

| Gateway route | Internal route | Purpose |
|---|---|---|
| `POST /auth/register` | `POST /api/register` | Institution account management |
| `POST /auth/login` | `POST /api/login` | Authenticate and issue a token |
| `POST /auth/logout` | `POST /api/logout` | Revoke the session |
| `POST /auth/changePassword` | `POST /api/changePassword` | Institution-scoped password change |

The gateway also uses internal `GET /api/session` on protected routes.
Session validation fails closed with 503 if the user-service dependency
is unavailable. The [auth controller](authController.js) uses salted
scrypt and conditionally migrates verified legacy SHA-256 password hashes.
The [schema](schema.sql) defines the service-owned database.

Compose supplies private database settings and the shared authentication
module. Internal requests require `X-Internal-Gateway-Token`. See the
[root setup](../README.md#local-setup) and
[shared authentication guide](../shared/README.md).
