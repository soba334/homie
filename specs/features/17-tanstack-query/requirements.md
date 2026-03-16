# tanstack-query - 要件定義書

**基準文書**: specs/03_USE_CASES.md, specs/04_API.md
**作成日**: 2026-03-16

---

## 1. 概要

**目的**: TanStack Query v5 + Zod を導入し、全 API コールを移行することで、コード削減・キャッシュ・ランタイム型安全性を実現する。

**背景**: 現在の12個のカスタムフックは useState/useEffect/useCallback で同じパターンを繰り返しており、キャッシュもランタイム型検証もない。

---

## 2. 用語集（ユビキタス言語）

| 用語 | 定義 | 備考 |
|------|------|------|
| Query | サーバーからのデータ取得（GET 系操作） | TanStack Query の useQuery |
| Mutation | サーバーのデータ変更（POST/PUT/PATCH/DELETE 系操作） | TanStack Query の useMutation |
| QueryKey | クエリの一意識別子（キャッシュキー） | 配列形式 |
| staleTime | データが「新鮮」とみなされる期間 | この間はキャッシュを返しリフェッチしない |
| gcTime | 未使用キャッシュがメモリに残る期間 | デフォルト 5分 |
| Invalidation | キャッシュを無効化して再取得を促す | Mutation 成功時に使用 |
| Zod Schema | ランタイム型バリデーション定義 | API レスポンスのパースに使用 |

---

## 3. スコープ

### In Scope（対象）
- TanStack Query v5 + Zod のパッケージ導入
- QueryClientProvider のセットアップ
- Zod スキーマ定義（全 API レスポンス型）
- api.ts の拡張（Zod パース統合）
- 全カスタムフックの TanStack Query 移行（12個）
- QueryKey の体系的な設計
- Mutation + キャッシュ Invalidation パターンの統一
- バックグラウンドジョブポーリングの refetchInterval 移行

### Out of Scope（対象外）
- バックエンド変更
- 新規 API エンドポイント追加
- HTTP クライアント変更（fetch → axios 等）
- SSR/RSC 対応
- DevTools の UI カスタマイズ

---

## 4. 要件

### 4.1 要件 1: TanStack Query 基盤セットアップ

**ユーザーストーリー**:
> 開発者として、TanStack Query の基盤をセットアップしたい。なぜなら全フックの移行基盤が必要だから。

**優先度**: Must

#### 受入条件（Given-When-Then）

**ACC-17-001**: QueryClientProvider 設定
```gherkin
Given アプリが起動した時
When QueryClientProvider がルートに配置されている
Then 全コンポーネントで useQuery/useMutation が使用可能である
And デフォルトの staleTime/gcTime が設定されている
```

**ACC-17-002**: 開発時デバッグ
```gherkin
Given 開発環境でアプリを起動した時
When TanStack Query DevTools が有効化されている
Then キャッシュ状態をブラウザで確認できる
```

---

### 4.2 要件 2: Zod スキーマ定義 + API クライアント統合

**ユーザーストーリー**:
> 開発者として、API レスポンスを Zod でバリデーションしたい。なぜならランタイムでの型安全性を担保したいから。

**優先度**: Must

#### 受入条件（Given-When-Then）

**ACC-17-003**: Zod スキーマによるレスポンスパース
```gherkin
Given API レスポンスが返ってきた時
When Zod スキーマでパースする
Then 型に合致するデータが返される
And 型に合致しない場合はエラーがスローされる
```

**ACC-17-004**: TypeScript 型との統合
```gherkin
Given Zod スキーマが定義されている時
When z.infer<typeof schema> で型を導出する
Then 既存の TypeScript interface と同等の型が得られる
And 既存の types/index.ts の手動型定義を Zod 導出に置き換えられる
```

---

### 4.3 要件 3: Query（データ取得）の移行

**ユーザーストーリー**:
> ユーザーとして、画面遷移後に戻っても即座にデータが表示されてほしい。なぜなら毎回ローディングが表示されるのはストレスだから。

**優先度**: Must

#### 受入条件（Given-When-Then）

**ACC-17-005**: キャッシュによる即時表示
```gherkin
Given Budget ページでデータが表示されている
When 別ページに移動して戻った時
Then キャッシュされたデータが即座に表示される
And バックグラウンドでリフェッチが実行される
```

**ACC-17-006**: ローディング状態
```gherkin
Given データが未取得の状態で
When ページを初めて開いた時
Then ローディング表示がされる
And データ取得完了後にコンテンツが表示される
```

