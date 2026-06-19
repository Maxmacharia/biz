import { useState } from 'react'
import { Plus, Package, AlertTriangle, Edit2, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  useProducts, useCreateProduct, useUpdateProduct,
  useDeleteProduct, useInventorySummary,
} from '@/api/hooks'
import {
  PageHeader, SearchInput, Modal, Field, StatCard,
  PageLoader, EmptyState, Pagination, fmt,
} from '@/components/ui'

// NOTE: No selling_price field anywhere in this form. Inventory only
// records stock ACQUISITION (cost_price). Selling price is chosen later,
// at the moment of sale, on the receipt/invoice screen — because market
// prices, negotiation, and promotions mean it changes constantly.
const schema = z.object({
  name: z.string().min(1, 'Required'),
  sku: z.string().optional(),
  category: z.string().optional(),
  quantity: z.coerce.number().int().min(0),
  low_stock_threshold: z.coerce.number().int().min(0).default(10),
  cost_price: z.coerce.number().positive('Required'),
  unit: z.string().default('pcs'),
  description: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function InventoryPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [lowStockOnly, setLowStockOnly] = useState(false)

  const { data, isLoading } = useProducts({ search, page, page_size: 20, low_stock: lowStockOnly || undefined })
  const { data: summary } = useInventorySummary()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const del = useDeleteProduct()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const openCreate = () => { setEditing(null); reset({}); setShowModal(true) }
  const openEdit = (p: any) => {
    setEditing(p)
    reset({ name: p.name, sku: p.sku, category: p.category, quantity: p.quantity,
      low_stock_threshold: p.low_stock_threshold, cost_price: p.cost_price,
      unit: p.unit, description: p.description })
    setShowModal(true)
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...data })
        toast.success('Product updated')
      } else {
        await create.mutateAsync(data)
        toast.success('Product stocked')
      }
      setShowModal(false)
    } catch { toast.error('Failed to save product') }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return
    try { await del.mutateAsync(id); toast.success('Product deleted') }
    catch { toast.error('Failed to delete') }
  }

  if (isLoading && !data) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Stock acquisition only — selling prices are set at the point of sale"
        action={
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Stock Product
          </button>
        }
      />

      {/* Summary cards — note: no "expected profit" here, since selling
          price isn't known until the moment of sale. */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatCard label="Total Products" value={String(summary.total_products)}
            icon={<Package className="w-6 h-6 text-blue-600" />} color="bg-blue-50" />
          <StatCard label="Stock Value (at cost)" value={fmt(summary.total_stock_value)}
            icon={<Package className="w-6 h-6 text-green-600" />} color="bg-green-50" />
          <StatCard label="Low Stock" value={String(summary.low_stock_count)}
            icon={<AlertTriangle className="w-6 h-6 text-amber-600" />} color="bg-amber-50" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search products..." />
        <button
          onClick={() => setLowStockOnly(!lowStockOnly)}
          className={`btn-sm ${lowStockOnly ? 'btn-primary' : 'btn-secondary'}`}
        >
          <AlertTriangle className="w-3 h-3" /> Low Stock Only
        </button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Cost Price</th>
              <th>Stock Value</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((p: any) => (
              <tr key={p.id}>
                <td>
                  <div className="font-medium text-gray-900">{p.name}</div>
                  {p.sku && <div className="text-xs text-gray-400">SKU: {p.sku}</div>}
                </td>
                <td><span className="badge-gray">{p.category || '—'}</span></td>
                <td>
                  <span className={`font-semibold ${p.is_low_stock ? 'text-red-600' : 'text-gray-800'}`}>
                    {p.quantity} {p.unit}
                  </span>
                </td>
                <td>{fmt(p.cost_price)}</td>
                <td>{fmt(p.stock_value)}</td>
                <td>
                  {p.quantity === 0
                    ? <span className="badge-red">Out of stock</span>
                    : p.is_low_stock
                    ? <span className="badge-yellow">Low stock</span>
                    : <span className="badge-green">In stock</span>}
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-700 p-1">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!data?.items?.length && (
              <tr><td colSpan={7}><EmptyState title="No products found" description="Stock your first product to get started." /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />

      {/* Product Modal — cost price only, no selling price */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Edit Product' : 'Stock Product'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Product Name" error={errors.name?.message}>
              <input {...register('name')} className="input" placeholder="Product name" />
            </Field>
          </div>
          <Field label="SKU (optional)" error={errors.sku?.message}>
            <input {...register('sku')} className="input" placeholder="SKU-001" />
          </Field>
          <Field label="Category">
            <input {...register('category')} className="input" placeholder="Electronics, Food..." />
          </Field>
          <Field label="Cost Price (KES)" error={errors.cost_price?.message}>
            <input {...register('cost_price')} type="number" step="0.01" className="input" placeholder="0.00" />
          </Field>
          <Field label="Quantity" error={errors.quantity?.message}>
            <input {...register('quantity')} type="number" className="input" placeholder="0" />
          </Field>
          <Field label="Low Stock Threshold">
            <input {...register('low_stock_threshold')} type="number" className="input" placeholder="10" />
          </Field>
          <Field label="Unit">
            <input {...register('unit')} className="input" placeholder="pcs, kg, litres..." />
          </Field>
          <div className="col-span-2">
            <Field label="Description (optional)">
              <textarea {...register('description')} className="input" rows={2} />
            </Field>
          </div>
          <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            💡 Selling price isn't set here — you'll choose it when you create a receipt or invoice, since prices change with the market.
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending} className="btn-primary">
              {editing ? 'Save Changes' : 'Stock Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
