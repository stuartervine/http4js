# http4js

A simple http library for typescript

## *** [read the docs](https://tomshacham.github.io/http4js/) ***

## Using in your project

### To install:

```
npm install --save http4js
#or
yarn add http4js
```


## Example

An example server and client

```typescript

//add csrf token header to every request and vary gzip to every response
const headerFilter = (handler: HttpHandler) => {
    return (req: Request) => {
        return handler(req.setHeader(Headers.X_CSRF_TOKEN, Math.random()))
            .then(response => response.setHeader(Headers.VARY, "gzip"));
    }
};

//define our server routes and start on port 3000
routes(Method.GET, ".*", (req: Request) => {
    const html = `<h1>${req.method} to ${req.uri.path()} with req headers ${Object.keys(req.headers)}</h1>`;
    return Promise.resolve(new Response(Status.OK, html));
})
    .withFilter(headerFilter)
    .asServer()
    .start();

//make an http request to our server and log the response
HttpClient(
    new Request(Method.GET, "http://localhost:3000/any/path")
).then(response => {
    console.log(response);
    console.log(response.bodyString());
});

/*
//response
Response {
    headers:
    { vary: 'gzip',
        date: 'Sun, 08 Apr 2018 08:26:20 GMT',
        connection: 'close',
        'transfer-encoding': 'chunked' },
    body:
        Body {
        bytes: <Buffer 3c 68 31 3e 47 45 54 20 74 6f 20 2f 61 6e 79 2f 70 61 74 68 20 77 69 74 68 20 72 65 71 20 68 65 61 64 65 72 73 20 68 6f 73 74 2c 63 6f 6e 6e 65 63 74 ... > },
    status: 200 }
    
//response.bodyString()
<h1>GET to /any/path with req headers host,connection,x-csrf-token</h1>

 */
```

## Contributing

I'd be very happy if you'd like to contribute :)

### To run:

```
git clone git@github.com:TomShacham/http4js.git  
cd http4js
yarn #or npm install
yarn start #or tsc; node index.js
```

#### To test:

```
yarn
yarn test
```

## History and Design

http4js is a port of [http4k](https://github.com/http4k/http4k).

The concept is called Server as a Function (SaaF).
