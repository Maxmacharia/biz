import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { Download, TrendingUp, TrendingDown } from 'lucide-react'
import {
  useProfitLossReport, useSalesReport,
  useInventoryReport, useCustomersReport,
} from '@/api/hooks'
import { PageHeader, PageLoader, fmt } from '@/components/ui'

const today = new Date().toISOString().split('T')[0]
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]

type ReportTab = 'pl' | 'sales' | 'inventory' | 'customers'

export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('pl')
  const [dateFrom, setDateFrom] = useState(monthStart)
  const [dateTo, setDateTo] = useState(today)
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  const plReport = useProfitLossReport(dateFrom, dateTo)
  const salesReport = useSalesReport(dateFrom, dateTo, groupBy)
  const inventoryReport = useInventoryReport()
  const customersReport = useCustomersReport()

  const tabs = [
    { id: 'pl', label: 'Profit & Loss' },
    { id: 'sales', label: 'Sales Trend' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'customers', label: 'Customers' },
  ]

  const handleExportCsv = () => {
    const url = `${import.meta.env.VITE_API_URL || ''}/api/v1/reports/export/sales-csv?date_from=${dateFrom}&date_to=${dateTo}`
    window.open(url, '_blank')
  }

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Business performance insights"
        action={
          <button onClick={handleExportCsv} className="btn-secondary">
            <Download className="w-4 h-4" /> Export Sales CSV
          </button>
        }
      />

      {/* Date range */}
      <div className="card p-4 mb-6 flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-gray-600">Date Range:</span>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input text-sm py-1.5 w-36" />
          <span className="text-gray-400">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input text-sm py-1.5 w-36" />
        </div>
        {/* Quick ranges */}
        <div className="flex gap-1">
          {[
            { label: 'Today', from: today, to: today },
            { label: 'This Month', from: monthStart, to: today },
            { label: 'This Year', from: `${new Date().getFullYear()}-01-01`, to: today },
          ].map((r) => (
            <button key={r.label} onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}
              className="btn-secondary btn-sm">{r.label}</button>
          ))}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as ReportTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* P&L Report */}
      {tab === 'pl' && (
        <PLReport data={plReport.data} isLoading={plReport.isLoading} />
      )}

      {/* Sales Report */}
      {tab === 'sales' && (
        <SalesReport
          data={salesReport.data}
          isLoading={salesReport.isLoading}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
        />
      )}

      {/* Inventory Report */}
      {tab === 'inventory' && (
        <InventoryReport data={inventoryReport.data} isLoading={inventoryReport.isLoading} />
      )}

      {/* Customers Report */}
      {tab === 'customers' && (
        <CustomersReport data={customersReport.data} isLoading={customersReport.isLoading} />
      )}
    </div>
  )
}

