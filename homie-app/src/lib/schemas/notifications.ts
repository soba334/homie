import { z } from 'zod';

export const NotificationPreferencesSchema = z.object({
  userId: z.string(),
  garbageEnabled: z.boolean(),
  garbageTiming: z.enum(['eve', 'day', 'both']),
  subscriptionEnabled: z.boolean(),
  subscriptionDaysBefore: z.number(),
  updatedAt: z.string(),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
