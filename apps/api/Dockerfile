# Build context = racine du monorepo : docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /repo

FROM base AS build
# Valeur factice : seule utilisée par `prisma generate`/`deploy` au moment du
# build (aucune connexion réelle). Écrasée par la vraie DATABASE_URL injectée
# par la plateforme d'hébergement au démarrage du conteneur.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
RUN pnpm --filter api run build
RUN pnpm --filter api deploy --prod /prod/api

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /prod/api/dist ./dist
COPY --from=build /prod/api/node_modules ./node_modules
COPY --from=build /prod/api/prisma ./prisma
COPY --from=build /prod/api/package.json ./package.json
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
