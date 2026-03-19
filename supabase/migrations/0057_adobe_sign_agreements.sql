-- Adobe Sign agreement tracking per appraisal
CREATE TABLE IF NOT EXISTS appraisal_agreements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_id          UUID NOT NULL REFERENCES appraisals(id) ON DELETE CASCADE,
  adobe_agreement_id    TEXT NOT NULL UNIQUE,

  -- Agreement status (mirrors Adobe Sign states)
  status                TEXT NOT NULL DEFAULT 'OUT_FOR_SIGNATURE'
                        CHECK (status IN (
                          'OUT_FOR_SIGNATURE',
                          'SIGNED',
                          'DECLINED',
                          'CANCELLED',
                          'EXPIRED'
                        )),

  -- Individual signature timestamps (updated by webhook)
  employee_signed_at    TIMESTAMPTZ,
  manager_signed_at     TIMESTAMPTZ,
  hr_signed_at          TIMESTAMPTZ,

  -- Who declined and why (if applicable)
  declined_by_email     TEXT,
  decline_reason        TEXT,
  declined_at           TIMESTAMPTZ,

  -- Generated PDF (pre-signature) stored in Supabase storage
  draft_pdf_path        TEXT,
  draft_pdf_bucket      TEXT DEFAULT 'appraisal-pdfs',

  -- Final signed PDF path and URL (returned by Adobe Sign after all sign)
  signed_pdf_path       TEXT,
  signed_pdf_url        TEXT,

  -- Metadata (initiated_by = employee_id of user who submitted)
  initiated_by          TEXT REFERENCES employees(employee_id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_appraisal_agreements_appraisal
  ON appraisal_agreements(appraisal_id);
CREATE INDEX idx_appraisal_agreements_adobe_id
  ON appraisal_agreements(adobe_agreement_id);

ALTER TABLE appraisal_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agreements_access" ON appraisal_agreements FOR ALL USING (true);

-- Storage bucket for generated appraisal PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('appraisal-pdfs', 'appraisal-pdfs', false, 52428800)
ON CONFLICT (id) DO NOTHING;
