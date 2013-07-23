/*
   ____            _   _                   _     
  / __ \          | \ | |                 (_)    
 | |  | |_ __ ___ |  \| | ___  _ __ ___    _ ___ 
 | |  | | '_ ` _ \| . ` |/ _ \| '_ ` _ \  | / __|
 | |__| | | | | | | |\  | (_) | | | | | |_| \__ \
  \____/|_| |_| |_|_| \_|\___/|_| |_| |_(_) |___/
                                         _/ |    
                                        |__/     
          An (Almost) Universal Parser

This code is released under the public domain.
*/


var ttree = function (token) {
  return {token: token}
}


var stree = function (symbol, rule) {
  return {
    symbol:   symbol,
    rule:     rule,
    children: []
  }
}


var BasicParser = function (maxDepth, tokenDefs, symbolDefs) {
  var self = this


  var tokenTypes = _.object(_.map(tokenDefs, function (pattern, t) {
    return [t, new RegExp(pattern, "mg")]
  }))


  var symbolTypes = _.object(_.map(symbolDefs, function (rules, s) {
    rules = rules.split(/\s*\|\s*/)
    return [s, _.map(rules, function (symbols) {
      symbols = symbols.split(/\s+/)
      return symbols
    })]
  }))


  self.parse = function (input) {
    var tokens = tokenize(input)
    if (tokens.error)
      return {error:{
        type:  "Token",
        start: tokens.error,
        end:   tokens.error
      }}

    var table = makeTable(tokens)
    var result = parseSymbol(table, tokens, "input", 0, maxDepth)
    if (result.length == undefined || result.length < tokens.length)
      return {error:{
        type:  "Parse",
        start: tokens[result.error+1].start,
        end:   tokens[result.error+1].end
      }}

    var tree = niceTree(input, tokens, result.tree)
    return tree
  }


  var tokenize = function (input) {
    var index = 0
    var tokens = []

    while (index < input.length) {
      var maxLength = 0
      var maxType

      _.each(tokenTypes, function (pattern, type) {
        pattern.lastIndex = index
        var match = pattern.exec(input)
        if (match && match.index == index && match[0].length > maxLength) {
          maxLength = match[0].length
          maxType = type
        }
      })

      if (maxLength == 0)
        return {error:index}

      if (maxType.charAt(0) != "$")
        tokens.push({type:maxType, start:index, end:index+maxLength})

      index += maxLength
    }

    return tokens
  }


  var makeTable = function (tokens) {
    return _.map(tokens, function () { return {} })
  }


  var cell = function (table, symbol, token) {
    return table[token][symbol]
  }


  var setCell = function (table, symbol, token, cell) {
    table[token][symbol] = cell
  }


  var parseSymbol = function (table, tokens, curSymbol, curToken, depth) {
    if (curToken >= tokens.length) return {error:tokens.length-1}
    if (depth >= self.maxDepth) return {error:tokens.length-1}

    if (!cell(table, curSymbol, curToken)) {

      if (tokenTypes[curSymbol]) {
        if (tokens[curToken].type == curSymbol) {
          setCell(table, curSymbol, curToken, {length:1, error:-1, tree:ttree(curToken)})
        }
        else {
          setCell(table, curSymbol, curToken, {error:curToken-1})
        }
      }

      else if (symbolTypes[curSymbol]) {
        var c = {length:-1, error:curToken-1}

        for (var r = 0; r < symbolTypes[curSymbol].length; ++r) {
          var result = parseRule(table, tokens, curSymbol, curToken, r, depth)

          c.error = Math.max(c.error, result.error)

          if (result.length > c.length) {
            c.length = result.length
            c.tree   = result.tree
          }
        }

        if (c.length == -1) delete c.length
        setCell(table, curSymbol, curToken, c)
      }

      else {
        undefined.x
      }

    }

    return cell(table, curSymbol, curToken)
  }


  var parseRule = function (table, tokens, symbol, token, rule, depth) {
    var c = {
      length: 0,
      error:  token-1,
      tree:   stree(symbol, rule)
    }

    var expansion = symbolTypes[symbol][rule]
    for (var i = 0; i < expansion.length; ++i) {
      var curSymbol = expansion[i]
      var meta      = curSymbol.charAt(0) == "@"
      var silent    = curSymbol.charAt(0) == "$"
      var repeat    = curSymbol.charAt(curSymbol.length-1) == "*"

      if (meta)   curSymbol = curSymbol.substring(1)
      if (silent) curSymbol = curSymbol.substring(1)
      if (repeat) curSymbol = curSymbol.substring(0, curSymbol.length-1)

      if (repeat) {
        while (true) {
          var curDepth = c.length == 0 ? depth-1 : maxDepth
          var result   = parseSymbol(table, tokens, curSymbol, token+c.length, curDepth)

          c.error = Math.max(c.error, result.error)
          if (!result.length) break

          c.length += result.length
          if (meta && result.tree.children)
            _.each(result.tree.children, function (child) { c.tree.children.push(child) })
          if (!meta && !silent)
            c.tree.children.push(result.tree)
        }
      }

      else {
        var curDepth = c.length == 0 ? depth-1 : maxDepth
        var result = parseSymbol(table, tokens, curSymbol, token+c.length, curDepth)
        
        c.error = Math.max(c.error, result.error)
        if (result.length == undefined) {
          delete c.length
          delete c.tree
          break
        }

        c.length += result.length
          if (meta && result.tree.children)
            _.each(result.tree.children, function (child) { c.tree.children.push(child) })
          if (!meta && !silent)
            c.tree.children.push(result.tree)
      }
    }

    return c
  }


  var niceTree = function (input, tokens, tree) {
    var nice = _.clone(tree)

    if (nice.token != undefined) {
      var token = tokens[nice.token]
      nice.token = {
        token: input.substring(token.start, token.end),
        type:  token.type
      }
    }

    if (nice.children) {
      nice.children = _.map(nice.children, function (c) {
        return niceTree(input, tokens, c)
      })
    }

    return nice
  }
}