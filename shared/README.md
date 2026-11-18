# Shared authentication boundary

`security.js` validates `JWT_SECRET` and `INTERNAL_GATEWAY_TOKEN` at startup and
checks the internal caller token with constant-time comparison. Each must contain
at least 32 characters and must not be a placeholder. All internal services use
this boundary; it complements Compose host-port isolation.

`passwords.js` stores `scrypt$16384$8$1$<16-byte hex salt>$<64-byte hex key>`.
Verification accepts this bounded format and legacy 64-hex SHA-256 hashes.
Legacy values are replaced only after successful verification and a conditional
write; a failed migration never issues a login token. New registrations and
password changes always use scrypt. A database string column of at least 180
characters is needed (the existing schema allows 256).

Run `npm test` from the repository root after installing the user-service and
gateway dependencies. Tests are offline; database behavior still requires an
isolated MariaDB run. Compose mounts this folder at `/usr/src/shared:ro`, next
to the per-service `/usr/src/app` source mount.
