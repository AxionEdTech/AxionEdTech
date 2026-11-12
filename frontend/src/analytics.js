// Numbers shown on the dashboard and results page, worked out from a
// student's submitted attempts. Kept free of React so it can be tested.

export function attemptPercent(a) {
  if (!a.max_score) return 0;
  return Math.max(0, (Number(a.score) / Number(a.max_score)) * 100);
}

export function summarizeAttempts(attempts) {
  const done = attempts.filter((a) => a.submitted_at && a.max_score);
  if (done.length === 0) return { count: 0, avgPct: null, bestPct: null, accuracy: null, series: [] };

  const pcts = done.map(attemptPercent);
  const correct = done.reduce((s, a) => s + (a.correct_count || 0), 0);
  const wrong = done.reduce((s, a) => s + (a.wrong_count || 0), 0);
  // Oldest first, so a chart reads left to right.
  const series = [...done]
    .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at))
    .map(attemptPercent);

  return {
    count: done.length,
    avgPct: Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length),
    bestPct: Math.round(Math.max(...pcts)),
    accuracy: correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : null,
    series,
  };
}

// Points for an SVG polyline in a width x height box (0-100 % scale).
export function sparkPoints(series, width = 160, height = 44, pad = 4) {
  if (series.length === 0) return "";
  if (series.length === 1) return `${pad},${height - pad - (series[0] / 100) * (height - 2 * pad)} ${width - pad},${height - pad - (series[0] / 100) * (height - 2 * pad)}`;
  return series
    .map((p, i) => {
      const x = pad + (i / (series.length - 1)) * (width - 2 * pad);
      const y = height - pad - (Math.min(100, p) / 100) * (height - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
