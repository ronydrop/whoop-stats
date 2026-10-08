#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

revision=${1:-}
[[ $# == 1 && $revision =~ ^[0-9a-f]{40}$ ]] || exit 64
base=/var/www/whoop-stats
state=/var/lib/whoop-stats/deploy
exec 9>"$state/deploy.lock"
flock -w 300 9
previous=$(readlink -f "$base/current")
[[ $previous == "$base/releases/"* && -d $previous ]] || exit 65
archive=$(mktemp "$state/uploads/release.XXXXXXXX.tgz")
promoted=false

switch_release() {
  ln -sfnT "$1" "$base/current-deploy"
  mv -Tf "$base/current-deploy" "$base/current"
}

healthy() {
  systemctl is-active --quiet whoop-stats-backend whoop-stats-frontend || return 1
  curl --max-time 5 -fsS http://127.0.0.1:8085/healthz >/dev/null || return 1
  [[ $(curl --max-time 5 -s -o /dev/null -w '%{http_code}' \
    -H 'Host: whoop.botjarvis.com.br' -H 'X-Forwarded-Proto: https' \
    http://127.0.0.1:3032/sign-in) == 200 ]] || return 1
  [[ $(curl --max-time 5 -s -o /dev/null -w '%{http_code}' \
    -H 'Host: whoop.botjarvis.com.br' -H 'X-Forwarded-Proto: https' \
    http://127.0.0.1:3032/) == 307 ]] || return 1
  [[ $(curl --max-time 5 -s -o /dev/null -w '%{http_code}' \
    -H 'Host: whoop.botjarvis.com.br' -H 'X-Forwarded-Proto: https' \
    http://127.0.0.1:3032/api/whoop/live) == 401 ]] || return 1
  [[ $(curl --max-time 5 -s -o /dev/null -w '%{http_code}' \
    http://127.0.0.1:8085/api/v1/cycles) == 401 ]] || return 1
  curl --max-time 10 -fsS https://whoop.botjarvis.com.br/sign-in >/dev/null
}

finish() {
  result=$?
  set +e
  trap - EXIT
  if [[ $result != 0 && $promoted == true ]]; then
    echo 'Validação falhou; restaurando a versão anterior.' >&2
    switch_release "$previous"
    systemctl restart whoop-stats-backend whoop-stats-frontend
    sleep 2
    healthy || echo 'A versão anterior exige verificação administrativa.' >&2
  fi
  rm -f -- "$archive"
  exit "$result"
}
trap finish EXIT
trap 'exit 1' HUP INT TERM

python3 - "$archive" 3<&0 <<'PY'
import os
import sys
size = 0
with os.fdopen(3, "rb") as source, open(sys.argv[1], "wb") as output:
    while chunk := source.read(1024 * 1024):
        size += len(chunk)
        if size > 300_000_000:
            raise ValueError("Pacote maior que o permitido.")
        output.write(chunk)
PY

release=$(mktemp -d "$base/releases/ci-$revision.XXXXXXXX")
chown whoop-deploy:whoop-stats "$release"
chmod 750 "$release"
chown whoop-deploy:whoop-deploy "$archive"
chmod 600 "$archive"
runuser -u whoop-deploy -- python3 /usr/local/libexec/whoop-stats-extract "$archive" "$release"
chown -hR root:whoop-stats "$release"
find "$release" -type d -exec chmod 750 {} +
find "$release" -type f -exec chmod 640 {} +
[[ $(cat "$release/REVISION") == "$revision" ]] || exit 65
test -f "$release/bin/whoop-stats"
test -f "$release/web/node_modules/next/dist/bin/next"
test -f "$release/web/.next/BUILD_ID"
chmod 750 "$release/bin/whoop-stats"
install -d -m 700 -o whoop-stats -g whoop-stats "$release/web/.next/cache"
promoted=true
switch_release "$release"
systemctl restart whoop-stats-backend whoop-stats-frontend
for attempt in $(seq 1 30); do
  if healthy; then
    printf 'Deploy validado: %s\n' "$revision"
    exit 0
  fi
  sleep 2
done
exit 1
