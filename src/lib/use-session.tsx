"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  organization_id: string;
  organization_name?: string;
  full_name: string;
  role: string;
  suspended?: boolean;
};

type SessionState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  user: Session["user"] | null;
};

const SessionContext = createContext<SessionState>({
  session: null,
  profile: null,
  loading: true,
  user: null,
});

// Un SEUL point de vérité pour la session : les requêtes (profil + organisation
// + écoute de l'authentification) sont exécutées une fois par le provider, puis
// partagées par toute l'app via useSession(). Auparavant chaque composant
// relançait ces requêtes → lenteur et risques de désynchronisation.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function applySession(newSession: Session | null) {
      if (!active) return;
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, organization_id, full_name, role, suspended")
        .eq("id", newSession.user.id)
        .single();
      if (!active) return;
      let prof = data as Profile | null;
      // Organisation EFFECTIVE : en mode maintenance, un super_admin agit au nom
      // d'une autre entreprise (mémorisée dans localStorage).
      if (prof && prof.role === "super_admin" && typeof window !== "undefined") {
        const activeOrg = window.localStorage.getItem("mp_active_org");
        if (activeOrg) prof = { ...prof, organization_id: activeOrg };
      }
      // Nom de l'organisation (affiché dans la barre). Le super_admin n'a pas
      // d'organisation : on ne fait la requête que s'il y en a une.
      if (prof && prof.organization_id) {
        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", prof.organization_id)
          .single();
        if (!active) return;
        prof = { ...prof, organization_name: (org as { name: string } | null)?.name };
      }
      setProfile(prof);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => void applySession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      void applySession(newSession);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={{ session, profile, loading, user: session?.user ?? null }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
