export const TODO_LINE = /^(\s*[-*]\s+\[)( |x|X)(\]\s+)(.*)$/;

export function extractTitle(contentMd: string): string {
  const firstLine =
    contentMd.split("\n").find((line) => line.trim() !== "") ?? "";
  const clean = firstLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+(\[( |x|X)\]\s+)?/, "")
    .replace(/[*_`~]/g, "")
    .trim();
  return clean || "Sin título";
}

export type ParsedTodo = { lineNo: number; text: string; done: boolean };

export function parseTodos(contentMd: string): ParsedTodo[] {
  return contentMd.split("\n").flatMap((line, i) => {
    const m = line.match(TODO_LINE);
    if (!m) return [];
    return [{ lineNo: i, text: m[4].trim(), done: m[2].toLowerCase() === "x" }];
  });
}

/** Marca/desmarca el todo de la línea `lineNo`. Devuelve el markdown nuevo o null si la línea ya no es un todo. */
export function setTodoDone(
  contentMd: string,
  lineNo: number,
  done: boolean
): string | null {
  const lines = contentMd.split("\n");
  const line = lines[lineNo];
  if (line === undefined) return null;
  const m = line.match(TODO_LINE);
  if (!m) return null;
  lines[lineNo] = `${m[1]}${done ? "x" : " "}${m[3]}${m[4]}`;
  return lines.join("\n");
}

export function daysLeft(updatedAt: string, lifetimeDays: number): number {
  const elapsedMs = Date.now() - new Date(updatedAt).getTime();
  const elapsedDays = Math.floor(elapsedMs / 86_400_000);
  return lifetimeDays - elapsedDays;
}
