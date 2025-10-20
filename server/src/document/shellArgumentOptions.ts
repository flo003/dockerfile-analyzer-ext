export const packageManager = ["apt", "apk", "pip", "npm"];

export const shellPackageManagers: Record<string, ShellPackageManager> = {
  apt: {
    type: "apt",
    workCommands: [],
    updateCommands: [
      ["apt-get", "update"],
      ["apt", "update"],
    ],
    updateFlags: [],
    installCommands: [
      ["apt-get", "install"],
      ["apt", "install"],
    ],
    installFlags: [
      { flagOptions: ["-y", "--yes", "--assume-yes"] },
      { flagOptions: ["--no-install-recommends"] },
    ],
    cleanupCommands: [
      ["apt", "clean"],
      ["apt-get", "clean"],
      ["rm -rf /var/cache/apt/archives/*"],
      ["rm -rf /var/lib/apt/lists/*"],
    ],
  },
  apk: {
    type: "apk",
    workCommands: [],
    updateCommands: [["apk", "update"]],
    updateFlags: [],
    installCommands: [["apk", "add"], ["apk-add"]],
    installFlags: [],
    cleanupCommands: [["apk", "cache", "clean"], ["rm -rf /var/cache/apk/*"]],
  },
  pip: {
    type: "pip",
    workCommands: [],
    updateCommands: [["pip", "update"]],
    updateFlags: [],
    installCommands: [["pip", "install"]],
    installFlags: [],
    cleanupCommands: [["rm -rf /$USER/.cache/pip/*"], ["rm -rf /tmp/*"]],
  },
  npm: {
    type: "npm",
    workCommands: [],
    updateCommands: [["npm", "update"]],
    updateFlags: [],
    installCommands: [["npm", "install"]],
    installFlags: [],
    cleanupCommands: [["npm cache clean --force"], ["rm -rf $TMPDIR/*"]],
  },
  make: {
    type: "make",
    workCommands: [["make"]],
    updateCommands: [],
    updateFlags: [],
    installCommands: [["make", "install"]],
    installFlags: [],
    cleanupCommands: [["make", "clean"]],
  },
};

export interface ShellPackageManager {
  type: string;
  workCommands: string[][]
  updateCommands: string[][];
  updateFlags: CommandFlags[];
  installCommands: string[][];
  cleanupCommands: string[][];
  installFlags: CommandFlags[];
}

export interface CommandFlags {
  flagOptions: string[];
}
/*
export interface AptPackageManager {
  type: "apt";
  updateCommands: ["apt-get update", "apt update"];
  installCommands: ["apt-get install", "apt install"];
  cleanupCommands: [
    "apt clean",
    "apt-get clean",
    "rm /var/cache/apt/archives/*"
  ];
}

export interface ApkPackageManager {
  type: "apk";
  updateCommands: ["apk update"];
  installCommands: ["apk add"];
  cleanupCommands: ["rm /var/cache/apk/*"];
}

export interface PipPackageManager {
  type: "pip";
  updateCommands: ["pip update"];
  installCommands: ["pip install"];
  cleanupCommands: ["rm -rf /$USER/.cache/pip/*", "rm -rf /tmp/*"];
}

export interface NpmPackageManager {
  type: "npm";
  updateCommands: ["pip update"];
  installCommands: ["pip install"];
  cleanupCommands: ["rm -rf /$USER/.cache/pip/*", "rm -rf /tmp/*"];
}

export const updatePackageCommands = ["apt update", "apk update"];
export const cleanupPackageCommands = [
  "apt clean",
  "apt-get clean",
  "rm /var/cache/apt/archives/*",
  "rm /var/cache/apk/*",
];
export const cleanupInstallFlags = ["--no-cache"];
export const installPackageCommands = [
  "apt-get install",
  "apt install",
  "apk add",
];
// remove unused packages "apt-get autoremove"
*/
