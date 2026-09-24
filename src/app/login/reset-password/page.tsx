import PasswordRecoveryForm from "../PasswordRecoveryForm";
export const metadata = { referrer: "no-referrer" as const, robots: { index: false, follow: false } };
export default function ResetPasswordPage() {
  return <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16"><section className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="text-sm font-semibold text-blue-700">Vireon</p>
    <h1 className="mt-3 text-2xl font-semibold text-slate-950">Choose a new password</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">After saving your new password, return to sign in.</p>
    <PasswordRecoveryForm mode="update" />
  </section></main>;
}
