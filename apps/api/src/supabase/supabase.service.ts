import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

/**
 * Client Supabase côté serveur, avec la clé service_role : contourne les
 * policies RLS (usage backend de confiance uniquement, jamais exposé au
 * frontend). Sert à Phase 2 (vérification des JWT Supabase Auth via
 * `auth.getUser`) et aux futurs accès Storage.
 */
@Injectable()
export class SupabaseService {
  readonly admin: ReturnType<typeof createClient>;

  constructor(config: ConfigService) {
    this.admin = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
}
