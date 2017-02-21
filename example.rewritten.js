import { addConstraint as _addConstraint } from "https://lively-kernel.org/lively4/programming-constraints-plain/cassowary.js";
import { newConstraintVar as _newConstraintVar } from "https://lively-kernel.org/lively4/programming-constraints-plain/cassowary.js";
import { setConstraintVar as _setConstraintVar } from "https://lively-kernel.org/lively4/programming-constraints-plain/cassowary.js";
let _scope2 = {};
var a = _newConstraintVar(_scope2, "a", 3),
    c = _newConstraintVar(_scope2, "c", 4),
    nonCVar = 15;
var proxyB = 0;

{
    let _scope = {};

    let b = _newConstraintVar(_scope, "b", 2);

    _addConstraint(a.cnEquals(b.times(2)));

    _setConstraintVar(b, "=", 17);
    proxyB = b.value();
}
_setConstraintVar(a, "=", 17 + nonCVar);

{
    _addConstraint(a.times(2).plus(1).cnEquals(c));

    _setConstraintVar(a, "+=", 42);
    nonCVar = 1;
}

[a.value(), proxyB, c.value()];