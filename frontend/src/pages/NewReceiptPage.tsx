import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Minus, Trash2, ShoppingCart, Search, TrendingUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { useProducts, useCustomers, useCreateReceipt } from '@/api/hooks'
import { fmt, PageHeader } from '@/components/ui'

interface CartItem {
  product_id: string
  product_name: string
  cost_price: number     // reference only, for the live profit preview
  quantity: number
  selling_price: number  // chosen by the user at sale time
}

export default function NewReceiptPage() {
  const navigate = useNavigate()
  const [cart, setCart] = useState<CartItem[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mpesa'>('cash')
  const [mpesaRef, setMpesaRef] = useState('')
  const [discount, setDiscount] = useState(0)
  const [amountPaid, setAmountPaid] = useState(0)

  const { data: products } = useProducts({ search: productSearch, page_size: 10 })
  const { data: customers } = useCustomers({ page_size: 100 })
  const createReceipt = useCreateReceipt()

  const subtotal = cart.reduce((s, i) => s + i.selling_price * i.quantity, 0)
  const total = subtotal - discount
  const change = amountPaid - total
  const estimatedProfit = cart.reduce((s, i) => s + (i.selling_price - i.cost_price) * i.quantity, 0)

  const addToCart = (p: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id)
      if (existing) {
        return prev.map((i) =>
          i.product_id === p.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      // selling_price starts blank (0) — the user MUST set it; it is never
      // pre-filled from inventory because inventory doesn't store one.
      return [...prev, {
        product_id: p.id,
        product_name: p.name,
        cost_price: p.cost_price,
        quantity: 1,
        selling_price: 0,
      }]
    })
    setProductSearch('')
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((i) => i.product_id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
    )
  }

  const updateSellingPrice = (id: string, price: number) => {
    setCart((prev) => prev.map((i) => i.product_id === id ? { ...i, selling_price: price } : i))
  }

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.product_id !== id))

  const handleSubmit = async () => {
    if (cart.length === 0) { toast.error('Add at least one product'); return }
    if (cart.some((i) => !i.selling_price || i.selling_price <= 0)) {
      toast.error('Set a selling price for every item'); return
    }
    if (amountPaid < total) { toast.error('Amount paid is less than total'); return }

    try {
      const payload = {
        customer_id: selectedCustomer || undefined,
        items: cart.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          selling_price: i.selling_price,
        })),
        payment_method: paymentMethod,
        mpesa_reference: mpesaRef || undefined,
        discount_amount: discount,
        amount_paid: amountPaid,
      }
      const receipt = await createReceipt.mutateAsync(payload)
      toast.success(`Receipt ${receipt.receipt_number} created! Profit: ${fmt(receipt.total_profit)}`)
      navigate('/receipts')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to create receipt')
    }
  }

  return (
    <div>
      <PageHeader title="New Sale" subtitle="Choose a selling price for each item — it's set at the moment of sale" />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left: product search */}
        <div className="xl:col-span-2 space-y-4">
          {/* Customer selector */}
          <div className="card p-4">
            <label className="label">Customer (optional)</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="input"
            >
              <option value="">Walk-in Customer</option>
              {customers?.items?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} {c.phone ? `– ${c.phone}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Product search */}
          <div className="card p-4">
            <label className="label">Search & Add Products</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Type product name or SKU..."
                className="input pl-9"
              />
            </div>
            {productSearch && products?.items?.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto shadow-sm">
                {products.items.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 text-left transition-colors"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-400">
                        {p.quantity} {p.unit} in stock · cost {fmt(p.cost_price)}
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-blue-500" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="card">
            <div className="card-header">
              <h2 className="font-semibold text-gray-800">Cart Items — Set Selling Price</h2>
              <span className="badge-blue">{cart.length} items</span>
            </div>
            <div className="divide-y divide-gray-100">
              {cart.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No items in cart. Search for products above.</p>
                </div>
              )}
              {cart.map((item) => {
                const lineProfit = (item.selling_price - item.cost_price) * item.quantity
                return (
                  <div key={item.product_id} className="px-6 py-3 space-y-2">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800">{item.product_name}</div>
                        <div className="text-xs text-gray-400">Cost: {fmt(item.cost_price)} each</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.product_id, -1)}
                          className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-semibold text-sm">{item.quantity}</span>
                        <button onClick={() => updateQty(item.product_id, 1)}
                          className="w-7 h-7 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => removeItem(item.product_id)}
                        className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 pl-0">
                      <label className="text-xs text-gray-500 font-medium whitespace-nowrap">Selling price (KES):</label>
                      <input
                        type="number"
                        value={item.selling_price || ''}
                        onChange={(e) => updateSellingPrice(item.product_id, Number(e.target.value))}
                        placeholder="Enter price..."
                        min={0}
                        step="0.01"
                        className="input text-sm py-1 w-32"
                        autoFocus
                      />
                      <span className="text-sm font-semibold text-gray-700 ml-auto">
                        = {fmt(item.selling_price * item.quantity)}
                      </span>
                      {item.selling_price > 0 && (
                        <span className={`text-xs font-medium ${lineProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ({lineProfit >= 0 ? '+' : ''}{fmt(lineProfit)} profit)
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right: payment panel */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Payment</h2>

            {/* Payment method */}
            <div>
              <label className="label">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {(['cash', 'mpesa'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all capitalize ${
                      paymentMethod === m
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {m === 'mpesa' ? 'M-Pesa' : 'Cash'}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'mpesa' && (
              <div>
                <label className="label">M-Pesa Reference</label>
                <input
                  value={mpesaRef}
                  onChange={(e) => setMpesaRef(e.target.value)}
                  placeholder="QA12BC45..."
                  className="input"
                />
              </div>
            )}

            {/* Discount */}
            <div>
              <label className="label">Discount (KES)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                min={0}
                className="input"
              />
            </div>

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span><span>-{fmt(discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-gray-900 text-base border-t pt-2">
                <span>Total</span><span>{fmt(total)}</span>
              </div>
              {cart.length > 0 && (
                <div className="flex justify-between items-center text-xs pt-1 border-t">
                  <span className="flex items-center gap-1 text-gray-500">
                    <TrendingUp className="w-3 h-3" /> Estimated Profit
                  </span>
                  <span className={`font-semibold ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(estimatedProfit)}
                  </span>
                </div>
              )}
            </div>

            {/* Amount paid */}
            <div>
              <label className="label">Amount Received (KES)</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                min={0}
                className="input text-lg font-semibold"
              />
            </div>

            {amountPaid > 0 && (
              <div className={`flex justify-between font-semibold text-sm p-3 rounded-lg ${
                change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <span>{change >= 0 ? 'Change' : 'Balance Due'}</span>
                <span>{fmt(Math.abs(change))}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={createReceipt.isPending || cart.length === 0}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {createReceipt.isPending ? 'Processing...' : `Complete Sale – ${fmt(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
