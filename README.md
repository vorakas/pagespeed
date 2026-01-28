# PageSpeed Insights Monitor

A web application to monitor and compare website performance using Google's PageSpeed Insights API. Track performance metrics over time, compare multiple sites, and visualize historical trends.

## Features

- 📊 **Multi-site Monitoring**: Track multiple websites and URLs
- 🔄 **Automated Testing**: Daily scheduled tests (configurable)
- 📈 **Historical Charts**: Visualize performance trends over time
- ⚖️ **Site Comparison**: Compare performance between two sites
- 🎯 **Core Web Vitals**: Track FCP, LCP, CLS, and more
- 🚀 **On-demand Testing**: Run tests manually whenever needed
- 💾 **Historical Records**: SQLite database stores all test results

## Tech Stack

- **Backend**: Python Flask
- **Database**: SQLite (easily migrates to PostgreSQL)
- **Frontend**: Vanilla JavaScript with Chart.js
- **Scheduler**: APScheduler for daily automated tests
- **API**: Google PageSpeed Insights API v5

## Quick Start

### 1. Installation

```bash
# Clone or download the project
cd pagespeed-monitor

# Install dependencies
pip install -r requirements.txt
```

### 2. Configuration

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and add your Google PageSpeed Insights API key:

```
PAGESPEED_API_KEY=your_actual_api_key_here
```

**Getting an API Key:**
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable the PageSpeed Insights API
4. Create credentials (API Key)
5. Copy the key to your `.env` file

> **Note:** The API key is optional but highly recommended. Without it, you'll be subject to stricter rate limits.

### 3. Run Locally

```bash
python app.py
```

The application will be available at `http://localhost:5000`

### 4. Initial Setup

1. Open the app in your browser
2. Add your first site (e.g., "Production", "Staging")
3. Add URLs to each site
4. Click "Test All URLs" to run your first test

## Usage Guide

### Adding Sites and URLs

1. **Add a Site**: Enter a name (e.g., "Production", "Staging", "Competitor")
2. **Add URLs**: Select a site and add URLs you want to monitor
3. You can add up to 10 URLs per site (or more if needed)

### Running Tests

- **Manual Test**: Click "Test All URLs" to test all configured URLs
- **Automated**: Tests run daily at 2 AM (configurable in `app.py`)
- **Results**: View latest results in the dashboard tabs

### Viewing Results

- **Dashboard**: Shows latest test results for each site
- **Comparison**: Compare average scores between two sites
- **Historical Charts**: View performance trends over time

### Metrics Tracked

**Lighthouse Scores (0-100):**
- Performance
- Accessibility
- Best Practices
- SEO

**Core Web Vitals:**
- FCP (First Contentful Paint)
- LCP (Largest Contentful Paint)
- CLS (Cumulative Layout Shift)
- TTI (Time to Interactive)
- TBT (Total Blocking Time)
- Speed Index

## Cloud Deployment

### Option 1: Railway (Recommended)

1. Create account at https://railway.app
2. Install Railway CLI: `npm i -g @railway/cli`
3. Login: `railway login`
4. Initialize: `railway init`
5. Add environment variables in Railway dashboard
6. Deploy: `railway up`

### Option 2: Render

1. Create account at https://render.com
2. Create new Web Service
3. Connect your Git repository
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `gunicorn app:app`
6. Add environment variable: `PAGESPEED_API_KEY`
7. Deploy

For Render, add to requirements.txt:
```
gunicorn==21.2.0
```

### Option 3: Google Cloud Run

1. Install Google Cloud SDK
2. Create project: `gcloud projects create pagespeed-monitor`
3. Build container:
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/pagespeed-monitor
```
4. Deploy:
```bash
gcloud run deploy --image gcr.io/YOUR_PROJECT_ID/pagespeed-monitor --platform managed
```
5. Set environment variables in Cloud Run console

### Option 4: Heroku

1. Create account at https://heroku.com
2. Install Heroku CLI
3. Create app: `heroku create your-app-name`
4. Set config: `heroku config:set PAGESPEED_API_KEY=your_key`
5. Deploy: `git push heroku main`

Add `Procfile`:
```
web: gunicorn app:app
```

## Database Migration (SQLite → PostgreSQL)

For production deployments with multiple users, consider PostgreSQL:

1. Install psycopg2: `pip install psycopg2-binary`
2. Update `models.py` to use PostgreSQL connection
3. Set `DATABASE_URL` environment variable
4. Migration tools: Alembic or Flask-Migrate

## Customization

### Change Test Schedule

Edit `app.py`, line with `scheduler.add_job`:

```python
# Run every 6 hours
scheduler.add_job(func=run_daily_tests, trigger="interval", hours=6)

# Run twice daily at specific times
scheduler.add_job(func=run_daily_tests, trigger="cron", hour=2, minute=0)
scheduler.add_job(func=run_daily_tests, trigger="cron", hour=14, minute=0)
```

### Add More URLs

The system is designed for ~10 URLs per site but can handle more. Be mindful of:
- API rate limits (25,000 requests per day with free tier)
- Each test takes 30-60 seconds
- Add delays between tests if needed

### Customize UI

- Edit `static/css/style.css` for styling
- Edit `templates/index.html` for layout
- Edit `static/js/app.js` for functionality

## API Endpoints

- `GET /api/sites` - List all sites
- `POST /api/sites` - Create new site
- `GET /api/sites/:id/urls` - Get URLs for site
- `POST /api/sites/:id/urls` - Add URL to site
- `GET /api/sites/:id/latest-results` - Latest test results
- `POST /api/test-all` - Run tests for all URLs
- `POST /api/test-site/:id` - Run tests for one site
- `GET /api/comparison?site1=X&site2=Y` - Compare sites
- `GET /api/urls/:id/history?days=30` - Historical data

## Troubleshooting

### "No results" showing
- Make sure you've added sites and URLs
- Click "Test All URLs" to run your first test
- Check browser console for errors

### Tests failing
- Verify API key is correct
- Check URL format (must include https://)
- Ensure URLs are publicly accessible
- Check rate limits (add delays if needed)

### Slow tests
- Each URL takes 30-60 seconds to test
- Testing 20 URLs = 10-20 minutes
- This is normal for PageSpeed Insights API

### Database errors
- Delete `pagespeed.db` to reset database
- Check file permissions
- For production, use PostgreSQL

## Performance Tips

1. **API Key**: Always use an API key to avoid strict rate limits
2. **Batch Testing**: Test during off-peak hours
3. **Delays**: Add delays between tests (configured in `pagespeed_service.py`)
4. **Caching**: Results are cached in database
5. **Pagination**: Limit history queries to 30-90 days

## Future Enhancements

- [ ] Email notifications when scores drop
- [ ] Slack/Discord webhooks
- [ ] Export reports to PDF
- [ ] Mobile vs Desktop comparison
- [ ] Custom test schedules per site
- [ ] API authentication
- [ ] Team collaboration features

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use for personal or commercial projects.

## Support

For issues with:
- **PageSpeed API**: https://developers.google.com/speed/docs/insights/v5/get-started
- **This Application**: Check the troubleshooting section above

## Credits

- Google PageSpeed Insights API
- Chart.js for visualizations
- Flask web framework
