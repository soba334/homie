# テスト仕様書: tanstack-query

**Issue**: #17
**更新日**: 2026-03-16
**ステータス**: Draft

---

## テスト方針

### テスト種別
| 種別 | 対象 | ツール/フレームワーク |
|------|------|---------------------|
| 単体テスト | Zod スキーマ、QueryKey 生成、api.ts ヘルパー | Vitest |
| 統合テスト | TanStack Query フック（useQuery/useMutation 統合） | Vitest + React Testing Library + MSW |
| E2E テスト | 対象外（今回スコープ外） | - |

### カバレッジ目標
| 種別 | 目標 |
|------|------|
| ライン | 80% 以上 |
| ブランチ | 70% 以上 |

### テスト環境
| 項目 | 内容 |
|------|------|
| テストランナー | Vitest |
| DOM 環境 | happy-dom |
| フックテスト | @testing-library/react renderHook |
| API モック | MSW (Mock Service Worker) v2 |
| QueryClient | テストごとに新規インスタンス生成 |

---

## ACC 別テストケース

### ACC-17-001: QueryClientProvider 設定

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-001 | 正常系: QueryClient のデフォルト staleTime が 5分に設定されている | queryClient インスタンス | `defaultOptions.queries.staleTime === 300000` | 単体 | Must |
| TC-002 | 正常系: QueryClient のデフォルト gcTime が 10分に設定されている | queryClient インスタンス | `defaultOptions.queries.gcTime === 600000` | 単体 | Must |
| TC-003 | 正常系: QueryClient の retry が 401/403/404 でリトライしない | ApiError(401, "Unauthorized") | `retry(0, error) === false` | 単体 | Must |
| TC-004 | 正常系: QueryClient の retry が 500 系で最大2回リトライする | ApiError(500, "Internal") | `retry(0, error) === true`, `retry(2, error) === false` | 単体 | Must |
| TC-005 | 正常系: Mutation のリトライが無効 | queryClient インスタンス | `defaultOptions.mutations.retry === false` | 単体 | Must |
| TC-006 | 正常系: refetchOnWindowFocus が true | queryClient インスタンス | `defaultOptions.queries.refetchOnWindowFocus === true` | 単体 | Must |

### ACC-17-002: 開発時デバッグ（DevTools）

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-007 | 正常系: 開発環境で ReactQueryDevtools がレンダリングされる | `import.meta.env.DEV = true` | DevTools コンポーネントが DOM に存在する | 統合 | Should |

