---
title: RBAC 权限模型在 EggJS 中的实践
date: 2020-09-24T01:55:37.093Z
description: 权限体系在中后台系统中至关重要，本文将围绕权限做一个介绍并分享下 RBAC 模型在项目中的实践。
---

![header.png](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4025645776/32ce/3b47/9fcb/e3fde297589891cf667fa27676f7f83b.png)

> 图片来源：https://www.softwaresuggest.com/blog/alternatives-to-role-based-access-control/

> 本文作者：孟进

## 前言

一提到后台系统，权限管理体系是其中一个必不可少的组成部分。后台往往涉及到大量的数据（包含许多隐私数据），这些数据通常需要不同职责的人员进行分别管理也就是我们所谓的各司其职。一个良好的权限设计能够起到保证业务数据处理的流畅性，降低操作风险，保障数据安全的作用。

在近期负责的中后台应用中正好有权限设计的部分，笔者借此机会对权限体系简单整理了一个大纲，今天会围绕大纲对权限体系做一个介绍以及在项目中的实践。

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3918232899/8f99/e549/84a6/bc2a38efd588d490ac56f96eae44b646.png)

## 权限体系介绍

### 1.什么是权限

我理解权限本质上就是访问控制，用一句话来描述就是某个**主体**是否可以根据某些规则对某部分**资源**进行某种**操作**，从这句话中可以很明显的看出构成权限的三要素：主体，资源以及操作。

### 2.权限划分

权限大致可以分为：页面权限，功能权限和数据权限

* 页面权限：就是用户访问页面，模块，菜单等的权限
* 功能权限：和页面权限相互关联，有页面权限才有对应的功能权限，任何交互行为比如增删改查，当然可以更加细粒度到接口级别的权限
* 数据权限：控制不同主体查看不同数据信息的权限，相比于上面两种权限，数据权限和业务逻辑的关系非常密切，不同的系统数据权限各不相同，也是最为复杂部分。数据权限大致可分行权限和列权限，即不同的主体根据不同的条件规则可以看到数据表中不同的行和字段。

### 3.权限模型

四种经典的权限模型：自主访问控制（DAC）、强制访问控制（MAC）、基于角色访问控制（RBAC）和基于属性访问控制（ABAC），目前使用最为广泛的就是 RBAC 模型，本文也主要针对这种模型进行介绍，但基于文章的完整度，会对其它几种类型做简单的概括。

- DAC：根据权限控制列表或权限控制矩阵判断用户能对哪些资源进行哪些操作，用户和权限直接关联，拥有权限的用户同样拥有权限的分配权，具有权限控制分散不便于管理的缺点
- MAC：弥补 DAC 的缺陷，每个对象和用户都会有权限等级标识，适合机密或等级分明的机构
- ABAC：通过动态计算一个或一组属性来是否满足某种条件进行授权，是一个比较复杂的模型

### 4.RBAC 模型介绍

传统模式下主体和资源权限直接关联，权限的变化都将导致对每一个主体重新分配，而 RBAC 模型在用户主体和权限之间引入了角色的概念，通过用户关联角色、角色关联权限的方式间接地赋予权限，从而达到用户和权限解耦的目的。（见下图）

* RBAC0：核心基础思想，用户通过角色和权限进行关联。两两之间均是多对多关系
* RBAC1：在 0 的基础上引入了角色继承的概念，高级角色可以继承低级角色的权限
* RBAC2：在 1 的基础上加入了权限约束，分为静态职责分离和动态职责分离
  1. 静态职责分离：用户无法同时被赋予冲突的角色
  2. 动态职责分离：一次会话中无法同时激活互相冲突的角色
* RBAC3：是 1 和 2 的合集

![截屏2020-09-07 上午2.37.26](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/3918244237/94fc/70f9/c8e9/97be508f3abd61dd6d954c5ec2685b21.png)

## 项目实践

### 1.背景

在做内部中后台系统的时候，需要实现一套权限体系来进行管理，在项目初期由于功能单一、交互简单、使用人数少等原因，权限是直接挂在用户身上的（类似 DAC 模型）,然而随着功能迭代、交互复杂化，对权限控制的要求越来越高，原先的方案已经不能够满足，所以需要基于 RBAC 模型对整个权限做一次重新设计。

### 2.痛点

在实际开发中发现要在业务代码中实现一套权限方案会遇到下面的一些问题:

- 在项目最初上线的时候需要自己初始化一些角色和权限表
- 新增删除分配角色或权限等的操作，需要自己去维护表和表的关联关系
- 对于 URL 层面的拦截，需要自己在 Controller 层（或中间件）做一些角色权限判断
- 项目中无法直观的看出角色资源权限之间的关系
- 除云音乐以外还有其他 APP，比如直播，K 歌等，即使是同一资源针对不同 APP 可看到的内容也不尽相同，需要在代码中根据角色返回不同的字段或数据行
- 权限判断代码和业务逻辑代码耦合比较严重，不利于维护

### 3.实践

#### 3.1 生成访问控制表

下面将介绍如何通过访问控制表来描述资源角色权限之间的关系，这也是后面插件实现的一个核心思想

1. 思考项目中存在哪些初始角色

```javascript
['admin', 'music_bridge_ios_developer', 'music_bridge_admin', 'music_link_developer']
```

2. 这些角色分别可以操作哪些资源

```javascript
[{
 roles: ['admin'],
 allow: '*'
}, {
 roles: ['music_bridge_ios_developer'],
 allow: {
   resources: ['bridge']
 }
}, {
 roles: ['music_bridge_admin'],
 allow: {
   resources: ['bridge']
 }
}, {
 roles: ['music_link_developer'],
 allow: {
   resources: ['link']
 }
}]
```

