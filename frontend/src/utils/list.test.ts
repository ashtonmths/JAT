import { afterEach, describe, expect, it } from "vitest";

import { i18n } from "../i18n";
import { joinList, joinSentences } from "./list";

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

describe("sentences shown one after another", () => {
  it("are joined with a space in English, leaving out the ones not shown", () => {
    expect(joinSentences("Was Tue 3 Nov.", "Set the new time.")).toBe("Was Tue 3 Nov. Set the new time.");
    expect(joinSentences("One call moved.", false, "That's 1 move.", "")).toBe(
      "One call moved. That's 1 move.",
    );
    expect(joinSentences("Only one.")).toBe("Only one.");
    expect(joinSentences(false, "")).toBe("");
  });

  it("are joined with nothing in Chinese, after 。", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(joinSentences("原定于 11月3日。", "在这里设定新时间。")).toBe(
      "原定于 11月3日。在这里设定新时间。",
    );
  });
});