### ACC-17-003: Zod スキーマによるレスポンスパース

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-008 | 正常系: BudgetEntrySchema が正しい JSON をパースする | `{ id: "b1", homeId: "h1", date: "2026-03-01", amount: 1500, category: "food", description: "lunch", paidBy: "user1" }` | パース成功、型が BudgetEntry と一致 | 単体 | Must |
| TC-009 | 異常系: BudgetEntrySchema が amount を文字列で受けるとエラー | `{ id: "b1", homeId: "h1", date: "2026-03-01", amount: "not-a-number", category: "food", description: "lunch", paidBy: "user1" }` | ZodError がスローされる | 単体 | Must |
| TC-010 | 異常系: BudgetEntrySchema が必須フィールド欠落でエラー | `{ id: "b1" }` | ZodError がスローされる（homeId, date, amount, category, description, paidBy が不足） | 単体 | Must |
| TC-011 | 正常系: BudgetEntrySchema がオプショナルフィールド省略を許容 | `{ id: "b1", homeId: "h1", date: "2026-03-01", amount: 1500, category: "food", description: "lunch", paidBy: "user1" }` (receiptImageUrl, accountId なし) | パース成功 | 単体 | Must |
| TC-012 | 正常系: BudgetSummarySchema が正しい JSON をパースする | `{ monthlyTotal: 50000, byPerson: { "user1": 30000, "user2": 20000 }, byCategory: { "food": 25000, "transport": 10000 } }` | パース成功 | 単体 | Must |
| TC-013 | 正常系: SubscriptionSchema が正しい JSON をパースする | `{ id: "s1", homeId: "h1", name: "Netflix", amount: 1490, category: "entertainment", paidBy: "user1", billingCycle: "monthly", billingDay: 15, nextBillingDate: "2026-04-15", isActive: true, syncToCalendar: false, createdAt: "2026-01-01T00:00:00Z" }` | パース成功 | 単体 | Must |
| TC-014 | 正常系: GarbageCategorySchema が items 配列を含む JSON をパースする | `{ id: "g1", homeId: "h1", name: "burnable", color: "#ff0000", description: "燃えるゴミ", items: ["paper", "plastic"] }` | パース成功、items が string[] | 単体 | Must |
| TC-015 | 正常系: AccountSchema が type union をパースする | `{ id: "a1", homeId: "h1", userId: "u1", name: "メイン口座", type: "bank", initialBalance: 100000, createdAt: "2026-01-01T00:00:00Z" }` | パース成功 | 単体 | Must |
| TC-016 | 異常系: AccountSchema が不正な type を拒否する | `{ ...validAccount, type: "bitcoin" }` | ZodError がスローされる | 単体 | Must |
| TC-017 | 正常系: BackgroundJobSchema が status union をパースする | `{ id: "j1", type: "ocr", status: "completed", createdAt: "2026-03-16T00:00:00Z" }` | パース成功 | 単体 | Must |
| TC-018 | 異常系: BackgroundJobSchema が不正な status を拒否する | `{ id: "j1", type: "ocr", status: "unknown_status", createdAt: "2026-03-16T00:00:00Z" }` | ZodError がスローされる | 単体 | Must |
| TC-019 | 正常系: CalendarEventSchema が全フィールドをパースする | `{ id: "c1", homeId: "h1", title: "Meeting", date: "2026-03-20", allDay: false, type: "event" }` | パース成功、オプショナルフィールドは undefined | 単体 | Must |
| TC-020 | 正常系: EmploymentSchema が part_time/full_time type をパースする | `{ id: "e1", userId: "u1", homeId: "h1", name: "Cafe", type: "part_time", createdAt: "2026-01-01T00:00:00Z" }` | パース成功 | 単体 | Must |
| TC-021 | 正常系: SalaryPredictionSchema がネストした shiftDetails をパースする | `{ employmentId: "e1", employmentName: "Cafe", yearMonth: "2026-03", totalShifts: 10, totalWorkMinutes: 4800, basePay: 48000, ..., shiftDetails: [{ shiftId: "s1", date: "2026-03-01", workMinutes: 480, normalMinutes: 480, overtimeMinutes: 0, nightMinutes: 0, isHoliday: false, pay: 4800 }] }` | パース成功、shiftDetails が配列 | 単体 | Must |
| TC-022 | 正常系: UserSchema (auth) が home メンバーを含むレスポンスをパースする | `{ id: "u1", email: "test@example.com", name: "Test User", home: { id: "h1", name: "MyHome", members: [{ id: "u1", name: "Test", email: "test@example.com", role: "admin" }] } }` | パース成功 | 単体 | Must |
| TC-023 | 正常系: MonthlyBudgetSchema をパースする | `{ id: "mb1", homeId: "h1", category: "food", amount: 50000, yearMonth: "2026-03" }` | パース成功 | 単体 | Must |
| TC-024 | 正常系: DocumentSchema をパースする | `{ id: "d1", homeId: "h1", title: "保険証", category: "insurance", fileUrl: "/files/d1.pdf", fileType: "pdf", uploadedAt: "2026-01-01T00:00:00Z", tags: ["insurance", "important"] }` | パース成功 | 単体 | Must |
| TC-025 | 正常系: SavingsGoalWithProgressSchema をパースする | `{ id: "sg1", homeId: "h1", name: "旅行", targetAmount: 300000, currentAmount: 100000, createdAt: "2026-01-01T00:00:00Z", progressRate: 33.3 }` | パース成功 | 単体 | Must |
| TC-026 | 正常系: GoogleCalendarStatusSchema をパースする | `{ connected: true, connectedAt: "2026-02-01T00:00:00Z" }` | パース成功 | 単体 | Must |
| TC-027 | 正常系: NotificationPreferencesSchema をパースする | 適切な通知設定 JSON | パース成功 | 単体 | Should |

### ACC-17-004: TypeScript 型との統合

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-028 | 正常系: z.infer<typeof BudgetEntrySchema> が BudgetEntry と型互換 | 型レベルテスト | コンパイルエラーなし | 単体 | Must |

