import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';

function formatJudgedAt(value) {
  if (!value) {
    return '';
  }

  const date =
    typeof value?.toDate === 'function'
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('ko-KR');
}

function getMedal(rank) {
  if (rank === 1) {
    return '🥇';
  }

  if (rank === 2) {
    return '🥈';
  }

  if (rank === 3) {
    return '🥉';
  }

  return '';
}

function ResultsPage({ onBack }) {
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const topThree = results?.rankings?.filter((item) => item.rank <= 3) ?? [];

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'results', 'latest'),
      (snapshot) => {
        setError('');
        setResults(snapshot.exists() ? snapshot.data() : null);
      },
      () => {
        setError('심사 결과를 불러오지 못했습니다.');
      },
    );

    return () => unsubscribe();
  }, []);

  return (
    <section className="panel results-page">
      <header className="results-header">
        <div>
          <div className="brand-badge">RESULTS</div>
          <h1 className="page-title small">심사 결과 확인</h1>
        </div>
        <button className="ghost-button compact" type="button" onClick={onBack}>
          이전으로
        </button>
      </header>

      {results?.judgedAt ? (
        <p className="helper-text">
          최근 심사 시각: {formatJudgedAt(results.judgedAt)}
        </p>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}

      {topThree.length ? (
        <div className="results-list">
          {topThree.map((item) => (
            <article className="result-card" key={`${item.rank}-${item.entryIndex}`}>
              <div className="result-rank">
                <span>{getMedal(item.rank)}</span>
                <strong>{item.rank}위</strong>
              </div>
              <img
                className="result-image"
                src={item.url}
                alt={item.fileName || 'result'}
              />
              <div className="result-meta">
                <strong>{item.participantName}</strong>
                <span>{item.score}점</span>
                <p>{item.comment}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>아직 공개된 심사 결과가 없습니다.</p>
        </div>
      )}
    </section>
  );
}

export default ResultsPage;
