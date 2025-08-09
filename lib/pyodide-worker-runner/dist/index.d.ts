import { SyncClient, SyncExtras } from "comsync";
import { PyodideInterface } from "pyodide";
export declare type PyodideLoader = () => Promise<PyodideInterface>;
export interface PackageOptions {
    url: string;
    format: string;
    extractDir?: string;
}
/**
 * Loads the Pyodide module from the official CDN as suggested in
 * https://pyodide.org/en/stable/usage/quickstart.html#setup.
 * To load a specific version, pass a string such as "1.2.3" as the argument.
 * By default, uses `pyodide.version`, i.e. the version you have installed from npm
 * as a peer dependency.
 */
export declare function defaultPyodideLoader(version?: string): Promise<PyodideInterface>;
/**
 * Converts a version string to an array of numbers,
 * e.g. "1.2.3" -> [1, 2, 3]
 */
export declare function versionInfo(version: string): number[];
/**
 * Loads Pyodide in parallel to downloading an archive with your own code and dependencies,
 * which it then unpacks into the virtual filesystem ready for you to import.
 *
 * This helps you to work with Python code normally with several `.py` files
 * instead of a giant string passed to Pyodide's `runPython`.
 * It also lets you start up more quickly instead of waiting for Pyodide to load
 * before calling `loadPackage` or `micropip.install`.
 *
 * The archive should contain your own Python files and any Python dependencies.
 * A simple way to gather Python dependencies into a folder is with `pip install -t <folder>`.
 * The location where the archive is extracted will be added to `sys.path` so it can be imported immediately,
 * e.g. with [`pyodide.pyimport`](https://pyodide.org/en/stable/usage/api/js-api.html#pyodide.pyimport).
 * There should be no top-level folder in the archive containing everything else,
 * or that's what you'll have to import.
 *
 * If you don't use `loadPyodideAndPackage` and just load Pyodide yourself,
 * then we recommend passing the resulting module object to `initPyodide` for some other housekeeping.
 *
 * Loading of both Pyodide and the package is retried up to 3 times in case of network errors.
 *
 * The raw contents of the package are cached in memory to avoid re-downloading in case of
 * a fatal error which requires reloading Pyodide.
 *
 * @param packageOptions Object which describes how to load the package file, with the following keys:
 *    - `url`: URL to fetch the package from.
 *    - `format`: File format which determines how to extract the archive.
 *                By default the options are 'bztar', 'gztar', 'tar', 'zip', and 'wheel'.
 *    - `extractDir`: Directory to extract the archive into. Defaults to /tmp/.
 * @param pyodideLoader Optional function which takes no arguments and returns the Pyodide module as returned by the
 *    [`loadPyodide`](https://pyodide.org/en/stable/usage/api/js-api.html#globalThis.loadPyodide) function.
 *    Defaults to `defaultPyodideLoader`which uses the
 *    [official CDN](https://pyodide.org/en/stable/usage/quickstart.html#setup).
 */
export declare function loadPyodideAndPackage(packageOptions: PackageOptions, pyodideLoader?: PyodideLoader): Promise<PyodideInterface>;
/**
 * Initializes the given Pyodide module with some extra functionality:
 *   - `pyodide.registerComlink(Comlink)` makes `Comlink` (and thus `comsync` and the `PyodideClient`) work better.
 *   - Imports the `pyodide_worker_runner` Python module included with this library, which:
 *     - Immediately calls `sys.setrecursionlimit` so that deep recursion causes a Python `RecursionError`
 *       instead of a fatal JS `RangeError: Maximum call stack size exceeded`.
 *     - Provides the `install_imports` function which allows automatically installing imported modules, similar to
 *       [`loadPackagesFromImports`](https://pyodide.org/en/stable/usage/api/js-api.html#pyodide.loadPackagesFromImports)
 *       but also loads packages which are not built into Pyodide but can be installed with `micropip`,
 *       i.e. pure Python packages with wheels available on PyPI.
 */
export declare function initPyodide(pyodide: PyodideInterface): void;
/**
 * See the description of output parts in
 * https://github.com/alexmojaki/python_runner#callback-events
 */
export interface OutputPart {
    type: string;
    text: string;
    [key: string]: unknown;
}
export interface RunnerCallbacks {
    input?: (prompt: string) => void;
    output: (parts: OutputPart[]) => unknown;
    other?: (type: string, data: unknown) => unknown;
}
/**
 * Construct a callback function which can be passed to `python_runner` to handle events.
 * See https://github.com/alexmojaki/python_runner#callback-events
 *
 * @param comsyncExtras
 *    In a web worker script, you need to pass a function to `pyodideExpose` from this library.
 *    That function will be passed `extras` as its first argument which can then be used here.
 *    `extras` is expected to contain a `channel` created by the `makeChannel` function from
 *    the [`sync-message`](https://github.com/alexmojaki/sync-message) library
 *    which was then passed to `PyodideClient` in the main thread.
 *    This enables synchronous communication between the main thread and the worker,
 *    which is used by the callback to handle `input` and `sleep` events properly.
 *    See https://github.com/alexmojaki/pyodide-worker-runner#comsync-integration for more info.
 * @param callbacks
 *    An object containing callback functions to handle the different event types.
 *      - `output`: Required. Called with an array of output parts,
 *         e.g. `[{type: "stdout", text: "Hello world"}]`.
 *         Use this to tell your UI to display the output.
 *      - `input`: Optional. Called when the Python code reads from `sys.stdin`, e.g. with `input()`.
 *         Use this to tell your UI to wait for the user to enter some text.
 *         The entered text should be passed to `PyodideClient.writeMessage()` in the main thread,
 *         and will be returned synchronously by this function to the Python code.
 *         When the Python code calls `input(prompt)`, the string `prompt` is passed to this callback.
 *         Two types of output part will also be passed to the `output` callback:
 *             - `input_prompt`: the prompt passed to the `input()` function.
 *               Using this output part may be a better way to display the prompt in the UI
 *               than the argument of the `input` callback, but the `input` callback is still needed
 *               even if it doesn't display the prompt.
 *              - `input`: the user's input passed to stdin.
 *                Not actually 'output', but included as an output part
 *                because it's typically shown in regular Python consoles.
 *      - `other`: Optional. Called for all other event types
 *        (except `sleep` which is handled directly by `makeRunnerCallback`).
 *        The actual event type is passed as the first argument.
 */
