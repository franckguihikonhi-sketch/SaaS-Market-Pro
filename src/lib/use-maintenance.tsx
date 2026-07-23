"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/use-session";

type MaintenanceState = {
  // Organisation actuellement ouverte en maintenance par le super_admin,
  // ou null s'il travaille sur sa propre plateforme.
  activeOrgId: string | null;
  activeOrgName: string | null;
  ready: boolean;
  enter: (orgId: string, orgName: string) => Promise<void>;
  exit: () => Promise<void>;
};

const MaintenanceContext = createContext<MaintenanceState>({
  activeOrgId: null,
  activeOrgName: null,
  ready: false,
  enter: async () => {},
  exit: async () => {},
});

export function useMaintenance() {
  return useContext(MaintenanceContext);
}

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useSession();
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activeOrgName, setActiveOrgName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const isPlatformOwner = profile?.role === "super_admin";

  // La base est la source de vérité : au chargement, on lit l'organisation
  // active éventuelle du super_admin.
  useEffect(() => {
    let active = true;
    async function load() {
      if (!profile) {
        setActiveOrgId(null);
        setActiveOrgName(null);
        setReady(false);
        return;
      }
      if (!isPlatformOwner) {
        setReady(true);
        return;
      }
      const { data } = await supabase.rpc("current_active_org");
      if (!active) return;
      const row = (data as { organization_id: string; organization_name: string }[] | null)?.[0];
      setActiveOrgId(row?.organization_id ?? null);
      setActiveOrgName(row?.organization_name ?? null);
      setReady(true);
    }
    void load();
    return () => {
      active = false;
    };
  }, [profile, isPlatformOwner]);

  const enter = useCallback(async (orgId: string, orgName: string) => {
    await supabase.rpc("set_active_org", { p_org: orgId });
    setActiveOrgId(orgId);
    setActiveOrgName(orgName);
  }, []);

  const exit = useCallback(async () => {
    await supabase.rpc("clear_active_org");
    setActiveOrgId(null);
    setActiveOrgName(null);
  }, []);

  return (
    <MaintenanceContext.Provider value={{ activeOrgId, activeOrgName, ready, enter, exit }}>
      {children}
    </MaintenanceContext.Provider>
  );
}
