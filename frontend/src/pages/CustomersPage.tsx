import { useState } from 'react'
import { Plus, Edit2, Map } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useCustomers, useCreateCustomer, useUpdateCustomer } from '@/api/hooks'
import {
  PageHeader, SearchInput, Modal, Field, PageLoader,
  EmptyState, Pagination, fmt,
} from '@/components/ui'

const schema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  business_type: z.string().optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [hasDebt, setHasDebt] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any>(null)

  const { data, isLoading } = useCustomers({ search, page, page_size: 20, has_debt: hasDebt || undefined })
  const create = useCreateCustomer()
  const update = useUpdateCustomer()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const openCreate = () => { setEditing(null); reset({}); setShowModal(true) }
  const openEdit = (c: any) => {
    setEditing(c)
    reset({ name: c.name, phone: c.phone, email: c.email, business_type: c.business_type,
      address: c.address, latitude: c.latitude, longitude: c.longitude, notes: c.notes })
    setShowModal(true)
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...data })
        toast.success('Customer updated')
      } else {
        await create.mutateAsync(data)
        toast.success('Customer added')
      }
      setShowModal(false)
    } catch { toast.error('Failed to save customer') }
  }

  if (isLoading && !data) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={`${data?.total || 0} total customers`}
        action={
          <div className="flex gap-2">
            <Link to="/customers/map" className="btn-secondary">
              <Map className="w-4 h-4" /> Map View
            </Link>
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Customer
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search customers..." />
        <button
          onClick={() => setHasDebt(!hasDebt)}
          className={`btn-sm ${hasDebt ? 'btn-primary' : 'btn-secondary'}`}
        >
          With Outstanding Debt
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Business Type</th>
              <th>Total Purchases</th>
              <th>Outstanding</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items?.map((c: any) => (
              <tr key={c.id}>
                <td>
                  <div className="font-medium text-gray-900">{c.name}</div>
                  {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                </td>
                <td className="text-sm">{c.phone || '—'}</td>
                <td>{c.business_type ? <span className="badge-blue">{c.business_type}</span> : '—'}</td>
                <td className="font-semibold text-green-600">{fmt(c.total_purchases)}</td>
                <td>
                  {c.outstanding_balance > 0 ? (
                    <span className="badge-red">{fmt(c.outstanding_balance)}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td>
                  {c.latitude && c.longitude ? (
                    <span className="badge-green text-xs">GPS ✓</span>
                  ) : (
                    <span className="text-gray-300 text-xs">No GPS</span>
                  )}
                </td>
                <td>
                  <button onClick={() => openEdit(c)} className="text-blue-500 hover:text-blue-700 p-1">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {!data?.items?.length && (
              <tr><td colSpan={7}><EmptyState title="No customers found" description="Add your first customer to get started." /></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={data?.pages || 1} onPage={setPage} />

      {/* Customer Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Full Name / Business Name" error={errors.name?.message}>
              <input {...register('name')} className="input" placeholder="John Kamau" />
            </Field>
          </div>
          <Field label="Phone Number">
            <input {...register('phone')} className="input" placeholder="+254 700 000000" />
          </Field>
          <Field label="Email (optional)" error={errors.email?.message}>
            <input {...register('email')} type="email" className="input" placeholder="customer@email.com" />
          </Field>
          <Field label="Business Type">
            <input {...register('business_type')} className="input" placeholder="Retail, Wholesale..." />
          </Field>
          <div />
          <div className="col-span-2">
            <Field label="Address">
              <input {...register('address')} className="input" placeholder="Nairobi, Kenya" />
            </Field>
          </div>
          <Field label="Latitude (GPS)">
            <input {...register('latitude')} type="number" step="any" className="input" placeholder="-1.286389" />
          </Field>
          <Field label="Longitude (GPS)">
            <input {...register('longitude')} type="number" step="any" className="input" placeholder="36.817223" />
          </Field>
          <div className="col-span-2">
            <Field label="Notes">
              <textarea {...register('notes')} className="input" rows={2} />
            </Field>
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={create.isPending || update.isPending} className="btn-primary">
              {editing ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
