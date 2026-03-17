import { z } from 'zod';

export const CalendarEventSchema = z.object({
  id: z.string(),
  homeId: z.string(),
  title: z.string(),
  date: z.string(),
  endDate: z.string().optional(),
  allDay: z.boolean(),
  type: z.string(),
  assignee: z.string().optional(),
  completed: z.boolean().optional(),
  color: z.string().optional(),
  description: z.string().optional(),
  googleEventId: z.string().optional(),
  recurrenceRule: z.string().optional(),
  recurrenceInterval: z.number().optional(),
  recurrenceEnd: z.string().optional(),
  isRecurrenceInstance: z.boolean().optional(),
  originalEventId: z.string().optional(),
  occurrenceDate: z.string().optional(),
  garbageScheduleId: z.string().optional(),
  googleCalendarId: z.string().optional(),
  createdBy: z.string().optional(),
});

export const CalendarEventListSchema = z.array(CalendarEventSchema);

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
