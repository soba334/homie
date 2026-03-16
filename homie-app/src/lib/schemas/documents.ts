import { z } from 'zod';

export const DocumentSchema = z.object({
  id: z.string(),
  homeId: z.string(),
  title: z.string(),
  category: z.string(),
  fileUrl: z.string(),
  fileType: z.string(),
  uploadedAt: z.string(),
  tags: z.array(z.string()),
  note: z.string().optional(),
});

export const DocumentListSchema = z.array(DocumentSchema);

export type Document = z.infer<typeof DocumentSchema>;
