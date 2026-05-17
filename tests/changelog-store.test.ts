import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { ChangelogStore } from "../src/changelog/changelog-store";
import { unlinkSync, existsSync } from "fs";

const TEST_DB = '.agent/test-changelog.db';

describe("ChangelogStore", () => {
  let store: ChangelogStore;

  beforeAll(() => {
    store = new ChangelogStore(TEST_DB);
  });

  afterAll(() => {
    if (existsSync(TEST_DB)) {
      unlinkSync(TEST_DB);
    }
  });

  it("should create and retrieve an entry", async () => {
    const entry = await store.create({
      type: 'requirement',
      title: 'Test entry',
      description: 'A test changelog entry',
      trigger: 'manual',
    });

    expect(entry.id).toBeTruthy();
    expect(entry.type).toBe('requirement');
    expect(entry.title).toBe('Test entry');
    expect(entry.description).toBe('A test changelog entry');
    expect(entry.trigger).toBe('manual');
    expect(entry.createdAt).toBeTruthy();

    const retrieved = await store.get(entry.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(entry.id);
    expect(retrieved!.title).toBe('Test entry');
  });

  it("should return null for non-existent entry", async () => {
    const result = await store.get('non-existent-id');
    expect(result).toBeNull();
  });

  it("should list entries with pagination", async () => {
    for (let i = 0; i < 5; i++) {
      await store.create({
        type: 'optimization',
        title: `Optimization ${i}`,
        trigger: 'agent',
      });
    }

    const page1 = await store.list({ page: 1, pageSize: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.total).toBeGreaterThanOrEqual(5);

    const page2 = await store.list({ page: 2, pageSize: 2 });
    expect(page2.items.length).toBe(2);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });

  it("should filter entries by type", async () => {
    const result = await store.list({ type: 'bug' });
    expect(result.items.every(e => e.type === 'bug')).toBe(true);
  });

  it("should filter entries by trigger", async () => {
    const result = await store.list({ trigger: 'manual' });
    expect(result.items.every(e => e.trigger === 'manual')).toBe(true);
  });

  it("should filter by time range", async () => {
    const start = new Date(Date.now() - 86400000).toISOString();
    const end = new Date(Date.now() + 86400000).toISOString();

    const result = await store.list({ startTime: start, endTime: end });
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("should delete an entry", async () => {
    const entry = await store.create({
      type: 'bug',
      title: 'To be deleted',
      trigger: 'manual',
    });

    const deleted = await store.delete(entry.id);
    expect(deleted).toBe(true);

    const retrieved = await store.get(entry.id);
    expect(retrieved).toBeNull();
  });

  it("should return false when deleting non-existent entry", async () => {
    const result = await store.delete('non-existent-id');
    expect(result).toBe(false);
  });

  it("should track git scan time", async () => {
    const before = await store.getLastScanTime();
    expect(before).toBeNull();

    await store.updateScanTime();
    const after = await store.getLastScanTime();
    expect(after).not.toBeNull();
    expect(typeof after).toBe('string');
  });

  it("should bulk create entries and return count", async () => {
    const count = await store.bulkCreate([
      { type: 'requirement', title: 'Bulk 1', trigger: 'git', commitHash: 'abc123' },
      { type: 'optimization', title: 'Bulk 2', trigger: 'git', commitHash: 'def456' },
      { type: 'bug', title: 'Bulk 3', trigger: 'git', commitHash: 'ghi789' },
    ]);
    expect(count).toBe(3);
  });

  it("should handle commitHash field", async () => {
    const entry = await store.create({
      type: 'bug',
      title: 'Bug with commit',
      trigger: 'git',
      commitHash: 'a1b2c3d4',
    });

    expect(entry.commitHash).toBe('a1b2c3d4');

    const retrieved = await store.get(entry.id);
    expect(retrieved!.commitHash).toBe('a1b2c3d4');
  });
});
