import { z } from 'zod';

export const EmploymentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  homeId: z.string(),
  name: z.string(),
  type: z.enum(['part_time', 'full_time']),
  hourlyRate: z.number().optional(),
  nightStartHour: z.number().optional(),
  nightEndHour: z.number().optional(),
  nightRateMultiplier: z.number().optional(),
  holidayRateMultiplier: z.number().optional(),
  overtimeThresholdMinutes: z.number().optional(),
  overtimeRateMultiplier: z.number().optional(),
  monthlySalary: z.number().optional(),
  transportAllowance: z.number().optional(),
  payDay: z.number().optional(),
  socialInsuranceRate: z.number().optional(),
  incomeTaxRate: z.number().optional(),
  color: z.string().optional(),
  note: z.string().optional(),
  depositAccountId: z.string().optional(),
  createdAt: z.string(),
});

export const EmploymentListSchema = z.array(EmploymentSchema);

export const ShiftSchema = z.object({
  id: z.string(),
  employmentId: z.string(),
  userId: z.string(),
  homeId: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  breakMinutes: z.number(),
  isHoliday: z.boolean(),
  note: z.string().optional(),
  createdAt: z.string(),
});

export const ShiftListSchema = z.array(ShiftSchema);

export const SalaryRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  homeId: z.string(),
  employmentId: z.string(),
  yearMonth: z.string(),
  basePay: z.number(),
  overtimePay: z.number(),
  nightPay: z.number(),
  holidayPay: z.number(),
  transportAllowance: z.number(),
  otherAllowances: z.number(),
  grossAmount: z.number(),
  socialInsurance: z.number(),
  incomeTax: z.number(),
  otherDeductions: z.number(),
  netAmount: z.number(),
  paidDate: z.string().optional(),
  depositAccountId: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
});

export const SalaryRecordListSchema = z.array(SalaryRecordSchema);

export const ShiftPayDetailSchema = z.object({
  shiftId: z.string(),
  date: z.string(),
  workMinutes: z.number(),
  normalMinutes: z.number(),
  overtimeMinutes: z.number(),
  nightMinutes: z.number(),
  isHoliday: z.boolean(),
  pay: z.number(),
});

export const ShiftPayDetailListSchema = z.array(ShiftPayDetailSchema);

export const SalaryPredictionSchema = z.object({
  employmentId: z.string(),
  employmentName: z.string(),
  yearMonth: z.string(),
  totalShifts: z.number(),
  totalWorkMinutes: z.number(),
  basePay: z.number(),
  overtimePay: z.number(),
  nightPay: z.number(),
  holidayPay: z.number(),
  transportAllowance: z.number(),
  grossAmount: z.number(),
  socialInsurance: z.number(),
  incomeTax: z.number(),
  totalDeductions: z.number(),
  netAmount: z.number(),
  shiftDetails: z.array(ShiftPayDetailSchema),
});

export const SalaryPredictionListSchema = z.array(SalaryPredictionSchema);

export type Employment = z.infer<typeof EmploymentSchema>;
export type Shift = z.infer<typeof ShiftSchema>;
export type SalaryRecord = z.infer<typeof SalaryRecordSchema>;
export type ShiftPayDetail = z.infer<typeof ShiftPayDetailSchema>;
export type SalaryPrediction = z.infer<typeof SalaryPredictionSchema>;
