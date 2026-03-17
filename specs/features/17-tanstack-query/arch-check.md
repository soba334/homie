# tanstack-query - アーキテクチャチェック

**対象**: `design.md` (2026-03-16)
**基準**: `requirements.md`, `adr.md`, 既存コードベース
**レビュー日**: 2026-03-16

---

## 1. 設計原則チェック

### YAGNI: PASS

- TanStack Query v5 は12個のカスタムフックが全て同じ useState/useEffect/useCallback パターンを繰り返している現状を解決するために必要
- Zod スキーマはランタイム型安全性の要件 (ACC-17-003) を満たすために必要
- Optimistic Update は「将来検討」と明示的にスコープ外にしており適切
- DevTools は開発環境のみの条件分岐で本番に含めない設計

不要機能の検出なし。設計は現在の要件に対して必要十分。

### KISS: PASS

- 既存の `api.ts` の fetch ベース実装を維持し、`*WithSchema` メソッドの追加のみ
- QueryKey は `['feature', 'resource', ...params]` のフラットな階層で理解しやすい
- フック移行パターンは A〜E の5つに分類されており、各パターンが明快
- 不要な抽象レイヤー（例: Repository パターン、Service 層）を導入していない

### DRY: PASS

- 現状12個のフック全てで useState/useEffect/useCallback のボイラープレートが重複しており、TanStack Query 導入でこの知識の重複を解消する設計
- QueryKey を `queryKeys.ts` で一元管理し、文字列リテラルの散在を防止
- Zod スキーマから `z.infer` で型を導出し、`types/index.ts` の手動型定義との二重管理を段階的に解消する方針
- `api.ts` の `*WithSchema` ヘルパーで Zod パースロジックの重複を防止

注意点（軽微）: 移行中は `types/index.ts` の手動型と Zod 導出型が一時的に共存するが、段階的移行として許容範囲内。

### SRP: PASS

各レイヤーの責務が明確に分離されている:

| レイヤー | 責務 | 変更理由 |
|----------|------|----------|
| `queryKeys.ts` | キャッシュキーの一元管理 | キー構造変更時 |
| `schemas/*.ts` | Zod スキーマ + 型定義 | API レスポンス形式変更時 |
| `api.ts` | HTTP リクエスト + Zod パース | 通信方式変更時 |
| Feature Hooks | useQuery/useMutation 組み立て | 機能追加・変更時 |
| Components | UI 表示 | UI/UX 変更時 |

### SOLID: PASS

- **SRP**: 上記の通り
- **OCP**: 新機能追加は `schemas/` にスキーマ追加 + `queryKeys` にキー追加 + 新フック作成で完結。既存コードの修正不要
- **LSP**: 該当するクラス継承なし。フックの返り値インターフェースは既存と互換
- **ISP**: 各フックは必要なデータのみ返す。`queryKeys` オブジェクトは feature ごとにネストされており、不要なキーへの依存が発生しない
- **DIP**: Feature Hooks は `api.ts` の抽象（`getWithSchema` 関数）に依存。具象の fetch 実装を直接呼ばない

### 過剰設計: PASS

- `src/lib/schemas/` に13ファイルは多く見えるが、12個のフック + BackgroundJob 分であり1:1対応で妥当
- QueryKey のネスト構造は `queryKeys.budget.all` / `queryKeys.budget.entries(yearMonth)` のように invalidation 粒度に直接対応しており、使わない抽象がない
- `staleTime` を feature 別に設定するのは実際のデータ特性に基づいており（ゴミ分類は静的、カレンダーは動的）、過剰ではない

---

## 2. 決定タイプ検証

### Type 1 決定（不可逆）

| 決定事項 | ADR | 状態 |
|----------|-----|------|
| TanStack Query v5 採用 | [adr.md](./adr.md) ADR-001 | PASS - ADR が存在し、Accepted 状態。代替案（SWR, Zustand, 現状維持, Relay）の比較あり |

