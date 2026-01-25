# Quartz デプロイ設定

このディレクトリには、Quartzブログを Raspberry Pi + Cloudflare Pages で運用するためのデプロイ設定が含まれています。

## ディレクトリ構成

```
deploy/
├── Dockerfile.deploy      # Dockerイメージ定義
├── docker-compose.yml     # 本番用Docker Compose設定
├── docker-compose.local.yml # ローカルテスト用設定
├── deploy.sh              # デプロイスクリプト
├── api/                   # APIサーバー
│   ├── server.js
│   ├── package.json
│   └── quartz-api.service # systemdサービスファイル
├── secrets/               # シークレット（Git管理外）
│   ├── cloudflare_api_token
│   └── api_token
└── README.md
```

## セットアップ

### 1. シークレットの設定

```bash
mkdir -p deploy/secrets
echo "YOUR_CLOUDFLARE_API_TOKEN" > deploy/secrets/cloudflare_api_token
echo "YOUR_API_TOKEN" > deploy/secrets/api_token
chmod 600 deploy/secrets/*
```

### 2. Dockerイメージのビルド

```bash
cd deploy
docker compose build
```

### 3. APIサーバーのセットアップ

```bash
# systemdサービスとしてインストール
sudo cp deploy/api/quartz-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable quartz-api
sudo systemctl start quartz-api
```

## 使い方

### 手動デプロイ（従来の方法）

```bash
cd deploy
docker compose run --rm quartz-deploy
```

### API経由でデプロイ

```bash
# 記事デプロイ
curl -X POST http://localhost:3000/api/deploy \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# 環境更新（git pull + docker build）
curl -X POST http://localhost:3000/api/update-env \
  -H "Authorization: Bearer YOUR_API_TOKEN"

# ステータス確認
curl http://localhost:3000/api/status
```

### ローカルテスト

```bash
cd deploy
PKM_PATH=~/pkm docker compose -f docker-compose.local.yml up --build
# ブラウザで http://localhost:8080 にアクセス
```

## API仕様

| エンドポイント | メソッド | 認証 | 説明 |
|---------------|---------|------|------|
| `/api/deploy` | POST | 必要 | Quartzビルド＆Cloudflareデプロイを実行 |
| `/api/update-env` | POST | 必要 | git pull＆Dockerイメージ再ビルドを実行 |
| `/api/status` | GET | 不要 | 現在のジョブ状態を取得 |

認証: `Authorization: Bearer <API_TOKEN>` ヘッダーを付与

## cron設定（オプション）

15分ごとの自動デプロイを継続する場合：

```cron
*/15 * * * * cd /path/to/quartz/deploy && docker compose run --rm quartz-deploy >> deploy.log 2>&1
```

API経由で手動トリガーのみにする場合は、cronを削除してください。
