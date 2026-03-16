import { z } from 'zod';

export const MonthlyBudgetSchema = z.object({
  id: z.string(),
  homeId: z.string(),
  category: z.string(),
  amount: z.number(),
  yearMonth: z.string(),
});

export const MonthlyBudgetListSchema = z.array(MonthlyBudgetSchema);

export const BudgetVsActualSchema = z.object({
  category: z.string(),
  budgetAmount: z.number(),
  actualAmount: z.number(),
  remaining: z.number(),
  usageRate: z.number(),
  overBudget: z.boolean(),
});

export const BudgetVsActualListSchema = z.array(BudgetVsActualSchema);

export type MonthlyBudget = z.infer<typeof MonthlyBudgetSchema>;
export type BudgetVsActual = z.infer<typeof BudgetVsActualSchema>;