ADR-001 の品質確認:
- Context / Decision / Alternatives / Consequences / Risks が全て記載済み
- 代替案5つの比較表あり（定量的なバンドルサイズ比較含む）
- リスク表に影響度・発生確率・軽減策あり
- フォローアップアクション・レビュー予定日あり

### Type 2 決定（可逆）

| 決定事項 | 過度に慎重か | 判定 |
|----------|--------------|------|
| QueryClient を singleton export | 適切。Provider 外からの操作（logout 等）に必要 | PASS |
| Zod strict vs passthrough | 適切。strict の方が型安全 | PASS |
| BackgroundJobsProvider の Context 維持 | 適切。外部 API 変更を避ける判断 | PASS |
| useAuth は Context 維持 | 適切。全コンポーネントが依存しておりリスク回避 | PASS |
| staleTime のデフォルト 5分 | 適切。feature 別上書き可能 | PASS |
| 既存 `api.get/post` メソッド残存 | 適切。移行中の混在許容 | PASS |
| QueryKey の `as const` | 適切。型推論の恩恵 | PASS |

---

## 3. トレードオフ分析

### 3.1 サーバー状態管理ライブラリ選定

| 選択肢 | バンドルサイズ (gzip) | Mutation サポート | DevTools | 開発工数 (12フック移行) | 推奨 |
|--------|---------------------|-------------------|----------|------------------------|------|
| TanStack Query v5 | ~13KB | 完全（invalidation, optimistic） | 標準装備 | 3-5日 | **採用** |
| SWR | ~4KB | 限定的（useSWRMutation） | なし | 3-5日 | |
| Zustand + 自前キャッシュ | ~1KB + 実装分 | 自前実装 | Zustand DevTools | 2-3週間 | |
| 現状維持（改善のみ） | 0KB | N/A | なし | 1-2日 | |

**選定理由**: 12個のフック全てで Mutation + Invalidation が必要であり、SWR では不十分。自前実装は TanStack Query の再発明となる。バンドルサイズ増加 ~13KB は NFR-PERF-002 (50KB 未満) を十分に満たす。

### 3.2 Zod 導入方式

| 選択肢 | ランタイム安全性 | バンドルサイズ (gzip) | 型との統合 | 推奨 |
|--------|-----------------|---------------------|------------|------|
| Zod パース (採用) | 完全 | ~14KB | z.infer で導出 | **採用** |
| TypeScript のみ (現状) | なし | 0KB | 手動定義 | |
| io-ts | 完全 | ~8KB | fp-ts 依存 | |

**選定理由**: Zod 4.x はバンドルサイズが最適化されており、z.infer で型が自動導出されるため手動の interface 定義が不要になる。

### 3.3 キャッシュ invalidation 方式

| 選択肢 | 実装コスト | データ整合性 | パフォーマンス | 推奨 |
|--------|-----------|-------------|---------------|------|
| invalidation + refetch (採用) | 低 | 高（サーバーと一致） | 追加リクエスト1回 | **採用** |
| Optimistic Update | 高 | 中（ロールバック複雑） | 即時反映 | 将来検討 |
| setQueryData 手動更新 | 中 | 中（クライアント側計算） | リクエストなし | |

**選定理由**: invalidation + refetch はサーバーとの整合性が保証され、実装が単純。家計管理アプリのデータ量ではリフェッチのコストが低い。Optimistic Update は将来の UX 改善として段階的に導入可能。

---

## 4. パフォーマンス・最適化レビュー

### 4.1 API 呼び出しパターン

| 項目 | 評価 | 詳細 |
|------|------|------|
| N+1 問題 | なし | 各フックは既存と同じ API エンドポイントを呼ぶのみ。BackgroundJobsProvider のポーリングもジョブ単位で1リクエスト |
| 不要なリフェッチ | 対策済み | `staleTime` により同一キーの重複リクエストを抑制。`refetchOnWindowFocus: true` はデフォルトで妥当 |
| キャッシュヒット率 | 向上 | 現状0%（キャッシュなし）から、staleTime 5分で画面遷移後の即時表示が可能に |
| Mutation 後のリフェッチ | 適切 | `queryKeys.budget.all` で一括 invalidation 時は entries + summary の2リクエスト。粒度として妥当 |

