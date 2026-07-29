#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/codexboard-image-service"
UNIT_SOURCE="${SOURCE_DIR}/deploy/codexboard-image-service.service"
UNIT_TARGET="/etc/systemd/system/codexboard-image-service.service"

if [[ ! -f "${SOURCE_DIR}/package-lock.json" || ! -f "${SOURCE_DIR}/src/server.js" ]]; then
  echo "The Raspberry Pi image service source tree is incomplete." >&2
  exit 1
fi

install -d -o root -g root -m 0755 "${INSTALL_DIR}" "${INSTALL_DIR}/src"
find "${INSTALL_DIR}/src" -mindepth 1 -maxdepth 1 -type f -name '*.js' -delete
install -o root -g root -m 0644 \
  "${SOURCE_DIR}/package.json" \
  "${SOURCE_DIR}/package-lock.json" \
  "${INSTALL_DIR}/"
install -o root -g root -m 0644 "${SOURCE_DIR}"/src/*.js "${INSTALL_DIR}/src/"

(
  cd "${INSTALL_DIR}"
  npm ci --omit=dev
)

install -o root -g root -m 0644 "${UNIT_SOURCE}" "${UNIT_TARGET}"
systemctl daemon-reload

echo "Installed the image service runtime in ${INSTALL_DIR}."
echo "Review /etc/codexboard-image-service.env, then enable or restart codexboard-image-service."
