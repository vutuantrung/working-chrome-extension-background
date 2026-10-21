import { describe, expect, it } from "vitest";
import {
  decodeHtmlEntities,
  isLikelyPlaceholderFacebookName,
  parseFacebookNameFromHtml,
  readTrimmedString,
  isSupportedPlatformUrl,
} from "../../entrypoints/background/utils/tools";

describe("existing background helpers", () => {
  it("normalizes strings and finite numbers", () => {
    expect(readTrimmedString("  hello  ")).toBe("hello");
    expect(readTrimmedString(42)).toBe("42");
    expect(readTrimmedString(null)).toBe("");
  });

  it("decodes common HTML entities", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry &lt;3")).toBe("Tom & Jerry <3");
  });

  it("extracts a Facebook name from Open Graph metadata", () => {
    expect(parseFacebookNameFromHtml('<meta property="og:title" content="Alice &amp; Bob">')).toBe("Alice & Bob");
  });

  it("rejects placeholder names", () => {
    expect(isLikelyPlaceholderFacebookName("Facebook")).toBe(true);
    expect(parseFacebookNameFromHtml("<title>Facebook</title>")).toBe("");
  });

  it("recognizes supported social network URLs", () => {
    expect(isSupportedPlatformUrl("https://www.facebook.com/example")).toBe(true);
    expect(isSupportedPlatformUrl("https://x.com/example")).toBe(true);
    expect(isSupportedPlatformUrl("https://example.org/")).toBe(false);
  });
});
