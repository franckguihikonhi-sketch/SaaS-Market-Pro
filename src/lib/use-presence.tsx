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

// Présence en temps réel via un canal PAR ORGANISATION : un utilisateur ne
// voit jamais la présence des autres entreprises (isolation multi-tenant).
// En parallèle, un « heartbeat » met à jour last_seen côté base pour alimenter
// la console Plateforme (comptage serveur, réservé au super_admin via RPC).
export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();
  const [online, setOnline] = useState<OnlineMember[]>([]);

  useEffect(() => {
    if (!profile) return;

    // Canal isolé : nom dérivé de l'organisation. Seuls les membres de la même
    // organisation partagent ce canal.
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
          organization_id: profile.organization_id,
          online_at: new Date().toISOString(),
        });
      }
    });

    // Heartbeat serveur (pour la console Plateforme).
    void supabase.rpc("touch_last_seen");
    const heartbeat = setInterval(() => void supabase.rpc("touch_last_seen"), 40000);

    return () => {
      clearInterval(heartbeat);
      void supabase.rpc("go_offline");
      setOnline([]);
      void supabase.removeChannel(channel);
    };
  }, [profile]);

  return <PresenceContext.Provider value={online}>{children}</PresenceContext.Provider>;
}
