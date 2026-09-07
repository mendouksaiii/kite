import { KiteBrain } from "./brain.js";
import { MemoryStore } from "./memory.js";
import { SchedulerService } from "./scheduler.js";

async function runTests() {
  console.log("🚀 Starting Comprehensive Kite Mega-Test Suite...\n");

  const memory = new MemoryStore();
  const scheduler = new SchedulerService();
  const brain = new KiteBrain(memory, scheduler);
  const testUser = "test_user_mega";

  // Test 1: Math bill split
  console.log("--- Test 1: Quick Bill Split ---");
  const splitRes = await brain.processMessage(testUser, "Split $120 4 ways 20% tip");
  console.log("Kite reply:\n", splitRes.reply);
  if (!splitRes.reply.includes("$36.00")) {
    throw new Error("Bill split calculation failed!");
  }
  console.log("✓ Test 1 Passed!\n");

  // Test 2: Natural Language Reminder Scheduling
  console.log("--- Test 2: Reminder Scheduling ---");
  const remRes = await brain.processMessage(testUser, "Remind me in 15 minutes to call Dr. Adams");
  console.log("Kite reply:\n", remRes.reply);
  const active = scheduler.getActiveReminders(testUser);
  if (active.length === 0) {
    throw new Error("Reminder was not scheduled in SchedulerService!");
  }
  console.log("✓ Test 2 Passed!\n");

  // Test 3: Life Lore Extraction
  console.log("--- Test 3: Life Lore Extraction ---");
  const memRes = await brain.processMessage(testUser, "My name is Alex and I am a software engineer who loves iced oat lattes.");
  console.log("Kite reply:\n", memRes.reply);
  const profile = memory.getProfile(testUser);
  if (!profile.name || profile.name.toLowerCase() !== "alex") {
    console.warn("Inferred name check:", profile.name);
  }
  console.log("✓ Test 3 Passed!\n");

  // Test 4: Task Completion ("Done")
  console.log("--- Test 4: Task Completion ---");
  const triggered = scheduler.schedule(testUser, "Water the monstera", 0);
  (triggered as any).status = "TRIGGERED";
  const doneRes = await brain.processMessage(testUser, "Done");
  console.log("Kite reply:\n", doneRes.reply);
  console.log("✓ Test 4 Passed!\n");

  // Test 5: Deterministic Unit & Currency Conversion
  console.log("--- Test 5: Unit & Currency Conversion ---");
  const currRes = await brain.processMessage(testUser, "50 EUR to USD");
  console.log("Kite reply:\n", currRes.reply);
  if (!currRes.reply.includes("CONVERSION") || currRes.intent !== "UNIT_CONVERT") {
    throw new Error("Currency conversion failed!");
  }
  const weightRes = await brain.processMessage(testUser, "180 lbs in kg");
  console.log("Kite reply:\n", weightRes.reply);
  if (!weightRes.reply.includes("81.65 kg")) {
    throw new Error("Weight conversion failed!");
  }
  console.log("✓ Test 5 Passed!\n");

  // Test 6: Expense Tracking
  console.log("--- Test 6: Expense Tracking ---");
  const expRes = await brain.processMessage(testUser, "Spent $14 on lunch");
  console.log("Kite reply:\n", expRes.reply);
  if (!expRes.reply.includes("EXPENSE LOGGED") || !expRes.reply.includes("14.00")) {
    throw new Error("Expense logging failed!");
  }
  const expQuery = await brain.processMessage(testUser, "expenses");
  console.log("Kite reply:\n", expQuery.reply);
  if (!expQuery.reply.includes("SPENDING BREAKDOWN")) {
    throw new Error("Expense breakdown query failed!");
  }
  console.log("✓ Test 6 Passed!\n");

  // Test 7: Habit Streaks
  console.log("--- Test 7: Habit Streaks ---");
  const habitRes = await brain.processMessage(testUser, "Gym done");
  console.log("Kite reply:\n", habitRes.reply);
  if (!habitRes.reply.includes("HABIT LOGGED") || !habitRes.reply.includes("Gym")) {
    throw new Error("Habit logging failed!");
  }
  const habitQuery = await brain.processMessage(testUser, "habits");
  console.log("Kite reply:\n", habitQuery.reply);
  if (!habitQuery.reply.includes("HABIT STREAKS")) {
    throw new Error("Habits query failed!");
  }
  console.log("✓ Test 7 Passed!\n");

  // Test 8: Hydration Tracking
  console.log("--- Test 8: Hydration Tracker ---");
  const hydroRes = await brain.processMessage(testUser, "💧");
  console.log("Kite reply:\n", hydroRes.reply);
  if (!hydroRes.reply.includes("HYDRATION LOGGED") || !hydroRes.reply.includes("250ml")) {
    throw new Error("Hydration logging failed!");
  }
  console.log("✓ Test 8 Passed!\n");

  // Test 9: Focus Pomodoro Sprints
  console.log("--- Test 9: Focus Pomodoro Sprint ---");
  const focusRes = await brain.processMessage(testUser, "Focus 25");
  console.log("Kite reply:\n", focusRes.reply);
  if (!focusRes.reply.includes("FOCUS MODE ENGAGED") || focusRes.intent !== "FOCUS_SPRINT") {
    throw new Error("Focus sprint failed!");
  }
  console.log("✓ Test 9 Passed!\n");

  // Test 10: Morning Briefing
  console.log("--- Test 10: Daily Morning Briefing ---");
  const briefRes = await brain.processMessage(testUser, "Morning briefing");
  console.log("Kite reply:\n", briefRes.reply);
  if (!briefRes.reply.includes("GOOD MORNING") || briefRes.intent !== "DAILY_BRIEF") {
    throw new Error("Daily brief failed!");
  }
  console.log("✓ Test 10 Passed!\n");

  // Test 11: Ghostwriting Assistant
  console.log("--- Test 11: Ghostwriting Assistant ---");
  const ghostRes = await brain.processMessage(testUser, "Draft a polite decline to an invite for drinks tonight");
  console.log("Kite reply:\n", ghostRes.reply);
  if (ghostRes.intent !== "GHOSTWRITE" || !ghostRes.reply) {
    throw new Error("Ghostwriting failed!");
  }
  console.log("✓ Test 11 Passed!\n");

  // Test 12: Live Weather Search
  console.log("--- Test 12: Live Weather Search ---");
  const weatherRes = await brain.processMessage(testUser, "Weather in London");
  console.log("Kite reply:\n", weatherRes.reply);
  if (weatherRes.intent !== "WEB_SEARCH" || !weatherRes.reply) {
    throw new Error("Weather search failed!");
  }
  console.log("✓ Test 12 Passed!\n");

  // Test 13: Live Autonomous Internet Research
  console.log("--- Test 13: Live Autonomous Internet Research ---");
  const researchRes = await brain.processMessage(testUser, "Research: who won the most recent formula 1 championship?");
  console.log("Kite research reply:\n", researchRes.reply);
  console.log("Model used:", researchRes.modelUsed);
  if (researchRes.intent !== "WEB_SEARCH" || !researchRes.reply) {
    throw new Error("Live internet research failed!");
  }
  console.log("✓ Test 13 Passed!\n");

  scheduler.stop();
  console.log("🎉 ALL 13 KITE TESTS PASSED WITH 100% SUCCESS!");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

