"use client";

import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

// Bloque entièrement l'application pour un compte mis en sommeil par le
// propriétaire de la plateforme. Le compte reste connecté mais ne voit qu'un
// écran d'information, tant qu'il n'est pas réveillé.
export function AccountGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useSession();

  if (!loading && profile?.suspended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <Moon className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Compte en sommeil</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre accès a été temporairement suspendu par l&apos;administrateur de la
            plateforme. Il sera rétabli dès votre réactivation. Contactez votre
            responsable pour plus d&apos;informations.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => void supabase.auth.signOut()}
          >
            Se déconnecter
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
