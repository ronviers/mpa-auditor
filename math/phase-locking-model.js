/**
 * PHASE-LOCKING FORWARD MODEL — the γ_AB-constraining observable
 *
 * Slice-hardening #6. The gFDR locus depends on chit alone, so a C(τ)/χ(τ)
 * fit cannot constrain γ_AB (rfc-s-integration-notes.md D1 → RFC-S
 * Appendix B item 4). The two-mode phase-locking signature *does* see the
 * coupling: K_AB carries γ_AB directly. This module is the forward model
 * the Inversion Engine scores γ_AB candidates against.
 *
 * `computePhaseLockingR(chit, gamma)` runs the same pipeline the Character
 * Engine uses for its `phase_locking` block — solver.integrate to a
 * settled state, solver.linearize for Q, then the cdv1 §Phase-locking
 * two-mode phase reduction — and returns the Kuramoto order parameter r.
 *
 * It is a deliberate local copy of the Character Engine's `phaseLocking`
 * (the engines are frozen; the shared math/ module is the canonical home,
 * mirroring the math/gfdr-model.js pattern). r is monotone-ish in |γ_AB|
 * at fixed chit, so a single empirical r scalar pins γ_AB's magnitude;
 * its sign comes from the lock branch (in-phase γ<0 vs anti-phase γ>0).
 *
 * No DOM, no event bus — a compute service the Inversion Engine wraps.
 */

import * as solver from './solver-service.js';

// Match the Character Engine's solver window and phase-locking constants.
const SOLVER_T_MAX = 30.0;
const SOLVER_DT = 0.01;
const SOLVER_SAMPLE_EVERY = 10;
const SOLVER_INITIAL = { rho_A: 0.3, rho_B: 0.7 };
const DELTA_OMEGA_REF = 0.15;
const RHO_SAT = 1.0;

// chit = ln(G_0 / L), reference L = 1 (matches the engines' mapping).
function mapToSolverParams(chit, gamma) {
  const G0 = Math.exp(chit);
  return {
    G0_A: G0, G0_B: G0,
    L_A: 1.0, L_B: 1.0,
    gamma_AB: gamma,
    rho_sat: RHO_SAT,
    D_noise: 0.0,
    seed: 0
  };
}

// cdv1 §Phase-locking two-mode phase reduction:
//   K_AB = -γ_AB √(ρ_A ρ_B) / [ρ_sat √(1+4Q²)]
// lock iff |K_AB| ≳ Δω; Kuramoto r = |cos(ψ/2)| at the locked offset, or
// partial coherence r = (1/√2)·|K_AB|/Δω while drifting.
function phaseLockingR(gamma, finalState, Q) {
  const rhoA = Math.max(0, finalState?.rho_A ?? 0.5);
  const rhoB = Math.max(0, finalState?.rho_B ?? 0.5);
  const qEff = Number.isFinite(Q) && Q > 0 ? Q : 0;
  const K_AB = -gamma * Math.sqrt(rhoA * rhoB) / (RHO_SAT * Math.sqrt(1 + 4 * qEff * qEff));
  const absK = Math.abs(K_AB);
  if (absK >= DELTA_OMEGA_REF) {
    const psi_lock = Math.asin(Math.min(1, DELTA_OMEGA_REF / absK));
    const psi = K_AB >= 0 ? psi_lock : (Math.PI - psi_lock);
    return {
      r: Math.abs(Math.cos(psi / 2)),
      K_AB, locked: true,
      phase_relationship: K_AB >= 0 ? 'in_phase' : 'anti_phase'
    };
  }
  return {
    r: Math.SQRT1_2 * (absK / DELTA_OMEGA_REF),
    K_AB, locked: false,
    phase_relationship: 'drift'
  };
}

/**
 * Forward model: the predicted Kuramoto order parameter r at (chit, γ_AB).
 * Runs the solver to a settled state for ρ_A/ρ_B and Q. Returns
 * { r, K_AB, locked, phase_relationship }. Throws if the solver path
 * fails — the caller decides whether to carry γ_AB through unconstrained.
 */
export async function computePhaseLockingR(chit, gamma) {
  const params = mapToSolverParams(chit, gamma);
  const traj = await solver.integrate(SOLVER_INITIAL, params, SOLVER_T_MAX, SOLVER_DT, SOLVER_SAMPLE_EVERY);
  const last = traj.t.length - 1;
  const finalState = { rho_A: traj.rho_A[last], rho_B: traj.rho_B[last] };

  let Q = 0;
  try {
    const sp = await solver.linearize(finalState, params);
    if (Number.isFinite(sp?.Q)) Q = sp.Q;
  } catch {
    // No spectrum — fall back to Q = 0 (the analytical convention below s).
  }

  if (!Number.isFinite(finalState.rho_A) || !Number.isFinite(finalState.rho_B)) {
    throw new Error('phase-locking forward model: solver final state non-finite (kernel diverged)');
  }
  return phaseLockingR(gamma, finalState, Q);
}
