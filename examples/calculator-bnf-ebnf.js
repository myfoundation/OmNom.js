/*
 * Copyright (C) 2024 MasterMentor
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
 * along with this library.  If not, see <https://www.gnu.org>.
 */

(function () {
  "use strict"

//------------------------------------------
// #1. Отдаем код калькулятора на EBNF и получаем AST
//------------------------------------------
var calculator_ebnf =
`
INPUT = expression;
expression = term , { ( "+" | "-" ) , term } ;
term       = factor , { ( "*" | "/" ) , factor } ;
factor     = [ "-" ] , ( primary | function ) ;
function   = ( "sin" | "cos" ) , "(" , expression , ")" ;
primary    = number | "(" , expression , ")" ;
number     = digit , { digit } , [ "." , digit , { digit } ] ;
digit      = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
`
;

var calculator_bnf =
`
<INPUT> ::= <expression>

<expression> ::= <term>
               | <expression> "+" <term>
               | <expression> "-" <term>

<term> ::= <factor>
         | <term> "*" <factor>
         | <term> "/" <factor>

<factor> ::= <primary>
           | <function>
           | "-" <primary>
           | "-" <function>

<function> ::= "sin" "(" <expression> ")"
             | "cos" "(" <expression> ")"

<primary> ::= <number>
            | "(" <expression> ")"

<number> ::= <digits>
           | <digits> "." <digits>

<digits> ::= <digit>
           | <digits> <digit>

<digit> ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
`
;

//------------------------------------------
// #2. Обходчик AST калькулятора (Вычислитель)
//------------------------------------------
/**
 * Обходчик AST калькулятора.
 * Преобразует дерево разбора в числовой результат.
 */
function execAST(node) {
    // Если узел - терминал (токен), возвращаем его значение
    if (node.token) {
        return node.text;
    }

    switch (node.symbol) {
        case "INPUT":
            return execAST(node.children[0]);

        case "expression":
            // expression = term (op term)*
            // Обрабатываем первый терм
            var result = execAST(node.children[0]);
            // Обрабатываем остальные пары (оператор, терм)
            for (var i = 1; i < node.children.length; i += 2) {
                var op = node.children[i].text;
                var right = execAST(node.children[i + 1]);
                if (op === "+") result += right;
                else if (op === "-") result -= right;
            }
            return result;

        case "term":
            // term = factor (op factor)*
            var result = execAST(node.children[0]);
            for (var i = 1; i < node.children.length; i += 2) {
                var op = node.children[i].text;
                var right = execAST(node.children[i + 1]);
                if (op === "*") result *= right;
                else if (op === "/") result /= right;
            }
            return result;

        case "factor":
            // factor = ("-")? (primary | function)
            // Если первый ребенок "-", значит это унарный минус
            if (node.children[0].text === "-") {
                return -execAST(node.children[1]);
            }
            return execAST(node.children[0]);

        case "function":
            // function = (name) "(" expression ")"
            var funcName = node.children[0].text;
            var arg = execAST(node.children[2]); // Индекс 2, так как 1 - это "("
            if (funcName === "sin") return Math.sin(arg);
            if (funcName === "cos") return Math.cos(arg);
            throw new Error("Unknown function: " + funcName);

        case "primary":
            // primary = number | "(" expression ")"
            // Если первый ребенок - "(", значит это выражение в скобках
            if (node.children[0].text === "(") {
                return execAST(node.children[1]);
            }
            return execAST(node.children[0]);

        case "number":
            // number = digit (digit)* ...
            // Собираем все цифры и точки в одну строку
            var numStr = "";
            _.each(node.children, function(child) {
                numStr += getFullText(child);
            });
            return parseFloat(numStr);

        case "digit":
            return node.children[0].text;

        default:
            throw new Error("Unknown node symbol: " + node.symbol);
    }
}

/**
 * Вспомогательная функция для рекурсивного сбора текста из узла (для чисел)
 */
function getFullText(node) {
    if (node.token) return node.text;
    return _.map(node.children, getFullText).join("");
}


//------------------------------------------
// 3. Draw AST
//------------------------------------------
/**
 * Отрисовка AST в ASCII art.
 * @param {Object} node - Узел дерева (из вашего JSON).
 * @param {String} prefix - Текущий отступ (для рекурсии).
 * @param {Boolean} isLast - Флаг последнего ребенка в списке.
 */
// Пример использования для вывода в консоль
// var output = drawAST(code_AST, "", true);
// console.log(output);
var drawAST = function(node, prefix, isLast) {
    if (!node) return "";

    prefix = prefix || "";
    var result = "";

    // Формируем заголовок узла: Символ или Текст токена
    var name = node.symbol ? node.symbol : (node.text ? '"' + node.text + '"' : "TOKEN");

    // Выбор символа разветвления
    var marker = isLast ? "└── " : "├── ";
    if (prefix === "") marker = ""; // Для корня не рисуем ветку

    result += prefix + marker + name + "\n";

    // Подготовка префикса для детей
    var newPrefix = prefix + (isLast ? "    " : "│   ");

    if (node.children && node.children.length > 0) {
        var lastIdx = node.children.length - 1;

        // Используем Underscore для итерации (стандарт роли)
        _.each(node.children, function(child, index) {
            result += drawAST(child, newPrefix, index === lastIdx);
        });
    }

    return result;
};

//------------------------------------------
// #4. EBNF calculator
//------------------------------------------
var calculator_parser = OMNOMGrammarParser(320, ebnf2omnom(calculator_ebnf));

var calculator_run = function(calculator_expression)
{
    var code_AST = calculator_parser(calculator_expression);
    if (code_AST.error) throw "Ошибка разбора выражения: " + JSON.stringify(code_AST.error);

    var value = execAST(code_AST);
    return value;
}

//------------------------------------------
// #5. BNF calculator
//------------------------------------------
var calculator2_ebnf   = bnf2ebnf(calculator_bnf);
var calculator2_omnom  = ebnf2omnom(calculator2_ebnf);
var calculator2_parser = OMNOMGrammarParser(320, calculator2_omnom);

var calculator2_run = function(calculator_expression)
{
    var code_AST = calculator2_parser(calculator_expression);
    if (code_AST.error) throw "Ошибка разбора выражения: " + JSON.stringify(code_AST.error);

    var value = execAST(code_AST);
    return value;
}

  console.log(calculator_bnf);
  console.log(calculator2_ebnf);


//------------------------------------------
// #6. Module exports
//------------------------------------------
  var root = this
  if (typeof exports !== "undefined") root = exports;

  var rk = {};

  rk.execAST            = execAST;
  rk.drawAST            = drawAST;

  // EBNF Calculator
  rk.calculator_run     = calculator_run;
  rk.calculator_parser  = calculator_parser;

  // BNF Calculator
  rk.calculator2_parser = calculator2_parser;
  rk.calculator2_run    = calculator2_run;
  rk.calculator_bnf     = calculator_bnf;
  rk.calculator2_ebnf   = calculator2_ebnf;
  rk.calculator2_omnom  = calculator2_omnom;

  root.calculator = rk;


}).call(this)