### ACC-17-005: キャッシュによる即時表示（useBudget）

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-029 | 正常系: useBudget が初回ロードでエントリー一覧を取得する | MSW: GET /api/v1/budget/entries -> `[{ id: "b1", ... }]` | `{ entries: [{ id: "b1" }], loading: false }` | 統合 | Must |
| TC-030 | 正常系: useBudget が summary を取得して monthlyTotal を返す | MSW: GET /api/v1/budget/summary -> `{ monthlyTotal: 50000, byPerson: {}, byCategory: {} }` | `{ monthlyTotal: 50000 }` | 統合 | Must |
| TC-031 | 正常系: キャッシュが存在する場合ネットワークリクエストなしで即時データを返す | 1回目取得後に再度 renderHook | `isLoading: false` が即座に返る、追加の fetch なし | 統合 | Must |

### ACC-17-006: ローディング状態

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-032 | 正常系: 初回ロード時に loading が true になる | MSW: 遅延レスポンス (200ms) | 初期状態で `loading: true`、レスポンス後に `loading: false` | 統合 | Must |

### ACC-17-007: パラメータ付きクエリ

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-033 | 正常系: useBudget("2026-03") が yearMonth パラメータ付きで API を呼ぶ | MSW: GET /api/v1/budget/entries?year_month=2026-03 | クエリパラメータ付きでリクエスト送信 | 統合 | Must |
| TC-034 | 正常系: 異なる yearMonth は別キャッシュとして管理される | "2026-03" → "2026-04" → "2026-03" に戻す | 3回目でキャッシュから即時返却、リクエスト数が3ではなく2 | 統合 | Must |
| TC-035 | 境界値: yearMonth を undefined にすると全期間のデータを取得する | useBudget(undefined) | GET /api/v1/budget/entries（パラメータなし） | 統合 | Should |

### ACC-17-008: Mutation 成功時のキャッシュ更新

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-036 | 正常系: addEntry 成功で budget.entries キャッシュが invalidate される | MSW: POST /api/v1/budget/entries -> 201, GET refetch | entries が再取得される | 統合 | Must |
| TC-037 | 正常系: addEntry 成功で budget.summary キャッシュも invalidate される | MSW: POST -> 201, 続くリフェッチ確認 | summary も再取得される | 統合 | Must |
| TC-038 | 正常系: updateEntry 成功でキャッシュが invalidate される | MSW: PUT /api/v1/budget/entries/b1 -> 200 | entries + summary が再取得される | 統合 | Must |
| TC-039 | 正常系: deleteEntry 成功でキャッシュが invalidate される | MSW: DELETE /api/v1/budget/entries/b1 -> 204 | entries + summary が再取得される | 統合 | Must |

### ACC-17-009: Mutation エラーハンドリング

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-040 | 異常系: addEntry 失敗時に error 状態が設定される | MSW: POST /api/v1/budget/entries -> 500 | mutation の `isError: true`, `error` が ApiError | 統合 | Must |
| TC-041 | 異常系: 400 Bad Request 時にエラーが伝播する | MSW: POST -> 400 "Validation failed" | `error.message` に "Validation failed" を含む | 統合 | Must |

### ACC-17-010: ポーリングベースのジョブ監視

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-042 | 正常系: ジョブ開始後 3 秒間隔でポーリングする | MSW: GET /api/v1/jobs/j1 -> `{ status: "processing" }` | 3秒間隔でリクエストが発生する | 統合 | Should |
| TC-043 | 正常系: ジョブ完了時にポーリングが停止する | MSW: 1回目 `{ status: "processing" }`, 2回目 `{ status: "completed" }` | 2回目以降ポーリングが停止する | 統合 | Should |
| TC-044 | 正常系: ジョブ失敗時にポーリングが停止する | MSW: `{ status: "failed", error: "OCR failed" }` | ポーリングが停止し、エラー情報が取得できる | 統合 | Should |

