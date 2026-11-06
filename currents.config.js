// currents.config.js
module.exports = {
  projectId: process.env.CURRENTS_PROJECT_ID || "bronet",
  recordKey: process.env.CURRENTS_RECORD_KEY || "",
  ciBuildId: process.env.CURRENTS_CI_BUILD_ID || process.env.CI_BUILD_ID || undefined,
};

