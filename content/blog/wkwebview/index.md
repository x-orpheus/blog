---
title: WKWebView 请求拦截探索与实践
date: 2021-01-28T02:22:26.899Z
description: 在苹果推出 WebKit 后，UIWebView 正在退出历史舞台，WKWebView 凭借着速度快、占用内存小等优势逐渐的被大家广泛使用。云音乐在 WebView 上的使用要求有离线包加载以及免流等能力，这一切都得依赖请求拦截能力。本文总结了我们在实现 WKWebView 请求拦截的一些经验，希望能帮助到正在研究该方面的同学。
---

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5597400919/b1cf/f6fa/9cf8/fc1db46cdd5314f6bdbc299139cddaa6.jpg)

> 图片来源：https://unsplash.com

> 本文作者：[谢富贵](https://github.com/GeniusBrother)

## 背景

WebView 在移动端的应用场景随处可见，在云音乐里也作为许多核心业务的入口。为了满足云音乐日益复杂的业务场景，我们一直在持续不断的优化 WebView 的性能。其中可以短时间内提升 WebView 加载速度的技术之一就是离线包技术。该技术能够节省网络加载耗时，对于体积较大的网页提升效果尤为明显。离线包技术中最关键的环节就是拦截 WebView 发出的请求将资源映射到本地离线包，而对于 `WKWebView` 的请求拦截 iOS 系统原生并没有提供直接的能力，因此本文将围绕 `WKWebView` 请求拦截进行探讨。

## 调研

我们研究了业内已有的 `WKWebView` 请求拦截方案，主要分为如下两种:

**NSURLProtocol**

`NSURLProtocol` 默认会拦截所有经过 URL Loading System 的请求，因此只要 `WKWebView` 发出的请求经过 URL Loading System 就可以被拦截。经过我们的尝试，发现 `WKWebView` 独立于应用进程运行，发出去的请求默认是不会经过 URL Loading System，需要我们额外进行 hook 才能支持，具体的方式可以参考 [NSURLProtocol对WKWebView的处理](https://www.jianshu.com/p/8f5e1082f5e0)。

**WKURLSchemeHandler**

`WKURLSchemeHandler` 是 iOS 11 引入的新特性，负责自定义请求的数据管理，如果需要支持 scheme 为 http 或 https请求的数据管理则需要 hook `WKWebView` 的 `handlesURLScheme`: 方法，然后返回NO即可。

经过一番尝试和分析，我们从以下几个方面将两种方案进行对比:
*   隔离性：`NSURLProtocol` 一经注册就是全局开启。一般来讲我们只会拦截自己的业务页面，但使用了 `NSURLProtocol` 的方式后会导致应用内合作的三方页面也会被拦截从而被污染。`WKURLSchemeHandler` 则可以以页面为维度进行隔离，因为是跟随着 `WKWebViewConfiguration` 进行配置。
*   稳定性：`NSURLProtocol` 拦截过程中会丢失 Body，`WKURLSchemeHandler` 在 iOS 11.3 之前 (不包含) 也会丢失 Body，在 iOS 11.3 以后 WebKit 做了优化只会丢失 Blob 类型数据。
*   一致性：`WKWebView` 发出的请求被 `NSURLProtocol` 拦截后行为可能发生改变，比如想取消 video 标签的视频加载一般都是将资源地址 (src) 设置为空，但此时 `stopLoading` 方法却不会调用，相比而言 `WKURLSchemeHandler` 表现正常。

**调研的结论是：`WKURLSchemeHandler` 在隔离性、稳定性、一致性上表现优于 `NSURLProtocol`，但是想在生产环境投入使用必须要解决 Body 丢失的问题。**

## 我们的方案

通过上文可以得知只通过 `WKURLSchemeHandler` 进行请求拦截是无法覆盖所有的请求场景，因为存在 Body 丢失的情况。所以我们的研究重点就是确保如何不让 Body 数据丢失或者提前拿到 Body 数据然后再将其组装成一个完整的请求发出，很显然前者需要对 WebKit 源码进行改动，成本过高，因此我们选择了后者。通过修改 JavaScript 原生的 [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) / [XMLHttpRequest](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) 等接口实现来提前拿到 Body 数据，方案设计如下图所示：

![](https://p6.music.126.net/obj/wo3DlcOGw6DClTvDisK1/5757285738/764b/70a4/53c4/dc073d915c9cf1cb8c4c87a64681d99c.jpg)

具体流程主要为以下几点：
*   加载 HTML 文档的时候注入自定义的 `Fetch` / `XMLHttpRequest` 对象脚本
*   发送请求之前收集 Body 等参数通过 `WKScriptMessageHandler` 传递给原生应用进行存储
*   原生应用存储完成之后调用约定好的 JavaScript 函数通知 `WKWebView` 保存完成
*   调用原生 `Fetch` / `XMLHttpRequest` 等接口来发送请求
*   请求被 `WKURLSchemeHandler` 管理，取出对应的 Body 等参数进行组装然后发出

### 脚本注入

#### 替换 Fetch 实现

脚本注入需要修改 `Fetch` 接口的处理逻辑，在请求发出去之前能将 Body 等参数收集起来传递给原生应用，主要解决的问题为以下两点：
*   iOS 11.3 之前 Body 丢失问题
*   iOS 11.3 之后 Body 中 `Blob` 类型数据丢失问题

1\. 针对第一点需要判断在 iOS 11.3 之前的设备发出的请求是否包含请求体，如果满足则在调用原生 `Fetch` 接口之前需要将请求体数据收集起来传递给原生应用。

2\. 针对第二点同样需要判断在 iOS 11.3 之后的设备发出的请求是否包含请求体且请求体中是否带有 `Blob` 类型数据，如果满足则同上处理。

其余情况只需直接调用原生 `Fetch` 接口即可，保持原生逻辑。
```javascript
var nativeFetch = window.fetch
var interceptMethodList = ['POST', 'PUT', 'PATCH', 'DELETE'];
window.fetch = function(url, opts) {
  // 判断是否包含请求体
  var hasBodyMethod = opts != null && opts.method != null && (interceptMethodList.indexOf(opts.method.toUpperCase()) !== -1);
  if (hasBodyMethod) {
    // 判断是否为iOS 11.3之前(可通过navigate.userAgent判断)
    var shouldSaveParamsToNative = isLessThan11_3;
    if (!shouldSaveParamsToNative) {
      // 如果为iOS 11.3之后请求体是否带有Blob类型数据
      shouldSaveParamsToNative = opts != null ? isBlobBody(opts) : false;
    }
    if (shouldSaveParamsToNative) {
      // 此时需要收集请求体数据保存到原生应用
      return saveParamsToNative(url, opts).then(function (newUrl) {
        // 应用保存完成后调用原生fetch接口
        return nativeFetch(newUrl, opts)
      });
    }
  }
  // 调用原生fetch接口
  return nativeFetch(url, opts);
}
```

#### 保存请求体数据到原生应用

通过 `WKScriptMessageHandler` 接口就能将请求体数据保存到原生应用，并且需要生成一个唯一标识符对应到具体的请求体数据以便后续取出。我们的思路是生成标准的 UUID 作为标识符然后随着请求体数据一起传递给原生应用进行保存，然后再将 UUID 标识符拼接到请求链接后，请求被 `WKURLSchemeHandler` 管理后会通过该标识符去获取具体的请求体数据然后组装成请求发出。

```javascript
function saveParamsToNative(url, opts) {
  return new Promise(function (resolve, reject) {
    // 构造标识符
    var identifier = generateUUID();
    var appendIdentifyUrl = urlByAppendIdentifier(url, "identifier", identifier)
    // 解析body数据并保存到原生应用
    if (opts && opts.body) {
      getBodyString(opts.body, function(body) {
        // 设置保存完成回调，原生应用保存完成后调用此js函数后将请求发出
        finishSaveCallbacks[identifier] = function() {
          resolve(appendIdentifyUrl)
        }
        // 通知原生应用保存请求体数据
        window.webkit.messageHandlers.saveBodyMessageHandler.postMessage({'body': body, 'identifier': identifier}})
      });
    }else {
      resolve(url);
    }
  });
}
```

#### 请求体解析

在 `Fetch` 接口中可以通过第二个 opts 参数拿到请求体参数即 opts.body，参考 [MDN Fetch Body](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#body) 可得知请求体的类型有七种。经过分析，可以将这七种数据类型分为三类进行解析编码处理，将 `ArrayBuffer`、`ArrayBufferView`、`Blob`、`File` 归类为二进制类型，`string`、`URLSearchParams` 归类为字符串类型，`FormData` 归类为复合类型，最后统一转换成字符串类型返回给原生应用。

```javascript
function getBodyString(body, callback) {
  if (typeof body == 'string') {
    callback(body)
  }else if(typeof body == 'object') {
    if (body instanceof ArrayBuffer) body = new Blob([body])
    if (body instanceof Blob) {
      // 将Blob类型转换为base64
      var reader = new FileReader()
      reader.addEventListener("loadend", function() {
        callback(reader.result.split(",")[1])
      })
      reader.readAsDataURL(body)
    } else if(body instanceof FormData) {
      generateMultipartFormData(body)
      .then(function(result) {
        callback(result)
      });
    } else if(body instanceof URLSearchParams) {
      // 遍历URLSearchParams进行键值对拼接
      var resultArr = []
      for (pair of body.entries()) {
        resultArr.push(pair[0] + '=' + pair[1])
      }
      callback(resultArr.join('&'))
    } else {
      callback(body);
    }
  }else {
    callback(body);
  }
}
```

二进制类型为了方便传输统一转换成 Base64 编码。字符串类型中 `URLSearchParams` 遍历之后可得到键值对。复合类型存储结构类似为字典，值可能为 `string` 或者 `Blob` 类型，所以需要遍历然后按照 Multipart/form-data 格式进行拼接。

#### 其它

注入的脚本主要内容如上述所示，示例中只是替换了 `Fetch` 的实现，`XMLHttpRequest` 也是按照同样的思路进行替换即可。云音乐由于最低版本支持到 iOS 11.0，而 `FormData.prototype.entries` 是在 iOS 11.2 以后的版本才支持，对于之前的版本可以修改 `FormData.prototype.set` 方法的实现来保存键值对，这里不多加赘述。除此之外，请求可能是由内嵌的 `iframe` 发出，此时直接调用 `finishSaveCallbacks[identifier]()` 是无效的，因为 finishSaveCallbacks 是挂载在 Main Window 上的，可以考虑使用 `window.postMessage` 方法来跟子 Window 进行通信。

### WKURLSchemeHandler 拦截请求

`WKURLSchemeHandler` 的注册和使用这里不再多加叙述，具体的可以参考上文中的调研部分以及苹果文档，这里我们主要聊一聊拦截过程中要注意的点

#### 重定向

一些读者可能会注意到上文调研部分我们在介绍 `WKURLSchemeHandler` 时把它的作用定义为**自定义请求的数据管理**。那么为什么不是**自定义请求的数据拦截**呢？理论上拦截是不需要开发者关心请求逻辑，开发者只用处理好过程中的数据即可。而对于数据管理开发者需要关注过程中的所有逻辑，然后将最终的数据返回。带着这两个定义，我们再一起对比下 `WKURLSchemeTask` 和 `NSURLProtocol` 协议，可见后者比前者多了重定向、鉴权等相关请求处理逻辑。

```objectivec
API_AVAILABLE(macos(10.13), ios(11.0))
@protocol WKURLSchemeTask <NSObject>

@property (nonatomic, readonly, copy) NSURLRequest *request;

- (void)didReceiveResponse:(NSURLResponse *)response;

- (void)didReceiveData:(NSData *)data;

- (void)didFinish;

- (void)didFailWithError:(NSError *)error;

@end
```

```objectivec
API_AVAILABLE(macos(10.2), ios(2.0), watchos(2.0), tvos(9.0))
@protocol NSURLProtocolClient <NSObject>

- (void)URLProtocol:(NSURLProtocol *)protocol didReceiveResponse:(NSURLResponse *)response cacheStoragePolicy:(NSURLCacheStoragePolicy)policy;

- (void)URLProtocol:(NSURLProtocol *)protocol didLoadData:(NSData *)data;

- (void)URLProtocolDidFinishLoading:(NSURLProtocol *)protocol;

- (void)URLProtocol:(NSURLProtocol *)protocol didFailWithError:(NSError *)error;

- (void)URLProtocol:(NSURLProtocol *)protocol didReceiveAuthenticationChallenge:(NSURLAuthenticationChallenge *)challenge;

- (void)URLProtocol:(NSURLProtocol *)protocol didCancelAuthenticationChallenge:(NSURLAuthenticationChallenge *)challenge;

@end
```

那么该如何在拦截过程中处理重定向响应？我们尝试着每次收到响应时都调用 `didReceiveResponse:` 方法，发现中间的重定向响应都会被最后接收到的响应覆盖掉，这样则会导致 `WKWebView` 无法感知到重定向，从而不会改变地址等相关信息，对于一些有判断路由的页面可能会带来一些意想不到的影响。 此时我们再次陷入困境，可以看出 `WKURLSchemeHandler` 在获取数据时并不支持重定向，因为苹果当初设计的时候只是把它作为单纯的数据管理。其实每次响应我们都能拿到，只不过不能完整的传递给 `WKWebView` 而已。经过一番衡量，我们基于以下三点原因最终选择了重新加载的方式来解决 HTML 文档请求重定向的问题。

*   目前能修改的只有 `Fetch` 和 `XMLHttpRequest` 接口的实现，对于文档请求和 HTML 标签发起请求都是浏览器内部行为，修改源码成本太大。
*   `Fetch` 和 `XMLHttpRequest` 默认只会返回最终的响应，所以在服务端接口层面保证最终数据正确，丢失重定向响应影响不大。
*   图片 / 视频 / 表单 / 样式表 / 脚本等资源同理也一般只需关系最终的数据正确即可。

接收到 HTML 文档的重定向响应则直接返回给 `WKWebView` 并取消后续加载。而对于其它资源的重定向，则选择丢弃。

```objectivec
- (void)URLSession:(NSURLSession *)session task:(NSURLSessionTask *)task willPerformHTTPRedirection:(NSHTTPURLResponse *)response newRequest:(NSURLRequest *)request completionHandler:(void (^)(NSURLRequest * _Nullable))completionHandler {                  
  NSString *originUrl = task.originalRequest.URL.absoluteString;
  if ([originUrl isEqualToString:currentWebViewUrl]) {
    [urlSchemeTask didReceiveResponse:response];
    [urlSchemeTask didFinish];
    completionHandler(nil);
  }else {
    completionHandler(request);
  }
}
```

`WKWebView` 收到响应数据后会调用 `webView:decidePolicyForNavigationResponse:decisionHandler` 方法来决定最后的跳转，在该方法中可以拿到重定向的目标地址 Location 进行重新加载。

```objectivec
- (void)webView:(WKWebView *)webView decidePolicyForNavigationResponse:(WKNavigationResponse *)navigationResponse decisionHandler:(void (^)(WKNavigationResponsePolicy))decisionHandler
{
  // 开启了拦截
  if (enableNetworkIntercept) {
    if ([navigationResponse.response isKindOfClass:[NSHTTPURLResponse class]]) {
        NSHTTPURLResponse *httpResp = (NSHTTPURLResponse *)navigationResponse.response;
        NSInteger statusCode = httpResp.statusCode;
        NSString *redirectUrl = [httpResp.allHeaderFields stringForKey:@"Location"];
        if (statusCode >= 300 && statusCode < 400 && redirectUrl) {
            decisionHandler(WKNavigationActionPolicyCancel);
            // 不支持307、308post跳转情景
            [webView loadHTMLWithUrl:redirectUrl]; 
            return;
        }
    }
  }
  decisionHandler(WKNavigationResponsePolicyAllow);
}
```

至此 HTML 文档重定向问题基本上暂告一段落，到本文发布之前我们还未发现一些边界问题，当然如果大家还有其它好的想法也欢迎随时讨论。

#### Cookie 同步

由于 `WKWebView` 与我们的应用不是同一个进程所以 `WKWebView` 和 `NSHTTPCookieStorage` 并不同步。这里不展开讲 WKWebView Cookie 同步的整个过程，只重点讨论下拦截过程中的 Cookie 同步。由于请求最终是由原生应用发出的，所以 Cookie 读取和存储都是走 `NSHTTPCookieStorage`。值得注意的是，`WKURLSchemeHandler` 返回给 `WKWebView` 的响应中包含 `Set-Cookie` 信息，但是 WKWebView 并未设置到 `document.cookie` 上。在这里也可以佐证上文所述： `WKURLSchemeHandler` 只是负责数据管理，请求中涉及的逻辑需要开发者自行处理。

`WKWebView` 的 Cookie 同步可以通过 `WKHTTPCookieStore` 对象来实现

```objectivec
- (void)URLSession:(NSURLSession *)session dataTask:(NSURLSessionDataTask *)dataTask didReceiveResponse:(NSURLResponse *)response completionHandler:(void (^)(NSURLSessionResponseDisposition))completionHandler
{
  if ([response isKindOfClass:[NSHTTPURLResponse class]]) {
    NSHTTPURLResponse *httpResp = (NSHTTPURLResponse *)response;
    NSArray <NSHTTPCookie *>*responseCookies = [NSHTTPCookie cookiesWithResponseHeaderFields:[httpResp allHeaderFields] forURL:response.URL];
    if ([responseCookies isKindOfClass:[NSArray class]] && responseCookies.count > 0) {
        dispatch_async(dispatch_get_main_queue(), ^{
            [responseCookies enumerateObjectsUsingBlock:^(NSHTTPCookie * _Nonnull cookie, NSUInteger idx, BOOL * _Nonnull stop) {
                // 同步到WKWebView
                [[WKWebsiteDataStore defaultDataStore].httpCookieStore setCookie:cookie completionHandler:nil];
            }];
        });
    }
  }
  completionHandler(NSURLSessionResponseAllow);
}
```

拦截过程中除了把原生应用的 Cookie 同步到 `WKWebView`, 在修改 `document.cookie` 时也要同步到原生应用。经过尝试发现真机设备上 `document.cookie` 在修改后会主动延迟同步到 `NSHTTPCookieStorage` 中，但是模拟器并未做任何同步。对于一些修改完 `document.cookie` 就立刻发出去的请求可能不会立即带上改动的 Cookie 信息，因为拦截之后 `Cookie` 是走 `NSHTTPCookieStorage` 的。

我们的方案是修改 `document.cookie` setter 方法实现，在 Cookie 设置完成之前先同步到原生应用。注意原生应用此时需要做好跨域校验，防止恶意页面对 Cookie 进行任意修改。

```objectivec
(function() {
  var cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') || Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');
  if (cookieDescriptor && cookieDescriptor.configurable) {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      enumerable: true,
      set: function (val) {
        // 设置时先传递给原生应用才生效
        window.webkit.messageHandlers.save.postMessage(val);
        cookieDescriptor.set.call(document, val);
      },
      get: function () {
        return cookieDescriptor.get.call(document);
      }
    });
  }
})()
```

#### NSURLSession 导致的内存泄露

通过 `NSURLSession` 的 `sessionWithConfiguration:delegate:delegateQueue` 构造方法来创建对象时 delegate 是被 `NSURLSession` 强引用的，这一点大家比较容易忽视。我们会为每一个 `WKURLSchemeHandler` 对象创建一个 `NSURLSession` 对象然后将前者设置为后者的 delegate，这样就导致循环引用的产生。建议在 `WKWebView` 销毁时调用 `NSURLSession` 的 `invalidateAndCancel` 方法来解除对 `WKURLSchemeHandler` 对象的强引用。


## 稳定性提升

经过上文可以看出如果跟系统 “对着干”（`WKWebView` 本身就不支持 http/https 请求拦截），会有很多意想不到的事情发生，也可能有很多的边界地方需要覆盖，所以我们必须得有一套完善的措施来提升拦截过程中的稳定性。

### 动态下发

我们可以通过动态下发黑名单的方式来关掉一些页面的拦截。云音乐默认会预加载两个空 `WKWebView`，一个是注册了 `WKURLSchemeHandler` 的 `WKWebView` 来加载主站页面，并且支持黑名单关闭，另外一个则是普通的 `WKWebView` 来加载一些三方页面（因为三方页面的逻辑比较多样和复杂，而且我们也没有必要去拦截三方页面的请求）。除此之外对于一些刚开始尝试通过脚本注入来解决请求体丢失的团队，可能覆盖不了所有的场景，可以尝试动态下发的方式更新脚本，同样要对脚本内容做好签名防止别人恶意篡改。

### 监控

日志收集能帮助我们更好的去发现潜在的问题。拦截过程中所有的请求逻辑都统一收拢在 `WKURLSchemeHandler` 中，我们可以在一些关键链路上进行日志收集。比如可以收集注入的脚本是否执行异常、接收到 Body 是否丢失、返回的响应状态码是否正常等等。

### 完全代理请求

除上述措施外我们还可以将网络请求比如服务端 API 接口完全代理给客户端。前端只用将相应的参数通过 JSBridge 方式传递给原生应用然后通过原生应用的网络请求通道来获取数据。该方式除了能减少拦截过程中潜在问题的发生，还能复用原生应用的一些网络相关的能力比如 HTTP DNS、反作弊等。而且值得注意的是 iOS 14 苹果在 `WKWebView` 默认开启了 ITP (Intelligent Tracking Prevention) 智能防跟踪功能，受影响的地方主要是跨域 Cookie 和 Storage 等的使用。比如我们应用里有一些三方页面需要通过一个 `iframe` 内嵌我们的页面来达到授权能力，此时由于跨域默认是获取不到我们主站域名下的 Cookie， 如果走原生应用的代理请求就能解决类似的问题。最后再次提醒大家如果使用这种方式记得做好鉴权校验，防止一些恶意页面调用该能力，毕竟原生应用的请求是没有跨域限制的。

## 小结

本文将 iOS 原生 `WKURLSchemeHandler` 与 `JavaScript` 脚本注入结合在一起，实现了 `WKWebView` 在离线包加载、免流等业务中需要的请求拦截能力，解决了拦截过程中可能存在的重定向、请求体丢失、Cookie 不同步等问题并能以页面为维度进行拦截隔离。在探索过程中我们愈发的感受到技术是没有边界的，有时候可能由于平台的一些限制，单靠一方是无法实现一套完整的能力。只有将相关平台的技术能力结合在一起，才能制定出一套合理的技术方案。最后，本文是我们在 `WKWebView` 请求拦截的一些探索实践，如有错误欢迎指正与交流。

> 本文发布自 [网易云音乐大前端团队](https://github.com/x-orpheus)，文章未经授权禁止任何形式的转载。我们常年招收前端、iOS、Android，如果你准备换工作，又恰好喜欢云音乐，那就加入我们 grp.music-fe(at)corp.netease.com！
