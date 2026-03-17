import { z } from 'zod';

export const SubscriptionSchema = z.object({
  id: z.string(),
  homeId: z.string(),
  name: z.string(),
  amount: z.number(),
  category: z.string(),
  paidBy: z.string(),
  accountId: z.string().optional(),
  billingCycle: z.enum(['monthly', 'yearly', 'weekly']),
  billingDay: z.number(),
  nextBillingDate: z.string(),
  isActive: z.boolean(),
  note: z.string().optional(),
  googleEventId: z.string().optional(),
  syncToCalendar: z.boolean(),
  createdAt: z.string(),
});

export const SubscriptionListSchema = z.array(SubscriptionSchema);

export type Subscription = z.infer<typeof SubscriptionSchema>;
