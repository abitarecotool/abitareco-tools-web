// js/core/supabase-config.js
// Configurazione Supabase per login veloce del tool Abitare Co.
// Anon public key: ok nel frontend. Non inserire mai service_role key qui.
window.ABITARE_SUPABASE = {
  url: 'https://ddakythxpllinofstzuh.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYWt5dGh4cGxsaW5vZnN0enVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTE4MDYsImV4cCI6MjA5OTUyNzgwNn0.UBlsk4xcQa-6LWSE7cAVnD-gP3dX3auwDsR4hXiP70U',

  // true = se Supabase non risponde, per ora resta disponibile il vecchio login locale.
  // Dopo i test puoi mettere false.
  legacyFallback: false
};