### 4.2 バンドルサイズ影響

| パッケージ | サイズ (gzip) | 影響 |
|------------|-------------|------|
| @tanstack/react-query | ~13KB | 追加 |
| @tanstack/react-query-devtools | ~0KB (本番) | 開発のみ |
| zod (4.x) | ~14KB | 追加 |
| **合計追加** | **~27KB** | NFR-PERF-002 (50KB 未満) を満たす |

**削減効果**: 既存フック12個の useState/useEffect/useCallback ボイラープレート（約 1,054 行合計）を大幅に削減。推定 50-60% のコード削減で NFR-DX-001 を達成見込み。

### 4.3 メモリ使用量

| 項目 | 影響 |
|------|------|
| QueryCache | 各キーごとにレスポンスデータをメモリ保持。`gcTime: 10分` で未使用キャッシュを自動解放 |
| 同時キャッシュ数 | 最大 20-30 キー（全 feature の全 yearMonth 組み合わせ）。家計管理アプリのデータ量では問題なし |
| ログアウト時 | `queryClient.clear()` で全キャッシュ即座に解放 |

### 4.4 キャッシュ戦略の妥当性

| Feature | staleTime | 妥当性 |
|---------|-----------|--------|
| garbage | 10分 | PASS - マスターデータ的な性質。ユーザーが頻繁に更新しない |
| calendar | 3分 | PASS - 複数ユーザーが共有する可能性があり、鮮度が重要 |
| budget | 5分 | PASS - 登録後は invalidation で即時更新。閲覧時は5分で十分 |
| auth/me | 10分 | PASS - セッション情報の変更頻度は低い |
| jobs (polling) | 0 | PASS - リアルタイム性必須。refetchInterval: 3秒で適切 |

---

## 5. 既存システムとの整合性

### 5.1 アーキテクチャパターンとの一貫性

| 項目 | 既存パターン | 設計の対応 | 判定 |
|------|-------------|-----------|------|
| ディレクトリ構造 | `src/features/*/use*.ts` | 同じ場所にフックを配置 | PASS |
| API クライアント | `src/utils/api.ts` の拡張 | 既存メソッド維持 + `*WithSchema` 追加 | PASS |
| 型定義 | `src/types/index.ts` | 段階的に Zod 導出へ移行 | PASS |
| Provider 階層 | AuthContext > Toast > BackgroundJobs > Router | QueryClientProvider を最外殻に追加 | PASS |
| 状態管理 | `src/stores/useStore.ts` 存在 | 干渉なし（別レイヤー） | PASS |

### 5.2 命名規則との整合

| 項目 | 既存 | 設計 | 判定 |
|------|------|------|------|
| フック名 | `useBudget`, `useGarbage` | 同名を維持 | PASS |
| ファイル名 | `useSubscriptions.ts` | 同名を維持 | PASS |
| 新規ディレクトリ | なし | `src/lib/schemas/`, `src/lib/queryClient.ts` | PASS - `src/lib/` は新設だが慣例に沿った配置 |

### 5.3 重要な差異: useAuth の login 実装

設計書 3.5 パターン E の `login` 関数が email/password 方式で記述されている:
```typescript
const login = useCallback(async (email, password) => {
  await api.post('/api/v1/auth/login', { email, password });
  queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
}, []);
```

しかし実際の実装は Google OAuth リダイレクト方式:
```typescript
const login = useCallback(() => {
  window.location.href = `${API_BASE}/api/v1/auth/google`;
}, []);
```

**判定**: FAIL (LOW) - パターン例示の誤記。実装時に修正すれば影響は軽微だが、設計書の正確性のために修正が必要。

---

## 6. セキュリティレビュー

