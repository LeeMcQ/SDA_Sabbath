// Sabbath Service Desk cloud (Supabase): sign-in, install & usage statistics, feedback, Google Slides download.
// Leave `url` empty and the app works exactly as before, fully offline, with no sign-in.
// Fill in from Supabase → Project Settings → API (the "anon public" key is meant to be public: what each
// person may read or write is decided by the rules in supabase/schema.sql). See supabase/SETUP.md.
export const CLOUD = {
  url: 'https://dearnjvtryahyqfvxzfh.supabase.co',            // e.g. 'https://abcdefghijkl.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlYXJuanZ0cnlhaHlxZnZ4emZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MjEyMDEsImV4cCI6MjEwOTE5NzIwMX0.RAnGDEc7P_DnBn8Nr7HLQFZnFhMCiGolNpc6OG9mYe4',        // the "anon public" key
  google: true,      // true once Google sign-in is turned on in Supabase → Authentication → Providers
  requireSignIn: false, // true: the first start asks to sign in (never blocks the app without internet)
  // Google Drive backup (works without Supabase): an OAuth client id from Google Cloud, type "Web application".
  // See docs/backup.md. Empty: the Drive buttons explain that it is not set up; backup files still work.
  googleClientId: '871585998484-labocq2oofqmpcgg7t04bn9cqudvr2aa.apps.googleusercontent.com',
};
