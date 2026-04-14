# 경주 당일치기 사진 콘테스트 웹앱

Vite + React + Firebase Firestore + Cloudinary + Gemini API로 만든 모바일 전용 사진 제출/심사 웹앱입니다.

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트를 생성합니다.
2. 프로젝트 설정에서 웹 앱을 추가합니다.
3. 발급된 Firebase 웹 앱 설정값을 복사해 `.env`에 넣습니다.
4. Firestore Database를 활성화합니다.

## 2. Firestore 규칙 설정

개발용으로 아래처럼 임시 허용 규칙을 사용하면 빠르게 테스트할 수 있습니다.

Firestore rules:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## 3. Cloudinary 업로드 설정

1. [Cloudinary](https://cloudinary.com/)에서 계정을 생성합니다.
2. Console에서 `Settings -> Upload`로 이동합니다.
3. `Upload presets`에서 unsigned preset을 생성합니다.
4. cloud name과 preset 이름을 `.env`에 넣습니다.

참고 문서:
- [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference)
- [Cloudinary Upload Presets](https://cloudinary.com/documentation/upload_presets)

참고:
- 현재 앱은 브라우저에서 Cloudinary unsigned upload를 사용합니다.
- 제출 화면에서 삭제를 눌러도 Cloudinary 원본 파일까지 즉시 삭제하지는 않고 Firestore 제출 목록에서만 제거합니다.

## 4. Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/)에 접속합니다.
2. API 키를 발급합니다.
3. 발급된 키를 `.env`의 `VITE_GEMINI_API_KEY`에 넣습니다.

## 5. .env 파일 설정

프로젝트 루트에 `.env` 파일을 만들고 아래 항목을 채웁니다.

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
VITE_GEMINI_MODEL=gemini-2.5-flash
VITE_GEMINI_BATCH_SIZE=8
VITE_GEMINI_BATCH_DELAY_MS=4000
VITE_GEMINI_MAX_RETRIES=5
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_CLOUDINARY_FOLDER=tfh-photo-contest
```

기본값은 무료 티어에서 한도 초과를 줄이기 위해 작은 배치와 배치 간 대기, 재시도를 사용하도록 잡아두었습니다.

## 6. 실행 방법

```bash
npm install
npm run dev
```

## 7. teams.js에 실제 명단 입력

실제 참가자 명단은 `src/data/teams.js`에서 수정하면 됩니다.

```js
export const teams = [
  { name: '홍길동', total: 5, quota: 5 },
  { name: '김유신', total: 4, quota: 4 },
];
```

앱 첫 실행 시 Firestore `teams` 컬렉션이 비어 있으면 이 파일의 배열을 기준으로 자동 seeding 됩니다.
