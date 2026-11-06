import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "../i18n";
import { joinList } from "./list";

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("a list the app builds", () => {
  it("is joined with a comma and a space in English", () => {
    expect(joinList(["Alex Morgan", "Sam Patel", "Jordan Lee"])).toBe("Alex Morgan, Sam Patel, Jordan Lee");
    expect(joinList(["Alex Morgan"])).toBe("Alex Morgan");
    expect(joinList([])).toBe("");
  });

  it("uses the language's own separator: 、 with no space in Chinese", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(joinList(["Alex Morgan", "Sam Patel"])).toBe("Alex Morgan、Sam Patel");
  });
});
