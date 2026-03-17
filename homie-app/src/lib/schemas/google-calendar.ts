import { z } from 'zod';

export const GoogleCalendarStatusSchema = z.object({
  connected: z.boolean(),
  connectedAt: z.string().optional(),
});

export const SyncResultSchema = z.object({
  imported: z.number(),
  updated: z.number(),
  deleted: z.number(),
  pushed: z.number(),
});

export const GoogleCalendarInfoSchema = z.object({
  id: z.string(),
  summary: z.string(),
  selected: z.boolean(),
  backgroundColor: z.string().optional(),
  accessRole: z.string(),
  primary: z.boolean(),
});

export const GoogleCalendarInfoListSchema = z.array(GoogleCalendarInfoSchema);

export type GoogleCalendarStatus = z.infer<typeof GoogleCalendarStatusSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
export type GoogleCalendarInfo = z.infer<typeof GoogleCalendarInfoSchema>;
