import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from './client'

// ── Auth ────────────────────────────────────────────────────────────────────
export const useLogin = () => {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post('/auth/login', data).then((r) => r.data),
  })
}

export const useRegister = () => {
  return useMutation({
    mutationFn: (data: { business_name: string; full_name: string; email: string; password: string }) =>
      api.post('/auth/register', data).then((r) => r.data),
  })
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export const useDashboard = (period: string) =>
  useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => api.get(`/dashboard/summary?period=${period}`).then((r) => r.data),
    refetchInterval: 60000,
  })

// ── Products ────────────────────────────────────────────────────────────────
export const useProducts = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['products', params],
    queryFn: () => api.get('/products/', { params }).then((r) => r.data),
  })

export const useInventorySummary = () =>
  useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => api.get('/products/stats/summary').then((r) => r.data),
  })

export const useCreateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/products/', data).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['inventory-summary'] }) },
  })
}

export const useUpdateProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch(`/products/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export const useDeleteProduct = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

// ── Customers ───────────────────────────────────────────────────────────────
export const useCustomers = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.get('/customers/', { params }).then((r) => r.data),
  })

export const useCustomersMap = () =>
  useQuery({
    queryKey: ['customers-map'],
    queryFn: () => api.get('/customers/map').then((r) => r.data),
  })

export const useCreateCustomer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/customers/', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export const useUpdateCustomer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch(`/customers/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

// ── Receipts ────────────────────────────────────────────────────────────────
export const useReceipts = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['receipts', params],
    queryFn: () => api.get('/receipts/', { params }).then((r) => r.data),
  })

export const useReceipt = (id: string) =>
  useQuery({
    queryKey: ['receipt', id],
    queryFn: () => api.get(`/receipts/${id}`).then((r) => r.data),
    enabled: !!id,
  })

export const useCreateReceipt = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/receipts/', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['receipts'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

// ── Invoices ────────────────────────────────────────────────────────────────
export const useInvoices = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['invoices', params],
    queryFn: () => api.get('/invoices/', { params }).then((r) => r.data),
  })

export const useCreateInvoice = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/invoices/', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export const useUpdateInvoiceStatus = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/invoices/${id}/status?status=${status}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

// ── Expenses ────────────────────────────────────────────────────────────────
export const useExpenses = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.get('/expenses/', { params }).then((r) => r.data),
  })

export const useExpenseCategories = () =>
  useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => api.get('/expenses/categories').then((r) => r.data),
  })

export const useCreateExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: unknown) => api.post('/expenses/', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export const useDeleteExpense = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

// ── Reports ─────────────────────────────────────────────────────────────────
export const useProfitLossReport = (dateFrom: string, dateTo: string) =>
  useQuery({
    queryKey: ['report-pl', dateFrom, dateTo],
    queryFn: () =>
      api.get('/reports/profit-loss', { params: { date_from: dateFrom, date_to: dateTo } }).then((r) => r.data),
    enabled: !!dateFrom && !!dateTo,
  })

export const useSalesReport = (dateFrom: string, dateTo: string, groupBy = 'day') =>
  useQuery({
    queryKey: ['report-sales', dateFrom, dateTo, groupBy],
    queryFn: () =>
      api.get('/reports/sales', { params: { date_from: dateFrom, date_to: dateTo, group_by: groupBy } }).then((r) => r.data),
    enabled: !!dateFrom && !!dateTo,
  })

export const useInventoryReport = () =>
  useQuery({
    queryKey: ['report-inventory'],
    queryFn: () => api.get('/reports/inventory').then((r) => r.data),
  })

export const useCustomersReport = () =>
  useQuery({
    queryKey: ['report-customers'],
    queryFn: () => api.get('/reports/customers').then((r) => r.data),
  })

// ── Business ────────────────────────────────────────────────────────────────
export const useBusiness = () =>
  useQuery({
    queryKey: ['business'],
    queryFn: () => api.get('/businesses/me').then((r) => r.data),
  })
