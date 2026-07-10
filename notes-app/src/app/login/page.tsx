import { sendMagicLink } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight">Notas</h1>
        <p className="mt-2 text-sm text-muted">
          Ingresá tu email y te mandamos un enlace de acceso. Sin contraseñas.
        </p>

        {sp.sent ? (
          <div className="mt-8 rounded-lg border border-border bg-surface p-4 text-sm">
            <p className="font-medium">Revisá tu correo</p>
            <p className="mt-1 text-muted">
              Si tu email tiene acceso, vas a recibir un enlace para entrar.
              Expira en unos minutos.
            </p>
          </div>
        ) : (
          <form action={sendMagicLink} className="mt-8 flex flex-col gap-3">
            <input
              type="email"
              name="email"
              required
              autoFocus
              placeholder="tu@email.com"
              className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              Enviarme el enlace
            </button>
            {sp.error && (
              <p className="text-sm text-accent">
                {sp.error === "invalid"
                  ? "Ingresá un email válido."
                  : "No se pudo enviar el enlace. Probá de nuevo."}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
