import * as Cassowary from './lib/dwarfcassowary-lib.js';

export function newConstraintVar(scope, name, init) {
  return getSolverInstance().getConstraintVariableFor(scope, name, () =>
      new Cassowary.ClVariable(name, init)
  );
}

export function setConstraintVar(scope, name, operator, value) {
  let cVar = solver.getConstraintVariableFor(scope, name, () => {
    throw new Error('tried to assign to uninitialzed variable ' + name);
  });
  let constraint = cVar.cnEquals(value);
  constraint.changeStrength(Cassowary.ClStrength.required);
  try {
    getSolverInstance().addConstraint(constraint);
    getSolverInstance().solveConstraints();
  } finally {
    getSolverInstance().removeConstraint(constraint);
  }
  
  return getConstraintVar(scope, name);
}

export function getConstraintVar(scope, name) {
  return getSolverInstance().getConstraintVariableFor(scope, name, () => {
    throw new Error('tried to access uninitialzed variable ' + name);
  }).value();
}

function getSolverInstance() {
  return Cassowary.ClSimplexSolver.getInstance();

}

export function addConstraint(constraint) {
  constraint.changeStrength(Cassowary.ClStrength.strong);
  getSolverInstance().addConstraint(constraint);
  getSolverInstance().solveConstraints();
}
