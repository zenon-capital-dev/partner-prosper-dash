import { supabase } from "@/integrations/supabase/client";

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
  const msg = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String((error as any).message)
      : String(error || "");
  if (/violates check constraint .*source/i.test(msg)) return "Origem do arquivo inválida. Atualize a página e tente de novo.";
  if (/bucket not found/i.test(msg)) return "Pasta de upload não encontrada. Atualize a página e tente novamente.";
  if (/payload too large|too large|maximum/i.test(msg)) return "Arquivo muito grande. Envie um arquivo de até 20MB.";
  if (/row-level security|permission|not authorized|unauthorized/i.test(msg)) return "Sem permissão para enviar este arquivo. Verifique o vínculo do usuário com este cliente/demanda.";
  return msg || "Falha ao enviar arquivo";
}

export async function uploadStorageFileFast(bucket: string, path: string, file: File, upsert = false) {
  assertUploadFile(file);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Faça login novamente.");

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${token}`,
        "content-type": file.type || "application/octet-stream",
        "x-upsert": upsert ? "true" : "false",
      },
      body: file,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || `Upload falhou (${response.status})`);
    }

    return response.json().catch(() => ({}));
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Upload demorou demais e foi cancelado. Tente novamente com um arquivo menor.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}