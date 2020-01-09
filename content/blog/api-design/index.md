---
title: 开发高质量服务端 API
date: "2019-12-17T01:32:02.919Z"
description: "如果使用了 Node.js 作为服务端开发语言，我们肯定要开发 API 接口。本文用一个示例需求，来讲述一下如何高效开发高质量的服务端 API 接口。"
---


![](https://p1.music.126.net/ce0OOfguxbE6y7JO14mNqA==/109951164541039249.jpg)

> 本文作者：网易云音乐前端工程师 [包勇明](https://github.com/huntbao)

## 前言
不管 Node.js 在实际产品中的使用情况如何，相信现在使用 Node.js 作为服务端来开发的项目是数以百万计的，其中绝大多数的开发人员都是前端工程师，因为 Node.js 是他们的天然语言工具。将来，越来越多的前端工程师会加入到 Node.js 的开发中来。

既然使用了 Node.js 作为服务端开发语言，我们肯定要开发 API 接口。本文用一个示例需求，来讲述一下如何高效开发高质量的服务端 API 接口。

## 需求
首先来看下需求，一共有 3 张数据库表（数据库是 MySQL），分别为：

```sql
CREATE TABLE `user` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '唯一标识',
    `name`          VARCHAR(50) NULL DEFAULT '' COMMENT '帐号',
    `email`         VARCHAR(50) NULL DEFAULT '' COMMENT '邮箱',
    `nickname`      VARCHAR(50) NOT NULL DEFAULT '' COMMENT '真实姓名',
    `createTime`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '帐号创建时间',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `uk_email` (`email` ASC)
)
ENGINE=InnoDB AUTO_INCREMENT=1 COMMENT='用户表';

CREATE TABLE `project` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '唯一标识',
    `name`          VARCHAR(100) NULL DEFAULT NULL COMMENT '名称',
    `description`   VARCHAR(500) NULL DEFAULT '' COMMENT '描述',
    `creatorId`     INT UNSIGNED NOT NULL COMMENT '创建者标识',
    `createTime`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    `deletedAt`     DATETIME(3) COMMENT '删除时间',
    PRIMARY KEY (`id`)
)
ENGINE=InnoDB AUTO_INCREMENT=1 COMMENT='项目表';

CREATE TABLE `project_user` (
    `role`        TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '用户角色0－成员;9－管理员;10－创建者',
    `userId`      INT UNSIGNED NOT NULL COMMENT '用户标识',
    `projectId`   INT UNSIGNED NOT NULL COMMENT '项目标识',
    `createTime`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    PRIMARY KEY (`userId`, `projectId`),
    INDEX `idx_projectId` (`projectId` ASC)
)
ENGINE=InnoDB COMMENT='项目-用户关系表';
```

含义如下：

* 用户表 `user`，主键是 `id`，自增，唯一索引是 `email`。
* 项目表 `project`，主键是 `id`，自增。用户可以创建项目，`creatorId` 字段是创建者的标识。
* 项目和用户的关系表，它表示项目和用户的映射关系，联合主键是 `userId` 和 `projectId`。一个项目可以有多个用户，用户有不同的角色，用 `role` 字段来表示，不同的角色有不同的权限，如下：
    - 只有项目的成员、管理员、创建者对该项目可见。
    - 只有项目的管理员和创建者可以修改项目。
    - 只有项目的创建者可以删除项目。

用户相关的操作不是本文要讲述的重点，本文只讲述如何实现和项目相关的 CRUD 接口：

* 创建项目。
* 查询项目。
* 修改项目。
* 删除项目。

> 因为要高效地开发高质量接口，我们不能等有了 UI 界面才去开发接口，开发接口和开发页面只有做到并行开发，才能提升团队的整体开发效率。和服务端开发打过交道的朋友应该知道，服务端在本地开发接口的时候，会使用诸如 Postman 这样的工具来测试接口的正确性。我们一定要尽可能地做到接口开发要脱离页面，虽然在页面中开发接口非常直观方便，但是它有很多的局限性。

> 为了表述方便，我们使用 [eggjs](https://eggjs.org) 框架，数据交换格式使用 JSON，接口使用 RESTful 规范，并且都以 `/api` 开头。另外，本文只介绍接口本身功能的开发，其他诸如缓存等方面的内容不会涉及。


## 创建项目
根据 RESTful 规范，接口地址是 `POST /api/projects`。虽然我们是脱离 UI 界面在开发接口，但页面的交互逻辑是必须清楚的（一般来说，会有交互设计稿）。对于创建项目来说，一般就是一个让用户填写项目信息的表单，里面有项目的名称和描述，用户填写完后，点击“提交”按钮提交表单数据，后端接收到数据后，在数据库中插入一条记录。这个就是创建项目的过程。

客户端发送过来的请求，会先经过一些通用的中间件处理，然后到达 Controller 层，这是编写业务逻辑代码的地方。我们不能信任用户提交过来的数据，需要对数据进行最基本的校验。根据 `project` 数据库表，`name` 字段是字符串类型，并且长度不能超过 100，`description` 字段也是字符串类型，长度不能超过 500，两者都可以为空。

但对于一个实际的项目来说，`name` 为空是没有意义的，所以还应该对 `name` 进行非空判断。代码大致如下：

```js
// ~ /controller/project.js
const createRule = {
    name: {
        type: 'string',
        max: 100,
    },
    description: {
        type: 'string',
        max: 500,
        required: false,
    },
};

async create() {
    const ctx = this.ctx;
    // 接收到的 JSON 数据
    const data = ctx.request.body;
    // 对数据进行验证，如果验证不通过，会直接报错返回
    ctx.validate(createRule, data);
    // 调用 service 方法去创建项目
    const id = await ctx.service.project.create(data);
}
```

相信很多朋友已经看出上述代码有一个严重的问题，就是 `data` 对象中缺少项目创建者的信息。创建者是谁？显然，它应该是当前的登录用户。用户能创建项目的前提是他已经登录系统了。在现代的 Web 项目中，当前登录用户的信息一般保存在客户端的 Cookie 中，服务端的话相应地保存在 Session 中。客户端在发送请求的时候，请求默认就会带上 Cookie 信息，不需要显式地发送这个数据。服务端根据请求的 Cookie 去 Session 中取出相应的用户信息。不过这一切的工作，框架或者中间件都帮我们实现好了，这不是本文要讲述的重点，就不展开了。

除了创建者没有设置的问题，还有以下需要注意的地方：

* 在对 `name` 进行校验的时候，要去掉它两边的空格，毕竟名称不能全是空格。`description` 无所谓，就不做处理。
* 客户端发送过来的数据，可能会包含其他字段名称的数据，这是完全可能的，所以传递给 Service 的 create 方法，应该只有明确的三个字段：`name`、`description` 和 `creatorId`。

> 注意，我们为了保证 Service 方法的纯粹性（方便复用），不在 Service 中去 Session 里面取当前登录用户的用户数据，而是在 Controller 中将用户传递给 Service。

修改后的代码大致如下：

```js
// ~ /controller/project.js
const createRule = {
    name: {
        ...
        // 去掉两边的空格，默认是 false
        trim: true
    },
    ...
};

async create() {
    const ctx = this.ctx;
    // extract 是自定义的根据 rule 规则抽取有效数据的方法
    const data = ctx.helper.extract(ctx.request.body, createRule);
    ctx.validate(createRule, data);
    // 设置创建者
    data.creatorId = ctx.session.user.id;
    const id = await ctx.service.project.create(data);
}
```

创建项目的代码看起来已经“无懈可击”了，但总觉得还少做了点什么工作。

我们来分析一下实际情况：就算是新开发一个接口，接口代码是逐步完善的，期间可能被重构了很多次，也就是说，存在实现了这个功能但会破坏之前已经实现好的功能，这是实际开发过程中的普遍现状。

是的，我们不能相信自己，不能相信不靠谱的人类，我们需要工具来保障我们之前实现的功能仍旧可以正常工作，我们需要给代码的每个逻辑分支编写测试用例，只有在开发好接口后，如果全部测试用例都能通过，我们才能认为这个接口已经开发完成。

将本地开发中的测试数据以测试用例的形式保存下来，这样的工具应该有很多，比如后端开发工程师最常使用的 Postman 工具就可以做到。今天也向大家推荐一款工具 [NEI](https://nei.netease.com)。

> NEI 是一个接口管理平台，目前由网易云音乐在开发和维护。在 NEI 平台上可以定义 HTTP 接口契约，还可以为定义好的接口创建测试用例，测试时会自动验证接口响应中的字段类型是否匹配、字段是否有缺失、字段是否有多余等等异常情况，能为开发人员节省很多宝贵的时间。关于 NEI 的更多信息请参考它的官方说明文档和使用教程。

在测试本小节讲解的“创建项目”接口时，不应该去关注后端的具体实现逻辑，所以从理论上来说，我们需要创建以下测试用例：

- 不发送任何字段。
- 只发送 `name` 字段，但它的值是非法的。非法的情况又分三种，
    - 空字符串，包括全是空格的情况。
    - 长度超过了 500。
    - 类型不是字符串。
- 只发送 `name` 字段，它的值是合法的。
- 只发送 `description` 字段，它的值是非法的。
- 只发送 `description` 字段，它的值是合法的。
- 发送 `name` 和 `description` 字段，它们的值都是非法的。
- 发送 `name` 和 `description` 字段，它们的值都是合法的。
- 发送 `name` 和 `description` 字段，`name` 的值是合法的，`description` 的值是非法的。
- 发送 `name` 和 `description` 字段，`name` 的值是非法的，`description` 的值是合法的。
- 除了发送 `name` 和 `description` 字段外，还发送了其他字段。
- 只发送了其他字段。

由于实际代码实现的不确定性，完全依赖测试用例来保障接口的正确性，从理论上来说是做不到的。实际开发过程中也不可能会按照上面这样的逻辑去创建测试用例。

我们只要创建几个关键的测试用例就可以了。对于这个“创建项目”的接口，有一个正常可以创建成功的用例再加上一到两个由于发送非法值导致创建失败的用例就可以了。

> 有同学看到这里，可能会想，要不要测试用户没有登录的情况，因为没有登录肯定无法创建项目。这个问题听起来问的非常合理，其实是无效的，因为登录认证这个工作，在框架或者中间件层面已经解决掉了，也就是说，如果没登录，代码都不会进入到 Controller，所以不用担心没有登录的问题。


## 查询项目

项目创建完后，肯定要在页面上显示出来，有可能是单独的项目详情页面，也有可能是项目列表页面，都需要用到项目数据。所以需要有查询项目的接口，最常见的就是按项目 id 查单个项目，还有就是显示用户的项目列表。

按照前面我们约定的规范：
- 按照项目 id 查询单个项目，接口地址是 `GET /api/projects/:id`，其中 `:id` 叫路径参数（Path Variable），表示项目的 id。
- 查询用户的项目列表，接口地址是 `GET /api/projects`。

我们先来分析第一种接口，即按照项目 id 查询单个项目，它应该做到：

- 先判断 id 是否为整数，如果不是就直接返回`参数无效`。这里需要注意的是，路径参数本身的类型是一个字符串，它是一个字符串类型的整数，需要做下类型转换。
- 然后拿着这个 id 去数据库里面查找有没有这个项目，有就返回，没有就返回`参数无效`。

大家已经注意到，id 不能转换成整数或者数据库中没有这个 id 的项目时，我们都返回了`参数无效` 这个错误信息。可能有人会问，为什么不返回非常明确的错误信息呢？这样排查问题就很快，客户端开发人员或者产品用户也看得更加明白。

如何返回有效的、合理的错误信息，其实是一门比较大的学问，几乎所有的研发团队都会朝规范化的错误信息方向努力，但实际情况还是一团糟，很可能还是由一线开发人员随意决定的。关于这个问题，我的建议是不用返回非常明确的错误信息给客户端，因为这个信息有可能会被不法分子利用，他们会根据错误信息来猜测代码的具体实现从而试探可能存在的漏洞。详细的错误信息应该用 Log 记录下来，方便接口开发人员排查问题。比如大家登录一些网站的时候，会提示帐号或者密码不对，此时就不应该明确地告诉用户到底是帐号不对还是密码不对，接口开发人员有 Log 记录就可以了。

我们再回到查询项目这个接口。上面分析了出来两个逻辑分支，但忘了一个非常严重的问题，也就是数据库中是存在这个 id 的项目，但当前登录用户是没有权限查看的。后端开发，有两个基本概念，一个叫 认证 (authentication)，一个叫 鉴权（authorization）。我们刚才遇到的问题就是鉴权问题，需要对资源进行鉴权。因为有很多的操作都需要判断权限，比如查询、更新、删除等等，所以应该把最基本的鉴权逻辑（因为权限问题还和具体的业务逻辑有关，能抽离出来的只能是一些最基本的通用逻辑）单独抽离成一层，在 Node.js 中我们叫中间件。一般框架也会提供这样的中间件，比如 eggjs 配套的 [egg-cancan](https://github.com/eggjs/egg-cancan)。

有了上述分析后，就不难写出如下的代码：

```js
// ~ /controller/project.js
async get() {
    const ctx = this.ctx;
    const id = parseInt(ctx.params.id, 10);
    if (Number.isNaN(id)) {
        // wrapResponse 是自定义封装方法，此处省略实现
        ctx.body = this.wrapResponse(id, 'BAD_REQUEST');
    } else {
        // canReadProject 方法会去调用鉴权中间件的方法，此处省略实现
        const canRead = await this.canReadProject(id);
        if (canRead) {
            const project = await ctx.service.project.get(id);
            ctx.body = this.wrapResponse(project);
        } else {
            ctx.body = this.wrapResponse(id, 'BAD_REQUEST');
        }
    }
}
```

我们再来看第二种接口，也就是查询用户的项目列表。首先要明白业务需求是什么，也就是用户可以见到哪些项目。我们在最开始已经写明了：只有项目的成员、管理员、创建者对该项目可见。项目和用户的关系是用了一张单独的表 `project_user` 来保存的，我们再回顾下这张表的设计：

```sql
CREATE TABLE `project_user` (
    `role`  TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '用户角色0－成员;9－管理员;10－创建者',
    ...
)
```

请注意 `role` 字段的注释说明，它的值是一个数字，每种数字表示不同的角色，比如 `10` 表示是这个项目的创建者。细心的朋友可能已经注意到，我们前面在分析“创建项目”接口时，并没有分析到在创建项目的时候，在往 `project` 表中插入一条记录的同时还要往 `project_user` 表插件一条表示项目和创建者的关系记录。有朋友可能会反驳说这条记录其实是多余的，因为 `project` 表中已经有了 `creatorId` 字段来记录项目和创建者的关系了。

那么到底需不需要往 `project_user` 表插入这条记录呢？这可能是一个仁者见仁智者见智的问题。就我们今天讲解的这个需求，按照 `project_user` 表中 `role` 的字段注释，最好是插入这条记录，有时候适当地冗余一些数据可能是件好事，说不定还可以提升数据库的查询性能。

根据上述分析，查询用户的项目列表，需要查询两张表，首先是根据用户 id 去 `project_user` 表把所有 `userId` 为用户 id 的项目 id（也就是projectId） 查出来，结果是一个数组集合，然后根据这个项目 id 集，批量去 `project` 表把项目查出来就可以了。具体的代码就不演示了。

另外有一个细节需要注意的是，`project` 表中有一个 `deletedAt` 字段，表示项目的删除时间。删除项目，我们选择了使用字段标记方案，而不是直接物理删除数据。在把项目数据返回给客户端的时候，需要过滤掉这个 `deletedAt` 字段，这是一个后端内部逻辑使用的字段，没必要给客户端开发者看到。这是一个通用的处理逻辑，封装成一个方法就可以了。

最后不要忘了，我们还需要给这两个接口添加测试用例：

- 根据 id 查询单个项目的测试用例：
    - 发送非数字类型的字符串。
    - 发送不存在的 id。
    - 发送正确的 id。
    - 发送正确的 id，但用户没权限查看。
- 查询用户的项目列表的测试用例：
    - 虽然实现起来需要考虑不少逻辑，因为不需要发送任何参数，所以只要编写一个能正确返回项目数据的用例就可以了。

## 修改项目

首先还是分析业务需求，修改这种操作，和具体的业务逻辑关系非常大，比如可以限制只有项目创建者可以修改项目，也可以让所有项目成员都可以修改项目。我们的需求最开始也已经描述过了“只有项目的管理员和创建者可以修改项目”。

根据 `project` 表，项目的名称和描述可以被修改，需要注意的是，对它们的校验，和创建项目的逻辑需要保持一致，比如名称不能是空字符串。

我们还有一张表 `project_user` 表，所以应该有这么一张页面，可以在上面设置项目的成员，比如将某个用户添加到项目中来，或者将某个用户设置为管理员。虽然更合理的做法是给这种操作开发单独的接口，以和“修改项目的名称和描述”这个操作做下区分，代码写起来也更清晰明了。

本节要实现的“修改项目”接口会支持以上两种情形。根据之前的分析，接口地址应该是 `PATCH /api/project/:id`。下面我们来分析代码逻辑：

- 客户端一般只发送需要修改的字段，所以如果不存在某个字段，比如 `name`，就不应该去更新它，由于我们要实现的接口可能会涉及到两张表，这样一来，还能减少数据库操作，要知道操作数据库是非常昂贵的，和操作 DOM 对象类似，能避免就尽量避免。
- 添加项目成员，设置管理员，都可以批量操作，所以客户端发送过来的数据都应该是数组，比如像下面这样传递：

```json
{
    "members": [],
    "admins": []
}
```

这样，`role` 这个信息对客户端可以做到透明，客户端开发不需要去设置这个值，能省点沟通成本就省点沟通成本，要不然还需要告诉客户端在添加成员的时候，要把 `role` 字段的值设置为 0，设置管理员的时候要把 `role` 的值设置为 9，这不但需要沟通成本，而且容易引入 Bug。

- 如果客户端发送过来的数据包含了 `members` 或者 `admins` 字段，此时就需要去更新 `project_user` 表，有以下情形需要考虑：
    - 如果 `members` 是一个空数组，它表示删除了所有的项目成员。
    - 如果 `members` 是非空数组，则需要计算出哪些成员被删除，哪些成员被添加，然后再批量更新数据库。
    - `admins` 和 `members` 的逻辑一样，不再赘述。
    - 此外，一个用户只能是成员或者管理员，也就是某个用户不能同时出现在 `members` 和 `admins` 数组中。虽然通过 UI 界面操作可以避免这种情况，但服务端不应该完全信任客户端发送过来的数据，因为请求数据是可以通过工具来伪造的。显然，`members` 和 `admins` 中也不应该出现项目的创建者。

通过上述分析，代码就不难实现了，实际代码较长，这里就不贴出来了。

同样的，需要为这个接口添加适当的测试用例，比较关键的有：

- 项目 id 非法。
- 项目 id 合法，但用户没权限修改。
- 项目名称和描述合法。
- 项目名称和描述非法。
- `members`、`admins` 数据合法。
- `members`、`admins` 中出现没有在系统中注册的用户。
- `members`、`admins` 中出现同个用户。
- `members`、`admins` 中出现了创建者。

## 删除项目

根据前面的分析，删除项目的接口地址是 `DELETE /api/projects/:id`，并且我们不是物理删除记录，而是去给 `deletedAt` 字段赋值。这个字段有值表示项目已经被删除。

服务端的 Project Controller 代码，只要调用 Project Service 的 `update` 方法就可以了，当然别忘记对项目鉴权，我们的需求已经规定只有项目的创建者才能删除项目，最终代码大致如下：

```js
// ~ /controller/project.js
async remove() {
    const ctx = this.ctx;
    const id = parseInt(ctx.params.id, 10);
    if (Number.isNaN(id)) {
        ctx.body = this.wrapResponse(id, 'BAD_REQUEST');
    } else {
        const canDelete = await this.canDeleteProject(id);
        if (canDelete) {
            // 删除时更新 deletedAt 字段，不是真正物理删除
            const result = await ctx.service.project.update({
                id,
                deletedAt: new Date()
            });
            if (result.success) {
                ctx.body = this.wrapResponse({ id });
            } else {
                ctx.body = this.wrapResponse(
                    {},
                    result.resType || 'SERVER_ERROR'
                );
            }
        } else {
            ctx.body = this.wrapResponse({}, 'BAD_REQUEST');
        }
    }
}
```

上述代码只更新了 `deletedAt` 字段。还有一个细节问题我们没有考虑，就是删除项目的时候，要不要把 `project_user` 中和这个项目相关的记录全部删除？不然项目被删除了，这些记录也没用了，留着不是占用数据库空间吗？如果是一个用户量非常大的产品，这个问题是必须要处理的，那时可能都不会使用 `deletedAt` 字段来标记项目是否被删除的状态，很可能是其他方案了。对于小项目来说，删项目的时候，删不删 `project_user` 的记录，都无所谓，看实际情况现做决定即可。一般来说最好是别删，可以减少恢复项目时的工作量。

本文演示的“项目更新”接口已经处理了项目成员及管理员的逻辑，所以要删除这些记录，需要修改的代码也很少：

```js
const result = await ctx.service.project.update({
    id,
    deletedAt: new Date(),
    // 设置成空数组表示将成员记录全部删除
    members: [],
    admins: []
});
```


最后，需要给这个接口添加两个关键的测试用例：

- 项目 id 非法。
- 项目 id 合法，但用户没权限删除。


## 小结

本文较为详细地分析了开发服务端 CRUD 接口的过程，需要考虑的点还是非常多的，这和前端工程师的开发思维有较大的不同，特别是资源鉴权、数据合法性校验、关键测试用例等等，需要花费较大的精力。

不管是前端工程师还是后端工程师，想要高效地开发高质量的 API 接口，都务必做到以下几点：

- 磨刀不误砍柴工，在开始编码之前，理清所有的业务逻辑分支。有些逻辑分支虽然在 UI 交互上是没有的，但是为了防止不必要的麻烦，在编写代码的时候，应该处理好所有的逻辑分支。
- 后端不能信任客户端发送的数据，尽可能地做到脱离页面开发。因为数据可以伪造，所以后端是必须要进行数据校验的，前端的数据校验只是为了提升用户体验。比如充值的时候，应该要判断数值是否大于零，不然充个负数就是严重的线上故障。
- 除了单向的逻辑分支外，还要考虑组合情形下的逻辑分支，这里是最容易发生 Bug 的情况，而且组合情况会非常复杂。这里可能需要根据系统的重要程度做一些权衡和取舍。
- 编写测试用例。可以是单元测试代码，也可以是 http 形式的接口调用用例。编写测试用例需要花费的时间不会少于业务逻辑代码，建议在重要的系统中严格执行这个环节。

很多刚工作不久的人问我应该如何提升自己的能力？因为编程语言层面的问题他们觉得都已经掌握了。我们试想一下，在评估一个人能力的时候，会考虑哪些因素？一个是知识面，这个一般在面试环节就能被问出来。第二个便是实际做需求的时候，考量的维度有：问题难度、引起的 Bug 数量、和同事的协作等等，这些都是可以证明自己能力的地方，如果都做得很好，在同事的心中就是一个能力强的人。就比如本文所讲述的 API 接口开发，如果开发出来的 API 接口实现得非常正确也没有漏洞，那在客户端同事的心中你就是一位能力强的人。


## 后记

在完成本文初稿的时候，大家都觉得这是一篇教大家如何开发 API 接口的教程，因为写得非常详细，基本上是到了手把手的地步。这个目的是首要的，但并不是本文真正的目的。本文的最终目的是想证明把一件事情做到极致需要花费怎样的努力，同时也顺便回答了如何提升个人能力的问题。

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！
