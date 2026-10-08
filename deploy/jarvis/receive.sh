#!/usr/bin/env bash
set -euo pipefail

if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([0-9a-f]{40})$ ]]; then
  exec sudo -n /usr/local/sbin/whoop-stats-deploy "${BASH_REMATCH[1]}"
fi
echo 'Esta chave permite somente deploy do WHOOP Metrics.' >&2
exit 64
