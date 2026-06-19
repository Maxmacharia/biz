import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useRegister } from '@/api/hooks'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui'

const schema = z.object({
  business_name: z.string().min(2, 'Business name required'),
  full_name: z.string().min(2, 'Full name required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})
type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const register_ = useRegister()

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    try {
      const { confirm_password, ...payload } = data
      const res = await register_.mutateAsync(payload)
      setAuth(res.user, res.access_token, res.refresh_token)
      toast.success('Business created successfully!')
      navigate('/')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">BizCore</h1>
          <p className="text-blue-200 text-sm mt-1">Start managing your business</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Create your business</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {[
              { field: 'business_name', label: 'Business Name', type: 'text', placeholder: 'Acme Ltd' },
              { field: 'full_name', label: 'Your Full Name', type: 'text', placeholder: 'Jane Wanjiku' },
              { field: 'email', label: 'Email Address', type: 'email', placeholder: 'jane@business.com' },
              { field: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
              { field: 'confirm_password', label: 'Confirm Password', type: 'password', placeholder: '••••••••' },
            ].map(({ field, label, type, placeholder }) => (
              <div key={field}>
                <label className="label">{label}</label>
                <input
                  {...register(field as keyof FormData)}
                  type={type}
                  placeholder={placeholder}
                  className="input"
                />
                {errors[field as keyof FormData] && (
                  <p className="text-xs text-red-500 mt-1">{errors[field as keyof FormData]?.message}</p>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={register_.isPending}
              className="btn-primary w-full justify-center py-2.5"
            >
              {register_.isPending ? <Spinner className="w-4 h-4" /> : 'Create Business'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
