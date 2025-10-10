// Supabase Configuration
const SUPABASE_URL = "https://nycrxoppbsakpkkeiqzb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Y3J4b3BwYnNha3Bra2VpcXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Nzc2NDMsImV4cCI6MjA3NDQ1MzY0M30.On7TSxxCpJT868Kygk1PgfUACyPodjx78G5lKxejt74";

// Dashboard URLs
const DASHBOARD_URL = "https://sapienwrite.com/dashboard";
const LOGIN_URL = "https://sapienwrite.com/auth";

// Plan limits for Chrome Extension
const EXTENSION_LIMITS = {
  free: 750,           // Shared pool with web
  extension_only: 5000, // Extension only
  ultra: 5000,          // Bonus extension words
  master: 5000          // Bonus extension words (legacy)
};

// Web dashboard limits (for reference)
const WEB_LIMITS = {
  free: 750,          // Shared with extension
  pro: 15000,
  ultra: 30000,
  wordsmith: 15000,   // legacy
  master: 30000       // legacy
};
