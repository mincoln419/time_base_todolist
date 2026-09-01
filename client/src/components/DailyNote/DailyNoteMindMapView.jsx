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
// 그 범위를 벗어난 연결(link)만 REST_MIN 또는 REST_MAX로 끌어온다.
// 드래그로 고정된(fx/fy) 노드는 다른 쪽이 전량 흡수하도록 d3의 fx/fy 관례를 그대로 활용한다
// (fx/fy가 설정된 노드는 매 tick 끝에 시뮬레이션이 좌표를 강제로 덮어쓰므로, 여기서 속도를
// 더해도 무해하다 — 굳이 분기 처리하지 않아도 됨).
function slackLinkForce() {
  let links = [];
  let nodeById = new Map();

  // 속도(velocity) 기반 스프링이 아니라 위치를 직접 보정한다 — alpha가 줄어들며
  // 힘이 약해지는 일반 d3 force와 달리, 이 힘은 alpha와 무관하게 매 tick마다
  // 정확히 REST_MIN/REST_MAX로 스냅해야 "그 범위 밖에서만 정확히 그 값으로
  // 맞춰진다"는 요구사항을 alpha 감쇠 타이밍에 상관없이 항상 만족시킬 수 있다.
  function force() {
    for (const link of links) {
      const a = nodeById.get(link.source);
      const b = nodeById.get(link.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const target = dist > STRETCH_LIMIT ? REST_MAX : dist < REST_MIN ? REST_MIN : null;
      if (target === null) continue;

      const corr = dist - target;
      const ux = dx / dist;
      const uy = dy / dist;
      const aFixed = a.fx != null; // 드래그로 고정된 노드는 건드리지 않는다
      const bFixed = b.fx != null;
      const ratioA = aFixed ? 0 : bFixed ? 1 : 0.5;
      const ratioB = 1 - ratioA;

      if (!aFixed) {
        a.x += ux * corr * ratioA;
        a.y += uy * corr * ratioA;
        a.vx = 0;
        a.vy = 0;
      }
      if (!bFixed) {
        b.x -= ux * corr * ratioB;
        b.y -= uy * corr * ratioB;
        b.vx = 0;
        b.vy = 0;
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

  function force() {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        if (linkKeySet.has(`${a.id}-${b.id}`) || linkKeySet.has(`${b.id}-${a.id}`)) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distSq = Math.max(dx * dx + dy * dy, 4);
        const f = strength / distSq;
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
  const dragRef = useRef(null); // { id, moved }
  const svgRef = useRef(null);
  const [, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  degreeRef.current = degree; // forceCollide의 radius 접근자가 항상 최신 degree를 읽도록

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
        .force('collide', forceCollide().radius((d) => 15 + Math.min(degreeRef.current[d.id] ?? 0, 5)))
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

  const toCanvasPoint = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }, []);

  const handlePointerDown = (noteId) => (e) => {
    e.stopPropagation();
    const node = nodesByIdRef.current.get(noteId);
    if (!node) return;
    const p = toCanvasPoint(e);
    dragRef.current = { id: noteId, moved: 0, offsetX: p.x - node.x, offsetY: p.y - node.y };
    node.fx = node.x;
    node.fy = node.y;
    simRef.current?.alphaTarget(0.2).restart();
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
    simRef.current?.alphaTarget(0);
    if (drag.moved < DRAG_CLICK_THRESHOLD) setSelectedId(noteId);
  };

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  if (notes.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">아직 작성된 아이디어가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="border rounded bg-white overflow-hidden" style={{ touchAction: 'none' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          className="w-full"
          style={{ height: CANVAS_H }}
          onPointerMove={handlePointerMove}
          onPointerUp={() => { dragRef.current = null; simRef.current?.alphaTarget(0); }}
          onPointerLeave={() => { if (dragRef.current) { dragRef.current = null; simRef.current?.alphaTarget(0); } }}
        >
          {links.map((link, i) => {
            const a = nodesByIdRef.current.get(link.source);
            const b = nodesByIdRef.current.get(link.target);
            if (!a || !b) return null;
            const touchesSelected = a.id === selectedId || b.id === selectedId;
            return (
              <line
                key={i}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={touchesSelected ? '#93c5fd' : '#e2e8f0'}
                strokeWidth={touchesSelected ? 2.5 : 1.5}
              />
            );
          })}
          {notes.map((note) => {
            const node = nodesByIdRef.current.get(note.id);
            if (!node) return null;
            const isSelected = note.id === selectedId;
            const r = NODE_R + Math.min(degree[note.id] ?? 0, 5) * 2;
            return (
              <g
                key={note.id}
                transform={`translate(${node.x}, ${node.y})`}
                onPointerDown={handlePointerDown(note.id)}
                onPointerUp={endDrag(note.id)}
                className="cursor-pointer"
              >
                <circle
                  r={r}
                  fill={isSelected ? '#3b82f6' : '#dbeafe'}
                  stroke={isSelected ? '#1d4ed8' : '#93c5fd'}
                  strokeWidth={isSelected ? 2 : 1}
                />
                <text
                  textAnchor="middle"
                  dy={r + 14}
                  fontSize="11"
                  fill={isSelected ? '#1e3a8a' : '#334155'}
                  fontWeight={isSelected ? 'bold' : 'normal'}
                >
                  {truncate(noteLabel(note))}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-[11px] text-gray-400 -mt-2">노드를 드래그해 옮기거나 클릭해 상세 내용을 볼 수 있습니다.</p>

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
