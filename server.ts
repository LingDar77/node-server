import express from 'express';
import { UploadRouter, StaticRouter, FileSystemConfig, IStaticRouterConfig, UploadResquest } from './Routers';
import cors from 'cors';
import fs from './FileSystem';

interface IServerConfig
{
    StaticDir: string,
    DataDir: string,
    CacheDir: string,
    ClearCache: boolean,
    Port: number,
    FileSystemConfig: FileSystemConfig
    RouterConfig: {
        StaticRouterConfig: IStaticRouterConfig,
    }
}

fs.readFile('./ServerConfig.json').then(async (data) =>
{
    const config = JSON.parse(data.toString()) as IServerConfig;
    {//process args
        // console.log(process.argv);
        for (let item of process.argv) {
            item = item.toLocaleLowerCase();
            if (item === '--log') {
                config.FileSystemConfig.EnableLog = true;
            }
            else if (item === '--cache') {
                config.RouterConfig.StaticRouterConfig.EnableCache = true;
            }
            else if (item.startsWith('--port')) {
                config.Port = parseInt(item.split('=').pop() as string);
            }
            else if (item.startsWith('--max')) {
                config.FileSystemConfig.MaxLiseners = parseInt(item.split('=').pop() as string);
            }
        }


        fs.opendir(config.DataDir)
            .catch(async () => await fs.mkdir(config.DataDir))
            .then(file => file?.closeSync());
        fs.opendir(config.StaticDir)
            .catch(async () => await fs.mkdir(config.StaticDir))
            .then(file => file?.closeSync());
        fs.opendir(config.CacheDir)
            .catch(async () => await fs.mkdir(config.CacheDir))
            .then(file => file?.closeSync());
    }

    const app = express();

    app.use(cors({ methods: ['GET', 'POST'], origin: '*' }));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));


    app.use('/api/test', await UploadRouter(config.CacheDir));
    app.post('/api/test', async (req: UploadResquest, res) =>
    {
        console.log(req.files, req.fields);
        res.writeHead(303, { Connection: 'close', Location: '/' });
        res.end();
    });

    app.use(await StaticRouter(config.StaticDir, config.RouterConfig.StaticRouterConfig, config.FileSystemConfig));
    app.use(await StaticRouter(config.DataDir, config.RouterConfig.StaticRouterConfig, config.FileSystemConfig));

    const server = app.listen(config.Port, () =>
    {
        console.info(`Server started running at : http://localhost:${config.Port}`);
    });

    process.on('SIGINT', async () =>
    {
        server.close();
        if (config.ClearCache) {

            const dir = await fs.opendir(config.CacheDir);
            if (dir) {
                await fs.rm(config.CacheDir, { recursive: true });
                dir.closeSync();
            }
        }
        process.exit();

    });
});



