// Public project settings that are safe to commit.
// The Supabase anon key is designed to be public: row-level security in
// supabase/migrations decides what each signed-in user can read and write.
// Leave both empty to run without accounts (data stays on the device).
export const PUBLIC_SUPABASE_URL = "https://bbpshdcccfjdyqxdewuc.supabase.co";
export const PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJicHNoZGNjY2ZqZHlxeGRld3VjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3MzAwNDMsImV4cCI6MjExMDMwNjA0M30.vxZxeRFkPT7QlwquPieprgQq5Va4dq3HlX0H955ML1I";
