import { z } from 'zod';

export const BackgroundJobSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  input: z.string().optional(),
  result: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

export const BackgroundJobListSchema = z.array(BackgroundJobSchema);

export type BackgroundJob = z.infer<typeof BackgroundJobSchema>;
