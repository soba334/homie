import { z } from 'zod';

export const GarbageCategorySchema = z.object({
  id: z.string(),
  homeId: z.string(),
  name: z.string(),
  color: z.string(),
  description: z.string(),
  items: z.array(z.string()),
});

export const GarbageCategoryListSchema = z.array(GarbageCategorySchema);

export const GarbageScheduleSchema = z.object({
  id: z.string(),
  homeId: z.string(),
  categoryId: z.string(),
  dayOfWeek: z.array(z.number()),
  weekOfMonth: z.array(z.number()).optional(),
  location: z.string().optional(),
  note: z.string().optional(),
});

export const GarbageScheduleListSchema = z.array(GarbageScheduleSchema);

export type GarbageCategory = z.infer<typeof GarbageCategorySchema>;
export type GarbageSchedule = z.infer<typeof GarbageScheduleSchema>;
