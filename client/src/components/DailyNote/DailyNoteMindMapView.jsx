import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { forceSimulation, forceCollide, forceCenter } from 'd3-force';
import { noteLabel, noteKeywords, renderNoteMarkdown } from './noteUtils';

// Design Ref: 사용자가 참고로 제공한 D3 force-directed 마인드맵(d3.forceSimulation +
// forceManyBody/forceCollide/forceCenter + drag)을 본떠 d3-force를 물리 엔진으로 채택.
// DOM 바인딩은 d3-selection이 아니라 React+SVG로 직접 렌더링한다(jQuery/d3-selection 미사용).
const CANVAS_W = 760;
const CANVAS_H = 480;
const NODE_R = 22;
const LABEL_MAX = 10;
const DRAG_CLICK_THRESHOLD = 4; // px — 이보다 적게 움직이면 드래그가 아니라 클릭으로 취급

// 연결된 두 노드는 REST_MIN~STRETCH_LIMIT 사이에서는 서로 아무 힘도 주고받지 않고
// 자유롭게 줄었다 늘었다 한다. REST_MIN 아래로 압축되면 정확히 REST_MIN까지만 밀어내고,
// STRETCH_LIMIT을 넘어 늘어나면 REST_MAX 거리로 끌고 와서 유지한다.
const REST_MIN = 40;
const REST_MAX = 200;
const STRETCH_LIMIT = 250;

// 연결이 하나도 없는 노드는 글자 크기와 비슷한 점(DOT_R = 4px)에 가깝게 그린다.
// 이 최초 노드 크기(DOT_R) 자체를 한 단위로 삼아, 엣지가 EDGES_PER_STEP(3)개 늘어날
// 때마다 그 단위만큼 계단식으로 커진다: 4px(0개) → 8px(1~3개) → 12px(4~6개) → 16px(7~9개)...
// collide 힘의 반지름은 시각 반지름보다 살짝 작게 잡아 REST_MIN(40)과의 충돌 여지를 줄인다.
const DOT_R = 4;
const EDGES_PER_STEP = 3;
function visualRadius(deg) {
  const tier = Math.ceil(deg / EDGES_PER_STEP);
  return DOT_R * (1 + tier);
}
function collideRadius(deg) {
  return Math.max(3, visualRadius(deg) * 0.75);
}

