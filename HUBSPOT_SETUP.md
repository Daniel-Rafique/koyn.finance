# Email Integration Setup Guide

This guide explains how to set up the email verification system in Koyn.ai with either SendGrid (preferred) or HubSpot.

## Environment Variables

Add the following environment variables to your `.env` file:

```
# SendGrid integration (preferred email provider)
SENDGRID_API_KEY=your_sendgrid_api_key

# HubSpot integration with Private App access token (alternative)
HUBSPOT_ACCESS_TOKEN=your_private_app_access_token

# Email template for verification codes (only needed if using HubSpot)
HUBSPOT_VERIFICATION_TEMPLATE_ID=12345678
```

If you're using Vite in the frontend, also add these to your frontend environment:

```
VITE_SENDGRID_API_KEY=your_sendgrid_api_key
VITE_HUBSPOT_ACCESS_TOKEN=your_private_app_access_token
VITE_HUBSPOT_VERIFICATION_TEMPLATE_ID=12345678
```

## SendGrid Setup Steps (Recommended)

### 1. Create a SendGrid Account

If you don't already have one, create a SendGrid account at [SendGrid.com](https://sendgrid.com/).

### 2. Create an API Key

1. Log in to your SendGrid account
2. Go to Settings → API Keys
3. Click "Create API Key"
4. Name your key (e.g., "Koyn.ai Verification")
5. Choose "Restricted Access" and enable the following permissions:
   - Mail Send: Full Access
6. Create the API key and copy it (it will only be shown once)
7. Add this key to your `.env` file as the `SENDGRID_API_KEY` value

### 3. Verify Sender Identity

1. Go to Settings → Sender Authentication
2. Set up either Domain Authentication or Single Sender Verification
3. Verify that `hi@koyn.ai` is a validated sender
4. Complete the verification process according to SendGrid's instructions

## HubSpot Setup Steps (Alternative)

### 1. Create a HubSpot Account

If you don't already have one, create a HubSpot account at [HubSpot.com](https://www.hubspot.com/).

### 2. Create a Private App

1. Log in to your HubSpot account
2. Go to Settings (gear icon) → Integrations → Private Apps
3. Click "Create private app"
4. Name your app (e.g., "Koyn.ai Verification")
5. Add the necessary scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `content`
   - `communication_preferences.read_write`
   - `communication-subscriptions`
   - `transactional-email`
   - `marketing.transactional.single_email.send`
6. Create the app and copy the access token
7. Add this token to your `.env` file as the `HUBSPOT_ACCESS_TOKEN` value

### 3. Create Email Templates

#### Verification Email Template

1. In HubSpot, go to Marketing → Email → Create Email
2. Choose "Automated" email type
3. Select a template
4. Design your email with a verification code placeholder like `{{ verification_code }}`
5. Save the template
6. Note the template ID from the URL or template settings
7. Add this ID to your `.env` file as `HUBSPOT_VERIFICATION_TEMPLATE_ID`

### 4. Custom Properties

Create the following custom contact properties in HubSpot:

1. Go to Settings → Properties
2. Click "Create Property"
3. Create these properties:
   - `verification_code` (Single-line text)
   - `verification_status` (Dropdown: pending, verified)
   - `verification_sent_at` (Date picker)
   - `verified_at` (Date picker)
   - `subscription_status` (Dropdown: active, inactive, pending)

## Testing the Integration

### User Interface Testing

1. Ensure all environment variables are set
2. Restart your application 
3. Use the verification form to send a verification code
4. Check your email to verify the code was sent
5. For HubSpot: Also check your HubSpot contacts to verify a new contact was created

### API Testing with Postman/cURL

You can test the verification endpoints directly using Postman or cURL:

**Step 1: Request Verification Code**

```bash
curl -X POST https://koyn.ai:3001/api/verification/request \
  -H "Content-Type: application/json" \
  -d '{"email": "subscriber@example.com"}'
```

If successful, you'll receive:
```json
{
  "success": true,
  "expiresAt": "2024-08-05T12:30:00.000Z"
}
```

In development mode, you'll also receive the code:
```json
{
  "success": true,
  "code": "123456",
  "expiresAt": "2024-08-05T12:30:00.000Z"
}
```

**Step 2: Verify Code**

```bash
curl -X POST https://koyn.ai:3001/api/verification/verify \
  -H "Content-Type: application/json" \
  -d '{"email": "subscriber@example.com", "code": "123456"}'
```

If successful:
```json
{
  "success": true
}
```

## Troubleshooting

If verification emails aren't being sent:

1. Check your server logs for specific error messages
2. For SendGrid: Verify your API key has proper permissions and the sender is verified
3. For HubSpot: Check your HubSpot API logs for errors and verify the API key has proper permissions 
4. Ensure the environment variables are loaded correctly
5. In development mode, the verification code will be output to the console logs even if email sending fails

## Using HubSpot for Contact Management

Even when using SendGrid for email sending, contacts are still stored in HubSpot during verification. This allows you to:

1. Create marketing lists based on verification or subscription status
2. Track user engagement through the CRM
3. Create dashboards to monitor verification and subscription rates 