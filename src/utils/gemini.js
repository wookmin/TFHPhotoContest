const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
const DEFAULT_BATCH_SIZE = Number(import.meta.env.VITE_GEMINI_BATCH_SIZE || 8);
const DEFAULT_BATCH_DELAY_MS = Number(
  import.meta.env.VITE_GEMINI_BATCH_DELAY_MS || 4000,
);
const DEFAULT_MAX_RETRIES = Number(import.meta.env.VITE_GEMINI_MAX_RETRIES || 5);
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

const SYSTEM_INSTRUCTION = `당신은 사진 콘테스트 심사위원입니다.
제공된 심사 기준에 따라 모든 사진에 순위를 매기세요.
반드시 순수 JSON만 반환하세요. 마크다운이나 설명 없이.
형식:
{
  "rankings": [
    {
      "rank": 1,
      "entryIndex": 0,
      "participantName": "이름",
      "score": 95,
      "comment": "평가 한 문장 (한국어)"
    }
  ]
}`;

async function urlToInlineData(url) {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result);
      const [, data] = result.split(',');
      resolve({
        mimeType: blob.type || 'image/jpeg',
        data,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getRetryDelayMs(response, attempt) {
  const retryAfterHeader = response.headers.get('retry-after');
  const retryAfterSeconds = Number(retryAfterHeader);

  if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  const baseDelay = DEFAULT_BATCH_DELAY_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(baseDelay + jitter, 60000);
}

async function callGeminiWithRetry(payload) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  let lastError = null;

  for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt += 1) {
    const response = await fetch(
      `${GEMINI_API_BASE}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (response.ok) {
      return response.json();
    }

    const errorText = await response.text();
    lastError = new Error(`Gemini 호출 실패 (${response.status}): ${errorText}`);

    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === DEFAULT_MAX_RETRIES) {
      throw lastError;
    }

    await sleep(getRetryDelayMs(response, attempt));
  }

  throw lastError || new Error('Gemini 호출에 실패했습니다.');
}

async function judgeBatch({ batch, criteria }) {
  const parts = [
    {
      text: `심사 기준:\n${criteria}\n\n아래 사진들을 함께 평가하고 JSON만 반환하세요.
각 사진 정보:
${batch
  .map(
    (entry) =>
      `- entryIndex: ${entry.entryIndex}, participantName: ${entry.participantName}, fileName: ${entry.fileName}`,
  )
  .join('\n')}`,
    },
  ];

  for (const entry of batch) {
    const inlineData = await urlToInlineData(entry.url);
    parts.push({
      text: `entryIndex ${entry.entryIndex} / participantName ${entry.participantName} / fileName ${entry.fileName}`,
    });
    parts.push({ inlineData });
  }

  const data = await callGeminiWithRetry({
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini 응답이 비어 있습니다.');
  }

  const parsed = JSON.parse(text);
  return Array.isArray(parsed.rankings) ? parsed.rankings : [];
}

export async function judgePhotos({ entries, criteria }) {
  const entriesWithIndex = entries.map((entry, index) => ({
    ...entry,
    entryIndex: index,
  }));
  const batches = [];

  for (let index = 0; index < entriesWithIndex.length; index += DEFAULT_BATCH_SIZE) {
    batches.push(entriesWithIndex.slice(index, index + DEFAULT_BATCH_SIZE));
  }

  const batchResults = [];
  const failedBatches = [];

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];

    try {
      const rankings = await judgeBatch({ batch, criteria });
      batchResults.push(...rankings);
    } catch (error) {
      console.error(error);
      failedBatches.push(index + 1);
    }

    if (index < batches.length - 1) {
      await sleep(DEFAULT_BATCH_DELAY_MS);
    }
  }

  if (!batchResults.length) {
    throw new Error(
      'Gemini 한도 또는 응답 오류로 심사에 실패했습니다. 잠시 후 다시 시도해주세요.',
    );
  }

  const deduped = Object.values(
    batchResults.reduce((accumulator, item) => {
      accumulator[item.entryIndex] = {
        entryIndex: item.entryIndex,
        participantName: item.participantName,
        score: item.score,
        comment: item.comment,
      };
      return accumulator;
    }, {}),
  );

  return deduped
    .sort((a, b) => b.score - a.score)
    .map((item, index) => ({
      ...item,
      url: entries[item.entryIndex]?.url,
      fileName: entries[item.entryIndex]?.fileName,
      rank: index + 1,
    }))
    .map((item) => ({
      ...item,
      partial: failedBatches.length > 0,
      failedBatches,
      model: DEFAULT_MODEL,
    }));
}
