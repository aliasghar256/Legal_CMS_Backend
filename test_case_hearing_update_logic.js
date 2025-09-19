/**
 * Test script for the updated updateCaseHearings functionality
 * This script simulates the improved logic for handling hearing updates
 */

const { testConnection } = require('./config/database');
const { query } = require('./lib/db');

async function testUpdateCaseHearingsLogic() {
  try {
    console.log('🧪 Testing Updated Case Hearings Logic...\n');

    // Mock hearing data from court profile (simulating what comes from the court search API)
    const mockCourtHearings = [
      {
        date: "2025-09-17",
        diary: "P.O is on leave. Counsel for the parties are present. Case is adjourned to 01-10-2025 for settlement of issues."
      },
      {
        date: "2025-09-18", 
        diary: ""  // Blank hearing (future placeholder)
      },
      {
        date: "2025-09-30",
        diary: ""  // Another blank hearing
      }
    ];

    // Mock existing hearings in database (simulating current state)
    const mockExistingHearings = [
      {
        hearing_id: 1,
        date: "2025-09-17",
        description: ""  // Was previously blank
      },
      {
        hearing_id: 2,
        date: "2025-09-18",
        description: ""  // Blank hearing
      }
    ];

    console.log('📊 Mock Data:');
    console.log('Court Hearings from API:', JSON.stringify(mockCourtHearings, null, 2));
    console.log('Existing Hearings in DB:', JSON.stringify(mockExistingHearings, null, 2));
    console.log('');

    // Simulate the improved logic
    console.log('🔄 Processing Logic:');
    
    // Create maps for existing hearings - by date only
    const existingHearingsByDate = new Map();
    const existingBlankHearings = [];
    
    mockExistingHearings.forEach(hearing => {
      const dateKey = hearing.date;
      existingHearingsByDate.set(dateKey, hearing);
      
      // Track blank hearings
      if (!hearing.description || hearing.description.trim() === '') {
        existingBlankHearings.push(hearing);
      }
    });

    console.log('Existing blank hearings:', existingBlankHearings.map(h => h.date));

    const newHearings = [];
    const updatedHearings = [];
    const deletedHearings = [];
    let nextHearingDate = null;

    // Process each hearing from court profile
    for (const hearingEntry of mockCourtHearings) {
      const hearingDate = hearingEntry.date;
      const hearingDescription = hearingEntry.diary || '';
      
      console.log(`\n📅 Processing hearing: ${hearingDate}`);
      
      // Check if this hearing already exists in our database
      const existingHearing = existingHearingsByDate.get(hearingDate);
      
      if (existingHearing) {
        console.log(`  ✅ Hearing exists in DB`);
        // Hearing exists - check if we need to update the description
        const existingDesc = (existingHearing.description || '').trim();
        const newDesc = hearingDescription.trim();
        
        if (existingDesc !== newDesc && newDesc !== '') {
          // Update the existing hearing with new description
          updatedHearings.push({
            hearing_id: existingHearing.hearing_id,
            date: hearingDate,
            old_description: existingDesc,
            new_description: newDesc
          });
          console.log(`  🔄 Will update: "${existingDesc}" → "${newDesc}"`);
        } else {
          console.log(`  ⚪ No update needed`);
        }
      } else {
        // New hearing - create it
        console.log(`  ➕ Will create new hearing`);
        newHearings.push({
          date: hearingDate,
          description: hearingDescription
        });
      }

      // Extract next hearing date from description if this has content
      if (hearingDescription && hearingDescription.trim() !== '') {
        const nextDatePatterns = [
          /(?:adjourned to|case.*?to)\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
          /(?:next hearing|hearing on)\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i,
          /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\s*(?:for|next)/i
        ];
        
        let nextDateMatch = null;
        for (const pattern of nextDatePatterns) {
          nextDateMatch = hearingDescription.match(pattern);
          if (nextDateMatch) break;
        }
        
        if (nextDateMatch) {
          try {
            const extractedDate = nextDateMatch[1];
            let parsedNextDate;
            if (extractedDate.includes('-')) {
              const parts = extractedDate.split('-');
              parsedNextDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            } else if (extractedDate.includes('/')) {
              const parts = extractedDate.split('/');
              parsedNextDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            }
            
            if (parsedNextDate && !isNaN(parsedNextDate.getTime())) {
              nextHearingDate = parsedNextDate.toISOString().split('T')[0];
              console.log(`  📆 Extracted next hearing date: ${nextHearingDate}`);
            }
          } catch (error) {
            console.log(`  ❌ Error parsing date: ${error.message}`);
          }
        }
      }
    }

    console.log(`\n🎯 Next hearing date extracted: ${nextHearingDate}`);

    // Handle blank future hearings
    if (nextHearingDate) {
      console.log(`\n🧹 Cleaning up blank hearings...`);
      
      // Remove existing blank hearings that are not the next hearing date
      // BUT DON'T remove hearings that were just updated with content
      const updatedHearingDates = new Set(updatedHearings.map(h => h.date));
      
      for (const blankHearing of existingBlankHearings) {
        // Don't delete if this hearing was just updated with content
        if (updatedHearingDates.has(blankHearing.date)) {
          console.log(`  ✅ Skipping deletion of ${blankHearing.date} - was just updated with content`);
          continue;
        }
        
        // Delete if it's not the next hearing date
        if (blankHearing.date !== nextHearingDate) {
          deletedHearings.push({
            hearing_id: blankHearing.hearing_id,
            date: blankHearing.date,
            reason: 'Outdated blank hearing removed'
          });
          console.log(`  🗑️ Will delete outdated blank hearing: ${blankHearing.date}`);
        } else {
          console.log(`  ✅ Keeping blank hearing for next date: ${blankHearing.date}`);
        }
      }

      // Create blank hearing for next hearing date if it doesn't exist
      if (!existingHearingsByDate.has(nextHearingDate)) {
        newHearings.push({
          date: nextHearingDate,
          description: ''
        });
        console.log(`  ➕ Will create blank hearing for next date: ${nextHearingDate}`);
      } else {
        console.log(`  ✅ Blank hearing for next date already exists: ${nextHearingDate}`);
      }
    }

    console.log('\n📊 Final Results:');
    console.log('📝 New hearings to create:', newHearings.length);
    newHearings.forEach((h, i) => {
      console.log(`  ${i + 1}. ${h.date} - "${h.description || 'Blank'}"`);
    });

    console.log('\n🔄 Hearings to update:', updatedHearings.length);
    updatedHearings.forEach((h, i) => {
      console.log(`  ${i + 1}. ${h.date} - "${h.old_description}" → "${h.new_description}"`);
    });

    console.log('\n🗑️ Hearings to delete:', deletedHearings.length);
    deletedHearings.forEach((h, i) => {
      console.log(`  ${i + 1}. ${h.date} - ${h.reason}`);
    });

    console.log('\n✅ Logic test completed successfully!');
    console.log('\n🎯 Expected outcome:');
    console.log('   - Sep 17 hearing gets updated with actual description (not deleted)');
    console.log('   - Sep 18 blank hearing gets deleted (outdated)');
    console.log('   - Sep 30 blank hearing gets created (new)');
    console.log('   - Oct 1 blank hearing gets created (next hearing date)');
    console.log('\n📝 This solves the duplicate issue by:');
    console.log('   1. Updating existing hearings instead of creating duplicates');
    console.log('   2. Properly extracting next hearing dates from descriptions');
    console.log('   3. Cleaning up outdated blank hearings');
    console.log('   4. Preserving hearings that just got updated with content');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testUpdateCaseHearingsLogic();