# Dockerfile — Project Sovereign static site (Homelab / Privacy Purists friendly)
# Static HTML/CSS/JS served by nginx. Zero backend, zero database, zero cost.
FROM nginx:1.27-alpine AS runner

# nginx user exists in alpine image; run as non-root for security
USER nginx

# Copy only static site files. .dockerignore keeps node_modules, .git,
# webhook-service, scraper, etc. out of the image.
COPY . /usr/share/nginx/html

# Expose port 80 inside container
EXPOSE 80

# Healthcheck for Docker Compose / orchestrators
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

ENTRYPOINT ["nginx", "-g", "daemon off;"]
