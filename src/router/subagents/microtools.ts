import { calculateBillSplit, formatSplitMessage } from "../../tools/math.js";
import { AgentResponse } from "../types.js";

export class MicroToolAgent {
  handleBillSplit(userText: string): AgentResponse {
    const start = Date.now();
    const clean = userText.trim().toLowerCase();
    const splitMatch = clean.match(
      /split\s+\$?(\d+(?:\.\d+)?)\s+(\d+)\s*(?:ways|people)?(?:\s*(?:with|plus|\+)?\s*(\d+)%?\s*tip)?/i
    );

    if (splitMatch) {
      const amount = parseFloat(splitMatch[1]);
      const count = parseInt(splitMatch[2], 10);
      const tip = splitMatch[3] ? parseFloat(splitMatch[3]) : 18;
      const res = calculateBillSplit(amount, count, tip);
      return {
        reply: formatSplitMessage(res),
        tapback: "like",
        intent: "MATH_SPLIT",
        modelUsed: "deterministic-math",
        latencyMs: Date.now() - start,
      };
    }

    const res = calculateBillSplit(100, 2, 20);
    return {
      reply: formatSplitMessage(res),
      tapback: "like",
      intent: "MATH_SPLIT",
      modelUsed: "deterministic-math",
      latencyMs: Date.now() - start,
    };
  }

  handleUnitConvert(userText: string): AgentResponse {
    const start = Date.now();
    const clean = userText.trim().toLowerCase();

    // 1. Currency Conversion
    const currMatch = clean.match(/(\d+(?:\.\d+)?)\s*(eur|usd|gbp|cad|aud|jpy|ngn)\s+(?:to|in)\s+(eur|usd|gbp|cad|aud|jpy|ngn)/i);
    if (currMatch) {
      const val = parseFloat(currMatch[1]);
      const from = currMatch[2].toUpperCase();
      const to = currMatch[3].toUpperCase();

      const ratesToUsd: Record<string, number> = {
        USD: 1.0,
        EUR: 1.08,
        GBP: 1.31,
        CAD: 0.74,
        AUD: 0.67,
        JPY: 0.0069,
        NGN: 0.00062,
      };

      if (ratesToUsd[from] && ratesToUsd[to]) {
        const usdVal = val * ratesToUsd[from];
        const converted = usdVal / ratesToUsd[to];
        const formatted = converted >= 1 ? converted.toFixed(2) : converted.toFixed(4);
        return {
          reply: `💱 CONVERSION:\n${val} ${from} = ${formatted} ${to}\n(Estimated market benchmark rate)`,
          tapback: "like",
          intent: "UNIT_CONVERT",
          modelUsed: "deterministic-converter",
          latencyMs: Date.now() - start,
        };
      }
    }

    // 2. Temperature: F to C or C to F
    const tempFtoC = clean.match(/(-?\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*f(?:ahrenheit)?\s+(?:to|in)\s+(?:°|deg|degrees)?\s*c(?:elsius)?/i);
    if (tempFtoC) {
      const f = parseFloat(tempFtoC[1]);
      const c = ((f - 32) * 5) / 9;
      return {
        reply: `🌡️ TEMPERATURE:\n${f}°F = ${c.toFixed(1)}°C`,
        tapback: "like",
        intent: "UNIT_CONVERT",
        modelUsed: "deterministic-converter",
        latencyMs: Date.now() - start,
      };
    }

    const tempCtoF = clean.match(/(-?\d+(?:\.\d+)?)\s*(?:°|deg|degrees)?\s*c(?:elsius)?\s+(?:to|in)\s+(?:°|deg|degrees)?\s*f(?:ahrenheit)?/i);
    if (tempCtoF) {
      const c = parseFloat(tempCtoF[1]);
      const f = (c * 9) / 5 + 32;
      return {
        reply: `🌡️ TEMPERATURE:\n${c}°C = ${f.toFixed(1)}°F`,
        tapback: "like",
        intent: "UNIT_CONVERT",
        modelUsed: "deterministic-converter",
        latencyMs: Date.now() - start,
      };
    }

    // 3. Weight: lbs <-> kg
    const lbsToKg = clean.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\s+(?:to|in)\s+(?:kg|kilos?|kilograms?)/i);
    if (lbsToKg) {
      const lbs = parseFloat(lbsToKg[1]);
      const kg = lbs * 0.453592;
      return {
        reply: `⚖️ WEIGHT:\n${lbs} lbs = ${kg.toFixed(2)} kg`,
        tapback: "like",
        intent: "UNIT_CONVERT",
        modelUsed: "deterministic-converter",
        latencyMs: Date.now() - start,
      };
    }

    const kgToLbs = clean.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kilograms?)\s+(?:to|in)\s+(?:lbs?|pounds?)/i);
    if (kgToLbs) {
      const kg = parseFloat(kgToLbs[1]);
      const lbs = kg * 2.20462;
      return {
        reply: `⚖️ WEIGHT:\n${kg} kg = ${lbs.toFixed(2)} lbs`,
        tapback: "like",
        intent: "UNIT_CONVERT",
        modelUsed: "deterministic-converter",
        latencyMs: Date.now() - start,
      };
    }

    // 4. Distance: miles <-> km
    const miToKm = clean.match(/(\d+(?:\.\d+)?)\s*miles?\s+(?:to|in)\s+(?:km|kilometers?)/i);
    if (miToKm) {
      const mi = parseFloat(miToKm[1]);
      const km = mi * 1.60934;
      return {
        reply: `📍 DISTANCE:\n${mi} miles = ${km.toFixed(2)} km`,
        tapback: "like",
        intent: "UNIT_CONVERT",
        modelUsed: "deterministic-converter",
        latencyMs: Date.now() - start,
      };
    }

    const kmToMi = clean.match(/(\d+(?:\.\d+)?)\s*(?:km|kilometers?)\s+(?:to|in)\s+miles?/i);
    if (kmToMi) {
      const km = parseFloat(kmToMi[1]);
      const mi = km * 0.621371;
      return {
        reply: `📍 DISTANCE:\n${km} km = ${mi.toFixed(2)} miles`,
        tapback: "like",
        intent: "UNIT_CONVERT",
        modelUsed: "deterministic-converter",
        latencyMs: Date.now() - start,
      };
    }

    // Fallback if not matched
    return {
      reply: `📏 I can convert currencies (USD, EUR, GBP, NGN), weights (lbs/kg), distances (miles/km), and temperatures (F/C)! Try: "50 EUR to USD" or "180 lbs in kg".`,
      tapback: "question",
      intent: "UNIT_CONVERT",
      modelUsed: "deterministic-converter",
      latencyMs: Date.now() - start,
    };
  }
}
