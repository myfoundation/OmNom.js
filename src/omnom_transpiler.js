/*
 * Copyright (C) 2026 MasterMentor
 *
 * This library is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation; either version 3 of the
 * License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this library.  If not, see https://www.gnu.org .
 */

(function () {
  "use strict"

// ============================================================================
// ШАГ 1: Создаем грамматику OMNOM для разбора EBNF (Транспилятор AST)
// ============================================================================
// Примечание: экранирование \\ необходимо для передачи \ в регулярные выражения OMNOM
var ebnf_to_onmom_transpiler_grammar =
`
$ "[ \\t\\r\\n]+";
$ "\\(\\*[\\s\\S]*?\\*\\)";

// Точка входа
INPUT = rule+ ;
// Правило: идентификатор = выражение ;
rule = identifier "=" expression ";" ;
// Выражение: термы, разделенные | (Choice)
expression = term ( "\\|" term )* ;
// Терм: факторы, разделенные , (Sequence)
term = factor ( "," factor )* ;
// Фактор: обработка разности (-) и синтаксического сахара (N*"X")
// (integer "*")? - для 3*"D"
// ( "-" primary )? - для A - B
factor = (integer "\\*")? primary ( "-" primary )? ;
// Первичные элементы: идентификаторы, строки, группы, опциональность, повторения
primary = identifier
        | string
        | "\\(" expression "\\)"  // Group
        | "\\[" expression "\\]"  // Optional
        | "\\{" expression "\\}" ; // Repetition
// Лексика
identifier = "[a-zA-Z_][a-zA-Z0-9_]*" ;
integer = "[0-9]+" ;
string = "\\"[^\\"]*\\"|'[^']*'" ;
`
;

var bnf_to_ebnf_transpiler_grammar = `
$ "[ \\t\\r\\n]+";

INPUT = rule+ ;
// Правило BNF: LHS ::= RHS
rule = lhs "::=" rhs ;
// Правая часть: список альтернатив (разделены |)
rhs = list ("\\|" list)* ;
// Список: последовательность термов (в BNF это просто пробел)
list = term+ ;
// Терм: либо терминал, либо нетерминал.
// Используем -next_rule, чтобы не "съесть" начало следующего правила
term = terminal | -next_rule non_terminal ;
// Условие для Negative Lookahead: если впереди "::=", это не часть текущего списка
next_rule = non_terminal "::=" ;
// Элементы
lhs = non_terminal ;
non_terminal = "<" identifier ">" ;
terminal = "\\"[^\\"]*\\"" ;
// Лексика
identifier = "[a-zA-Z0-9_-]+" ;
`;


// ============================================================================
// ШАГ 2: Обходчик AST (Транспилятор EBNF -> OMNOM)
// ============================================================================
/**
 * Универсальный обходчик AST для транспиляции EBNF -> OMNOM
 * @param {Object} node - Узел AST
 * @returns {string} - Строка в формате OMNOM
 */
function execAST_0(node) {
    // Базовый случай: если это терминал (токен), возвращаем его текст
    if (node.token) {
        var text = node.text;
        // Трансформация: запятая в EBNF становится пробелом в OMNOM
        if (text === ",") return " ";
        return text;
    }

    // Рекурсивный обход в зависимости от типа узла (symbol)
    switch (node.symbol) {
        case "INPUT":
            // Соединяем правила символом новой строки
            return _.map(node.children, execAST_0).join("\n");

        case "rule":
            // rule = identifier "=" expression ";"
            // children: [identifier, "=", expression, ";"]
            return execAST_0(node.children[0]) + " = " + execAST_0(node.children[2]) + " ;";

        case "expression":
            // expression = term ( "|" term )*
            // children: [term, "|", term, ...]
            return _.map(node.children, execAST_0).join(" ");

        case "term":
            // term = factor ( "," factor )*
            // children: [factor, ",", factor, ...]
            // Запятые уже обработаны в базовом случае (token) как пробелы
            return _.map(node.children, execAST_0).join("");

        case "factor":
            // factor = (integer "*")? primary
            // Если children.length > 1, значит есть integer и "*"
            if (node.children.length > 1) {
                var count = parseInt(node.children[0].text, 10);
                var primaryNode = node.children[2];
                var primaryStr = execAST_0(primaryNode);
                // Развертывание: N * "D" -> "D" "D" "D"
                var arr = [];
                for (var i = 0; i < count; i++) arr.push(primaryStr);
                return arr.join(" ");
            }
            return execAST_0(node.children[0]);

        case "primary":
            // primary = identifier | string | "(" expr ")" | "[" expr "]" | "{" expr "}"
            var first = node.children[0];

            // Если это идентификатор или строка
            if (first.symbol === "identifier" || first.symbol === "string") {
                return execAST_0(first);
            }

            // Если это группа/опциональность/повторение
            var bracket = first.text; // "(" или "[" или "{"
            var expr = execAST_0(node.children[1]);

            if (bracket === "(") return "(" + expr + ")";
            if (bracket === "[") return "(" + expr + ")?";
            if (bracket === "{") return "(" + expr + ")*";
            return expr;

        case "string":
            return escapeStringAsRegExp(node.children[0].text);

        case "identifier":
        case "integer":
            return node.children[0].text;

        default:
            // Для узлов, не требующих специфической обработки, просто обходим детей
            return node.children ? _.map(node.children, execAST_0).join("") : "";
    }
}

/**
 * Обходчик AST для транспиляции BNF -> EBNF
 * @param {Object} node - Узел AST
 * @returns {string} - Строка в формате EBNF
 */
function execAST_1(node) {
    if (node.token) return node.text;

    switch (node.symbol) {
        case "INPUT":
            return _.map(node.children, execAST_1).join("\n");

        case "rule":
            var lhs = execAST_1(node.children[0]);
            var rhs = node.children[2];
            var alternatives = _.filter(rhs.children, function(c) { return c.symbol === "list"; });

            var base = [];
            var recursive = [];

            _.each(alternatives, function(alt) {
                var firstTerm = execAST_1(alt.children[0]);
                if (firstTerm === lhs) {
                    recursive.push(alt);
                } else {
                    base.push(alt);
                }
            });

            var baseStr = _.map(base, execAST_1).join(" | ");

            if (recursive.length === 0) {
                return lhs + " = " + baseStr + " ;";
            }

            // Рекурсивная часть: берем элементы после LHS, соединяем запятыми
            var recStr = recursive.map(function(alt) {
                return _.map(alt.children.slice(1), execAST_1).join(" , ");
            }).join(" | ");

            // Добавляем запятую перед рекурсивной группой для соблюдения стандарта EBNF
            return lhs + " = " + baseStr + " , { " + recStr + " } ;";

        case "list":
            // Внутри списка элементы всегда разделяются запятой
            return _.map(node.children, execAST_1).join(" , ");

        case "term":
            return execAST_1(node.children[0]);

        case "non_terminal":
            return execAST_1(node.children[1]);

        case "terminal":
            return execAST_1(node.children[0]);

        case "identifier":
            return node.children[0].text;

        default:
            return node.children ? _.map(node.children, execAST_1).join("") : "";
    }
}

// ============================================================================
// ШАГ 3: Создаем парсер EBNF
// ============================================================================
var ebnf_omnom_transpiler_parser = OMNOMGrammarParser(320, ebnf_to_onmom_transpiler_grammar);
var bnf_ebnf_transpiler_parser = OMNOMGrammarParser(320, bnf_to_ebnf_transpiler_grammar);

// EBNF TEXT -> OMNOM TEXT
var transpile_ebnf_text_omnom_text = function(ebnf_text)
{
    var transplier_AST = ebnf_omnom_transpiler_parser(ebnf_text);
    if (transplier_AST.error) throw "Ошибка разбора EBNF: " + JSON.stringify(transplier_AST.error);
    var omnom_text = execAST_0(transplier_AST);
    return omnom_text;
}

// BNF TEXT -> EBNF TEXT
var transpile_bnf_text_ebnf_text = function(bnf_text)
{
    var transplier_AST = bnf_ebnf_transpiler_parser(bnf_text);
    if (transplier_AST.error) throw "Ошибка разбора BNF: " + JSON.stringify(transplier_AST.error);
    var ebnf_text = execAST_1(transplier_AST);
    return ebnf_text;
}

// BNF TEXT -> OMNOM TEXT
var transpile_bnf_text_omnom_text = function(bnf_text)
{
    var ebnf_text = transpile_bnf_text_ebnf_text(bnf_text);
    var omnom_text = transpile_ebnf_text_omnom_text(ebnf_text);
    return omnom_text;
}

  var root = this;
  if (typeof exports !== "undefined") root = exports;
  root.ebnf2omnom   = transpile_ebnf_text_omnom_text;
  root.bnf2omnom    = transpile_bnf_text_omnom_text;
  root.bnf2ebnf     = transpile_bnf_text_ebnf_text;

}).call(this)
