# Rollback note

The application uses forward-only migrations. Rolling back the application image is safe because older versions do not read `event_audit_logs` or `audit_action`; leave both database objects in place.

If a destructive schema rollback is unavoidable, first create and verify a logical backup, then drop `event_audit_logs` before dropping the `audit_action` enum. This permanently removes audit history and must not be done as part of a normal application rollback.
