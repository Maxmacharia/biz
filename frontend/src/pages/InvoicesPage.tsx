import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useInvoices, useUpdateInvoiceStatus } from '@/api/hooks'
import {
  PageHeader, PageLoader, EmptyState, Pagination,
  fmt, fmtDate, StatusBadge, SearchInput,
} from '@/components/ui'
import toast from 'react-hot-toast'

const STATUS_OPTIONS = ['', 'draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled']

export default function InvoicesPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const { data, isLoading } = useInvoices({ page, page_size: 20, status: status || undefined })
  const updateStatus = useUpdateInvoiceStatus()

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ id, status: newStatus })
      toast.success('Status updated')
    } catch { toast.error('Failed to update') }
  }

  if (isLoading && !data) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`${data?.total || 0} total invoices`}
        action={
          <Link to="/invoices/new" className="btn-primary">
            <Plus className="w-4 h-4" /> New Invoice
          </Link>
        }
      />

      {/* Filter by status */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1) }}
            className={`btn-sm capitalize ${status === s ? 'btn-primary' : 'btn-secondary'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Issue Date</th>
              <th>Due Date</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((inv: any) => (
              <tr key={inv.id}>
                <td><span className="font-mono text-xs font-semibold text-blue-700">{inv.invoice_number}</span></td>
                <td className="font-medium">{inv.customer_id}</td>
                <td className="text-xs text-gray-500">{fmtDate(inv.issue_date)}</td>
                <td className="text-xs text-gray-500">{fmtDate(inv.due_date)}</td>
                <td className="font-semibold">{fmt(inv.total_amount)}</td>
                <td className="text-green-600">{fmt(inv.amount_paid)}</td>
                <td className={inv.amount_due > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>
                  {inv.amount_due > 0 ? fmt(inv.amount_due) : '—'}
                </td>
                <td><StatusBadge status={inv.status} /></td>
                <td>
                  <select
                    value={inv.status}
                    onChange={(e) => handleStatusChange(inv.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                  >
                    {STATUS_OPTIONS.filter(Boolean).map((s) => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {!data?.items?.length && (
              <tr><td colSpan={9}><EmptyState title="No invoices found" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />
    </div>
  )
}
