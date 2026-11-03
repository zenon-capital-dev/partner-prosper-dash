import { describe, it, expect } from "vitest";
import { buildZip, crc32, uniqueZipNames } from "@/lib/zip";

describe("zip", () => {
  it("calcula CRC32 padrão", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("evita nomes repetidos", () => {
    expect(uniqueZipNames(["a.pdf", "A.pdf", "b", "a.pdf", "x/y.pdf"])).toEqual(["a.pdf", "A (2).pdf", "b", "a (3).pdf", "x_y.pdf"]);
  });

  it("gera zip com assinaturas e contagem corretas", () => {
    const enc = new TextEncoder();
    const zip = buildZip([
      { name: "Certidão.pdf", data: enc.encode("um") },
      { name: "b.txt", data: enc.encode("dois") },
    ]);
    const v = new DataView(zip.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const end = zip.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
  });
});
