#!/usr/bin/env bash
set -euo pipefail

# 初始化专用于 context-hub 的隔离 DSH_HOME（与 Desktop ~/.dsh 隔离）
# 用法：bash context-hub/deploy/init-dsh-home.sh [DSH_HOME]

DSH_HOME_DIR="${1:-${CONTEXT_HUB_DSH_HOME:-$HOME/.dsh-context-hub}}"
DSH_BIN="${CONTEXT_HUB_DSH_CLI:-/Applications/DeepSeek Harness.app/Contents/Resources/runtime/cli/bin/dsh}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$DSH_HOME_DIR/profiles/headless" "$DSH_HOME_DIR/sessions" "$DSH_HOME_DIR/storages"
# launchd 的 StandardOutPath 要求目录已存在；不依赖 plist 里写死的用户名。
mkdir -p "$HOME/Library/Logs/context-hub"
cp "$SCRIPT_DIR/headless-model.patch.yml" "$DSH_HOME_DIR/profiles/headless/cordis.patch.yml"

echo "Initialized DSH_HOME at: $DSH_HOME_DIR"
echo "Verifying headless profile config..."
DSH_HOME="$DSH_HOME_DIR" "$DSH_BIN" --profile headless --patch "$DSH_HOME_DIR/profiles/headless/cordis.patch.yml" --help >/dev/null
echo "OK: dsh --profile headless ready under $DSH_HOME_DIR"
