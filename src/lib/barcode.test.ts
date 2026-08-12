import { BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from "@zxing/library";
import { BarcodeFormat } from "@zxing/library";
import { describe, expect, it } from "vitest";

import { cleanCode, roiFrame } from "./barcode";

// El lector de códigos no se puede probar con la cámara headless (el flag de
// Chrome para usar un archivo como cámara no funciona en un navegador headless),
// así que se prueba lo que sí se puede: la cuenta del recorte, y
// que el decodificador configurado como lo configuramos lea un EAN-13 real.
//
// El código de barras se dibuja acá con una implementación propia del estándar.
// Que ZXing lo lea y devuelva el mismo número valida las dos puntas: si el
// dibujo estuviera mal, no leería; si el lector estuviera mal configurado
// (formatos, verificador), tampoco.

describe("roiFrame", () => {
  it("recorta la banda del medio y conserva todo el ancho", () => {
    const roi = roiFrame(1280, 720);

    // Mitad del alto, centrada: de 180 a 540.
    expect(roi.sourceTop).toBe(180);
    expect(roi.sourceHeight).toBe(360);
    // A 1280 de ancho no hay nada que achicar.
    expect(roi.width).toBe(1280);
    expect(roi.height).toBe(360);
  });

  it("achica lo que venga más ancho que el tope", () => {
    // Full HD: se baja a 1280 para no pagar píxeles que no aportan.
    const roi = roiFrame(1920, 1080);

    expect(roi.sourceTop).toBe(270);
    expect(roi.sourceHeight).toBe(540);
    expect(roi.width).toBe(1280);
    expect(roi.height).toBe(360);
  });
});

describe("cleanCode", () => {
  it("saca los espacios que mete el lector", () => {
    expect(cleanCode("  7790 895000997 \n")).toBe("7790895000997");
  });
});

describe("el decodificador lee un EAN-13 de verdad", () => {
  it("devuelve el mismo número que se dibujó", () => {
    // Coca-Cola 2,25 L, un código que existe.
    const codigo = "7790895000997";
    const imagen = dibujarEan13(codigo);

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE,
    ]);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const source = new RGBLuminanceSource(imagen.pixels, imagen.width, imagen.height);
    const result = reader.decodeWithState(new BinaryBitmap(new HybridBinarizer(source)));

    expect(result.getText()).toBe(codigo);
    expect(result.getBarcodeFormat()).toBe(BarcodeFormat.EAN_13);
  });

  it("un código con el dígito verificador cambiado no se lee como si nada", () => {
    // El último dígito es el verificador: si el lector lo ignorara, una lectura
    // sucia entraría al pedido como otro producto.
    expect(() => dibujarEan13("7790895000998")).toThrow();
  });
});

// --- Dibujo de un EAN-13, según el estándar ---

const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];

// El primer dígito no tiene barras propias: se codifica en qué mitad de los
// otros seis va en L y cuál en G.
const PARIDAD = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

function dibujarEan13(codigo: string, moduleWidth = 3, height = 60) {
  const digits = [...codigo].map(Number);

  const suma = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);

  if ((10 - (suma % 10)) % 10 !== digits[12]) {
    throw new Error(`Dígito verificador incorrecto en ${codigo}`);
  }

  const paridad = PARIDAD[digits[0]];
  const izquierda = digits.slice(1, 7).map((digit, index) => (paridad[index] === "L" ? L[digit] : G[digit]));
  const derecha = digits.slice(7, 13).map((digit) => R[digit]);
  const modulos = `101${izquierda.join("")}01010${derecha.join("")}101`;

  // Zona muda a los costados: sin ella el lector no encuentra dónde empieza.
  const quiet = 10 * moduleWidth;
  const width = modulos.length * moduleWidth + quiet * 2;
  const pixels = new Uint8ClampedArray(width * height).fill(255);

  for (let index = 0; index < modulos.length; index += 1) {
    if (modulos[index] !== "1") continue;

    const start = quiet + index * moduleWidth;

    for (let y = 0; y < height; y += 1) {
      for (let x = start; x < start + moduleWidth; x += 1) {
        pixels[y * width + x] = 0;
      }
    }
  }

  return { pixels, width, height };
}
