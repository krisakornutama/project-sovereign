# Dockerfile — Project Sovereign static site (Homelab / Privacy Purists friendly)
# Build stage — not needed for pure static, but kept for future asset pipeline
FROM nginx:1.27-alpine AS runner

# Security: run nginx as non-root user (nginx user exists in alpine image)
USER nginx

# Copy only the static site files into nginx html dir
COPY . /usr/share/nginx/html
# Exclude node_modules / state from being copied if present at build time
RUN rm -rf /usr/share/nginx/html/node_modules /usr/share/nginx/html/state 2>/dev/null || true

# Expose port 80 inside container
EXPOSE 80

# Healthcheck for Docker Compose / orchestrators
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

ENTRYPOINT ["nginx", "-g", "daemon off;"]
