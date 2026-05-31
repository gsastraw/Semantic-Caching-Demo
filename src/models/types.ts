import { ChatTurn } from "./cache.js";

export interface ChatParams {
    message?: string,
    history: ChatTurn[]
};