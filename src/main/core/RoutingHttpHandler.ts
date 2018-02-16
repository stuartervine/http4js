import {Response} from "./Response";
import {Http4jsRequest, HttpHandler, Method} from "./HttpMessage";
import {Request} from "./Request";
import {Body} from "./Body";
import {Http4jsServer, Server} from "./Server";

interface RoutingHttpHandler {
    withFilter(filter: (HttpHandler) => HttpHandler): RoutingHttpHandler
    asServer(port: number): Http4jsServer
    match(request: Http4jsRequest): Response
}

export function routes(path: string, method: Method, handler: HttpHandler): ResourceRoutingHttpHandler {
    return new ResourceRoutingHttpHandler(path, method, handler);
}

export function getTo(path: string, handler: HttpHandler): ResourceRoutingHttpHandler {
    return new ResourceRoutingHttpHandler(path, Method.GET, handler);
}

export function postTo(path: string, handler: HttpHandler): ResourceRoutingHttpHandler {
    return new ResourceRoutingHttpHandler(path, Method.POST, handler);
}

export class ResourceRoutingHttpHandler implements RoutingHttpHandler {

    server: Http4jsServer;
    private path: string;
    private handler: HttpHandler;
    private handlers: object = {};
    private filters: Array<any> = [];

    constructor(path: string,
                method: Method,
                handler: HttpHandler) {
        this.path = path;
        this.handler = handler;
        this.handlers[path] = handler;
    }

    withRoutes(routes: ResourceRoutingHttpHandler): ResourceRoutingHttpHandler {
        for (let path of Object.keys(routes.handlers)) {
            let existingPath = this.path != "/" ? this.path : "";
            let nestedPath = existingPath + path;
            this.handlers[nestedPath] = routes.handlers[path]
        }
        return this;
    }

    withFilter(filter: (HttpHandler) => HttpHandler): RoutingHttpHandler {
        this.filters.push(filter);
        return this;
    }

    withHandler(path: string, handler: HttpHandler): RoutingHttpHandler {
        let existingPath = this.path != "/" ? this.path : "";
        let nestedPath = existingPath + path;
        this.handlers[nestedPath] = handler;
        return this;
    }

    asServer(port: number): Http4jsServer {
        this.server = new Server(port);
        this.server.server.on("request", (req, res) => {
            const {headers, method, url} = req;
            let chunks = [];
            req.on('error', (err) => {
                console.error(err);
            }).on('data', (chunk) => {
                chunks.push(chunk);
            }).on('end', () => {
                let response = this.createInMemResponse(chunks, method, url, headers);
                res.writeHead(response.status, response.headers);
                res.end(response.body.bytes);
            })
        });
        return this.server;
    }

    match(request: Http4jsRequest): Response {
        let incomingPath = this.path;
        let paths = Object.keys(this.handlers);
        let matchedPath = paths.find(path => {
            return request.uri.match(path)
        });
        if (matchedPath) {
            let handler = this.handlers[matchedPath];
            let filtered = this.filters.reduce((acc, next) => { return next(acc) }, handler);
            return filtered(request);
        } else {
            let notFoundBody = `${request.method} to ${request.uri.template} did not match route ${incomingPath}`;
            let body = new Body(notFoundBody);
            return new Response(404, body);
        }
    }

    private createInMemResponse(chunks: Array<any>, method: any, url: any, headers: any) {
        let body = new Body(Buffer.concat(chunks));
        let inMemRequest = new Request(method, url, body, headers);
        return this.match(inMemRequest);
    }

}

