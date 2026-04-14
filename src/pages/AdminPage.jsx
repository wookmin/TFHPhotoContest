import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { judgePhotos } from '../utils/gemini.js';

const DEFAULT_CRITERIA = `1. 경주의 역사·문화 분위기 (30점): 유적지, 전통 요소, 경주만의 분위기
2. 구도와 빛 활용 (25점): 앵글, 빛의 방향, 원근감
3. 창의성과 개성 (25점): 독창적인 시각과 연출
4. 여행의 감성 (20점): 그날의 즐거움과 추억이 느껴지는가`;

const tabs = ['참가자 목록', '제출 현황', 'AI 심사', '결과'];

function AdminPage({ onBack }) {
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [teams, setTeams] = useState([]);
  const [submissions, setSubmissions] = useState({});
  const [results, setResults] = useState(null);
  const [criteria, setCriteria] = useState(DEFAULT_CRITERIA);
  const [isJudging, setIsJudging] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const unsubscribeTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(snapshot.docs.map((item) => item.data()));
    });

    const unsubscribeSubmissions = onSnapshot(
      collection(db, 'submissions'),
      (snapshot) => {
        const next = {};
        snapshot.docs.forEach((item) => {
          next[item.id] = item.data().photos ?? [];
        });
        setSubmissions(next);
      },
    );

    const unsubscribeResults = onSnapshot(doc(db, 'results', 'latest'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setResults(data);
        if (typeof data.criteria === 'string') {
          setCriteria(data.criteria);
        }
      }
    });

    return () => {
      unsubscribeTeams();
      unsubscribeSubmissions();
      unsubscribeResults();
    };
  }, []);

  const participants = useMemo(
    () =>
      teams
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .map((team) => ({
          ...team,
          submitted: submissions[team.name]?.length ?? 0,
        })),
    [submissions, teams],
  );

  const allEntries = useMemo(
    () =>
      participants.flatMap((participant) =>
        (submissions[participant.name] ?? []).map((photo) => ({
          participantName: participant.name,
          fileName: photo.fileName,
          url: photo.url,
          uploadedAt: photo.uploadedAt,
        })),
      ),
    [participants, submissions],
  );

  async function handleJudge() {
    if (!allEntries.length) {
      setStatus('심사할 사진이 없습니다.');
      return;
    }

    setIsJudging(true);
    setStatus('Gemini로 사진을 심사하고 있습니다...');

    try {
      const rankings = await judgePhotos({
        entries: allEntries,
        criteria,
      });

      await setDoc(doc(db, 'results', 'latest'), {
        rankings,
        criteria,
        judgedAt: serverTimestamp(),
      });

      const partial = rankings.some((item) => item.partial);
      setStatus(
        partial
          ? `일부 배치가 한도 초과로 실패했지만 심사 가능한 결과는 저장했습니다. (${rankings.length}장)`
          : `심사가 완료되었습니다. 총 ${rankings.length}장을 정렬했습니다.`,
      );
      setActiveTab('결과');
    } catch (error) {
      console.error(error);
      setStatus(error.message || '심사 중 오류가 발생했습니다.');
    } finally {
      setIsJudging(false);
    }
  }

  return (
    <section className="panel admin-page">
      <header className="admin-header">
        <div>
          <div className="brand-badge">ADMIN</div>
          <h1 className="page-title small">사진 콘테스트 관리자</h1>
        </div>
        <button className="ghost-button compact" type="button" onClick={onBack}>
          로그아웃
        </button>
      </header>

      <nav className="tab-row">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === '참가자 목록' ? (
        <div className="table-card">
          {participants.map((participant) => (
            <div className="table-row" key={participant.name}>
              <strong>{participant.name}</strong>
              <span>{participant.total}명</span>
              <span>할당 {participant.quota}장</span>
              <span>
                제출 {participant.submitted}/{participant.quota}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === '제출 현황' ? (
        <div className="submission-groups">
          {participants.map((participant) => (
            <section className="panel inset-panel" key={participant.name}>
              <div className="participant-head">
                <strong>{participant.name}</strong>
                <span>
                  {participant.submitted}/{participant.quota}장
                </span>
              </div>
              <div className="thumb-grid">
                {(submissions[participant.name] ?? []).map((photo) => (
                  <figure key={photo.url} className="admin-thumb-card">
                    <img src={photo.url} alt={photo.fileName} />
                    {/* <figcaption>{photo.fileName}</figcaption> */}
                  </figure>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {activeTab === 'AI 심사' ? (
        <section className="panel inset-panel">
          <label className="field-label" htmlFor="criteria">
            심사 기준
          </label>
          <textarea
            id="criteria"
            className="criteria-input"
            value={criteria}
            onChange={(event) => setCriteria(event.target.value)}
          />
          <button
            className="primary-button"
            type="button"
            onClick={handleJudge}
            disabled={isJudging}
          >
            {isJudging ? '심사 중...' : '심사 시작'}
          </button>
          {status ? <p className="helper-text">{status}</p> : null}
        </section>
      ) : null}

      {activeTab === '결과' ? (
        <div className="results-list">
          {results?.rankings?.length ? (
            results.rankings.map((item) => (
              <article className="result-card" key={`${item.rank}-${item.entryIndex}`}>
                <div className="result-rank">
                  <span>{item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : '🏅'}</span>
                  <strong>{item.rank}위</strong>
                </div>
                <img
                  className="result-image"
                  src={item.url || allEntries[item.entryIndex]?.url}
                  alt={item.fileName || allEntries[item.entryIndex]?.fileName || 'result'}
                />
                <div className="result-meta">
                  <strong>{item.participantName}</strong>
                  <span>{item.score}점</span>
                  <p>{item.comment}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <p>아직 심사 결과가 없습니다.</p>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default AdminPage;