| 項目 | 対応 | 判定 |
|------|------|------|
| ログアウト時キャッシュクリア | `queryClient.clear()` | PASS |
| キャッシュの永続化 | メモリのみ（localStorage 不使用） | PASS |
| 401 自動リフレッシュ | 既存の `api.ts` `tryRefresh()` をそのまま利用 | PASS |
| Zod パースエラー | ZodError として TanStack Query に伝播 | PASS |
| credentials 設定 | `credentials: 'include'` 維持 | PASS |

---

## 7. エラーハンドリング・リトライ戦略

| エラー種別 | 設計 | 既存動作との互換 | 判定 |
|------------|------|-----------------|------|
| 401 | リトライなし（api.ts 内でリフレッシュ処理） | 互換 | PASS |
| 403, 404 | リトライなし | 新規（既存は ignore） | PASS |
| 5xx | 最大2回リトライ | 新規（既存はリトライなし） | PASS - UX 向上 |
| ZodError | リトライなし | 新規 | PASS - 適切 |
| ネットワークエラー | 最大2回リトライ | 新規 | PASS |

**注意**: 既存フックはエラーを全て `catch { // ignore }` で握りつぶしている。TanStack Query 移行後は `isError` / `error` としてコンポーネントに伝播するため、エラーが表示されるようになる。これは UX の改善だが、コンポーネント側でエラー表示が未実装の場合にデフォルトの挙動を確認する必要がある。

---

## 8. 技術リスク

| リスク | 影響度 | 発生確率 | 軽減策 |
|--------|--------|----------|--------|
| React 19 + TanStack Query v5 の互換性問題 | 高 | 低 | v5.x は React 19 対応済み。インストール時に peerDependency 確認 |
| Zod 4.x の API 差異 | 中 | 中 | 基本 API (`z.object`, `z.infer`) は v3 互換。import パスの変更がありうるため、インストール時に確認 |
| 移行中のデグレ | 高 | 中 | フック単位の段階的移行。各フック移行後に手動動作確認 |
| 既存コンポーネントとの返り値互換性 | 中 | 低 | 返り値インターフェースを維持する方針。`loading: isLoading` のリネーム等で対応 |
| BackgroundJobsProvider の挙動変化 | 中 | 低 | setInterval -> refetchInterval は動作等価。Context の外部 API は変更なし |
| Zod パースエラーによる予期しないエラー表示 | 中 | 中 | バックエンドレスポンスと Zod スキーマの厳密な一致を確認。初期は `.passthrough()` も検討 |
| Zod が未インストール | 高 | 高 | requirements.md では「インストール済み」だが package.json に未記載。実装開始前にインストール必須 |

---

## 9. 指摘事項

### 9.1 FAIL: Zod 未インストール (HIGH)

**内容**: requirements.md で「Zod 4.3.6 は既にインストール済み」とされているが、`package.json` に zod の記載がなく、`node_modules/zod` も存在しない。

**影響**: 設計の前提条件が実コードベースと一致していない。

**対応**: 実装フェーズの Phase 1 で `pnpm add zod` を実行する。設計上の影響はなし。

### 9.2 FAIL (LOW): useAuth の login パターン例示の誤り

**内容**: design.md 3.5 パターン E の `login` 関数が email/password 方式で記述されているが、実際は Google OAuth リダイレクト (`window.location.href`) 方式。

**影響**: 実装者が設計書のサンプルコードをそのままコピーすると動作しない。

**対応**: design.md のパターン E を実際の OAuth フローに合わせて修正。

### 9.3 注意: useCalendar の fetchEvents パターン

**内容**: 既存の `useCalendar` は `fetchEvents(start, end)` を引数で呼び出す命令的なパターン。`useRef` で range を保持し、mutation 後に `refetch()` を呼ぶ。設計書では QueryKey にパラメータを含める宣言的パターンへの移行が想定されるが、`useCalendar` の具体的な移行パターンが design.md に明示されていない。

**影響**: `fetchEvents` の呼び出しインターフェースの変更がコンポーネント側に波及する可能性。

**対応**: design.md に useCalendar の具体的な移行パターンを追加することを推奨。

### 9.4 注意: useDocuments の searchDocuments パターン

