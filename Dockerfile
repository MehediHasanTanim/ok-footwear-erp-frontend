# ── Multi-stage Docker build for OK Footwear ERP Frontend ──────────────────
# Stage 1: Build the Vite + React app
# Stage 2: Serve with nginx on port 7173

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Build arg for the API URL — baked into the Vite bundle at build time
ARG VITE_API_URL=http://localhost:7100/api/v1
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app

# Install dependencies (layer cacheable when package*.json unchanged)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Stage 2: Production runtime (nginx) ──────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 7173

CMD ["nginx", "-g", "daemon off;"]
