# Scheduled Reminder Service Documentation

## Overview

The Scheduled Reminder Service automatically processes due reminders and sends notifications via email and WhatsApp. It runs as a background service with configurable scheduling.

## Features

- **Automated Processing**: Checks for due reminders based on configurable cron patterns
- **Multi-Channel Notifications**: Sends reminders via both email and WhatsApp
- **Graceful Shutdown**: Proper cleanup on server shutdown
- **Custom Tasks**: Support for additional scheduled tasks
- **Monitoring**: Built-in status monitoring and statistics
- **Error Handling**: Comprehensive error handling and logging

## Quick Start

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Reminder Scheduler Configuration
REMINDER_CRON_PATTERN=*/5 * * * *
REMINDER_TIMEZONE=America/New_York
REMINDER_RUN_ON_START=true
REMINDER_AUTO_START=true

# Email Service (Resend)
RESEND_API_KEY=your_resend_api_key_here
FROM_EMAIL=your_email@yourdomain.com

# WhatsApp Service
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_SIMULATION_MODE=true
```

### 2. Start the Server

The scheduler starts automatically when you run the server:

```bash
npm start
```

### 3. Test the Scheduler

Use the standalone test script:

```bash
# Test with default settings (2-minute intervals, 60-second duration)
node test-scheduler.js

# Test with custom settings
node test-scheduler.js --pattern="*/1 * * * *" --duration=30

# Test indefinitely (manual stop)
node test-scheduler.js --no-auto-stop
```

## API Endpoints

All scheduler endpoints require authentication.

### Get Status
```
GET /scheduler/status
```

### Manual Trigger
```
POST /scheduler/trigger
```

### Start/Stop Scheduler
```
POST /scheduler/start
POST /scheduler/stop
```

### Add Custom Task
```
POST /scheduler/custom-task
{
  "name": "custom-task-name",
  "cronPattern": "*/10 * * * *",
  "description": "Task description"
}
```

## Configuration Options

### Cron Patterns

| Pattern | Description |
|---------|-------------|
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 9 * * *` | Daily at 9 AM |
| `0 9 * * MON` | Every Monday at 9 AM |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REMINDER_CRON_PATTERN` | `*/5 * * * *` | How often to check for due reminders |
| `REMINDER_TIMEZONE` | `America/New_York` | Timezone for scheduling |
| `REMINDER_RUN_ON_START` | `true` | Run immediately when service starts |
| `REMINDER_AUTO_START` | `true` | Start scheduler automatically |
| `WHATSAPP_SIMULATION_MODE` | `false` | Use simulation mode for WhatsApp |

## How It Works

### 1. Reminder Processing Flow

1. **Scheduled Check**: Runs based on cron pattern
2. **Database Query**: Finds reminders where `reminder_date <= NOW()`
3. **Notification Sending**: 
   - Email via Resend service
   - WhatsApp via Meta Business API
4. **Status Update**: Marks reminders as sent
5. **Logging**: Records results and errors

### 2. Service Architecture

```
index.js
├── reminderScheduler.js (main integration)
├── services/
│   ├── ScheduledReminderService.js (scheduling logic)
│   ├── ReminderService.js (business logic)
│   ├── EmailService.js (email notifications)
│   └── WhatsAppService.js (WhatsApp notifications)
└── routers/
    └── schedulerRouter.js (API endpoints)
```

## Database Requirements

### Reminders Table Structure

The service expects a `reminders` table with these columns:

- `reminder_id` - Primary key
- `case_id` - Foreign key to cases
- `user_id` - Foreign key to users
- `reminder_date` - When to send the reminder
- `message` - Reminder message
- `reminder_type` - 'email' or 'whatsapp'
- `status` - 'pending', 'sent', 'failed'
- `phone_number` - For WhatsApp reminders
- `email` - For email reminders

## Monitoring and Troubleshooting

### Check Status

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/scheduler/status
```

### View Logs

The service logs to console. In production, consider using a logging service:

- ✅ Successful processing
- ❌ Errors and failures
- 🔄 Processing start/stop
- 📊 Statistics and summaries

### Common Issues

1. **Scheduler Not Starting**
   - Check environment variables
   - Verify database connection
   - Check console for error messages

2. **Reminders Not Sending**
   - Verify API keys (Resend, WhatsApp)
   - Check reminder data format
   - Review error logs

3. **Performance Issues**
   - Adjust cron pattern frequency
   - Monitor database query performance
   - Check memory usage

## Development Mode

### WhatsApp Simulation

Set `WHATSAPP_SIMULATION_MODE=true` to log WhatsApp messages instead of sending:

```
📱 [SIMULATION] WhatsApp message would be sent to +1234567890:
Your hearing for Case ABC123 is scheduled for tomorrow at 2:00 PM.
```

### Custom Tasks

Add custom scheduled tasks for development:

```javascript
reminderScheduler.addCustomTask(
  'daily-cleanup',
  '0 2 * * *', // 2 AM daily
  async () => {
    // Your cleanup logic
  }
);
```

## Production Deployment

### Vercel Configuration

For Vercel deployment, the scheduler runs as part of the serverless functions. Consider:

1. Use Vercel Cron Jobs for scheduling
2. Set up external monitoring
3. Configure proper logging
4. Use environment variables for all secrets

### Environment Variables for Production

```bash
REMINDER_CRON_PATTERN=*/15 * * * *  # Less frequent in production
WHATSAPP_SIMULATION_MODE=false      # Real sending in production
NODE_ENV=production
```

## Support

For issues or questions:

1. Check the console logs
2. Verify environment configuration
3. Test with the standalone script
4. Review API endpoint responses
5. Check database connectivity

The service includes comprehensive logging and error handling to help diagnose issues quickly.