import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Users, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { useBusiness } from '@/api/hooks'
import api from '@/api/client'
import { PageHeader, Field, PageLoader } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'

const bizSchema = z.object({
  name: z.string().min(1, 'Required'),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  description: z.string().optional(),
})
type BizForm = z.infer<typeof bizSchema>

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'business' | 'team' | 'security'>('business')
  const { data: business, isLoading, refetch } = useBusiness()
  const { user } = useAuthStore()

  const { register, handleSubmit, formState: { errors } } = useForm<BizForm>({
    resolver: zodResolver(bizSchema),
    values: business ? {
      name: business.name,
      phone: business.phone || '',
      email: business.email || '',
      address: business.address || '',
      description: business.description || '',
    } : undefined,
  })

  const onBizSubmit = async (data: BizForm) => {
    try {
      await api.patch('/businesses/me', data)
      toast.success('Business settings saved')
      refetch()
    } catch { toast.error('Failed to save') }
  }

  if (isLoading) return <PageLoader />

  const tabs = [
    { id: 'business', label: 'Business', icon: Building2 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
  ]

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your business settings" />

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'business' && (
        <div className="card max-w-xl">
          <div className="card-header"><h2 className="font-semibold">Business Information</h2></div>
          <div className="card-body">
            <form onSubmit={handleSubmit(onBizSubmit)} className="space-y-4">
              <Field label="Business Name" error={errors.name?.message}>
                <input {...register('name')} className="input" />
              </Field>
              <Field label="Phone">
                <input {...register('phone')} className="input" placeholder="+254 700 000000" />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <input {...register('email')} type="email" className="input" />
              </Field>
              <Field label="Address">
                <input {...register('address')} className="input" placeholder="Nairobi, Kenya" />
              </Field>
              <Field label="Description">
                <textarea {...register('description')} className="input" rows={3} />
              </Field>
              <div className="pt-2">
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <TeamSettings />
      )}

      {activeTab === 'security' && (
        <div className="card max-w-xl">
          <div className="card-header"><h2 className="font-semibold">Account Security</h2></div>
          <div className="card-body space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <strong>Logged in as:</strong> {user?.email}
            </div>
            <div>
              <div className="font-medium text-sm text-gray-700 mb-1">Role</div>
              <span className="badge-blue capitalize">{user?.role}</span>
            </div>
            <div>
              <div className="font-medium text-sm text-gray-700 mb-1">Business ID</div>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded">{user?.business_id}</code>
            </div>
            <hr />
            <ChangePasswordForm />
          </div>
        </div>
      )}
    </div>
  )
}

function TeamSettings() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'salesperson' })

  const loadUsers = async () => {
    if (users.length > 0) return
    setLoading(true)
    try {
      const res = await api.get('/users/')
      setUsers(res.data)
    } catch { toast.error('Failed to load team') }
    setLoading(false)
  }

  useState(() => { loadUsers() })

  const handleInvite = async () => {
    try {
      const res = await api.post('/users/', form)
      setUsers([...users, res.data])
      toast.success(`${form.full_name} added to team`)
      setShowInvite(false)
      setForm({ email: '', full_name: '', password: '', role: 'salesperson' })
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add user')
    }
  }

  return (
    <div className="card max-w-2xl">
      <div className="card-header">
        <h2 className="font-semibold">Team Members</h2>
        <button onClick={() => setShowInvite(!showInvite)} className="btn-primary btn-sm">+ Add Member</button>
      </div>
      {showInvite && (
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 grid grid-cols-2 gap-3">
          <input placeholder="Full Name" value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input text-sm" />
          <input placeholder="Email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} className="input text-sm" />
          <input placeholder="Temporary Password" type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} className="input text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="input text-sm">
            <option value="salesperson">Salesperson</option>
            <option value="accountant">Accountant</option>
            <option value="manager">Manager</option>
          </select>
          <button onClick={handleInvite} className="btn-primary btn-sm col-span-2 justify-center">Add to Team</button>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {loading && <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>}
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-4 px-6 py-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">
              {u.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-800">{u.full_name}</div>
              <div className="text-xs text-gray-400">{u.email}</div>
            </div>
            <span className="badge-blue capitalize">{u.role}</span>
            <span className={u.is_active ? 'badge-green' : 'badge-red'}>
              {u.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const pwSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'Min 8 chars'),
  confirm: z.string(),
}).refine((d) => d.new_password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })

function ChangePasswordForm() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(pwSchema),
  })

  const onSubmit = async () => {
    toast.success('Password change coming soon (implement via /auth/change-password endpoint)')
    reset()
  }

  return (
    <div>
      <div className="font-medium text-sm text-gray-700 mb-3">Change Password</div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field label="Current Password" error={errors.current_password?.message as string}>
          <input {...register('current_password')} type="password" className="input" />
        </Field>
        <Field label="New Password" error={errors.new_password?.message as string}>
          <input {...register('new_password')} type="password" className="input" />
        </Field>
        <Field label="Confirm New Password" error={errors.confirm?.message as string}>
          <input {...register('confirm')} type="password" className="input" />
        </Field>
        <button type="submit" className="btn-secondary btn-sm">Update Password</button>
      </form>
    </div>
  )
}
