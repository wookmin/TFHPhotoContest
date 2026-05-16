import { useState } from 'react';

function EntryPage({
  mode = 'name',
  name = '',
  error = '',
  onSubmit,
  onPasswordSubmit,
  onViewResults,
  onBack,
}) {
  const [value, setValue] = useState('');

  function handleSubmit(event) {
    event.preventDefault();

    if (mode === 'password') {
      const ok = onPasswordSubmit?.(value);
      if (ok) {
        setValue('');
      }
      return;
    }

    onSubmit?.(value);
  }

  return (
    <section className="panel center-panel">
      <div className="brand-badge">GYEONGJU PHOTO CONTEST</div>
      <h1 className="page-title">
        {mode === 'password' ? '관리자 인증' : '팀장 이름을 입력해주세요'}
      </h1>
      <p className="helper-text">
        {mode === 'password'
          ? `${name} 계정은 관리자 전용입니다. 비밀번호를 입력하세요.`
          : '등록된 팀장 이름으로 접속하면 같은 제출 현황을 이어서 확인할 수 있습니다.'}
      </p>

      <form className="stack-form" onSubmit={handleSubmit}>
        {mode === 'password' ? (
          <input
            className="text-input"
            type="password"
            placeholder="관리자 비밀번호"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        ) : (
          <input
            className="text-input"
            type="text"
            placeholder="예: 홍길동"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        )}

        {error ? <p className="error-text">{error}</p> : null}

        <button className="primary-button" type="submit">
          {mode === 'password' ? '관리자 화면 열기' : '사진 제출하기'}
        </button>

        {mode === 'name' ? (
          <button className="ghost-button" type="button" onClick={onViewResults}>
            심사 결과 확인
          </button>
        ) : null}

        {mode === 'password' ? (
          <button className="ghost-button" type="button" onClick={onBack}>
            이전으로
          </button>
        ) : null}
      </form>
    </section>
  );
}

export default EntryPage;
