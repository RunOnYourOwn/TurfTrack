-- Re-add removed columns
ALTER TABLE lawns ADD COLUMN IF NOT EXISTS weather_fetch_frequency VARCHAR(10) NOT NULL DEFAULT '24h' CHECK (weather_fetch_frequency IN ('4h', '8h', '12h', '24h'));
ALTER TABLE lawns ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'America/Chicago';
