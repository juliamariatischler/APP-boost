// Entfernt den Android-Teil von cordova-plugin-health, damit auf Android KEIN
// Health Connect SDK gebundelt wird (Google-Play-Ablehnung: Health Connect ist
// fuer eine Schueler-/Challenge-App kein zugelassener Use Case).
//
// Android holt Schritte ueber das native DeviceStepCounterPlugin (ACTIVITY_RECOGNITION).
// cordova-plugin-health wird nur noch fuer iOS (Apple HealthKit) verwendet.
//
// Laeuft als Teil von "postinstall" -> ueberlebt npm install. Danach muss
// `npx cap sync android` laufen, damit das Android-Projekt neu generiert wird.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const pluginXml = resolve(root, "node_modules/cordova-plugin-health/plugin.xml");

if (!existsSync(pluginXml)) {
  console.log("[patch-cordova-health-android] plugin.xml nicht gefunden, uebersprungen.");
  process.exit(0);
}

const original = readFileSync(pluginXml, "utf8");
// Kompletten <platform name="android"> ... </platform>-Block entfernen.
const patched = original.replace(
  /\n[ \t]*<platform name="android">[\s\S]*?<\/platform>\n/,
  "\n"
);

if (patched === original) {
  console.log("[patch-cordova-health-android] kein Android-Block (bereits entfernt).");
} else {
  writeFileSync(pluginXml, patched, "utf8");
  console.log("[patch-cordova-health-android] Android-Block aus plugin.xml entfernt (Plugin nun iOS-only).");
}
