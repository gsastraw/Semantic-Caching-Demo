import express, { Request } from 'express';
import { ChatParams } from './models/types.js';
import { PromptService } from './services/prompt-service.js';

export default function app() {
    const promptService = new PromptService();
    const app = express();

    app.use(express.json());
    app.use(express.static('public'));

    app.get('/health', (_req, res) => {
        res.json({ ok: true });
    });

    app.post('/chat', async (req: Request<{}, {}, ChatParams>, res) => {
        const { message, history } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'message required'});
        }

        const result = await promptService.chat(message, history ?? []);

        return res.json(result);
    });

    app.delete('/cache', (_req, res) => {
        const deletedRecords = promptService.clearCache();

        return res.json({
            ok: true,
            deletedRecords,
        });
    });

    return app;
}
