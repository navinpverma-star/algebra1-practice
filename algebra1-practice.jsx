import { useState, useEffect, useRef, useCallback } from "react";

// ── Data ──────────────────────────────────────────────────────────────────────
const UNITS = [
  {
    id: 1, title: "Foundations of Algebra", emoji: "🔢", color: "#7EC8E3",
    topics: ["Variables & Expressions", "Order of Operations", "Properties of Real Numbers"]
  },
  {
    id: 2, title: "Solving Equations", emoji: "⚖️", color: "#A8D8EA",
    topics: ["One-Step Equations", "Two-Step Equations", "Multi-Step Equations", "Equations with Variables on Both Sides", "Literal Equations & Formulas"]
  },
  {
    id: 3, title: "Solving Inequalities", emoji: "📊", color: "#B8D8F8",
    topics: ["One & Two-Step Inequalities", "Multi-Step Inequalities", "Compound Inequalities", "Absolute Value Equations & Inequalities"]
  },
  {
    id: 4, title: "Linear Functions", emoji: "📈", color: "#89CFF0",
    topics: ["Introduction to Functions", "Slope & Rate of Change", "Slope-Intercept Form (y = mx + b)", "Point-Slope Form", "Standard Form of Linear Equations", "Graphing Linear Equations"]
  },
  {
    id: 5, title: "Systems of Equations & Inequalities", emoji: "🔀", color: "#9DC3E6",
    topics: ["Solving by Graphing", "Solving by Substitution", "Solving by Elimination", "Systems of Inequalities"]
  },
  {
    id: 6, title: "Exponents & Exponential Functions", emoji: "🚀", color: "#AEC6CF",
    topics: ["Properties of Exponents", "Zero & Negative Exponents", "Scientific Notation", "Exponential Growth & Decay"]
  },
  {
    id: 7, title: "Polynomials", emoji: "🧩", color: "#C3E0F3",
    topics: ["Adding & Subtracting Polynomials", "Multiplying Polynomials", "Special Products (FOIL)"]
  },
  {
    id: 8, title: "Factoring", emoji: "🔍", color: "#B0D4E8",
    topics: ["Greatest Common Factor (GCF)", "Factoring Trinomials (a=1)", "Factoring Trinomials (a≠1)", "Difference of Squares", "Factoring Completely"]
  },
  {
    id: 9, title: "Quadratic Functions", emoji: "🏹", color: "#84BED6",
    topics: ["Graphing Quadratics (Parabolas)", "Solving by Square Roots", "Solving by Factoring", "The Quadratic Formula", "The Discriminant", "Vertex Form"]
  },
  {
    id: 10, title: "Radical Expressions & Equations", emoji: "√", color: "#A2C8D8",
    topics: ["Simplifying Radicals", "Operations with Radicals", "Solving Radical Equations"]
  },
  {
    id: 11, title: "Data & Statistics", emoji: "📉", color: "#BAD9EC",
    topics: ["Scatter Plots & Lines of Best Fit", "Two-Way Frequency Tables", "Measures of Central Tendency"]
  }
];

const DIFFICULTY_CONFIG = {
  easy:   { label: "Easy",   emoji: "🌱", desc: "Basic concepts, simple numbers", color: "#6BB8A0" },
  medium: { label: "Medium", emoji: "🔥", desc: "Standard problems, mixed skills", color: "#5B9DBF" },
  hard:   { label: "Hard",   emoji: "⚡", desc: "Challenge problems, multi-step",  color: "#4A7FA8" }
};

const TIMER_OPTIONS = [
  { label: "No Timer",  value: 0 },
  { label: "5 min",     value: 300 },
  { label: "10 min",    value: 600 },
  { label: "15 min",    value: 900 }
];

// ── API Question Generation ───────────────────────────────────────────────────
async function generateQuestions(topic, difficulty, attempt = 1) {
  const prompt = `Generate 10 Algebra 1 multiple choice questions on "${topic}" at ${difficulty} difficulty. 4 choices each, one correct answer. Easy=single-step, Medium=two-step, Hard=multi-step.

Respond ONLY with this JSON (no markdown, no extra text):
{"questions":[{"question":"Solve: 2x+5=13","choices":["x=3","x=4","x=9","x=6"],"correct":1,"explanation":"Subtract 5: 2x=8, divide: x=4"}]}`;

  if (!process.env.REACT_APP_ANTHROPIC_KEY) {
    throw new Error("API key not configured. Please add REACT_APP_ANTHROPIC_KEY in Vercel environment variables.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.REACT_APP_ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    clearTimeout(timeout);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error ${response.status}: ${errText}`);
    }
    const data = await response.json();
    const text = data.content.map(b => b.text || "").join("").trim();
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (!parsed.questions || parsed.questions.length < 5) throw new Error("Incomplete response");
    return parsed.questions;
  } catch (err) {
    clearTimeout(timeout);
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 2000));
      return generateQuestions(topic, difficulty, attempt + 1);
    }
    throw new Error("Could not generate questions after 3 attempts. Please try again.");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getGrade(score) {
  if (score >= 90) return { letter: "A", color: "#00B894", msg: "Outstanding! 🌟" };
  if (score >= 80) return { letter: "B", color: "#48CAE4", msg: "Great work! 💪" };
  if (score >= 70) return { letter: "C", color: "#FECA57", msg: "Good effort! 📚" };
  if (score >= 60) return { letter: "D", color: "#FF9F43", msg: "Keep practicing! 🔄" };
  return { letter: "F", color: "#FF6B6B", msg: "Don't give up! 💡" };
}

