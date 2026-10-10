/**
 * Fees (what the school charges each school year, per grade or for every grade), payments, and a student's
 * statement.
 *
 *   useFees(params, { enabled })   paginated list (admin); params: page, limit, sortBy, sortOrder,
 *                                  academicYear, gradeLevel
 *   useCreateFee() [form]          mutate(body) { academicYear, gradeLevel, name, amount }
 *   useUpdateFee() [form]          mutate({ id, body })
 *   useDeleteFee()                 mutate(id)
 *   useFeeStatement(params)        { studentId ('me' for a student), academicYear }: fees, payments, totals
 *   useRecordPayment() [form]      mutate(body) { studentId, academicYear, amount, paidOn, method, receiptNumber, note? }
 *   useDeletePayment()             mutate(id)
 *   useFeeYear()                   [academicYear, setAcademicYear]: the year a fees screen shows (URL)
 *
 * Every write refreshes the fee lists and the statements (one cache scope) and the activity log.
 * Mutations tagged [form] are silent (meta.silent): the form that sends them shows every error itself.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useInvalidate } from '../../hooks/useInvalidate';
import { useToast } from '../../hooks/useToast';
import { currentAcademicYear } from '../../utils/date';
import { formatPeso } from '../../utils/format';
import { activityKeys } from '../activity/keys';
import {
  createFee,
  deleteFee,
  deletePayment,
  getFeeStatement,
  listFees,
  recordPayment,
  updateFee,
} from './api';
import { feeKeys } from './keys';

/**
 * The school year a fees screen shows, kept in the URL (`academicYear`) so reload and shared links keep it;
 * the current school year when none is set.
 * @returns {[string, (academicYear: string) => void]}
 */
export function useFeeYear() {
  const [searchParams, setSearchParams] = useSearchParams();
  const setAcademicYear = (academicYear) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('academicYear', academicYear);
        return next;
      },
      { replace: true },
    );
  return [searchParams.get('academicYear') || currentAcademicYear(), setAcademicYear];
}

export function useFees(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: feeKeys.list(params),
    queryFn: () => listFees(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** @param {{ studentId: number|string, academicYear: string }} params */
export function useFeeStatement(params) {
  return useQuery({
    queryKey: feeKeys.statement(params),
    queryFn: () => getFeeStatement(params),
    placeholderData: keepPreviousData,
  });
}

function useInvalidateFees() {
  const invalidate = useInvalidate();
  return () => invalidate(feeKeys.all, activityKeys.all);
}

export function useCreateFee() {
  const invalidateFees = useInvalidateFees();
  const toast = useToast();
  return useMutation({
    mutationFn: createFee,
    meta: { silent: true },
    onSuccess: (fee) => {
      invalidateFees();
      toast.success(`${fee.name} added`);
    },
  });
}

export function useUpdateFee() {
  const invalidateFees = useInvalidateFees();
  const toast = useToast();
  return useMutation({
    mutationFn: (/** @type {{ id: number, body: object }} */ { id, body }) => updateFee(id, body),
    meta: { silent: true },
    onSuccess: (fee) => {
      invalidateFees();
      toast.success(`${fee.name} updated`);
    },
  });
}

export function useDeleteFee() {
  const invalidateFees = useInvalidateFees();
  const toast = useToast();
  return useMutation({
    mutationFn: deleteFee,
    onSuccess: () => {
      invalidateFees();
      toast.success('Fee deleted');
    },
  });
}

export function useRecordPayment() {
  const invalidateFees = useInvalidateFees();
  const toast = useToast();
  return useMutation({
    mutationFn: recordPayment,
    meta: { silent: true },
    onSuccess: (payment) => {
      invalidateFees();
      toast.success(`Payment of ${formatPeso(payment.amount)} recorded`);
    },
  });
}

export function useDeletePayment() {
  const invalidateFees = useInvalidateFees();
  const toast = useToast();
  return useMutation({
    mutationFn: deletePayment,
    onSuccess: () => {
      invalidateFees();
      toast.success('Payment removed');
    },
  });
}
