import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useExpenses, useCreateExpense, useDeleteExpense, useExpenseCategories } from '@/api/hooks'
import { PageHeader, Modal, Field, PageLoader, EmptyState, Pagination, fmt, fmtDate } from '@/components/ui'

const COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

const CATEGORIES = [
  'Rent', 'Utilities', 'Salaries', 'Inventory Purchase', 'Marketing',
  'Transport', 'Equipment', 'Repairs', 'Insurance', 'Other'
]

const schema = z.object({
  name: z.string().min(1, 'Required'),
  category: z.string().min(1, 'Required'),
  quantity: z.coerce.number().int().min(1).default(1),
  unit_cost: z.coerce.number().positive('Required'),
  expense_date: z.string().min(1, 'Required'),
  description: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function ExpensesPage() {
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useExpenses({
    page, page_size: 20,
    category: category || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })
  const { data: catData } = useExpenseCategories()
  const create = useCreateExpense()
  const del = useDeleteExpense()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { expense_date: new Date().toISOString().split('T')[0], quantity: 1 },
  })

  const onSubmit = async (data: FormData) => {
    try {
      await create.mutateAsync(data)
      toast.success('Expense recorded')
      setShowModal(false)
      reset()
    } catch { toast.error('Failed to save expense') }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete expense "${name}"?`)) return
    try { await del.mutateAsync(id); toast.success('Deleted') }
    catch { toast.error('Failed to delete') }
  }

  if (isLoading && !data) return <PageLoader />

  const totalExpenses = data?.items?.reduce((s: number, e: any) => s + e.total_cost, 0) || 0

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={`${data?.total || 0} expense records`}
        action={
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Record Expense
          </button>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
        {/* Category breakdown pie */}
        {catData?.length > 0 && (
          <div className="card xl:col-span-1">
            <div className="card-header"><h2 className="font-semibold text-gray-800 text-sm">By Category</h2></div>
            <div className="p-2">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={catData} dataKey="total" nameKey="category" cx="50%" cy="50%" outerRadius={70}>
                    {catData.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Table */}
        <div className={catData?.length > 0 ? 'xl:col-span-3' : 'xl:col-span-4'}>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className="input w-48 text-sm">
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm w-36" />
            <span className="self-center text-gray-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm w-36" />
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Qty</th>
                  <th>Unit Cost</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((e: any) => (
                  <tr key={e.id}>
                    <td>
                      <div className="font-medium">{e.name}</div>
                      {e.description && <div className="text-xs text-gray-400">{e.description}</div>}
                    </td>
                    <td><span className="badge-yellow">{e.category}</span></td>
                    <td className="text-xs text-gray-500">{fmtDate(e.expense_date)}</td>
                    <td>{e.quantity}</td>
                    <td>{fmt(e.unit_cost)}</td>
                    <td className="font-semibold">{fmt(e.total_cost)}</td>
                    <td>
                      <button onClick={() => handleDelete(e.id, e.name)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!data?.items?.length && (
                  <tr><td colSpan={7}><EmptyState title="No expenses found" /></td></tr>
                )}
              </tbody>
              {data?.items?.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={5} className="px-4 py-3 font-semibold text-gray-700">Total</td>
                    <td className="px-4 py-3 font-bold text-gray-900">{fmt(totalExpenses)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />
        </div>
      </div>

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Record Expense">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Expense Name" error={errors.name?.message}>
            <input {...register('name')} className="input" placeholder="Rent, Electricity bill..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" error={errors.category?.message}>
              <select {...register('category')} className="input">
                <option value="">Select category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Date" error={errors.expense_date?.message}>
              <input {...register('expense_date')} type="date" className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Quantity" error={errors.quantity?.message}>
              <input {...register('quantity')} type="number" min={1} className="input" />
            </Field>
            <Field label="Unit Cost (KES)" error={errors.unit_cost?.message}>
              <input {...register('unit_cost')} type="number" step="0.01" className="input" placeholder="0.00" />
            </Field>
          </div>
          <Field label="Notes (optional)">
            <textarea {...register('notes')} className="input" rows={2} />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending} className="btn-primary">Save Expense</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
