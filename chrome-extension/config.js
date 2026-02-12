// Supabase Configuration - Idempotent (safe for multiple loads)
(function (g) {
  g.SUPABASE_URL = g.SUPABASE_URL || "https://nycrxoppbsakpkkeiqzb.supabase.co";
  g.SUPABASE_ANON_KEY = g.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55Y3J4b3BwYnNha3Bra2VpcXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4Nzc2NDMsImV4cCI6MjA3NDQ1MzY0M30.On7TSxxCpJT868Kygk1PgfUACyPodjx78G5lKxejt74";

  // Dashboard URLs
  g.DASHBOARD_URL = g.DASHBOARD_URL || "https://sapienwrite.com/dashboard";
  g.LOGIN_URL = g.LOGIN_URL || "https://sapienwrite.com/auth";

  // Plan limits for Chrome Extension
  g.EXTENSION_LIMITS = g.EXTENSION_LIMITS || {
    free: 1000,           // Shared pool with web
    extension_only: 5000, // Extension only (legacy)
    ultra: 20000,         // Shared pool with web
    master: 30000         // Legacy
  };
})(typeof self !== 'undefined' ? self : window);
