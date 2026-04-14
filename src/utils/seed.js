import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { teams } from '../data/teams.js';

export async function ensureTeamsSeeded() {
  const snapshot = await getDocs(collection(db, 'teams'));

  if (!snapshot.empty) {
    return false;
  }

  await Promise.all(
    teams.map((team) =>
      setDoc(doc(db, 'teams', team.name), {
        name: team.name,
        total: team.total,
        quota: team.quota,
      }),
    ),
  );

  return true;
}