function PLReport({ data, isLoading }: { data: any; isLoading: boolean }) {
  if (isLoading) return <PageLoader />
  if (!data) return null

  const profitPositive = data.net_profit >= 0

  const kpis = [
    { label: 'Revenue', value: fmt(data.revenue), color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Cost of Goods Sold', value: fmt(data.cogs), color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Gross Profit', value: fmt(data.gross_profit), color: 'text-green-600', bg: 'bg-green-50',
      sub: `${data.gross_margin.toFixed(1)}% margin` },
    { label: 'Total Expenses', value: fmt(data.total_expenses), color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Net Profit', value: fmt(data.net_profit), color: profitPositive ? 'text-emerald-600' : 'text-red-600',
      bg: profitPositive ? 'bg-emerald-50' : 'bg-red-50', sub: `${data.net_margin.toFixed(1)}% margin` },
  ]

  const chartData = [
    { name: 'Revenue', value: data.revenue, fill: '#3b82f6' },
    { name: 'COGS', value: data.cogs, fill: '#f97316' },
    { name: 'Expenses', value: data.total_expenses, fill: '#f59e0b' },
    { name: 'Gross Profit', value: data.gross_profit, fill: '#22c55e' },
    { name: 'Net Profit', value: data.net_profit, fill: profitPositive ? '#10b981' : '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className={`card p-4 ${k.bg}`}>
            <div className="text-xs text-gray-500 font-medium mb-1">{k.label}</div>
            <div className={`text-lg font-bold ${k.color}`}>{k.value}</div>
            {k.sub && <div className="text-xs text-gray-400 mt-0.5">{k.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h2 className="font-semibold">P&L Breakdown</h2></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h2 className="font-semibold">Expense Breakdown</h2></div>
          <div className="card-body">
            {data.expense_categories?.length ? (
              <div className="space-y-3">
                {data.expense_categories.map((c: any) => {
                  const pct = data.total_expenses > 0 ? (c.total / data.total_expenses) * 100 : 0
                  return (
                    <div key={c.category}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{c.category}</span>
                        <span className="font-semibold">{fmt(c.total)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">No expenses recorded</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SalesReport({ data, isLoading, groupBy, setGroupBy }: any) {
  if (isLoading) return <PageLoader />
  if (!data) return null

  const totalRevenue = data.data.reduce((s: number, d: any) => s + d.revenue, 0)
  const totalTx = data.data.reduce((s: number, d: any) => s + d.transactions, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 bg-blue-50">
          <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
          <div className="text-xl font-bold text-blue-600">{fmt(totalRevenue)}</div>
        </div>
        <div className="card p-4 bg-green-50">
          <div className="text-xs text-gray-500 mb-1">Transactions</div>
          <div className="text-xl font-bold text-green-600">{totalTx}</div>
        </div>
        <div className="card p-4 bg-purple-50">
          <div className="text-xs text-gray-500 mb-1">Avg per Transaction</div>
          <div className="text-xl font-bold text-purple-600">{totalTx ? fmt(totalRevenue / totalTx) : '—'}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold">Sales Trend</h2>
          <div className="flex gap-1">
            {(['day', 'week', 'month'] as const).map((g) => (
              <button key={g} onClick={() => setGroupBy(g)}
                className={`btn-sm capitalize ${groupBy === g ? 'btn-primary' : 'btn-secondary'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }}
                tickFormatter={(v) => v.slice(5)} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v: number, name: string) =>
                  name === 'Revenue' ? [fmt(v), name] : [v, name]}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="revenue" name="Revenue"
                stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="transactions" name="Transactions"
                stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function InventoryReport({ data, isLoading }: any) {
  if (isLoading) return <PageLoader />
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: data.total_products, color: 'text-blue-600' },
          { label: 'Stock Value', value: fmt(data.total_stock_value), color: 'text-green-600' },
          { label: 'Low Stock Items', value: data.low_stock_count, color: 'text-amber-600' },
          { label: 'Out of Stock', value: data.out_of_stock_count, color: 'text-red-600' },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {Object.entries(data.by_category || {}).map(([cat, info]: any) => (
        <div key={cat} className="card">
          <div className="card-header">
            <h2 className="font-semibold">{cat}</h2>
            <span className="text-sm text-gray-500">Stock value: {fmt(info.stock_value)}</span>
          </div>
          <div className="table-container rounded-none border-0">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Cost Price</th>
                  <th>Stock Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {info.products.map((p: any) => (
                  <tr key={p.id}>
                    <td className="font-medium">{p.name}</td>
                    <td className={p.is_low_stock ? 'text-red-600 font-semibold' : ''}>{p.quantity}</td>
                    <td>{fmt(p.cost_price)}</td>
                    <td>{fmt(p.stock_value)}</td>
                    <td>
                      {p.quantity === 0
                        ? <span className="badge-red">Out</span>
                        : p.is_low_stock
                        ? <span className="badge-yellow">Low</span>
                        : <span className="badge-green">OK</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function CustomersReport({ data, isLoading }: any) {
  if (isLoading) return <PageLoader />
  if (!data) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Customers', value: data.total_customers, color: 'text-blue-600' },
          { label: 'With Debt', value: data.customers_with_debt, color: 'text-red-600' },
          { label: 'Total Debt', value: fmt(data.total_outstanding_debt), color: 'text-red-500' },
          { label: 'Lifetime Revenue', value: fmt(data.total_lifetime_purchases), color: 'text-green-600' },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <div className="text-xs text-gray-500 mb-1">{k.label}</div>
            <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold">Top 20 Customers by Revenue</h2>
        </div>
        <div className="table-container rounded-none border-0">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Total Purchases</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {data.top_customers?.map((c: any, i: number) => (
                <tr key={c.id}>
                  <td>
                    <span className={`font-bold ${i < 3 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-gray-500 text-xs">{c.phone || '—'}</td>
                  <td className="font-semibold text-green-600">{fmt(c.total_purchases)}</td>
                  <td>
                    {c.outstanding_balance > 0
                      ? <span className="badge-red">{fmt(c.outstanding_balance)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
