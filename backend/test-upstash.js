require('dotenv').config();
const redis = require('./src/config/redis');

async function testConnection() {
  try {
    console.log("⏳ Connecting to Upstash...");
    
    // Write a test key
    await redis.set("upstash_test", "Hello from your backend!", "EX", 60);
    console.log("✅ Successfully wrote data to Upstash!");

    // Read the test key back
    const value = await redis.get("upstash_test");
    console.log(`✅ Successfully read data back! Value: "${value}"`);
    
    console.log("\n🎉 The connection is working perfectly!");
  } catch (error) {
    console.error("❌ Connection failed:", error.message);
  } finally {
    process.exit(0);
  }
}

testConnection();
