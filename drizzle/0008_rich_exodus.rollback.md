# Rollback note

The application uses forward-only migrations. Older versions safely ignore the additional audit action values, so leave them in place during an application rollback.

PostgreSQL enum values cannot be removed directly. Recreating the enum would require proving no audit history uses these actions and is intentionally not automated.
