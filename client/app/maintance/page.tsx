export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-sky-100 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-xl p-8 text-center">
        
        {/* Logo / Brand */}
        <div className="mb-4 text-xl font-bold tracking-wide text-slate-800">
          Country <span className="text-sky-600">Home</span>
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-1.5 text-sm font-semibold text-sky-700 mb-6">
          🚧 Under Maintenance
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-slate-900 mb-3">
          We’ll be back shortly
        </h1>

        {/* Message */}
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          We are currently performing scheduled maintenance to improve performance
          and stability. Please check back again in a little while.
        </p>

        {/* Divider */}
        <div className="h-px bg-slate-200 my-6" />

        {/* Footer */}
        <p className="text-xs text-slate-500">
          Thank you for your patience.<br />
          <span className="font-semibold text-slate-700">
            – mechkart Team
          </span>
        </p>
      </div>
    </div>
  );
}
