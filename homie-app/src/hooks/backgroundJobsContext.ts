import { createContext } from 'react';

interface JobCallbacks {
  onComplete?: (result: string) => void;
  onFail?: (error: string) => void;
}

export type { JobCallbacks };

export interface BackgroundJobsContextValue {
  addJob: (jobId: string, callbacks?: JobCallbacks) => void;
  activeJobIds: string[];
}

export const BackgroundJobsContext = createContext<BackgroundJobsContextValue | null>(null);
