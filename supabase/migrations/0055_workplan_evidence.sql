-- Storage bucket for workplan evidence files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workplan-evidence',
  'workplan-evidence',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'image/jpeg','image/png','image/gif','image/webp',
    'text/plain','text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Table to store uploaded evidence files linked to workplan items
CREATE TABLE IF NOT EXISTS workplan_item_evidence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workplan_item_id UUID NOT NULL REFERENCES workplan_items(id) ON DELETE CASCADE,
  appraisal_id     UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  uploaded_by      TEXT REFERENCES employees(employee_id),

  file_name        TEXT,
  file_size        INTEGER,
  file_type        TEXT,
  storage_path     TEXT,
  storage_bucket   TEXT DEFAULT 'workplan-evidence',

  link_url         TEXT,
  link_title       TEXT,

  note_text        TEXT,

  evidence_type    TEXT NOT NULL DEFAULT 'FILE'
                   CHECK (evidence_type IN ('FILE','LINK','NOTE')),
  CONSTRAINT workplan_evidence_file_has_name CHECK (
    evidence_type != 'FILE' OR (file_name IS NOT NULL AND file_name != '')
  ),

  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workplan_item_evidence_item_id
  ON workplan_item_evidence(workplan_item_id);
CREATE INDEX IF NOT EXISTS idx_workplan_item_evidence_appraisal_id
  ON workplan_item_evidence(appraisal_id);

ALTER TABLE workplan_item_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workplan_evidence_access" ON workplan_item_evidence
  FOR ALL USING (true);

CREATE POLICY "workplan_evidence_upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'workplan-evidence');

CREATE POLICY "workplan_evidence_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'workplan-evidence');

CREATE POLICY "workplan_evidence_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'workplan-evidence');

COMMENT ON TABLE workplan_item_evidence IS
  'Evidence attachments (file/link/note) per workplan objective, uploaded during self-assessment.';
