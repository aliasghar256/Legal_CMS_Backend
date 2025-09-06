// Test parseInt behavior with the case code
const caseCode = "503820265470N0620";
const parsedCaseCode = parseInt(caseCode);

console.log("Original case code:", caseCode);
console.log("Parsed case code:", parsedCaseCode);
console.log("Are they equal?", caseCode == parsedCaseCode);

// Check what happens when we search for the parsed value
const Case = require('./models/Case');

async function testParsedSearch() {
    try {
        console.log(`\nSearching for parsed case code: ${parsedCaseCode}`);
        const existingCase = await Case.findByCfmsCaseCode(parsedCaseCode);
        
        if (existingCase) {
            console.log('Found existing case with parsed code:');
            console.log(JSON.stringify(existingCase, null, 2));
        } else {
            console.log('No existing case found with parsed code');
        }
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

testParsedSearch();