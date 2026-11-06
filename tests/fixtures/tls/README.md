# TEST-ONLY TLS fixtures

Used by `src/db/connection-options.test.ts` to prove database connections verify the server certificate and hostname.
These keys protect nothing: they are generated for tests, trusted nowhere else, and valid only for the loopback test
addresses below. Never use them for a real server.

| File | Issued by | Valid for |
|------|-----------|-----------|
| `test-ca.crt` | itself (test CA) | — |
| `server.crt` / `server.key` | test CA | `127.0.0.2`, `db.test.invalid` |
| `wrong-host.crt` / `wrong-host.key` | test CA | `127.0.0.3`, `other.test.invalid` (hostname mismatch case) |
| `untrusted.crt` / `untrusted.key` | an unrelated CA | `127.0.0.2` (untrusted certificate case) |

Valid from 2026-01-01 to 2126-01-01. Files use `.crt`/`.key` because the repository ignores `*.pem`.
