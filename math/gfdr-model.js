/**
 * gFDR ANALYTICAL FORWARD MODEL — shared canonical copy
 *
 * The framework's leading-order analytical gFDR locus χ(τ) vs C(τ),
 * extracted so the Inversion Engine can score candidate parameters
 * against the same forward model the character/discrete engines render.
 *
 * NOTE: character-engine.js and discrete-engine.js still carry their own
 * pre-existing local copies of `vertexRegime` / `alphaS` /
 * `plateauHeight` / `generateLocus`. This module is the canonical
 * version; pointing those two engines at it is a follow-up de-dup, out
 * of scope for the mock-dataset slice.
 *
 * RFC-S discovery: `generateLocus` depends on chit alone — the
 * single-mode gFDR locus does not constrain γ_AB. Inverting a C(τ)/χ(τ)
 * locus yields chit; γ_AB needs a different observable (regime manifold,
 * phase-locking signature). See docs/rfc-s-integration-notes.md.
 *
 * Pure functions: no imports, no DOM, no event bus.
 */

const N_LOCUS_POINTS = 80;

export function vertexRegime(chit) {
  if (chit >= 0.7) return 'deep_c';
  if (chit >= 0.2) return 'c_near_s';
  if (chit > -0.2) return 's_critical';
  if (chit > -0.7) return 'r_near_s';
  return 'deep_r';
}

export function alphaS(chit) {
  return 0.5 + 0.3 * Math.exp(-Math.abs(chit) * 4);
}

export function plateauHeight(chit) {
  return Math.max(0.05, 1 - Math.exp(-Math.max(0, chit + 0.2) * 1.5));
}

// Analytical gFDR locus — χ(τ) and C(τ) sampled geometrically in τ.
// Branch set matches the engines' continuous-mode generateLocus.
export function generateLocus(chit, regime) {
  const points = [];
  const tauMin = 0.01, tauMax = 1000;
  for (let i = 0; i < N_LOCUS_POINTS; i++) {
    const t = i / (N_LOCUS_POINTS - 1);
    const tau = tauMin * Math.pow(tauMax / tauMin, t);
    let C, chi;
    if (regime === 'deep_c' || regime === 'c_near_s') {
      const depth = Math.exp(-chit * 1.5);
      const tau_c = 4 + 6 / Math.max(0.1, chit);
      const dC = 0.18 * depth * (1 - Math.exp(-tau / tau_c));
      C = 1 - dC;
      chi = (regime === 'deep_c' ? 0.02 : 0.08) * dC;
    } else if (regime === 's_critical') {
      const a = alphaS(chit);
      const P_s = plateauHeight(chit);
      const dC_short = (1 - P_s) * (1 - Math.exp(-tau / 0.5));
      const dC_long = P_s * (1 - Math.pow(1 + tau / 50, -a));
      const dC = dC_short + dC_long;
      C = 1 - dC;
      chi = dC <= (1 - P_s) ? dC : (1 - P_s) + a * (dC - (1 - P_s));
    } else {
      const tau_eq = Math.max(0.5, 1 + 0.5 * Math.exp(chit));
      const dC = 1 - Math.exp(-tau / tau_eq);
      C = 1 - dC;
      chi = dC;
    }
    points.push({ tau, chi, C });
  }
  return points;
}

// Log-τ interpolation of a gFDR locus (array of {tau, C, chi}, τ-ascending)
// at an arbitrary τ. Used to sample a predicted locus at empirical τ points.
export function interpLocus(model, tau) {
  if (tau <= model[0].tau) return { C: model[0].C, chi: model[0].chi };
  const last = model[model.length - 1];
  if (tau >= last.tau) return { C: last.C, chi: last.chi };
  for (let i = 1; i < model.length; i++) {
    if (model[i].tau >= tau) {
      const a = model[i - 1], b = model[i];
      const f = (Math.log(tau) - Math.log(a.tau)) / (Math.log(b.tau) - Math.log(a.tau));
      return { C: a.C + f * (b.C - a.C), chi: a.chi + f * (b.chi - a.chi) };
    }
  }
  return { C: last.C, chi: last.chi };
}

// Mean squared residual between an empirical locus (rows of {tau, C, chi})
// and the framework's analytical locus at a candidate chit.
export function locusResidual(empiricalRows, chit) {
  const model = generateLocus(chit, vertexRegime(chit));
  let sse = 0;
  for (const row of empiricalRows) {
    const m = interpLocus(model, Number(row.tau));
    const dC = Number(row.C) - m.C;
    const dChi = Number(row.chi) - m.chi;
    sse += dC * dC + dChi * dChi;
  }
  return sse / empiricalRows.length;
}
