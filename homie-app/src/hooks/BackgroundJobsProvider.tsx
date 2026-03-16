import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/utils/api';
import { useToast } from '@/components/ui';
import { BackgroundJobsContext } from './backgroundJobsContext';
import type { CompletedJob } from './backgroundJobsContext';
import { BackgroundJobSchema } from '@/lib/schemas';
import { queryKeys } from '@/lib/queryKeys';

function JobPoller({
  jobId,
  jobType,
  onComplete,
  onError,
}: {
  jobId: string;
  jobType: string;
  onComplete: (jobId: string, jobType: string, result?: string) => void;
  onError: (jobId: string, jobType: string, error?: string) => void;
}) {
  const { data } = useQuery({
    queryKey: queryKeys.jobs.detail(jobId),
    queryFn: () => api.getWithSchema(`/api/v1/jobs/${jobId}`, BackgroundJobSchema),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 3000;
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (data?.status === 'completed') {
      onComplete(jobId, jobType, data.result ?? undefined);
    } else if (data?.status === 'failed') {
      onError(jobId, jobType, data.error ?? undefined);
    }
  }, [data?.status, jobId, jobType, onComplete, onError, data?.result, data?.error]);

  return null;
}

export function BackgroundJobsProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [activeJobs, setActiveJobs] = useState<Map<string, string>>(new Map());
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

  const handleComplete = useCallback(
    (jobId: string, jobType: string, result?: string) => {
      setActiveJobs((prev) => {
        const next = new Map(prev);
        next.delete(jobId);
        return next;
      });
      setCompletedJobs((prev) => [
        ...prev,
        { id: jobId, jobType, result, status: 'completed' as const },
      ]);
      toast('読み取り完了');
    },
    [toast],
  );

  const handleError = useCallback(
    (jobId: string, jobType: string, error?: string) => {
      setActiveJobs((prev) => {
        const next = new Map(prev);
        next.delete(jobId);
        return next;
      });
      setCompletedJobs((prev) => [
        ...prev,
        { id: jobId, jobType, error, status: 'failed' as const },
      ]);
      toast(error || '処理に失敗しました', 'error');
    },
    [toast],
  );

  const activeJobIds = Array.from(activeJobs.keys());

  return (
    <BackgroundJobsContext.Provider value={{ addJob, activeJobIds, completedJobs, consumeJob }}>
      {Array.from(activeJobs.entries()).map(([jobId, jobType]) => (
        <JobPoller
          key={jobId}
          jobId={jobId}
          jobType={jobType}
          onComplete={handleComplete}
          onError={handleError}
        />
      ))}
      {children}
    </BackgroundJobsContext.Provider>
  );
}
