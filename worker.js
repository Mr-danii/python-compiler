// Python Execution Worker using pyodide-worker-runner
console.log('Worker starting...');

// Import the libraries
importScripts('http://68.183.142.239/python-compiler/node_modules/comlink/dist/umd/comlink.js');
importScripts('http://68.183.142.239/python-compiler/node_modules/comsync/dist/index.js');
importScripts('http://68.183.142.239/python-compiler/node_modules/sync-message/dist/index.js');
importScripts('http://68.183.142.239/python-compiler/node_modules/pyodide-worker-runner/dist/index.js');
importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.1/full/pyodide.js');

console.log('Worker scripts loaded');

// Get the libraries from global scope
const { PyodideFatalErrorReloader, loadPyodideAndPackage, pyodideExpose, makeRunnerCallback } = self['pyodide-worker-runner'];

// Initialize Pyodide with automatic reloading on fatal errors
const reloader = new PyodideFatalErrorReloader(async () => {
    console.log('Loading Pyodide in worker...');

    // Load Pyodide
    const pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.1/full/"
    });

    // Initialize with pyodide-worker-runner helpers
    const { initPyodide } = self['pyodide-worker-runner'];
    initPyodide(pyodide);

    // Install python_runner for proper input handling
    await pyodide.loadPackage("micropip");
    
    // Install python_runner using micropip directly (avoid Python await syntax)
    await pyodide.runPython(`
        import micropip
        import asyncio
        
        async def install_python_runner():
            await micropip.install("python_runner")
        
        # Run the async function
        asyncio.create_task(install_python_runner())
    `);

    console.log('Pyodide loaded successfully in worker');
    return pyodide;
});

// Make sure Comlink is available globally for pyodide-worker-runner
self.Comlink = Comlink;
console.log('Worker: Comlink available:', !!Comlink);
console.log('Worker: Comlink.wrap available:', !!Comlink?.wrap);

// Expose the Python execution function
Comlink.expose({
    runPython: pyodideExpose(async (extras, code, inputCallback, outputCallback) => {
        console.log('Executing Python code in worker:', code.substring(0, 50) + '...');

        // Create callback for handling input/output events
        const callback = makeRunnerCallback(extras, {
            input: inputCallback,
            output: outputCallback,
            other: (type, data) => {
                console.log('Other event:', type, data);
                return `${type}-${JSON.stringify(data)}`;
            }
        });

        return await reloader.withPyodide(async (pyodide) => {
            // Get the Python runner
            const runner = pyodide.pyimport('python_runner').PyodideRunner();
            runner.set_callback(callback);

            // Set up interrupt buffer if available
            if (extras.interruptBuffer) {
                pyodide.setInterruptBuffer(extras.interruptBuffer);
            }

            // Auto-install any missing packages
            await pyodide.pyimport('pyodide_worker_runner').install_imports(
                code,
                (eventType, data) => {
                    const eventData = data.toJs ? data.toJs({ dict_converter: Object.fromEntries }) : data;
                    outputCallback([{
                        type: eventType,
                        text: JSON.stringify(eventData)
                    }]);
                }
            );

            // Execute the Python code
            runner.run(code);

            return 'success';
        });
    })
});

console.log('Python worker initialized and ready');