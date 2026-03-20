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


/**
 * Тестовый раннер для OMNOM Parser
 * Выполняет проверку AST на соответствие эталонам
 */

 function runIntegrityCheckTests() {
    var log = "";
    var errTable = [];
    var count_total_ok = 0;
    var count_total_err = 0;

    var testSuite = [
        // Отношение №1: Атомарные элементы
        { id: "1.1", grammar: 'INPUT = x1; x1 = "[a-z]+";', input: "abc", expected: { symbol: "INPUT", children: [{ symbol: "x1", text: "abc" }] } },
        { id: "1.2", grammar: 'INPUT = R1; R1 = "[a-z]+";', input: "abc", expected: { symbol: "INPUT", children: [{ symbol: "R1", text: "abc" }] } },
        { id: "1.3", grammar: 'INPUT = R1; R1 = x1 x2; x1 = "a"; x2 = "b";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }] }] } },
        { id: "1.4", grammar: 'INPUT = R2; R1 = x1; R2 = R1; x1 = "a";', input: "a", expected: { symbol: "INPUT", children: [{ symbol: "R2", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }] }] }] } },

        // Отношение №2: Бинарные операции
        { id: "2.1", grammar: 'INPUT = R1; R1 = x1 x2; x1 = "a"; x2 = "b";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }] }] } },
        { id: "2.2", grammar: 'INPUT = R1; R1 = x1 | x2; x1 = "a"; x2 = "b";', input: "a", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }] }] } },
        { id: "2.3", grammar: 'INPUT = R1; R1 = x1 - x2; x1 = "[a-z]"; x2 = "a";', input: "b", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "b" }] }] } },
        { id: "2.4", grammar: 'INPUT = R1; R1 = x1 x2 | x3; x1 = "a"; x2 = "b"; x3 = "c";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }] }] } },
        { id: "2.5", grammar: 'INPUT = R1; R1 = x1 | x2 - x3; x1 = "a"; x2 = "b"; x3 = "c";', input: "a", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }] }] } },
        { id: "2.6", grammar: 'INPUT = R1; R1 = x1 x2 | x3 - x4; x1 = "a"; x2 = "b"; x3 = "c"; x4 = "d";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }] }] } },

        // Отношение №3: Унарные операции
        { id: "3.1", grammar: 'INPUT = R1; R1 = x1?; x1 = "a";', input: "", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [] }] } },
        { id: "3.2", grammar: 'INPUT = R1; R1 = x1*; x1 = "a";', input: "aa", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x1", text: "a" }] }] } },
        { id: "3.3", grammar: 'INPUT = R1; R1 = x1+; x1 = "a";', input: "a", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }] }] } },
        { id: "3.4", grammar: 'INPUT = R1; R1 = (x1 x2)*; x1 = "a"; x2 = "b";', input: "abab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }, { symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }] }] } },
        { id: "3.5", grammar: 'INPUT = R1; R1 = (x1 | x2)+; x1 = "a"; x2 = "b";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }] }] } },
        { id: "3.6", grammar: 'INPUT = R1; R1 = (x1 - x2)?; x1 = "[a-z]"; x2 = "a";', input: "b", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "b" }] }] } },

        // Отношение №4: Группировка и вложенность
        { id: "4.1", grammar: 'INPUT = R1; R1 = (x1 x2); x1 = "a"; x2 = "b";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }] }] } },
        { id: "4.2", grammar: 'INPUT = R1; R1 = (x1 (x2 x3)); x1 = "a"; x2 = "b"; x3 = "c";', input: "abc", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }, { symbol: "x3", text: "c" }] }] } },
        { id: "4.3", grammar: 'INPUT = R1; R1 = (x1 | (x2 x3)); x1 = "a"; x2 = "b"; x3 = "c";', input: "bc", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x2", text: "b" }, { symbol: "x3", text: "c" }] }] } },
        { id: "4.4", grammar: 'INPUT = R1; R1 = ((x1 x2) | (x3 x4)); x1 = "a"; x2 = "b"; x3 = "c"; x4 = "d";', input: "cd", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x3", text: "c" }, { symbol: "x4", text: "d" }] }] } },
        { id: "4.5", grammar: 'INPUT = R1; R1 = ((x1 x2) | x3)*; x1 = "a"; x2 = "b"; x3 = "c";', input: "abc", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }, { symbol: "x2", text: "b" }, { symbol: "x3", text: "c" }] }] } },

        // Отношение №5: Мета-логика
        { id: "5.1", grammar: 'INPUT = R1; R1 = $x1 x2; x1 = "a"; x2 = "b";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x2", text: "b" }] }] } },
        { id: "5.2", grammar: 'INPUT = R1; R1 = $(x1 x2); x1 = "a"; x2 = "b";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [] }] } },
        { id: "5.3. All OK. But simplifyAST() return only one node. Todo.\n", grammar: 'INPUT = R1; R1 = @x1 @x2; x1 = "a"; x2 = "b";', input: "ab", expected: { symbol: "INPUT", children: [{ symbol: "R1", text: "ab" }] } },
        { id: "5.4", grammar: 'INPUT = R1; R1 = @(x1 | x2); x1 = "a"; x2 = "b";', input: "a", expected: { symbol: "INPUT", children: [{ symbol: "R1", children: [{ symbol: "x1", text: "a" }] }] } }
    ];

    _.each(testSuite, function(test) {
        try {
            var parser = OMNOMGrammarParser(320, test.grammar);
            var actualAST = parser(test.input);
            var cleanActual = simplifyAST(actualAST);

            if (JSON.stringify(cleanActual) === JSON.stringify(test.expected)) {
                log += "Test " + test.id + ": [OK]\n";
                count_total_ok++;
            } else {
                log += "Test " + test.id + ": [FAIL]\n";
                log += "Expected: " + JSON.stringify(test.expected) + ", got " + JSON.stringify(cleanActual) + "\n";
                errTable.push(test.id);
                count_total_err++;
            }
        } catch (e) {
            log += "Test " + test.id + ": [ERROR] " + e.message + "\n";
            errTable.push(test.id);
            count_total_err++;
        }
    });

    var msg =`
//------------------------------------------
// OmNom Integrity Check
//------------------------------------------
`;
    msg += log;
    msg += "\nERR ID\n" + errTable.join("\n");
    msg += "\n\nTotal OK: " + count_total_ok + ", Total ERR: " + count_total_err;

    console.log(msg);
}

function simplifyAST(node) {
    // Если узел имеет только одного ребенка, который является терминалом (имеет text),
    // схлопываем его в {symbol, text}
    if (node.children && node.children.length === 1 && node.children[0].text !== undefined) {
        return { symbol: node.symbol, text: node.children[0].text };
    }
    // Рекурсивный обход
    return {
        symbol: node.symbol,
        children: (node.children || []).map(simplifyAST)
    };
}

  var root = this;
  if (typeof exports !== "undefined") root = exports;
  root.OMNOM_IntegrityCheck = runIntegrityCheckTests;

}).call(this)

OMNOM_IntegrityCheck();

