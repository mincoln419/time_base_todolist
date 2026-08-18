// 자정 기준 분(minute) 값을 "HH:MM" 문자열로 변환
export function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
