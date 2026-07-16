import { createClient } from "@supabase/supabase-js";

// Connexion au projet Supabase.
// L'URL et la clé « anon » sont des valeurs PUBLIQUES par conception (elles
// sont livrées dans le bundle du navigateur) ; leur présence ici est normale.
// La protection réelle des données se fait côté base via Row Level Security.
// On lit d'abord les variables d'environnement (NEXT_PUBLIC_*), avec repli
// sur les constantes du projet pour que le build GitHub Pages fonctionne
// sans réglage (même convention que les autres apps du dépôt).
// Ne JAMAIS mettre ici la clé « service_role »/« secret » : elle donne un
// accès administrateur total et n'a rien à faire dans un bundle navigateur.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://axrfkxxgaxohdannvyjz.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4cmZreHhnYXhvaGRhbm52eWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMTYzODksImV4cCI6MjA5OTc5MjM4OX0.TMXBMLF_8c_IBqFTb5oSoUXcYHMo2rsprXwFiDYK7Cc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
