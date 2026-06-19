import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCustomers, useProducts, useCreateInvoice } from '@/api/hooks'
import { fmt, PageHeader } from '@/components/ui'

interface LineItem {
  product_id?: string
  description: string
  quantity: number
  selling_price: number
  cost_price?: number  // reference only, for live profit preview
}

export default function NewInvoicePage() {
  const navigate = useNavigate()
  const [customerId, setCustomerId] = useState('')
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [lines, setLines] = useState<LineItem[]>([{ description: '', quantity: 1, selling_price: 0 }])
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [terms, setTerms] = useState('')
  const [productSearchIdx, setProductSearchIdx] = useState<number | null>(null)
  const [productSearch, setProductSearch] = useState('')

  const { data: customers } = useCustomers({ page_size: 100 })
  const { data: products } = useProducts({ search: productSearch, page_size: 8 })
  const createInvoice = useCreateInvoice()

  const addLine = () => setLines([...lines, { description: '', quantity: 1, selling_price: 0 }])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: keyof LineItem, value: string | number) =>
    setLines(lines.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const selectProduct = (i: number, p: any) => {
    setLines(lines.map((l, idx) => idx === i ? {
      ...l,
      product_id: p.id,
      description: p.name,
      cost_price: p.cost_price,
      // selling_price intentionally left as-is / 0 — chosen at invoice time
    } : l))
    setProductSearchIdx(null)
    setProductSearch('')
  }

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.selling_price, 0)
  const total = subtotal - discount
  const estimatedProfit = lines.reduce(
    (s, l) => s + (l.cost_price !== undefined ? (l.selling_price - l.cost_price) * l.quantity : 0),
    0
  )

  const handleSubmit = async () => {
    if (!customerId) { toast.error('Select a customer'); return }
    if (!dueDate) { toast.error('Set a due date'); return }
    if (lines.some((l) => !l.description || l.selling_price <= 0)) {
      toast.error('Set a description and selling price for every line'); return
    }
    try {
      const inv = await createInvoice.mutateAsync({
        customer_id: customerId,
        issue_date: issueDate,
        due_date: dueDate,
        discount_amount: discount,
        notes,
        terms,
        items: lines.map((l) => ({
          product_id: l.product_id,
          description: l.description,
          quantity: l.quantity,
          selling_price: l.selling_price,
        })),
      })
      toast.success(`Invoice ${inv.invoice_number} created!`)
      navigate('/invoices')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create invoice')
    }
  }

  return (
    <div>
      <PageHeader title="New Invoice" subtitle="Selling price is set per line item — independent of inventory" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          {/* Customer & dates */}
          <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <label className="label">Customer</label>
              <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input">
                <option value="">Select customer...</option>
                {customers?.items?.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Issue Date</label>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="input" />
            </div>
          </div>

          {/* Line items */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-800">Line Items</h2>
              <button onClick={addLine} className="btn-secondary btn-sm">
                <Plus className="w-3 h-3" /> Add Line
              </button>
            </div>
            <div className="p-4 space-y-3">
              {lines.map((line, i) => {
                const lineProfit = line.cost_price !== undefined
                  ? (line.selling_price - line.cost_price) * line.quantity
                  : null
                return (
                  <div key={i} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5 relative">
                        <input
                          value={line.description}
                          onChange={(e) => {
                            updateLine(i, 'description', e.target.value)
                            updateLine(i, 'product_id', '')
                          }}
                          onFocus={() => setProductSearchIdx(i)}
                          placeholder="Description or search product..."
                          className="input text-sm"
                        />
                        {productSearchIdx === i && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            <div className="p-2 border-b border-gray-100">
                              <input
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder="Search inventory..."
                                className="input text-xs py-1"
                                autoFocus
                              />
                            </div>
                            {products?.items?.map((p: any) => (
                              <button
                                key={p.id}
                                onClick={() => selectProduct(i, p)}
                                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-xs flex justify-between"
                              >
                                <span>{p.name}</span>
                                <span className="text-gray-400">cost {fmt(p.cost_price)}</span>
                              </button>
                            ))}
                            <button
                              onClick={() => setProductSearchIdx(null)}
                              className="w-full text-center px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 border-t"
                            >
                              Close (use free-text description)
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(i, 'quantity', Number(e.target.value))}
                          placeholder="Qty"
                          min={1}
                          className="input text-sm"
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          value={line.selling_price || ''}
                          onChange={(e) => updateLine(i, 'selling_price', Number(e.target.value))}
                          placeholder="Selling price"
                          min={0}
                          step="0.01"
                          className="input text-sm"
                        />
                      </div>
                      <div className="col-span-1 text-sm font-semibold text-gray-700 text-right">
                        {fmt(line.quantity * line.selling_price)}
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {lineProfit !== null && line.selling_price > 0 && (
                      <div className="text-xs text-gray-400 pl-1">
                        Cost: {fmt(line.cost_price!)} each ·{' '}
                        <span className={lineProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          Profit: {fmt(lineProfit)}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5 grid grid-cols-2 gap-4">
            <div>
              <label className="label">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={3} placeholder="Any notes for the customer..." />
            </div>
            <div>
              <label className="label">Terms & Conditions</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} className="input" rows={3} placeholder="Payment terms..." />
            </div>
          </div>
        </div>

        {/* Summary panel */}
        <div className="card p-5 space-y-4 h-fit">
          <h2 className="font-semibold text-gray-800">Invoice Summary</h2>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Discount</span>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-28 input text-right text-sm py-1"
                min={0}
              />
            </div>
            <div className="flex justify-between font-bold text-base border-t pt-2 text-gray-900">
              <span>Total</span><span>{fmt(total)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t">
              <span className="text-gray-500">Estimated Profit</span>
              <span className={estimatedProfit >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {fmt(estimatedProfit)}
              </span>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={createInvoice.isPending}
            className="btn-primary w-full justify-center py-2.5"
          >
            {createInvoice.isPending ? 'Creating...' : 'Create Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}