**ACC-17-007**: パラメータ付きクエリ
```gherkin
Given Budget ページで yearMonth が切り替えられた時
When 新しい月のデータを取得する
Then 月ごとにキャッシュが分離して管理される
```

---

### 4.4 要件 4: Mutation（データ変更）の移行

**ユーザーストーリー**:
> ユーザーとして、データを登録・更新した後に自動でリストが最新化されてほしい。なぜなら手動リロードは面倒だから。

**優先度**: Must

#### 受入条件（Given-When-Then）

**ACC-17-008**: Mutation 成功時のキャッシュ更新
```gherkin
Given Budget エントリを新規登録した時
When Mutation が成功する
Then 関連するクエリキャッシュが自動的に invalidate される
And リストが最新データで更新される
```

**ACC-17-009**: Mutation エラーハンドリング
```gherkin
Given Mutation が失敗した時
When サーバーエラーが返される
Then エラー状態が useMutation から取得できる
And ユーザーにエラーが通知される
```

---

### 4.5 要件 5: バックグラウンドジョブポーリングの統合

**ユーザーストーリー**:
> ユーザーとして、レシートOCR等の非同期処理の進捗をリアルタイムで確認したい。

**優先度**: Should

#### 受入条件（Given-When-Then）

**ACC-17-010**: ポーリングベースのジョブ監視
```gherkin
Given バックグラウンドジョブが開始された時
When useQuery の refetchInterval でポーリングする
Then ジョブ完了まで定期的にステータスが更新される
And 完了後にポーリングが停止する
```

---

### 4.6 要件 6: 既存機能の完全互換

**ユーザーストーリー**:
> ユーザーとして、TanStack Query 移行後も全機能が以前と同じように動作してほしい。

**優先度**: Must

#### 受入条件（Given-When-Then）

**ACC-17-011**: 機能互換
```gherkin
Given 全カスタムフック（12個）が TanStack Query に移行された時
When 各機能を使用する
Then 移行前と同じ操作・表示が可能である
```

**ACC-17-012**: 認証フローの維持
```gherkin
Given JWT トークンが期限切れの時
When API コールが 401 を返す
Then 既存の自動リフレッシュ機構が動作する
And リフレッシュ後にリクエストがリトライされる
```

---

## 5. 非機能要件（NFR）

### 5.1 性能要件

| ID | 要件 | 測定方法 | 優先度 |
|----|------|----------|--------|
| NFR-PERF-001 | キャッシュヒット時はネットワークリクエストなし | DevTools 確認 | Must |
| NFR-PERF-002 | バンドルサイズ増加 50KB 未満 | build 後確認 | Should |

### 5.2 開発体験（DX）要件

| ID | 要件 | 測定方法 | 優先度 |
|----|------|----------|--------|
| NFR-DX-001 | カスタムフックのコード行数 50% 以上削減 | diff 比較 | Should |
| NFR-DX-002 | 新規 API フック追加が 10行以内で可能 | コードレビュー | Should |

---

## 6. 制約事項

| ID | 制約内容 | 理由 |
|----|----------|------|
| CON-001 | React 19 対応の TanStack Query v5 を使用 | 既存 React バージョンとの互換性 |
| CON-002 | 既存の fetch ベース api.ts を活かす | axios 移行はスコープ外 |
| CON-003 | バックエンドは変更しない | フロントエンドのみのリファクタリング |

---

## 7. 優先順位サマリー（MoSCoW）

| 分類 | 要件/受入条件 |
|------|---------------|
| **Must** | ACC-17-001〜009, ACC-17-011〜012, NFR-PERF-001 |
| **Should** | ACC-17-010, NFR-PERF-002, NFR-DX-001〜002 |
| **Could** | Optimistic Update（将来検討） |
| **Won't（今回対象外）** | SSR 対応、axios 移行 |

---

## 8. 実装上の考慮事項

- QueryKey は `['feature', 'resource', ...params]` 形式で体系化する
- api.ts に Zod パース用のヘルパー関数を追加（`api.getWithSchema<T>(path, schema)`）
- 既存の types/index.ts の interface を Zod スキーマからの導出（z.infer）に段階的に置き換え
- FormData アップロード（レシートOCR等）は useMutation で管理
- 認証（useAuth）は Context ベースを維持しつつ、API コール部分のみ TanStack Query 化

---

## 9. 関連ドキュメント

- [hearing.md](./hearing.md) - 要件ヒアリング
- [arch-check.md](./arch-check.md) - アーキテクチャチェック
- [design.md](./design.md) - 設計書
