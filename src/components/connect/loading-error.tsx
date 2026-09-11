export function MatchingLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
      <div>
        <p className="font-medium text-neutral-900">Recherche en cours...</p>
        <p className="mt-1 max-w-xs text-sm text-neutral-500">
          On explore le répertoire et le web pour trouver des partenaires réels. Ça peut prendre
          jusqu&apos;à une minute selon la complexité du projet.
        </p>
      </div>
    </div>
  );
}

export function MatchingErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <div>
        <p className="font-medium text-red-800">Le matching a échoué</p>
        <p className="mt-1 max-w-sm text-sm text-red-700">{message}</p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
      >
        Réessayer
      </button>
    </div>
  );
}
