const FLAG_GENERATED_SCOPE_OBJECT = Symbol('FLAG: generated scope object');
const FLAG_SHOULD_NOT_REWRITE_IDENTIFIER = Symbol('FLAG: should not rewrite identifier');

const NEW_CONSTRAINT_VAR = 'newConstraintVar';
const SET_CONSTRAINT_VAR = 'setConstraintVar';
const GET_CONSTRAINT_VAR = 'getConstraintVar';
const ADD_CONSTRAINT = 'addConstraint';

const IS_BINDING_FOR_CONSTRAINT_VAR = 'IS_BINDING_FOR_CONSTRAINT_VAR';

export default function({ types: t, template, traverse }) {
  function getDefiningVar(path) {
    return;
  }
  
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
  
    let identifier = file.declarations[name] = file.addImport("https://lively-kernel.org/lively4/programming-constraints-plain/cassowary.js", name, name);
    return identifier;
  }
  
  function getIdentifierForExplicitScopeObject(parentWithScope) {
      let bindings = parentWithScope.scope.bindings;
      let scopeName = Object.keys(bindings).find(key => {
          return bindings[key].path &&
              bindings[key].path.node &&
              bindings[key].path.node.id &&
              bindings[key].path.node.id[FLAG_GENERATED_SCOPE_OBJECT] // should actually be IS_EXPLICIT_SCOPE_OBJECT
      });
  
      let uniqueIdentifier;
      if(scopeName) {
          uniqueIdentifier = t.identifier(scopeName);
      } else {
          uniqueIdentifier = parentWithScope.scope.generateUidIdentifier('scope');
          uniqueIdentifier[FLAG_GENERATED_SCOPE_OBJECT] = true;
  
          parentWithScope.scope.push({
              kind: 'let',
              id: uniqueIdentifier,
              init: t.objectExpression([])
          });
      }
      uniqueIdentifier[FLAG_SHOULD_NOT_REWRITE_IDENTIFIER] = true;
      return uniqueIdentifier;
  }
  
  function getScopeIdentifierForVariable(path) {
    if(path.scope.hasBinding(path.node.name)) {
      //logIdentifier('get local var', path)
      path.node[FLAG_SHOULD_NOT_REWRITE_IDENTIFIER] = true;
  
      let parentWithScope = path.findParent(par =>
          par.scope.hasOwnBinding(path.node.name)
      );
      if(parentWithScope) {
          return getIdentifierForExplicitScopeObject(parentWithScope);
      }
    } else {
      throw new Error('globals not supported yet for '+path.node.name);
      //logIdentifier('get global var', path);
      //path.node[FLAG_SHOULD_NOT_REWRITE_IDENTIFIER] = true;
      //return t.identifier('window');
    }
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
            let par = ref.find(parent => parent.scope.hasOwnBinding(ref.node.name));
            let binding = par.scope.getBinding(ref.node.name);
            let scope = getIdentifierForExplicitScopeObject(binding.path);

            ref.replaceWith(t.callExpression(
              addCustomTemplate(state.file, GET_CONSTRAINT_VAR),
              [
                scope,
                t.stringLiteral(ref.node.name)
              ]
            ))
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
          
          path.traverse({
            Identifier(path) {
              if(!isVariable(path)) return;
      
              // special case of assigning to a reference
              let pattern = (path);
              if(pattern.parentPath.isAssignmentExpression() && pattern.parentKey === 'left') {
                let parent = pattern.parentPath;
                let par = path.find(parent => parent.scope.hasOwnBinding(path.node.name));
                let binding = par.scope.getBinding(path.node.name);
                let scope = getIdentifierForExplicitScopeObject(binding.path);
                
                if(binding[IS_BINDING_FOR_CONSTRAINT_VAR]) {
                  pattern.parentPath.replaceWith(t.callExpression(
                    addCustomTemplate(state.file, SET_CONSTRAINT_VAR),
                    [
                      scope,
                      t.stringLiteral(binding.path.get('id').node.name),
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
            console.log(binding)
            let init = binding.path.get('init'),
                scope = getIdentifierForExplicitScopeObject(binding.path);
            init.replaceWith(t.callExpression(
              addCustomTemplate(state.file, NEW_CONSTRAINT_VAR),
              [
                scope,
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

