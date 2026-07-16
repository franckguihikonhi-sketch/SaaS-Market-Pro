import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function getApiHealth() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
  try {
    const res = await fetch(`${apiUrl}/health`, { cache: "no-store" });
    if (!res.ok) return { status: "unreachable" as const };
    return (await res.json()) as { status: string; service: string };
  } catch {
    return { status: "unreachable" as const };
  }
}

export default async function Home() {
  const health = await getApiHealth();
  const isUp = health.status === "ok";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Market-Pro</h1>
        <p className="text-muted-foreground">
          SaaS de caisse enregistreuse — Phase 1 : architecture &amp; base de données
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>État de l&apos;API</CardTitle>
          <CardDescription>apps/api (NestJS + Prisma + PostgreSQL)</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={isUp ? "default" : "destructive"}>
            {isUp ? "connectée" : "indisponible"}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
