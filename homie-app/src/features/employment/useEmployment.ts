import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '@/utils/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  EmploymentListSchema,
  EmploymentSchema,
  ShiftListSchema,
  ShiftSchema,
  SalaryRecordListSchema,
  SalaryRecordSchema,
  SalaryPredictionSchema,
} from '@/lib/schemas';
import type { SalaryPrediction } from '@/lib/schemas';

export function useEmployments() {
  const queryClient = useQueryClient();

  const employmentsQuery = useQuery({
    queryKey: queryKeys.employment.list(),
    queryFn: () => api.getWithSchema('/api/v1/employments', EmploymentListSchema),
  });

  const addEmploymentMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.postWithSchema('/api/v1/employments', EmploymentSchema, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const updateEmploymentMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.putWithSchema(`/api/v1/employments/${id}`, EmploymentSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const deleteEmploymentMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/employments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const employments = employmentsQuery.data ?? [];
  const loading = employmentsQuery.isLoading;

  return {
    employments,
    loading,
    addEmployment: (input: Record<string, unknown>) =>
      addEmploymentMutation.mutateAsync(input),
    updateEmployment: (id: string, updates: Record<string, unknown>) =>
      updateEmploymentMutation.mutateAsync({ id, updates }),
    deleteEmployment: (id: string) => deleteEmploymentMutation.mutateAsync(id),
  };
}

export function useShifts(yearMonth?: string, userId?: string) {
  const queryClient = useQueryClient();

  const params = new URLSearchParams();
  if (yearMonth) params.set('year_month', yearMonth);
  if (userId) params.set('user_id', userId);
  const qs = params.toString();

  const shiftsQuery = useQuery({
    queryKey: queryKeys.employment.shifts(yearMonth, userId),
    queryFn: () =>
      api.getWithSchema(`/api/v1/shifts${qs ? `?${qs}` : ''}`, ShiftListSchema),
  });

  const addShiftMutation = useMutation({
    mutationFn: (input: {
      employmentId: string;
      date: string;
      startTime: string;
      endTime: string;
      breakMinutes?: number;
      isHoliday?: boolean;
      note?: string;
    }) => api.postWithSchema('/api/v1/shifts', ShiftSchema, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.putWithSchema(`/api/v1/shifts/${id}`, ShiftSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const deleteShiftMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/shifts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const shifts = shiftsQuery.data ?? [];
  const loading = shiftsQuery.isLoading;

  return {
    shifts,
    loading,
    addShift: (input: Parameters<typeof addShiftMutation.mutateAsync>[0]) =>
      addShiftMutation.mutateAsync(input),
    updateShift: (id: string, updates: Record<string, unknown>) =>
      updateShiftMutation.mutateAsync({ id, updates }),
    deleteShift: (id: string) => deleteShiftMutation.mutateAsync(id),
    refetch: () => shiftsQuery.refetch(),
  };
}

export function useSalary(yearMonth?: string) {
  const queryClient = useQueryClient();

  const params = yearMonth ? `?year_month=${yearMonth}` : '';

  const recordsQuery = useQuery({
    queryKey: queryKeys.employment.salary(yearMonth),
    queryFn: () =>
      api.getWithSchema(`/api/v1/salary/records${params}`, SalaryRecordListSchema),
  });

  const predictMutation = useMutation({
    mutationFn: ({ employmentId, ym }: { employmentId: string; ym: string }) =>
      api.getWithSchema(
        `/api/v1/salary/predict?year_month=${ym}&employment_id=${employmentId}`,
        SalaryPredictionSchema,
      ),
  });

  const predict = useCallback(
    (employmentId: string, ym: string): Promise<SalaryPrediction> =>
      predictMutation.mutateAsync({ employmentId, ym }),
    [predictMutation],
  );

  const addRecordMutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.postWithSchema('/api/v1/salary/records', SalaryRecordSchema, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, unknown> }) =>
      api.putWithSchema(`/api/v1/salary/records/${id}`, SalaryRecordSchema, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const deleteRecordMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/salary/records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.employment.all });
    },
  });

  const records = recordsQuery.data ?? [];
  const loading = recordsQuery.isLoading;

  return {
    records,
    loading,
    predict,
    addRecord: (input: Record<string, unknown>) =>
      addRecordMutation.mutateAsync(input),
    updateRecord: (id: string, updates: Record<string, unknown>) =>
      updateRecordMutation.mutateAsync({ id, updates }),
    deleteRecord: (id: string) => deleteRecordMutation.mutateAsync(id),
  };
}
