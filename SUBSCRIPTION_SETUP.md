# Koyn.ai Subscription System Setup

This document provides instructions for setting up and managing the Koyn.ai subscription system.

## Overview

The subscription system allows users to:
1. Purchase 1-month, 3-month, or lifetime subscriptions
2. Access premium features across multiple devices using their email address
3. Receive automatic renewal notifications
4. Get email notifications for subscription events (start, renewal, cancellation)

## Configuration

### Prerequisites

1. Helio payment provider account (https://app.hel.io)
2. API keys from Helio for webhook integration
3. SendGrid account for email notifications
4. Your server configured with HTTPS

### Environment Variables

Add the following to your `.env` file:

```bash
# Helio API credentials
HELIO_API_KEY=your_helio_api_key_here
HELIO_API_SECRET=your_helio_api_secret_here
HELIO_PAYLINK_ID=your_helio_paylink_id_here
HELIO_WEBHOOK_TOKEN=your_webhook_shared_token_here

# SendGrid API for email notifications
SENDGRID_API_KEY=your_sendgrid_api_key_here

# Verification API settings
VERIFICATION_PORT=3005
```

You can find the Helio values in your Helio dashboard under API settings.
The HELIO_WEBHOOK_TOKEN is generated when you register webhooks and should be stored securely.

## Webhook Setup

The system includes automatic webhook configuration. When you start the server with valid Helio API credentials, it will:

1. Register subscription webhooks with Helio
2. Configure the server to receive webhook events
3. Store the shared token for webhook verification

To manually configure webhooks:

```bash
node webhook-handler.js register  # Register webhooks
node webhook-handler.js list      # List existing webhooks
node webhook-handler.js delete ID # Delete a webhook by ID
```

## Email Notifications

The system automatically sends email notifications for subscription events:

1. **Subscription Started**: When a user first subscribes, they receive a welcome email with subscription details
2. **Subscription Renewed**: When a subscription renews, the user receives a confirmation email
3. **Subscription Ended**: When a subscription is canceled or expires, the user receives a notification

Email templates are customized with:
- The user's subscription details (plan, start date, renewal date)
- Appropriate call-to-action buttons based on the event type
- Koyn.ai branding and styling

## Testing Subscriptions

### Local Development Testing

In development mode (localhost), you can test the subscription system:

1. Start the verification API server:
   ```bash
   node verification-api.js
   ```

2. Start the webhook handler:
   ```bash
   node webhook-handler.js
   ```

3. Use the following test emails which are pre-configured as subscribed users:
   - `subscriber@example.com`
   - `premium@test.com`
   - `lifetime@koyn.ai`

4. Monitor the console for email notifications that would be sent in production

### Production Testing

To test the complete system in production:

1. Subscribe to a plan on the website
2. Verify that you receive the "Subscription Started" email
3. Check that you can access premium features
4. Cross-device verification:
   - Subscribe on one device
   - On another device, click the subscription button and choose "Already Subscribed?"
   - Enter the same email address to verify

## Subscription Status Verification

The system verifies subscription status using:

1. **Client-side verification**: Checks localStorage for saved subscription data
2. **Server-side verification**: Validates email addresses against our subscription database
3. **Webhook notifications**: Processes real-time subscription events from Helio
4. **Email notifications**: Keeps users informed about their subscription status

## Troubleshooting

If users report subscription or email notification issues:

1. Check server logs for webhook errors
2. Verify the webhook endpoint is publicly accessible
3. Check that SendGrid API is properly configured
4. Verify user's email matches what was provided during subscription
5. Look for detailed error messages in webhook-handler.js and verification-api.js logs

## Security Considerations

- The shared token for webhook verification is critical for security
- In production, store this token securely (not in version control)
- Use HTTPS for all communication to protect payment data
- Implement rate limiting on the verification endpoint to prevent abuse
- Secure your SendGrid API key and use authenticated sender domains 