# Review management service

The Express service owns review requests, replies, and student acknowledgements
in `clearSKY_reviews` (MariaDB). The runtime is `review-service:5000`, internal to
[Docker Compose](../docker-compose.yml). Use the [gateway](../api_gateway/README.md)
from the browser; direct calls require `X-Internal-Gateway-Token` and trusted
identity headers.

## Workflow and request shapes

| Method / gateway path | Caller | JSON fields |
|---|---|---|
| `POST /reviews/request` | student | `course`, `period`, `message` |
| `GET /reviews/instructor` | instructor | no caller-supplied instructor ID required |
| `POST /reviews/reply` | assigned instructor | `review_request_id`, `status` (`accepted` or `denied`), optional `message`, `attachment_path` |
| `POST /reviews/ack` | owning student | `review_request_id` |
| `POST /reviews/view` | student or instructor | student: `course`, `period`; instructor: `id` |
| `POST /replies/view` | student or instructor | student: `course`, `period`; instructor: `reviewId` |

The student's identity/institution and assigned instructor come from verified
claims and RabbitMQ instructor lookup, not request body `studentId` or
`instructorId` values. Review/reply reads and acknowledgement enforce institution
and ownership. Reply writes use a database transaction. A reply records the
review outcome; it does not itself modify the grade tables in the grades service.

Optional reply attachments accept HTTPS Google Drive/Dropbox URLs from the
handler's allowlist. Files are not copied into this service, and their public
access/privacy is not guaranteed. Use only authorized synthetic demonstration
material.

## Files and dependencies

- [server.js](server.js): routes and trusted caller middleware.
- [reviewController.js](reviewController.js): workflow and scoped database access.
- [schema.sql](schema.sql): service-owned tables.
- [rabbitmq/rpc.js](rabbitmq/rpc.js): instructor lookup request/reply transport.
- [db.js](db.js): MariaDB pool using `DB_HOST`, `DB_USER`, `DB_PASSWORD`,
  `DB_NAME`, `DB_PORT`.

Compose provides the database and `RABBITMQ_URL`, `JWT_SECRET`, and
`INTERNAL_GATEWAY_TOKEN`. `npm start` launches the service in that configured
runtime; copying this directory alone omits the sibling shared helpers and
network dependencies. Follow the [root setup](../README.md#local-setup).
[Offline regressions](../tests/README.md) fake database/broker boundaries; they do
not establish live service or uploaded-data correctness.
