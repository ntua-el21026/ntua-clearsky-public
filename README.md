# clearSKY

clearSKY is Team 15’s 2025 Software as a Service project at NTUA ECE. It demonstrates how separate user, grade, and review services can support an academic grading workflow. A React/TypeScript client talks to one Express gateway. The three business services each own their own MariaDB schema, and reviews use a RabbitMQ request–reply lookup to identify the instructor assigned to a course.

## Engineering contribution

- The [user service](user_management_microservice/README.md) authenticates users and supports institution-scoped account and password management.
- The [grade service](grades_management_microservice/README.md) separates spreadsheet preview from initial or final grade submission. Students can inspect grades by course and exam period, and the client presents overall and per-question distributions.
- The [review service](review_management_microservice/README.md) records student review requests, assigned-instructor replies, and student acknowledgement. Reply handling applies institution and ownership checks and uses a database transaction.
- The [gateway](api_gateway/README.md) verifies tokens and roles, checks session revocation, and forwards verified identity to internal services. The [architecture guide](architecture/README.md) connects the editable UML model to the implementation and data ownership.

## Representative evidence

The [synthetic XLSX fixtures](excel/README.md) exercise the basic and detailed grade-preview formats with fictional students. The five original course workbooks demonstrated formatting, metadata and per-question grades. Those workbooks remain external. The local fixtures preserve importer compatibility and have their own synthetic provenance.

On 18 November 2026, 30 offline tests passed on Node v24.20.0, covering passwords, review authorization, gateway sessions and user-service security. Both workbooks returned the expected course, exam period, and count of three grade entries through the preview controller with locked SheetJS and stubbed external access. Compose also accepted the configuration in an interpolation check. Database submission, broker interaction and live gateway operation require separate integration checks. [Validation scope and commands](tests/README.md)

## Architecture and repository map

| Component | Local endpoint or service | Guide |
|---|---|---|
| React 19, TypeScript and Vite client | `localhost:5173` | [Frontend](frontend/README.md) |
| Express gateway | `localhost:8080` | [Gateway](api_gateway/README.md) |
| Users and authentication | `users-service:3000` | [User service](user_management_microservice/README.md) |
| Grades and statistics | `grades-service:4000` | [Grade service](grades_management_microservice/README.md) |
| Review requests and replies | `review-service:5000` | [Review service](review_management_microservice/README.md) |
| Authentication utilities | Read-only mounts beside the services | [Shared helpers](shared/README.md) |
| Local infrastructure | Three MariaDB 10.11 databases and RabbitMQ on the internal network | [Compose file](docker-compose.yml) |

The [fourth service template](microservice04/README.md) is retained as a coursework artifact. Compose publishes the gateway and browser development server on loopback. A protected gateway request fails closed when session validation is unavailable.

## Local setup

Use Docker Engine and Compose with disposable local data volumes. Copy
[.env.example](.env.example) to an ignored `.env` and replace every placeholder.
Use independent random values for `JWT_SECRET` and
`INTERNAL_GATEWAY_TOKEN`, for example from `openssl rand -hex 32`. The
AMQP URI requires compatible broker credentials.

```bash
cp .env.example .env
# Configure .env privately before starting services.
docker compose --env-file .env config --quiet
docker compose --env-file .env up --build
```

Open `http://localhost:5173`. The original schema contains a coursework
institution account suited only to disposable data. Rotate it before a
shared demonstration. Changing environment variables leaves credentials in
already initialized volumes in place. Service startup can race database or
broker readiness. Review service logs if dependencies are still initializing.
This is a coursework prototype for fictional records.

Install the two [offline test dependency sets](tests/README.md) to run the
full Node test command. The [frontend guide](frontend/README.md) records the
TypeScript/Vite build command. These are separate from the current bounded
verification.

## Team and licensing

Team 15 coursework includes **Michail Athanasios Peppas**. Preserve the
[2025 original-work notice](LICENSE) and the
[2024 notice crediting Christos Hadjichristofi](LICENSE%20copy) for the
respective contributions. Third-party terms apply to their own components.
The [AI-assisted development record](ai-log/README.md) documents the team’s
use of tools during the course.
