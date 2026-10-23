# Build context is the repo root, after `npm run build:prod`:
#   docker build -f edge/Dockerfile -t csaf-cms-edge .
FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --chown=nginx:nginx edge/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=nginx:nginx --chmod=755 edge/15-edge-origin.envsh /docker-entrypoint.d/15-edge-origin.envsh
COPY build/client /usr/share/nginx/html
COPY build/csp-script-hashes.txt /etc/nginx/csp-script-hashes.txt

EXPOSE 8080