**内容**: 既存の `useDocuments` は `searchDocuments(query)` でサーバーサイド検索を行い、state を書き換える。search/category パラメータの QueryKey への組み込み方が設計書で不明。

**影響**: 軽微。実装時に判断可能。

### 9.5 注意: useNotificationSettings の特殊性

**内容**: `useNotificationSettings` は API コール以外にも Service Worker 登録、Push 購読、Notification Permission API などブラウザ API を多用する。TanStack Query 移行は `/api/v1/push/preferences` の GET/PUT 部分のみが対象だが、設計書に具体的な移行範囲が明記されていない。

**影響**: 軽微。フック内の非 API ロジックは維持するだけ。

---

## 10. 推奨アクション

### 必須 (HIGH)

| ID | アクション | 優先度 | 理由 |
|----|-----------|--------|------|
| ACT-01 | Zod のインストール確認と package.json への追加 | HIGH | 設計の前提条件が未達成 |
| ACT-02 | design.md パターン E の login を Google OAuth リダイレクトに修正 | HIGH | 実装者の混乱防止 |

### 推奨 (MEDIUM)

| ID | アクション | 優先度 | 理由 |
|----|-----------|--------|------|
| ACT-03 | useCalendar の移行パターンを design.md に追記 | MEDIUM | 命令的 -> 宣言的の変換が非自明 |
| ACT-04 | Zod パースエラー時のフォールバック戦略を明確化 | MEDIUM | バックエンドのレスポンス形式変更時の影響緩和 |
| ACT-05 | 既存フックのエラー握りつぶし -> エラー表示への移行による UX 変化を確認 | MEDIUM | 移行前後で挙動が変わる |

### 検討 (LOW)

| ID | アクション | 優先度 | 理由 |
|----|-----------|--------|------|
| ACT-06 | `patchWithSchema` の追加検討 | LOW | calendar の toggleTask で patch を使用 |
| ACT-07 | `deleteWithSchema` の追加検討 | LOW | 現在の delete は void 返却で不要の可能性が高い |
| ACT-08 | useGarbage の `deleteAll` (`DELETE /api/v1/garbage/all`) のスキーマ反映 | LOW | 特殊な API パターン |

---

## 11. チェックサマリ

| カテゴリ | ステータス | コメント |
|----------|------------|----------|
| YAGNI | PASS | 不要機能なし |
| KISS | PASS | 不要な抽象レイヤーなし |
| DRY | PASS | ボイラープレート重複を解消する設計 |
| SRP | PASS | 各レイヤーの責務が明確 |
| SOLID | PASS | OCP に優れた拡張性 |
| 過剰設計 | PASS | 必要十分な構成 |
| Type 1 決定に ADR 存在 | PASS | ADR-001 が高品質で存在 |
| Type 2 決定の適切性 | PASS | 7件全て妥当 |
| トレードオフ分析 | PASS | 3つの主要選定に定量比較あり |
| パフォーマンスレビュー | PASS | バンドル ~27KB、キャッシュ戦略妥当 |
| セキュリティ | PASS | ログアウト時クリア、メモリのみ |
| 既存システム整合性 | PASS (条件付き) | login パターン例示に誤り (LOW) |
| 技術リスク管理 | PASS | 7件のリスクに軽減策あり |

**総合判定**: **PASS (条件付き)**

必須アクション ACT-01, ACT-02 を design.md / 実装計画に反映すること。いずれも軽微な修正であり、アーキテクチャの根本的な再設計は不要。

---

## 12. 遷移条件チェック

- [x] 全設計原則チェック完了
- [x] FAIL は軽微（LOW 1件 + 前提条件の確認 1件）
- [x] Type 1 決定の ADR 存在確認済み (ADR-001)
- [x] トレードオフ分析で推奨案が選定済み（3件）
- [x] 技術リスク表作成済み（7件）
- [ ] 必須アクション ACT-01, ACT-02 の対応 -> 実装フェーズで対応可能

**判定**: test-spec フェーズへの遷移 **可**
