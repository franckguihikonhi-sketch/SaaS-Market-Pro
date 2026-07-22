"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

export type OnlineMember = {
  id: string;
  full_name: string;
  role: string;
  online_at: string;
};

const PresenceContext = createContext<OnlineMember[]>([]);

export function useOnlineMembers() {
  return useContext(PresenceContext);
}

// Suit la présence en temps réel de tous les membres connectés de
// l'organisation (Supabase Realtime Presence). Chaque utilisateur connecté
// « track » sa présence ; l'admin lit la liste via useOnlineMembers().
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();
  const [online, setOnline] = useState<OnlineMember[]>([]);

  useEffect(() => {
    if (!profile) return;

    // Heartbeat : met à jour last_seen (utilisé par la console plateforme
    // pour savoir quelles entreprises/agents sont actifs). Signalé au montage,
    // toutes les 30 s, et dès que l'onglet/écran redevient visible (mobile).
    const beat = () => void supabase.rpc("touch_last_seen");
    beat();
    const heartbeat = setInterval(beat, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase.channel(`presence-org-${profile.organization_id}`, {
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
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisible);
      setOnline([]);
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}
