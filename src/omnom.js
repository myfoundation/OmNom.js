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

/*
Sources https://github.com/myfoundation/OmNom.js

VERSION 2.0.01    12:08 05.04.2026
-- Minor changes. Do code more compatible with C++ port

VERSION 2.0    21:08 20.03.2026
-- Added: groups ()
-- Added: difference -
-- Added: terminals "" in rules
-- Fixed: algorithms bugs in parseRule()
-- Fixed: rewriten initial grammar in Parser()
-- Added: integrity tests (omnom_integrity_tests.js)
-- Added: EBNF/BNF -> OMNOM trenaspiller (omnom_transpiler.js)
-- Added: docs & examples
-- Fixed: playground bugs

VERSION 1.0    2014
-- Release: base parser generator
*/


(function () {
  "use strict"

  var escapeStringAsRegExp = function(str) {
      return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  };

  var Parser = function (maxDepth, tokenDefs, symbolDefs) {

    var tokenTypes = _.object(_.map(tokenDefs, function (pattern, t) {
      try { var re = RegExp(pattern, "mg"); }
      catch (e) { throw {type:"Token Specification", token:t}; }
      return [t, re];
    }))

    var symbolTypes = _.object(_.map(symbolDefs, function (rules, s) {
      rules = rules.split(/\s+\|\s+/);
      return [s, _.map(rules, function (symbols) {
        symbols = symbols.split(/\s+/);
        return symbols;
      })]
    }))

    var parse = function (input) {
      var tokens = tokenize(input);
      if (tokens.error != undefined)
        return {error:{ type: "Tokenization", start: tokens.error, end: tokens.error }};

      var table = makeTable(tokens);
      var result = parseSymbol(table, tokens, input, "INPUT", 0, 0);

      if (result.length == undefined || result.length < tokens.length-1)
        if (tokens.length == 0)
          return {error:{ type: "Parse", start: 0, end: 0 }};
        else
          return {error:{ type: "Parse", start: tokens[result.error].start, end: tokens[result.error].end }};

      return niceTree(input, tokens, result.tree);
    }

    var tokenize = function (input) {
      var index = 0;
      var tokens = [];

      while (index < input.length) {
        var maxLength = 0
        var maxType;

        _.each(tokenTypes, function (pattern, type) {
          pattern.lastIndex = index;
          var match = pattern.exec(input);
          if (match && match.index == index && match[0].length > maxLength) {
            maxLength = match[0].length;
            maxType = type;
          }
        })

        if (maxLength == 0) return {error:index};
        if (maxType.charAt(0) == "-") return {error:index};

        if (maxType.charAt(0) != "$")
          tokens.push({type:maxType, start:index, end:index+maxLength});

        index += maxLength;
      }

      tokens.push({type:"end of input", start:input.length, end:input.length});
      return tokens;
    }

    var ttree = function (token, symbol) { return {token: token /* , symbol: symbol */ }; } // UNCOMMENT symbol FOR VIEW TERMINAL SYBOLS

    var stree = function (symbol, rule) { return { symbol: symbol, rule: rule, children: [] }; }
    var makeTable = function (tokens) { return _.map(tokens, function () { return {} }); }

    var parseSymbol = function (table, tokens, input, curSymbol, curToken, depth) {
      if (curToken >= tokens.length) return {error:tokens.length-1};
      if (depth    >= maxDepth)      return {error:tokens.length-1};

      if (!table[curToken][curSymbol]) {

        if (tokenTypes[curSymbol]) {
          var tokenObj = tokens[curToken];
          if (tokenObj.type == curSymbol) {
            table[curToken][curSymbol] = {length:1, error:0, tree:ttree(curToken, curSymbol)};
          }
          else {
            // Fallback-механизм для пересекающихся токенов (решает проблему "\d+" - "8")
            // Если тип не совпал, проверяем, подходит ли текст токена под регулярку искомого символа
            var pattern = tokenTypes[curSymbol];
            pattern.lastIndex = 0; // Сбрасываем индекс для глобального поиска
            var text = input.substring(tokenObj.start, tokenObj.end);
            var match = pattern.exec(text);

            // Совпадение должно быть полным (от начала до конца текста токена)
            if (match && match.index === 0 && match[0].length === text.length) {
              table[curToken][curSymbol] = {length:1, error:0, tree:ttree(curToken, curSymbol)};
            } else {
              table[curToken][curSymbol] = {error:curToken};
            }
          }
        }
        else if (symbolTypes[curSymbol]) {
          var c = {length:-1, error:curToken};

          for (var r = 0; r < symbolTypes[curSymbol].length; ++r) {
            var result = parseRule(table, tokens, input, curSymbol, curToken, r, depth);

            c.error = Math.max(c.error, result.error);

            if (_.isNumber(result.length) && (result.length > c.length)) {
              c.length = result.length;
              c.tree   = result.tree;
            }
          }

          if (c.length == -1) delete c.length;
          table[curToken][curSymbol] = c;
        }
        else {
          throw "Much badness at " + curSymbol + ", " + curToken;
        }
      }

      return table[curToken][curSymbol];
    }

    var
        FL_empty     = 0,
        FL_meta      = 1 << 0,
        FL_silent    = 1 << 1,
        FL_minus     = 1 << 2,
        FL_optional  = 1 << 3,
        FL_star      = 1 << 4,
        FL_plus      = 1 << 5,
        FL_group     = 1 << 6
   ;

    var getOptionsRegex = new RegExp("[@$?*+\\-]", "g");
    var getOptions = function(x) {
        var _r = { flags : FL_empty, symbol    : x.replace(getOptionsRegex, "") };
        _r.flags      |= x.indexOf("@") !== -1 ? FL_meta : 0;
        _r.flags      |= x.indexOf("$") !== -1 ? FL_silent : 0;
        _r.flags      |= x.indexOf("-") !== -1 ? FL_minus : 0;
        _r.flags      |= x.indexOf("?") !== -1 ? FL_optional : 0;
        _r.flags      |= x.indexOf("*") !== -1 ? FL_star : 0;
        _r.flags      |= x.indexOf("+") !== -1 ? FL_plus : 0;
        _r.flags      |= x.indexOf(":") !== -1 ? FL_group : 0;
        return _r;
    }

var parseRule = function (table, tokens, input, symbol, token, rule, depth) {
      var c = { length: 0, error: token, tree: stree(symbol, rule) };
      var expansion = symbolTypes[symbol][rule];

      for (var i = 0; i < expansion.length; ++i) {
        var __opt = getOptions(expansion[i]);
        var FL = __opt.flags;

        if(FL & FL_group) FL = FL | FL_meta;
        if(FL & FL_minus) FL = FL | FL_silent;

        var is_del_branch = false, found = false, found_total = 0;

          while (true) {
            var curDepth = c.length == 0 ? depth+1 : 0;
            var eval_pos = (FL & FL_minus) ? token : token + c.length;
            var result   = parseSymbol(table, tokens, input, __opt.symbol, eval_pos, curDepth);

            c.error = Math.max(c.error, result.error);
            found = result.length != undefined;
            if(found) found_total++;

            if (FL & FL_minus)
            {
                is_del_branch = found && (c.length === 0 || result.length === c.length);
                break;
            }
            else
            {
                is_del_branch = !found_total && !(FL & FL_star) && !(FL & FL_optional);
                if (is_del_branch) break;
            }

            if (!found) break;

            c.length += result.length;

            if (!(FL & FL_silent))
            {
                if ((FL & FL_meta)) // Если это мета-узел (@), выполняем сплайсинг
                {
                    if (result.tree.children && result.tree.children.length > 0)
                    {
                        // Нетерминал: сплайсим детей (добавляем всех детей в родителя)
                        _.each(result.tree.children, function (child) { c.tree.children.push(child) });
                    }
                    else
                    {
                        // Терминал: добавляем сам узел (сплющиваем его)
                        c.tree.children.push(result.tree);
                    }
                }
                else {
                    // Стандартное поведение (без @)
                    c.tree.children.push(result.tree);
                }
           }

            if ((FL & FL_star) || (FL & FL_plus)) continue;
            else break;
        }

        if(is_del_branch) {
            delete c.length;
            delete c.tree;
            break;
        }
      }
      return c;
    }


    var niceTree = function (input, tokens, tree)
    {
      var token = tokens[tree.token];
      return _.extend(tree,
      {
        text:     token ? input.substring(token.start, token.end) : undefined,
        token:    token,
        children: _.map(tree.children, function (child)
        {
          return niceTree(input, tokens, child);
        }),
      });
    }

    return parse;
  }

  // INIT EBNF LIKE PARSET BY GIVEN JSON STRUCT. IMPORTANT: YOU CAN'T CHANGE FILEDS NAMES
  var init_ebnf_Parser = Parser(32,
      {
        "$space":   "[ \\t\\r\\n]+",
        "$comment": "//[^\\n]*",
        symbol:   "[a-zA-Z0-9_]+",
        opt_1:    "(\\?|\\*|\\+|)",
        opt_0:    "(-|@|\\$|)",
        string:   '"([^\\\\"\n]|\\\\.)*"',
        eq:       "=", pipe: "\\|", op: "\\(", cp: "\\)", nl: ";",
      },
      {
        INPUT:    "$nl* TOKENS SYMBOLS",
        TOKENS:   "TOKEN*",
        TOKEN:    "opt_0? string $nl+",
        SYMBOLS:  "SYMBOL*",
        SYMBOL:   "symbol $eq OPTIONS $nl+",
        OPTIONS:  "OPTION @OPTIONS2*",
        OPTIONS2: "$pipe OPTION",
        OPTION:   "ELEMENT*",
        ELEMENT:  "opt_0? symbol opt_1? | opt_0? string opt_1? | GROUPS",
        GROUPS:   "opt_0? GROUP opt_1?",
        GROUP:    "op OPTIONS cp"
      }
  );

  var OMNOMGrammarParser = function (maxDepth, grammar) {
      var g = init_ebnf_Parser(grammar);
      if (g.error) throw g.error;

      var tokenCount = 0;
      var groupCount = 0;
      var anonTokenCount = 0;
      var tokenDefs = {};
      var symbolDefs = {};
      var tokenDoubles = {};

      // TREMINALS WITHOUT NAMES (FOR TOKENIZER ONLY)
      _.each(g.children[0].children, function (token) {
          var name, pattern;
          var c = token.children[0];
          if(c.token.type === "opt_0") {
              name = c.text + (tokenCount++);
              pattern = token.children[1].text.slice(1, -1);
          } else {
              name = "" + (tokenCount++);
              pattern = c.text.slice(1, -1);
          }
          tokenDefs[name] = pattern;
          tokenDoubles[pattern] = name;
      });

      function processOptions(optionsNode) {
          return _.map(optionsNode.children, function (optionNode) {
             return _.map(optionNode.children, function (elementNode) {
                  var prefix = "", postfix = "", sym_name = "";
                  var leaf = elementNode.children[0];

                  if (leaf.symbol === "GROUPS") {
                      var groupNode;
                      _.each(leaf.children, function(c) {
                          if (c.symbol === "GROUP") groupNode = c;
                          else if (c.token) {
                              if (c.token.type === "opt_0") prefix = c.text;
                              else if (c.token.type === "opt_1") postfix = c.text;
                          }
                      });
                      sym_name = ":GROUP_#" + (groupCount++);
                      symbolDefs[sym_name] = processOptions(groupNode.children[1]);
                  }
                  else if (elementNode.symbol === "ELEMENT" && elementNode.children.length > 0) {
                      var is_string = false, is_symbol = false;
                      var content = "";

                      _.each(elementNode.children, function(c) {
                          if (c.token) {
                              var tt = c.token.type;
                              if (tt === "symbol") { is_symbol = true; sym_name = c.text; }
                              else if (tt === "string") { is_string = true; content = c.text.slice(1, -1); }
                              else if (tt === "opt_0") prefix = c.text;
                              else if (tt === "opt_1") postfix = c.text;
                          }
                      });

                      if (is_symbol) {;}
                      else if (is_string)
                      {
                          if(tokenDoubles[content]) sym_name = tokenDoubles[content];
                          else {
                              sym_name = "TERM_#" + (anonTokenCount++);
                              tokenDefs[sym_name] = content;
                              tokenDoubles[content] = sym_name;
                          }
                      }
                      else sym_name = leaf.text;
                  }
                  else sym_name = leaf.text;

                  return prefix + sym_name + postfix;
              }).join(" ");
          }).join(" | ");
      }

      _.each(g.children[1].children, function (symbolNode) {
          var name = symbolNode.children[0].text;
          symbolDefs[name] = processOptions(symbolNode.children[1]);
      });
      tokenDoubles = null;

      return Parser(maxDepth, tokenDefs, symbolDefs);
  };

  var root = this;
  if (typeof exports !== "undefined") root = exports;
  root.Parser = Parser;
  root.OMNOMGrammarParser = OMNOMGrammarParser;
  root.escapeStringAsRegExp = escapeStringAsRegExp;

}).call(this)
