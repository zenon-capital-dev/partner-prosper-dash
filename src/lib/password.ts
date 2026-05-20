// Validação de senha — política unificada: mínimo 8 caracteres, 1 letra e 1 número.
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordCheck {
  ok: boolean;
  errors: string[];
  score: 0 | 1 | 2 | 3 | 4; // força visual
}

export function validatePassword(pw: string): PasswordCheck {
  const errors: string[] = [];
  if (!pw || pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`);
  }
  if (!/[A-Za-z]/.test(pw)) errors.push("Pelo menos 1 letra");
  if (!/\d/.test(pw)) errors.push("Pelo menos 1 número");

  let score = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  return { ok: errors.length === 0, errors, score: score as PasswordCheck["score"] };
}

export function passwordStrengthLabel(score: number): string {
  if (score <= 1) return "Fraca";
  if (score === 2) return "Razoável";
  if (score === 3) return "Boa";
  return "Forte";
}
