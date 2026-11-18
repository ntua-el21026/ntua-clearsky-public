# API gateway

The Express gateway is the only host-exposed backend entry point in
[the local Compose stack](../docker-compose.yml), at `127.0.0.1:8080`.
It validates JWTs and roles and proxies browser requests to internal
services. Caller identity headers are stripped before the gateway attaches
verified claims and the configured internal credential. See
[index.js](index.js) for route definitions and [session.js](session.js)
for protected session checks.

## Routes and service boundaries

### User management

- `POST /auth/login` → Proxy to `/api/login`
- `POST /auth/register` → Institution-only, proxy to `/api/register`
- `POST /auth/changePassword` → Institution-only, proxy to `/api/changePassword`
- `POST /auth/logout` → Authenticated users, proxy to `/api/logout`

### Grades management

- `POST /grades/upload/initial` → Instructor-only, with Excel file
- `POST /grades/upload/final` → Instructor-only, with Excel file
- `POST /grades/validateExcel` → Instructor-only preview of course, exam period, and grade count
- `GET /grades/view` → View grades, role-sensitive headers forwarded
- `GET /grades/available` → Courses available for grading
- `GET /grades/statistics` → Statistics and grade analytics

### Review management

- `POST /reviews/request` → Student-only, send review request
- `POST /reviews/reply` → Instructor-only, reply to a review
- `POST /reviews/ack` → Student-only, acknowledge reply
- `GET /reviews/instructor` → Instructor-only, fetch requests
- `POST /reviews/view` → Authenticated users, get review
- `POST /replies/view` → Authenticated users, get reply

## Local prerequisites

Follow the [root setup](../README.md#local-setup) for application-wide
environment configuration. Protected browser requests use the
`X-OBSERVATORY-AUTH` header. The gateway requires a signing secret and
internal gateway credential. These secrets remain in private local
configuration.
