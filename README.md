# homie

同棲カップル向けの生活管理アプリ。家計簿、ゴミ出し、カレンダー、書類管理などをふたりで共有できます。

## 機能

| 機能 | 説明 |
|------|------|
| **家計簿** | 支出記録・カテゴリ別集計・月次予算管理・予算vs実績の可視化 |
| **レシートOCR** | レシート撮影 → AIが自動で日付・金額・カテゴリ・店名を読み取り → 支出フォームに自動入力 |
| **サブスク管理** | 定期支払いの登録・次回請求日の自動計算・支出への自動記録・Google Calendar 同期 |
| **ゴミ出し管理** | カテゴリ・収集スケジュール・分別アイテム検索 |
| **ゴミ分別AI** | テキストや写真で「何ゴミ？」を質問 → 登録ルールに基づきAIが回答。分別表OCR一括登録にも対応 |
| **カレンダー** | 予定・タスク管理・繰り返しイベント・Google Calendar 同期 |
| **書類管理** | 契約書等のアップロード・カテゴリ分け・タグ検索 |
| **資料検索AI** | アップロード資料をOCRテキスト化 → 「火災保険の連絡先は？」のように質問すると該当資料から回答 |
| **口座管理** | 銀行・クレカ・現金・電子マネーの残高追跡・取引履歴 |
| **給与管理** | 就業先登録・シフト記録・給与予測・給与明細 |
| **貯金目標** | 目標金額と進捗の管理 |
| **プッシュ通知** | ゴミ出し前日/当日・支払い期限のブラウザプッシュ通知 (Service Worker + VAPID) |
| **ダッシュボード** | 明日のゴミ出し・近日の支払い・各機能サマリーを一画面で表示 |

## 技術スタック

- **バックエンド**: Rust (Axum + SQLx + SQLite)
- **フロントエンド**: React 19 + TypeScript + Vite + TailwindCSS 4
- **認証**: Google OAuth 2.0 + JWT (HttpOnly Cookie)
- **ファイルストレージ**: S3 互換 (MinIO)
- **AI/LLM**: Ollama (qwen3.5:2b) — Raspberry Pi 5 でローカル実行
- **全文検索**: SQLite FTS5 (資料検索用)
- **プッシュ通知**: Web Push (VAPID + Service Worker)
- **外部トンネル**: Cloudflare Tunnel (スマホアクセス用、オプション)

## 必要なもの

