// Simplified Python Worker without complex dependencies
console.log('Simple worker starting...');

// Load only Pyodide
importScripts('https://cdn.jsdelivr.net/pyodide/v0.28.1/full/pyodide.js');

let pyodide = null;
let inputResolver = null;

// Initialize Pyodide
async function initPyodide() {
    if (pyodide) return pyodide;
    
    console.log('Loading Pyodide...');
    pyodide = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.1/full/"
    });
    
    // Setup custom input handling
    pyodide.globals.set("js_get_input", getInput);
    
    // Override Python's input function
    await pyodide.runPython(`
import builtins
import js

def custom_input(prompt=""):
    # Send prompt to main thread and wait for response
    return js.js_get_input(prompt)

# Replace built-in input
builtins.input = custom_input
    `);
    
    console.log('Pyodide loaded and configured');
    return pyodide;
}

// Handle input requests
function getInput(prompt) {
    return new Promise((resolve) => {
        inputResolver = resolve;
        // Send input request to main thread
        self.postMessage({
            type: 'input_request',
            prompt: prompt
        });
    });
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
            if (!pyodide) {
                await initPyodide();
            }
            
            // Capture output
            let output = '';
            pyodide.runPython(`
import sys
from io import StringIO

# Capture stdout
old_stdout = sys.stdout
sys.stdout = captured_output = StringIO()
            `);
            
            // Run the user code
            await pyodide.runPythonAsync(data.code);
            
            // Get captured output
            output = pyodide.runPython(`
captured_output.getvalue()
            `);
            
            // Restore stdout
            pyodide.runPython(`
sys.stdout = old_stdout
            `);
            
            self.postMessage({
                type: 'execution_complete',
                output: output
            });
            
        } catch (error) {
            self.postMessage({
                type: 'execution_error',
                error: error.message
            });
        }
    }
    
    else if (type === 'input_response') {
        if (inputResolver) {
            inputResolver(data.value);
            inputResolver = null;
        }
    }
};

console.log('Simple worker ready');