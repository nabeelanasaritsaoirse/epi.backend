/**
 * Test Script: Verify Admin Registration Approval Fix
 *
 * Tests the parallel save bug fix for approving registration requests
 * where the user's email already exists as a regular user.
 *
 * Usage: node scripts/testApprovalFix.js
 */

const BASE_URL = "http://13.127.15.87:8080/api";

const ADMIN_CREDS = {
  email: "admin@epi.com",
  password: "@Saoirse123",
};

const REQUEST_ID = "69807e4cfa76aaaff6b23276";

async function main() {
  console.log("=== Admin Registration Approval Fix Test ===\n");

  // Step 1: Login as admin
  console.log("Step 1: Logging in as admin...");
  let token;
  try {
    const loginRes = await fetch(`${BASE_URL}/admin-auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ADMIN_CREDS),
    });
    const loginData = await loginRes.json();

    if (!loginData.success) {
      console.error("Login failed:", loginData.message);
      process.exit(1);
    }

    token = loginData.data.accessToken;
    console.log("  Login successful. User ID:", loginData.data.userId);
    console.log("  Role:", loginData.data.role);
    console.log("  All Roles:", loginData.data.allRoles);
    console.log();
  } catch (err) {
    console.error("Login request failed:", err.message);
    process.exit(1);
  }

  // Step 2: Check the registration request status
  console.log("Step 2: Checking registration request status...");
  try {
    const reqRes = await fetch(
      `${BASE_URL}/admin-mgmt/registration-requests`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const reqData = await reqRes.json();

    if (reqData.success && reqData.data) {
      const target = reqData.data.find((r) => r._id === REQUEST_ID);
      if (target) {
        console.log("  Request found:");
        console.log("    ID:", target._id);
        console.log("    Email:", target.email);
        console.log("    Name:", target.name);
        console.log("    Status:", target.status);

        if (target.status !== "pending") {
          console.log(
            `\n  Request is already "${target.status}". Cannot approve again.`
          );
          console.log(
            "  If you need to re-test, create a new registration request."
          );
          process.exit(0);
        }
      } else {
        console.log("  Request ID not found in list. Proceeding anyway...");
      }
    }
    console.log();
  } catch (err) {
    console.log("  Could not fetch requests list:", err.message);
    console.log("  Proceeding with approval attempt anyway...\n");
  }

  // Step 3: Try to approve the registration request
  console.log("Step 3: Approving registration request", REQUEST_ID, "...");
  try {
    const approveRes = await fetch(
      `${BASE_URL}/admin-mgmt/registration-requests/${REQUEST_ID}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          moduleAccess: ["dashboard", "products", "orders", "users"],
        }),
      }
    );

    const approveData = await approveRes.json();

    console.log("  HTTP Status:", approveRes.status);
    console.log("  Response:", JSON.stringify(approveData, null, 2));
    console.log();

    if (approveData.success) {
      console.log("=== FIX VERIFIED: Approval succeeded! ===");
      console.log("  Admin ID:", approveData.data?.adminId);
      console.log("  Email:", approveData.data?.email);
      console.log("  Is Promoted User:", approveData.data?.isPromotedUser);
      console.log("  Roles:", approveData.data?.additionalRoles);
    } else {
      console.log("=== FIX NOT WORKING: Approval still failing ===");
      console.log("  Error:", approveData.error || approveData.message);

      if (
        approveData.error &&
        approveData.error.includes("save() the same doc multiple times")
      ) {
        console.log("\n  The parallel save bug is STILL present.");
        console.log(
          "  Make sure you have deployed the latest code to the server."
        );
      } else if (
        approveData.error &&
        approveData.error.includes("already")
      ) {
        console.log(
          "\n  This request was already processed. Try a new registration request."
        );
      }
    }
  } catch (err) {
    console.error("Approval request failed:", err.message);
    process.exit(1);
  }
}

main();
