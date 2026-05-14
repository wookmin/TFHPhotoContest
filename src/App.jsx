import { useEffect, useMemo, useState } from 'react';
import EntryPage from './pages/EntryPage.jsx';
import SubmitPage from './pages/SubmitPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import { teams } from './data/teams.js';
import { ensureTeamsSeeded } from './utils/seed.js';
import { db, isFirebaseConfigured } from './firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import { isMediaUploadConfigured } from './utils/mediaUpload.js';

const ENTRY_VIEW = 'entry';
const ADMIN_PASSWORD_VIEW = 'admin-password';
const SUBMIT_VIEW = 'submit';
const ADMIN_VIEW = 'admin';

function App() {
  const [view, setView] = useState(ENTRY_VIEW);
  const [activeName, setActiveName] = useState('');
  const [entryError, setEntryError] = useState('');
  const [adminError, setAdminError] = useState('');
  const [seedStatus, setSeedStatus] = useState('idle');
  const [seedMessage, setSeedMessage] = useState('');
  const teamNames = useMemo(() => teams.map((team) => team.name), []);

  useEffect(() => {
    let isMounted = true;

    async function seed() {
      if (!isFirebaseConfigured || !db) {
        if (isMounted) {
          setSeedStatus('error');
          setSeedMessage('Firebase 환경 변수가 설정되지 않았습니다.');
        }
        return;
      }

      try {
        setSeedStatus('loading');
        await ensureTeamsSeeded();
        if (isMounted) {
          if (!isMediaUploadConfigured()) {
            setSeedStatus('error');
            setSeedMessage(
              'Cloudinary 업로드 설정이 필요합니다. .env에 cloud name과 upload preset을 추가해주세요.',
            );
            return;
          }
          setSeedStatus('done');
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setSeedStatus('error');
          setSeedMessage(
            error?.code === 'permission-denied'
              ? 'Firestore 권한이 부족합니다. Firestore 규칙을 확인해주세요.'
              : '명단 초기화 중 오류가 발생했습니다.',
          );
        }
      }
    }

    seed();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleEntrySubmit(name) {
    const normalized = name.trim();

    if (!normalized) {
      setEntryError('이름을 입력해주세요.');
      return;
    }

    if (normalized === 'admin') {
      setActiveName(normalized);
      setEntryError('');
      setView(ADMIN_PASSWORD_VIEW);
      return;
    }

    if (!teamNames.includes(normalized)) {
      setEntryError('등록되지 않은 이름입니다');
      return;
    }

    if (db) {
      const teamDoc = await getDoc(doc(db, 'teams', normalized));
      if (!teamDoc.exists()) {
        setEntryError('등록되지 않은 이름입니다');
        return;
      }
    }

    setActiveName(normalized);
    setEntryError('');
    setView(SUBMIT_VIEW);
  }

  function handleAdminLogin(password) {
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
    if (adminPassword && password === adminPassword) {
      setAdminError('');
      setView(ADMIN_VIEW);
      return true;
    }

    setAdminError('비밀번호가 올바르지 않습니다.');
    return false;
  }

  function handleLogout() {
    setActiveName('');
    setEntryError('');
    setAdminError('');
    setView(ENTRY_VIEW);
  }

  return (
    <main className="app-shell">
      {seedStatus === 'loading' && (
        <section className="panel center-panel">
          <p className="status-text">명단을 준비하고 있습니다...</p>
        </section>
      )}

      {seedStatus !== 'loading' && seedStatus === 'error' && (
        <section className="panel center-panel">
          <h1 className="page-title">설정 확인 필요</h1>
          <p className="helper-text">{seedMessage}</p>
        </section>
      )}

      {seedStatus === 'done' && view === ENTRY_VIEW && (
        <EntryPage onSubmit={handleEntrySubmit} error={entryError} />
      )}

      {seedStatus === 'done' && view === ADMIN_PASSWORD_VIEW && (
        <EntryPage
          mode="password"
          name={activeName}
          error={adminError}
          onBack={handleLogout}
          onPasswordSubmit={handleAdminLogin}
        />
      )}

      {seedStatus === 'done' && view === SUBMIT_VIEW && (
        <SubmitPage teamName={activeName} onBack={handleLogout} />
      )}

      {seedStatus === 'done' && view === ADMIN_VIEW && (
        <AdminPage onBack={handleLogout} />
      )}
    </main>
  );
}

export default App;
