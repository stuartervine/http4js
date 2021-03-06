import {Response} from "./Response";
import {HttpHandler} from "./HttpMessage";
import {Request} from "./Request";
import {Body} from "./Body";
import {Uri} from "./Uri";
import {Filter} from "./Filters";
import {Http4jsServer} from "../servers/Server";
import {NativeServer} from "../servers/NativeServer";

export interface RoutingHttpHandler {
    withFilter(filter: (HttpHandler) => HttpHandler): RoutingHttpHandler
    asServer(server: Http4jsServer): Http4jsServer
    serve(request: Request): Promise<Response>
}

export type MountedHttpHandler = {path: string, verb: string, handler: HttpHandler}

export class Routing implements RoutingHttpHandler {

    server: Http4jsServer;
    private root: string;
    private handlers: MountedHttpHandler[] = [];
    private filters: Array<(HttpHandler) => HttpHandler> = [];

    constructor(path: string,
                method: string,
                handler: HttpHandler) {
        this.root = path;
        this.handlers.push({path: path, verb: method, handler: handler});
    }

    withRoutes(routes: Routing): Routing {
        this.handlers = this.handlers.concat(routes.handlers);
        return this;
    }

    withFilter(filter: Filter): Routing {
        this.filters.push(filter);
        return this;
    }

    withHandler(path: string, method: string, handler: HttpHandler): Routing {
        const existingPath = this.root != "/" ? this.root : "";
        const nestedPath = existingPath + path;
        this.handlers.push({path: nestedPath, verb: method, handler: handler});
        return this;
    }

    asServer(server: Http4jsServer = new NativeServer(3000)): Http4jsServer {
        this.server = server;
        server.registerCatchAllHandler(this);
        return this.server;
    }

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

    match(request: Request): MountedHttpHandler {
        const exactMatch = this.handlers.find(it => {
            return request.uri.exactMatch(it.path) && request.method.match(it.verb) != null;
        });
        const fuzzyMatch = this.handlers.find(it => {
            if (it.path == "/") return false;
            return it.path.includes("{")
                && Uri.of(it.path).templateMatch(request.uri.path())
                && request.method.match(it.verb) != null;
        });
        return exactMatch || fuzzyMatch || this.mountedNotFoundHandler;
    }

    private mountedNotFoundHandler: MountedHttpHandler = {
        path: ".*",
        verb: ".*",
        handler: (request: Request) => {
            const notFoundBodystring = `${request.method} to ${request.uri.path()} did not match routes`;
            return Promise.resolve(new Response(404, notFoundBodystring));
        }
    }

}

export function routes(method: string, path: string, handler: HttpHandler): Routing {
    return new Routing(path, method, handler);
}

export function get(path: string, handler: HttpHandler): Routing {
    return new Routing(path, "GET", handler);
}

export function post(path: string, handler: HttpHandler): Routing {
    return new Routing(path, "POST", handler);
}

export function put(path: string, handler: HttpHandler): Routing {
    return new Routing(path, "PUT", handler);
}

export function patch(path: string, handler: HttpHandler): Routing {
    return new Routing(path, "PATCH", handler);
}
