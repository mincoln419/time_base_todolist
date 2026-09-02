// Firestore 컬렉션 이름 상수 — 여러 라우트 파일에서 문자열 오타로 의도치 않은 새
// 컬렉션이 생기는 걸 막기 위해 한 곳에 모아둔다.
//
// 자식 리소스(tickets/subgoals/requirements/rewards/member tasks/meeting item들)는
// 수정·삭제 라우트가 부모 id 없이 자기 id만으로 접근하므로(예: PATCH /api/tickets/:id),
// 서브컬렉션 대신 SQLite와 동일한 FK 필드(customer_id, goal_id, member_id, meeting_id)를
// 가진 최상위 컬렉션으로 둔다 — collectionGroup 쿼리/필드 인덱스 설정이 필요 없어진다.
// worries/{id}/attempts/{date}만 예외: 모든 라우트가 항상 부모(worry) id를 경로에 포함하고
// 있어 서브컬렉션 + 문서ID=date 조합이 복합키 upsert를 그대로 단순하게 만들어준다.
module.exports = {
  TASKS: 'tasks',
  SCHEDULES: 'schedules',
  SCHEDULE_SLOTS: 'scheduleSlots',
  FOCUS_MAP: 'focusMap',
  NOTIFICATION_WEBHOOKS: 'notificationWebhooks',
  CUSTOMERS: 'customers',
  TICKETS: 'tickets', // top-level, customer_id 필드
  WORRIES: 'worries',
  WORRY_ATTEMPTS: 'attempts', // worries/{id}/attempts 서브컬렉션 이름
  LONG_GOALS: 'longGoals',
  LONG_GOAL_SUBGOALS: 'longGoalSubgoals', // top-level, goal_id 필드
  LONG_GOAL_REQUIREMENTS: 'longGoalRequirements', // top-level, goal_id 필드
  LONG_GOAL_REWARDS: 'longGoalRewards', // top-level, goal_id 필드
  BUCKET_LIST_ITEMS: 'bucketListItems',
  WARROOM_RAILS: 'warroomRails',
  WARROOM_MEMBERS: 'warroomMembers',
  WARROOM_MEMBER_TASKS: 'warroomMemberTasks', // top-level, member_id 필드
  DAILY_NOTES: 'dailyNotes',
  MEETINGS: 'meetings',
  MEETING_OVERALL_ITEMS: 'meetingOverallItems', // top-level, meeting_id 필드
  MEETING_PART_ITEMS: 'meetingPartItems', // top-level, meeting_id 필드
  MEETING_ACTION_ITEMS: 'meetingActionItems', // top-level, meeting_id 필드
  COUNTERS: '_counters',

  // _counters 문서 ID — 위 컬렉션 이름과 1:1로 대응(전부 top-level이 되어 이제 충돌 걱정 없음).
  COUNTER_KEYS: {
    TASKS: 'tasks',
    SCHEDULES: 'schedules',
    FOCUS_MAP: 'focusMap',
    NOTIFICATION_WEBHOOKS: 'notificationWebhooks',
    CUSTOMERS: 'customers',
    TICKETS: 'tickets',
    WORRIES: 'worries',
    LONG_GOALS: 'longGoals',
    LONG_GOAL_SUBGOALS: 'longGoalSubgoals',
    LONG_GOAL_REQUIREMENTS: 'longGoalRequirements',
    LONG_GOAL_REWARDS: 'longGoalRewards',
    BUCKET_LIST_ITEMS: 'bucketListItems',
    WARROOM_RAILS: 'warroomRails',
    WARROOM_MEMBERS: 'warroomMembers',
    WARROOM_MEMBER_TASKS: 'warroomMemberTasks',
    DAILY_NOTES: 'dailyNotes',
    MEETINGS: 'meetings',
    MEETING_OVERALL_ITEMS: 'meetingOverallItems',
    MEETING_PART_ITEMS: 'meetingPartItems',
    MEETING_ACTION_ITEMS: 'meetingActionItems',
  },
};
