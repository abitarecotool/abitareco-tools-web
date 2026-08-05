// js/core/supabase-config.js
// Compila questi due valori con quelli del progetto Supabase collegato al tool.
// Supabase Dashboard -> Project Settings -> API -> Project URL e anon public key.
window.ABITARE_SUPABASE = {
  url: 'https://ddakythxpllinofstzuh.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkYWt5dGh4cGxsaW5vZnN0enVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NTE4MDYsImV4cCI6MjA5OTUyNzgwNn0.UBlsk4xcQa-6LWSE7cAVnD-gP3dX3auwDsR4hXiP70U',

  // true = se url/anonKey sono vuoti il tool continua a funzionare con il vecchio login locale.
  // Quando Supabase e gli utenti sono pronti, puoi mettere false per disattivare il fallback.
  legacyFallback: true
};
