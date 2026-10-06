// Design Ref: §5.3 — 외부 LLM 호출은 라우트와 분리된 서비스로 격리 (services/notifications.js와 동일 패턴)
// Claude(Anthropic)로 호출한다 — 키는 데일리노트 태그 추출과 같은 CLAUDE_KEY (services/anthropicClient.js)
const { anthropic } = require('./anthropicClient');

// 원문에서 항목을 뽑아 옮기는 추출 작업이라 추론이 필요 없어 저렴한 Haiku를 기본으로 쓴다
const MEETING_AI_MODEL = process.env.MEETING_AI_MODEL || 'claude-haiku-4-5';
const VALID_STATUSES = new Set(['대기', '진행중', '완료']);

const SYSTEM_PROMPT = `당신은 회의록에서 액션아이템(후속 조치)만 추출하는 도구입니다.
아래 회의 원문을 읽고, 각 액션아이템을 submit_action_items 도구로 제출하세요.
각 항목의 필드:

- task_type: 업무 구분(예: "Release", "MCP", "북미 SDS" 등 원문에 드러난 카테고리, 없으면 "기타")
- content: 액션아이템 내용 (한 문장 요약)
- status: "대기" | "진행중" | "완료" 중 하나 (원문에 "진행 중"이 있으면 "진행중", "완료"/"됨"이 있으면 "완료", 그 외 "대기")
- due_date: 원문에 표현된 일정/기한 문구를 그대로 (예: "8/27", "금일 오후", "목요일"), 없으면 null
- assignee: 담당자/담당 파트 (예: "BE", "지니", "박찬준"), 없으면 null
- progress: 해당 항목의 진행상황 파트 원문을 요약하지 말고 그대로 (없으면 null)`;

const nullableString = (description) => ({ type: ['string', 'null'], description });

const SUBMIT_TOOL = {
  name: 'submit_action_items',
  description: '회의 원문에서 추출한 액션아이템 목록을 제출한다',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            task_type: { type: 'string', description: '업무 구분, 없으면 "기타"' },
            content: { type: 'string', description: '액션아이템 내용 (한 문장 요약)' },
            status: { type: 'string', enum: ['대기', '진행중', '완료'] },
            due_date: nullableString('원문에 표현된 일정/기한 문구 그대로'),
            assignee: nullableString('담당자/담당 파트'),
            progress: nullableString('진행상황 파트 원문 그대로'),
          },
          required: ['task_type', 'content', 'status', 'due_date', 'assignee', 'progress'],
          additionalProperties: false,
        },
      },
    },
    required: ['items'],
    additionalProperties: false,
  },
};

function aiError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// LLM이 낸 항목을 정리한다. 쓸 만한 항목이 하나도 없으면(FR-13) 원문을 잃지 않도록 단일 항목으로 대체 저장.
function normalizeItems(rawItems, rawNotes) {
  const items = (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => ({
      task_type: String(item.task_type ?? '기타').trim() || '기타',
      content: String(item.content ?? '').trim(),
      // 진행상황 파트에 '완료'가 있으면 LLM 판단과 무관하게 완료로 확정
      status: String(item.progress ?? '').includes('완료')
        ? '완료'
        : (VALID_STATUSES.has(item.status) ? item.status : '대기'),
      due_date: item.due_date ? String(item.due_date).trim() : null,
      assignee: item.assignee ? String(item.assignee).trim() : null,
    }))
    .filter((item) => item.content);
  if (items.length > 0) return items;
  return [{ task_type: '기타', content: rawNotes.slice(0, 500), status: '대기', due_date: null, assignee: null }];
}

async function generateActionItems(notes) {
  if (!anthropic) throw aiError('AI 기능이 설정되지 않았습니다. 서버 관리자에게 문의해주세요.', 500);

  let response;
  try {
    response = await anthropic.messages.create({
      model: MEETING_AI_MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [SUBMIT_TOOL],
      tool_choice: { type: 'tool', name: SUBMIT_TOOL.name },
      messages: [{ role: 'user', content: notes }],
    });
  } catch (e) {
    console.error('[meetingAi] 호출 실패:', e.status ?? '', e.message);
    throw aiError('AI 액션아이템 생성에 실패했습니다. 잠시 후 다시 시도해주세요.', 502);
  }

  const toolUse = response.content.find((block) => block.type === 'tool_use');
  return normalizeItems(toolUse?.input?.items, notes);
}

module.exports = { generateActionItems };
