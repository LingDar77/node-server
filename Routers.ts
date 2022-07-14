import express, { Request } from 'express';
import busboy from 'busboy';
import crypto from 'crypto';
import fs from './FileSystem';
import { gzip } from 'zlib';

export interface IStaticRouterConfig
{
    EnableCache?: boolean,
    GzipSuffix?: Array<string>
}

interface files
{
    [key: string]: string | Buffer,
}
interface fields
{
    [key: string]: string | number | boolean
}

export interface UploadResquest extends Request
{
    files?: files,
    fields?: fields;
}

export interface FileSystemConfig
{
    EnableLog: boolean,
    MaxLiseners: number
}

export function StaticRouter(staticDir: string, config: IStaticRouterConfig, filesysConfig: FileSystemConfig)
{
    const router = express.Router();
    const fileRequester = new fs.FileRequester(filesysConfig.MaxLiseners, filesysConfig.EnableLog, 32);
    const GzipSuffix = new Map<string, boolean>();
    if (config.GzipSuffix) {
        for (const val of config.GzipSuffix) {
            GzipSuffix.set(val, true);
        }
    }
    router.get('/*', (req, res, next) =>
    {
        let reqPath = req.path;
        if (req.path == '/' || !req.path.includes('.')) {
            //the request maybe not a file, try to redirct to index
            reqPath = '/index.html';
        }
        fs.stat(staticDir + reqPath).then((status) =>
        {
            if (config.EnableCache) {
                const lastTime = req.get('if-modified-since');
                const mtime = status.mtime.getTime();
                if (!lastTime || parseInt(lastTime) != mtime) {
                    //the first request, bring with modify time
                    //or the file has been modified, send the latest version
                    res.setHeader('last-modified', mtime);
                }
                else {
                    //the file has not been modified, send 304
                    res.status(304);
                    return res.end();
                }
            }
            let enableGzip = false;
            if (config.GzipSuffix) {
                const suffix = reqPath.split('.').pop();
                if (suffix)
                    enableGzip = GzipSuffix.get(suffix) ?? false;
            }
            if (enableGzip)
                res.setHeader('content-encoding', 'gzip');
            fileRequester.Request(staticDir + reqPath, res, status, enableGzip);
        }).catch(() => { next(); });
    });
    return router;
}

export function UploadRouter(cachePath?: string)
{
    const router = express.Router();

    router.post('', (req: UploadResquest, res, next) =>
    {
        const bb = busboy({ headers: req.headers });
        bb.on('file', (fileName, fileStream, info) =>
        {
            info.filename = Buffer.from(info.filename, 'ascii').toString('utf-8');

            if (cachePath) {
                const path = cachePath + '/' + crypto.randomUUID() + '.' + info.filename;
                fs.open(path, 'w').then((file) =>
                {
                    fileStream.on('data', (data: Buffer) =>
                    {
                        file.write(data);
                    });
                    fileStream.on('end', async () =>
                    {
                        if (!req.files)
                            req.files = {};
                        req.files[info.filename] = path;
                        await file.close();
                    }).on('error', async error =>
                    {
                        console.warn(error);
                        await file.close();
                    });
                });
            }
            else {
                let buf = Buffer.from([]);
                fileStream.on('data', (data: Buffer) =>
                {
                    buf = Buffer.concat([buf, data]);
                }).on('end', () =>
                {
                    if (!req.files)
                        req.files = {};
                    req.files[info.filename] = buf;
                }).on('error', error =>
                {
                    console.warn(error);
                });

            }
        });
        bb.on('field', (fieldName, value) =>
        {
            if (!req.fields) {
                req.fields = {};
            }
            req.fields[fieldName] = value;
        });
        bb.on('finish', () =>
        {
            next();
        });
        req.pipe(bb);

    });

    return router;
}
