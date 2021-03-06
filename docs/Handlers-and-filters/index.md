# http4js

### Table of Contents

- [Overview](/http4js/#basics)
- [Intro](/http4js/Intro/#intro)
- [Handlers and Filters](/http4js/Handlers-and-filters/#handlers-and-filters)
- [Request and Response API](/http4js/Request-and-response-api/#request-and-response-api)
- [URI API](/http4js/Uri-api/#uri-api)
- [In Memory Testing](/http4js/In-memory-testing/#in-memory-testing)
- [Approval testing with fakes](/http4js/Approval-testing-with-fakes/#approval-testing-with-fakes)
- [Express or Koa Backend](/http4js/Express-or-koa-backend/#express-or-koa-backend)
- [Proxy](/http4js/Proxy/#proxy)
- [Use in Javascript](/http4js/Use-in-javascript/#how-to-require-and-use-http4js-in-js)
- [Example App](https://github.com/TomShacham/http4js-eg)

# Handlers and Filters

Every route you specify in http4js has a handler attached to it. 
A handler is simply a function `(Request) => Promise<Response>`.

```typescript
get("/", 
    (req: Request) => Promise.resolve(new Response(200, "OK")) //handler
);
```

If we want to write a function that sees every incoming `Request` then we write a filter.
A filter is simply a function from `(HttpHandler) => HttpHandler` and an
`HttpHandler` is simply our function `(Request) => Promise<Response>`.

```typescript
get("/", 
    (req: Request) => Promise.resolve(new Response(200, "OK")) //handler
)
    .withFilter((handler: HttpHandler) => (req: Request) => {
        return handler(req).then(response => {
            if (response.status == 404) {
                return Promise.resolve(new Response(404, "Page not found"));
            } else {
                return response;
            }
        })
    })
```

The above example passes the request to the next handler and checks if the response status is 404, 
if it is then it will return a custom response: "Page not found".
 
If instead of doing something to the response we wanted to do something to the request we might write:

```typescript
get("/", 
    (req: Request) => Promise.resolve(new Response(200, "OK")) //handler
)
    .withFilter((handler: HttpHandler) => (req: Request) => {
        return handler(req.withHeader("Filter-header", "Tom was here"))
    })
```

which sets a header on every incoming `Request`.

# In built filters

We expose a few typically useful filters:

```typescript
static UPGRADE_TO_HTTPS: Filter = (handler: HttpHandler) => (req: Request) => {
    return handler(req.withUri(req.uri.withProtocol("https")));
};

static TIMING: Filter = (handler: HttpHandler) => (req: Request) => {
    const start = Date.now();
    return handler(req).then(response => {
        const total = Date.now() - start;
        return response.withHeader("Total-Time", total.toString())
    });
};

static DEBUG: Filter = (handler: HttpHandler) => (req: Request) => {
   const response = handler(req);
   return response.then(response => {
       console.log(`${req.method} to ${req.uri.href} with response ${response.status}`);
       return response;
   });
}
```

It can really aid debugging if we add the DEBUG filter to our routes. 

```typescript
return get("/hello", () => Promise.resolve(new Response(200, "Hello, world!")))
            .withFilter(Filters.TIMING)
            .withFilter(Filters.DEBUG);
```

Now we'll see output like this whenever a Request goes through our routes: 

```text
GET to /hello with response 200
```

And we can quickly uncover where there is an unexpected flow through our routes.

# Under the covers

The way that this hangs together behind the scenes is actually pretty simple.
If an incoming `Request` path matches a path in our `Routing` then we apply 
all of our filters to the `Request` with the `matchedHandler` taking the final `Request`
that comes through our reduction. If no `Routing` path matches then we do the same but
our final handler that receives `Request` will be the http4js default handler for "not found". 

```typescript
serve(request: Request): Promise<Response> {
    const matchedHandler = this.match(request);
    const filtered = this.filters.reduce((prev, next) => {
        return next(prev)
    }, matchedHandler.handler);
    request.pathParams = matchedHandler.path.includes("{")
        ? Uri.of(matchedHandler.path).extract(request.uri.path()).matches
        : {};
    return filtered(request);
}
```

As our filters have the signature `(HttpHandler) => HttpHandler` we can compose them

```typescript
this.filters.reduce((prev, next) => {
    return next(prev); //pass one filter to the next
}, matchedHandler.handler)
```

The first filter received the matchedHandler, producing an `HttpHander`:

```typescript
((HttpHandler) => HttpHandler)(HttpHandler) ==> HttpHandler
```

and finally we give this `HttpHandler` a `Request`

```typescript
return filtered(request);
```

which gives us our final value `Promise<Response>`.