import * as Cassowary from './lib/dwarfcassowary-lib.js';

export function newConstraintVar(scope, name, init) {
  return getSolverInstance().getConstraintVariableFor(scope, name, () =>
      new Cassowary.ClVariable(name, init)
  );
}

export function setConstraintVar(scope, name, operator, value) {
  var cVar = solver.getConstraintVariableFor(scope, name, () => {
    throw new Error('tried to assign to uninitialzed variable ' + name);
  });
  var constr = cVar.cnEquals(value);
  constr.changeStrength(Cassowary.ClStrength.required);
  try {
    getSolverInstance().addConstraint(constr);
    getSolverInstance().solveConstraints();
  } finally {
    getSolverInstance().removeConstraint(constr);
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
