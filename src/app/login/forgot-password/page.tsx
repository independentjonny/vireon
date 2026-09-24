import PasswordRecoveryForm from "../PasswordRecoveryForm";
export default function ForgotPasswordPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16"><section className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="text-sm font-semibold text-blue-700">Vireon</p>
    <h1 className="mt-3 text-2xl font-semibold text-slate-950">Reset your password</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Enter the email address you use for Vireon. We’ll email you a link to choose a new password.</p>
    <PasswordRecoveryForm mode="request" />
  </section></main>;
}
