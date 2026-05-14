import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  initializeFirestore,
  setDoc,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const teamsFilePath = path.resolve(__dirname, '../src/data/teams.js');
const envFilePath = path.resolve(__dirname, '../.env');

function printUsage() {
  console.log(`Usage:
  npm run teams -- list
  npm run teams -- add "<name>" <total> [quota]
  npm run teams -- update "<name>" <total> [quota]
  npm run teams -- set "<name>" <total> [quota]
  npm run teams -- rename "<oldName>" "<newName>"
  npm run teams -- remove "<name>"
  npm run teams -- sync`);
}

async function loadTeams() {
  const module = await import(`${pathToFileURL(teamsFilePath).href}?t=${Date.now()}`);
  return Array.isArray(module.teams) ? module.teams.map((team) => ({ ...team })) : [];
}

async function saveTeams(teams) {
  const lines = [
    'export const teams = [',
    ...teams.map(
      (team) => `  { name: ${JSON.stringify(team.name)}, total: ${team.total}, quota: ${team.quota} },`,
    ),
    '];',
    '',
  ];

  await fs.writeFile(teamsFilePath, lines.join('\n'), 'utf8');
}

function parseCount(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return parsed;
}

function findTeamIndex(teams, name) {
  return teams.findIndex((team) => team.name === name);
}

function parseEnv(contents) {
  const env = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

async function loadFirebaseConfig() {
  const envFile = await fs.readFile(envFilePath, 'utf8');
  const env = parseEnv(envFile);
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  const missing = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing Firebase env values: ${missing.join(', ')}`);
  }

  return firebaseConfig;
}

async function syncTeamsToFirestore(teams) {
  const firebaseConfig = await loadFirebaseConfig();
  const app = initializeApp(firebaseConfig, `teams-cli-${Date.now()}`);
  const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    useFetchStreams: false,
  });

  const snapshot = await getDocs(collection(db, 'teams'));
  const existing = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
  const incoming = new Map(teams.map((team) => [team.name, team]));

  const writes = [];
  const deletes = [];

  for (const team of teams) {
    const current = existing.get(team.name);
    if (!current || current.total !== team.total || current.quota !== team.quota) {
      writes.push(
        setDoc(doc(db, 'teams', team.name), {
          name: team.name,
          total: team.total,
          quota: team.quota,
        }),
      );
    }
  }

  for (const teamName of existing.keys()) {
    if (!incoming.has(teamName)) {
      deletes.push(deleteDoc(doc(db, 'teams', teamName)));
    }
  }

  await Promise.all([...writes, ...deletes]);

  console.log(
    `Synced teams to Firestore. upserted=${writes.length}, deleted=${deletes.length}, total=${teams.length}`,
  );
}

function printTeams(teams) {
  if (!teams.length) {
    console.log('No teams found.');
    return;
  }

  console.table(
    teams.map((team, index) => ({
      no: index + 1,
      name: team.name,
      total: team.total,
      quota: team.quota,
    })),
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help') {
    printUsage();
    return;
  }

  const teams = await loadTeams();

  switch (command) {
    case 'list': {
      printTeams(teams);
      return;
    }

    case 'add': {
      const [name, totalValue, quotaValue] = args;
      if (!name || !totalValue) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      if (findTeamIndex(teams, name) !== -1) {
        throw new Error(`"${name}" already exists.`);
      }

      const total = parseCount(totalValue, 'total');
      const quota = quotaValue ? parseCount(quotaValue, 'quota') : total;
      teams.push({ name, total, quota });
      await saveTeams(teams);
      console.log(`Added "${name}" (total=${total}, quota=${quota}).`);
      return;
    }

    case 'update':
    case 'set': {
      const [name, totalValue, quotaValue] = args;
      if (!name || !totalValue) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const total = parseCount(totalValue, 'total');
      const quota = quotaValue ? parseCount(quotaValue, 'quota') : total;
      const index = findTeamIndex(teams, name);

      if (index === -1) {
        if (command === 'update') {
          throw new Error(`"${name}" does not exist.`);
        }
        teams.push({ name, total, quota });
        await saveTeams(teams);
        console.log(`Added "${name}" (total=${total}, quota=${quota}).`);
        return;
      }

      teams[index] = { ...teams[index], total, quota };
      await saveTeams(teams);
      console.log(`Updated "${name}" (total=${total}, quota=${quota}).`);
      return;
    }

    case 'rename': {
      const [oldName, newName] = args;
      if (!oldName || !newName) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const index = findTeamIndex(teams, oldName);
      if (index === -1) {
        throw new Error(`"${oldName}" does not exist.`);
      }
      if (findTeamIndex(teams, newName) !== -1) {
        throw new Error(`"${newName}" already exists.`);
      }

      teams[index] = { ...teams[index], name: newName };
      await saveTeams(teams);
      console.log(`Renamed "${oldName}" to "${newName}".`);
      return;
    }

    case 'remove': {
      const [name] = args;
      if (!name) {
        printUsage();
        process.exitCode = 1;
        return;
      }

      const index = findTeamIndex(teams, name);
      if (index === -1) {
        throw new Error(`"${name}" does not exist.`);
      }

      teams.splice(index, 1);
      await saveTeams(teams);
      console.log(`Removed "${name}".`);
      return;
    }

    case 'sync': {
      await syncTeamsToFirestore(teams);
      return;
    }

    default: {
      printUsage();
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
