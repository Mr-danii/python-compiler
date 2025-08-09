import { Channel } from "sync-message";
import * as Comlink from "comlink";
export declare class InterruptError extends Error {
    readonly type = "InterruptError";
    readonly name = "InterruptError";
}
export declare class NoChannelError extends Error {
    readonly type = "NoChannelError";
    readonly name = "NoChannelError";
}
export declare class SyncClient<T = any> {
    workerCreator: () => Worker;
    channel?: Channel | null;
    interrupter?: () => void;
    state: "idle" | "running" | "awaitingMessage" | "sleeping";
    worker: Worker;
    workerProxy: Comlink.Remote<T>;
    private _interruptRejector?;
    private _interruptPromise?;
    private _messageIdBase;
    private _messageIdSeq;
    private _awaitingMessageResolve?;
    constructor(workerCreator: () => Worker, channel?: Channel | null);
    interrupt(): Promise<void>;
    call(proxyMethod: any, ...args: any[]): Promise<any>;
    writeMessage(message: any): Promise<void>;
    terminate(): void;
    private _writeMessage;
    private _start;
    private _reset;
}
export interface SyncExtras {
    channel: Channel | null;
    readMessage: () => any;
    syncSleep: (ms: number) => void;
}
declare type SyncMessageCallbackStatus = "init" | "reading" | "sleeping" | "slept";
declare type SyncMessageCallback = (status: SyncMessageCallbackStatus) => void;
export declare function syncExpose<T extends any[], R>(func: (extras: SyncExtras, ...args: T) => R): (channel: Channel | null, syncMessageCallback: SyncMessageCallback, messageIdBase: string, ...args: T) => Promise<R>;
export {};
