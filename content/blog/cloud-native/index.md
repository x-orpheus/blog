---
title: 云原生基础及调研
date: "2019-12-09T01:22:53.416Z"
description: "本文仅用于简单普及，达到的目的是给没接触过或者很少接触过这方面的人一点感觉，阅读起来会比较轻松，作者深知短篇幅文章是不可能真正教会什么的，所以也不会出现 RTFM 的内容。"
---

![](https://cdn.int64ago.org/181b1622-116a-415e-a101-84d840e40965.png)

> 本文作者： [Cody Chan](https://github.com/int64ago)

本文仅用于**简单普及**，达到的目的是给没接触过或者很少接触过这方面的人一点感觉，阅读起来会比较轻松，作者深知短篇幅文章是不可能真正教会什么的，所以也不会出现 [RTFM](https://en.wikipedia.org/wiki/RTFM) 的内容。

## 概念

提到云原生（Cloud Native）可能部分人会陌生，但是如果说 Serverless 相信很多人就知道了，实际上两者并不等价。Serverless 是一种理念或者服务交付形态，目标是屏蔽硬件和运维细节，而云原生则是实现此类目标的一种规范以及基础设施。

再进一步，介于 Docker 天然的隔离性和高效等特点，以及 [Kubernetes](https://kubernetes.io/) 成为事实意义上的 [Docker](https://www.docker.com/) 编排标准，凡是见到云原生或者 Serverless 的地方，几乎都可以认为是基于 Docker + Kubernetes 的一种实践。


## 演进之路

单个点展开讲太枯燥，索性我们从历史的角度看看为什么会有云原生。

### Docker

先申明下，Docker 是一种容器技术（具体可深入 [namespaces](https://en.wikipedia.org/wiki/Linux_namespaces) 和 [cgroups](https://en.wikipedia.org/wiki/Cgroups)），而不是虚拟化技术，真正的虚拟化比较常见的是 [Xen](https://en.wikipedia.org/wiki/Xen) 和 [KVM](https://en.wikipedia.org/wiki/Kernel-based_Virtual_Machine)，可能有同学要举手了：老师，那我们经常用的 VirtualBox 和 VMware 算虚拟化么？当然算！不过大多数情况下，它们用在桌面虚拟化领域。不要急着撕，我说的是大多数，而且虚拟化方案也还有很多。

可能大家之前经常遇到这样的场景：为什么在我这可以运行在你那就不行了？为什么刚刚可以运行现在就不行了？最终解决下来，大多是环境不一致导致的问题。这里的环境除了开发环境还包括操作系统。

所以一般给别人代码的时候还需要告诉别人此代码可运行的操作系统版本，所依赖的各种软件的版本，甚至目录、磁盘、内存、CPU 都有要求！

当然这个问题还有更直接的办法，就是把代码跑在虚拟机里，然后打包虚拟机！（不要笑，实际上还真有人这么干）为什么此刻你笑了，因为虚拟机太重了，无论从打包的体积还是运行时占用的资源都太重了。

那有没有轻点的「虚拟机」呢？嗯，如标题，不过我们叫做容器化，特点：

 - 进程级别的隔离性；
 - 除里面运行的应用本身外几乎不占用宿主资源；
 - 结构化的配置文件（Dockerfile）；
 - 无状态无副作用（主流方式）；
 - 分层的联合文件系统；
 - ...

**Docker 让运行环境变得可编程！**

拿一个最近部署 [Sourcegraph](https://github.com/sourcegraph/sourcegraph) 的经历举个栗子，官方有个开发者 [清单](https://github.com/sourcegraph/sourcegraph/blob/master/doc/dev/local_development.md#step-1-install-dependencies)，一堆依赖和环境设置，照着这个部署会爆炸的，好在官方还提供了可快速部署的镜像，就是这么简单：

![](https://cdn.int64ago.org/eca4b486-288e-4731-9209-b47a30462220.png)

### Kubernetes

> 太长，以下简称 K8S，类似的简称形式还有 [很多](https://en.wikipedia.org/wiki/Numeronym)。

Docker 虽然很厉害，但是在成人看来也只是小孩的玩具，稍微大点的公司内部可能服务就多的吓人，特别是 [微服务架构](https://en.wikipedia.org/wiki/Microservices) 盛行后。

Docker 只解决了单个服务的交付问题，一个具备完整形态的应用必然会涉及各种服务依赖，人为组织这些依赖也是会死人的。Docker 把我们从各种跟环境纠缠里解放出来，却让我们陷入了更高维度的服务依赖之间的纠缠。

是个 Docker 用户应该都会想到去解决这个问题，如你所愿，出现了三国争霸的局面：[Docker Swarm](https://docs.docker.com/engine/swarm/)、[Apache Mesos](http://mesos.apache.org/) 和 [Google Kubernetes](https://kubernetes.io/)，一定程度上 K8S 成为了现在主流的 Docker 编排标准。有意思的是 K8S 有舵手之意，而 Docker 有集装箱之意，所以结合下是不是更合理了？

![](https://cdn.int64ago.org/32b6bc48-cf2f-4341-b1e6-d29f9080df6c.png)


更有意思的是，K8S 管理 Docker 的过程也是一层层抽象。为了解决一组密切相关容器集合的调度，K8S 的最小的调度单位是 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod/) 而不是容器，同一个 Pod 里的容器的资源可以互相访问。为了管理发布、回滚、扩缩容，又在这之上抽象了一个 [Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)，实际上这是我们最直接使用的单元。为了管理负载均衡和调度，又抽象了一个叫 [Service](https://kubernetes.io/docs/concepts/services-networking/service/)。

以上概念是 K8S 基本概念，不过我想强调的是这个：**解决复杂问题很多都是在一层层抽象**，这点展开还可以说很多东西。

K8S 做的比较极致的点就是以上所有资源的管理都是通过声明式的配置进行，**K8S 把容器运维变得可编程！**

### Cloud Native

到这里，如果要直接在生产环境使用 K8S 基本也可以了，我们聊点别的吧。

都知道 Java 后端广泛采用的 Web 框架是 Spring MVC，那可是 02 年的老古董了！即使现在有了 Spring Boot，也可以算是一种升级，跟近几年百花齐放的前端三大框架比少了太多的口水仗。

百花齐放的原因很大一部分就是前端一开始就没有形成强有力的**最佳实践**！从工程化角度看，太多的重复轮子很容易导致工程的可维护性变差。Web 后端稳定性的特点不太能容忍这样的事情发生，推导到云上也一样。

**云原生就是云的（或狭义指 K8S 的）最佳实践，生而为云，所谓云原生！**

为了达到此目的，还有了 [CNCF（云原生计算基金会）](https://www.cncf.io/)，有了组织就靠谱多了。这个组织有一个收集（或孵化）了各种最佳实践的 [云原生全景图谱](https://landscape.cncf.io/)。比如，一个比较有意思的叫 [helm](https://github.com/helm/helm)，作为 K8S 应用包管理器，它把一个 K8S 应用抽象成一个包，一键就可以部署一个应用，跟很多包管理器一样，它也有源 [KubeApps Hub](https://hub.kubeapps.com/)（甚至有阿里云提供的 [国内源](https://developer.aliyun.com/hub)）。

### Serverless

有了云原生，基本各种业务场景都可以找到适合的最佳实践，Serverless 就是其中一种。个人很不理解为什么这个词被翻译成：无服务器架构，Serverless 屏蔽的是运维，所以叫无运维架构更合适。迫于无法接受其中文翻译，文中还是用 Serverless。

你可能好奇，为啥这里要把 Serverless 单独拉出来说下，因为这是 CNCF 的宠儿啊！CNCF 范畴内太多项目了，但是大多还是偏硬，普通业务很难用上并落地，所以抓了个可以落地的当典型，还为其起草了个 [白皮书](https://github.com/cncf/wg-serverless/tree/master/whitepapers/serverless-overview)，建议有兴趣的可以细品。

在说屏蔽运维之前，我们先回顾下运维一般包括哪些：

 - 服务器、网络、存储等物理资源（IaaS）申请；
 - 测试、发布、扩缩容；
 - 监控、日志； 
 - ...

要达到屏蔽运维大体就是无需关心以上点，目前业界主流形式有 BaaS 和 FaaS：

 - BaaS（Backend as a Service）：此服务做法就是把常见的后端服务抽象出来，比如数据存储、文件存储、消息等，客户端使用这些服务时感觉就像在使用普通的 SDK/API。

![](https://cdn.int64ago.org/126f53fa-0c42-4a30-ad79-e33e1c0484da.png)

*图片来自 [Cloudflare](https://www.cloudflare.com/learning/serverless/glossary/backend-as-a-service-baas/)*
 
 - FaaS（Function as a Service）：BaaS 只在大多数场景好使，某些特殊场景可能就比较麻烦，有些能力可能并没有提供，但是又必须要在后端写。完整关心整个后端代码框架并没必要，所以就可以抽象简单一个个 function 让用户去完成。目前 Google 采用的是 [Knative](https://knative.dev/)，这里还有个其它方案的对比 [文章](https://winderresearch.com/a-comparison-of-serverless-frameworks-for-kubernetes-openfaas-openwhisk-fission-kubeless-and-more/)。

具体采用何种方式取决于业务形态，大体上就是用灵活性换方便度，给各种云服务一个灵活度排序：`IaaS（各种云主机） > CaaS（Docker 等容器服务） > PaaS（BAE、SAE、GAE 等 APP Engine） > FaaS > BaaS > SaaS（各种 Web APP，如 Google Doc）`。

![](https://cdn.int64ago.org/63402861-5a7f-4fbf-8f65-27b5ae4f58a6.png)

*歪歪的云计算九层架构，深色的表示留给用户定制的，[灵感来源](https://www.google.com/search?q=iaas+paas+saas&source=lnms&tbm=isch)*

**Serverless 为开发者提供了一种屏蔽运维又具备一定灵活度的云服务。**

## 业界现状

本文只关心云原生相关产品，即 Docker/K8S 之上的产品，以下是部分主流产品：

 - K8S && CaaS
   - [Google Kubernetes Engine](https://cloud.google.com/kubernetes-engine/)
   - [Google Cloud Run](https://cloud.google.com/run/)
   - [Amazon EKS](https://aws.amazon.com/eks/)
   - [Azure AKS](https://azure.microsoft.com/en-us/services/kubernetes-service/)
   - [阿里云容器服务](https://cn.aliyun.com/product/containerservice)
 - FaaS
   - [Google Cloud Functions](https://cloud.google.com/functions/)
   - [AWS Lambda](https://aws.amazon.com/lambda/)
   - [ZEIT Now](https://zeit.co/)
   - [阿里云函数计算](https://www.aliyun.com/product/fc)
 - BaaS
   - [LeanCloud](https://leancloud.cn/)
 - BaaS + FaaS
   - [阿里云小程序云](https://www.aliyun.com/product/miniappdev)

有条件都可以体验下，我举两个切身的例子：

 - 除了大家见到很多公共云服务，还有很多服务是不适合放到公共云的，需要私有化部署。记得之前给某单位做项目，交付的时候过去装系统、装软件，还要各种现场联调，来来回回折腾很久。现在用 Docker + K8S 交付就非常轻松了，只需要有一套 K8S 集群，其它都 Docker 镜像打包带过去，一个配置文件轻松搞定编排！
 - 回想下你们做的系统，是不是很多几乎都没人用了，但是还是不能下线？是不是有的系统可能只有几个接口也要从申请机器到申请各种中间件走一遍流程？我们姑且称这些为长尾应用，这些应用是团队历史包袱变重的重要因素。如果采用 FaaS 或 BaaS 的方式做，你会发现新的人生，而与此相关的配套设施，业界主流的是 CLI 和 WebIDE，无论哪种，都会让你爽。

以上两个例子虽然只反应了业界一部分现状，可见一斑。

## 总结

本文简单介绍了云原生的一些基本概念，从演进角度解释了为什么会有云原生，本质就是抽象抽象再抽象，最后调研了国内外的主流现状，读到这希望你有点感觉了，进一步了解需要读者自行实践。

## 参考资料

正文里均以外链形式列出。

> 本文发布自 [网易云音乐前端团队](https://github.com/x-orpheus)，可自由转载，转载请在标题标明转载并在显著位置保留出处。我们一直在招人，如果你恰好准备换工作，又恰好喜欢云音乐，那就 [加入我们](mailto:grp.music-fe@corp.netease.com)！

