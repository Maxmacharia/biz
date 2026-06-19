import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Download } from 'lucide-react'
import { useReceipts } from '@/api/hooks'
import {
  PageHeader, SearchInput, PageLoader, EmptyState,
  Pagination, fmt, fmtDateTime, StatusBadge,
} from '@/components/ui'

export default function ReceiptsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const { data, isLoading } = useReceipts({
    search, page, page_size: 20,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  const handleExportCsv = () => {
    if (!dateFrom || !dateTo) { alert('Select date range to export'); return }
    const url = `${import.meta.env.VITE_API_URL || ''}/api/v1/reports/export/sales-csv?date_from=${dateFrom}&date_to=${dateTo}`
    window.open(url, '_blank')
  }

  if (isLoading && !data) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Receipts"
        subtitle={`${data?.total || 0} total receipts`}
        action={
          <div className="flex gap-2">
            <button onClick={handleExportCsv} className="btn-secondary btn-sm">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <Link to="/receipts/new" className="btn-primary">
              <Plus className="w-4 h-4" /> New Sale
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search receipt no..." />
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="input text-sm py-1.5 w-36" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="input text-sm py-1.5 w-36" />
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Profit</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((r: any) => (
              <tr key={r.id}>
                <td><span className="font-mono text-xs font-semibold text-blue-700">{r.receipt_number}</span></td>
                <td className="text-xs text-gray-500">{fmtDateTime(r.created_at)}</td>
                <td>{r.customer_id ? <span className="font-medium">{r.customer_name || '—'}</span> : <span className="text-gray-400">Walk-in</span>}</td>
                <td><span className="badge-gray">{r.items?.length} items</span></td>
                <td><StatusBadge status={r.payment_method} /></td>
                <td className="font-semibold">{fmt(r.total_amount)}</td>
                <td className={r.total_profit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {fmt(r.total_profit || 0)}
                </td>
                <td className={r.change_amount > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                  {r.change_amount > 0 ? fmt(r.change_amount) : '—'}
                </td>
              </tr>
            ))}
            {!data?.items?.length && (
              <tr>
                <td colSpan={8}>
                  <EmptyState title="No receipts found" description="Complete your first sale to see receipts here.">
                  </EmptyState>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />
    </div>
  )
}
