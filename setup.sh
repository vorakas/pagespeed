#!/bin/bash

echo "🚀 PageSpeed Insights Monitor - Quick Start"
echo "==========================================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✅ Python 3 detected"

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is not installed. Please install pip."
    exit 1
fi

echo "✅ pip3 detected"

# Create virtual environment
echo ""
echo "📦 Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your PageSpeed Insights API key"
    echo "   Get your key from: https://console.cloud.google.com/"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env and add your PAGESPEED_API_KEY"
echo "2. Run: source venv/bin/activate"
echo "3. Run: python app.py"
echo "4. Open: http://localhost:5000"
echo ""
echo "To deactivate the virtual environment later, run: deactivate"
