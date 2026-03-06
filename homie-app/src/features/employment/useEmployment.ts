import { useState, useEffect, useCallback } from 'react';
import { api } from '@/utils/api';
import type { Employment, Shift, SalaryRecord, SalaryPrediction } from '@/types';

export function useEmployments() {
  const [employments, setEmployments] = useState<Employment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Employment[]>('/api/v1/employments');
      setEmployments(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployments();
  }, [fetchEmployments]);

  const addEmployment = useCallback(async (input: Record<string, unknown>) => {
    const created = await api.post<Employment>('/api/v1/employments', input);
    setEmployments((prev) => [...prev, created]);
    return created;
  }, []);

  const updateEmployment = useCallback(async (id: string, updates: Record<string, unknown>) => {
    const updated = await api.put<Employment>(`/api/v1/employments/${id}`, updates);
    setEmployments((prev) => prev.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const deleteEmployment = useCallback(async (id: string) => {
    await api.delete(`/api/v1/employments/${id}`);
    setEmployments((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return { employments, loading, addEmployment, updateEmployment, deleteEmployment };
}

export function useShifts(yearMonth?: string, userId?: string) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (yearMonth) params.set('year_month', yearMonth);
      if (userId) params.set('user_id', userId);
      const qs = params.toString();
      const data = await api.get<Shift[]>(`/api/v1/shifts${qs ? `?${qs}` : ''}`);
      setShifts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [yearMonth, userId]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const addShift = useCallback(async (input: {
    employmentId: string;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    isHoliday?: boolean;
    note?: string;
  }) => {
    const created = await api.post<Shift>('/api/v1/shifts', input);
    setShifts((prev) => [...prev, created].sort((a, b) => a.date.localeCompare(b.date)));
    return created;
  }, []);

  const updateShift = useCallback(async (id: string, updates: Record<string, unknown>) => {
    const updated = await api.put<Shift>(`/api/v1/shifts/${id}`, updates);
    setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const deleteShift = useCallback(async (id: string) => {
    await api.delete(`/api/v1/shifts/${id}`);
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { shifts, loading, addShift, updateShift, deleteShift, refetch: fetchShifts };
}

export function useSalary(yearMonth?: string) {
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = yearMonth ? `?year_month=${yearMonth}` : '';
      const data = await api.get<SalaryRecord[]>(`/api/v1/salary/records${params}`);
      setRecords(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [yearMonth]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const predict = useCallback(async (employmentId: string, ym: string) => {
    return api.get<SalaryPrediction>(`/api/v1/salary/predict?year_month=${ym}&employment_id=${employmentId}`);
  }, []);

  const addRecord = useCallback(async (input: Record<string, unknown>) => {
    const created = await api.post<SalaryRecord>('/api/v1/salary/records', input);
    setRecords((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateRecord = useCallback(async (id: string, updates: Record<string, unknown>) => {
    const updated = await api.put<SalaryRecord>(`/api/v1/salary/records/${id}`, updates);
    setRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const deleteRecord = useCallback(async (id: string) => {
    await api.delete(`/api/v1/salary/records/${id}`);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { records, loading, predict, addRecord, updateRecord, deleteRecord };
}
