import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testNames = [
    "kunxxal",
    "forooghnch",
    "Max Krefting",
    "Baringa Early Careers",
    "Shola Adesina",
    "Marlow Energy",
    "Quinn QQ",
    "Oxford Encounters",
    "Silajit Chakraborty",
    "Alexandra Queirós"
];

function classifyNames(names) {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python', [path.join(__dirname, 'inference.py')]);
        
        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python process exited with code ${code}. Error: ${errorOutput}`));
                return;
            }
            try {
                const jsonMatch = output.match(/\[.*\]/s);
                if (jsonMatch) {
                    resolve(JSON.parse(jsonMatch[0]));
                } else {
                    reject(new Error("Could not find JSON in Python output"));
                }
            } catch (e) {
                reject(new Error(`Failed to parse Python output: ${e.message}. Raw output: ${output}`));
            }
        });

        pythonProcess.stdin.write(JSON.stringify(names));
        pythonProcess.stdin.end();
    });
}

async function runTest() {
    console.log("🚀 Starting Entity Classifier Test...");
    try {
        const results = await classifyNames(testNames);
        console.log("\nClassification Results:");
        console.table(results);
        
        const peopleCount = results.filter(r => r.label === 'person').length;
        const entityCount = results.filter(r => r.label === 'not_person').length;
        
        console.log(`\nSummary: ${peopleCount} People, ${entityCount} Entities detected.`);
    } catch (error) {
        console.error("❌ Test failed:", error.message);
        console.log("\nTip: Make sure your mvpenv is activated so 'python' points to the right environment.");
    }
}

runTest();
