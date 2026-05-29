/**
 * Juri — the desktop pet.
 *
 * An improperly-spaced ASCII eagle that lives on the page. A little door
 * appears, he walks in, apologizes for being late, and starts wandering
 * around the bottom of the viewport reading statutes. Drag him and he
 * gets angry. Click him to ask questions (credit-gated). Sometimes his
 * script just stops and he freezes for months.
 *
 * Intentionally janky. setInterval, not rAF. Movement is choppy. Frames
 * don't always line up. One sprite has a typo that was never fixed. This
 * is a feature.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { askJuri } from "@/lib/juri.functions";
import { Send, Loader2 } from "lucide-react";

// ── ASCII SPRITES ────────────────────────────────────────────────────────
// Intentionally imperfect. Some lines don't align. Walk frames are
// different heights. One has a stray character. The angry frame is
// a completely different art style. None of this is a bug.

const S = {
  idle_r: [
    "   ,_      ",
    "  (o  >    ",
    "   |  )    ",
    "   | /     ",
    "  _|/      ",
  ],
  idle_l: [
    "      _,   ",
    "    <  o)  ",
    "    (  |   ",
    "     \\ |   ",
    "      \\|_  ",
  ],
  walk_r1: [
    "   ,_      ",
    "  (o  >    ",
    "   |  )    ",
    "   |\\      ",
    "  _| \\     ",
  ],
  walk_r2: [
    "   ,_      ",
    "  (o  >    ",
    "   |  )    ",
    "    /|     ",
    "   / |_    ",
  ],
  walk_l1: [
    "      _,   ",
    "    <  o)  ",
    "    (  |   ",
    "      /|   ",
    "     / |_  ",
  ],
  walk_l2: [
    "      _,   ",
    "    <  o)  ",
    "    (  |   ",
    "    |\\     ",  // one space off from walk_l1. intentional
    "   _| \\    ",
  ],
  angry: [
    "  \\,_/     ",
    "  (\\u00d2 \\u00d3>  ",  // gets replaced below
    "   |##)    ",
    "   | /     ",
    "  _|/      ",
    "   !!!     ",  // extra line. angry eagle is taller
  ],
  stuck: [
    "   ,_      ",
    "  (o  >    ",
    "   |  )    ",
    "   |       ",
    "  _|    /  ",  // leg just... going somewhere
  ],
  reading: [
    "   ,_      ",
    "  (o       ",
    "   | v) \\u{1F4DC} ",
    "   | /     ",
    "  _|/      ",
  ],
  sleeping: [
    "   ,_     z",
    "  (-  >    ",
    "   |  ) z  ",
    "   | /     ",
    "  _|/      ",
  ],
  peek: [
    "   ,_  ",
    "  (o > ",
    "   |   ",
  ],
  // the door
  door_closed: [
    " ___ ",
    "|   |",
    "| o |",
    "|   |",
    "|___|",
  ],
  door_open: [
    " ___ ",
    "/   |",
    "  o |",
    "    |",
    "|___|",
  ],
};

// Fix the angry face - inline the actual characters
S.angry[1] = "  (\\xD2 \\xD3>  ";
// Actually just use simple angry eyes
S.angry = [
  "  \\,_/     ",
  "  (>_<>    ",
  "   |##)    ",
  "   | /     ",
  "  _|/      ",
  "    !!     ",
];

S.reading[2] = "   | v) \u{1F4DC} ";

// ── IDLE DIALOGUE ────────────────────────────────────────────────────────
const IDLE_LINES = [
  "...",
  "hmm",
  "don't mind me",
  "interesting",
  "",  // silence (empty = no bubble)
  "",
  "",
  "",  // weighted toward silence
  "that term isn't defined anywhere",
  "this one has teeth",
  "hold on",
  "where was I",
];

const ANGRY_LINES = [
  "hey",
  "HEY",
  "I was READING that",
  "rude",
  "do NOT",
  "seriously?",
];

const ENTER_LINES = [
  "sorry I'm late",
  "am I in the right place",
  "...",
  "hey",
];

const STUCK_LINES = [
  "what",
  "how long was I out",
  "what year is it",
  "",
];

const READING_LINES = [
  "hold on, reading this",
  "*squints*",
  "ok so this says...",
  "hm. vague.",
  "that's defined in the regs",
  "interesting cross-reference",
];

// ── STATE MACHINE ────────────────────────────────────────────────────────

type JuriState =
  | "dormant"
  | "entering"
  | "walking"
  | "idle"
  | "reading"
  | "angry"
  | "talking"
  | "stuck"
  | "sleeping"
  | "leaving";

type Dir = "left" | "right";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── COMPONENT ────────────────────────────────────────────────────────────

export function Juri() {
  const [state, setState] = useState<JuriState>("dormant");
  const [x, setX] = useState(60);
  const [dir, setDir] = useState<Dir>("right");
  const [frame, setFrame] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);
  const [showDoor, setShowDoor] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [queryMode, setQueryMode] = useState(false);
  const [queryDraft, setQueryDraft] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<string | null>(null);
  const [queryCites, setQueryCites] = useState<Array<{ identifier: string; section_label: string | null; heading: string | null; source_code: string }>>([]);
  const stateRef = useRef(state);
  const xRef = useRef(x);
  const dirRef = useRef(dir);
  const dragRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, ex: 0 });
  const idleTimer = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { user, session } = useAuth();
  const router = useRouter();

  stateRef.current = state;
  xRef.current = x;
  dirRef.current = dir;

  const contextId = (() => {
    const path = router.state.location.pathname;
    const m = path.match(/^\/code\/(.+)/);
    if (m && !m[1].startsWith("source/")) return "/" + m[1];
    return undefined;
  })();

  // ── Entrance sequence ──
  useEffect(() => {
    // 10% chance: stuck on load. 70% chance: enters. 20%: dormant (never shows)
    const roll = Math.random();
    if (roll < 0.10) {
      // Stuck
      const delay = 2000 + Math.random() * 3000;
      const t = setTimeout(() => {
        setX(100 + Math.random() * 200);
        setState("stuck");
      }, delay);
      return () => clearTimeout(t);
    }
    if (roll < 0.80) {
      // Normal entrance
      const delay = 1500 + Math.random() * 4000;
      const t = setTimeout(() => {
        setShowDoor(true);
        setTimeout(() => setDoorOpen(true), 600);
        setTimeout(() => {
          setState("entering");
          setBubble(pick(ENTER_LINES));
        }, 1200);
        setTimeout(() => {
          setShowDoor(false);
          setDoorOpen(false);
          setState("walking");
          setTimeout(() => setBubble(null), 3000);
        }, 3500);
      }, delay);
      return () => clearTimeout(t);
    }
    // else: stays dormant
  }, []);

  // ── Main behavior loop (intentionally janky timing) ──
  useEffect(() => {
    const interval = setInterval(() => {
      const s = stateRef.current;

      if (s === "walking") {
        const speed = 12 + Math.random() * 8; // inconsistent speed
        const d = dirRef.current;
        const newX = xRef.current + (d === "right" ? speed : -speed);
        const maxX = (typeof window !== "undefined" ? window.innerWidth : 1200) - 100;

        if (newX > maxX) { setDir("left"); setX(maxX); }
        else if (newX < 20) { setDir("right"); setX(20); }
        else setX(newX);

        setFrame((f) => (f + 1) % 2);

        // Random chance to stop
        if (Math.random() < 0.06) {
          setState("idle");
          idleTimer.current = 0;
        }
      }

      if (s === "idle") {
        idleTimer.current++;
        // Chance to start walking again
        if (idleTimer.current > 6 && Math.random() < 0.15) {
          setState("walking");
          if (Math.random() < 0.3) setDir(dirRef.current === "right" ? "left" : "right");
        }
        // Chance to read (if on a code page)
        if (contextId && idleTimer.current > 3 && Math.random() < 0.04) {
          setState("reading");
          setBubble(pick(READING_LINES));
          setTimeout(() => {
            setBubble(null);
            setState("idle");
          }, 4000 + Math.random() * 3000);
        }
        // Chance to say something
        if (idleTimer.current > 4 && Math.random() < 0.03) {
          const line = pick(IDLE_LINES);
          if (line) { setBubble(line); setTimeout(() => setBubble(null), 3500); }
        }
        // Fall asleep
        if (idleTimer.current > 30) {
          setState("sleeping");
        }
      }

      if (s === "angry") {
        // Calm down after a bit
        if (Math.random() < 0.08) {
          setState("idle");
          setBubble(null);
          idleTimer.current = 0;
        }
      }
    }, 380); // not 60fps. not 30fps. 380ms. intentionally wrong.

    return () => clearInterval(interval);
  }, [contextId]);

  // ── Drag handling ──
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (state === "talking" || state === "dormant") return;
    dragRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY, ex: xRef.current };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [state]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    if (Math.abs(dx) > 8) {
      dragRef.current = true;
      if (stateRef.current !== "angry" && stateRef.current !== "stuck") {
        setState("angry");
        setBubble(pick(ANGRY_LINES));
      }
      setX(Math.max(20, Math.min(window.innerWidth - 100, dragStartRef.current.ex + dx)));
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (!dragRef.current) {
      // Click, not drag
      handleClick();
    }
    dragRef.current = false;
  }, []);

  // ── Click handling ──
  const handleClick = useCallback(() => {
    const s = stateRef.current;
    if (s === "stuck") {
      // Unstick after a delay
      setBubble(null);
      setTimeout(() => {
        const line = pick(STUCK_LINES);
        if (line) setBubble(line);
        setState("idle");
        idleTimer.current = 0;
        setTimeout(() => setBubble(null), 3000);
      }, 1800); // 1.8 second freeze before responding
      return;
    }
    if (s === "sleeping") {
      setBubble("hm? what");
      setState("idle");
      idleTimer.current = 0;
      setTimeout(() => setBubble(null), 2500);
      return;
    }
    if (s === "angry") return; // too angry to talk
    if (s === "dormant" || s === "entering" || s === "leaving") return;

    // Open query mode
    if (!queryMode) {
      setQueryMode(true);
      setQueryResult(null);
      setQueryCites([]);
      setBubble(null);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [queryMode]);

  // ── Query submission ──
  const submitQuery = useCallback(async () => {
    const q = queryDraft.trim();
    if (!q || queryLoading) return;

    setQueryLoading(true);
    setQueryResult(null);
    setQueryCites([]);

    try {
      const res = await askJuri({
        data: {
          query: q,
          context_identifier: contextId,
          auth_token: session?.access_token,
        },
      });

      if (res.error) {
        setQueryResult(res.error);
      } else {
        setQueryResult(res.answer);
        setQueryCites(res.citations);
      }
    } catch {
      setQueryResult("something broke. try again.");
    } finally {
      setQueryLoading(false);
      setQueryDraft("");
    }
  }, [queryDraft, queryLoading, contextId, session?.access_token]);

  // ── Sprite selection ──
  const sprite = (() => {
    switch (state) {
      case "walking":
        if (dir === "right") return frame % 2 === 0 ? S.walk_r1 : S.walk_r2;
        return frame % 2 === 0 ? S.walk_l1 : S.walk_l2;
      case "idle":
        return dir === "right" ? S.idle_r : S.idle_l;
      case "angry":
        return S.angry;
      case "stuck":
        return S.stuck;
      case "reading":
        return S.reading;
      case "sleeping":
        return S.sleeping;
      case "entering":
        return S.peek;
      default:
        return S.idle_r;
    }
  })();

  // ── Render ──
  if (state === "dormant") return null;

  return (
    <>
      {/* The door */}
      {showDoor && (
        <div className="juri-door" style={{ left: 20 }}>
          <pre className="juri-sprite juri-door-sprite">
            {(doorOpen ? S.door_open : S.door_closed).join("\n")}
          </pre>
        </div>
      )}

      {/* The eagle */}
      <div
        className={`juri-pet ${state === "stuck" ? "juri-stuck" : ""}`}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title={state === "stuck" ? "his script stopped running about 3 months ago. we're looking into it" : "Juri"}
      >
        {/* Speech bubble */}
        {(bubble || queryMode) && (
          <div className="juri-bubble">
            {queryMode ? (
              <div className="juri-query-bubble">
                {queryResult ? (
                  <div className="juri-query-result">
                    <div className="juri-query-answer">{queryResult}</div>
                    {queryCites.length > 0 && (
                      <div className="juri-query-cites">
                        {queryCites.map((c) => (
                          <Link
                            key={c.identifier}
                            to="/code/$"
                            params={{ _splat: c.identifier.replace(/^\//, "") }}
                            className="juri-cite-link"
                            onClick={() => { setQueryMode(false); setQueryResult(null); }}
                          >
                            {c.section_label ?? c.identifier}
                          </Link>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setQueryMode(false); setQueryResult(null); setQueryCites([]); }}
                      className="juri-close-query"
                    >
                      dismiss
                    </button>
                  </div>
                ) : (
                  <div className="juri-query-input-wrap">
                    <input
                      ref={inputRef}
                      value={queryDraft}
                      onChange={(e) => setQueryDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); submitQuery(); }
                        if (e.key === "Escape") { setQueryMode(false); }
                      }}
                      placeholder="ask me something"
                      className="juri-query-input"
                      disabled={queryLoading}
                    />
                    <button
                      type="button"
                      onClick={submitQuery}
                      disabled={queryLoading || !queryDraft.trim()}
                      className="juri-query-send"
                    >
                      {queryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    </button>
                  </div>
                )}
                {!user && !queryResult && (
                  <div className="juri-need-auth">sign in first</div>
                )}
              </div>
            ) : (
              <span>{bubble}</span>
            )}
          </div>
        )}

        {/* ASCII sprite */}
        <pre className={`juri-sprite ${state === "stuck" ? "juri-sprite-glitch" : ""}`}>
          {sprite.join("\n")}
        </pre>
      </div>
    </>
  );
}
