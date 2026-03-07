import { createContext } from 'react';

export interface CompletedJob {
  id: string;
  jobType: string;
  result?: string;
  error?: string;
  status: 'completed' | 'failed';
}

export interface BackgroundJobsContextValue {
  addJob: (jobId: string, jobType: string) => void;
  activeJobIds: string[];
  completedJobs: CompletedJob[];
  consumeJob: (jobId: string) => CompletedJob | undefined;
}

export const BackgroundJobsContext = createContext<BackgroundJobsContextValue | null>(null);