- [Rust](https://rustup.rs/) (1.85+)
- [Node.js](https://nodejs.org/) (20+) + [pnpm](https://pnpm.io/)
- [Docker](https://www.docker.com/) (MinIO 用、ファイルアップロードを使う場合)
- [Google Cloud Console](https://console.cloud.google.com/) のプロジェクト (OAuth 用)
- [Ollama](https://ollama.com/) + Raspberry Pi 5 (AI 機能を使う場合、オプション)

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/your-username/homie.git
cd homie
```

### 2. Google OAuth の設定

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. **API とサービス > 認証情報** で OAuth 2.0 クライアント ID を作成
   - アプリケーションの種類: **ウェブ アプリケーション**
   - 承認済みの JavaScript 生成元: `http://localhost:3001`
   - 承認済みのリダイレクト URI:
     - `http://localhost:3001/api/v1/auth/google/callback`
     - `http://localhost:3001/api/v1/calendar/google/callback`
3. クライアント ID とシークレットをメモ

### 3. 環境変数の設定

```bash
cp homie-backend/.env.example homie-backend/.env
```

`homie-backend/.env` を編集:

```env
# そのままでOK
DATABASE_URL=sqlite:homie.db?mode=rwc
PORT=3001
RUST_LOG=homie_backend=info
FRONTEND_URL=http://localhost:3001
FRONTEND_DIR=../homie-app/dist

# Google OAuth（Step 2 で取得した値を設定）
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v1/auth/google/callback
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3001/api/v1/calendar/google/callback

# 安全なランダム文字列に変更（例: openssl rand -base64 48）
JWT_SECRET=generate-a-random-64-char-string

# MinIO（docker-compose.yml と合わせる）
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=homie-admin
S3_SECRET_KEY=change-this-to-a-strong-password
S3_BUCKET=homie-files
S3_REGION=us-east-1

# AI機能（Ollama、オプション）
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen3.5:2b

# プッシュ通知（オプション）
# VAPID_PRIVATE_KEY=your-vapid-private-key
# VAPID_SUBJECT=mailto:admin@example.com
```

> **JWT_SECRET の生成**: `openssl rand -base64 48` を実行してその出力を貼り付けてください。

### 4. ビルドと起動

**かんたんセットアップ（推奨）:**

```bash
./setup.sh   # フロントエンド・バックエンドをビルド
./start.sh   # MinIO 起動 → バックエンド起動
```

http://localhost:3001 でアクセスできます。

**手動セットアップ:**

```bash
# MinIO 起動（ファイルアップロードを使う場合）
docker compose up -d

# フロントエンドビルド
cd homie-app
pnpm install
pnpm build
cd ..

# バックエンド起動
cd homie-backend
cargo run --release
```

### 5. AI 機能のセットアップ（オプション）

Raspberry Pi 5 (8GB) に Ollama をインストールして qwen3.5:2b を起動:

```bash
# Raspberry Pi 上で
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3.5:2b
ollama serve  # デフォルトで :11434 で起動
```

バックエンドの `.env` に Raspberry Pi のアドレスを設定:

```env
OLLAMA_URL=http://<ラズパイのIP>:11434
OLLAMA_MODEL=qwen3.5:2b
```

### 6. スマホからアクセスする場合（オプション）

Cloudflare Tunnel を使ってインターネットに公開できます:

```bash
brew install cloudflared qrencode  # macOS の場合
./start.sh --tunnel
```

表示されるトンネル URL を Google Cloud Console のリダイレクト URI にも追加してください。

## プロジェクト構成

```
homie/
├── homie-app/              # フロントエンド (React + Vite)
│   ├── src/
│   │   ├── features/       # 機能ごとのコンポーネント・hooks
│   │   │   ├── auth/       #   認証・オンボーディング
│   │   │   ├── dashboard/  #   ダッシュボード
│   │   │   ├── budget/     #   家計簿・サブスク・レシートOCR
│   │   │   ├── calendar/   #   カレンダー・Google Calendar
│   │   │   ├── garbage/    #   ゴミ出し管理・分別AI
│   │   │   ├── documents/  #   書類管理・資料検索AI
│   │   │   ├── accounts/   #   口座管理
│   │   │   ├── employment/ #   就業・給与管理
│   │   │   ├── savings/    #   貯金目標
│   │   │   └── settings/   #   設定・プッシュ通知
│   │   ├── components/     # 共通UIコンポーネント
│   │   ├── utils/          # API・プッシュ通知ユーティリティ
│   │   └── types/          # TypeScript 型定義
│   └── public/
│       ├── sw.js           # Service Worker (プッシュ通知)
│       └── manifest.json   # PWA マニフェスト
├── homie-backend/          # バックエンド (Rust + Axum)
│   ├── src/
│   │   ├── main.rs         #   ルーティング・サーバー起動
│   │   ├── db.rs           #   SQLite スキーマ・マイグレーション
│   │   ├── models.rs       #   データモデル
│   │   ├── errors.rs       #   エラーハンドリング
│   │   ├── validation.rs   #   入力バリデーション
│   │   ├── scheduler.rs    #   プッシュ通知スケジューラー
│   │   ├── middleware/     #   認証ミドルウェア
│   │   ├── handlers/       #   APIハンドラー
│   │   │   ├── receipt.rs  #     レシートOCR
│   │   │   ├── garbage.rs  #     ゴミ管理 + 分別AI
│   │   │   ├── document_ai.rs #  資料検索AI
│   │   │   └── push.rs     #     プッシュ通知
│   │   └── storage/        #   S3 ストレージ
│   └── .env.example
├── docker-compose.yml      # MinIO (S3互換ストレージ)
├── setup.sh                # ビルドスクリプト
├── start.sh                # 起動スクリプト
└── LICENSE
```

## API エンドポイント

### 認証

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/auth/google` | Google OAuth ログイン開始 |
| GET | `/api/v1/auth/google/callback` | OAuth コールバック |
| POST | `/api/v1/auth/refresh` | アクセストークン更新 |
| POST | `/api/v1/auth/logout` | ログアウト |
| GET | `/api/v1/auth/me` | ログインユーザー情報取得 |
| PUT | `/api/v1/auth/profile` | プロフィール更新 |

### ホーム

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/v1/homes` | ホーム作成 |
| POST | `/api/v1/homes/join` | 招待コードで参加 |
| POST | `/api/v1/homes/{home_id}/invite` | パートナーを招待 |

### 家計簿

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/budget/entries` | 支出一覧 |
| POST | `/api/v1/budget/entries` | 支出追加 |
| PUT | `/api/v1/budget/entries/{id}` | 支出更新 |
| DELETE | `/api/v1/budget/entries/{id}` | 支出削除 |
| GET | `/api/v1/budget/summary` | 月次サマリー |
| GET | `/api/v1/budgets/monthly` | 月次予算一覧 |
| POST | `/api/v1/budgets/monthly` | 月次予算作成/更新 |
| DELETE | `/api/v1/budgets/monthly/{id}` | 月次予算削除 |
| POST | `/api/v1/receipt/scan` | レシートOCR読み取り |

### サブスクリプション

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/subscriptions` | サブスク一覧 |
| POST | `/api/v1/subscriptions` | サブスク登録 |
| PUT | `/api/v1/subscriptions/{id}` | サブスク更新 |
| DELETE | `/api/v1/subscriptions/{id}` | サブスク削除 |

### ゴミ出し

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/garbage/categories` | カテゴリ一覧 |
| POST | `/api/v1/garbage/categories` | カテゴリ追加 |
| PUT | `/api/v1/garbage/categories/{id}` | カテゴリ更新 |
| DELETE | `/api/v1/garbage/categories/{id}` | カテゴリ削除 |
| GET | `/api/v1/garbage/schedules` | スケジュール一覧 |
| POST | `/api/v1/garbage/schedules` | スケジュール追加 |
| PUT | `/api/v1/garbage/schedules/{id}` | スケジュール更新 |
| DELETE | `/api/v1/garbage/schedules/{id}` | スケジュール削除 |
| DELETE | `/api/v1/garbage/all` | 全データ削除 |
| POST | `/api/v1/garbage/ask` | ゴミ分別AI質問 |
| POST | `/api/v1/garbage/extract` | 分別表OCR抽出 |

### カレンダー

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/calendar/events` | イベント一覧 |
| POST | `/api/v1/calendar/events` | イベント作成 |
| PUT | `/api/v1/calendar/events/{id}` | イベント更新 |
| DELETE | `/api/v1/calendar/events/{id}` | イベント削除 |
| PATCH | `/api/v1/calendar/events/{id}/toggle` | タスク完了切替 |
| POST | `/api/v1/calendar/events/{id}/exception` | 繰り返し例外追加 |
| DELETE | `/api/v1/calendar/events/{id}/exception/{date}` | 繰り返し例外削除 |

### Google Calendar

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/calendar/google/connect` | Google Calendar 連携開始 |
| POST | `/api/v1/calendar/google/disconnect` | 連携解除 |
| GET | `/api/v1/calendar/google/status` | 連携状態確認 |
| GET | `/api/v1/calendar/google/calendars` | カレンダー一覧 |
| PUT | `/api/v1/calendar/google/calendars` | 同期カレンダー選択 |
| POST | `/api/v1/calendar/google/sync` | 同期実行 |

### 書類管理

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/documents` | 書類一覧 |
| POST | `/api/v1/documents` | 書類追加 |
| PUT | `/api/v1/documents/{id}` | 書類更新 |
| DELETE | `/api/v1/documents/{id}` | 書類削除 |
| POST | `/api/v1/documents/{id}/extract-text` | 書類テキスト抽出 |
| POST | `/api/v1/documents/ask` | 資料検索AI質問 |

### ファイル

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/v1/files` | ファイルアップロード |
| GET | `/api/v1/files/{id}/url` | 署名付きURL取得 |
| DELETE | `/api/v1/files/{id}` | ファイル削除 |

### 口座管理

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/accounts` | 口座一覧 |
| POST | `/api/v1/accounts` | 口座追加 |
| PUT | `/api/v1/accounts/{id}` | 口座更新 |
| DELETE | `/api/v1/accounts/{id}` | 口座削除 |
| GET | `/api/v1/accounts/summary` | 口座サマリー |
| GET | `/api/v1/accounts/{id}/transactions` | 取引履歴 |
| POST | `/api/v1/accounts/{id}/transactions` | 取引追加 |
| DELETE | `/api/v1/accounts/transactions/{id}` | 取引削除 |

### 就業・給与

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/employments` | 就業先一覧 |
| POST | `/api/v1/employments` | 就業先追加 |
| PUT | `/api/v1/employments/{id}` | 就業先更新 |
| DELETE | `/api/v1/employments/{id}` | 就業先削除 |
| GET | `/api/v1/shifts` | シフト一覧 |
| POST | `/api/v1/shifts` | シフト追加 |
| PUT | `/api/v1/shifts/{id}` | シフト更新 |
| DELETE | `/api/v1/shifts/{id}` | シフト削除 |
| GET | `/api/v1/salary/predict` | 給与予測 |
| GET | `/api/v1/salary/records` | 給与記録一覧 |
| POST | `/api/v1/salary/records` | 給与記録追加 |
| PUT | `/api/v1/salary/records/{id}` | 給与記録更新 |
| DELETE | `/api/v1/salary/records/{id}` | 給与記録削除 |

### 貯金目標

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/savings` | 目標一覧 |
| POST | `/api/v1/savings` | 目標追加 |
| PUT | `/api/v1/savings/{id}` | 目標更新 |
| DELETE | `/api/v1/savings/{id}` | 目標削除 |

### プッシュ通知

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/v1/push/subscribe` | プッシュ通知登録 |
| POST | `/api/v1/push/unsubscribe` | プッシュ通知解除 |
| GET | `/api/v1/push/preferences` | 通知設定取得 |
| PUT | `/api/v1/push/preferences` | 通知設定更新 |

## 使い方の流れ

1. Google アカウントでログイン
2. ホームを作成（名前を付ける）
3. パートナーを招待（メールアドレスで招待コードを発行）
4. パートナーがログインすると自動で参加
5. 各機能を自由に使う

## 開発

```bash
# バックエンド開発（ホットリロードなし）
cd homie-backend
cargo run

# フロントエンド開発（HMR あり）
cd homie-app
pnpm dev
```

フロントエンド開発時は `homie-app/.env` に API の向き先を設定:

```env
VITE_API_URL=http://localhost:3001
```

## ライセンス

[MIT](LICENSE)
