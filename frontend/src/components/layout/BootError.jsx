/**
 * Plain full-page message for failures before the app can render, mainly missing .env values.
 * It imports nothing from the app on purpose: it must work when the rest of the code could not load.
 */
export function BootError({ error }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold text-gray-900">School Manager could not start</h1>
      <p className="rounded-lg bg-red-50 p-4 text-sm leading-relaxed text-red-800">{error.message}</p>
    </main>
  );
}