// 노드 수가 많아지면 한눈에 다 보이도록 반지름을 비율적으로 줄인다.
// CROWD_BASE_COUNT개 이하에서는 원래 크기를 유지하고, 그 이상부터 sqrt로 완만하게 축소한다
// (선형으로 줄이면 노드가 아주 많을 때 지나치게 작아짐).
const CROWD_BASE_COUNT = 10;
function crowdScale(count) {
  return count <= CROWD_BASE_COUNT ? 1 : Math.sqrt(CROWD_BASE_COUNT / count);
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.2;

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

// 커스텀 d3 force: REST_MIN~STRETCH_LIMIT 구간에서는 아무 힘도 주지 않고,
// 그 범위를 벗어난 연결(link)만 REST_MIN 또는 REST_MAX 쪽으로 서서히 끌어온다.
// 드래그로 고정된(fx/fy) 노드는 다른 쪽이 전량 흡수하도록 d3의 fx/fy 관례를 그대로 활용한다
// (fx/fy가 설정된 노드는 매 tick 끝에 시뮬레이션이 좌표를 강제로 덮어쓰므로, 여기서 속도를
// 더해도 무해하다 — 굳이 분기 처리하지 않아도 됨).
const SLACK_SPRING_STRENGTH = 0.3;

function slackLinkForce() {
  let links = [];
  let nodeById = new Map();

  // 위치를 직접 스냅하고 속도를 0으로 지우면, 경계를 넘는 순간 갑자기 멈췄다가
  // 다음 tick에 다시 움직여 "틱틱" 끊겨 보인다. 다른 d3 force들처럼 alpha로 감쇠되는
  // 속도 기반 스프링으로 바꿔 기존 움직임(velocity)을 보존한 채 자연스럽게 수렴시킨다.
  function force(alpha) {
    for (const link of links) {
      const a = nodeById.get(link.source);
      const b = nodeById.get(link.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const target = dist > STRETCH_LIMIT ? REST_MAX : dist < REST_MIN ? REST_MIN : null;
      if (target === null) continue;

      const corr = (dist - target) * SLACK_SPRING_STRENGTH * alpha;
      const ux = dx / dist;
      const uy = dy / dist;
      const aFixed = a.fx != null; // 드래그로 고정된 노드는 건드리지 않는다
      const bFixed = b.fx != null;
      const ratioA = aFixed ? 0 : bFixed ? 1 : 0.5;
      const ratioB = 1 - ratioA;

      if (!aFixed) {
        a.vx += ux * corr * ratioA;
        a.vy += uy * corr * ratioA;
      }
      if (!bFixed) {
        b.vx -= ux * corr * ratioB;
        b.vy -= uy * corr * ratioB;
      }
    }
  }

  force.initialize = (nodes) => {
    nodeById = new Map(nodes.map((n) => [n.id, n]));
  };
  force.links = (_links) => {
    if (_links === undefined) return links;
    links = _links;
    return force;
  };
  return force;
}

// 커스텀 d3 force: 일반 반발력(다른 클러스터끼리 겹치지 않게)이지만, 연결(link)된 쌍은
// 제외한다 — d3의 기본 forceManyBody는 모든 쌍에 적용되어 slackLinkForce의 정확한
// REST_MIN/REST_MAX 수렴을 방해하므로, 연결 안 된 쌍에만 반발력을 적용하는 버전을 직접 구현.
function pairRepulseForce(strength) {
  let nodes = [];
  let linkKeySet = new Set();

  // d3의 기본 힘(forceManyBody 등)과 마찬가지로 alpha를 강도에 곱해야 한다 — alpha를
  // 무시하면 시뮬레이션이 식어도(alpha→0) 반발력이 줄지 않아 slackLinkForce의 순간 스냅과
  // 끝없이 밀고 당기며 진동한다(노드가 절대 정지하지 못함).
  function force(alpha) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (linkKeySet.has(`${a.id}-${b.id}`) || linkKeySet.has(`${b.id}-${a.id}`)) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = Math.max(dx * dx + dy * dy, 4);
        const f = (strength * alpha) / distSq;
        const dist = Math.sqrt(distSq);
        const fx = (dx / dist) * f;
        const fy = (dy / dist) * f;
        if (a.fx == null) { a.vx += fx; a.vy += fy; }
        if (b.fx == null) { b.vx -= fx; b.vy -= fy; }
      }
    }
  }

  force.initialize = (_nodes) => { nodes = _nodes; };
  force.links = (_links) => {
    if (_links === undefined) return [...linkKeySet];
    linkKeySet = new Set(_links.map((l) => `${l.source}-${l.target}`));
    return force;
  };
  return force;
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

  const simRef = useRef(null);
  const nodesByIdRef = useRef(new Map());
  const degreeRef = useRef({});
  const crowdScaleRef = useRef(1);
  const dragRef = useRef(null); // { id, moved }
  const svgRef = useRef(null);
  const [, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [hoveredId, setHoveredId] = useState(null);

  degreeRef.current = degree; // forceCollide의 radius 접근자가 항상 최신 degree를 읽도록
  crowdScaleRef.current = crowdScale(notes.length);

  // 시뮬레이션 생성/노트 변경 시 노드·링크 동기화 (기존 위치는 최대한 보존)
  useEffect(() => {
    const prevById = nodesByIdRef.current;
    const simNodes = notes.map((note, i) => {
      const prev = prevById.get(note.id);
      if (prev) return prev;
      const angle = (i / Math.max(notes.length, 1)) * Math.PI * 2;
      const radius = 90 + (i % 3) * 40;
      return {
        id: note.id,
        x: CANVAS_W / 2 + Math.cos(angle) * radius,
        y: CANVAS_H / 2 + Math.sin(angle) * radius,
      };
    });
    const nextById = new Map(simNodes.map((n) => [n.id, n]));
    nodesByIdRef.current = nextById;

    if (!simRef.current) {
      simRef.current = forceSimulation(simNodes)
        .force('repulse', pairRepulseForce(8000))
        // 충돌 반경은 NODE_R(시각적 원 크기)보다 작게 잡는다 — REST_MIN(40)이 원 지름(44)보다
        // 작아, forceCollide의 기본 최소거리가 REST_MIN보다 크면 slackLink의 정확한 40px
        // 수렴과 계속 충돌한다. 최소한의 겹침 방지(완전 포개짐 방지)만 담당하도록 축소.
        .force('collide', forceCollide().radius((d) => collideRadius(degreeRef.current[d.id] ?? 0) * crowdScaleRef.current))
        .force('center', forceCenter(CANVAS_W / 2, CANVAS_H / 2).strength(0.03))
        .force('slackLink', slackLinkForce())
        .on('tick', () => setTick((t) => t + 1));
    } else {
      simRef.current.nodes(simNodes);
    }
    simRef.current.force('slackLink').links(links);
    simRef.current.force('repulse').links(links);
    simRef.current.alpha(0.4).restart();
  }, [notes, links]);

  useEffect(() => () => simRef.current?.stop(), []);

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

  // 드래그 중에는 전체 시뮬레이션(alphaTarget)을 다시 데우지 않는다 — repulse는 링크로
  // 연결되지 않은 모든 쌍에 작용하므로, 전체를 재가열하면 드래그와 무관한 노드까지
  // 밀려나 움직인다. 대신 드래그되는 노드에 직접 연결된 이웃에만, 늘어나거나 눌린
  // 만큼(REST_MIN/REST_MAX)만 국소적으로 위치를 보정한다.
  const pullDirectNeighbors = (draggedId) => {
    const dragged = nodesByIdRef.current.get(draggedId);
    if (!dragged) return;
    for (const link of links) {
      const neighborId = link.source === draggedId ? link.target : link.target === draggedId ? link.source : null;
      if (!neighborId) continue;
      const neighbor = nodesByIdRef.current.get(neighborId);
      if (!neighbor || neighbor.fx != null) continue; // 다른 드래그로 고정된 노드는 건드리지 않음
      const dx = neighbor.x - dragged.x;
      const dy = neighbor.y - dragged.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const target = dist > STRETCH_LIMIT ? REST_MAX : dist < REST_MIN ? REST_MIN : null;
      if (target === null) continue;
      const ux = dx / dist;
      const uy = dy / dist;
      neighbor.x = dragged.x + ux * target;
      neighbor.y = dragged.y + uy * target;
    }
  };

  const handlePointerDown = (noteId) => (e) => {
    e.stopPropagation();
    const node = nodesByIdRef.current.get(noteId);
    if (!node) return;
    const p = toCanvasPoint(e);
    dragRef.current = { id: noteId, moved: 0, offsetX: p.x - node.x, offsetY: p.y - node.y };
    node.fx = node.x;
    node.fy = node.y;
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
    drag.moved += Math.abs(nx - node.fx) + Math.abs(ny - node.fy);
    node.fx = nx;
    node.fy = ny;
    node.x = nx;
    node.y = ny;
    pullDirectNeighbors(drag.id);
    setTick((t) => t + 1); // 시뮬레이션이 멈춰 있어도(tick 이벤트 없음) 드래그 중 위치를 반영
  };

  const endDrag = (noteId) => () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const node = nodesByIdRef.current.get(drag.id);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    if (drag.moved < DRAG_CLICK_THRESHOLD) setSelectedId(noteId);
  };

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  if (notes.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">아직 작성된 아이디어가 없습니다.</p>;
  }

  const scale = crowdScaleRef.current;

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
                style={{ transition: isDraggingEndpoint ? 'none' : 'x1 150ms ease-out, y1 150ms ease-out, x2 150ms ease-out, y2 150ms ease-out' }}
              />
            );
          })}
          {notes.map((note) => {
            const node = nodesByIdRef.current.get(note.id);
            if (!node) return null;
            const isSelected = note.id === selectedId;
            const r = visualRadius(degree[note.id] ?? 0) * scale;
            // 드래그 중인 노드 자신은 커서와 1:1로 붙어야 하므로 transition을 걸지 않는다.
            // 그 외 노드(특히 드래그로 늘어난 링크에 끌려오는 이웃)는 위치가 목표 거리로
            // 즉시 스냅되면서 뚝뚝 끊겨 보였는데, transform에 transition을 걸어 매끄럽게 만든다.
            const isDragging = dragRef.current?.id === note.id;
            return (
              <g
                key={note.id}
                transform={`translate(${node.x}, ${node.y})`}
                style={{ transition: isDragging ? 'none' : 'transform 150ms ease-out' }}
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
    </div>
  );
}