### ACC-17-011: 機能互換（各フック）

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-045 | 正常系: useSubscriptions がリスト取得 + monthlyTotal 計算を返す | MSW: GET /api/v1/subscriptions -> `[{ amount: 1490, ... }, { amount: 980, ... }]` | `{ subscriptions: [...], monthlyTotal: 2470, loading: false }` | 統合 | Must |
| TC-046 | 正常系: useGarbage がカテゴリとスケジュールを取得する | MSW: GET /api/v1/garbage/categories, /schedules | `{ categories: [...], schedules: [...], loading: false }` | 統合 | Must |
| TC-047 | 正常系: useCalendar がイベントを取得する | MSW: GET /api/v1/calendar/events | `{ events: [...], loading: false }` | 統合 | Must |
| TC-048 | 正常系: useAccounts が口座一覧を取得する | MSW: GET /api/v1/accounts | `{ accounts: [...], loading: false }` | 統合 | Must |
| TC-049 | 正常系: useMonthlyBudgets が月次予算を取得する | MSW: GET /api/v1/budgets/monthly | `{ budgets: [...], loading: false }` | 統合 | Must |
| TC-050 | 正常系: useSavings が貯蓄目標を取得する | MSW: GET /api/v1/savings | `{ goals: [...], loading: false }` | 統合 | Must |
| TC-051 | 正常系: useEmployments が雇用一覧を取得する | MSW: GET /api/v1/employments | `{ employments: [...], loading: false }` | 統合 | Must |
| TC-052 | 正常系: useShifts がシフト一覧を取得する | MSW: GET /api/v1/shifts | `{ shifts: [...], loading: false }` | 統合 | Must |
| TC-053 | 正常系: useSalary が給与記録を取得する | MSW: GET /api/v1/salary/records | `{ records: [...], loading: false }` | 統合 | Must |
| TC-054 | 正常系: useDocuments がドキュメント一覧を取得する | MSW: GET /api/v1/documents | `{ documents: [...], loading: false }` | 統合 | Must |
| TC-055 | 正常系: useNotificationSettings が通知設定を取得する | MSW: GET /api/v1/push/preferences | `{ preferences: {...}, loading: false }` | 統合 | Must |
| TC-056 | 正常系: useGoogleCalendar が連携状態を取得する | MSW: GET /api/v1/calendar/google/status | `{ status: { connected: true }, loading: false }` | 統合 | Must |

### ACC-17-012: 認証フローの維持

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-057 | 正常系: useAuth が /api/v1/auth/me からユーザー情報を取得する | MSW: GET /api/v1/auth/me -> `{ id: "u1", email: "test@example.com", name: "Test User" }` | `{ user: { id: "u1" }, loading: false }` | 統合 | Must |
| TC-058 | 正常系: login が Google OAuth リダイレクトを行う | login() 呼び出し | `window.location.href` が `/api/v1/auth/google` に設定される | 統合 | Must |
| TC-059 | 正常系: logout が全キャッシュをクリアする | logout() 呼び出し | `queryClient.getQueryCache().getAll().length === 0` | 統合 | Must |
| TC-060 | 異常系: auth/me が 401 の場合 user が null になる | MSW: GET /api/v1/auth/me -> 401 | `{ user: null, loading: false }` | 統合 | Must |

---

## api.ts 拡張テストケース

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-061 | 正常系: getWithSchema がレスポンスを Zod でパースして返す | MSW: GET /test -> `{ id: "1", name: "test" }`, schema: `z.object({ id: z.string(), name: z.string() })` | パースされたオブジェクト `{ id: "1", name: "test" }` | 統合 | Must |
| TC-062 | 異常系: getWithSchema で Zod パースエラー時に ZodError をスロー | MSW: GET /test -> `{ id: 123 }` (number), schema expects string | ZodError がスローされる | 統合 | Must |
| TC-063 | 正常系: postWithSchema がレスポンスを Zod でパースして返す | MSW: POST /test -> `{ id: "1" }` | パースされたオブジェクト | 統合 | Must |
| TC-064 | 正常系: putWithSchema がレスポンスを Zod でパースして返す | MSW: PUT /test -> `{ id: "1" }` | パースされたオブジェクト | 統合 | Must |

---

