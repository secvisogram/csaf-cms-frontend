# Build from the repository root. The editor registry token is required only for
# the BuildKit secret mount on the editor dependency-install step.
FROM node:25-alpine@sha256:bdf2cca6fe3dabd014ea60163eca3f0f7015fbd5c7ee1b0e9ccb4ced6eb02ef4 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY vendor/secvisogram-editor/package.json \
  vendor/secvisogram-editor/package-lock.json \
  vendor/secvisogram-editor/.npmrc \
  ./vendor/secvisogram-editor/
RUN --mount=type=secret,id=github_npmrc,target=/run/secrets/github_npmrc,required=true \
  cd vendor/secvisogram-editor && \
  NPM_CONFIG_USERCONFIG=/run/secrets/github_npmrc npm ci

COPY app ./app
COPY public ./public
COPY secvisogram-mock ./secvisogram-mock
COPY scripts ./scripts
COPY react-router.config.ts tsconfig.json vite.config.ts ./
RUN npm run build:prod

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03 AS runtime

COPY --chown=nginx:nginx edge/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=nginx:nginx --chmod=755 edge/15-edge-origin.envsh /docker-entrypoint.d/15-edge-origin.envsh
COPY --from=build --chown=nginx:nginx /app/build/client /usr/share/nginx/html
COPY --from=build --chown=nginx:nginx /app/build/csp-script-hashes.txt /etc/nginx/csp-script-hashes.txt

EXPOSE 8080
