const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { firestore } = require('../db/firestore');
const { DAILY_NOTES, COUNTER_KEYS } = require('../db/collections');
const { nowString, nextId, NotFoundError, asyncHandler } = require('../db/util');

const router = express.Router();
const notesRef = firestore.collection(DAILY_NOTES);

const MAX_CONTENT_LENGTH = 2000;

// .env는 CLAUD_KEY로 저장되어 있음(오탈자) — CLAUDE_KEY도 함께 지원
const ANTHROPIC_API_KEY = process.env.CLAUDE_KEY || process.env.CLAUD_KEY;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

function todayDateString() {
  return nowString().slice(0, 10);
}

// 해시태그 스타일 다중 키워드 — 쉼표로 구분된 토큰을 trim·중복 제거 후 다시 쉼표로 합친다
function normalizeKeyword(raw) {
  const tokens = (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set(tokens)].join(', ');
}

// GET /api/daily-notes — 목록 조회 (date 또는 month 쿼리로 필터링, date 우선)
// month는 SQL의 LIKE 'YYYY-MM%' 대체용으로 비정규화해 저장한 필드.
router.get('/', asyncHandler(async (req, res) => {
  const { date, month } = req.query;
  let snap;
  if (date) {
    snap = await notesRef.where('date', '==', date).orderBy('id', 'desc').get();
  } else if (month) {
    snap = await notesRef.where('month', '==', month).orderBy('date', 'desc').orderBy('id', 'desc').get();
  } else {
    snap = await notesRef.orderBy('date', 'desc').orderBy('id', 'desc').get();
  }
  res.json(snap.docs.map((d) => d.data()));
}));

// POST /api/daily-notes — 새 노트 생성
router.post('/', asyncHandler(async (req, res) => {
  const keyword = normalizeKeyword(req.body.keyword);
  if (!keyword) return res.status(400).json({ error: '키워드를 1개 이상 입력해주세요.' });

  const content = req.body.content ?? '';
  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: '내용은 2000자를 초과할 수 없습니다.' });
  }

  const date = (req.body.date || '').trim() || todayDateString();
  const category = (req.body.category || '').trim() || null;
  const item = (req.body.item || '').trim() || null;

  const note = await firestore.runTransaction(async (tx) => {
    const id = await nextId(tx, COUNTER_KEYS.DAILY_NOTES);
    const doc = {
      id, date, month: date.slice(0, 7), keyword, category, item, content,
      created_at: nowString(), updated_at: nowString(),
    };
    tx.set(notesRef.doc(String(id)), doc);
    return doc;
  });

  res.status(201).json(note);
}));

// POST /api/daily-notes/extract-tags — AI(Claude)로 본문에서 카테고리/키워드 추출
// DB에는 저장하지 않고 결과만 반환 — 클라이언트가 입력란에 채워 넣을지 사용자가 직접 결정
router.post('/extract-tags', async (req, res) => {
  if (!anthropic) {
    return res.status(500).json({ error: '서버에 AI 키(CLAUDE_KEY)가 설정되지 않았습니다.' });
  }

  const content = (req.body.content || '').trim();
  if (!content) {
    return res.status(400).json({ error: '추출할 내용이 없습니다.' });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      output_config: { effort: 'low' },
      tools: [
        {
          name: 'extract_tags',
          description: '노트 본문에서 카테고리 1개와 핵심 키워드(해시태그) 여러 개를 추출한다',
          strict: true,
          input_schema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: '노트 내용을 대표하는 짧은 카테고리명 (한국어 단어/구, 예: 습관, 아이디어, 업무)',
              },
              keywords: {
                type: 'array',
                items: { type: 'string' },
                description: '노트 내용을 대표하는 핵심 키워드 3~6개 (해시태그 스타일 짧은 한국어 단어/구, 중복 없이)',
              },
            },
            required: ['category', 'keywords'],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'extract_tags' },
      messages: [
        {
          role: 'user',
          content: `다음은 사용자가 작성한 데일리노트 본문(마크다운)이다. 이 내용을 분석해 카테고리와 키워드를 추출해줘.\n\n---\n${content}\n---`,
        },
      ],
    });

    const toolUse = response.content.find((block) => block.type === 'tool_use');
    if (!toolUse) {
      return res.status(502).json({ error: 'AI 응답에서 결과를 찾을 수 없습니다.' });
    }

    const { category, keywords } = toolUse.input;
    res.json({
      category: (category || '').trim(),
      keywords: Array.isArray(keywords) ? keywords.map((k) => String(k).trim()).filter(Boolean) : [],
    });
  } catch (e) {
    console.error('extract-tags 실패:', e);
    res.status(502).json({ error: 'AI 태그 추출에 실패했습니다: ' + e.message });
  }
});

// PUT /api/daily-notes/:id — 노트 수정 (전체 필드 upsert)
router.put('/:id', asyncHandler(async (req, res) => {
  const ref = notesRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();

  const keyword = normalizeKeyword(req.body.keyword);
  if (!keyword) return res.status(400).json({ error: '키워드를 1개 이상 입력해주세요.' });

  const content = req.body.content ?? '';
  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: '내용은 2000자를 초과할 수 없습니다.' });
  }

  const date = (req.body.date || '').trim() || todayDateString();
  const category = (req.body.category || '').trim() || null;
  const item = (req.body.item || '').trim() || null;

  const updated = {
    ...snap.data(), date, month: date.slice(0, 7), keyword, category, item, content, updated_at: nowString(),
  };
  await ref.set(updated);
  res.json(updated);
}));

// DELETE /api/daily-notes/:id — 노트 삭제
router.delete('/:id', asyncHandler(async (req, res) => {
  const ref = notesRef.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw new NotFoundError();
  await ref.delete();
  res.status(204).send();
}));

module.exports = router;
