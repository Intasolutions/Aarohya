// utils/logger.js
const fs = require("fs");
const path = require("path");
const LOG_FILE = path.join(process.cwd(), "app.log");

function write(line) {
  try {
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
}

function compactRzpErr(e) {
  try {
    const out = {
      msg: e?.message,
      statusCode: e?.status || e?.statusCode,
      rzp: e?.error ? {
        code: e.error.code,
        description: e.error.description,
        reason: e.error.reason,
        step: e.error.step,
        source: e.error.source,
        metadata: e.error.metadata
      } : undefined
    };
    return JSON.stringify(out);
  } catch {
    return String(e && e.message || e);
  }
}

module.exports = {
  log: (msg) => write(String(msg)),
  logErr: (prefix, err) => write(`${prefix}: ${compactRzpErr(err)}`),
};