function getUnitProgress(history, unitTitle) {
  const unitTopics = UNITS.find(u => u.title === unitTitle)?.topics || [];
  const scores = {};
  unitTopics.forEach(t => {
    const topicHistory = history.filter(h => h.topic === t);
    if (topicHistory.length > 0) {
      scores[t] = Math.max(...topicHistory.map(h => h.score));
    }
  });
  const attempted = Object.keys(scores).length;
  const avgScore = attempted > 0 ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / attempted) : 0;
  return { attempted, total: unitTopics.length, avgScore };
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #EEF6FC;
    --bg2: #E2EFF8;
    --surface: #FFFFFF;
    --surface2: #F2F8FD;
    --border: rgba(100,160,210,0.2);
    --border-strong: rgba(100,160,210,0.35);
    --text: #2A4A6B;
    --text-soft: #4A7090;
    --muted: rgba(42,74,107,0.45);
    --accent: #5B9DBF;
    --accent2: #89CFF0;
    --accent3: #7EC8E3;
    --correct: #6BB8A0;
    --wrong: #E88EA0;
    --radius: 18px;
    --radius-sm: 10px;
    --shadow: 0 2px 12px rgba(80,140,190,0.1);
    --shadow-md: 0 4px 24px rgba(80,140,190,0.14);
    --font: 'Nunito', sans-serif;
    --font-mono: 'DM Mono', monospace;
  }

  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }

  .app { min-height: 100vh; background: var(--bg); position: relative; overflow-x: hidden; }

  .app::before {
    content: '';
    position: fixed; inset: 0;
    background:
      radial-gradient(ellipse 70% 50% at 10% 0%, rgba(137,207,240,0.25) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 90% 100%, rgba(93,157,191,0.15) 0%, transparent 50%);
    pointer-events: none; z-index: 0;
  }

  .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }

  /* ── NAV ── */
  .nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 24px; border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
    background: rgba(238,246,252,0.9); backdrop-filter: blur(16px);
    box-shadow: 0 1px 0 var(--border);
  }
  .nav-brand { font-family: var(--font); font-weight: 900; font-size: 22px; letter-spacing: -0.5px; color: var(--text); }
  .nav-brand span { color: var(--accent); }
  .nav-actions { display: flex; gap: 10px; }
  .btn-ghost {
    background: var(--surface); border: 1px solid var(--border); color: var(--text-soft);
    padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: var(--font);
    font-size: 14px; font-weight: 600; transition: all 0.2s; display: flex; align-items: center; gap: 6px;
    box-shadow: var(--shadow);
  }
  .btn-ghost:hover { border-color: var(--accent); color: var(--accent); background: var(--surface2); }

  /* ── HERO ── */
  .hero { padding: 56px 0 44px; text-align: center; }
  .hero-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(91,157,191,0.12); border: 1px solid rgba(91,157,191,0.3);
    border-radius: 100px; padding: 6px 16px; font-size: 12px; color: var(--accent);
    font-family: var(--font-mono); margin-bottom: 22px; letter-spacing: 0.05em; font-weight: 500;
  }
  .hero h1 {
    font-family: var(--font); font-size: clamp(32px, 5vw, 58px);
    font-weight: 900; line-height: 1.08; letter-spacing: -1.5px; margin-bottom: 16px; color: var(--text);
  }
  .hero h1 .highlight {
    background: linear-gradient(135deg, #5B9DBF, #89CFF0);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .hero p { color: var(--muted); font-size: 17px; max-width: 460px; margin: 0 auto 36px; line-height: 1.65; font-weight: 500; }
  .stats-row { display: flex; justify-content: center; gap: 32px; flex-wrap: wrap; }
  .stat {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 14px 24px; box-shadow: var(--shadow); text-align: center; min-width: 90px;
  }
  .stat-num { font-family: var(--font); font-size: 26px; font-weight: 900; color: var(--accent); }
  .stat-lbl { font-size: 11px; color: var(--muted); font-family: var(--font-mono); letter-spacing: 0.06em; margin-top: 2px; }

  /* ── UNITS ── */
  .section-label {
    font-family: var(--font-mono); font-size: 11px; color: var(--muted);
    letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 16px; padding-top: 36px;
  }
  .units-grid { display: flex; flex-direction: column; gap: 12px; padding-bottom: 60px; }

  .unit-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s; box-shadow: var(--shadow);
  }
  .unit-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-md); }

  .unit-header {
    display: flex; align-items: center; gap: 14px; padding: 18px 22px;
    cursor: pointer; user-select: none;
  }
  .unit-icon {
    width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center;
    justify-content: center; font-size: 18px; flex-shrink: 0;
  }
  .unit-info { flex: 1; min-width: 0; }
  .unit-num { font-family: var(--font-mono); font-size: 10px; color: var(--muted); letter-spacing: 0.1em; }
  .unit-title { font-family: var(--font); font-size: 15px; font-weight: 800; margin-top: 2px; color: var(--text); }
  .unit-meta { display: flex; align-items: center; gap: 12px; }
  .unit-progress-pill {
    font-size: 11px; font-family: var(--font-mono); color: var(--text-soft);
    background: var(--surface2); padding: 4px 10px; border-radius: 100px; white-space: nowrap;
    border: 1px solid var(--border);
  }
  .unit-chevron { color: var(--muted); font-size: 16px; transition: transform 0.25s; }
  .unit-chevron.open { transform: rotate(180deg); }

  .unit-progress-bar {
    height: 3px; background: var(--bg2); margin: 0 22px;
    border-radius: 100px; overflow: hidden;
  }
  .unit-progress-fill { height: 100%; border-radius: 100px; transition: width 0.6s ease; }

  .topics-list {
    padding: 8px 22px 18px; display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;
  }
  .topic-btn {
    background: var(--surface2); border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 11px 14px; cursor: pointer; text-align: left; transition: all 0.18s;
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    font-family: var(--font); color: var(--text); font-size: 13px; font-weight: 600;
  }
  .topic-btn:hover { background: rgba(91,157,191,0.1); border-color: rgba(91,157,191,0.4); transform: translateY(-1px); box-shadow: var(--shadow); }
  .topic-score-badge {
    font-size: 11px; font-family: var(--font-mono); padding: 2px 8px;
    border-radius: 100px; white-space: nowrap; flex-shrink: 0; font-weight: 500;
  }

  /* ── MODAL ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(180,210,235,0.4); backdrop-filter: blur(8px);
    z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px;
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

  .modal {
    background: var(--surface); border: 1px solid var(--border-strong); border-radius: 24px;
    padding: 36px; width: 100%; max-width: 480px; animation: slideUp 0.25s ease; box-shadow: var(--shadow-md);
  }
  .modal-topic { font-family: var(--font-mono); font-size: 11px; color: var(--accent); letter-spacing: 0.1em; margin-bottom: 6px; text-transform: uppercase; }
  .modal-title { font-family: var(--font); font-size: 22px; font-weight: 900; margin-bottom: 26px; color: var(--text); }

  .modal-section-label { font-size: 11px; font-family: var(--font-mono); color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; }
  .diff-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 24px; }
  .diff-btn {
    background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius-sm);
    padding: 14px 10px; cursor: pointer; text-align: center; transition: all 0.18s; color: var(--text);
    font-family: var(--font);
  }
  .diff-btn:hover, .diff-btn.selected { background: rgba(91,157,191,0.1); }
  .diff-btn.selected { border-color: var(--accent); }
  .diff-emoji { font-size: 20px; margin-bottom: 5px; }
  .diff-label { font-weight: 800; font-size: 13px; color: var(--text); }
  .diff-desc { font-size: 10px; color: var(--muted); margin-top: 3px; line-height: 1.3; }

  .timer-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 28px; }
  .timer-btn {
    background: var(--surface2); border: 2px solid var(--border); border-radius: var(--radius-sm);
    padding: 10px 6px; cursor: pointer; text-align: center; transition: all 0.18s; color: var(--text-soft);
    font-size: 12px; font-family: var(--font-mono); font-weight: 500;
  }
  .timer-btn:hover, .timer-btn.selected { background: rgba(91,157,191,0.12); border-color: var(--accent); color: var(--text); }

  .modal-actions { display: flex; gap: 10px; }
  .btn-cancel {
    flex: 1; background: var(--surface2); border: 1px solid var(--border); color: var(--muted);
    padding: 13px; border-radius: var(--radius-sm); cursor: pointer; font-family: var(--font);
    font-size: 14px; font-weight: 700; transition: all 0.2s;
  }
  .btn-cancel:hover { color: var(--text); border-color: var(--border-strong); }
  .btn-start {
    flex: 2; background: linear-gradient(135deg, #5B9DBF, #89CFF0); color: white;
    border: none; padding: 13px; border-radius: var(--radius-sm); cursor: pointer;
    font-family: var(--font); font-size: 15px; font-weight: 800; transition: opacity 0.2s;
    box-shadow: 0 4px 14px rgba(91,157,191,0.35);
  }
  .btn-start:hover { opacity: 0.9; }
  .btn-start:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── QUIZ VIEW ── */
  .quiz-view { max-width: 700px; margin: 0 auto; padding: 32px 24px 60px; }

  .quiz-topbar {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 28px; gap: 14px; flex-wrap: wrap;
  }
  .quiz-meta { flex: 1; }
  .quiz-topic-name { font-family: var(--font); font-size: 18px; font-weight: 900; color: var(--text); }
  .quiz-difficulty {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 12px; font-family: var(--font-mono); color: var(--muted); margin-top: 2px;
  }

  .timer-display {
    font-family: var(--font-mono); font-size: 24px; font-weight: 500; color: var(--text);
    padding: 8px 16px; border-radius: var(--radius-sm);
    border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow);
  }
  .timer-display.warning { color: var(--wrong); border-color: rgba(232,142,160,0.5); animation: pulse 1s infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

  .quiz-progress { margin-bottom: 24px; }
  .quiz-progress-text {
    display: flex; justify-content: space-between; font-family: var(--font-mono);
    font-size: 11px; color: var(--muted); margin-bottom: 8px;
  }
  .progress-track { height: 5px; background: var(--bg2); border-radius: 100px; overflow: hidden; }
  .progress-fill {
    height: 100%; border-radius: 100px;
    background: linear-gradient(90deg, #5B9DBF, #89CFF0);
    transition: width 0.4s ease;
  }

  .question-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: 20px;
    padding: 28px; margin-bottom: 16px; animation: slideUp 0.3s ease; box-shadow: var(--shadow);
  }
  .q-number { font-family: var(--font-mono); font-size: 11px; color: var(--muted); margin-bottom: 10px; letter-spacing: 0.06em; }
  .q-text { font-size: 18px; font-weight: 700; line-height: 1.55; color: var(--text); }

  .choices-list { display: flex; flex-direction: column; gap: 9px; }
  .choice-btn {
    background: var(--surface); border: 2px solid var(--border); border-radius: var(--radius-sm);
    padding: 14px 18px; cursor: pointer; text-align: left; transition: all 0.18s;
    display: flex; align-items: center; gap: 12px; color: var(--text); font-family: var(--font);
    font-size: 14px; font-weight: 600; box-shadow: var(--shadow);
  }
  .choice-btn:hover:not(:disabled) { background: rgba(91,157,191,0.08); border-color: rgba(91,157,191,0.4); }
  .choice-btn.selected { background: rgba(91,157,191,0.1); border-color: var(--accent); }
  .choice-btn.correct { background: rgba(107,184,160,0.12); border-color: var(--correct); }
  .choice-btn.wrong { background: rgba(232,142,160,0.1); border-color: var(--wrong); }
  .choice-btn:disabled { cursor: default; }
  .choice-label {
    width: 26px; height: 26px; border-radius: 50%; background: var(--bg2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono); font-size: 11px; font-weight: 500; flex-shrink: 0; color: var(--text-soft);
  }
  .choice-btn.selected .choice-label { background: var(--accent); color: white; border-color: var(--accent); }
  .choice-btn.correct .choice-label { background: var(--correct); color: white; border-color: var(--correct); }
  .choice-btn.wrong .choice-label { background: var(--wrong); color: white; border-color: var(--wrong); }

  .explanation-box {
    background: rgba(107,184,160,0.1); border: 1px solid rgba(107,184,160,0.3);
    border-radius: var(--radius-sm); padding: 13px 16px; margin-top: 14px;
    font-size: 13px; color: #3A7A62; line-height: 1.65; animation: slideUp 0.25s ease; font-weight: 600;
  }
  .explanation-box strong { color: #2D6A54; }

  .quiz-nav { display: flex; justify-content: flex-end; margin-top: 18px; }
  .btn-next {
    background: linear-gradient(135deg, #5B9DBF, #7EC8E3); color: white; border: none;
    padding: 13px 28px; border-radius: var(--radius-sm); cursor: pointer;
    font-family: var(--font); font-size: 15px; font-weight: 800; transition: opacity 0.2s;
    box-shadow: 0 4px 14px rgba(91,157,191,0.3);
  }
  .btn-next:hover { opacity: 0.9; }
  .btn-next:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }

  /* ── LOADING ── */
  .loading-view { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 18px; }
  .loader {
    width: 44px; height: 44px; border: 3px solid var(--bg2);
    border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loading-text { font-family: var(--font); font-size: 19px; font-weight: 800; color: var(--text); }
  .loading-sub { font-size: 13px; color: var(--muted); font-family: var(--font-mono); text-align: center; max-width: 320px; line-height: 1.6; }
  .loading-retry { font-size: 12px; color: var(--accent); font-family: var(--font-mono); margin-top: 4px; }

  /* ── RESULTS ── */
  .results-view { max-width: 700px; margin: 0 auto; padding: 40px 24px 60px; }

  .score-hero { text-align: center; margin-bottom: 40px; }
  .score-ring {
    width: 130px; height: 130px; border-radius: 50%; margin: 0 auto 18px;
    display: flex; align-items: center; justify-content: center;
  }
  .score-ring-inner {
    width: 100%; height: 100%; border-radius: 50%; border: 5px solid;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--surface); box-shadow: var(--shadow-md);
  }
  .score-grade { font-family: var(--font); font-size: 44px; font-weight: 900; line-height: 1; }
  .score-pct { font-family: var(--font-mono); font-size: 13px; color: var(--muted); margin-top: 2px; }
  .score-msg { font-size: 20px; font-weight: 800; margin-bottom: 5px; font-family: var(--font); color: var(--text); }
  .score-detail { font-size: 13px; color: var(--muted); font-family: var(--font-mono); }

  .results-meta-row {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 32px;
  }
  .meta-card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 16px; text-align: center; box-shadow: var(--shadow);
  }
  .meta-value { font-family: var(--font); font-size: 20px; font-weight: 900; color: var(--accent); }
  .meta-label { font-size: 10px; color: var(--muted); font-family: var(--font-mono); margin-top: 3px; letter-spacing: 0.07em; text-transform: uppercase; }

  .review-section h3 { font-family: var(--font); font-size: 16px; font-weight: 900; margin-bottom: 14px; color: var(--text); }
  .review-item {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
    padding: 18px; margin-bottom: 10px; box-shadow: var(--shadow);
  }
  .review-item.correct-item { border-color: rgba(107,184,160,0.4); }
  .review-item.wrong-item { border-color: rgba(232,142,160,0.35); }
  .review-q { font-size: 14px; font-weight: 700; margin-bottom: 10px; line-height: 1.55; color: var(--text); }
  .review-answers { display: flex; flex-direction: column; gap: 5px; }
  .review-answer { font-size: 12px; padding: 5px 11px; border-radius: 6px; font-weight: 600; }
  .review-answer.user-wrong { background: rgba(232,142,160,0.12); color: #C0617A; }
  .review-answer.correct-ans { background: rgba(107,184,160,0.12); color: #3A7A62; }
  .review-answer.user-correct { background: rgba(107,184,160,0.12); color: #3A7A62; }
  .review-explanation { font-size: 11px; color: var(--muted); margin-top: 9px; line-height: 1.6; font-family: var(--font-mono); }

  .results-actions { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; }
  .btn-primary {
    flex: 1; background: linear-gradient(135deg, #5B9DBF, #89CFF0); color: white; border: none;
    padding: 13px 18px; border-radius: var(--radius-sm); cursor: pointer;
    font-family: var(--font); font-size: 14px; font-weight: 800; transition: opacity 0.2s;
    min-width: 130px; box-shadow: 0 4px 14px rgba(91,157,191,0.3);
  }
  .btn-primary:hover { opacity: 0.9; }
  .btn-secondary {
    flex: 1; background: var(--surface); border: 1px solid var(--border); color: var(--text-soft);
    padding: 13px 18px; border-radius: var(--radius-sm); cursor: pointer;
    font-family: var(--font); font-size: 14px; font-weight: 700; transition: all 0.2s;
    min-width: 100px; box-shadow: var(--shadow);
  }
  .btn-secondary:hover { border-color: var(--accent); color: var(--accent); }

  /* ── HISTORY VIEW ── */
  .history-view { max-width: 800px; margin: 0 auto; padding: 40px 24px 60px; }
  .history-view h2 { font-family: var(--font); font-size: 26px; font-weight: 900; margin-bottom: 24px; color: var(--text); }
  .history-empty { text-align: center; color: var(--muted); padding: 60px 0; font-family: var(--font-mono); }

  .history-table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-md); border: 1px solid var(--border); }
  .history-table th {
    text-align: left; font-family: var(--font-mono); font-size: 10px; color: var(--muted);
    letter-spacing: 0.1em; text-transform: uppercase; padding: 12px 16px; border-bottom: 1px solid var(--border);
    background: var(--surface2);
  }
  .history-table td { padding: 13px 16px; border-bottom: 1px solid var(--border); font-size: 13px; }
  .history-table tr:last-child td { border-bottom: none; }
  .history-table tr:hover td { background: var(--surface2); }
  .score-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 100px; font-family: var(--font-mono); font-size: 11px; font-weight: 500;
  }

  .error-box {
    background: rgba(232,142,160,0.12); border: 1px solid rgba(232,142,160,0.4);
    border-radius: var(--radius-sm); padding: 14px 18px; text-align: center;
    color: #C0617A; font-size: 13px; margin: 16px 0; font-weight: 600;
  }

  @media (max-width: 600px) {
    .hero h1 { font-size: 28px; letter-spacing: -0.5px; }
    .topics-list { grid-template-columns: 1fr; }
    .diff-grid { grid-template-columns: 1fr; }
    .timer-grid { grid-template-columns: repeat(2, 1fr); }
    .results-meta-row { grid-template-columns: 1fr; }
    .modal { padding: 22px; }
    .stats-row { gap: 10px; }
    .quiz-topbar { flex-direction: column; align-items: flex-start; }
  }

  @media print {
    .nav, .quiz-nav, .results-actions, .app::before { display: none !important; }
    .app { background: white; color: black; }
    .results-view, .quiz-view { max-width: 100%; }
    .question-card, .review-item, .meta-card { background: #f9f9f9; border: 1px solid #ddd; color: black; }
    .score-msg, .score-detail, .review-q { color: black; }
    .review-explanation { color: #555; }
  }
`;

// ── Main App ──────────────────────────────────────────────────────────────────
export default function AlgebraApp() {
  const [view, setView] = useState("home"); // home | loading | quiz | results | history
  const [expandedUnits, setExpandedUnits] = useState(new Set([1]));
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [difficulty, setDifficulty] = useState("medium");
  const [timerSetting, setTimerSetting] = useState(0);

  // Quiz state
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [revealedAnswers, setRevealedAnswers] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  const [quizStartTime, setQuizStartTime] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  // History
  const [history, setHistory] = useState([]);

  // Load history from storage
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const result = await window.storage.get("algebra_history");
        if (result?.value) setHistory(JSON.parse(result.value));
      } catch {}
    };
    loadHistory();
  }, []);

  const saveHistory = async (entry) => {
    const updated = [entry, ...history].slice(0, 100);
    setHistory(updated);
    try {
      await window.storage.set("algebra_history", JSON.stringify(updated));
    } catch {}
  };

  // Timer
  useEffect(() => {
    if (view === "quiz" && timerSetting > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); finishQuiz(); return 0; }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [view, timerSetting]);

  // Track time taken
  useEffect(() => {
    let interval;
    if (view === "quiz") {
      interval = setInterval(() => setTimeTaken(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [view]);

  const toggleUnit = (id) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleTopicSelect = (topic) => {
    setSelectedTopic(topic);
    setModalOpen(true);
    setError(null);
  };

  const startQuiz = async () => {
    setModalOpen(false);
    setView("loading");
    setError(null);
    try {
      const qs = await generateQuestions(selectedTopic, difficulty);
      setQuestions(qs);
      setCurrentQ(0);
      setUserAnswers({});
      setRevealedAnswers(new Set());
      setTimeTaken(0);
      setQuizStartTime(new Date());
      if (timerSetting > 0) setTimeLeft(timerSetting);
      clearInterval(timerRef.current);
      setView("quiz");
    } catch (e) {
      setError("Failed to generate questions. Please check your connection and try again.");
      setView("home");
    }
  };

  const handleAnswer = (qIdx, choiceIdx) => {
    if (userAnswers[qIdx] !== undefined) return;
    const newAnswers = { ...userAnswers, [qIdx]: choiceIdx };
    setUserAnswers(newAnswers);
    const isWrong = choiceIdx !== questions[qIdx].correct;
    if (isWrong) {
      setRevealedAnswers(prev => new Set([...prev, qIdx]));
    }
  };

  const finishQuiz = useCallback(() => {
    clearInterval(timerRef.current);
    const correct = questions.filter((q, i) => userAnswers[i] === q.correct).length;
    const score = Math.round((correct / questions.length) * 100);
    const entry = {
      id: Date.now(),
      topic: selectedTopic,
      difficulty,
      score,
      correct,
      total: questions.length,
      timeTaken,
      timerSetting,
      date: new Date().toISOString()
    };
    saveHistory(entry);
    setView("results");
  }, [questions, userAnswers, selectedTopic, difficulty, timeTaken]);

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1);
    } else {
      finishQuiz();
    }
  };

  const getBestScore = (topic) => {
    const scores = history.filter(h => h.topic === topic).map(h => h.score);
    return scores.length ? Math.max(...scores) : null;
  };

  const totalAttempted = new Set(history.map(h => h.topic)).size;
  const avgScore = history.length
    ? Math.round(history.reduce((a, b) => a + b.score, 0) / history.length)
    : 0;

  // ── RENDER ──────────────────────────────────────────────────────────────────
  if (view === "loading") {
    return (
      <div className="app">
        <style>{CSS}</style>
        <div className="loading-view">
          <div className="loader" />
          <div className="loading-text">Generating Questions ✏️</div>
          <div className="loading-sub">Creating 10 {difficulty} questions on<br/><strong>{selectedTopic}</strong></div>
          <div className="loading-retry">This may take up to 30 seconds — will retry automatically if needed</div>
        </div>
      </div>
    );
  }

  if (view === "quiz" && questions.length > 0) {
    const q = questions[currentQ];
    const answered = userAnswers[currentQ] !== undefined;
    const userChoice = userAnswers[currentQ];
    const revealed = revealedAnswers.has(currentQ);
    const LABELS = ["A", "B", "C", "D"];

    return (
      <div className="app">
        <style>{CSS}</style>
        <div className="quiz-view">
          <div className="quiz-topbar">
            <div className="quiz-meta">
              <div className="quiz-topic-name">{selectedTopic}</div>
              <div className="quiz-difficulty">
                {DIFFICULTY_CONFIG[difficulty].emoji} {DIFFICULTY_CONFIG[difficulty].label}
              </div>
            </div>
            {timerSetting > 0 && (
              <div className={`timer-display ${timeLeft < 60 ? "warning" : ""}`}>
                ⏱ {formatTime(timeLeft)}
              </div>
            )}
          </div>

          <div className="quiz-progress">
            <div className="quiz-progress-text">
              <span>Question {currentQ + 1} of {questions.length}</span>
              <span>{Object.keys(userAnswers).length} answered</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${((currentQ + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
            </div>
          </div>

          <div className="question-card">
            <div className="q-number">Q{currentQ + 1}</div>
            <div className="q-text">{q.question}</div>
          </div>

          <div className="choices-list">
            {q.choices.map((choice, i) => {
              let cls = "choice-btn";
              if (answered) {
                if (i === q.correct) cls += " correct";
                else if (i === userChoice && userChoice !== q.correct) cls += " wrong";
              } else if (userChoice === i) cls += " selected";

              return (
                <button key={i} className={cls} onClick={() => handleAnswer(currentQ, i)} disabled={answered}>
                  <span className="choice-label">{LABELS[i]}</span>
                  {choice}
                </button>
              );
            })}
          </div>

          {answered && revealed && q.explanation && (
            <div className="explanation-box">
              <strong>Explanation: </strong>{q.explanation}
            </div>
          )}
          {answered && !revealed && (
            <div style={{ height: 8 }} />
          )}

          <div className="quiz-nav">
            <button className="btn-next" onClick={handleNext} disabled={!answered}>
              {currentQ < questions.length - 1 ? "Next Question →" : "Finish Quiz ✓"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "results") {
    const correct = questions.filter((q, i) => userAnswers[i] === q.correct).length;
    const score = Math.round((correct / questions.length) * 100);
    const grade = getGrade(score);

    const handlePrint = () => window.print();
    const handleExport = () => {
      const lines = [
        `Algebra 1 Practice Results`,
        `Topic: ${selectedTopic}`,
        `Difficulty: ${difficulty}`,
        `Score: ${score}% (${correct}/${questions.length})`,
        `Date: ${new Date().toLocaleString()}`,
        `Time Taken: ${formatTime(timeTaken)}`,
        ``,
        ...questions.map((q, i) => [
          `Q${i + 1}: ${q.question}`,
          `Your Answer: ${q.choices[userAnswers[i]] ?? "Not answered"}`,
          `Correct: ${q.choices[q.correct]}`,
          `${userAnswers[i] === q.correct ? "✓ Correct" : "✗ Wrong"}`,
          q.explanation ? `Explanation: ${q.explanation}` : "",
          ""
        ].join("\n"))
      ].join("\n");

      const blob = new Blob([lines], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `algebra1-${selectedTopic.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
    };

    return (
      <div className="app">
        <style>{CSS}</style>
        <nav className="nav">
          <div className="nav-brand">Algebra<span>1</span></div>
          <div className="nav-actions">
            <button className="btn-ghost" onClick={() => setView("home")}>← Home</button>
          </div>
        </nav>

        <div className="results-view">
          <div className="score-hero">
            <div className="score-ring">
              <div className="score-ring-inner" style={{ borderColor: grade.color }}>
                <div className="score-grade" style={{ color: grade.color }}>{grade.letter}</div>
                <div className="score-pct">{score}%</div>
              </div>
            </div>
            <div className="score-msg">{grade.msg}</div>
            <div className="score-detail">{selectedTopic} · {DIFFICULTY_CONFIG[difficulty].label}</div>
          </div>

          <div className="results-meta-row">
            <div className="meta-card">
              <div className="meta-value">{correct}/{questions.length}</div>
              <div className="meta-label">Correct</div>
            </div>
            <div className="meta-card">
              <div className="meta-value">{formatTime(timeTaken)}</div>
              <div className="meta-label">Time Taken</div>
            </div>
            <div className="meta-card">
              <div className="meta-value">{new Date().toLocaleDateString()}</div>
              <div className="meta-label">Date</div>
            </div>
          </div>

          <div className="review-section">
            <h3>Review All Questions</h3>
            {questions.map((q, i) => {
              const isCorrect = userAnswers[i] === q.correct;
              return (
                <div key={i} className={`review-item ${isCorrect ? "correct-item" : "wrong-item"}`}>
                  <div className="review-q">{i + 1}. {q.question}</div>
                  <div className="review-answers">
                    {!isCorrect && (
                      <div className="review-answer user-wrong">
                        ✗ Your answer: {q.choices[userAnswers[i]] ?? "Not answered"}
                      </div>
                    )}
                    <div className={`review-answer ${isCorrect ? "user-correct" : "correct-ans"}`}>
                      ✓ Correct: {q.choices[q.correct]}
                    </div>
                  </div>
                  {q.explanation && (
                    <div className="review-explanation">💡 {q.explanation}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="results-actions">
            <button className="btn-primary" onClick={() => { setModalOpen(true); }}>Retake Quiz</button>
            <button className="btn-secondary" onClick={() => setView("home")}>Pick New Topic</button>
            <button className="btn-secondary" onClick={handleExport}>⬇ Export</button>
            <button className="btn-secondary" onClick={handlePrint}>🖨 Print</button>
          </div>
        </div>

        {modalOpen && (
          <div className="modal-overlay" onClick={() => setModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-topic">RETAKE</div>
              <div className="modal-title">{selectedTopic}</div>
              <div className="modal-section-label">Difficulty</div>
              <div className="diff-grid">
                {Object.entries(DIFFICULTY_CONFIG).map(([k, v]) => (
                  <button key={k} className={`diff-btn ${difficulty === k ? "selected" : ""}`} onClick={() => setDifficulty(k)}>
                    <div className="diff-emoji">{v.emoji}</div>
                    <div className="diff-label">{v.label}</div>
                    <div className="diff-desc">{v.desc}</div>
                  </button>
                ))}
              </div>
              <div className="modal-section-label">Timer (optional)</div>
              <div className="timer-grid">
                {TIMER_OPTIONS.map(t => (
                  <button key={t.value} className={`timer-btn ${timerSetting === t.value ? "selected" : ""}`} onClick={() => setTimerSetting(t.value)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn-start" onClick={startQuiz}>Start Quiz →</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (view === "history") {
    return (
      <div className="app">
        <style>{CSS}</style>
        <nav className="nav">
          <div className="nav-brand">Algebra<span>1</span></div>
          <div className="nav-actions">
            <button className="btn-ghost" onClick={() => setView("home")}>← Home</button>
          </div>
        </nav>
        <div className="history-view">
          <h2>Test History</h2>
          {history.length === 0 ? (
            <div className="history-empty">No tests taken yet. Start practicing! 📚</div>
          ) : (
            <table className="history-table">
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Difficulty</th>
                  <th>Score</th>
                  <th>Time</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const grade = getGrade(h.score);
                  return (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 500 }}>{h.topic}</td>
                      <td style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        {DIFFICULTY_CONFIG[h.difficulty]?.emoji} {h.difficulty}
                      </td>
                      <td>
                        <span className="score-chip" style={{ background: `${grade.color}22`, color: grade.color }}>
                          {h.score}% ({h.correct}/{h.total})
                        </span>
                      </td>
                      <td style={{ color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                        {formatTime(h.timeTaken || 0)}
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                        {new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // ── HOME ──
  return (
    <div className="app">
      <style>{CSS}</style>

      <nav className="nav">
        <div className="nav-brand">Algebra<span>1</span></div>
        <div className="nav-actions">
          <button className="btn-ghost" onClick={() => setView("history")}>📋 History</button>
        </div>
      </nav>

      <div className="container">
        <div className="hero">
          <div className="hero-eyebrow">
            <span>✦</span> Common Core Aligned
          </div>
          <h1>Master <span className="highlight">Algebra 1</span><br />One Topic at a Time</h1>
          <p>AI-generated practice problems tailored to your difficulty level. Track your progress across all 11 units.</p>
          <div className="stats-row">
            <div className="stat">
              <div className="stat-num">40</div>
              <div className="stat-lbl">Topics</div>
            </div>
            <div className="stat">
              <div className="stat-num">{history.length}</div>
              <div className="stat-lbl">Tests Taken</div>
            </div>
            <div className="stat">
              <div className="stat-num">{totalAttempted}</div>
              <div className="stat-lbl">Topics Practiced</div>
            </div>
            <div className="stat">
              <div className="stat-num">{history.length > 0 ? `${avgScore}%` : "—"}</div>
              <div className="stat-lbl">Avg Score</div>
            </div>
          </div>
        </div>

        {error && <div className="error-box">⚠️ {error}</div>}

        <div className="section-label">— All Units & Topics</div>

        <div className="units-grid">
          {UNITS.map(unit => {
            const isOpen = expandedUnits.has(unit.id);
            const prog = getUnitProgress(history, unit.title);
            const progPct = prog.total > 0 ? Math.round((prog.attempted / prog.total) * 100) : 0;

            return (
              <div key={unit.id} className="unit-card">
                <div className="unit-header" onClick={() => toggleUnit(unit.id)}>
                  <div className="unit-icon" style={{ background: `${unit.color}22` }}>
                    {unit.emoji}
                  </div>
                  <div className="unit-info">
                    <div className="unit-num">UNIT {unit.id}</div>
                    <div className="unit-title">{unit.title}</div>
                  </div>
                  <div className="unit-meta">
                    <div className="unit-progress-pill">
                      {prog.attempted}/{prog.total} done
                      {prog.attempted > 0 && ` · ${prog.avgScore}% avg`}
                    </div>
                    <div className={`unit-chevron ${isOpen ? "open" : ""}`}>⌄</div>
                  </div>
                </div>

                <div className="unit-progress-bar">
                  <div className="unit-progress-fill" style={{ width: `${progPct}%`, background: unit.color }} />
                </div>

                {isOpen && (
                  <div className="topics-list">
                    {unit.topics.map(topic => {
                      const best = getBestScore(topic);
                      const grade = best !== null ? getGrade(best) : null;
                      return (
                        <button key={topic} className="topic-btn" onClick={() => handleTopicSelect(topic)}>
                          <span>{topic}</span>
                          {grade && (
                            <span className="topic-score-badge" style={{ background: `${grade.color}22`, color: grade.color }}>
                              {best}%
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-topic">SELECTED TOPIC</div>
            <div className="modal-title">{selectedTopic}</div>
            <div className="modal-section-label">Choose Difficulty</div>
            <div className="diff-grid">
              {Object.entries(DIFFICULTY_CONFIG).map(([k, v]) => (
                <button key={k} className={`diff-btn ${difficulty === k ? "selected" : ""}`} onClick={() => setDifficulty(k)}>
                  <div className="diff-emoji">{v.emoji}</div>
                  <div className="diff-label">{v.label}</div>
                  <div className="diff-desc">{v.desc}</div>
                </button>
              ))}
            </div>
            <div className="modal-section-label">Timer (optional)</div>
            <div className="timer-grid">
              {TIMER_OPTIONS.map(t => (
                <button key={t.value} className={`timer-btn ${timerSetting === t.value ? "selected" : ""}`} onClick={() => setTimerSetting(t.value)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn-start" onClick={startQuiz}>Start Quiz →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
