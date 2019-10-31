---
title: 从零实现自定义 JSON Parser
date: "2019-10-31T01:15:32.956Z"
description: "Zergling 是我们团队自研的埋点管理平台，默认的数据格式有点特殊，需要一个自定义的 json parser 来规范输入问题，总的分为词法分析和语法分析两部分"
---

![header.png](https://p1.music.126.net/qE1Yxs0kk3qfv9aVS8ttyQ==/109951164457475823.png)

### 简介

Zergling 是我们团队自研的埋点管理平台，默认的数据格式如下：

```js
{
    "page": "dsong|ufm", 
    "resource": "song", // 歌曲
    "resourceid": 1, // 资源 id
    "target": 111, // 不感兴趣
    "targetid": "button", 
    "reason": "", 
    "reason_type": "fixed" 
}
```
一种自定义 json 格式，比较不同在于：
1. 带注释
2. 字符串通过 `|` 分割符，当做数组用
3. value 为基本类型，没有 object。

在实际过程中有一些不符合规范的地方:

1. 用 value 当做注释，而不用 comment
<img src="https://p1.music.126.net/GTDZ6tpW1IBspn46k2WgUA==/109951164323598647.png">

应该为

```js
id: 1111, // 活动 url
```

2. 用 `/` 做数组分割符，而不是 `|`。
<img src="https://p1.music.126.net/j-kDIS3_lMdf1XSih4S9oA==/109951164323601543.png">

除了上述错误类型之外，还有其他错误类型。于是决定写一个自定义的 json parser 来规范输入问题。总的分为词法分析和语法分析两部分。

### 词法分析

词法分析主要将源码分割成很多小的子字符串变成一系列的 token.

比如下面的赋值语句。
```js
var language = "lox";
```
词法分析后，输出 5 个 token 如下
<img src="https://p1.music.126.net/0osyr10fgzMWKjRfi_r63w==/109951164323596336.png" />

所以词法分析的关键就在于如何分割字符串。

我们先定义 token 的数据结构 (Token.js)

```js
class Token {
    constructor (type,value){
        this.type = type;
        this.value = value;
    }
}
```
再定义 Token 类型 (TokenType.js), 参考 [token type](https://github.com/antlr/grammars-v4/blob/master/javascript/JavaScriptLexer.g4)
```js
const TokenType = {
    OpenBrace: "{", // 左括号
    CloseBrace: "}", // 右括号
    StringLiteral: "StringLiteral", // 字符串类型
    BitOr: "|",
    SingleSlash: "/",
    COLON: ":",
    QUOTE: '"',
    NUMBER: "NUMBER",
    COMMA: ",",
    NIL: "NIL", // 结束的字符
    EOF: "EOF", //end token
};
```

做好上面准备之后，就可以着手处理字符了。

先定义一个类 Lexer (Lexer.js)
```js
class Lexer {
  constructor (input) {
    this.input = input;// 输入
    this.pos = 0;// 指针
    this.currentChar = this.input [this.pos];
    this.tokens = []; // 返回的所有 token
  }
}
```
词法处理是一个个读取字符串，然后分别组装成一个 Token。我们先从简单的符号比如 `{`,`=`开始，如果碰到符号，我们就直接返回对应的 token。对于空白，我们就忽略。
```js
// 获取所有的 token;
  lex () {
    while (this.currentChar && this.currentChar != TokenType.NIL) {// 如果当前不是结束的字符
      this.skipWhiteSpace ();
      let token = "";
      switch (this.currentChar) {
        case "{":
          this.consume ();
          token = new Token (TokenType.OpenBrace, TokenType.OpenBrace);
          break;
        case "}":
          this.consume ();
          token = new Token (TokenType.CloseBrace, TokenType.CloseBrace);
          break;
        case ":":
          this.consume ();
          token = new Token (TokenType.COLON, TokenType.COLON);
          break;
        case ",":
          this.consume ();
          token = new Token (TokenType.COMMA, TokenType.COMMA);
          break;
      }
      if (token) this.tokens.push (token);
    }

    this.tokens.push (new Token (TokenType.EOF, TokenType.EOF));
  }

```
`this.skipWhiteSpace` 主要是处理空白，如果当前字符是空白符，我们就移动指针 `pos++`，去判断下一个字符，直到不是空白符为止。`this.consume` 这个函数就是用来移动指针.

```js
skipWhiteSpace () {
    while (!this.isEnd () && this.isSpace (this.currentChar)) {
      this.consume ();
    }
}

isSpace (char) {
  const re = /\s/gi;
  return re.test (char);
}

  /** 获取下一个字符 */
consume () {
  if (!this.isEnd ()) {
    this.pos++;
    this.currentChar = this.input [this.pos];
  } else {
    this.currentChar = TokenType.NIL;
  }
}

// 判断是否读完
isEnd () {
  return this.pos > this.input.length - 1;
}

```
对于符号的处理直接返回 token 即可，对于字符串稍微麻烦一点。比如
`"page"` 这个我们需要读 4 个字符组合在一起。因此，当我们碰到 `"` 双引号的时候，我们就进入 getStringToken 函数来处理。

(Lexer.js->lex)
```js
 case '"':
      token = this.getStringToken ();
      break;
```
对于 `getStringToken`。我们这里比较特别，一般的 string 没有 `|` 这个分隔符，比如 `"page"`。而我们的例子里面如 `"dsong|ufm"`, 将返回 `dsong`, `|`, `ufm`, 三个 token。

```js
  getStringToken (){
      let buffer = "";
      while (this.isLetter (this.currentChar) || this.currentChar == TokenType.BitOr)
      {
        if (this.currentChar == TokenType.BitOr) {
          if (buffer)
              this.tokens.push (new Token (TokenType.StringLiteral, buffer));
          this.tokens.push (new Token (TokenType.BitOr, TokenType.BitOr));
          buffer = "";
        } 
      }
  }
```
对于 comment 类似，当我们碰到字符是 `/` 的时候，我们就假设他是注释 `//xxx`。对于 comment 就自动忽略。

(Lexer.js->lex)
```js
case "/":
        token = this.getCommentToken ();
        break;
```

```js
  getCommentToken () {
    // 简单处理两个 /
    this.match (TokenType.SingleSlash);
    this.match (TokenType.SingleSlash);

    while (!this.isNewLine (this.currentChar) && !this.isEnd ()) {
      this.consume ();
    }
    return;
  }

  isNewLine (char) {
    const re = /\r?\n/;
    return re.test (char);
  }
```

接下来处理数字，类似 string, 比如 111，三个字符，我们当做一个数字。所以我们规定当字符是数字的时候，我们就进入处理 `getNumberToken` 来处理数字。

（Lexer.js->lex）
```js
 default:
        if (this.isNumber (this.currentChar)) {
          token = this.getNumberToken ();
        } else {
          throw new Error (`${this.currentChar} is not a valid type`);
        }
```

接下来处理 `getNumberToken` 函数
```js
getNumberToken () {
    let buffer = "";
    while (this.isNumber (this.currentChar)&&!this.isEnd ()) {
      buffer += this.currentChar;
      this.consume ();
    }
    if (buffer) {
      return new Token (TokenType.NUMBER, buffer);
    }
}

isNumber (char) {
    const re = /\d/g;
    return re.test (char);
}
```


至此，所有的我们就获得了所有的 token。

### 语法分析

词法分析可以解决用 value 当做注释的问题，比如 `{id:"活动 id"}` 这种写法，但是无法处理 `{id:"page || dsong"}` 这种。因为按照我们的逻词法处理 `"page || dsong"` 会返回 `page,|,|,dsong` 4 个 string token。
语法分析主要是对逻辑的验证。

我们先找到 [json 的语法定义](https://github.com/antlr/grammars-v4/blob/master/json/JSON.g4)。
```js
grammar JSON;

json
    : value
    ;


value
    : STRING
    | NUMBER
    | obj
    | 'true'
    | 'false'
    ;

obj 
    : "{" pair (,pair)* "}"
    ;

pair
    String: value

STRING
   : '"' (ESC | SAFECODEPOINT)* '"'
   ;

NUMBER
   : '-'? INT ('.' [0-9] +)? EXP?
   ;

```

由于我们需要支持 `a|b|c`, 所以修改一下对 string 的处理

```js
value
    : STRING

```

改为

```js
value
    : STRING (|STRING)*
```

得到上面的语法定义之后，就是考虑如何将其转为代码。
grammar json 这行只是定义，可以忽略。
```js
json
    : value
    ;


value
    : STRING
    | NUMBER
    | obj
    | 'true'
    | 'false'
    ;
NUMBER
   : '-'? INT ('.' [0-9] +)? EXP?
   ;
```
这里 json 可以推导出 value, value 又可以推导出 Number 和 'true'。Number 又可以推导出其它，而 'true' 这种是基本数据类型无法再推导其他了。

对于上面这种可以推导出其他的比如 json,value,Number 我们就叫做非终止符 nonterminal。

'true' 这种就叫做终止符 terminal。

对于 Number 和 String 右边，由于只是字符的范围限定，我们也当做 terminal 来处理。


因为，将上面的语法定义转为具体代码，规则如下：
1. 如果是 `nonterminal`，则对应转成函数
2. `terminal`。 匹配当前的 token 类型是 terminal 类型，然后指针移到下一个
3. 如果是`|`。则对应`if` 或者 `switch`
4. 如果是 `*` 或者 `+`。`while` 或者 `for` 循环
5. 如果是问号`？`。则转化为 `if`

所以左边的 `value,Number,json` 等都是函数，而右边的比如 `{`,`true` 都是先匹配当前 token 类型，然后获取下一个 token。

我们将 json 的语法转为如下。

先定义 Parser (Parser.js)，输入是一个词法分析 lexer。
```js

class Parser {
  constructor (lexer) {
    this.lexer = lexer;
    this.currentToken = lexer.getNextToken ();
  }

}
```

然后解析第一条规则，将 `json:value` 都转为函数。

(Paser.js)
```js

  /**
    json: value
  */
  paseJSON () {
    this.parseValue ();
  }
```

接下来解析 value 的语法，由于 `|` 是选择语句，我们将其转为 switch。根据当前 token 类型是对象还是 number,string, 走到不同的分支。

（Parser.js->parseValue）
```js
   /**
     * value
    : STRING (|STRING)*
    | NUMBER
    | obj
    | 'true'
    | 'false'
    ; */
  parseValue () {
    switch (this.currentToken.type) {
      case TokenType.OpenBrace:
        this.parseObject ();
        break;
      case TokenType.StringLiteral:
        this.parseString ();
        break;
      case TokenType.NUMBER:
        this.parseNumber ();
        break;
     case TokenType.TRUE:
        break;
     case TokenType.FLASE:
        break;
    }
  }

```
根据规则 2，terminal, 匹配当前的 token 类型，然后获取下一个 token. 所以当碰到 `true` 和 `value` 的时候，switch 语句改为如下。

```js
 case TokenType.TRUE:
      this.eat (TokenType.TRUE);
      break;
  case TokenType.FLASE:
      this.eat (TokenType.FALSE);
      break;
```
我们定义一个 `eat` 函数，匹配当前 token 再获取下一个，如果不符合直接抛出错误信息。
```js
/**match the current token and get the next */
  eat (tokenType) {
    if (this.currentToken.type == tokenType) {
      this.currentToken = this.lexer.getNextToken ();
    } else {
      throw new Error (
        `this.currentToken is ${JSON.stringify (
          this.currentToken
        )} doesn't match the input ${tokenType}`
      );
    }
  }
