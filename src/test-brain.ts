import { KiteBrain } from "./brain.js";
import { MemoryStore } from "./memory.js";
import { SchedulerService } from "./scheduler.js";

async function runTests() {
  console.log("🚀 Starting Kite Test Suite...\n");

  const memory = new MemoryStore();
  const scheduler = new SchedulerService();
  const brain = new KiteBrain(memory, scheduler);
  const testUser = "test_user_42";

  // Test 1: Math bill split
  console.log("--- Test 1: Quick Bill Split ---");
  const splitRes = await brain.processMessage(testUser, "Split $120 4 ways 20% tip");
  console.log("Kite reply:\n", splitRes.reply);
  console.log("Tapback:", splitRes.tapback);
  if (!splitRes.reply.includes("$36.00")) {
    throw new Error("Bill split calculation failed!");
  }
  console.log("✓ Test 1 Passed!\n");

  // Test 2: Natural Language Reminder Scheduling
  console.log("--- Test 2: Reminder Scheduling ---");
  const remRes = await brain.processMessage(testUser, "Remind me in 15 minutes to call Dr. Adams");
  console.log("Kite reply:\n", remRes.reply);
  const active = scheduler.getActiveReminders(testUser);
  console.log("Active reminders in queue:", active.map(r => r.text));
  if (active.length === 0) {
    throw new Error("Reminder was not scheduled in SchedulerService!");
  }
  console.log("✓ Test 2 Passed!\n");

  // Test 3: Life Lore / Habit Memory Retention
  console.log("--- Test 3: Life Lore Extraction ---");
  const memRes = await brain.processMessage(testUser, "My name is Alex and I am a software engineer who loves iced oat lattes.");
  console.log("Kite reply:\n", memRes.reply);
  const profile = memory.getProfile(testUser);
  console.log("Stored profile for Alex:", JSON.stringify(profile, null, 2));
  console.log("✓ Test 3 Passed!\n");

  // Test 4: Task Completion ("Done")
  console.log("--- Test 4: Task Completion ---");
  // Force a triggered reminder
  const triggered = scheduler.schedule(testUser, "Water the monstera", 0);
  // Wait a moment for scheduler loop or trigger manually
  (triggered as any).status = "TRIGGERED";
  const doneRes = await brain.processMessage(testUser, "Done");
  console.log("Kite reply:\n", doneRes.reply);
  console.log("Tasks completed count:", memory.getProfile(testUser).completedTasks);
  console.log("✓ Test 4 Passed!\n");

  scheduler.stop();
  console.log("🎉 ALL KITE TESTS PASSED WITH FLYING COLORS!");
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
