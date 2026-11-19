# Build from the repository root. The editor registry token is required only for
# the BuildKit secret mount on the editor dependency-install step.
FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build

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
ARG VITE_APP_VERSION
ENV VITE_APP_VERSION=${VITE_APP_VERSION}
RUN npm run build:prod

FROM nginx/nginx-unprivileged:stable-alpine@sha256:0c53a1f2890c3526bfd201440f0fd3970e5b78f80630f58284aad0d34b5ec7bd AS runtime

COPY --chown=nginx:nginx edge/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chown=nginx:nginx --chmod=755 edge/15-edge-origin.envsh /docker-entrypoint.d/15-edge-origin.envsh
COPY --from=build --chown=nginx:nginx /app/build/client /usr/share/nginx/html
COPY --from=build --chown=nginx:nginx /app/build/csp-script-hashes.txt /etc/nginx/csp-script-hashes.txt

EXPOSE 8080
