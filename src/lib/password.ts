// Validação de senha — política unificada para evitar rejeição do backend por senha fraca/vazada.
export const PASSWORD_MIN_LENGTH = 8;

const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "senha123",
  "senha1234",
  "teste123",
  "teste1234",
  "teste@123",
  "teste@1234",
  "admin123",
  "admin1234",
  "qwerty123",
  "abc12345",
]);

export interface PasswordCheck {
  ok: boolean;
  errors: string[];
  score: 0 | 1 | 2 | 3 | 4; // força visual
}

export function validatePassword(pw: string): PasswordCheck {
  const errors: string[] = [];
  const normalized = pw.trim().toLowerCase();
  if (!pw || pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`);
  }
  if (!/[a-z]/.test(pw)) errors.push("Pelo menos 1 letra minúscula");
  if (!/[A-Z]/.test(pw)) errors.push("Pelo menos 1 letra maiúscula");
  if (!/\d/.test(pw)) errors.push("Pelo menos 1 número");
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push("Pelo menos 1 símbolo");
  if (COMMON_PASSWORDS.has(normalized) || /(.)\1{4,}/.test(pw) || /123456|abcdef|qwerty/i.test(pw)) {
    errors.push("Senha muito comum/fraca. Use a opção Gerar senha forte");
  }

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

// Gerador criptograficamente seguro (usa crypto.getRandomValues, não Math.random).
// Garante 1 maiúscula, 1 minúscula, 1 dígito e 1 símbolo.
export function generateSecurePassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  const randInt = (max: number) => {
    // Rejection sampling para evitar viés modular.
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    while (true) {
      crypto.getRandomValues(buf);
      if (buf[0] < limit) return buf[0] % max;
    }
  };
  const pick = (s: string) => s[randInt(s.length)];

  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = chars.length; i < Math.max(length, 8); i++) chars.push(pick(all));
  // Fisher–Yates seguro.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
