# Validation evidence

## Current offline check

On 18 November 2026, all 30 tests passed on Node v24.20.0 in a
disposable copy with the locked dependencies. The 14 password and
review-authorization tests can also run without those dependencies:

```bash
node --test tests/passwords.test.js tests/review-authorization.test.js
```

The tests cover scrypt and verified legacy migration, institutional and
ownership boundaries on review actions, and database write/rollback logic
with stubbed dependencies.

## Workbook and configuration checks

On the same date, the two [synthetic workbooks](../excel/README.md) passed
first-sheet parsing with SheetJS 0.17.5 and the existing preview controller
returned the expected fictional course, exam period and three grade entries
for each file. The harness stubbed upload deletion and disabled database access.

Docker Compose v5.7.0 accepted `docker compose --env-file .env config --quiet`
in a disposable directory with placeholder local values. This command
checks interpolation and configuration parsing without starting services.
Submission, database persistence and broker messaging require integration
checks.

## Full offline suite prerequisites

To include dependency-backed gateway/session and user security tests,
first install the locked dependencies from the root:

```bash
npm --prefix user_management_microservice ci --ignore-scripts
npm --prefix api_gateway ci --ignore-scripts
npm test
```

The rest of the suite checks signing configuration, gateway caller
authentication, session handling, and Compose exposure. Complete upload, MariaDB, and RabbitMQ integration require live-stack checks.
