import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { packSiblings, packEnclose } from 'd3-hierarchy';
import { noteLabel, noteKeywords, renderNoteMarkdown } from './noteUtils';

// Design Ref: 물리 시뮬레이션(d3-force) 기반 레이아웃은 드래그할 때마다 위치가 흔들리고
// 링크 스프링을 손보다 보면 매번 다른 방식으로 부자연스러워 보이는 문제가 반복됐다.
// 사용자 요청에 따라 "같은 클러스터(연결된 노트 묶음)는 원형으로 배치하고, 클러스터들은
// 서로 겹치지 않게 균형 있게 배치"하는 결정론적(deterministic) 레이아웃으로 교체했다.
// 클러스터 간 배치(겹치지 않는 원 패킹)는 d3-hierarchy의 packSiblings를 그대로 사용—
// 이미 검증된 원 패킹 알고리즘을 직접 구현하지 않기 위함(d3-force 도입 때와 같은 이유).
const CANVAS_W = 760;
const CANVAS_H = 480;
const NODE_R = 22;
const LABEL_MAX = 10;
const DRAG_CLICK_THRESHOLD = 4; // px — 이보다 적게 움직이면 드래그가 아니라 클릭으로 취급

// 연결이 하나도 없는 노드는 글자 크기와 비슷한 점(DOT_R = 4px)에 가깝게 그린다.
// 이 최초 노드 크기(DOT_R) 자체를 한 단위로 삼아, 엣지가 EDGES_PER_STEP(3)개 늘어날
// 때마다 그 단위만큼 계단식으로 커진다: 4px(0개) → 8px(1~3개) → 12px(4~6개) → 16px(7~9개)...
const DOT_R = 4;
const EDGES_PER_STEP = 3;
function visualRadius(deg) {
  const tier = Math.ceil(deg / EDGES_PER_STEP);
  return DOT_R * (1 + tier);
}

// 노드 수가 많아지면 한눈에 다 보이도록 반지름을 비율적으로 줄인다.
// CROWD_BASE_COUNT개 이하에서는 원래 크기를 유지하고, 그 이상부터 sqrt로 완만하게 축소한다
// (선형으로 줄이면 노드가 아주 많을 때 지나치게 작아짐).
const CROWD_BASE_COUNT = 10;
function crowdScale(count) {
  return count <= CROWD_BASE_COUNT ? 1 : Math.sqrt(CROWD_BASE_COUNT / count);
}

// 클러스터(연결된 노트 묶음) 하나를 원형으로 배치할 때 쓰는 상수.
const MIN_CLUSTER_RADIUS = 28; // 가장 안쪽 원의 최소 반지름
const CLUSTER_PADDING = 24; // 클러스터끼리 팩킹할 때 서로 맞닿지 않도록 두는 여유

// 연결 많은 순으로 정렬해 20/40/60/80/100 백분위 구간(최대 5단계)으로 나누고, 안쪽 원부터
// 바깥 원으로 갈수록 연결이 적은 노드를 배치하는 "그라데이션" 동심원 구조.
// 노드가 적은 클러스터는 단계 수를 그만큼 줄여, 빈 단계 없이 자연스럽게 이어지게 한다.
const TIER_COUNT = 5;
// 같은 원 위 인접 노드 사이의 최소 호 길이 — 원끼리 다닥다닥 붙지 않고 라벨(글자)까지
// 서로 겹치지 않을 만큼 넉넉하게 잡는다.
const LABEL_SPACING = 64;
// 단계(tier)마다 시작 각도를 이만큼씩 어긋나게 돌려, 여러 단계의 노드가 한 방향으로
// 일렬 정렬되거나 특정 개수(4개 등)일 때 상하좌우 "+"자로 보이는 것을 막는다.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ≈137.5°, 해바라기 씨 배열에 쓰이는 각도

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.2;

