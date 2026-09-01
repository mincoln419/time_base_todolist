import { useMemo, useState } from 'react';
import { noteLabel, noteKeywords, renderNoteMarkdown } from './noteUtils';

const NODE_RADIUS = 24;
const LABEL_MAX = 8;

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
function buildEdges(notes) {
  const sets = notes.map(keywordSet);
  const categories = notes.map((n) => normalize(n.category));
  const edges = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const sameCategory = categories[i] && categories[i] === categories[j];
      const sharedKeyword = hasIntersection(sets[i], sets[j]);
      if (sameCategory || sharedKeyword) edges.push([i, j]);
    }
  }
  return edges;
}

function findComponents(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  edges.forEach(([a, b]) => union(a, b));
  const groups = {};
  for (let i = 0; i < n; i++) {
    const r = find(i);
    (groups[r] ??= []).push(i);
  }
  return Object.values(groups);
}

// Design Ref: §5.5 — 연결요소별 허브(최고 차수 노드)-스포크 원형 레이아웃
function layoutComponent(indices, notes, allEdges) {
  const idSet = new Set(indices);
  const componentEdges = allEdges.filter(([a, b]) => idSet.has(a) && idSet.has(b));

  if (indices.length === 1) {
    return { hub: indices[0], positions: { [indices[0]]: { x: 0, y: 0 } }, radius: 0, edges: [] };
  }

  const degree = {};
  indices.forEach((i) => { degree[i] = 0; });
  componentEdges.forEach(([a, b]) => { degree[a] += 1; degree[b] += 1; });

  let hub = indices[0];
  indices.forEach((i) => {
    if (degree[i] > degree[hub] || (degree[i] === degree[hub] && notes[i].id < notes[hub].id)) hub = i;
  });

  const others = indices.filter((i) => i !== hub);
  const radius = 50 + Math.min(others.length, 8) * 8;
  const positions = { [hub]: { x: 0, y: 0 } };
  others.forEach((idx, k) => {
    const angle = (k / others.length) * Math.PI * 2 - Math.PI / 2;
    positions[idx] = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });

  return { hub, positions, radius, edges: componentEdges };
}

function truncate(label) {
  return label.length > LABEL_MAX ? `${label.slice(0, LABEL_MAX)}…` : label;
}

export default function DailyNoteMindMapView({ notes, onEdit, onDelete }) {
  const [selectedId, setSelectedId] = useState(null);

  const { clusters, isolated } = useMemo(() => {
    const edges = buildEdges(notes);
    const components = findComponents(notes.length, edges);
    const clusters = [];
    const isolated = [];
    components.forEach((indices) => {
      if (indices.length === 1) {
        isolated.push(notes[indices[0]]);
      } else {
        clusters.push(layoutComponent(indices, notes, edges));
      }
    });
    return { clusters, isolated };
  }, [notes]);

  const selectedNote = notes.find((n) => n.id === selectedId) ?? null;

  if (notes.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">아직 작성된 아이디어가 없습니다.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        {clusters.map((cluster, ci) => {
          const size = 2 * (cluster.radius + NODE_RADIUS + 20);
          const half = size / 2;
          return (
            <div key={ci} className="border rounded bg-white p-2" style={{ width: size, height: size }}>
              <svg width={size} height={size} viewBox={`${-half} ${-half} ${size} ${size}`}>
                {cluster.edges.map(([a, b], ei) => (
                  <line
                    key={ei}
                    x1={cluster.positions[a].x}
                    y1={cluster.positions[a].y}
                    x2={cluster.positions[b].x}
                    y2={cluster.positions[b].y}
                    stroke="#cbd5e1"
                    strokeWidth={2}
                  />
                ))}
                {Object.entries(cluster.positions).map(([idxStr, pos]) => {
                  const note = notes[Number(idxStr)];
                  const isHub = Number(idxStr) === cluster.hub;
                  return (
                    <g
                      key={note.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      onClick={() => setSelectedId(note.id)}
                      className="cursor-pointer"
                    >
                      <circle
                        r={NODE_RADIUS}
                        fill={isHub ? '#3b82f6' : '#dbeafe'}
                        stroke={note.id === selectedId ? '#1d4ed8' : 'transparent'}
                        strokeWidth={2}
                      />
                      <text
                        textAnchor="middle"
                        dy={NODE_RADIUS + 14}
                        fontSize="11"
                        fill={isHub ? '#1e3a8a' : '#334155'}
                        fontWeight={isHub ? 'bold' : 'normal'}
                      >
                        {truncate(noteLabel(note))}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })}
      </div>

      {isolated.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-500 mb-2">연결 없음</h4>
          <div className="flex flex-wrap gap-2">
            {isolated.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                className={
                  'px-3 py-2 text-xs rounded border bg-white hover:bg-gray-50 ' +
                  (note.id === selectedId ? 'ring-2 ring-blue-400' : '')
                }
              >
                {noteLabel(note)}
              </button>
            ))}
          </div>
        </div>
      )}

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
