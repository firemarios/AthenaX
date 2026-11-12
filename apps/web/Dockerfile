# POLICYLAB — web image (agent D2).
# Compose build: context = repo root, dockerfile = apps/web/Dockerfile
# Strategy: keep it straightforward and likely-to-work over minimal image size —
# copy the workspace sources, install once, build, then ship node_modules + .next.

FROM node:22-alpine AS build
WORKDIR /app

# npm workspaces (root package.json: apps/web + packages/*) need every
# package.json present before `npm install` resolves the workspace links.
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
COPY packages ./packages

RUN npm install --no-audit --no-fund

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
# Keep the default aligned with docker-compose (http://localhost:8000).
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build --workspace apps/web

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# node_modules (hoisted at /app/node_modules) + workspace sources + .next output.
COPY --from=build /app /app

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace", "apps/web"]
