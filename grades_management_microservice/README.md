# Grades management service

This Express/Multer/XLSX service implements grade submission, personal grade
retrieval, course selection, and overall/per-question statistics. It owns the
`clearSKY_grades` MariaDB database and answers RabbitMQ instructor lookups used
by review requests. Compose runs it as `grades-service:4000` on the internal
network.

## Gateway routes

| Method / path | Purpose |
|---|---|
| `POST /grades/validateExcel` | Instructor preview of uploaded course, period, and grade count |
| `POST /grades/upload/initial` | Instructor initial-grade submission |
| `POST /grades/upload/final` | Instructor final-grade submission |
| `GET /grades/available` | Available courses according to authenticated role |
| `GET /grades/view?course=...&exam_period=...` | Student's personal grade information |
| `GET /grades/statistics?course=...&exam_period=...` | Overall and per-question grade distributions |

Uploads are `multipart/form-data` with a `file` field. The parser reads the first
worksheet using `sheet_to_json(..., {range: 2})`, expects the original course
export's Greek column names, and extracts its course/exam-period metadata. An
arbitrary CSV or differently arranged spreadsheet is not an equivalent input.
Use the [synthetic basic and detailed workbooks](../excel/README.md) to try
the preview step with fictional data. An offline preview check used
both files and the unchanged preview controller with external access stubbed.

The server selects `initial`/`final` status from the route. Identity headers are
supplied by the trusted gateway; callers should not manufacture `x-user-id`.
The frontend provides the preview and confirmation flow. Grade submission uses
the existing `postGrades` implementation.

## Runtime and files

- [server.js](server.js): routes, the temporary runtime-generated `uploads/` directory, and the trusted gateway boundary.
- [gradesController.js](gradesController.js): XLSX parser, grade persistence,
  course reads, statistics.
- [schema.sql](schema.sql): courses, uploads, grades, and distribution tables.
- [rabbitmq/consumer.js](rabbitmq/consumer.js): instructor lookup consumer.
- [db.js](db.js): MariaDB pool.

The [root setup](../README.md#local-setup) supplies MariaDB, RabbitMQ,
`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `RABBITMQ_URL`,
`JWT_SECRET`, and `INTERNAL_GATEWAY_TOKEN`, plus sibling shared helpers.
`npm start` is the service launch script in that runtime. The broker consumer
starts at process launch; an unavailable broker can prevent startup. The root [test guide](../tests/README.md) distinguishes bounded offline tests,
earlier workbook preview checks, and live MariaDB/RabbitMQ integration.
