import { z } from 'zod';

export const SavingsGoalSchema = z.object({
  id: z.string(),
  homeId: z.string(),
  name: z.string(),
  targetAmount: z.number(),
  currentAmount: z.number(),
  targetDate: z.string().optional(),
  accountId: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
});

export const SavingsGoalListSchema = z.array(SavingsGoalSchema);

export const SavingsGoalWithProgressSchema = SavingsGoalSchema.extend({
  progressRate: z.number(),
  monthlyRequired: z.number().optional(),
});

export const SavingsGoalWithProgressListSchema = z.array(SavingsGoalWithProgressSchema);

export type SavingsGoal = z.infer<typeof SavingsGoalSchema>;
export type SavingsGoalWithProgress = z.infer<typeof SavingsGoalWithProgressSchema>;
