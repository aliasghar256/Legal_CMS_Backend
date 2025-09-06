// Test the exact case code conversion that's happening in the controller
const testCaseCode = "503820265470N0620";
console.log("Original case code:", testCaseCode);
console.log("parseInt result:", parseInt(testCaseCode));
console.log("Type of parseInt result:", typeof parseInt(testCaseCode));

// Test with some other case codes that might conflict
const testCodes = [
    "503820265470N0620",
    "503820265470",
    "503820265470ABC123",
    "503820265470N0621"
];

console.log("\nTesting various case codes:");
testCodes.forEach(code => {
    const parsed = parseInt(code);
    console.log(`"${code}" -> ${parsed}`);
});

// The issue might be that different case codes with letters/suffixes 
// are getting converted to the same integer
console.log("\nPotential conflict scenario:");
console.log("Case A: '503820265470N0620' -> parseInt ->", parseInt("503820265470N0620"));
console.log("Case B: '503820265470ABC123' -> parseInt ->", parseInt("503820265470ABC123"));
console.log("Case C: '503820265470' -> parseInt ->", parseInt("503820265470"));
console.log("Are they all the same?", 
    parseInt("503820265470N0620") === parseInt("503820265470ABC123") && 
    parseInt("503820265470ABC123") === parseInt("503820265470")
);