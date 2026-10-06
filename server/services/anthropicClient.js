// Claude(Anthropic) 클라이언트 — 데일리노트 태그 추출(noteTags.js)과 회의록 액션아이템 생성(meetingAi.js)이 공유한다.
// API 키는 프로젝트 루트 .env(gitignored)의 CLAUDE_KEY(오탈자 CLAUD_KEY도 지원)로만 읽는다.
const Anthropic = require('@anthropic-ai/sdk');

const ANTHROPIC_API_KEY = process.env.CLAUDE_KEY || process.env.CLAUD_KEY;
// 워크스페이스에 묶이지 않은 키는 요청마다 사용할 워크스페이스를 헤더로 지정해야 한다(없으면 400).
// 워크스페이스용 키를 쓰면 비워 둔다.
const WORKSPACE_ID = process.env.CLAUDE_WORKSPACE_ID;

const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
      ...(WORKSPACE_ID ? { defaultHeaders: { 'anthropic-workspace-id': WORKSPACE_ID } } : {}),
    })
  : null;

module.exports = { anthropic };
