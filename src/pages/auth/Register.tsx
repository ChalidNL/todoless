import { Link } from 'react-router-dom'

export default function RegisterPage() {
  return (
    <div className="max-w-sm mx-auto p-4 text-center">
      <h1 className="text-xl font-semibold mb-4">Registration Disabled</h1>
      <p className="text-gray-600 mb-4">
        Public registration is disabled. To create an account, you need an invite code from an administrator.
      </p>
      <p className="text-gray-600 mb-4">
        If you have an invite code, please contact your administrator for the invite link.
      </p>
      <Link to="/auth/login" className="text-blue-600 hover:underline">
        Back to Login
      </Link>
    </div>
  )
}