//------------------------------------------
// #7. Вычисляем математическое выражение
//------------------------------------------

var calc_xe = "(1+(2-4))*(4-5+sin(6+7))";
var calc_x1 = (1+(2-4))*(4-5+Math.sin(6+7));
var calc_x2 = calculator.calculator_run(calc_xe);
console.log(`EXPRESSION: ${calc_xe} = ${calc_x1} : ${calc_x2} : ${calc_x1 == calc_x2}`);

var calc_xe = "((1+4*(5-1)))*8-1";
var calc_x1 = ((1+4*(5-1)))*8-1;
var calc_x2 = calculator.calculator_run(calc_xe);
console.log(`EXPRESSION: ${calc_xe} = ${calc_x1} : ${calc_x2} : ${calc_x1 == calc_x2}`);

var calc_xe = "(1+(2-4))*(4-5+sin(6+7))";
var calc_x1 = (1+(2-4))*(4-5+Math.sin(6+7));
var calc_x2 = calculator.calculator2_run(calc_xe);
console.log(`EXPRESSION: ${calc_xe} = ${calc_x1} : ${calc_x2} : ${calc_x1 == calc_x2}`);

var calc_xe = "((1+4*(5-1)))*8-1";
var calc_x1 = ((1+4*(5-1)))*8-1;
var calc_x2 = calculator.calculator2_run(calc_xe);
console.log(`EXPRESSION: ${calc_xe} = ${calc_x1} : ${calc_x2} : ${calc_x1 == calc_x2}`);





