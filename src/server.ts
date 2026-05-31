import app from "./app.js";
import { config } from "./config.js";

const server = app();

export function startServer() {
    return server.listen(config.port, () => {
        console.log('App listening on port ' + config.port);
    });
}
