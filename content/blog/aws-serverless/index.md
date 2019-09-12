---
title: 快速上手亚马逊的 Serverless 服务
date: "2019-09-12T03:06:54.463Z"
description: "Serverless 是一种执行模型（execution model）。在这种模型中，云服务商负责通过动态地分配资源来执行一段代码。"
---


![](https://p1.music.126.net/kXHGCtyxu9hOvOWREE9wAA==/109951164358102755.jpg)

## 什么是 Serverless ?
### 定义
引用一段对于 Serverless 较为官方的定义：“Serverless 是一种执行模型（execution model）。在这种模型中，云服务商负责通过动态地分配资源来执行一段代码。云服务商仅仅收取执行这段代码所需要资源的费用。代码通常会被运行在一个无状态的容器内，并且可被多种事件触发（ http 请求、数据库事件、监控报警、文件上传、定时任务……）。代码常常会以函数（function）的形式被上传到云服务商以供执行，因此 Serverless 也会被称作 Functions as a Service 或者 FaaS。”

从定义中不难看出 Serverless 的出现免去了工程师在开发应用时对服务器与后端运维的考量，使工程师可以全心全意地投入业务逻辑代码的实现中去。再概括一下 Serverless 老生常谈的几条优势：

- 应用开发迅速
- 无须考虑运维
- 按用量收费

### 对于开发者的意义
- 对于前端开发者来说，Serverless 的出现无疑大大降低了编写后端应用的门槛，并且赋予前端开发者开发完整前后端应用的能力。
- 对于企业及独立开发者来说，Serverless 的出现大大缩短了业务从开发至上线的时间，甚至可能会改变企业的传统前后端合作模式与人员结构。

### 应用场景
> Serverless 对于前端开发者来说主要会有以下几个应用场景

- 开发后端接口：这是 Serverless 目前最为广泛应用的场景。通过搭配数据库等后端服务，可以实现低门槛、高效率的后端接口开发。
- 代替 NodeJS 服务器：Serverless 可以代替传统的 NodeJS 服务器，使我们可以更为便捷地实现原有的功能，例如后端数据适配前端、服务端渲染等。
- 搭建基于事件的服务：Serverless 基于事件触发的特性注定了它极为适合用于搭建基于事件的服务。例如我们可以通过监听特定的数据库事件来触发相关的业务逻辑。

## 什么是 AWS Lambda ?
AWS Lambda 是由亚马逊云服务平台（ AWS ）最早推出于 2014 年、最为著名的 Serverless 云计算平台之一。相较于其他云服务商，AWS Lambda 以完善的设施（触发器种类多、支持编程语言多……）和丰富的社区支持在多数评测中占据了上风。从体验与学习的目的出发，AWS Lambda 可以说是我们的不二选择。

## Serverless 与 AWS Lambda 现存的问题
### 冷启动
冷启动是最常被提到的问题之一，用简单的话来说就是当你的函数一段时间未被运行后，系统就会回收运行函数的容器资源。这样带来负面影响就是，当下一次调用这个函数时，就需要重新启动一个容器来运行你的函数，结果就是函数的调用会被**延迟**。来看一下在 AWS Lambda 上函数调用时间间隔与冷启动概率的关系：

  ![](https://p1.music.126.net/K15YeeoLZ_d_ltwNsO-1gg==/109951164204761853.png?imageView&thumbnail=900x0)

  那么具体的延迟时间是多少呢？延迟时间受许多因素的影响，比如编程语言、函数的内存配置、函数的文件大小等等。但是一个较为普遍的建议就是 Lambda 不适合用作对延迟极其敏感的服务（< 50ms）。

### 迁移
在使用 AWS Lambda 开发应用时，我们所写的代码与 AWS 这个云服务商是具有强关联性的。尽管目前有一些框架（例如下文会应用到的 Serverless 框架）来帮助我们抹平不同服务商之间的代码差异，想从一个服务商迁移至另一个服务商依然是一件繁重的体力劳动，甚至包含着一定的代码重构。

### 代码维护
函数式的开发模式注定了代码之间的复用与共享会成为一个难题，也注定了代码量会随着服务的增多而膨胀。 Serverless 会使得函数数量与代码量呈线性增长的关系，如下图

  ![](https://p1.music.126.net/n935ASd-39I7UypUypFmrg==/109951164204774049.png?imageView&thumbnail=900x0)

  当服务达到一定数量后，维护一个无限膨胀的代码库所需要的额外人力与开支也是不可小视的。

### 本地开发
运行 AWS Lambda 的函数依赖于许多外部的库和应用（aws-sdk、API Gateway、DynamoDB...），因此想要在一个完全本地的环境运行这样的函数是十分困难的。如果我们每次修改函数后都需要部署并依赖于 AWS CloudWatch 中输出的运行日志来调试与开发 Lambda 函数，那想必效率是极低的。 `Serverless CLI` 对于本地开发难的问题，提供了一定的插件来支持（[serverless-offline](https://github.com/dherault/serverless-offline)、[serverless-dynamodb-local](https://github.com/99xt/serverless-dynamodb-local)...）。不使用 `Serverless CLI` 开发 Lambda 的用户可能就需要研读官方提供的[ AWS-SAM 文档](https://github.com/awslabs/serverless-application-model)来配置本地开发环境了。

### 计价方式
AWS Lambda 收费的最小单位是 100ms ，也就是意味着你的函数哪怕只执行了 1ms 也会当作 100ms 来计费。这种计费方式在某些情况下甚至会导致使用高内存的函数比低内存的要便宜。我们来看下 AWS Lambda 的计费表:

  ![](https://p1.music.126.net/bS3HASNqi8CH115arHV2xA==/109951164204769553.png)
    
  举一个较为极端的例子：假设我们设置了一个内存为 448MB 的函数，它运行时间为 101ms ，那么每次执行我们都需要支付 0.000000729 x 2 = $0.000001458 。而如果我们将这个函数的内存提高到 512MB ，使它的运行时间降低 100ms 以内，那么每次执行我们只需要支付 $0.000000834 。仅仅是一个设置，我们就降低了整整 (1458 - 834) / 1458 ≈ **42.8%** 的成本！
    
  找到性价比最高的内存设置意味着额外的工作量，很难想象 AWS 在这个问题上居然没有为客户提供一个合理的解决方案。

### 捆绑消费
在使用 AWS Lambda 时几乎所有的周边服务（API Gateway、CloudWatch、DynamoDB...）都是需要额外收费的。其中一个很明显的特征就是**捆绑消费**，你可能很难想象 CloudWatch 是在使用 Lambda 时被强制使用的一个服务；而 API Gateway 也是在搭建 http 服务时几乎无法逃过的一个收费站，其 <b>$3.5/百万次请求</b> 的高额价格甚至**远远高于**使用 Lambda 的价格。

### 与传统云主机的费用权衡
AWS Lambda 对于低计算复杂度、低流量的应用是有着绝对的价格优势的。但是当部署在 Lambda 上的函数复杂度与流量逐渐上升的时候，使用 Lambda 的成本是有可能在某一时间点超过传统云主机的。就好比使用 Lambda 是租车，而使用传统云主机是买车。但从另一角度看，使用 Serverless 服务又可以节省一定的开发与运维成本。因此对于“Serverless 与传统云主机谁更节省成本”这个问题，不仅与具体开发的应用类型有关，也与应用的开发模式密不可分，该问题的真正答案很可能只有通过精密的成本计算与实践才能得出。

### 如何选择？

虽然 Lambda 有以上值得权衡的问题，但它所带来对于开发效率的提高是史无前例的，它所带来对于服务器及运维层面的成本削减也是肉眼可见的。全面并且客观地了解 Lambda 的长处与短处是决定是否使用它的必要步骤。目前许多的外国企业及开发者已渐渐开始拥抱与接纳 Serverless 的开发模式，尽管国内可能对于 Serverless 应用范围并不是很广，尽早地了解与熟悉 Serverless 相信对于国内开发者来说也是百利而无一害的。

## 在 AWS Lambda 上搭建服务
> 在了解了 Serverless 与 AWS Lambda 后，接下来我们就可以着手在 AWS Lambda 上开发应用了。

### 目标
接下来时间内，我们要在 Lambda 上部署一套在应用开发中较为常见的用户服务，主要有注册、登录、与接口访问权限校验的功能，包含以下四个接口
- `/api/user/signup` - 创建一个新用户并录入数据库
- `/api/user/login` - 登录并返回 JSON Web Token 来让用户访问私有接口
- `/api/public` - 公共接口，无须登录的用户也可访问
- `/api/private` - 私有接口，只有登录后的用户才能访问

### 预备知识
- [JavaScript 基础语法](https://www.w3schools.com/js/default.asp)
- [JSON Web Token](https://medium.com/vandium-software/5-easy-steps-to-understanding-json-web-tokens-jwt-1164c0adfcec)
- [Serverless 应用框架](https://github.com/serverless/serverless)

    ![Serverless](https://p1.music.126.net/IJx3l3uiqB77QmYK9DZs0w==/109951164204770541.png?imageView&thumbnail=300x0)

    这里的 Serverless 指的是一个在 GitHub 上超  过 3 万星的 CLI 工具。通过 Serverless CLI ，我们可以快速生成 Lambda 应用服务模版，标准化、工程化服务的开发以及一键部署服务至多套的环境与节点，极大地缩短了服务开发至上线的时间。

### 准备材料
- 通畅的全球互联网
- 一个可用的 AWS 账号
- 根据[ Serverless CLI 文档](https://github.com/serverless/serverless#quick-start)完成前两步
  - `npm install -g serverless`
  - [设置 AWS Credentials ](https://github.com/serverless/serverless/blob/master/docs/providers/aws/guide/credentials.md)


### 创建工程
> 我们选择的语言是 JavaScript ，数据库是 AWS 提供的 DynamoDb ，从 Serverless CLI 的示例库中很快可以找到这样的模版 [aws-node-rest-api-with-dynamodb](https://github.com/serverless/examples/tree/master/aws-node-rest-api-with-dynamodb)

复制模版至本地作为起步工程

```bash
serverless install -u https://github.com/serverless/examples/tree/master/aws-node-rest-api-with-dynamodb
```

这个工程包含了一个 Todo 列表的 CRUD 操作服务。核心文件有：
- `serverless.yml` 定义了该服务所提供的 `Lambda 函数` 、触发函数的 `触发器` 以及运行该函数所需要的其他 `AWS 资源` 。
- `package.json` 定义了该服务所依赖的其他库。
- `todos` 目录下包含了所有的函数文件。我们可以看到函数都是较为直白的，每一个文件都是类似以下的结构：

    ```js
    const AWS = require('aws-sdk'); // 引入 AWS SDK
    const dynamoDb = new AWS.DynamoDB.DocumentClient(); // 创建 dynamoDb 实例

    // 通过 module.exports 来导出该函数
    module.exports.create = (
      event, // event 对象包含了关于触发该函数事件的信息，每个触发事件 event 包含的信息都会有所不同，具体可参阅文档
      context, // context 对象包含了有关函数调用、执行环境等信息，具体可参阅文档
      callback // callback 是一个方法，通过调用 callback 可以在非异步函数中发送响应信息，关于如何定义异步函数与在异步函数内如何发送响应信息可参阅文档
    ) => {
      const data = JSON.parse(event.body); // 解析 event 来获得 http 请求参数
      /*
      业务逻辑
      */
      callback(); // 用提供的 callback 函数来发送响应信息
    }
    ```
  > 相关文档：[event 文档](https://docs.aws.amazon.com/zh_cn/lambda/latest/dg/lambda-services.html), [context 文档](https://docs.aws.amazon.com/zh_cn/lambda/latest/dg/nodejs-prog-model-context.html), [定义异步函数](https://docs.aws.amazon.com/zh_cn/lambda/latest/dg/nodejs-prog-model-handler.html)

当我们运行 `npm install ` 与 `serverless deploy` 将该起步工程部署到云端后，就可以通过 API 地址（例：[https://xxxxxx.execute-api.us-east-1.amazonaws.com/dev/todos](https://xxxxxx.execute-api.us-east-1.amazonaws.com/dev/todos)）来运行和访问这些函数。

### 创建与定义函数
根据这个工程原有的函数 ，创建类似的函数文件并非难事，我们在工程中创建以下 4 个文件：

- user/signup.js
- user/login.js
- user/public.js
- user/private.js

但仅仅创建函数文件是不够的，我们需要同时在 `serverless.yml` 中为这几个函数添加定义。以 `signup` 函数为例，在 `functions` 中添加以下内容：

```yml
signup:
  handler: user/signup.signup #定义了函数文件的路径
  events:
    - http: #定义了函数触发器种类为 http (AWS API Gateway)
        path: api/user/signup #定义了请求路径
        method: post #定义了请求 method 种类
        cors: true #开启跨域
```

这样我们就完整地定义了 4 个函数。接下来我们来看这四个函数具体的实现方法。

### Public 函数
> `GET`

> 返回一条无须登录即可访问的信息

#### 1. 返回消息
 `public` 函数是 4 个函数中最为简易的一个，因为该函数是完全公开的，我们不需要对该函数做任何校验。如下，简单地返回一条信息便可：

```js
// user/public.js
module.exports.public = (event, context, callback) => {
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: '任何人都可以阅读此条信息。'
    })
  }
  return callback(null, response);
};
```

> 注：`callback` 第一个参数传入的为错误，第二个参数传入的为响应数据。

#### 2. 部署及访问服务
- 执行以下命令来部署 `public` 函数

    ```bash
    # 部署单个函数
    serverless deploy function -f public
    ```

    或

    ```bash
    # 部署所有函数
    serverless deploy
    ```

- 在浏览器中直接输入 API 地址或用 cURL 工具执行以下命令来发送请求（替换成你的 API 地址， API 地址可在运行 `serverless deploy` 后的 `log` 中或在 `AWS API Gateway控制台` - `阶段（stage）` 中找到）

    ```
    curl -X GET https://xxxxxx.execute-api.us-west-2.amazonaws.com/dev/api/public
    ```

- 返回数据

    ```json
    {
      "message": "任何人都可以阅读此条信息。"
    }
    ```

### Sign up 函数
> `POST`

> 创建一个新用户并录入数据库，返回成功或失败信息

#### 1. 定义资源
 `signup` 函数的运行需要 `DynamoDB` 这一资源，所以第一步我们需要在 `serverless.yml` 文件中对 `resources` 进行如下修改来添加所需要的数据库资源

```yml
# serverless.yml
resources:
  Resources:
    UserDynamoDbTable:
      Type: 'AWS::DynamoDB::Table' #资源种类为 DynamoDB 表
      DeletionPolicy: Retain #当删除 CloudFormation Stack（serverless remove）时保留该表
      Properties:
        AttributeDefinitions: #定义表的属性
          -
            AttributeName: username #属性名
            AttributeType: S #属性类型为字符串
        KeySchema: #描述表的主键
          -
            AttributeName: username #键对应的属性名
            KeyType: HASH #键类型为哈希
        ProvisionedThroughput: #表的预置吞吐量
          ReadCapacityUnits: 1 #读取量为 1 单元
          WriteCapacityUnits: 1 #写入量为 1 单元
        TableName: ${self:provider.environment.DYNAMODB_TABLE} # 定义表名为环境变量中的 DYNAMODB_TABLE
```

> `resources` 一栏中填写的内容是使用 `yaml` 语法写的 [AWS CloudFormation 的模版](https://aws.amazon.com/cn/cloudformation/aws-cloudformation-templates/) 。

> DynamoDB 表在 CloudFormation 中更为详细定义文档请参考 [链接](https://docs.aws.amazon.com/zh_cn/AWSCloudFormation/latest/UserGuide/aws-resource-dynamodb-table.html) 。

#### 2. 获取请求数据
 `signup` 是一个方法为 `POST` 的接口，因此需要从 http 事件的 `body` 中获取请求数据。

```js
// user/signup.js
module.exports.signup = (event, context, callback) => {
  // 获取请求数据并解析 JSON 字符串
  const data = JSON.parse(event.body);
  const { username, password } = data;
  /*
    ...
    校验 username 与 password
  */
}
```

#### 3. 录入用户至 DynamoDB
获取完了请求数据后，我们需要构造出新用户的数据，并把数据录入 DynamoDB

```js
// user/signup.js
// 引入 NodeJS 加密库
const crypto = require('crypto');
// 创建 dynamoDB 实例
const AWS = require('aws-sdk'); 
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.signup = (event, context, callback) => {
  // ...获取并校验 username 与 password
  
  // 生成 salt 来确保哈希后密码的唯一性
  const salt = crypto.randomBytes(16).toString('hex');
  // 用 sha512 哈希函数加密，生成仅可单向验证的哈希密码
  const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 512, 'sha512').toString('hex');
  const timestamp = new Date().getTime(); // 生成当前时间戳
  // 生成新用户的数据
  const params = {
    TableName: process.env.DYNAMODB_TABLE, // 从环境变量中获取 DynamoDB 表名
    Item: {
      username, // 用户名
      salt, // 保存 salt 用于登录时单向校验密码
      password: hashedPassword, // 哈希密码
      createdAt: timestamp, // 生成时间
      updatedAt: timestamp // 更新时间
    }
  }
  // 将新用户数据录入至 dynamoDb
  dynamoDb.put(params, (error) => {
    // 返回失败信息
    if (error) {
      // log 错误信息，可在 AWS CloudWatch 服务中查看
      console.error(error);
      callback(null, {
        statusCode: 500,
        body: JSON.stringify({
          message: '创建用户失败！'
        })
      });
    } else {
      // 返回成功信息
      callback(null, {
        statusCode: 200,
        body: JSON.stringify({
          message: '创建用户成功！'
        })
      });
    }
}
```

> DynamoDB 在 NodeJS 中更详细的 CRUD 操作文档请参考[链接](https://docs.aws.amazon.com/zh_cn/amazondynamodb/latest/developerguide/GettingStarted.NodeJs.03.html)

#### 4. 部署及访问服务
- 执行以下命令来部署 `signup` 函数

    ```bash
    # 部署单个函数
    serverless deploy function -f signup
    ```

    或

    ```bash
    # 部署所有函数
    serverless deploy
    ```

- 用 `cURL` 工具执行以下命令来发送请求（替换成你的API地址，API地址可在运行 `serverless deploy` 后的 log 中或在 `AWS API Gateway控制台` - `阶段（stage）` 中找到）

    ```
    curl -X POST https://xxxxxx.execute-api.us-west-2.amazonaws.com/dev/api/user/signup --data '{ "username": "new_user", "password": "12345678" }'
    ```

- 返回数据

    ```json
    {
      "message": "创建用户成功！"
    }
    ```


### Login 函数
> `GET`

> 校验用户名密码并返回 JSON Web Token 来让登录用户访问私有接口

#### 1. 设置 JSON Web Token
在用户调用了 Login 接口并通过验证后，我们需要为用户返回一个 `JSON Web Token` ，以供用户来调用需要权限的服务。设置 JSON Web Token 需要以下几步操作：

- `npm install jsonwebtoken --save` 安装 `jsonwebtoken` 库并添加至项目依赖
- 在项目中添加一个 `secret.json` 文件来存放密钥，这里我们采用对称加密的方式来定义一个私有密钥。

    ```js
    // secret.json
    {
      "secret": "私有密钥"
    }
    ```

- 将私有密钥定义至环境变量，以供函数访问。在 `serverless.yml` 的 `provider` 下作如下变更

    ```yml
    # serverless.yml
    provider:
      environment:
        # 使用serverless变量语法将文件中的密钥赋值给环境变量PRIVATE_KEY
        PRIVATE_KEY: ${file(./secret.json):secret}
    ```

#### 2. 获取请求数据
 `login` 是一个方法为 `GET` 的接口，因此需要从触发事件的 `queryStringParameters` 中获取请求数据。

```js
// user/login.js
module.exports.login = (event, context, callback) => {
  // 获取请求数据
  const { username, password } = event.queryStringParameters;
  /*
    ...
    校验 username 与 password
  */
}
```


#### 3. 验证账号密码并返回 JSON Web Token

```js
// user/login.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.login = (event, context, callback) => {
  // ...获取并校验 username 与 password
  
  // 验证账号密码并返回 JSON Web Token
  
  // 构造 DynamoDB 请求数据，根据主键 username 获取数据
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: {
      username
    }
  };
  // 从 DynamoDB 中获取数据
  dynamoDb.get(params, (error, data) => {
    if (error) {
      // log 错误信息，可在 AWS CloudWatch 服务中查看
      console.error(error);
      // 返回错误信息
      callback(null, {
        statusCode: 500,
        body: JSON.stringify({
          message: '登录失败！'
        })
      });
      return;
    }
    
    // 从回调参数中获取 DynamoDB 返回的用户数据
    const user = data.Item;
    if (
      // 确认 username 存在
      user &&
      // 确认哈希密码匹配
      user.password === crypto.pbkdf2Sync(password, user.salt, 10000, 512, 'sha512').toString('hex')
    ) {
      // 返回登录成功信息
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          username, // 返回 username
          // 返回 JSON Web Token
          token: jwt.sign(
            {
              username // 嵌入 username 数据
            },
            process.env.PRIVATE_KEY // 使用环境变量中的私有密钥签发 token
          )
        })
      };
      callback(null, response);
    } else {
      // 当用户不存在，以及用户密码校验错误时返回错误信息
      callback(null, {
        statusCode: 401,
        body: JSON.stringify({
          message: '用户名或密码错误！'
        })
      });
    }
  });
};
```

#### 4. 部署及访问服务
- 执行以下命令来部署 `login` 函数

    ```bash
    # 部署单个函数
    serverless deploy function -f login
    ```

    或

    ```bash
    # 部署所有函数
    serverless deploy
    ```

- 在浏览器中直接输入 API 地址或用 cURL 工具执行以下命令来发送请求（替换成你的 API 地址， API 地址可在运行 `serverless deploy` 后的log中或在 `AWS API Gateway控制台` - `阶段（stage）` 中找到）
    ```
    curl -X GET 'https://xxxxxx.execute-api.us-west-2.amazonaws.com/dev/api/user/login?username=new_user&password=12345678'
    ```

- 返回数据

    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Im5ld191c2VyIiwiaWF0IjoxNTYxODI1NTgyfQ.Iv0ulooGayulxf_MkkpBO1xEw1gilThT62ysuz-rQE0",
      "username": "new_user"
    }
    ```


### Auth 函数
> 校验请求中所包含的 JSON Web Token 是否有效

在编写 `private` 函数之前，我们需要提供另一个函数 `auth` 来校验用户提交请求中的 JSON Web Token 是否与我们所签发的一致。
#### 1. 创建函数
- 在项目中添加 `user/auth.js` 文件
- 在 `serverless.yml` 的 `functions` 中添加以下内容：

    ```yml
    auth:
    handler: user/auth.auth
    # auth 是一个仅会在服务内被调用的函数，因此没有任何触发器
    ```

#### 2. 生成包含 IAM 权限策略的响应信息
为了能够让 `AWS API Gateway` 触发器正确地识别函数有无权限执行，我们必须在 `auth` 函数中返回一个含 IAM （ AWS 服务与权限管控系统） 权限策略信息的响应数据，来使得有权限的函数可以通过 `AWS API Gateway` 成功触发。在 `user/auth.js` 内定义一个如下的方法：

```js
// user/auth.js
const generatePolicy = (principalId, effect, resource) => {
  const authResponse = {};
  authResponse.principalId = principalId; // 用于标记用户身份信息
  if (effect && resource) {
    const policyDocument = {};
    policyDocument.Version = '2012-10-17'; // 定义版本信息
    policyDocument.Statement = [];
    const statementOne = {};
    statementOne.Action = 'execute-api:Invoke'; // 定义操作类型，这里为 API 调用操作
    statementOne.Effect = effect; // 可用值为 ALLOW 或 DENY ，用于指定该策略所产生的结果是允许还是拒绝
    statementOne.Resource = resource; // 传入 ARN（ AWS 资源名）来指定操作所需要的资源
    policyDocument.Statement[0] = statementOne;
    authResponse.policyDocument = policyDocument; // 将定义完成的策略加入响应数据
  }
  return authResponse;
};
```

> 关于 IAM 策略更为详细的配置文档请查看[链接](https://docs.aws.amazon.com/zh_cn/IAM/latest/UserGuide/reference_policies_elements.html)

#### 3. 解析并校验 JSON Web Token
我们在解析 JSON Web Token 时默认请求遵循 OAuth2.0 中的 Bearer Token 格式。

```js
// user/auth.js
const jwt = require('jsonwebtoken');

/* 
  ...定义 generatePolicy 方法
*/

module.exports.auth = (event, context, callback) => {
  // 获取请求头中的 Authorization
  const { authorizationToken } = event;
  if (authorizationToken) {
    // 解析 Authorization
    const split = event.authorizationToken.split(' ');
    if (split[0] === 'Bearer' && split.length === 2) {
      try {
        const token = split[1];
        // 使用私有密钥校验 JSON Web Token
        const decoded = jwt.verify(token, process.env.PRIVATE_KEY);
        // 使用 generatePolicy 生成包含允许API调用的IAM权限策略的响应数据
        const response = generatePolicy(decoded.username, 'Allow', event.methodArn);
        return callback(null, response);
      } catch (error) {
        // JSON Web Token 校验失败，返回错误
        return callback('Unauthorized');
      }
    } else {
      // Authorization 格式校验失败，返回错误
      return callback('Unauthorized');
    }
  } else {
    // 请求头未含 Authorzation，返回错误
    return callback('Unauthorized');
  }
};
```


### Private 函数
> `GET`

> 返回一条需要登录才可访问的信息

 `private` 函数的实现与之前的 `public` 函数十分类似，唯一的区别就是我们需要在函数的 `http (AWS API Gateway)` 触发器中加入刚刚定义的 `auth` 作为权限校验函数。

#### 1. 设置 authorizer
在 `serverless.yml` 中对先前定义的 `private` 函数作如下变更：

```yml
# serverless.yml
functions: 
  private:
    handler: user/private.private
    events:
      - http:
        path: api/private
        method: get
        authorizer: auth #设置 authorizer 为刚刚定义的 auth 函数
        cors: true
```

#### 2. 返回消息

```js
// user/private.js
module.exports.private = (event, context, callback) => {
  // 从触发事件中获取请求的用户信息
  const username = event.requestContext.authorizer.principalId;
  // 返回消息
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: `你好，${username}！只有登录后的用户才可以阅读此条信息。`
    })
  }
  return callback(null, response);
};
```

#### 3. 部署及访问服务
- 执行以下命令来部署 `private` 函数

    ```bash
    # 部署单个函数
    serverless deploy function -f private
    ```

    或

    ```bash
    # 部署所有函数
    serverless deploy
    ```

- 用 cURL 工具执行以下命令来发送请求（替换成你的 API 地址， API 地址可在运行 `serverless deploy` 后的 log 中或在 `AWS API Gateway控制台` - `阶段（stage）` 中找到）

    ```
    curl -X GET -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Im5ld191c2VyIiwiaWF0IjoxNTYxODI1NTgyfQ.Iv0ulooGayulxf_MkkpBO1xEw1gilThT62ysuz-rQE0" https://xxxxxx.execute-api.us-west-2.amazonaws.com/dev/api/private
    ```

- 返回数据

    ```json
    {
      "message": "你好，new_user！只有登录后的用户才可以阅读此条信息。"
    }
    ```

### 实践小结

#### 用了什么？
- Serverless CLI
- AWS Lambda
- AWS API Gateway
- AWS CloudWatch
- DynamoDB
- OAuth2.0

#### 做了什么？

- 使用 Serverless 开发与部署了一套 HTTP 接口服务
- 服务提供了用户的注册、登录接口
- 服务提供了完全开放接口与仅登录用户可访问接口

#### 完整工程
如果在教程中有疑点，可以在 [Github](https://github.com/yuanfux/aws-lambda-user) 上查看完整的代码。


### 引用
- [Cold Starts in AWS Lambda](https://mikhail.io/serverless/coldstarts/aws/)
- [The hidden costs of serverless](https://medium.com/@amiram_26122/the-hidden-costs-of-serverless-6ced7844780b)

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，欢迎自由转载，转载请保留出处。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
