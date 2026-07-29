#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_DIR="${CODEXBOARD_REPOSITORY_DIR:-/home/pi/github/codexboard}"
SERVICE_DIR="${REPOSITORY_DIR}/raspberry-image-service"
UNIT_NAME="codexboard-image-service"
GIT_REMOTE="${CODEXBOARD_GIT_REMOTE:-origin}"
GIT_BRANCH="${CODEXBOARD_GIT_BRANCH:-main}"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this script as the pi login user, not root. It will use sudo when required." >&2
  exit 1
fi

if [[ ! -d "${REPOSITORY_DIR}/.git" || ! -f "${SERVICE_DIR}/deploy/install-service.sh" ]]; then
  echo "CodexBoard repository was not found at ${REPOSITORY_DIR}." >&2
  exit 1
fi

cd "${REPOSITORY_DIR}"
if [[ -n "$(git status --porcelain)" ]]; then
  echo "The repository has uncommitted changes. Commit or remove them before updating." >&2
  git status --short >&2
  exit 1
fi

echo "Updating ${GIT_REMOTE}/${GIT_BRANCH} in ${REPOSITORY_DIR}..."
git fetch "${GIT_REMOTE}" "${GIT_BRANCH}"
git merge --ff-only "${GIT_REMOTE}/${GIT_BRANCH}"
REVISION="$(git rev-parse --short HEAD)"

cd "${SERVICE_DIR}"
echo "Installing test dependencies and running tests..."
npm ci
npm test

echo "Installing revision ${REVISION} and restarting ${UNIT_NAME}..."
sudo bash ./deploy/install-service.sh
sudo systemctl restart "${UNIT_NAME}"

for attempt in {1..10}; do
  if curl --fail --silent --show-error http://127.0.0.1:8085/health; then
    echo
    echo "Revision ${REVISION} is healthy."
    sudo systemctl --no-pager --full status "${UNIT_NAME}"
    echo
    echo "Follow image access logs with:"
    echo "  sudo journalctl -u ${UNIT_NAME} -f -o cat | grep '\"event\":\"image_access\"'"
    exit 0
  fi
  if [[ "${attempt}" -lt 10 ]]; then
    sleep 1
  fi
done

echo "The service did not become healthy after restart." >&2
sudo journalctl --no-pager -u "${UNIT_NAME}" -n 80 >&2
exit 1
