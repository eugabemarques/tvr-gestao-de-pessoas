import { describe, expect, it } from "vitest";
import { dolar } from "../../componentes/GastoIA";

describe("formato do gasto", () => {
  it("valores pequenos com 4 casas", () => {
    expect(dolar(0.0042)).toBe("US$ 0,0042");
    expect(dolar(0)).toBe("US$ 0,00");
    expect(dolar(1.5)).toBe("US$ 1,50");
  });
});