3. 对这些资源具体可以有哪些操作

```javascript
[{
 roles: ['music_bridge_ios_developer'],
 allows: [{
   resources: ['bridge'],
+   actions: ['get', 'post', 'update', 'delete']
 }]
}, {
 roles: ['music_bridge_admin'],
 allows: [{
   resources: ['bridge'],
+   actions: '*'
 }]
}]
```

4. 对这些资源是否有条件规则的限制，比如只能看某几行或某几个字段

```javascript
[{
 roles: ['music_bridge_ios_developer'],
 allow: {
   resources: ['bridge'],
   actions: ['get', 'post', 'update', 'delete'],
+   attributes: ['id', 'name'],
+   where: [{
     platform: 'ios',
     app: 'music'
   }]
 }
}]
```

5. 针对 URL 路由是否需要权限控制

```javascript
apis: [{
   url: '/api/bridge',
   roles: ['music_bridge_ios_developer', 'music_bridge_admin']
}]
```

以上我们就生成了一份简单的访问控制表，表中资源角色权限之间的关系一目了然。

#### 3.2 Egg 插件

结合上述 RBAC 模型和访问控制表，基于 Egg 和 MySQL 封装了一个 Egg 插件来集中管理项目中遇到的权限问题。

该插件可以解决以下问题：

- 数据库配置，scheme 模型定义
- 通过配置表维系角色资源权限之间的关系
- 基于配置表在启动时初始化角色表，权限表和角色权限关联表
- 支持超级管理员，拥有最高权限
- 支持 URL 和 API 级别的拦截权限控制
- 支持角色配置数据权限，定制过滤规则
- 支持通过 API 来管理用户角色和权限
- 后续支持配置父角色，父角色拥有子角色权限
- 自定义无权限时的错误信息
- 删除角色时判断角色下是否有用户

##### 完整代码：

1.

```javascript
// config.default.js
// 根据配置初始化角色的权限，也可动态修改
// 根据配置自动生成数据表关系
// 这边的数据权限是直接挂钩在角色上的，功能权限为单独的表

config.acl = {
 // 数据库配置
 db: {
       database: 'test',
       host: '127.0.0.1',
       port: '3331',
       username: 'root',
       password: 'root',
 },
 apis: [{
   url: '/api/bridge', //拦截该请求
   roles: ['music_bridge_ios_developer', 'music_bridge_admin'], //配置访问该 url 需要的角色
   validator: () => {} //后续可支持自定义验证函数
 }],
 // 权限配置
 permissions: [{
   roles: ['admin'],
   allows: '*' // *代表拥有全部权限
 }, {
   // 云音乐bridge ios开发者
   roles: ['music_bridge_ios_developer'],
   allows: [{
     resources: ['bridge'], //资源为bridge
     actions: ['get', 'post', 'update', 'delete'], //该角色在该资源下允许的操作
     attributes: ['id', 'name'], //控制数据权限的列权限，只返回 id 和 name 字段
     where: [{
       platform: 'ios',
       app: 'music'
     }], //支持简单的行权限控制，该角色只返回 bridge 资源下 app 为 music，platform 为 ios 的内容
   }],
   parents: ['music_developer'] //假如有,配置父角色
 }, {
   roles: ['music_bridge_admin'], // bridge 管理员
   allows: [{
     resources: ['bridge'],
     actions: '*' //该角色拥有该资源的全部操作权限
   }]
 }],
 errorhandler: '' || () => {} //自定义错误信息
}
```
2. 根据配置自动生成以下数据表

   角色表

    ![角色表](https://p5.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4067223810/8047/5d96/5d86/b3588d7aca55bbec41bc99e8ff555e8a.png)

   权限表

    ![权限表](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4067226172/82de/43c2/0927/d89391452ab2201c83d78397103fd762.png)

   角色权限关联表

    ![角色权限关联表](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4067258350/f345/76ab/06b2/47f83090b3fe23bf2fd3d71b14d308c2.png)
   
   url角色关联表
   
    ![url角色关联表](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/4067260137/cb02/ab90/f91a/38deae748c6db1b711a79e032d61ee8d.png)



3. 在代码中可以通过 API 管理用户、角色和权限

```javascript
// 添加用户到角色
await this.app.acl.addUserToRoles(userId, ['music_bridge_admin'])

// 添加新角色
await this.app.acl.addRoles(['look_bridge_developer'], {
 allows: [{
   resources: 'bridge',
   actions: ['get', 'post', 'update']
   where: [{
     platform: 'look'
   }]
 }]
});

// 给某个角色添加某个资源的xx权限
await this.app.acl.addPermsToRole('look_bridge_developer', 'bridge', ['delete']);

// 获取用户所有角色
await this.app.acl.getUserRoles(userId);

// 获取用户某个资源的所有权限
await this.app.acl.getUserResourcePermissions(userId, 'bridge');

// 判断用户是否有某个资源的删除权限
await this.app.acl.hasPermissions(userId, 'bridge', 'delete')

...还有其他方法
```


整个插件的设计思路是通过配置式的方式来维护角色资源权限之间的关系，把数据权限的访问规则绑定在角色上，当插件初始化的时候会根据配置信息去创建表的关联关系。对外暴露 API 供使用者来管理权限，而不必去关心具体如何更新关联关系，将大部分权限代码和业务代码解耦出来。

## 结束语

权限的设计可以很简单也可以很复杂，模型的引入只是为权限管理提供了依据和方案，最有效的还是从使用场景出发，使用场景决定业务逻辑，业务逻辑决定功能逻辑，合适的功能粒度的划分才会促成灵活高效的权限体系的形成。

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
