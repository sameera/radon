import { setUpWorker, type WorkerCaches, type WorkerScope } from "./sw.ts";

declare const __CACHE_NAME__: string;
declare const self: WorkerScope;

setUpWorker(self, caches as unknown as WorkerCaches, (request: Request) => fetch(request), __CACHE_NAME__);
