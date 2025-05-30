/**
 * Test script for HubSpot integration
 * 
 * Run with: node test-hubspot.js
 */
require('dotenv').config();
const { Client } = require('@hubspot/api-client');

// Check if HubSpot access token is set
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;

if (!HUBSPOT_ACCESS_TOKEN) {
  console.error('HUBSPOT_ACCESS_TOKEN is not set in environment variables');
  console.log('Please set it in your .env file and try again');
  console.log('You can generate a Private App access token in your HubSpot developer account');
  process.exit(1);
}

// Check if Template ID is set
const TEMPLATE_ID = process.env.HUBSPOT_VERIFICATION_TEMPLATE_ID;
if (!TEMPLATE_ID) {
  console.warn('HUBSPOT_VERIFICATION_TEMPLATE_ID is not set in environment variables');
  console.log('Email sending test will be skipped');
}

// Initialize the HubSpot client with Private App access token
const hubspotClient = new Client({
  accessToken: HUBSPOT_ACCESS_TOKEN,
});

// Test email address
const TEST_EMAIL = 'test@example.com';

// Test contact properties
const contactProperties = {
  email: TEST_EMAIL,
  firstname: 'Test',
  lastname: 'User',
  verification_code: '123456',
  verification_status: 'pending',
  verification_sent_at: new Date().toISOString()
};

// Function to find a contact by email
async function findContactByEmail(email) {
  try {
    console.log(`Searching for contact with email: ${email}`);
    
    const publicObjectSearchRequest = {
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'email',
              operator: 'EQ',
              value: email
            }
          ]
        }
      ],
      properties: ['email', 'firstname', 'lastname', 'verification_status']
    };
    
    const searchResponse = await hubspotClient.crm.contacts.searchApi.doSearch(publicObjectSearchRequest);
    
    if (searchResponse.results && searchResponse.results.length > 0) {
      console.log('Contact found:', searchResponse.results[0].properties);
      return searchResponse.results[0];
    }
    
    console.log('No contact found with that email');
    return null;
  } catch (error) {
    console.error('Error finding contact:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return null;
  }
}

// Function to create or update a contact
async function createOrUpdateContact(email, properties) {
  try {
    // First check if contact exists
    const existingContact = await findContactByEmail(email);
    
    if (existingContact) {
      console.log(`Updating existing contact with ID: ${existingContact.id}`);
      
      // Update existing contact
      await hubspotClient.crm.contacts.basicApi.update(
        existingContact.id,
        { properties }
      );
      
      console.log('Contact updated successfully');
      return existingContact;
    } else {
      console.log('Creating new contact');
      
      // Create new contact
      const result = await hubspotClient.crm.contacts.basicApi.create({
        properties
      });
      
      console.log('Contact created successfully:', result.properties);
      return result;
    }
  } catch (error) {
    console.error('Error creating/updating contact:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Function to send a test email
async function sendTestEmail(email, code) {
  if (!TEMPLATE_ID) {
    console.log('Skipping email test: No template ID provided');
    return;
  }
  
  try {
    console.log(`Sending test email to ${email} with code ${code}`);
    
    const response = await hubspotClient.marketing.transactional.singleSend.sendEmail({
      emailId: parseInt(TEMPLATE_ID),
      message: {
        to: email,
        customProperties: {
          verification_code: code
        }
      }
    });
    
    console.log('Email sent successfully:', response);
    return true;
  } catch (error) {
    console.error('Error sending email:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    return false;
  }
}

// Main test function
async function runTest() {
  console.log('-----------------------------------');
  console.log('HubSpot Integration Test');
  console.log('-----------------------------------');
  
  console.log(`Access Token: ${HUBSPOT_ACCESS_TOKEN ? 'Set ✓' : 'Not set ✗'}`);
  console.log(`Template ID: ${TEMPLATE_ID ? 'Set ✓' : 'Not set ✗'}`);
  console.log('-----------------------------------');
  
  try {
    // Test 1: Create/update contact
    console.log('\nTest 1: Create or update contact');
    const contact = await createOrUpdateContact(TEST_EMAIL, contactProperties);
    
    if (contact) {
      console.log('✓ Contact test passed');
    } else {
      console.log('✗ Contact test failed');
    }
    
    // Test 2: Find contact
    console.log('\nTest 2: Find contact by email');
    const foundContact = await findContactByEmail(TEST_EMAIL);
    
    if (foundContact) {
      console.log('✓ Find contact test passed');
    } else {
      console.log('✗ Find contact test failed');
    }
    
    // Test 3: Send email
    if (TEMPLATE_ID) {
      console.log('\nTest 3: Send verification email');
      const emailSent = await sendTestEmail(TEST_EMAIL, '123456');
      
      if (emailSent) {
        console.log('✓ Email test passed');
      } else {
        console.log('✗ Email test failed');
      }
    }
    
    console.log('\n-----------------------------------');
    console.log('Test completed');
    console.log('-----------------------------------');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
runTest(); 