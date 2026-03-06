# Homie Frontend

同棲カップル向け生活管理アプリ「Homie」のフロントエンド。

## 技術スタック

- **フレームワーク**: React 19
- **ビルドツール**: Vite 7
- **言語**: TypeScript 5.9
- **スタイリング**: TailwindCSS 4
- **ルーティング**: React Router 7
- **アニメーション**: Motion (Framer Motion)
- **アイコン**: Lucide React
- **日付処理**: date-fns
- **パッケージマネージャ**: pnpm

## 機能

### ダッシュボード
- 明日のゴミ出し・近日の支払い表示
- 各機能のサマリー

### 家計簿
- 支出記録 (金額・カテゴリ・誰が払ったか)
- 月次予算管理・予算vs実績の可視化
- レシート撮影 → AI OCRで自動入力

### サブスク管理
- 定期支払いの登録・次回請求日の自動計算
- Google Calendar 同期

### ゴミ出し管理
- カテゴリ管理 (名前・色・分別品目)
- スケジュール管理 (曜日・週指定)
- 分別検索
- AI分別アシスタント (テキスト/画像で「何ゴミ？」)
- 分別表OCR一括登録

### カレンダー
- イベント / タスク管理
- Google Calendar 接続・同期

### 書類管理
- 書類の登録・検索・閲覧
- カテゴリ分類 (契約書 / 保険 / 公共料金 / その他)
- タグ付け
- AI資料検索 (アップロード資料にチャット形式で質問)

### 設定
- プロフィール編集
- プッシュ通知設定 (ゴミ出し・支払いリマインド)

## ディレクトリ構成

```
src/
├── App.tsx                    # ルーティング定義
├── main.tsx                   # エントリーポイント + SW登録
├── index.css                  # グローバルスタイル
├── types/
│   └── index.ts               # 共通型定義
├── utils/
│   ├── api.ts                 # API クライアント
│   └── pushNotification.ts    # プッシュ通知ユーティリティ
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx      # アプリ全体レイアウト
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── FileUpload.tsx
│       ├── Modal.tsx
│       ├── SearchInput.tsx
│       ├── Spinner.tsx
│       ├── Tabs.tsx
│       ├── Toast.tsx           # Motion ベースの通知トースト
│       └── useToast.ts
├── features/
│   ├── dashboard/
│   │   └── DashboardPage.tsx
│   ├── budget/
│   │   ├── BudgetPage.tsx      # 家計簿 + レシートOCR
│   │   ├── BudgetEntryForm.tsx
│   │   ├── SubscriptionForm.tsx
│   │   ├── useBudget.ts
│   │   └── useSubscriptions.ts
│   ├── garbage/
│   │   ├── GarbagePage.tsx     # ゴミ管理 + 分別表OCR登録
│   │   ├── GarbageCategoryForm.tsx
│   │   ├── GarbageScheduleForm.tsx
│   │   ├── GarbageSortModal.tsx # 分別AIアシスタント
│   │   └── useGarbage.ts
│   ├── calendar/
│   │   ├── CalendarPage.tsx
│   │   ├── CalendarEventForm.tsx
│   │   ├── GoogleCalendarConnect.tsx
│   │   ├── useCalendar.ts
│   │   └── google/
│   │       ├── api.ts
│   │       ├── types.ts
│   │       └── useGoogleCalendar.ts
│   ├── documents/
│   │   ├── DocumentsPage.tsx
│   │   ├── DocumentForm.tsx
│   │   ├── DocumentAskModal.tsx # 資料検索AIアシスタント
│   │   └── useDocuments.ts
│   ├── accounts/
│   │   ├── AccountsPage.tsx
│   │   └── useAccounts.ts
│   ├── employment/
│   │   ├── EmploymentPage.tsx
│   │   └── useEmployment.ts
│   ├── savings/
│   │   ├── SavingsPage.tsx
│   │   └── useSavings.ts
│   ├── settings/
│   │   ├── SettingsPage.tsx     # プッシュ通知設定
│   │   └── useNotificationSettings.ts
│   └── auth/
│       ├── LoginPage.tsx
│       ├── OnboardingPage.tsx
│       ├── InvitePartner.tsx
│       └── useAuth.ts
└── public/
    ├── sw.js                   # Service Worker (プッシュ通知)
    └── manifest.json           # PWA マニフェスト
```

## セットアップ

### 前提条件

- Node.js 20+
- pnpm

### インストール

```bash
pnpm install
```

### 開発サーバー起動

```bash
pnpm dev
```

`http://localhost:5173` で起動します。

### ビルド

```bash
pnpm build
```

### Lint

```bash
pnpm lint
```

## パスエイリアス

`@/` で `src/` を参照できます:

```typescript
import { Button } from '@/components/ui';
import type { CalendarEvent } from '@/types';
```

## 状態管理

各 feature の `useXxx.ts` フックでドメイン固有のロジックをカプセル化しています。

## バックエンド連携

バックエンド API (`http://localhost:3001/api/v1/`) と連携。
認証は HttpOnly Cookie (JWT) で自動送信されます。
