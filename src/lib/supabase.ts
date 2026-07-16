import { createClient } from "@supabase/supabase-js";

// Connexion au projet Supabase.
// L'URL et la clé « anon » sont des valeurs PUBLIQUES par conception (elles
// sont livrées dans le bundle du navigateur) ; leur présence ici est normale.
// La protection réelle des données se fait côté base via Row Level Security.
// Ne JAMAIS mettre ici la clé « service_role »/« secret » : elle donne un
// accès administrateur total et n'a rien à faire dans un bundle navigateur.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
