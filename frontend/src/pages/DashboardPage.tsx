import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { ShoppingCart, TrendingUp, Wallet, AlertTriangle, Users, FileText } from 'lucide-react'
import { useDashboard } from '@/api/hooks'
import { StatCard, PageLoader, fmt, PageHeader } from '@/components/ui'

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
]

export default function DashboardPage() {
  const [period, setPeriod] = useState('today')
  const { data, isLoading } = useDashboard(period)

  if (isLoading) return <PageLoader />

  const d = data || {}
  const profitPositive = (d.net_profit || 0) >= 0

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time business overview"
        action={
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setPeriod(o.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  period === o.value
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Total Sales"
          value={fmt(d.total_sales || 0)}
          sub={`${d.sales_count || 0} transactions`}
          icon={<ShoppingCart className="w-6 h-6 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          label="Expenses"
          value={fmt(d.total_expenses || 0)}
          icon={<Wallet className="w-6 h-6 text-orange-600" />}
          color="bg-orange-50"
        />
        <StatCard
          label="Gross Profit"
          value={fmt(d.gross_profit || 0)}
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          label="Net Profit"
          value={fmt(d.net_profit || 0)}
          icon={<TrendingUp className={`w-6 h-6 ${profitPositive ? 'text-emerald-600' : 'text-red-600'}`} />}
          color={profitPositive ? 'bg-emerald-50' : 'bg-red-50'}
        />
        <StatCard
          label="Low Stock"
          value={String(d.low_stock_count || 0)}
          sub="items need restock"
          icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
          color="bg-amber-50"
        />
        <StatCard
          label="Pending Invoices"
          value={fmt(d.pending_invoices || 0)}
          icon={<FileText className="w-6 h-6 text-purple-600" />}
          color="bg-purple-50"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        {/* Sales trend */}
        <div className="card xl:col-span-2">
          <div className="card-header">
            <h2 className="font-semibold text-gray-800">Sales – Last 7 Days</h2>
          </div>
          <div className="card-body pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={d.sales_trend || []}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [fmt(v), 'Sales']} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#salesGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top products */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-800">Top Products</h2>
          </div>
          <div className="card-body">
            {d.top_products?.length ? (
              <div className="space-y-3">
                {d.top_products.map((p: any, i: number) => (
                  <div key={p.name} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.qty_sold} sold</div>
                    </div>
                    <div className="text-sm font-semibold text-gray-800">{fmt(p.revenue)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">No sales data</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top customers */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-800">Top Customers</h2>
            <span className="text-xs text-gray-400">{d.customer_count} total</span>
          </div>
          <div className="table-container rounded-none border-0">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Total Purchases</th>
                  <th>Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {d.top_customers?.map((c: any) => (
                  <tr key={c.name}>
                    <td className="font-medium">{c.name}</td>
                    <td>{fmt(c.total_purchases)}</td>
                    <td>
                      {c.outstanding_balance > 0 ? (
                        <span className="badge-red">{fmt(c.outstanding_balance)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!d.top_customers?.length && (
                  <tr><td colSpan={3} className="text-center text-gray-400 py-8">No customers yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Profit vs Expense bar chart */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-800">Revenue vs Expenses</h2>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[
                  { name: 'Revenue', value: d.total_sales || 0, fill: '#3b82f6' },
                  { name: 'Expenses', value: d.total_expenses || 0, fill: '#f59e0b' },
                  { name: 'Net Profit', value: d.net_profit || 0, fill: profitPositive ? '#22c55e' : '#ef4444' },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[0, 1, 2].map((i) => (
                    <Cell
                      key={i}
                      fill={['#3b82f6', '#f59e0b', profitPositive ? '#22c55e' : '#ef4444'][i]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
