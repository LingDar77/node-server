import { Writable } from 'stream';
import fs from 'fs/promises';
import zlib from 'zlib';
import LRUCache from './LRUCache';
import { Stats } from 'fs';

class FileRequester
{
    private MissionQueue = new Map<string, { target: Writable, gzip: boolean }[]>();
    private FileCache?: LRUCache<string, { content: Buffer, mtime: Date }>;
    constructor(private MaxLiseners: number, private EnableLog = false, private CacheNumber = 0)
    {
        if (this.CacheNumber) {
            this.FileCache = new LRUCache(this.CacheNumber);
        }
    }
    Request(path: string, target: Writable, status: Stats, gzip = false)
    {
        const items = this.MissionQueue.get(path);
        if (items) {
            //Already reading this file, try add it to task queue.
            if (items.length >= this.MaxLiseners) {
                //Already reached max request number for this file, delay this request
                setTimeout(() =>
                {
                    this.Request(path, target, status, gzip);
                }, 1024);
            }
            else {
                items.push({ target, gzip });
            }
        }
        else {
            //check if hit the cache
            const cache = this.FileCache?.Get(path);
            if (cache && status.mtime.getTime() == cache.mtime.getTime()) {
                //cache exists and not expired, handle the request immediately
                if (gzip) {
                    const gzip = zlib.createGzip();
                    gzip.pipe(target);
                    gzip.write(cache.content);
                    gzip.end();
                }
                else {
                    target.write(cache.content);
                    target.end();
                }
                if (this.EnableLog)
                    console.info(`Read from cache for ${path.split('/').pop()}`);
            }
            else {
                //Read file and handle all requests
                this.MissionQueue.set(path, [{ target, gzip }]);
                fs.readFile(path).then((buf) =>
                {
                    const missions = this.MissionQueue.get(path);
                    this.MissionQueue.delete(path);
                    if (missions)
                        for (const mission of missions) {
                            if (mission.gzip) {
                                const gzip = zlib.createGzip();
                                gzip.pipe(mission.target);
                                gzip.write(buf);
                                gzip.end();
                            }
                            else {
                                mission.target.write(buf);
                                mission.target.end();
                            }
                        }
                    if (this.EnableLog)
                        console.info(`Handled ${missions?.length} request(s) for ${path.split('/').pop()}`);

                    this.FileCache?.Set(path, { content: buf, mtime: status.mtime });

                });
            }
        }
    }
}

export default { ...fs, FileRequester };