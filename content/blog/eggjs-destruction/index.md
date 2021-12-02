---
title: Eggjs 入门解构
date: 2021-12-02T03:46:24.217Z
description: Eggjs虽然提供了入门教程，但是有大量的约定俗成，对于理解上有一定的成本和门槛。本文以快速入门的例子通过不同的角度进行解读，阐述相关编程思想，希望能帮助大家能更好的掌握这一框架
---

![Eggjs_logo](https://zos.alipayobjects.com/rmsportal/JFKAMfmPehWfhBPdCjrw.svg)

阅读本文前，请先浏览[Eggjs 官方例子](https://eggjs.org/zh-cn/intro/quickstart.html)和 了解[Koajs](https://koajs.com/)

> 本文作者：[东东章](https://www.zhihu.com/people/huo-hai-jin-xing-shi)

## 开始

![例子](https://cloud.githubusercontent.com/assets/227713/22960991/812999bc-f37d-11e6-8bd5-a96ca37d0ff2.png)

官方给了这样一个例子，手动搭建 Hacker News。

当我们看到这个页面的时候，不要着急往下看教程。 先自我思考下如何实现这个页面，要用到哪些技术：

1.  路由处理。我们需要一个角色处理接受 `/news` 请求，除此之外，一般还有 `/` 默认首页，也就是说至少 2 个 URL。
2.  页面展示。这里可以用模板，也可以直接自己拼接 HTML 元素。nodejs 模板有[Pug](https://pugjs.org/api/getting-started.html)，[EJS](https://ejs.co/)，[Handlebarsjs](https://handlebarsjs.com/)等多个模板。
3.  取数问题。有一个角色处理请求并拿到返回的数据。
4.  合并数据。将模板和取到的数据结合起来，显示最终的结果。

## MVC

在服务端有个很经典的 MVC 设计模式来解决这类问题。

![mvc](https://developer.mozilla.org/en-US/docs/Glossary/MVC/model-view-controller-light-blue.png)

1.  Modal: 管理数据和业务逻辑。通常细分为 service (业务逻辑) 和 dao (数据库管理) 两层。
2.  View： 布局和页面展示。
3.  Controller：将相关请求路由到对应的 Modal 和 View。

下面以`Java Spring MVC`为例

```java
@Controller
public class GreetingController {

	@GetMapping("/greeting")
	public String greeting(@RequestParam(name="ownerId", required=false, defaultValue="World") String ownerId, Model model) {
    String name = ownerService.findOwner(ownerId);
		model.addAttribute("name", name);
		return "greeting";
	}

}
```

模板`greeting.html`

```html

<body>
    <p th:text="'Hello, ' + ${name} + '!'" />
</body>
```

1. 首先用注解 `@Controller` 定义了一个 `GreetingController` 类。
2. `@GetMapping("/greeting")` 接受了 `/greeting`，并交给 `public String greeting` 处理，这块属于 Controller 层。
3.  `String name = ownerService.findOwner(ownerId);model.addAttribute("name", name); ` 获取数据，属于 Modal 层。
4.  `return "greeting";` 返回对应模板 (View 层)，然后与取得数据结合形成最终结果。

有了上面的经验之后，接下来 我们将目光转向 Eggjs。我们可以根据上面的 MVC 架构，完成给出的例子。

因为实际上是有两个页面，一个是`/news`, 另外一个是`/`, 我们首先从首页`/`的开始。

先定义一个 Controller.

```js
// app/controller/home.js

const Controller = require('egg').Controller;

class HomeController extends Controller {
  async index() {
    this.ctx.body = 'Hello world';
  }
}
module.exports = HomeController;
```

用 CJS 的标准先引入框架的 Controller，定义一个了`HomeController`类，并有方法`index`。

类已经定义好，接下来就是实例化阶段。

如果熟悉 Koajs 的开发，一般会用 new 关键字

```js
const Koa = require('koa');
const app = new Koa();
```

如果熟悉 Java 开发，一般会用注解来实例化，比如下面的 person 用了`@Autowired` 这个注解来实现自动实例化 。

```java
public class Customer {
    @Autowired                               
    private Person person;                   
    private int type;
}
```

从上面的例子看，发现注解不但能处理请求，同时也能实例对象，非常方便。

ES7 里面有个也有类似的概念装饰器 [Decorators](https://github.com/tc39/proposal-decorators)，然后配合 [reflect-metadata](https://jkchao.github.io/typescript-book-chinese/tips/metadata.html)实现类似效果，这也是当前 Node 框架的标配做法。

然而，因为种种原因，Eggjs 即没有让你自己直接 new 一个实例，也没有用装饰器方法，而是自己实现了一套实例初始化规则：

> 它会读取当前的文件，然后根据文件名初始化一个实例，最后绑定到内置基础对象上。

比如上面的`app/controller/home.js`, 会产生一个 home 实例。因为是 Controller 角色，所以会绑定到 contoller 这个内置对象上。同时 contoller 对象也是内置 app 对象的一部分，更多的内置对象可以看[这里](https://eggjs.org/zh-cn/basics/objects.html)。

总的来说，基本上所有的实例化对象都被绑定到 app 和 ctx 两个内置对象上了，访问规则为`this.(app|ctx).类型(controller|service...).自己定义的文件名.方法名`。

请求方面，Eggjs 用一个 router 对象来处理

```js
// app/router.js
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
};
```

上面的代码指 router 将 / 请求交由 home 实例的 index 方法处理。

文件目录规则也是按照约定放置

```js
egg-example
├── app
│   ├── controller
│   │   └── home.js
│   └── router.js
├── config
│   └── config.default.js
└── package.json
```

app 目录放置了所有与其相关的子元素目录。

至此，我们完成了首页的工作，接下来考虑 /news 列表页。

### 列表页

同理，我们先定义 MVC 里面的 C，然后处理剩下两个角色。

有了上面的经验，我们先创建一个 NewsController 类的 list 方法，然后在 router.js 添加对 /news 的处理，指定到对应的方法，如下。

```js
// app/controller/news.js
const Controller = require('egg').Controller;

class NewsController extends Controller {
  async list() {
    const dataList = {
      list: [
        { id: 1, title: 'this is news 1', url: '/news/1' },
        { id: 2, title: 'this is news 2', url: '/news/2' }
      ]
    };
    await this.ctx.render('news/list.tpl', dataList);
  }
}

module.exports = NewsController;
```

数据 dataList 先写死，后续用 service 替换。
`this.ctx.render('news/list.tpl', dataList)`这里是模板与数据的结合。

`news/list.tpl`属于 view，根据上面我们所知的命名规范，完整目录路径应该是`app/view/news/list.tpl`

```js

// app/router.js 添加了/news请求路径，指定news对象的list对象处理
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  router.get('/news', controller.news.list);
};

```

### 模板渲染。

根据 MVC 模型，现在我们已经有了 C，剩下就是 M 和 V，M 数据已经写死，先处理 View。

之前说过，nodejs 模板有[Pug](https://pugjs.org/api/getting-started.html),[Ejs](https://ejs.co/)，[handlebarsjs](https://handlebarsjs.com/),[Nunjucks](https://mozilla.github.io/nunjucks/)等多种。

有时候在项目中要根据情况来从多个模板选择具体某个，因此需要框架做到：

1.  声明多个模板类型。

2.  配置具体使用某个模板。

为了更好的管理，声明和使用要分开，配置一般放在 config 目录下，所以有了`config/plugin.js`和`config/config.default.js`。前者做定义，后者具体配置。

```js
// config/plugin.js 声明了2个view模板
exports.nunjucks = {
  enable: true,
  package: 'egg-view-nunjucks'
};

exports.ejs = {
  enable: true,
  package: 'egg-view-ejs',
};
```

```js

// config/config.default.js 具体配置使用某个模板。
exports.view = {
  defaultViewEngine: 'nunjucks',
  mapping: {
    '.tpl': 'nunjucks',
  },
};
```

然后写一个`nunjucks`的具体模板的具体内容如下

```js
// app/view/news/list.tpl
<html>
  <head>
    <title>Hacker News</title>
    <link rel="stylesheet" href="/public/css/news.css" />
  </head>
  <body>
    <ul class="news-view view">
      {% for item in list %}
        <li class="item">
          <a href="{{ item.url }}">{{ item.title }}</a>
        </li>
      {% endfor %}
    </ul>
  </body>
</html>
```

下面处理 service，取名为 news.js 文件路径参照上面，放在 app 目录的子目录 service 下面。

```js
// app/service/news.js 
const Service = require('egg').Service;

class NewsService extends Service {
  async list(page = 1) {
    // read config
    const { serverUrl, pageSize } = this.config.news;

    // use build-in http client to GET hacker-news api
    const { data: idList } = await this.ctx.curl(`${serverUrl}/topstories.json`, {
      data: {
        orderBy: '"$key"',
        startAt: `"${pageSize * (page - 1)}"`,
        endAt: `"${pageSize * page - 1}"`,
      },
      dataType: 'json',
    });

    // parallel GET detail
    const newsList = await Promise.all(
      Object.keys(idList).map(key => {
        const url = `${serverUrl}/item/${idList[key]}.json`;
        return this.ctx.curl(url, { dataType: 'json' });
      })
    );
    return newsList.map(res => res.data);
  }
}

module.exports = NewsService;
```

`const { serverUrl, pageSize } = this.config.news;` 这行有 2 个分页参数，具体应该配置在哪里？

根据我们上面的经验，`config.default.js`配置了具体模板使用参数，因此这里就是一个比较合适的地方。

```js
// config/config.default.js
// 添加 news 的配置项
exports.news = {
  pageSize: 5,
  serverUrl: 'https://hacker-news.firebaseio.com/v0',
};
```

service 有了，现在是把固定写死的数据改为动态取数的模式，修改对应的如下

```js

// app/controller/news.js
const Controller = require('egg').Controller;

class NewsController extends Controller {
  async list() {
    const ctx = this.ctx;
    const page = ctx.query.page || 1;
    const newsList = await ctx.service.news.list(page);
    await ctx.render('news/list.tpl', { list: newsList });
  }
}

module.exports = NewsController;

```

这行`ctx.service.news.list(page)`, 可以发现 service 不是像 controller 一样绑定在 app 上，而是 ctx 上，这是有意为之，具体看[讨论](https://github.com/eggjs/egg/issues/2453)

至此，基本上完成了我们的整个页面。

### 目录结构

当我们完成上面的工作之后，看一下完整的目录规范

```js
egg-project
├── package.json
├── app.js (可选)
├── agent.js (可选)
├── app
|   ├── router.js
│   ├── controller
│   |   └── home.js
│   ├── service (可选)
│   |   └── user.js
│   ├── middleware (可选)
│   |   └── response_time.js
│   ├── schedule (可选)
│   |   └── my_task.js
│   ├── public (可选)
│   |   └── reset.css
│   ├── view (可选)
│   |   └── home.tpl
│   └── extend (可选)
│       ├── helper.js (可选)
│       ├── request.js (可选)
│       ├── response.js (可选)
│       ├── context.js (可选)
│       ├── application.js (可选)
│       └── agent.js (可选)
├── config
|   ├── plugin.js
|   ├── config.default.js
│   ├── config.prod.js
|   ├── config.test.js (可选)
|   ├── config.local.js (可选)
|   └── config.unittest.js (可选)
└── test
    ├── middleware
    |   └── response_time.test.js
    └── controller
        └── home.test.js
```

第一次看到这个的时候，会有一些困扰，为什么有了 app 目录，还有 agent.js 和 app.js， schedule 目录又是什么， config 目录下面一大堆东西是什么。

先说 config 目录，
plugin.js 之前说过是定义插件的。

下面一堆 config.xxx.js 到底是个什么东东？

我们先看下普通 webpack 的配置，一般有三个文件。

```js
scripts
├── webpack.common.js
├── webpack.dev.js
└── webpack.prod.js
```

在 webpack.dev.js 和 webpack.prod.js 里面，我们通过 webpack-merge **手动**合并 webpack.common.js 。

而在 Eggjs 里面会**自动**合并 config.default.js, 这在开始的时候确实让人困扰，比如当你环境是 prod 时候，config.prod.js 会自动合并 config.default.js。

环境通过`EGG_SERVER_ENV=prod npm start`指定，更多说明参见[配置](https://eggjs.org/zh-cn/basics/config.html)

app 目录下面 router.js, controller,service,view 等目录已经清楚，middleware 目录放置的是 Koajs 的中间件，extend 目录是对[原生对象](https://eggjs.org/zh-cn/basics/extend.html)的扩展，我们一些常用的方法一般会放在 util.js 文件中，这里对应的是 helper.js。

接下来说下 app.js , agent.js 和 app/schedule ，这三者的关系。

当我们在本地开发阶，一般只会起一个实例，通常用`node app.js` 启动。
但是我们在部署的时候，一般会有多个，通常用 pm2 来管理，如`pm2 start app.js`。一个实例对应一个进程。

而 Eggjs 自己实现了一套多进程管理方式，分别有 Master、Agent、Worker 三个角色。

Master: 数量 1，性能稳定，不做具体工作，负责其他两者的管理工作，类似 pm2 。

Agent: 数量 1, 性能稳定，一些后端工作，比如长连接监听后端配置，然后做一些通知。

Worker: 性能不稳定，数量多个 (默认核数)，业务代码跑这个上面。

那上面 app.js (包括 app 目录) 等就是跑在 worker 进程下，会有多个。
agent.js 跑在 Agent 进程下。

以本人电脑`MacBook Pro (13-inch, M1, 2020)`为例，这电脑有 8 核，所以基本上会有 8 个 worker 进程，一个 agent 和一个 master 进程。

下图可以看得更清晰，可以看到起了 8 个`app_worker.js`, 一个`agent_work.js`, 还有一个 master 进程
![egg_progress](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/11313742054/8626/0016/9f76/ade08e2bf57fb423f5af7e0925b6eccc.png)

那 schedule 又是什么呢？这里是 worker 进程执行定时任务。

```js
// app/schedule/force_refresh.js
exports.schedule = {
  interval: '10m',
  type: 'all', // 所有worker进程，8个都会执行
};
exports.schedule = {
  interval: '10s',
  type: 'worker', // 每台机器上只有一个 worker 会执行定时任务，每次执行定时任务的 worker 随机。
};
```

schedule 和 agent.js 根据自己需要来判断 具体使用哪种。

上面是`Eggjs`多进程的简单分析，具体可以看[这里](https://eggjs.org/zh-cn/core/cluster-and-ipc.html)

### 插件

如果现在让你设计一个插件系统，要求插件之间有依赖关系，要有环境判断，要有开关控制插件启动，该如何设计？

我们首先想到的是依赖处理，这块前端已经非常成熟，可以借助 npm，来进行依赖管理。

另外像环境判断等一些参数，可以参考第三方库例如 browserslist，在 package.json 添加一个字段配置，也可以专门新建一个.xxxxrc 配置。

```js
//package.json 写法
{
  "private": true,
  "dependencies": {
    "autoprefixer": "^6.5.4"
  },
  "browserslist": [
    "last 1 version",
    "> 1%",
    "IE 10"
  ]
}
```

```js
//.browserslistrc

# Browsers that we support
last 1 version
> 1%
IE 10 # sorry
```

由此，我们可以定义自己的配置如下

```js
//package.json
{
	myplugin:{
		env:"dev",
		others:"xxx"
	}
}
```

Eggjs 的插件也是这样设计的

```js
{
  "eggPlugin": {
    "env": [ "local", "test", "unittest", "prod" ]
  }
}
```

但是 Eggjs 对于依赖管理，名字都自己做了处理，导致看上去比较冗余。

```js
//package.json
{
  "eggPlugin": {
    "name": "rpc",
    "dependencies": [ "registry" ],
    "optionalDependencies": [ "vip" ],
    "env": [ "local", "test", "unittest", "prod" ]
  }
}
```

所有的一些都写在 eggPlugin 的配置里面，包括插件名字，依赖等，而不是利用 package.json 已有的字段和能力。这也是开始的时候比较困惑的地方。

官方给出的解释是:

> [首先 Egg 插件不仅仅支持 npm 包，还支持通过目录来找插件](https://eggjs.org/zh-cn/advanced/plugin.html)

现在可以通过 yarn 的 workspace 和 lerna 这种 monorepo 的方式，更好的管理插件。

看一下插件的目录和内容，其实是简化版应用。

```js
. egg-hello
├── package.json
├── app.js (可选)
├── agent.js (可选)
├── app
│   ├── extend (可选)
│   |   ├── helper.js (可选)
│   |   ├── request.js (可选)
│   |   ├── response.js (可选)
│   |   ├── context.js (可选)
│   |   ├── application.js (可选)
│   |   └── agent.js (可选)
│   ├── service (可选)
│   └── middleware (可选)
│       └── mw.js
├── config
|   ├── config.default.js
│   ├── config.prod.js
|   ├── config.test.js (可选)
|   ├── config.local.js (可选)
|   └── config.unittest.js (可选)
└── test
    └── middleware
        └── mw.test.js
```

1.  去掉了 router 和 controller。这部分之前说过主要处理请求，进行转发，而插件的定义是增强的中间件，所以没必要。
2.  去掉了 plugin.js。 这个文件的主要作用就是引入或开启其他插件。框架已经做了这部分工作，这里就没必要。

由于插件是一个小型应用，因为会存在插件中和框架重复的情况，因此 Eggjs 的加载顺序是 **插件 < 框架 < 应用**。

比如 插件有个 config.default.js，框架也有 config.default.js，应用也有 config.default.js。

最后会合并成一个 config.default.js, 执行顺序为

```js
let finalConfig= Objeact.assign(插件的config,框架的config，应用的config)

```

## 总结

Eggjs 的出现和框架设计带有自身的特点和时代的因素，
本文作为入门的一个解读，希望能帮助大家能够更好的掌握这个框架。


> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！

