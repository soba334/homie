import { z } from 'zod';

export const AccountSchema = z.object({
  id: z.string(),
  homeId: z.string(),
  userId: z.string(),
  name: z.string(),
  type: z.enum(['bank', 'credit_card', 'cash', 'e_money']),
  initialBalance: z.number(),
  color: z.string().optional(),
  billingDate: z.number().optional(),
  paymentDate: z.number().optional(),
  paymentAccountId: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
});

export const AccountListSchema = z.array(AccountSchema);

export const AccountWithBalanceSchema = AccountSchema.extend({
  balance: z.number(),
});

export const AccountWithBalanceListSchema = z.array(AccountWithBalanceSchema);

export const AccountTransactionSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  homeId: z.string(),
  amount: z.number(),
  type: z.enum(['income', 'expense', 'transfer']),
  category: z.string().optional(),
  description: z.string(),
  date: z.string(),
  transferToAccountId: z.string().optional(),
  budgetEntryId: z.string().optional(),
  salaryRecordId: z.string().optional(),
  createdAt: z.string(),
});

export const AccountTransactionListSchema = z.array(AccountTransactionSchema);

export const AccountsSummarySchema = z.object({
  totalBalance: z.number(),
  accounts: z.array(AccountWithBalanceSchema),
});

export type Account = z.infer<typeof AccountSchema>;
export type AccountWithBalance = z.infer<typeof AccountWithBalanceSchema>;
export type AccountTransaction = z.infer<typeof AccountTransactionSchema>;
export type AccountsSummary = z.infer<typeof AccountsSummarySchema>;
