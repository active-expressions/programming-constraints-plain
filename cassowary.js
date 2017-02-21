import * as Cassowary from './lib/dwarfcassowary-lib.js';

export function newConstraintVar(name, init) {
    return getSolverInstance().getConstraintVariableFor({}, name, () =>
        new Cassowary.ClVariable(name, init)
    );
}

function getTargetValue(constraintVariable, operator, value) {
    let currentValue = constraintVariable.value();
    let targetValue;
    switch (operator) {
        case "=":
            return value;
        case "+=":
            return currentValue + value;
        case "-=":
            return currentValue - value;
        case "*=":
            return currentValue * value;
        case "/=":
            return currentValue / value;
        case "%=":
            return currentValue % value;
        case "**=":
            return currentValue ** value;
        case "<<=":
            return currentValue << value;
        case ">>=":
            return currentValue >> value;
        case ">>>=":
            return currentValue >>> value;
        default:
            throw new Error(`Unknown assigment operator '${operator}' for ${constraintVariable} with value ${value}.`);
    }
}

export function setConstraintVar(constraintVariable, operator, value) {
    let targetValue = getTargetValue(constraintVariable, operator, value);
    let constraint = constraintVariable.cnEquals(targetValue);
    constraint.changeStrength(Cassowary.ClStrength.strong);
    try {
        getSolverInstance().addConstraint(constraint);
        getSolverInstance().solveConstraints();
    } finally {
        getSolverInstance().removeConstraint(constraint);
    }

    return constraintVariable.value();
}

function getSolverInstance() {
    return Cassowary.ClSimplexSolver.getInstance();
}

export function addConstraint(constraint) {
    constraint.changeStrength(Cassowary.ClStrength.required);
    getSolverInstance().addConstraint(constraint);
    getSolverInstance().solveConstraints();
}
