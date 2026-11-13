import { readFileSync, writeFileSync } from "node:fs";

const clientFile = new URL("./Front/soquetic-client.js", import.meta.url);
const backendUrl = process.env.BACKEND_URL;
if (backendUrl) {
  const backend = new URL(backendUrl);
  if (backend.protocol !== "https:") {
    throw new Error("BACKEND_URL debe usar HTTPS.");
  }
  const client = readFileSync(clientFile, "utf8");
  writeFileSync(clientFile, client.replace("  : location.origin;", () => `  : ${JSON.stringify(backend.origin)};`));
}
