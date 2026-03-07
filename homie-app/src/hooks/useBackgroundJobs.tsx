import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/utils/api';
import { useToast } from '@/components/ui';
import type { BackgroundJob } from '@/types';

interface JobCallbacks {
  onComplete?: (result: string) => void;
  onFail?: (error: string) => void;
}

interface BackgroundJobsContextValue {
  addJob: (jobId: string, callbacks?: JobCallbacks) => void;
  activeJobIds: string[];
}

const BackgroundJobsContext = createContext<BackgroundJobsContextValue | null>(null);

export function BackgroundJobsProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Map<string, JobCallbacks>>(new Map());
  const callbacksRef = useRef<Map<string, JobCallbacks>>(new Map());

  // Keep ref in sync with state
  callbacksRef.current = jobs;

  const addJob = useCallback((jobId: string, callbacks?: JobCallbacks) => {
    setJobs((prev) => {
      const next = new Map(prev);
      next.set(jobId, callbacks || {});
      return next;
    });
  }, []);

  useEffect(() => {
    if (jobs.size === 0) return;

    const interval = setInterval(async () => {
      const entries = Array.from(callbacksRef.current.entries());
      for (const [jobId, callbacks] of entries) {
        try {
          const job = await api.get<BackgroundJob>(`/api/v1/jobs/${jobId}`);
          if (job.status === 'completed') {
            setJobs((prev) => {
              const next = new Map(prev);
              next.delete(jobId);
              return next;
            });
            if (job.result && callbacks.onComplete) {
              callbacks.onComplete(job.result);
            } else {
              toast('バックグラウンド処理が完了しました');
            }
          } else if (job.status === 'failed') {
            setJobs((prev) => {
              const next = new Map(prev);
              next.delete(jobId);
              return next;
            });
            if (callbacks.onFail) {
              callbacks.onFail(job.error || '処理に失敗しました');
            } else {
              toast(job.error || '処理に失敗しました', 'error');
            }
          }
        } catch {
          // ignore polling errors
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [jobs.size, toast]);

  const activeJobIds = Array.from(jobs.keys());

  return (
    <BackgroundJobsContext.Provider value={{ addJob, activeJobIds }}>
      {children}
    </BackgroundJobsContext.Provider>
  );
}

export function useBackgroundJobs() {
  const ctx = useContext(BackgroundJobsContext);
  if (!ctx) throw new Error('useBackgroundJobs must be used within BackgroundJobsProvider');
  return ctx;
}