```
接下来处理 `parseObject`，它的语法是 `"{" pair (,pair)* "}`。

`{` 是 terminal，直接 `eat`. `pair` 变量，直接转为函数。

`(,pair)*`。根据规则 4，`*` 转为 `while` 语句。

`*` 是正则符号表示零或者更多的情况，所以当碰到这种情况的时候，我们先判断是否匹配逗号，然后执行 `parsePair` 函数。

代码如下

```js
    /**obj 
    : "{" pair (,pair)* "}"
    ; */
  parseObject () {
    this.eat (TokenType.OpenBrace);
    this.parsePair ()
    while (this.currentToken.type == TokenType.COMMA) {
      this.eat (TokenType.COMMA);
      this.parsePair ()
    }
    this.eat (TokenType.CloseBrace);
  }
```

解决了上面的语法转换之后，接下来的代码可以根据上面的处理转换。

```js

  /** String: value */
  parsePair () {
  
    this.eat (TokenType.StringLiteral);
    this.eat (TokenType.COLON);
    this.parseValue ();
  }

    //STRING (|STRING)*
  parseString () {
    this.eat (TokenType.StringLiteral);
    while (this.currentToken.type == TokenType.BitOr) {
      this.eat (TokenType.BitOr);
      this.eat (TokenType.StringLiteral);
    }
  }

  parseNumber () {
    this.eat (TokenType.NUMBER);
  }

```



  至此，我们的工作已经完成。
  
  对于开头提出的两个问题。

  第一个用 `value` 当做注释，而不用 `comment`。这个在词法解析阶段解决。判断字符串用的是 /w/ 的正则。 而这个正则在碰到中文会抛出错误提示。

  第二个用 `/` 做数组分割符，而不是 `|`。 这个在语法解析阶段解决。
  当解析 `value: STRING (|STRING)*` 这条规则的时候，如果碰到的字符串后面碰到的不是 | 分隔符，则会报错。

  上面的两个 test 已经覆盖，完整代码及 test case 请查看 [github](https://github.com/xff1874/BI-JSON-Parser)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，欢迎自由转载，转载请保留出处。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
