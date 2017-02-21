const NEW_CONSTRAINT_VAR = 'newConstraintVar';
const SET_CONSTRAINT_VAR = 'setConstraintVar';
const ADD_CONSTRAINT = 'addConstraint';

const IS_BINDING_FOR_CONSTRAINT_VAR = 'IS_BINDING_FOR_CONSTRAINT_VAR';

export default function({ types: t, template, traverse }) {
    function isVariable(path) {
        // - filter out with negative conditions
        if(t.isLabeledStatement(path.parent) && path.parentKey === 'label') return false;
        if(t.isBreakStatement(path.parent) && path.parentKey === 'label') return false;
        if(t.isForInStatement(path.parent) && path.parentKey === 'left') return false;
        if(t.isFunctionExpression(path.parent) && path.parentKey === 'id') return false;
        if(t.isImportDefaultSpecifier(path.parent) && path.parentKey === 'local') return false;
        if(t.isCatchClause(path.parent) && path.parentKey === 'param') return false;
        if(t.isObjectProperty(path.parent) && path.parentKey === 'key') return false;
        if(t.isClassDeclaration(path.parent)) return false;
        if(t.isClassMethod(path.parent)) return false;
        if(t.isImportSpecifier(path.parent)) return false; // correct?
        if(t.isMemberExpression(path.parent) && path.parentKey === 'property' && !path.parent.computed) return false; // TODO: correct?
        if(t.isObjectMethod(path.parent)) return false;
        if(t.isFunctionDeclaration(path.parent)) return false;
        if((t.isArrowFunctionExpression(path.parent) && path.parentKey === 'params')) return false;
        if((t.isFunctionExpression(path.parent) && path.parentKey === 'params')) return false;
        if(t.isRestElement(path.parent)) return false;

        return true;
    }

    function addCustomTemplate(file, name) {
        let declar = file.declarations[name];
        if (declar) return declar;

        return file.declarations[name] = file.addImport("https://lively-kernel.org/lively4/programming-constraints-plain/cassowary.js", name, name);
    }

    function buildLinearEquation(node) {
        if(t.isLabeledStatement(node)) {
            return buildLinearEquation(node.body);
        }
        if(t.isExpressionStatement(node)) {
            return buildLinearEquation(node.expression);
        }
        if(t.isBinaryExpression(node)) {
            if(['==', '===', '>='].indexOf(node.operator) >= 0) {
                return t.callExpression(
                    t.memberExpression(
                        buildLinearEquation(node.left),
                        t.identifier('cnEquals')
                    ),
                    [buildLinearEquation(node.right)]
                );
            } else if(['+'].indexOf(node.operator) >= 0) {
                return t.callExpression(
                    t.memberExpression(
                        buildLinearEquation(node.left),
                        t.identifier('plus')
                    ),
                    [buildLinearEquation(node.right)]
                );
            } else if(['*'].indexOf(node.operator) >= 0) {
                let left = t.isIdentifier(node.left) ? node.left : node.right;
                let right = t.isIdentifier(node.right) ? node.left : node.right;
                return t.callExpression(
                    t.memberExpression(
                        buildLinearEquation(left),
                        t.identifier('times')
                    ),
                    [buildLinearEquation(right)]
                );
            }
        }
        if(t.isIdentifier(node)) {
            return node;
        }
        if(t.isNumericLiteral(node)) {
            return t.numericLiteral(node.value);
        }
        throw new Error(`unknown type in always statement: ${node.type}`)
    }

    return {
        visitor: {
            Program: {
                enter(path, state) {
                    function replaceReference(ref) {
                        ref.replaceWith(t.callExpression(
                            t.memberExpression(
                                ref.node,
                                t.identifier('value')
                            ),
                            []
                        ));
                        ref.skip();
                    }

                    let variables = [];
                    let constraintExpressions = [];

                    path.traverse({
                        LabeledStatement(path) {
                            if(path.node.label.name !== 'always') { return; }
                            constraintExpressions.push(path);

                            path.traverse({
                                Identifier(path) {
                                    if(path.node.name === 'always') { return; }
                                    variables.push(path);
                                }
                            });
                        }
                    });
                    let bindings = new Set();
                    variables.forEach(v => {
                        v.findParent(par => {
                                if( par.scope.hasOwnBinding(v.node.name)) {
                                    let binding = par.scope.getBinding(v.node.name);
                                    bindings.add(binding);
                                }
                            }
                        );
                    });
                    bindings.forEach(b => b[IS_BINDING_FOR_CONSTRAINT_VAR] = true);

                    // assigning to a reference
                    path.traverse({
                        Identifier(path) {
                            if(!isVariable(path)) return;

                            if(path.parentPath.isAssignmentExpression() && path.parentKey === 'left') {
                                let parent = path.parentPath;
                                let par = path.find(parent => parent.scope.hasOwnBinding(path.node.name));
                                let binding = par.scope.getBinding(path.node.name);

                                if(binding[IS_BINDING_FOR_CONSTRAINT_VAR]) {
                                    path.parentPath.replaceWith(t.callExpression(
                                        addCustomTemplate(state.file, SET_CONSTRAINT_VAR),
                                        [
                                            binding.path.get('id').node,
                                            t.stringLiteral(parent.node.operator),
                                            parent.get('right').node
                                        ]
                                    ))
                                }
                            }
                        }
                    });

                    bindings.forEach(binding => {
                        binding.referencePaths
                            .filter(ref => {
                                // inside always statement
                                if(ref.findParent(parent => {
                                        return parent.isLabeledStatement() && parent.node.label.name === 'always';
                                    })) { return false; }

                                // ExportNamedDeclarations should not be rewritten as reference
                                // they are already rewritten as binding
                                if(ref.isExportNamedDeclaration()) {
                                    return false;
                                }
                                // Same for declaring the default export
                                if(ref.isExportDefaultDeclaration()) {
                                    return false;
                                }

                                // handle named exports special
                                if(ref.parentPath.isExportSpecifier() && ref.parentKey === 'local') {
                                    ref
                                        .find(path => path.parentPath.isProgram())
                                        .insertBefore(recordToVarTemplate({ reference: mark(t.identifier(binding.identifier.name)) }))
                                        .forEach(newPath => newPath.skip());
                                    ref.skip();
                                    return false;
                                }

                                // ObjectPatterns and ArrayPatterns in VariableDeclarations do not accept MemberExpressions.
                                // Thus, we have to filter out these cases explicitly.
                                if(ref.findParent(p=>p.isPattern()) && ref.findParent(p=>p.isDeclaration())) {
                                    let pattern = bubbleThroughPattern(ref);
                                    if(pattern.parentPath.isVariableDeclarator() && pattern.parentKey === 'id') return false;
                                }
                                return true;
                            })
                            .forEach(replaceReference);
                    });

                    bindings.forEach(binding => {
                        let init = binding.path.get('init');
                        init.replaceWith(t.callExpression(
                            addCustomTemplate(state.file, NEW_CONSTRAINT_VAR),
                            [
                                t.stringLiteral(binding.path.get('id').node.name),
                                init.node
                            ]
                        ));
                    });

                    constraintExpressions.forEach(constraintExpression => {
                        constraintExpression.replaceWith(
                            t.callExpression(
                                addCustomTemplate(state.file, ADD_CONSTRAINT),
                                [
                                    buildLinearEquation(constraintExpression.node)
                                ]
                            )
                        );
                    });
                }
            }
        }
    };
}

