"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type Profile = {
  id: string;
  organization_id: string;
  full_name: string;
  role: string;
};

export function useSession() {
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
        .select("id, organization_id, full_name, role")
        .eq("id", newSession.user.id)
        .single();
      if (!active) return;
      let prof = data as Profile | null;
      if (prof) {
        // Organisation EFFECTIVE : en mode maintenance, un super_admin agit au
        // nom d'une autre entreprise. my_organization_id() (source des règles
        // RLS) renvoie alors cette entreprise ; on aligne le profil dessus pour
        // que tous les écrans filtrent la bonne organisation.
        const { data: effOrg } = await supabase.rpc("my_organization_id");
        if (effOrg) prof = { ...prof, organization_id: effOrg as string };
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

  return { session, profile, loading, user: session?.user ?? null };
}
