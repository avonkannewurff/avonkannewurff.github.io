#!/usr/bin/env bash
# Local dev server (bash/python flavour). For Windows, or anywhere you'd rather
# not depend on bash, use `node serve.mjs` instead -- it does the same job.
#
# The site is plain static files, but js/main.js is an ES module, so file://
# won't work: it has to be served over HTTP.
#
#   ./serve.sh                 -> http://127.0.0.1:8000
#   ./serve.sh 4000            -> pick a port
#   ./serve.sh 8000 0.0.0.0    -> listen on all interfaces
#
# Inside a container the bind address defaults to 0.0.0.0, because 127.0.0.1
# there means "this container only" and the port looks dead from the host.
set -euo pipefail

PORT="${1:-8000}"
if [ -n "${2:-}" ]; then
    HOST="$2"
elif [ -n "${HOST:-}" ]; then
    HOST="$HOST"
elif [ -f /.dockerenv ]; then
    HOST="0.0.0.0"
else
    HOST="127.0.0.1"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Serving ${ROOT} on ${HOST}:${PORT}"
echo "  http://localhost:${PORT}"
if [ "${HOST}" = "0.0.0.0" ] && [ -f /.dockerenv ]; then
    echo "  (container: only reachable if the port was published, e.g. docker run -p ${PORT}:${PORT})"
fi
echo "Ctrl-C to stop."

exec python3 -m http.server "${PORT}" --bind "${HOST}" --directory "${ROOT}"
