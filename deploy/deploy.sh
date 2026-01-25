#!/bin/bash
set -euo pipefail # エラーがあれば即停止する

# Set CLOUDFLARE_API_TOKEN from file if not already set
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  export CLOUDFLARE_API_TOKEN=$(cat ${CLOUDFLARE_API_TOKEN_FILE:-/run/secrets/cloudflare_api_token})
fi

# --- 設定項目 ---
CLOUDFLARE_PROJECT_NAME="${CLOUDFLARE_PROJECT_NAME:-my-pkm-blog}"

# --- ディレクトリ設定 (コンテナ内) ---
SOURCE_PKM_DIR="/pkm_host"
SNAPSHOT_DIR="/app/content" 
PUBLIC_DIR="/app/public"

cd /app

# --- ステップ 1: スナップショットディレクトリの準備 ---
echo "INFO: (1/5) スナップショットディレクトリ ($SNAPSHOT_DIR) を準備中..."
rm -rf "$PUBLIC_DIR" "$SNAPSHOT_DIR"
mkdir -p "$SNAPSHOT_DIR"
mkdir -p "$SNAPSHOT_DIR/assets"

# --- ステップ 2: 公開対象の記事(md)のみコピー ---
echo "INFO: (2/5) 公開対象のMarkdown記事をコピー中..."
echo "INFO: Copying 'public' contents to $SNAPSHOT_DIR ..."
rsync -a "$SOURCE_PKM_DIR/public/" "$SNAPSHOT_DIR/"
echo "INFO: Copying 'weekly'..."
rsync -a "$SOURCE_PKM_DIR/weekly/" "$SNAPSHOT_DIR/weekly/"

# --- ステップ 3: 記事から参照されているアセットを検出 (★修正★) ---
echo "INFO: (3/5) 参照アセットを検出中..."
# (修正) sed の / 区切り文字が 'assets/' と衝突していたため、
# 区切り文字を # に変更 (s#...#...#)
ASSET_LINKS=$(grep -Erho '!\[\[[^]]+\]\]|(\.\./)?assets/[^)]+' "$SNAPSHOT_DIR" 2>/dev/null | \
    sed -E 's/^!\[\[//' | \
    sed -E 's/\]\]$//' | \
    sed -E 's/\|.*$//' | \
    sed -E 's#^(\.\./)?assets/##' | \
    grep -ivE '(\.md$|https?:\/\/)' | \
    grep -v -e '^[[:space:]]*$' | \
    sort | uniq || echo "")

if [ -z "$ASSET_LINKS" ]; then
    echo "WARN: 参照アセットは見つかりませんでした。"
else
    echo "INFO: 以下の参照アセットをコピーします:"
    echo "$ASSET_LINKS"
fi

# --- ステップ 4: 検出されたアセットのみコピー ---
echo "INFO: (4/5) 検出されたアセットのみコピー中..."
if [ -n "$ASSET_LINKS" ]; then
    echo "$ASSET_LINKS" > /tmp/asset_list.txt
    rsync -a --files-from=/tmp/asset_list.txt \
          --ignore-missing-args \
          "$SOURCE_PKM_DIR/assets/" "$SNAPSHOT_DIR/assets/"
    
    rm /tmp/asset_list.txt
    COPIED_COUNT=$(find "$SNAPSHOT_DIR/assets" -type f 2>/dev/null | wc -l)
    echo "INFO: $COPIED_COUNT 個のアセットをコピーしました"
else
    echo "INFO: スキップ (コピー対象のアセットがありません)"
fi

# --- ステップ 5: ビルド＆デプロイ ---
echo "INFO: (5/5) Quartzビルドとデプロイを実行中..."
echo "  (ソース: $SNAPSHOT_DIR)"
echo "INFO: Clearing Quartz cache..."
rm -rf /app/quartz/.quartz-cache

if [ "${LOCAL_SERVE:-false}" = "true" ]; then
  echo "INFO: ローカルプレビューモード: ビルドとサーブを実行します..."
  # Quartzはデフォルトで /app/content を読みに行く
  npx quartz build --serve --port 8080
else
  echo "INFO: Building site..."
  # Quartzはデフォルトで /app/content を読みに行く
  npx quartz build

  if [ "${SKIP_DEPLOY:-false}" = "true" ]; then
    echo "INFO: ローカルビルドモード: デプロイをスキップしました。"
    echo "INFO: ビルド結果は $PUBLIC_DIR に出力されています。"
  else
    echo "  (デプロイ中...)"
    npx wrangler pages deploy "$PUBLIC_DIR" --project-name="$CLOUDFLARE_PROJECT_NAME"
    echo "INFO: デプロイが完了しました。"
  fi
fi
