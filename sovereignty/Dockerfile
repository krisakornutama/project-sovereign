# Dockerfile — Sovereign LAN Messenger (mesh service)
# Zero npm dependencies (Node built-ins only) ⇒ no npm install inside the image.
# Target: Raspberry Pi / Mini PC (Linux) with network_mode: host so that
# real LAN neighbours (phones, PCs, other servers in the house/farm) are
# discoverable through UDP multicast without internet.

FROM node:22-alpine

# Non-root user for container security (same rule as the web container)
USER node

WORKDIR /app
COPY server.js /app/server.js
# Chat UI is read by server.js at startup (public/lan-messenger.html)
COPY public /app/public

ENV NODE_ENV=production
ENV MESH_HTTP_PORT=4200
EXPOSE 4200/udp
EXPOSE 4200/tcp

# Basic liveness probe — file read is enough; endpoint check needs networking
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MESH_HTTP_PORT||4200)+'/health').then(r=>{process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
