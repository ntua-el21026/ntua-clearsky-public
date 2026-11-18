# clearSKY architecture

The [editable Visual Paradigm model](saas2025-15.vpp) records Team 15’s
coursework design. The [Compose configuration](../docker-compose.yml) and
implementation files describe the executable service arrangement. Use the
model as design evidence and the source files below to inspect the
implemented boundaries.

## Services and data ownership

| Service | Responsibility and owned state | Implementation |
|---|---|---|
| Browser client | Role-specific views, grade file selection and preview, grade statistics, and review status | [Routes and pages](../frontend/src/) |
| API gateway | JWT and role checks, session validation, identity header forwarding, and routing to internal services | [Gateway route definitions](../api_gateway/index.js) |
| User management | Institution and account records, credentials, and session revocation | [Auth controller](../user_management_microservice/authController.js) and [schema](../user_management_microservice/schema.sql) |
| Grades management | Courses, separate initial and final uploads and grade records, and grade distributions | [Grades controller](../grades_management_microservice/gradesController.js) and [schema](../grades_management_microservice/schema.sql) |
| Review management | Requests, replies, and acknowledgement state in a separate MariaDB database | [Review controller](../review_management_microservice/reviewController.js) and [schema](../review_management_microservice/schema.sql) |

Compose exposes the browser development server and gateway on loopback. The
business services, databases and message broker use the internal network.
The gateway removes caller-supplied identity headers before forwarding
verified claims. Internal boundaries use the shared gateway credential
described in the [security utilities guide](../shared/README.md).

## Grade submission and review

1. An instructor selects a workbook. The client first sends it for preview.
   The first-sheet parser extracts course, exam period and record count
   using the [documented workbook layout](../excel/README.md).
2. After confirmation, the client calls an initial or final submission route.
   The grade service owns grade records and statistics.
3. A student can request a review. The review service asks for the assigned
   instructor through the [RabbitMQ request–reply client](../review_management_microservice/rabbitmq/rpc.js)
   and the [grade-service consumer](../grades_management_microservice/rabbitmq/consumer.js).
   The review service owns the reply and acknowledgement records.

The [test guide](../tests/README.md) describes bounded verification with
stubbed data access and the earlier workbook preview check. The
architecture has separate live integration requirements for database
submission and broker messaging.
