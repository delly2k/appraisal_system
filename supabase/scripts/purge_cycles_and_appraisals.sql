-- --------------------------------------------------
-- Purge cycles and appraisals for fresh testing
-- Run this script when you want to clear all appraisal
-- cycles and appraisals and start over.
--
-- Usage (Supabase CLI or SQL editor):
--   psql $DATABASE_URL -f supabase/scripts/purge_cycles_and_appraisals.sql
--   or paste into Supabase Dashboard SQL Editor
-- --------------------------------------------------

-- Delete in dependency order (children before parents).
-- Workplan change proposals -> change requests -> workplan items -> workplans
DELETE FROM workplan_item_change_proposals;
DELETE FROM workplan_change_requests;
DELETE FROM workplan_items;
DELETE FROM workplans;

-- Appraisal child tables
DELETE FROM appraisal_factor_ratings;
DELETE FROM appraisal_section_scores;
DELETE FROM appraisal_recommendations;
DELETE FROM appraisal_signoffs;

-- Appraisals (references appraisal_cycles and employees)
DELETE FROM appraisals;

-- Cycle review types (references appraisal_cycles)
DELETE FROM cycle_review_types;

-- Cycles
DELETE FROM appraisal_cycles;

-- Optional: reset any sequences if you use serials (this schema uses uuid, so no need)
-- Uncomment to verify counts:
-- SELECT 'appraisal_cycles' AS tbl, count(*) FROM appraisal_cycles
-- UNION ALL SELECT 'appraisals', count(*) FROM appraisals
-- UNION ALL SELECT 'cycle_review_types', count(*) FROM cycle_review_types;
