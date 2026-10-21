# Production multi-stage Dockerfile for Ghar Sathi React Frontend
# Stage 1: Build the Vite production bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install packages
RUN npm install

# Copy source files
COPY . .

# Build production assets
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:1.25-alpine

# Copy built static artifacts to Nginx html folder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
