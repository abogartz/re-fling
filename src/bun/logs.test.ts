import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { addLog, getLogs, clearLogs, onLogsChange } from "./logs";

describe("bun/logs module", () => {
  beforeEach(() => {
    clearLogs();
  });

  afterEach(() => {
    clearLogs();
  });

  test("addLog appends timestamped message", () => {
    addLog("test message");
    const logs = getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] test message$/);
  });

  test("addLog appends multiple messages in order", () => {
    addLog("first");
    addLog("second");
    addLog("third");

    const logs = getLogs();
    expect(logs).toHaveLength(3);
    expect(logs[0]).toContain("first");
    expect(logs[1]).toContain("second");
    expect(logs[2]).toContain("third");
  });

  test("getLogs returns a copy (not same reference)", () => {
    addLog("test");
    const logs1 = getLogs();
    const logs2 = getLogs();

    expect(logs1).toEqual(logs2);
    expect(logs1).not.toBe(logs2);
  });

  test("clearLogs empties the log array", () => {
    addLog("message");
    clearLogs();

    expect(getLogs()).toHaveLength(0);
  });

  test("onLogsChange registers and fires listener", () => {
    let callCount = 0;
    const unsub = onLogsChange(() => {
      callCount++;
    });

    addLog("trigger");
    expect(callCount).toBe(1);

    unsub();
    addLog("after-unsub");
    // After unsubscribe, listener should not fire again
    expect(callCount).toBe(1);
  });

  test("onLogsChange supports multiple listeners", () => {
    let countA = 0;
    let countB = 0;

    const unsubA = onLogsChange(() => { countA++; });
    onLogsChange(() => { countB++; });

    addLog("msg1");
    expect(countA).toBe(1);
    expect(countB).toBe(1);

    unsubA();
    addLog("msg2");
    expect(countA).toBe(1); // unsubscribed
    expect(countB).toBe(2);
  });

  test("clearLogs fires listeners", () => {
    let callCount = 0;
    onLogsChange(() => { callCount++; });

    clearLogs();
    expect(callCount).toBe(1);
  });

  test("enforces MAX_LOGS cap at 1000", () => {
    for (let i = 0; i < 1500; i++) {
      addLog(`message-${i}`);
    }

    const logs = getLogs();
    expect(logs).toHaveLength(1000);
    // Should contain the last 1000 messages (indices 500-1499)
    expect(logs[0]).toContain("message-500");
    expect(logs[999]).toContain("message-1499");
  });

  test("handles special characters in messages", () => {
    addLog('message with "quotes" and <html>');
    const logs = getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('"quotes"');
    expect(logs[0]).toContain("<html>");
  });

  test("handles empty string message", () => {
    addLog("");
    const logs = getLogs();

    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] $/);
  });
});
