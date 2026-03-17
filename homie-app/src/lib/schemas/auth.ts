import { z } from 'zod';

export const HomeMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  email: z.string(),
  avatarUrl: z.string().optional(),
  role: z.string(),
});

export const HomeMemberListSchema = z.array(HomeMemberSchema);

export const HomeSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(HomeMemberSchema),
});

export const MeResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  home: HomeSchema.optional(),
});

export type HomeMember = z.infer<typeof HomeMemberSchema>;
export type Home = z.infer<typeof HomeSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
