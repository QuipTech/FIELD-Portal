# syntax=docker/dockerfile:1.7
# NestJS API + migration runner. Build context: backend/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
# psql runs db/applyMigrations.sh during each deploy.
RUN apk add --no-cache postgresql-client
# certs/ is gitignored, so CI pulls AWS's public RDS CA bundle directly
# (buildPoolConfig.ts and psql both verify RDS against it).
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem certs/rdsGlobalBundle.pem
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/db ./db
USER node
EXPOSE 4001
CMD ["node", "dist/main"]