## QueryKey テストケース

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-065 | 正常系: queryKeys.budget.entries() が正しいキー配列を返す | `queryKeys.budget.entries()` | `["budget", "entries", "current"]` | 単体 | Must |
| TC-066 | 正常系: queryKeys.budget.entries("2026-03") がパラメータ付きキーを返す | `queryKeys.budget.entries("2026-03")` | `["budget", "entries", "2026-03"]` | 単体 | Must |
| TC-067 | 正常系: queryKeys.budget.all が上位キーを返す | `queryKeys.budget.all` | `["budget"]` | 単体 | Must |
| TC-068 | 正常系: queryKeys.jobs.detail("j1") がジョブIDを含むキーを返す | `queryKeys.jobs.detail("j1")` | `["jobs", "j1"]` | 単体 | Must |
| TC-069 | 正常系: queryKeys.accounts.transactions("a1", "2026-03") がパラメータ付きキーを返す | `queryKeys.accounts.transactions("a1", "2026-03")` | `["accounts", "transactions", "a1", "2026-03"]` | 単体 | Must |
| TC-070 | 正常系: queryKeys.employment.shifts() がデフォルトパラメータのキーを返す | `queryKeys.employment.shifts()` | `["employment", "shifts", "all", "all"]` | 単体 | Must |

---

## パフォーマンス・最適化テスト（arch-check 連動）

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-071 | 正常系: staleTime 内の同一キーでネットワークリクエストが発生しない | useBudget() を2回連続レンダリング (staleTime 内) | MSW ハンドラへのリクエストが1回のみ | 統合 | Must |
| TC-072 | 正常系: バンドルサイズが50KB未満の増加に収まる | `pnpm build` 後のサイズ比較 | 追加サイズ < 50KB (gzip) | 手動検証 | Should |
| TC-073 | 正常系: ZodError がリトライされない | MSW: 正しい HTTP 200 + 不正な JSON 構造 | リクエスト回数が1回（リトライなし） | 統合 | Should |

---

## 境界値テスト

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-074 | 境界値: 空配列レスポンスの処理 | MSW: GET /api/v1/budget/entries -> `[]` | `{ entries: [], loading: false }` | 統合 | Should |
| TC-075 | 境界値: amount が 0 のエントリーをパースできる | `{ ..., amount: 0 }` | パース成功 | 単体 | Should |
| TC-076 | 境界値: amount が負数のエントリーをパースできる | `{ ..., amount: -1500 }` | パース成功（Zod は number 型で負数を許容） | 単体 | Should |
| TC-077 | 境界値: 空文字列のフィールド | `{ ..., description: "" }` | パース成功 | 単体 | Should |
| TC-078 | 境界値: items が空配列 | `{ ..., items: [] }` (GarbageCategory) | パース成功 | 単体 | Should |
| TC-079 | 境界値: byPerson / byCategory が空オブジェクト | `{ monthlyTotal: 0, byPerson: {}, byCategory: {} }` | パース成功 | 単体 | Should |
| TC-080 | 境界値: very large amount | `{ ..., amount: 99999999 }` | パース成功 | 単体 | Should |
| TC-081 | 境界値: shiftDetails が空配列の SalaryPrediction | `{ ..., shiftDetails: [] }` | パース成功 | 単体 | Should |
| TC-082 | 境界値: Subscription の billingCycle 各値 | `"monthly"`, `"yearly"`, `"weekly"` | 全てパース成功 | 単体 | Should |
| TC-083 | 境界値: Account の type 各値 | `"bank"`, `"credit_card"`, `"cash"`, `"e_money"` | 全てパース成功 | 単体 | Should |
| TC-084 | 境界値: BackgroundJob の status 各値 | `"pending"`, `"processing"`, `"completed"`, `"failed"` | 全てパース成功 | 単体 | Should |
| TC-085 | 境界値: Employment の type 各値 | `"part_time"`, `"full_time"` | 全てパース成功 | 単体 | Should |
| TC-086 | 境界値: AccountTransaction の type 各値 | `"income"`, `"expense"`, `"transfer"` | 全てパース成功 | 単体 | Should |

---

## Mutation 系各フックテスト

