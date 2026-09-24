// 데일리노트 본문에서 카테고리/키워드를 AI(Claude)로 추출 — dailyNotes 라우트의 "태그추출(AI)" 버튼과
// 독서기록 메모 저장(저장 시점 자동 추출)이 공유한다 (services/notifications.js와 동일 패턴).
const Anthropic = require('@anthropic-ai/sdk');

// .env는 CLAUD_KEY로 저장되어 있음(오탈자) — CLAUDE_KEY도 함께 지원
const ANTHROPIC_API_KEY = process.env.CLAUDE_KEY || process.env.CLAUD_KEY;
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

class TagExtractionError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'TagExtractionError';
    this.status = status;
  }
}

async function extractNoteTags(content) {
  if (!anthropic) throw new TagExtractionError('서버에 AI 키(CLAUDE_KEY)가 설정되지 않았습니다.', 500);

  const text = (content || '').trim();
  if (!text) throw new TagExtractionError('추출할 내용이 없습니다.', 400);

  let response;
  try {
    response = await anthropic.messages.create({
      // 태그 추출은 추론이 필요 없는 단순 분류라 저렴한 Haiku 사용
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
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
          content: `다음은 사용자가 작성한 데일리노트 본문(마크다운)이다. 이 내용을 분석해 카테고리와 키워드를 추출해줘.\n\n---\n${text}\n---`,
        },
      ],
    });
  } catch (e) {
    console.error('extract-tags 실패:', e);
    throw new TagExtractionError('AI 태그 추출에 실패했습니다: ' + e.message, 502);
  }

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  if (!toolUse) throw new TagExtractionError('AI 응답에서 결과를 찾을 수 없습니다.', 502);

  const { category, keywords } = toolUse.input;
  return {
    category: (category || '').trim(),
    keywords: Array.isArray(keywords) ? keywords.map((k) => String(k).trim()).filter(Boolean) : [],
  };
}

module.exports = { extractNoteTags, TagExtractionError };
