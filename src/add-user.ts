import { config } from "./config.js";

async function addUser() {
  const phone = process.argv[2];
  const name = process.argv[3] || "Kite Friend";

  if (!phone) {
    console.log(`
Usage: npm run add-friend <phone_number> [name]
Example: npm run add-friend +14155552671 "Alice"
    `);
    process.exit(1);
  }

  const formatted = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
  console.log(`Adding ${formatted} (${name}) to Kite Photon project...`);

  const authHeader = "Basic " + Buffer.from(`${config.spectrum.projectId}:${config.spectrum.projectSecret}`).toString("base64");

  try {
    const res = await fetch(
      `https://spectrum.photon.codes/projects/${config.spectrum.projectId}/users/`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "shared",
          phoneNumber: formatted,
          firstName: name,
        }),
      }
    );

    const data = (await res.json()) as any;
    if (res.ok && data.succeed) {
      console.log(`\n🎉 Success! ${name} (${formatted}) is authorized to message Kite on iMessage.`);
      console.log(`👉 Send your first iMessage to: ${data.data?.assignedPhoneNumber || "+1 (415) 595-2354"}\n`);
    } else {
      console.error(`❌ Error:`, data?.message || data);
    }
  } catch (err) {
    console.error("Network error:", err);
  }
}

addUser();