| ID | テストケース | 入力 | 期待値 | 種別 | 優先度 |
|----|-------------|------|--------|------|--------|
| TC-087 | 正常系: useSubscriptions の add mutation がキャッシュを invalidate する | MSW: POST /api/v1/subscriptions -> 201 | subscriptions キャッシュが再取得される | 統合 | Must |
| TC-088 | 正常系: useSubscriptions の delete mutation がキャッシュを invalidate する | MSW: DELETE /api/v1/subscriptions/s1 -> 204 | subscriptions キャッシュが再取得される | 統合 | Must |
| TC-089 | 正常系: useGarbage の add category がキャッシュを invalidate する | MSW: POST /api/v1/garbage/categories -> 201 | garbage.categories キャッシュが再取得される | 統合 | Must |
| TC-090 | 正常系: useCalendar の add event がキャッシュを invalidate する | MSW: POST /api/v1/calendar/events -> 201 | calendar.events キャッシュが再取得される | 統合 | Must |
| TC-091 | 正常系: useCalendar の toggleTask がキャッシュを invalidate する | MSW: PATCH /api/v1/calendar/events/c1/toggle -> 200 | calendar.events キャッシュが再取得される | 統合 | Must |
| TC-092 | 正常系: useAccounts の add account がキャッシュを invalidate する | MSW: POST /api/v1/accounts -> 201 | accounts キャッシュが再取得される | 統合 | Must |
| TC-093 | 正常系: useSavings の add goal がキャッシュを invalidate する | MSW: POST /api/v1/savings -> 201 | savings キャッシュが再取得される | 統合 | Must |
| TC-094 | 正常系: useDocuments の add document がキャッシュを invalidate する | MSW: POST /api/v1/documents -> 201 | documents キャッシュが再取得される | 統合 | Must |
| TC-095 | 正常系: useNotificationSettings の update がキャッシュを invalidate する | MSW: PUT /api/v1/push/preferences -> 200 | notifications キャッシュが再取得される | 統合 | Must |

---

## 分岐網羅

| 分岐点 | 条件 | True パス | False パス | テストケース |
|--------|------|-----------|------------|-------------|
| queryClient.retry | `error.status in [401, 403, 404]` | リトライしない (false) | リトライする (true, max 2) | TC-003, TC-004 |
| api.getWithSchema | `schema.parse(raw)` 成功 | パース済みデータを返す | ZodError をスロー | TC-061, TC-062 |
| useBudget queryFn | `yearMonth` が undefined | パラメータなしで GET | `?year_month=` 付きで GET | TC-033, TC-035 |
| queryKeys.budget.entries | `yearMonth` が undefined | `"current"` をキーに含める | yearMonth 値をキーに含める | TC-065, TC-066 |
| BackgroundJob refetchInterval | `status === "completed" or "failed"` | `false` (停止) | `3000` (継続) | TC-042, TC-043, TC-044 |
| useAuth retry | `error.status === 401` | リトライしない | リトライする | TC-057, TC-060 |
| logout | 呼び出し時 | queryClient.clear() で全キャッシュクリア | - | TC-059 |
| request (api.ts) | `res.status === 401 && !path.includes('/auth/')` | tryRefresh() → リトライ | エラーをスロー | TC-060 |
| request (api.ts) | `res.status === 204 or content-length === '0'` | undefined を返す | res.json() を返す | TC-039 (DELETE 204) |
| DevTools 表示 | `import.meta.env.DEV === true` | ReactQueryDevtools をレンダリング | レンダリングしない | TC-007 |

---

## テストファイル構成

