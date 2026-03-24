-- In-app notifications (per app_users). API routes use service role; RLS for future direct client access.

CREATE TABLE app_notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type         text NOT NULL,
  title        text NOT NULL,
  body         text NOT NULL,
  link         text,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  metadata     jsonb
);

CREATE INDEX idx_notif_user ON app_notifications(user_id);
CREATE INDEX idx_notif_unread ON app_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notif_created ON app_notifications(created_at DESC);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif_own ON app_notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
