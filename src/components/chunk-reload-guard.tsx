"use client";

import { useEffect } from "react";

// Après un déploiement, un navigateur peut garder en cache un ancien
// index.html qui référence des fichiers JS supprimés → « ChunkLoadError » et
// page blanche. Ce garde recharge automatiquement la page (une seule fois)
// pour récupérer la version à jour.
export function ChunkReloadGuard() {
  useEffect(() => {
    const KEY = "mp-chunk-reloaded";
    const looksLikeChunkError = (msg: string) =>
      /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
        msg
      );

    const handle = (msg: string) => {
      if (!looksLikeChunkError(msg)) return;
      if (sessionStorage.getItem(KEY)) return; // évite une boucle de rechargement
      sessionStorage.setItem(KEY, "1");
      // Recharge en CONTOURNANT le cache (un paramètre unique force le
      // navigateur à récupérer un index.html frais, donc les bons fichiers JS).
      const url = new URL(window.location.href);
      url.searchParams.set("_r", Date.now().toString());
      window.location.replace(url.toString());
    };

    const onError = (e: ErrorEvent) => handle(e?.message ?? "");
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e?.reason;
      handle(typeof r === "string" ? r : (r?.message ?? ""));
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    // Si la page a chargé sans souci, on réarme le garde pour le prochain coup.
    const t = window.setTimeout(() => sessionStorage.removeItem(KEY), 8000);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.clearTimeout(t);
    };
  }, []);

  return null;
}
