// Working Python Worker using npm modules with comsync
console.log('Working worker starting...');

// Import the libraries we installed via npm
importScripts('https://mr-danii.github.io/python-compiler/node_modules/comlink/dist/umd/comlink.js');
importScripts('https://mr-danii.github.io/python-compiler/node_modules/sync-message/dist/index.js');
importScripts('https://mr-danii.github.io/python-compiler/node_modules/comsync/dist/index.js');
importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.1/full/pyodide.js');

console.log('Comsync libraries loaded in worker');

let pyodide = null;
let inputResolver = null;

// Initialize Pyodide with proper input handling and output redirection
async function initPyodide() {
    if (pyodide) return pyodide;
    
    console.log('Loading Pyodide in worker...');
    pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.1/full/",
        stdout: (text) => {
            // Filter out unwanted system messages at the source
            const unwantedMessages = [
                'Loading micropip',
                'Loaded micropip',
                'Synchronous input function set up',
                'Using direct Pyodide approach for input handling'
            ];
            
            // Skip unwanted messages and empty text
            if (unwantedMessages.some(msg => text.includes(msg)) || !text.trim()) {
                return;
            }
            
            // Send stdout to main thread for terminal display
            self.postMessage({
                type: 'python_output',
                data: { type: 'stdout', text: text }
            });
        },
        stderr: (text) => {
            // Skip empty stderr messages
            if (!text.trim()) {
                return;
            }
            
            // Send stderr to main thread for terminal display
            self.postMessage({
                type: 'python_output',
                data: { type: 'stderr', text: text }
            });
        }
    });
    
    // Install micropip first (suppress loading messages)
    await pyodide.loadPackage("micropip");
    
    // Skip python_runner for now - use direct Pyodide approach
    console.log("Using direct Pyodide approach for input handling");
    
    console.log('Pyodide and python_runner loaded successfully');
    return pyodide;
}

// Handle input requests from Python
function handleInput(prompt) {
    return new Promise((resolve) => {
        inputResolver = resolve;
        // Send input request to main thread
        self.postMessage({
            type: 'input_request',
            prompt: prompt
        });
    });
}

// Set up synchronous input handling using comsync
function setupInputHandling(channel) {
    // Override Python's input function to use synchronous communication
    pyodide.runPython(`
        import builtins
        
        def custom_input(prompt=""):
            # Use synchronous input function (no debug prints)
            return js_get_sync_input(prompt)
        
        # Replace built-in input
        builtins.input = custom_input
    `);
    
    // Expose the synchronous input function to Python
    pyodide.globals.set("js_get_sync_input", (prompt) => {
        console.log('Requesting synchronous input for:', prompt);
        
        // Generate a unique message ID
        const messageId = `input_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Send input request to main thread with the message ID
        self.postMessage({
            type: 'input_request',
            data: { 
                prompt: prompt,
                messageId: messageId
            }
        });
        
        // Use comsync to read message synchronously
        const { readMessage } = self.syncMessage;
        
        // Wait synchronously for the response
        try {
            console.log('Waiting for synchronous input with ID:', messageId);
            const response = readMessage(channel, messageId, { timeout: 30000 });
            console.log('Received synchronous input:', response);
            return response || "no_input";
        } catch (error) {
            console.error('Error reading synchronous input:', error);
            return "timeout_or_error";
        }
    });
}

// Expose functions to Python
function exposeFunctionsToPython(inputCallback, outputCallback) {
    // Expose input handler
    pyodide.globals.set("js_handle_input", (prompt) => {
        inputCallback(prompt);
        // Return a placeholder - the real input will come via message
        return "WAITING_FOR_INPUT";
    });
    
    // Expose output handler
    pyodide.globals.set("js_handle_output", (parts) => {
        // Convert Python list to JavaScript array
        const jsParts = parts.toJs();
        outputCallback(jsParts);
    });
    
    // Expose other event handler
    pyodide.globals.set("js_handle_other", (eventType, data) => {
        console.log('Other event:', eventType, data);
    });
}

// Main execution function
async function runPythonCode(code, channel) {
    try {
        if (!pyodide) {
            await initPyodide();
        }
        
        // Set up the input handling with channel
        setupInputHandling(channel);
        
        // Execute the code directly (simplified approach)
        pyodide.runPython(code);
        
        return 'success';
        
    } catch (error) {
        console.error('Python execution error:', error);
        throw error;
    }
}

// Handle messages from main thread
self.onmessage = async function(e) {
    const { type, data } = e.data;
    
    if (type === 'init') {
        try {
            await initPyodide();
            self.postMessage({ type: 'init_complete' });
        } catch (error) {
            self.postMessage({ 
                type: 'error', 
                error: error.message 
            });
        }
    }
    
    else if (type === 'run_code') {
        try {
            const { code, channel } = data;
            
            await runPythonCode(code, channel);
            
            self.postMessage({
                type: 'execution_complete'
            });
            
        } catch (error) {
            // Log the full error (same as what appears in console)
            console.error('Execution error details:', error);
            
            // Extract comprehensive error information
            let fullError = 'Unknown execution error';
            
            if (error) {
                // Try multiple ways to get the full error details
                fullError = error.toString() || 
                           error.message || 
                           (error.name && error.message ? `${error.name}: ${error.message}` : '') ||
                           JSON.stringify(error) ||
                           'Unknown execution error';
            }
            
            console.log('Sending error to main thread:', fullError);
            
            self.postMessage({
                type: 'execution_error',
                data: {
                    error: fullError
                }
            });
        }
    }
    
    else if (type === 'input_response') {
        if (inputResolver) {
            inputResolver(data.value);
            inputResolver = null;
        }
    }
    
    else if (type === 'install_library') {
        try {
            const { packageName } = data;
            console.log(`Installing library: ${packageName}`);
            
            // Initialize Pyodide if not already done
            if (!pyodide) {
                await initPyodide();
            }
            
            // Install the package using Pyodide
            await pyodide.loadPackage([packageName]);
            
            console.log(`Library ${packageName} installed successfully`);
            
            // Send success message
            self.postMessage({
                type: 'library_installed',
                data: { packageName: packageName }
            });
            
        } catch (error) {
            console.error(`Failed to install library:`, error);
            
            // Send error message
            self.postMessage({
                type: 'library_install_error',
                error: error.message
            });
        }
    }
};

console.log('Working worker ready');