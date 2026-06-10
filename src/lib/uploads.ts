export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function sanitizeStorageFileName(fileName: string) {
  const parts = fileName.split(".");
  const ext = parts.length > 1 ? parts.pop() : "bin";
  const base = parts.join(".") || "arquivo";
  const safeBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 90) || "arquivo";
  const safeExt = (ext || "bin").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "bin";
  return `${safeBase}.${safeExt}`;
}

export function assertUploadFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo acima de 20MB. Reduza o tamanho e tente novamente.");
  }
}

export function uploadErrorMessage(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error || "");
  if (/bucket not found/i.test(msg)) return "Pasta de upload não encontrada. Atualize a página e tente novamente.";
  if (/payload too large|too large|maximum/i.test(msg)) return "Arquivo muito grande. Envie um arquivo de até 20MB.";
  if (/row-level security|permission|not authorized|unauthorized/i.test(msg)) return "Sem permissão para enviar este arquivo. Verifique o vínculo do usuário com este cliente/demanda.";
  return msg || "Falha ao enviar arquivo";
}