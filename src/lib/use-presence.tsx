"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

export type OnlineMember = {
  id: string;
  full_name: string;
  role: string;
  organization_id: string;
  online_at: string;
};

const PresenceContext = createContext<OnlineMember[]>([]);

export function useOnlineMembers() {
  return useContext(PresenceContext);
}

// Présence en temps réel via UN canal global partagé. Chaque utilisateur
// connecté « track » sa présence (avec son organisation). Les écrans lisent
// la liste via useOnlineMembers() : la page Équipe filtre sur sa propre
// organisation, la console Plateforme voit tout le monde.
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();
  const [online, setOnline] = useState<OnlineMember[]>([]);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase.channel("presence-all", {
      config: { presence: { key: profile.id } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<OnlineMember>();
      const members: OnlineMember[] = [];
      for (const key of Object.keys(state)) {
        const meta = state[key]?.[0];
        if (meta) members.push(meta);
      }
      members.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setOnline(members);
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
          organization_id: profile.organization_id,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      setOnline([]);
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}
