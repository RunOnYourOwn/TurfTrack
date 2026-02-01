-- App-wide settings (key-value)
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value VARCHAR(500) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default: daily update at 06:00 local time
INSERT INTO app_settings (key, value) VALUES
    ('weather_update_hour', '6'),
    ('weather_update_timezone', 'America/Chicago')
ON CONFLICT (key) DO NOTHING;
