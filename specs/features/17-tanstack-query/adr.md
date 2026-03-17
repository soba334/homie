# ADR-001: サーバー状態管理ライブラリとして TanStack Query v5 を採用

## Meta

| 項目 | 内容 |
|------|------|
| **Status** | Accepted |
| **Date** | 2026-03-16 |
| **Decision Type** | Type 1 (不可逆) |
| **Confidence** | High |
| **Author** | |
| **Reviewers** | |

---

## Context / 背景

**問題**:

homie-app のフロントエンドには12個のカスタムフックがあり、それぞれが `useState + useEffect + useCallback` で同一パターン（ローディング状態管理・データ取得・リフェッチ・エラーハンドリング）を繰り返している。キャッシュ機能がないため画面遷移のたびに API を再取得し、UX が低下している。また、API レスポンスの型はコンパイル時のみで、ランタイムバリデーションがない。

**制約条件**:
- React 19 との互換性が必要
- 既存の fetch ベース api.ts を活かす（axios 移行はしない）
- バックエンド（Rust/Axum）は変更しない
- フロントエンドのみの変更

**関連する要件**:
- Requirements: [requirements.md](./requirements.md)
- NFR: NFR-PERF-001（キャッシュヒット時はネットワークリクエストなし）
- NFR: NFR-DX-001（カスタムフックのコード行数 50% 以上削減）
- NFR: NFR-DX-002（新規 API フック追加が 10行以内で可能）

---

## Decision / 決定

**決定内容**:

サーバー状態管理ライブラリとして **TanStack Query v5**（`@tanstack/react-query`）を採用する。

**選択した理由**:
1. **React 19 対応**: TanStack Query v5 は React 19 の Concurrent Features に対応済みで、React Compiler との親和性が高い
2. **実績と安定性**: React Query は業界標準として広く採用されており、活発にメンテナンスされている
3. **機能の完全性**: キャッシュ管理・バックグラウンドリフェッチ・stale-while-revalidate・エラーリトライ・DevTools が標準装備
4. **既存 fetch クライアントとの統合容易性**: `queryFn` に任意の非同期関数を渡せるため、既存の `api.ts` をそのまま活用できる
5. **ボイラープレート削減**: 現在の `useState/useEffect/useCallback` パターンを `useQuery/useMutation` に置き換えることでコード量を大幅削減できる（目標 50%以上）

---

## Alternatives Considered / 検討した代替案

| 選択肢 | メリット | デメリット | 却下理由 |
|--------|----------|------------|----------|
| **TanStack Query v5（採用）** | React 19 対応、実績、完全な機能セット | バンドルサイズ増加 (~50KB) | - |
| SWR | 軽量、Vercel 製 | ミューテーション機能が弱い、DevTools なし | Mutation + Invalidation パターンのサポートが不十分 |
| Zustand + カスタムフック | 柔軟性高い | キャッシュ・リトライ等を自前実装が必要 | 現状の問題（ボイラープレート）を解決しない |
| 現状維持（カスタムフックのみ改善） | 外部依存なし | キャッシュ実装が複雑、stale-while-revalidate の自前実装が困難 | 問題の本質（キャッシュ・状態管理）を解決しない |
| Relay | GraphQL 特化の強力なキャッシュ | GraphQL への移行が前提 | バックエンドは REST API のまま変更しない |

### 選択肢の詳細

#### TanStack Query v5（採用）
- 概要: React 向けサーバー状態管理ライブラリ。useQuery/useMutation/useQueryClient を提供
- 実装方法: QueryClientProvider をルートに配置し、各フックで useQuery/useMutation を使用
- バンドルサイズ: 約 13KB (gzipped)。DevTools は開発環境のみ（本番バンドルに含まない）

#### SWR
- 概要: Vercel 製の軽量データフェッチライブラリ
- 実装方法: useSWR/useSWRMutation を使用
- 却下理由: useMutation の機能（楽観的更新・ロールバック・依存関係の invalidation）が TanStack Query より弱い。DevTools がない。

#### Zustand + カスタムフック
- 概要: グローバル状態管理として Zustand を採用し、その上にカスタムフックを構築
- 実装方法: store でキャッシュを手動管理
- 却下理由: キャッシュの staleTime 管理・バックグラウンドリフェッチ・リトライ等を自前実装する必要があり、実質的に TanStack Query を再発明することになる

---

## Consequences / 結果

### Positive（良い影響）
- カスタムフックのコード量が 50-70% 削減される見込み
- stale-while-revalidate による UX 向上（画面遷移後の即時表示）
- 自動リトライ・バックグラウンドリフェッチが標準動作
- DevTools でキャッシュ状態を可視化できる（開発効率向上）
- 将来の新機能追加時に `useQuery` 10行以内で実装可能

### Negative（受け入れるトレードオフ）
- バンドルサイズが約 13KB (gzip) 増加する（NFR-PERF-002: 50KB 未満なので許容範囲内）
- 全フックの一括移行コストが発生する（12個 + BackgroundJobsProvider）
- チームが TanStack Query の概念（QueryKey, Invalidation, staleTime 等）を習得する必要がある

### Neutral（中立的な影響）
- 既存の `api.ts` は変更せず、拡張ヘルパーの追加のみで対応
- 既存フックの外部インターフェース（返り値）はほぼ変更なし

---

## Risks / リスク

| リスク | 影響度 | 発生確率 | 軽減策 |
|--------|--------|----------|--------|
| React 19 との非互換 | 高 | 低 | v5 は React 19 対応済み。npmで互換性確認後に導入 |
| 移行中の機能デグレ | 高 | 中 | フック単位で段階的に移行し、各フック移行後に動作確認 |
| QueryKey の設計ミス（粒度が粗い/細かい） | 中 | 中 | `queryKeys.ts` で一元管理し、invalidation 範囲を `all` から始めて段階的に細分化 |
| BackgroundJobsProvider の挙動変化 | 中 | 低 | setInterval → refetchInterval への移行は動作等価。completedJobs の状態管理は Context を維持 |

---

## Implementation Notes / 実装メモ

- `queryClient` は singleton として `src/lib/queryClient.ts` からエクスポートし、Provider 外からも `queryClient.invalidateQueries()` を呼び出せるようにする
- ログアウト時は `queryClient.clear()` で全キャッシュをクリアし、次回ユーザーのデータが混入しないようにする
- DevTools は `import.meta.env.DEV` で条件分岐し、本番バンドルに含めない
- 移行は Phase 1（基盤）→ Phase 2（スキーマ）→ Phase 3（Provider）→ Phase 4（フック）→ Phase 5（複雑なフック）の順で実施する

---

## Follow-up Actions / フォローアップ

- [ ] `@tanstack/react-query` v5 のインストールと React 19 互換性確認
- [ ] `src/lib/queryClient.ts` の作成と defaultOptions の調整
- [ ] `src/lib/queryKeys.ts` の作成
- [ ] `src/lib/schemas/` の全スキーマ定義
- [ ] 全12フックの移行完了
- [ ] BackgroundJobsProvider のリファクタリング
- [ ] 移行後のバンドルサイズ計測（NFR-PERF-002 検証）

**レビュー予定日**: 2026-04-16（After-action review）

---

## References / 参照

| 項目 | リンク |
|------|--------|
| Issue | #17 |
| PR | # |
| Requirements | [requirements.md](./requirements.md) |
| Design | [design.md](./design.md) |
| Supersedes | なし |
| Superseded by | なし |

---

## Change Log / 変更履歴

| 日付 | 変更内容 | 変更者 |
|------|----------|--------|
| 2026-03-16 | 初版作成（Accepted） | |
