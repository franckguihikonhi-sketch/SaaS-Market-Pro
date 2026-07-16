import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marque une route comme accessible sans JWT Supabase. Le guard global
 * d'authentification (Phase 2) lira cette métadonnée pour laisser passer
 * les routes publiques (ex. /health).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