export declare function makeRunnerCallback(comsyncExtras: SyncExtras, callbacks: RunnerCallbacks): (type: string, data: any) => unknown;
export interface PyodideExtras extends SyncExtras {
    interruptBuffer: Int32Array | null;
}
/**
 * Call this in your web worker code with a function `func`
 * to allow it to be called from the main thread by `PyodideClient.call`.
 *
 * `func` will be called with an object `extras` of type `PyodideExtras` as its first argument.
 * The other arguments are those passed to `PyodideClient.call`,
 * and the return value is passed back to the main thread and returned from `PyodideClient.call`.
 *
 * `func` will be wrapped into a new function which is returned here.
 * The returned function should be passed to `Comlink.expose`, possibly as part of a larger object.
 *
 * For example, the worker code may look something like this:
 *
 *     Comlink.expose({
 *       myRunCode: pyodideExpose((extras, code) => {
 *         pyodide.runCode(code);
 *       }),
 *     });
 *
 * and the main thread code may look something like this:
 *
 *    await client.call(client.workerProxy.myRunCode, "print('Hello world')");
 *
 * It's recommended to pass `extras` to `makeRunnerCallback` and then pass the resulting callback
 * to a `python_runner.PyodideRunner` instead of calling `pyodide.runCode` directly.
 *
 * If possible, `extras.interruptBuffer` will be a `SharedArrayBuffer` which can be used like this:
 *
 *     if (extras.interruptBuffer) {
 *       pyodide.setInterruptBuffer(extras.interruptBuffer);
 *     }
 *
 * This will allow the main thread to call `PyodideClient.interrupt()`
 * to raise `KeyboardInterrupt` in Python code running in Pyodide in the worker thread.
 * `setInterruptBuffer` isn't called automatically so that you can choose the correct place to call it,
 * after running any Python code that musn't be interrupted.
 */
export declare function pyodideExpose<T extends any[], R>(func: (extras: PyodideExtras, ...args: T) => R): (channel: import("sync-message").Channel, syncMessageCallback: (status: "init" | "reading" | "sleeping" | "slept") => void, messageIdBase: string, interruptBuffer: Int32Array, ...args: T) => Promise<Promise<R>>;
/**
 * This class should be used in the main browser thread
 * to call functions exposed with `pyodideExpose` and `Comlink.expose` in a web worker.
 * See https://github.com/alexmojaki/comsync to learn how to use the base class `SyncClient`.
 * What this class adds is making it easier to interrupt Python code running in Pyodide in the worker.
 * Specifically, if `SharedArrayBuffer` is available, then `PyodideClient.call` will pass a buffer
 * so that the function passed to `pyodideExpose` can call `pyodide.setInterruptBuffer(extras.interruptBuffer)`
 * to enable interruption. Then `PyodideClient.interrupt()` will use the buffer.
 * Otherwise, `PyodideClient.interrupt()` will likely restart the web worker entirely, which is more disruptive.
 */
export declare class PyodideClient<T = any> extends SyncClient<T> {
    call(proxyMethod: any, ...args: any[]): Promise<any>;
}
/**
 * This class handles automatically reloading Pyodide from scratch when a fatal error occurs.
 * The constructor accepts a 'loader' function which should return a promise that resolves to a Pyodide module.
 * We recommend a function which calls `loadPyodideAndPackage`.
 * The loader function will be called immediately on construction.
 *
 * Code that uses the Pyodide module should be wrapped in a `withPyodide` call, e.g:
 *
 *    await pyodideFatalErrorReloader.withPyodide(async (pyodide) => {
 *      pyodide.runCode(...);
 *    });
 *
 * If a fatal error occurs, the loader function will be called again immediately to reload Pyodide in the background,
 * while the error is rethrown for you to handle.
 * The next call to `withPyodide` will then be able to use the new Pyodide instance.
 *
 * In general, `withPyodide` will wait for the loader function to complete, and will throw any errors it throws.
 */
export declare class PyodideFatalErrorReloader {
    private readonly loader;
    private pyodidePromise;
    constructor(loader: PyodideLoader);
    withPyodide<T>(fn: (pyodide: PyodideInterface) => Promise<T>): Promise<T>;
}
