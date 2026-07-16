"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase";

type Status = "checking" | "ok" | "unreachable";

export default function Home() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    async function check() {
      try {
        const { error } = await supabase.rpc("health_check");
        setStatus(error ? "unreachable" : "ok");
      } catch {
        setStatus("unreachable");
      }
    }
    void check();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Market-Pro</h1>
        <p className="text-muted-foreground">
          SaaS de caisse enregistreuse — connecté directement à Supabase
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>État de la base de données</CardTitle>
          <CardDescription>Supabase (PostgreSQL + Auth + RLS)</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={status === "ok" ? "default" : "destructive"}>
            {status === "checking"
              ? "vérification…"
              : status === "ok"
                ? "connectée"
                : "indisponible"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