| ファイル | テスト対象 | テストケース |
|----------|-----------|-------------|
| `src/lib/__tests__/queryClient.test.ts` | `src/lib/queryClient.ts` | TC-001 ~ TC-006 |
| `src/lib/__tests__/queryKeys.test.ts` | `src/lib/queryKeys.ts` | TC-065 ~ TC-070 |
| `src/lib/schemas/__tests__/budget.test.ts` | `src/lib/schemas/budget.ts` | TC-008 ~ TC-012, TC-075 ~ TC-077, TC-079, TC-080 |
| `src/lib/schemas/__tests__/subscriptions.test.ts` | `src/lib/schemas/subscriptions.ts` | TC-013, TC-082 |
| `src/lib/schemas/__tests__/garbage.test.ts` | `src/lib/schemas/garbage.ts` | TC-014, TC-078 |
| `src/lib/schemas/__tests__/accounts.test.ts` | `src/lib/schemas/accounts.ts` | TC-015, TC-016, TC-083 |
| `src/lib/schemas/__tests__/calendar.test.ts` | `src/lib/schemas/calendar.ts` | TC-019 |
| `src/lib/schemas/__tests__/employment.test.ts` | `src/lib/schemas/employment.ts` | TC-020, TC-021, TC-081, TC-085 |
| `src/lib/schemas/__tests__/auth.test.ts` | `src/lib/schemas/auth.ts` | TC-022 |
| `src/lib/schemas/__tests__/jobs.test.ts` | `src/lib/schemas/jobs.ts` | TC-017, TC-018, TC-084 |
| `src/lib/schemas/__tests__/monthly-budgets.test.ts` | `src/lib/schemas/monthly-budgets.ts` | TC-023 |
| `src/lib/schemas/__tests__/documents.test.ts` | `src/lib/schemas/documents.ts` | TC-024 |
| `src/lib/schemas/__tests__/savings.test.ts` | `src/lib/schemas/savings.ts` | TC-025 |
| `src/lib/schemas/__tests__/google-calendar.test.ts` | `src/lib/schemas/google-calendar.ts` | TC-026 |
| `src/lib/schemas/__tests__/notifications.test.ts` | `src/lib/schemas/notifications.ts` | TC-027 |
| `src/utils/__tests__/api.test.ts` | `src/utils/api.ts` (getWithSchema 等) | TC-061 ~ TC-064 |
| `src/features/budget/__tests__/useBudget.test.ts` | `src/features/budget/useBudget.ts` | TC-029 ~ TC-041, TC-071, TC-074 |
| `src/features/budget/__tests__/useSubscriptions.test.ts` | `src/features/budget/useSubscriptions.ts` | TC-045, TC-087, TC-088 |
| `src/features/garbage/__tests__/useGarbage.test.ts` | `src/features/garbage/useGarbage.ts` | TC-046, TC-089 |
| `src/features/calendar/__tests__/useCalendar.test.ts` | `src/features/calendar/useCalendar.ts` | TC-047, TC-090, TC-091 |
| `src/features/calendar/google/__tests__/useGoogleCalendar.test.ts` | `src/features/calendar/google/useGoogleCalendar.ts` | TC-056 |
| `src/features/auth/__tests__/useAuth.test.ts` | `src/features/auth/useAuth.ts` | TC-057 ~ TC-060 |
| `src/features/accounts/__tests__/useAccounts.test.ts` | `src/features/accounts/useAccounts.ts` | TC-048, TC-092 |
| `src/features/monthly-budgets/__tests__/useMonthlyBudgets.test.ts` | `src/features/monthly-budgets/useMonthlyBudgets.ts` | TC-049 |
| `src/features/savings/__tests__/useSavings.test.ts` | `src/features/savings/useSavings.ts` | TC-050, TC-093 |
| `src/features/employment/__tests__/useEmployment.test.ts` | `src/features/employment/useEmployment.ts` | TC-051 ~ TC-053 |
| `src/features/documents/__tests__/useDocuments.test.ts` | `src/features/documents/useDocuments.ts` | TC-054, TC-094 |
| `src/features/settings/__tests__/useNotificationSettings.test.ts` | `src/features/settings/useNotificationSettings.ts` | TC-055, TC-095 |
| `src/hooks/__tests__/BackgroundJobsProvider.test.ts` | `src/hooks/BackgroundJobsProvider.tsx` | TC-042 ~ TC-044 |
| `src/__tests__/App.test.tsx` | `src/App.tsx` (Provider 統合) | TC-007 |

---

## arch-check 指摘対応

| arch-check 指摘 | 対応テストケース | 説明 |
|-----------------|----------------|------|
| ACT-01: Zod 未インストール | TC-008 ~ TC-027 (全スキーマテスト) | Zod がインストールされていないとテスト自体が実行不可。テスト実行 = 確認 |
| ACT-02: login パターンの OAuth 修正 | TC-058 | login が Google OAuth リダイレクトで動作することを検証 |
| NFR-PERF-001: キャッシュヒット時にネットワークリクエストなし | TC-031, TC-071 | staleTime 内でネットワークリクエストが発生しないことを検証 |
| NFR-PERF-002: バンドルサイズ 50KB 未満増加 | TC-072 | 手動検証 (build 後サイズ比較) |
| リスク: Zod パースエラーでリトライ | TC-073 | ZodError はリトライされないことを検証 |
| リスク: 移行後のエラー表示変化 | TC-040, TC-041 | エラーが握りつぶされず isError で伝播することを検証 |

---

## 修正履歴

<!-- 実装フェーズでテスト仕様を修正した場合のみ記録 -->

| 日付 | テストケース | 修正内容 | 理由 |
|------|-------------|---------|------|
| - | - | - | - |

---

## 更新履歴 / History

| 日付 | 内容 |
|:---|:---|
| 2026-03-16 | 初版作成 |
