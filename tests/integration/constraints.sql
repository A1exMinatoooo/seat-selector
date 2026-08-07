-- Run after migrations against a disposable database.
-- These assertions document the two invariants used by the confirmation transaction.
SELECT indexname
FROM pg_indexes
WHERE indexname IN (
  'reservations_event_participant_uidx',
  'reservation_seats_event_seat_uidx'
)
ORDER BY indexname;
