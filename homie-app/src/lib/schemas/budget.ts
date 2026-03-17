import { z } from 'zod';

export const BudgetEntrySchema = z.object({
  id: z.string(),
  homeId: z.string(),
  date: z.string(),
  amount: z.number(),
  category: z.string(),
  description: z.string(),
  paidBy: z.string(),
  receiptImageUrl: z.string().optional(),
  accountId: z.string().optional(),
});

export const BudgetEntryListSchema = z.array(BudgetEntrySchema);

export const BudgetSummarySchema = z.object({
  monthlyTotal: z.number(),
  byPerson: z.record(z.string(), z.number()),
  byCategory: z.record(z.string(), z.number()),
});

export type BudgetEntry = z.infer<typeof BudgetEntrySchema>;
export type BudgetSummary = z.infer<typeof BudgetSummarySchema>;
