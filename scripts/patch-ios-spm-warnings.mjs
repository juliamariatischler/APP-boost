import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const warningFlag = "-Wno-deprecated-declarations";

const patches = [
  {
    path: "ios/App/CapApp-SPM/Package.swift",
    find: `            ],
            cSettings: [
                .unsafeFlags(["${warningFlag}"])
            ]
`,
    replace: `            ],
            cSettings: [
                .unsafeFlags(["${warningFlag}"])
            ],
            swiftSettings: [
                .unsafeFlags(["-Xcc", "${warningFlag}"])
            ]
`,
    fallbackFind: `            ]
        )
`,
    fallbackReplace: `            ],
            cSettings: [
                .unsafeFlags(["${warningFlag}"])
            ],
            swiftSettings: [
                .unsafeFlags(["-Xcc", "${warningFlag}"])
            ]
        )
`,
  },
  {
    path: "node_modules/@capacitor/status-bar/Package.swift",
    find: `            path: "ios/Sources/StatusBarPlugin"
        ),
`,
    replace: `            path: "ios/Sources/StatusBarPlugin",
            swiftSettings: [
                .unsafeFlags(["-Xcc", "${warningFlag}"])
            ]
        ),
`,
  },
];

for (const patch of patches) {
  const filePath = resolve(root, patch.path);

  if (!existsSync(filePath)) {
    continue;
  }

  const source = readFileSync(filePath, "utf8");

  if (source.includes(patch.replace)) {
    continue;
  }

  let next = source;
  if (patch.find && source.includes(patch.find)) {
    next = source.replace(patch.find, patch.replace);
  } else if (patch.fallbackFind && source.includes(patch.fallbackFind)) {
    next = source.replace(patch.fallbackFind, patch.fallbackReplace);
  } else {
    throw new Error(`Could not patch ${patch.path}; expected package layout changed.`);
  }

  writeFileSync(filePath, next);
  console.log(`Patched ${patch.path}`);
}
