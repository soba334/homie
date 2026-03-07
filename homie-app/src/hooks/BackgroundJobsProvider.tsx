import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import { useToast } from '@/components/ui';
import { BackgroundJobsContext } from './backgroundJobsContext';
import type { CompletedJob } from './backgroundJobsContext';
import type { BackgroundJob } from '@/types';

export function BackgroundJobsProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [activeJobs, setActiveJobs] = useState<Map<string, string>>(new Map()); // jobId -> jobType
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);

  const addJob = useCallback((jobId: string, jobType: string) => {
    setActiveJobs((prev) => {
      const next = new Map(prev);
      next.set(jobId, jobType);
      return next;
    });
  }, []);

  const consumeJob = useCallback((jobId: string) => {
    let found: CompletedJob | undefined;
    setCompletedJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === jobId);
      if (idx >= 0) {
        found = prev[idx];
        return prev.filter((_, i) => i !== idx);
      }
      return prev;
    });
    return found;
  }, []);

  useEffect(() => {
    if (activeJobs.size === 0) return;

    const interval = setInterval(async () => {
      const entries = Array.from(activeJobs.entries());
      for (const [jobId, jobType] of entries) {
        try {
          const job = await api.get<BackgroundJob>(`/api/v1/jobs/${jobId}`);
          if (job.status === 'completed') {
            setActiveJobs((prev) => {
              const next = new Map(prev);
              next.delete(jobId);
              return next;
            });
            setCompletedJobs((prev) => [
              ...prev,
              { id: jobId, jobType, result: job.result ?? undefined, status: 'completed' },
            ]);
            toast('読み取り完了');
          } else if (job.status === 'failed') {
            setActiveJobs((prev) => {
              const next = new Map(prev);
              next.delete(jobId);
              return next;
            });
            setCompletedJobs((prev) => [
              ...prev,
              { id: jobId, jobType, error: job.error ?? undefined, status: 'failed' },
            ]);
            toast(job.error || '処理に失敗しました', 'error');
          }
        } catch {
          // ignore polling errors
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [activeJobs, toast]);

  const activeJobIds = Array.from(activeJobs.keys());

  return (
    <BackgroundJobsContext.Provider value={{ addJob, activeJobIds, completedJobs, consumeJob }}>
      {children}
    </BackgroundJobsContext.Provider>
  );
}
