import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
async function loadLocalEnv({ directory = ".", env = process.env } = {}) {
  for (const file of [".env.local", ".env"]) {
    try {
      const values = parseEnv(await readFile(directory + "/" + file, "utf8"));
      for (const [key, value] of Object.entries(values)) if (env[key] === void 0) env[key] = value;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return env;
}
export {
  loadLocalEnv
};
