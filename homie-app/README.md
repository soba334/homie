# Homie Frontend

同棲カップル向け生活管理アプリ「Homie」のフロントエンド。

## 技術スタック

- **フレームワーク**: React 19
- **ビルドツール**: Vite 7
- **言語**: TypeScript 5.9
- **スタイリング**: TailwindCSS 4
- **ルーティング**: React Router 7
- **アイコン**: Lucide React
- **日付処理**: date-fns
- **パッケージマネージャ**: pnpm

## 機能

### ダッシュボード
- 各機能のサマリー表示

### ゴミ出し管理
- カテゴリ管理 (名前・色・分別品目)
- スケジュール管理 (曜日・週指定)
- 分別検索

### 家計簿
- 支出記録 (金額・カテゴリ・誰が払ったか)
- 一覧表示

### カレンダー
- イベント / タスク管理
- Google Calendar 接続・同期

### 書類管理
- 書類の登録・検索・閲覧
- カテゴリ分類 (契約書 / 保険 / 公共料金 / その他)
- タグ付け

## ディレクトリ構成

```
src/
├── App.tsx                    # ルーティング定義
├── main.tsx                   # エントリーポイント
├── index.css                  # グローバルスタイル
├── types/
│   └── index.ts               # 共通型定義
├── stores/
│   └── useStore.ts            # グローバルストア (useSyncExternalStore)
├── components/
│   ├── layout/
│   │   └── AppLayout.tsx      # アプリ全体レイアウト
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── FileUpload.tsx
│       ├── Modal.tsx
│       └── SearchInput.tsx
├── features/
│   ├── dashboard/
│   │   └── DashboardPage.tsx
│   ├── garbage/
│   │   ├── GarbagePage.tsx
│   │   ├── GarbageCategoryForm.tsx
│   │   ├── GarbageScheduleForm.tsx
│   │   └── useGarbage.ts
│   ├── budget/
│   │   ├── BudgetPage.tsx
│   │   ├── BudgetEntryForm.tsx
│   │   └── useBudget.ts
│   ├── calendar/
│   │   ├── CalendarPage.tsx
│   │   ├── CalendarEventForm.tsx
│   │   ├── GoogleCalendarConnect.tsx
│   │   ├── useCalendar.ts
│   │   └── google/
│   │       ├── api.ts
│   │       ├── types.ts
│   │       └── useGoogleCalendar.ts
│   └── documents/
│       ├── DocumentsPage.tsx
│       ├── DocumentForm.tsx
│       └── useDocuments.ts
└── hooks/
    └── (共通フック)
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

`useSyncExternalStore` + `localStorage` によるシンプルなグローバルストア。
各 feature の `useXxx.ts` フックでドメイン固有のロジックをカプセル化しています。

## バックエンド連携

バックエンド API (`http://localhost:3000/api/v1/`) と連携。
認証は HttpOnly Cookie (JWT) で自動送信されます。
