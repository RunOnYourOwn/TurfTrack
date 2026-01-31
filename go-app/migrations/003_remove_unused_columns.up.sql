-- Remove unused columns from lawns (weather_fetch_frequency, timezone)
-- These are vestigial from the Python era. The Go scheduler uses global settings.
ALTER TABLE lawns DROP COLUMN IF EXISTS weather_fetch_frequency;
ALTER TABLE lawns DROP COLUMN IF EXISTS timezone;
