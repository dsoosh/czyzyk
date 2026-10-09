-- Meeting point of an event (event-location): where children are brought or picked up
-- (a station, the Base) when it differs from the kindergarten; location stays the destination.
alter table public.events
  add column meeting_point text check (meeting_point is null or char_length(meeting_point) <= 200);
