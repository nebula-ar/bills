CREATE SCHEMA IF NOT EXISTS api;
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.environment_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  instance_id uuid NOT NULL UNIQUE,
  environment text NOT NULL CHECK (environment IN ('production', 'staging', 'development')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ops.environment_identity(singleton, instance_id, environment)
VALUES (true, '00000000-0000-4000-8000-000000000001', 'development')
ON CONFLICT (singleton) DO NOTHING;

REVOKE ALL ON SCHEMA ops FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA ops FROM PUBLIC;
