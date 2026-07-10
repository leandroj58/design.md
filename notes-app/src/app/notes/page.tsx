import { createNote } from "./actions";

export default function NotesHome() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-muted">
        Elegí una nota de la lista o empezá una nueva.
      </p>
      <form action={createNote}>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Nueva nota
        </button>
      </form>
    </div>
  );
}
