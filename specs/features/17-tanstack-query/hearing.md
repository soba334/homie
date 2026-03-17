# tanstack-query - 要件ヒアリング

**作成日**: 2026-03-16

---

## 1. 機能の目的（5W1H + So What）

### What: 何を実現したいか？
- TanStack Query (React Query) を導入し、全APIコールを移行
- Zod によるレスポンス型検証を導入
- 既存のカスタムフック（useBudget, useSubscriptions, useGarbage 等 12個）を TanStack Query ベースに書き換え

### Why: なぜそれが必要か？
- **コード削減**: 各カスタムフックで useState/useCallback/useEffect を手動管理しているボイラープレートの削減
- **キャッシュ**: 画面遷移時のデータ再取得を防ぎ、UX 向上
- **型安全性**: Zod によるランタイムバリデーションで API レスポンスの型安全性を担保

### Who: 誰が使うか？
- 開発者（DX 向上）
- エンドユーザー（キャッシュによるパフォーマンス改善を体感）

### When: いつ使うか？
- 全てのAPI通信時（データ取得・更新・削除）

### Where: どこで使うか？
- homie-app フロントエンド全体

### How: どのように使うか？
- QueryClientProvider をアプリルートに配置
- 各 feature のカスタムフックを useQuery/useMutation ベースに書き換え
- Zod スキーマでレスポンスをパース

### So What: 実現すると何が変わるか？
- カスタムフックのコード量が大幅削減（useState/useEffect/useCallback のボイラープレート除去）
- 画面遷移時のちらつき解消（キャッシュ）
- stale-while-revalidate によるスムーズなデータ更新
- ランタイム型安全性の確保

---

## 2. 現状の理解（SPIN）

### Situation: 現状はどうなっているか？
- React 19 + Vite 7 + TypeScript 5.9 のフロントエンド
- `api.ts` で fetch ベースの汎用 API クライアント（get/post/put/patch/delete）
- JWT 自動リフレッシュ（401時）の仕組みあり
- feature ごとにカスタムフック（計12個）: useBudget, useSubscriptions, useGarbage, useCalendar, useAuth, useAccounts, useMonthlyBudgets 等
- 各フックで useState + useCallback + useEffect でデータ取得・更新を手動管理
- バックグラウンドジョブ（OCR等）は BackgroundJobsProvider で 3秒ポーリング
- ファイルアップロードは FormData で直接 fetch

### Problem: 何が問題か？
- 各カスタムフックが同じパターン（loading/error/data 状態管理 + fetch + refetch）を繰り返している
- キャッシュなし → 画面遷移のたびに API 再取得
- エラーリトライ、バックグラウンドリフェッチ等の高度な機能がない
- API レスポンスの型はコンパイル時のみ（ランタイム検証なし）

### Implication: 問題が続くとどうなるか？
- 新機能追加のたびに同じボイラープレートが増殖
- キャッシュ不在による不必要なサーバー負荷とUX劣化

### Need-payoff: 解決するとどんなメリットがあるか？
- フックのコード量 50-70% 削減
- キャッシュによる体感速度向上
- Zod による防御的プログラミング

---

## 3. 非機能要件の確認

### 性能要件
- キャッシュ staleTime: 適切な値を feature ごとに設定
- gcTime: デフォルト 5分（TanStack Query デフォルト）

### セキュリティ要件
- 既存の JWT 自動リフレッシュ仕組みを維持
- credentials: 'include' を維持

---

## 4. 制約条件

### 技術的制約
- React 19 との互換性が必要
- 既存の api.ts の fetch ラッパーを活かす（axios 移行はしない）
- BackgroundJobsProvider のポーリングパターンとの共存

### ビジネス的制約
- 個人プロジェクト、制約少

---

## 5. スコープ

### 今回のスコープ（In Scope）
- TanStack Query v5 導入
- Zod 導入
- 全既存カスタムフック（12個）の TanStack Query 移行
- QueryClientProvider セットアップ
- Zod スキーマ定義（全 API レスポンス型）
- api.ts への Zod パース統合

### 今回対象外（Out of Scope）
- バックエンド変更
- 新規 API エンドポイント追加
- axios 等への HTTP クライアント移行
- SSR/RSC 対応

---

## 7. 回答サマリ

**確定事項**:
- TanStack Query v5 + Zod を導入
- 全 API コールを移行（段階的ではなく一括）
- 目的はコード削減 + キャッシュ + 型安全性

**未確定・要検討事項**:
- バックグラウンドジョブのポーリングを TanStack Query の refetchInterval に移行するか
- Optimistic Update の適用範囲
- staleTime の feature ごとの最適値
