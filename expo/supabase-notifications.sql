-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying notifications by user
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(is_read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT
  USING (auth.uid()::text = user_id OR user_id IN (SELECT id FROM users WHERE id = auth.uid()::text));

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE
  USING (auth.uid()::text = user_id OR user_id IN (SELECT id FROM users WHERE id = auth.uid()::text));

-- Policy: System can insert notifications (no auth required for inserts from app)
CREATE POLICY "Allow insert notifications" ON notifications
  FOR INSERT
  WITH CHECK (true);

-- Create expo_push_tokens table for storing device push tokens
CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for querying tokens by user
CREATE INDEX IF NOT EXISTS expo_push_tokens_user_id_idx ON expo_push_tokens(user_id);

-- Enable RLS
ALTER TABLE expo_push_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own tokens
CREATE POLICY "Users can manage own tokens" ON expo_push_tokens
  FOR ALL
  USING (auth.uid()::text = user_id OR user_id IN (SELECT id FROM users WHERE id = auth.uid()::text));

-- Policy: Allow insert tokens
CREATE POLICY "Allow insert tokens" ON expo_push_tokens
  FOR INSERT
  WITH CHECK (true);
