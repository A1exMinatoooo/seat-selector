# Rollback note

The application uses forward-only migrations. Older application versions safely ignore the additional `selection_displaced` enum value, so a normal application rollback must leave it in place.

PostgreSQL cannot directly remove an enum value. A destructive rollback would require recreating the enum after verifying that no audit row uses `selection_displaced`; this risks losing audit history and is intentionally not automated.
