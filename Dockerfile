# PlexifySOLO — Multi-stage Docker Build
# Stage 1: Install deps + build Vite frontend
# Stage 2: Production server with built assets

# ---- Stage 1: Build ----
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files + local shared-ui dependency
COPY package.json package-lock.json* ./
COPY plexify-shared-ui/ ./plexify-shared-ui/

# Install all dependencies (including devDependencies for build)
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build frontend
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files + local shared-ui (needed for npm ci)
COPY package.json package-lock.json* ./
COPY plexify-shared-ui/ ./plexify-shared-ui/

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts

# Copy built frontend from build stage
COPY --from=build /app/dist ./dist

# Copy production server
COPY server/ ./server/

# Copy public assets that may be referenced at runtime
COPY public/ ./public/

EXPOSE 3000

CMD ["node", "server/index.mjs"]
