import { collection, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { teams } from '../data/teams.js';

export async function ensureTeamsSeeded() {
  const snapshot = await getDocs(collection(db, 'teams'));

  const existing = new Map(snapshot.docs.map((d) => [d.id, d.data()]));
  const incoming = new Map(teams.map((t) => [t.name, t]));

  const writes = [];
  const deletes = [];

  for (const team of teams) {
    const current = existing.get(team.name);
    if (!current || current.total !== team.total || current.quota !== team.quota) {
      writes.push(setDoc(doc(db, 'teams', team.name), {
        name: team.name,
        total: team.total,
        quota: team.quota,
      }));
    }
  }

  for (const id of existing.keys()) {
    if (!incoming.has(id)) {
      deletes.push(deleteDoc(doc(db, 'teams', id)));
    }
  }

  await Promise.all([...writes, ...deletes]);

  return writes.length > 0 || deletes.length > 0;
}
