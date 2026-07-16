# Build context = racine du monorepo : docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS build
# Valeur factice : seule utilisée par `prisma generate` au moment du build
# (aucune connexion réelle). Écrasée par la vraie DATABASE_URL injectée par
# la plateforme d'hébergement au démarrage du conteneur.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
RUN pnpm --filter api run build

# Runtime : on conserve la même structure de répertoires que le monorepo
# (plutôt que `pnpm deploy`, qui sélectionne les fichiers suivis par git et
# exclut donc dist/) pour que les symlinks pnpm de node_modules restent
# valides.
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
