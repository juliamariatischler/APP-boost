type StartupErrorProps = {
  error: unknown;
};

const getMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown startup error";
};

export const StartupError = ({ error }: StartupErrorProps) => (
  <div className="flex min-h-screen items-center justify-center bg-background px-6">
    <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-lg font-semibold">BoostSchule konnte nicht gestartet werden</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Die App-Konfiguration ist unvollständig. Pruefe die Release-Umgebung und die
        Supabase-Zugangsdaten fuer diesen Build.
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        {getMessage(error)}
      </pre>
    </div>
  </div>
);