// 선택한 노드의 1뎁스 연결 목록 — 기본 2줄 정도만 보이고 "더보기"로 펼치는 컨테이너 높이.
// TaskBacklog.jsx의 접기 UI/UX(같은 임계값 검사·같은 버튼 문구)를 그대로 재사용한다.
const NEIGHBOR_COLLAPSED_HEIGHT = 200;

function normalize(s) {
  return (s || '').trim().toLowerCase();
}

function keywordSet(note) {
  return new Set(noteKeywords(note).map(normalize));
}

function hasIntersection(a, b) {
  for (const v of a) {
    if (b.has(v)) return true;
  }
  return false;
}

// Design Ref: daily-idea-note.design.md §5.5 — 카테고리 일치 또는 키워드 교집합이면 연결
function buildLinks(notes) {
  const sets = notes.map(keywordSet);
  const categories = notes.map((n) => normalize(n.category));
  const links = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const sameCategory = categories[i] && categories[i] === categories[j];
      const sharedKeyword = hasIntersection(sets[i], sets[j]);
      if (sameCategory || sharedKeyword) links.push({ source: notes[i].id, target: notes[j].id });
    }
  }
  return links;
}

function truncate(label) {
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX)}…` : label;
}

// 링크로 연결된 노트들을 묶어 연결요소(connected component) 목록을 구한다.
// 연결이 하나도 없는 노트는 자기 자신만 담긴 크기 1짜리 클러스터가 된다.
function findClusters(notes, links) {
  const adj = new Map(notes.map((n) => [n.id, []]));
  for (const { source, target } of links) {
    adj.get(source)?.push(target);
    adj.get(target)?.push(source);
  }
  const visited = new Set();
  const clusters = [];
  for (const note of notes) {
    if (visited.has(note.id)) continue;
    const stack = [note.id];
    const group = [];
    visited.add(note.id);
    while (stack.length) {
      const id = stack.pop();
      group.push(id);
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          stack.push(nb);
        }
      }
    }
    clusters.push(group);
  }
  return clusters;
}

// 클러스터별로 노드를 원 위에 균등한 각도로 배치하고, 클러스터들은 서로 겹치지 않게
// packSiblings로 팩킹한 뒤 캔버스 중앙으로 옮긴다 — 물리 시뮬레이션 없는 결정론적 레이아웃.
function computeLayout(notes, links, degree, scale) {
  const clusters = findClusters(notes, links);

  const radiusOf = (id) => visualRadius(degree[id] ?? 0) * scale;

  const packInput = clusters.map((noteIds) => {
    const localPositions = new Map();

    if (noteIds.length === 1) {
      localPositions.set(noteIds[0], { x: 0, y: 0 });
      return { noteIds, localPositions, r: radiusOf(noteIds[0]) + CLUSTER_PADDING };
    }

    // 연결 많은 순으로 정렬해 누적 백분위(20/40/60/80/100%) 기준 최대 5단계로 나눈다.
    // 노드가 적으면 단계 수도 그만큼 줄여(예: 2개면 2단계) 빈 단계가 생기지 않게 한다.
    const sorted = [...noteIds].sort((a, b) => (degree[b] ?? 0) - (degree[a] ?? 0));
    const n = sorted.length;
    const tierCount = Math.min(TIER_COUNT, n);
    const tiers = Array.from({ length: tierCount }, () => []);
    sorted.forEach((id, i) => {
      const percentile = (i + 1) / n;
      const tierIndex = Math.min(tierCount - 1, Math.floor(percentile * tierCount));
      tiers[tierIndex].push(id);
    });

    let prevOuterEdge = 0; // 이전 단계까지 실제로 차지한 바깥쪽 경계(반지름 + 그 단계 최대 노드 크기)
    tiers.forEach((tierIds, tierIndex) => {
      const maxTierR = Math.max(...tierIds.map(radiusOf));

      // 안쪽 원 하나에 노드가 1개뿐이면 굳이 살짝 비켜 두지 않고 정중앙(0,0)에 둔다.
      if (tierIndex === 0 && tierIds.length === 1) {
        localPositions.set(tierIds[0], { x: 0, y: 0 });
        prevOuterEdge = maxTierR;
        return;
      }

      const arcRadius = (tierIds.length * LABEL_SPACING) / (2 * Math.PI);
      const minRadius = tierIndex === 0 ? MIN_CLUSTER_RADIUS : prevOuterEdge + maxTierR + LABEL_SPACING / 2;
      const ringRadius = Math.max(minRadius, arcRadius);

      // 모든 단계가 12시 방향에서 똑같이 시작하면, 노드 4개짜리 단계는 정확히 상하좌우에
      // 놓여 "+" 모양이 되고 여러 단계의 첫 노드들도 한 방향으로 일렬 정렬돼 버린다.
      // 단계마다 황금각(약 137.5°)만큼 시작 각도를 어긋나게 돌려 이런 정렬을 깨고
      // 훨씬 원형/유기적으로 보이게 한다(회전만 할 뿐 균등 간격 자체는 그대로 유지).
      const angleOffset = tierIndex * GOLDEN_ANGLE;
      tierIds.forEach((id, i) => {
        const angle = (i / tierIds.length) * Math.PI * 2 - Math.PI / 2 + angleOffset;
        localPositions.set(id, { x: Math.cos(angle) * ringRadius, y: Math.sin(angle) * ringRadius });
      });
      prevOuterEdge = ringRadius + maxTierR;
    });

    return { noteIds, localPositions, r: prevOuterEdge + CLUSTER_PADDING };
  });

  packSiblings(packInput);
  const enclose = packEnclose(packInput);
  const offsetX = CANVAS_W / 2 - enclose.x;
  const offsetY = CANVAS_H / 2 - enclose.y;

  const positions = new Map();
  for (const cluster of packInput) {
    for (const [id, local] of cluster.localPositions) {
      positions.set(id, { x: cluster.x + local.x + offsetX, y: cluster.y + local.y + offsetY });
    }
  }
  return positions;
}

// 본문이 짧으면(줄바꿈 없고 대략 한 줄 길이) 접기/펼치기 버튼 자체를 표시하지 않는다.
// DailyNoteList.jsx의 NoteCard와 동일한 규칙 — 뷰 간 공용 모듈 추출 없이 로컬로 복제하는
// 기존 프로젝트 관례를 따른다.
function isLongContent(content) {
  return !!content && (content.length > 60 || content.includes('\n'));
}

// 선택한 노드와 1뎁스로 연결된 노트를 "목록 뷰"와 동일한 카드 스타일로 보여준다
// (DailyNoteList.jsx의 NoteCard를 그대로 복제).
function ConnectedNoteCard({ note, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const long = isLongContent(note.content);

  return (
    <div className="p-4 border rounded bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          {long ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex-shrink-0 mt-0.5 text-gray-400 hover:text-gray-600"
              aria-label={expanded ? '접기' : '펼치기'}
            >
              {expanded ? '▾' : '▸'}
            </button>
          ) : (
            <span className="flex-shrink-0 w-[1em]" />
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{note.date}</span>
            {noteKeywords(note).map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">#{tag}</span>
            ))}
            {note.category && (
              <span className="px-2 py-0.5 rounded bg-green-50 text-green-600">{note.category}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onEdit(note)} className="text-xs text-gray-500 hover:text-blue-600">수정</button>
          <button onClick={() => onDelete(note.id)} className="text-xs text-gray-500 hover:text-red-500">삭제</button>
        </div>
      </div>
      <h4 className="mt-2 font-semibold text-gray-800">{noteLabel(note)}</h4>
      {note.content && (
        <div
          className={'mt-2 text-sm text-gray-700 markdown-body' + (expanded ? '' : ' line-clamp-1')}
          dangerouslySetInnerHTML={{ __html: renderNoteMarkdown(note.content) }}
        />
      )}
    </div>
  );
}

export default function DailyNoteMindMapView({ notes, onEdit, onDelete }) {
  const links = useMemo(() => buildLinks(notes), [notes]);
  const degree = useMemo(() => {
    const d = {};
    notes.forEach((n) => { d[n.id] = 0; });
    links.forEach(({ source, target }) => {
      d[source] += 1;
      d[target] += 1;
    });
    return d;
  }, [notes, links]);
  const scale = crowdScale(notes.length);
  const layout = useMemo(() => computeLayout(notes, links, degree, scale), [notes, links, degree, scale]);

  const nodesByIdRef = useRef(new Map());
  const dragRef = useRef(null); // { id, moved, offsetX, offsetY }
  const svgRef = useRef(null);
  const [, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredId, setHoveredId] = useState(null);

  // notes/links가 바뀔 때마다(추가/수정/삭제) 레이아웃을 새로 계산해 덮어쓴다 — 드래그로
  // 옮겼던 위치는 유지하지 않고 항상 자동 배치로 되돌아간다("균형 잡힌 구조"를 계속 보장).
  useEffect(() => {
    const next = new Map();
    for (const note of notes) {
      const p = layout.get(note.id) ?? { x: CANVAS_W / 2, y: CANVAS_H / 2 };
      next.set(note.id, { id: note.id, x: p.x, y: p.y });
    }
    nodesByIdRef.current = next;
    setTick((t) => t + 1);
  }, [layout]);

  // 확대(zoom) 중에는 svg viewBox가 CANVAS_W x CANVAS_H의 일부만 보여주므로,
  // 화면 좌표 → 캔버스 좌표 변환도 현재 뷰포트(viewX/Y/W/H) 기준으로 다시 계산해야 한다.
  const viewW = CANVAS_W / zoom;
  const viewH = CANVAS_H / zoom;
  const viewX = (CANVAS_W - viewW) / 2;
  const viewY = (CANVAS_H - viewH) / 2;

  const toCanvasPoint = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: viewX + ((e.clientX - rect.left) / rect.width) * viewW,
      y: viewY + ((e.clientY - rect.top) / rect.height) * viewH,
    };
  }, [viewX, viewY, viewW, viewH]);

  // 드래그는 순수하게 그 노드만 옮긴다 — 연결된 다른 노드에는 전혀 영향을 주지 않는다.
  // 다음에 notes/links가 바뀌면 위 useEffect가 다시 자동 배치로 되돌린다.
  const handlePointerDown = (noteId) => (e) => {
    e.stopPropagation();
    const node = nodesByIdRef.current.get(noteId);
    if (!node) return;
    const p = toCanvasPoint(e);
    dragRef.current = { id: noteId, moved: 0, offsetX: p.x - node.x, offsetY: p.y - node.y };
    setHoveredId(null); // 드래그 중에는 툴팁이 손가락/커서를 따라다니며 거슬리지 않도록 숨김
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    const node = nodesByIdRef.current.get(drag.id);
    if (!node) return;
    const p = toCanvasPoint(e);
    const nx = Math.min(CANVAS_W - NODE_R, Math.max(NODE_R, p.x - drag.offsetX));
    const ny = Math.min(CANVAS_H - NODE_R, Math.max(NODE_R, p.y - drag.offsetY));
    drag.moved += Math.abs(nx - node.x) + Math.abs(ny - node.y);
    node.x = nx;
    node.y = ny;
    setTick((t) => t + 1);
  };

  const endDrag = (noteId) => () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (drag.moved < DRAG_CLICK_THRESHOLD) setSelectedId(noteId);
  };

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  // 선택한 노드와 1뎁스로 연결된 노트 목록 — 목록 뷰와 동일한 카드로 하단에 쭉 보여준다.
  const neighborNotes = useMemo(() => {
    if (!selectedId) return [];
    const neighborIds = new Set();
    for (const link of links) {
      if (link.source === selectedId) neighborIds.add(link.target);
      else if (link.target === selectedId) neighborIds.add(link.source);
    }
    return notes.filter((n) => neighborIds.has(n.id));
  }, [selectedId, links, notes]);

  const [neighborsExpanded, setNeighborsExpanded] = useState(false);
  const [neighborsOverflowing, setNeighborsOverflowing] = useState(false);
  const neighborListRef = useRef(null);

  // 다른 노드를 선택하면 목록도 다시 접힌 상태로 시작한다.
  useEffect(() => setNeighborsExpanded(false), [selectedId]);

  // TaskBacklog.jsx와 동일한 방식 — 실제로 2줄보다 많이 잘릴 때만 더보기/접기 버튼을 보여준다.
  useLayoutEffect(() => {
    const el = neighborListRef.current;
    if (!el) return;
    setNeighborsOverflowing(el.scrollHeight > NEIGHBOR_COLLAPSED_HEIGHT + 1);
  }, [neighborNotes]);

  if (notes.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">아직 작성된 아이디어가 없습니다.</p>;
  }

  // 호버된 노드의 키워드 툴팁 위치 — 노드 위쪽 중앙에 띄우되, 현재 확대 뷰포트를 벗어나지
  // 않도록 clamp한다.
  const TOOLTIP_W = 160;
  const hoveredNode = hoveredId ? nodesByIdRef.current.get(hoveredId) : null;
  const hoveredNoteData = hoveredId ? notes.find((n) => n.id === hoveredId) : null;
  const hoveredKeywords = hoveredNoteData ? noteKeywords(hoveredNoteData) : [];
  let tooltipX = 0;
  let tooltipY = 0;
  if (hoveredNode) {
    const hoveredR = visualRadius(degree[hoveredId] ?? 0) * scale;
    tooltipX = Math.min(Math.max(hoveredNode.x - TOOLTIP_W / 2, viewX + 4), viewX + viewW - TOOLTIP_W - 4);
    tooltipY = Math.max(hoveredNode.y - hoveredR - 46, viewY + 4);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative border rounded bg-white overflow-hidden" style={{ touchAction: 'none' }}>
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded bg-white/90 shadow px-1 py-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))}
            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
            aria-label="축소"
          >
            −
          </button>
          <span className="text-[11px] text-gray-400 w-9 text-center select-none">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))}
            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded"
            aria-label="확대"
          >
            +
          </button>
        </div>
        <svg
          ref={svgRef}
          viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
          className="w-full"
          style={{ height: CANVAS_H }}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerLeave={() => { dragRef.current = null; }}
        >
          {links.map((link, i) => {
            const a = nodesByIdRef.current.get(link.source);
            const b = nodesByIdRef.current.get(link.target);
            if (!a || !b) return null;
            const touchesSelected = a.id === selectedId || b.id === selectedId;
            const draggedId = dragRef.current?.id;
            // 양 끝 노드 중 드래그 중인 노드가 있으면 그 끝은 커서와 함께 즉시 움직여야 하므로
            // transition을 걸지 않는다 — 그래야 원(위에서 transition 적용)과 선이 따로 놀지 않는다.
            const isDraggingEndpoint = a.id === draggedId || b.id === draggedId;
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={touchesSelected ? '#93c5fd' : '#e2e8f0'}
                strokeWidth={touchesSelected ? 2.5 : 1.5}
                style={{ transition: isDraggingEndpoint ? 'none' : 'x1 200ms ease-out, y1 200ms ease-out, x2 200ms ease-out, y2 200ms ease-out' }}
              />
            );
          })}
          {notes.map((note) => {
            const node = nodesByIdRef.current.get(note.id);
            if (!node) return null;
            const isSelected = note.id === selectedId;
            const r = visualRadius(degree[note.id] ?? 0) * scale;
            // 드래그 중인 노드 자신은 커서와 1:1로 붙어야 하므로 transition을 걸지 않는다.
            // 그 외 노드는 레이아웃이 재계산될 때 위치가 즉시 바뀌면서 뚝뚝 끊겨 보이지 않도록
            // transform에 transition을 걸어 매끄럽게 이동시킨다.
            const isDragging = dragRef.current?.id === note.id;
            return (
              <g
                key={note.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ transition: isDragging ? 'none' : 'transform 200ms ease-out' }}
                onPointerDown={handlePointerDown(note.id)}
                onPointerUp={endDrag(note.id)}
                onMouseEnter={() => setHoveredId(note.id)}
                onMouseLeave={() => setHoveredId((id) => (id === note.id ? null : id))}
                className="cursor-pointer"
              >
                <circle
                  r={r}
                  fill={isSelected ? '#3b82f6' : '#dbeafe'}
                  stroke={isSelected ? '#1d4ed8' : '#93c5fd'}
                  strokeWidth={isSelected ? 2 : 1}
                  style={{ transition: 'r 250ms ease-out' }}
                />
                <text
                  textAnchor="middle"
                  dy={r + 14}
                  fontSize={11 * Math.max(scale, 0.7)}
                  fill={isSelected ? '#1e3a8a' : '#334155'}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {truncate(noteLabel(note))}
                </text>
              </g>
            );
          })}
          {hoveredNode && hoveredKeywords.length > 0 && (
            <foreignObject x={tooltipX} y={tooltipY} width={TOOLTIP_W} height={90} style={{ pointerEvents: 'none', overflow: 'visible' }}>
              <div className="flex flex-wrap gap-1 rounded-md bg-gray-900/70 px-2 py-1.5 text-[10px] leading-tight text-white shadow-lg">
                {hoveredKeywords.map((k) => (
                  <span key={k} className="whitespace-nowrap rounded-full bg-white/20 px-1.5 py-0.5">#{k}</span>
                ))}
              </div>
            </foreignObject>
          )}
        </svg>
      </div>
      <p className="text-[11px] text-gray-400 -mt-2">노드를 드래그해 옮기거나 클릭해 상세 내용을 볼 수 있습니다. 우측 상단 −/+ 로 확대·축소할 수 있습니다.</p>

      {selectedNote && (
        <div className="p-4 border rounded bg-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{selectedNote.date}</span>
              {noteKeywords(selectedNote).map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">#{tag}</span>
              ))}
              {selectedNote.category && (
                <span className="px-2 py-0.5 rounded bg-green-50 text-green-600">{selectedNote.category}</span>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => onEdit(selectedNote)} className="text-xs text-gray-500 hover:text-blue-600">수정</button>
              <button
                onClick={() => {
                  onDelete(selectedNote.id);
                  setSelectedId(null);
                }}
                className="text-xs text-gray-500 hover:text-red-500"
              >
                삭제
              </button>
            </div>
          </div>
          <h4 className="mt-2 font-semibold text-gray-800">{noteLabel(selectedNote)}</h4>
          {selectedNote.content && (
            <div
              className="mt-2 text-sm text-gray-700 markdown-body"
              dangerouslySetInnerHTML={{ __html: renderNoteMarkdown(selectedNote.content) }}
            />
          )}
        </div>
      )}

      {selectedNote && neighborNotes.length > 0 && (
        <div className="flex flex-col gap-2">
          <h5 className="text-xs font-semibold text-gray-500">연결된 노트 ({neighborNotes.length})</h5>
          <div
            ref={neighborListRef}
            className="flex flex-col gap-3"
            style={{
              maxHeight: neighborsExpanded ? 'none' : NEIGHBOR_COLLAPSED_HEIGHT,
              overflow: neighborsExpanded ? 'visible' : 'hidden',
            }}
          >
            {neighborNotes.map((note) => (
              <ConnectedNoteCard key={note.id} note={note} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
          {neighborsOverflowing && (
            <button
              onClick={() => setNeighborsExpanded((v) => !v)}
              className="mt-1 text-xs text-gray-500 hover:text-blue-600"
            >
              {neighborsExpanded ? '접기 ▲' : `더보기 (총 ${neighborNotes.length}개) ▼`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
