-- Track Excel import source on workplans
ALTER TABLE workplans
  ADD COLUMN IF NOT EXISTS imported_from_file TEXT,
  ADD COLUMN IF NOT EXISTS imported_sheet TEXT,
  ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ;

COMMENT ON COLUMN workplans.imported_from_file IS
  'Original Excel filename used to import objectives, if imported via Excel upload';
COMMENT ON COLUMN workplans.imported_sheet IS
  'Sheet name within the Excel file that was used for import';
