#!/usr/bin/env bash
set -euo pipefail

image=${1:-csaf-cms-edge:local}
edge_port=${EDGE_PORT:-8080}
origin=${EDGE_ORIGIN:-http://localhost:$edge_port}
container_name="csaf-cms-edge-smoke-$$"
inventory_dir=$(mktemp -d)

cleanup() {
  docker rm --force "$container_name" >/dev/null 2>&1 || true
  rm -rf "$inventory_dir"
}
trap cleanup EXIT

docker create --name "$container_name" "$image" >/dev/null
docker cp "$container_name:/usr/share/nginx/html/secvisogram-editor" \
  "$inventory_dir/secvisogram-editor"
docker rm "$container_name" >/dev/null

docker run --detach \
  --name "$container_name" \
  --publish "$edge_port:8080" \
  --env "EDGE_ORIGIN=$origin" \
  "$image" >/dev/null

for attempt in {1..30}; do
  if curl --fail --silent "$origin/" >/dev/null; then
    break
  fi
  if [[ $attempt -eq 30 ]]; then
    docker logs "$container_name" >&2 || true
    echo "Edge image did not become ready at $origin" >&2
    exit 1
  fi
  sleep 1
done

SMOKE_BASE_URL="$origin" \
SMOKE_EDITOR_TREE="$inventory_dir/secvisogram-editor" \
  npm run test:smoke -- tests/smoke/edge.spec.ts
