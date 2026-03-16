-- Development Profile: one per employee (keyed by app user id), persistent across cycles.
-- Snapshot table stores profile at self-assessment submission for appraisal context.

CREATE TABLE IF NOT EXISTS employee_development_profiles (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id               UUID NOT NULL UNIQUE REFERENCES app_users(id),

  eip_issued               BOOLEAN,
  eip_next_fy              BOOLEAN,
  eip_set_by               UUID REFERENCES app_users(id),
  eip_set_at               TIMESTAMPTZ,

  employee_ld_comments     TEXT,
  manager_ld_notes         TEXT,
  manager_notes_by         UUID REFERENCES app_users(id),
  manager_notes_at         TIMESTAMPTZ,

  skills                   JSONB NOT NULL DEFAULT '[]',

  career_role              TEXT,
  career_timeframe         TEXT,
  career_expertise         TEXT,
  career_remarks           TEXT,
  secondment_interest      BOOLEAN,
  willing_to_relocate      BOOLEAN,

  last_updated_by          UUID REFERENCES app_users(id),
  last_updated_at          TIMESTAMPTZ DEFAULT now(),
  created_at               TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_development_profiles_employee ON employee_development_profiles(employee_id);

CREATE TABLE IF NOT EXISTS development_profile_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id    UUID NOT NULL UNIQUE REFERENCES appraisals(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES app_users(id),
  snapshot_data   JSONB NOT NULL,
  snapshotted_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_development_profile_snapshots_appraisal ON development_profile_snapshots(appraisal_id);
