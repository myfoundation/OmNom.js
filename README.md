```
;   ____            _   _                   _
;  / __ \          | \ | |                 (_)
; | |  | |_ __ ___ |  \| | ___  _ __ ___    _ ___
; | |  | | '_ ` _ \| . ` |/ _ \| '_ ` _ \  | / __|
; | |__| | | | | | | |\  | (_) | | | | | |_| \__ \
;  \____/|_| |_| |_|_| \_|\___/|_| |_| |_(_) |___/
;                                         _/ |
;                A Jank Ass-Parser       |__/
;
;    v 1.0 2014 [L] Calder, v 2.0 LGPL 2026 (c) MasterMentor
;
```

# OmNom.js - Universal EBNF Parser

 Lightweight EBNF Parser, pure JavaScript, ~300 LOC.<br>
 Distributed under the GNU Lesser General Public License version 3 (LGPLv3).

## Live Demo
  [https://steamclub.net/public_library/omnom.js/demo/](https://steamclub.net/public_library/omnom.js/demo/)<br>

## Sources
Download:
  [https://github.com/myfoundation/OmNom.js](https://github.com/myfoundation/OmNom.js)<br>
  Original code: [https://github.com/calder/omnom](https://github.com/calder/omnom) (released under the public domain)

## Contacts
  Telegram: MasterMentor [@wizirx](https://t.me/wizirx) www: [https://steamclub.net](https://github.com/calder/omnom)

## Help

```
// ##########################
// ###        HELP        ###
// ##########################
// #
// # The OMNOM gammar is EBNF mirror. Write you grammar on EBNF, then do few changes using this table.
// #
// # TABLE OMNOM EBNF COMPARISION
// #|----------------------------------------------------------|
// #| OMNOM |  EBNF  |    COMMENT            |     EXAMPLE     |
// #|----------------------------------------------------------|
// #|   *   |   {}   |  repeat (0 or more)   | rule = A*;      |
// #|   +   |        |  repeat (1 or more)   | rule = A+;      |
// #|   ?   |   []   |  optional (0 or 1)    | rule = A?;      |
// #|       |   ,    |  sequence             | rule = A B;     |
// #|   |   |   |    |  choise               | rule = A | B;   |
// #|   -   |   -    |  difference           | rule = A - B;   |
// #|  ( )  |   ( )  |  group                | rule = (A | B); |    // rule = (A | B)* | C; rule = @(A | B)? C;
// #|  ""   |   ""   |  regular expression   | rule = "\d+";   |
// #|   ;   |    ;   |  rule end             |                 |
// #|   //  | (* *)  |  comment              | // comment      |
// #|       |   *    |  not realized         |                 |    // Use "regex" or just copy-past rule
// #|   $   |        |  silent               | rule = $A B;    |    // exlude from AST (comments, whitespaces)
// #|   @   |        |  meta logic           | rule = @expression*; // Lisp Unquote-Splicing. If @expression* the list of AST nodes, push list elements to current rule AST node. JavaScript analog [1, ...expression, 4]
// #| INPUT |        |  parser entry point   | INPUT = rule;   |
// #|----------------------------------------------------------|
// # Terminals must be regular expression: rule = "\d+";
// # Terminals strings pass to RegExp() without changes: "[\n]" === RegExp(/[\n]/, "mg")
// # Symbols -, $ may use in tokenizer: $ "[ \t\r\n]+";
// # Use $"regex" for remove whitespaces and comments. Use -"regex" for words deprecated in correct expression of grammar. Throw error if found (for fast detect bad tokens, f.e. 123abc deprecated word in C/C++ ).
```

## Examples

See [examples/](examples/)

```
calculator-bnf-ebnf.js
grammar.ebnf.calculator.txt
grammar.omnom.bnf.txt
grammar.omnom.calculator.txt
grammar.omnom.ebnf.txt
grammar.omnom.json.txt
grammar.omnom.lisp.txt
Lisp_Interpreter.txt
```

## Example Lisp

Try this in playgroung [demo/grammar_editor.html](demo/grammar_editor.html) and see AST.

```
// ##################
// ###  Terminals ###
// ##################

symbol  = "[a-zA-Z][\w-]*\??|=|\+|-|\*|/|<|>";
string  = "\"([^\\\"]*(\\.)?)*\"";
int     = "\d+";
float   = "\d*\.\d+|\d+\.\d*";
bool    = "#[tf]";
quote   = "\'";
op      = "\(";
cp      = "\)";
        $ ";[^\n]*";
        $ "[ \t\r\n]+";
        - "\d+[a-zA-Z]+";

// ###################
// ###    Rules    ###
// ###################

INPUT       = EXPRESSION*;
EXPRESSION  = ATOM | LIST | LITERAL;
LITERAL     = $quote @EXPRESSION;
ATOM        = symbol | string | int | float | bool;
LIST        = $op EXPRESSION* $cp;

// ###################
// ### LISP Lang   ###
// ###################

(define divides?
  (lambda (x y)
    (= (modulo y x) 0)))

(define divisors
  (lambda (x)
    (filter
      (lambda (y) (divides? y x))
      (range 2 (+ (sqrt x) 1)))))

(define prime?
  (lambda (x)
    (empty? (divisors x))))

(filter prime? (range 2 100))
```

## Tutorial
  1. Read OmNom grammar help: [README.md](README.md)
  2. Goto playground and write you own grammar [Open Grammar Editor](demo/grammar_editor.html)
  3. Try play [BNF Calculator](examples/calculator-bnf-ebnf.html)
  4. Find more grammatics for playground at [examples](examples) (JSON/EBNF/BNF/LISP available)

## Use

```
// Put this to HTML header
/*
    <script src="src/underscore.js" type="text/javascript" charset="utf-8"></script>
    <script src="src/omnom.js" type="text/javascript" charset="utf-8"></script>
    <script src="src/omnom_transpiler.js" type="text/javascript" charset="utf-8"></script>
    <script src="src/omnom_integrity_tests.js" type="text/javascript" charset="utf-8"></script>
*/

 // 1. Quick start
 var parser = OMNOMGrammarParser(32, 'Your OMNOM grammar');
 var AST = parser('Text to parse');

// 2. Integrity Check Tests
src/omnom_integrity_tests.js -> run

// 3. Transpilers. Write code in EBNF/BNF then convert to OMNOM grammar. See: src/omnom_transpiler.js
// EBNF->OMNOM

var ebnf_code_parser = OMNOMGrammarParser(320, ebnf2omnom('Your code in EBNF '));

// BNF->EBNF
var ebnf_code = bnf2ebnf('Your code in BNF ');
var bnf_code_parser = OMNOMGrammarParser(320, ebnf2omnom(ebnf_code));

// See more at Calculator Example

// 4. Calculator Example. Show transpiler work. Run: examples/calculator-bnf-ebnf.html
/*
Example transform chain:

Calculator BNF grammar-> AST -> exec AST ->
Calculator EBNF grammar -> AST -> exec AST ->
Calculator OMNOM grammar -> Calculator expression parser ->
Parse Calculator expression ->
expression AST -> exec AST -> value
*/

```




