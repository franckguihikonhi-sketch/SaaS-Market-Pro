# Build context = racine du monorepo : docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate
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
