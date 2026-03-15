import { getProvider, getProviderIds } from "../index";

describe("providers index", () => {
  it("getProviderIds returns openai and gemini", () => {
    const ids = getProviderIds();
    expect(ids).toContain("openai");
    expect(ids).toContain("gemini");
    expect(ids.length).toBe(2);
  });

  it("getProvider returns provider for openai", () => {
    const p = getProvider("openai");
    expect(p).toBeDefined();
    expect(p!.id).toBe("openai");
  });

  it("getProvider returns provider for gemini", () => {
    const p = getProvider("gemini");
    expect(p).toBeDefined();
    expect(p!.id).toBe("gemini");
  });

  it("getProvider returns undefined for unknown id", () => {
    expect(getProvider("unknown")).toBeUndefined();
  });
});
