import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setDbForTesting, StudyFlightDB } from "../db";
import { addSubjectSet, createSubject, DENTAL_SUBJECTS, setSubjectArchived } from "../subjects";

let n = 0;
let db: StudyFlightDB;
beforeEach(() => {
  db = new StudyFlightDB(`subjects-test-${++n}`);
  setDbForTesting(db);
});
afterEach(async () => {
  db.close();
  await db.delete();
});

describe("addSubjectSet", () => {
  it("歯学の科目を追加し、摂食嚥下は含めない", async () => {
    expect(DENTAL_SUBJECTS).toHaveLength(20);
    expect(DENTAL_SUBJECTS.some((s) => s.includes("摂食"))).toBe(false);
    expect(await addSubjectSet(DENTAL_SUBJECTS)).toBe(20);
    expect(await db.subjects.count()).toBe(20);
  });
  it("同名の科目は重複させず、アーカイブ済みは戻す", async () => {
    await createSubject("衛生学");
    const archived = await createSubject("口腔外科学");
    await setSubjectArchived(archived.id, true);
    expect(await addSubjectSet(DENTAL_SUBJECTS)).toBe(19); // 18 件追加 + 1 件復元
    const all = await db.subjects.toArray();
    expect(all).toHaveLength(20);
    expect(all.filter((s) => s.name === "衛生学")).toHaveLength(1);
    expect(all.find((s) => s.name === "口腔外科学")?.archivedAt).toBeNull();
    expect(await addSubjectSet(DENTAL_SUBJECTS)).toBe(0);
  });
});
