// Design Ref: §5.3 — 외부 LLM 호출은 라우트와 분리된 서비스로 격리 (services/notifications.js와 동일 패턴)
// API 키는 process.env.QWEN_KEY로만 읽는다 (프로젝트 루트 .env, gitignored) — 코드에 값 하드코딩 금지

const DEFAULT_API_URL = 'https://ws-njn2s84z1yxzk1nf.ap-northeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions';
const MEETING_AI_API_URL = process.env.MEETING_AI_API_URL || DEFAULT_API_URL;
const MEETING_AI_MODEL = process.env.MEETING_AI_MODEL || 'qwen3.8-max';
const VALID_STATUSES = new Set(['대기', '진행중', '완료']);

const SYSTEM_PROMPT = `당신은 회의록에서 액션아이템(후속 조치)만 추출하는 도구입니다.
아래 회의 원문을 읽고, 각 액션아이템을 다음 필드를 가진 JSON 객체로 추출해
JSON 배열 하나만 응답하세요. 다른 설명, 마크다운, 코드펜스는 포함하지 마세요.

- task_type: 업무 구분(예: "Release", "MCP", "북미 SDS" 등 원문에 드러난 카테고리, 없으면 "기타")
- content: 액션아이템 내용 (한 문장 요약)
- status: "대기" | "진행중" | "완료" 중 하나 (원문에 "진행 중"이 있으면 "진행중", "완료"/"됨"이 있으면 "완료", 그 외 "대기")
- due_date: 원문에 표현된 일정/기한 문구를 그대로 (예: "8/27", "금일 오후", "목요일"), 없으면 null
- assignee: 담당자/담당 파트 (예: "BE", "지니", "박찬준"), 없으면 null

예시 응답: [{"task_type":"Release","content":"3.0.1 Jackson 호환 Hotfix","status":"진행중","due_date":"진행 중","assignee":"BE"}]`;

function parseActionItems(text, rawNotes) {
  const cleaned = String(text ?? '').replace(/```json|```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const rawItems = Array.isArray(parsed) ? parsed : parsed.items;
    const items = (rawItems ?? [])
      .map((item) => ({
        task_type: String(item.task_type ?? '기타').trim() || '기타',
        content: String(item.content ?? '').trim(),
        status: VALID_STATUSES.has(item.status) ? item.status : '대기',
        due_date: item.due_date ? String(item.due_date).trim() : null,
        assignee: item.assignee ? String(item.assignee).trim() : null,
      }))
      .filter((item) => item.content);
    if (items.length === 0) throw new Error('empty');
    return items;
  } catch {
    // FR-13: 파싱 실패 시 원문을 잃지 않도록 단일 항목으로 대체 저장
    return [{
      task_type: '기타',
      content: (cleaned || rawNotes).slice(0, 500),
      status: '대기',
      due_date: null,
      assignee: null,
    }];
  }
}

async function generateActionItems(notes) {
  const apiKey = process.env.QWEN_KEY;
  if (!apiKey || !MEETING_AI_API_URL) {
    const err = new Error('AI 기능이 설정되지 않았습니다. 서버 관리자에게 문의해주세요.');
    err.status = 500;
    throw err;
  }

  let response;
  try {
    response = await fetch(MEETING_AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MEETING_AI_MODEL,
        // 원인: "thinking" 모드가 켜져 있으면 응답에 30초~2분(때로는 그 이상) 걸리고,
        // 그사이 업스트림 게이트웨이가 자체 타임아웃으로 502를 반환하는 현상을 실측 확인.
        // 이 작업은 단순 추출이라 reasoning이 불필요하므로 꺼서 지연/502를 근본적으로 줄인다(3~4초로 단축 확인).
        enable_thinking: false,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: notes },
        ],
      }),
    });
  } catch (e) {
    console.error('[meetingAi] 호출 실패:', e.message);
    const err = new Error('AI 액션아이템 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    err.status = 502;
    throw err;
  }

  if (!response.ok) {
    console.error(`[meetingAi] 응답 오류: ${response.status}`);
    const err = new Error('AI 액션아이템 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return parseActionItems(text, notes);
}

module.exports = { generateActionItems };
