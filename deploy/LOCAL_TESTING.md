# ローカルテスト手順

Raspberry Piにデプロイする前に、ローカル環境で変更内容をプレビューできます。

## 前提条件

- Docker環境（Docker Desktop または Colima）
- PKMコンテンツディレクトリ（デフォルト: `~/pkm`）

## クイックスタート

```bash
# Colimaを使用している場合は起動
colima start

# ビルドと起動
docker-compose -f docker-compose.local.yml up --build

# ブラウザで http://localhost:8080 にアクセス

# 停止: Ctrl+C の後
docker-compose -f docker-compose.local.yml down
```

## 詳細手順

### 1. Docker環境の起動

**Colimaを使用している場合:**
```bash
colima start
```

**Docker Desktopを使用している場合:**
Docker Desktopを起動してください。

### 2. サブモジュールの更新（必要に応じて）

#### 初回クローン時またはサブモジュール未初期化の場合

```bash
git submodule update --init --recursive
```

#### Quartzに改修が入った場合

Quartzリポジトリ (glxy96/quartz) で改修がマージされた後、このリポジトリのサブモジュール参照を更新:

```bash
cd quartz
git fetch origin
git checkout v4
git pull origin v4
cd ..
git add quartz
git commit -m "chore: Quartzサブモジュールを最新版に更新"
```

#### 特定のブランチをテストする場合

改修中のfeatureブランチをテストしたい場合:

```bash
cd quartz
git fetch origin
git checkout feature/improve-date-footer-management
cd ..
# この状態でローカルテスト（コミット不要）
```

テスト後、本番バージョンに戻す:

```bash
cd quartz
git checkout v4
cd ..
```

### 3. ビルドと起動

```bash
docker-compose -f docker-compose.local.yml up --build
```

初回は Docker イメージのビルドに数分かかります。2回目以降はキャッシュが使われるため高速です。

### 4. プレビュー

ブラウザで以下にアクセス:
```
http://localhost:8080
```

### 5. 停止

`Ctrl+C` でサーバーを停止し、コンテナを削除:
```bash
docker-compose -f docker-compose.local.yml down
```

## カスタマイズ

### PKMディレクトリのパスを変更する

デフォルトは `~/pkm` ですが、環境変数で変更できます:

```bash
export PKM_PATH=/path/to/your/pkm
docker-compose -f docker-compose.local.yml up
```

または `.env` ファイルを作成:
```bash
echo "PKM_PATH=/path/to/your/pkm" > .env
docker-compose -f docker-compose.local.yml up
```

### ポート番号を変更する

`docker-compose.local.yml` の `ports` セクションを編集:
```yaml
ports:
  - "3000:8080"  # ホスト側を3000に変更
```

この場合、`http://localhost:3000` でアクセスします。

## 改修フロー

Quartzに改修を加える場合の全体の流れ:

### 1. Quartzリポジトリで改修

```bash
cd ~/repos/quartz
git checkout -b feature/your-feature
# 改修作業
git add .
git commit -m "feat: your feature"
git push -u origin feature/your-feature
# GitHub でPR作成 → マージ
```

### 2. ローカルでテスト

```bash
cd ~/repos/glxy96-pkm-blog
cd quartz
git fetch origin
git checkout feature/your-feature
cd ..
docker-compose -f docker-compose.local.yml up --build
# http://localhost:8080 で動作確認
```

### 3. サブモジュール参照を更新

改修がマージされたら:

```bash
cd ~/repos/glxy96-pkm-blog
cd quartz
git checkout v4
git pull origin v4
cd ..
git add quartz
git commit -m "chore: Quartzサブモジュールを最新版に更新"
git push origin main
```

### 4. Raspberry Piで反映

```bash
# Raspberry Pi上で
cd /srv/dev-disk-by-uuid-xxx/docker/quartz
git pull origin main
git submodule update --init --recursive
docker compose build --no-cache
# 次回のcron実行で自動的に新バージョンがデプロイされる
```

## トラブルシューティング

### コンテンツが反映されない

1. PKMディレクトリのパスが正しいか確認:
```bash
echo $PKM_PATH
ls ~/pkm/public  # デフォルトの場合
```

2. コンテナを再起動:
```bash
docker-compose -f docker-compose.local.yml down
docker-compose -f docker-compose.local.yml up
```

### サブモジュールが古い状態

```bash
git submodule update --remote
```

### Docker イメージを完全に再ビルド

キャッシュをクリアして再ビルド:
```bash
docker-compose -f docker-compose.local.yml build --no-cache
docker-compose -f docker-compose.local.yml up
```

### ポートが使用中

```
Error: bind: address already in use
```

別のアプリケーションがポート8080を使用している場合、上記「ポート番号を変更する」を参照。
