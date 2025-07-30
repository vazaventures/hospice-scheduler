#!/bin/bash

echo "🚀 Hospice Scheduler Deployment Script"
echo "======================================"

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it first: https://cli.github.com/"
    echo "Or manually create a repository on GitHub and follow the instructions below."
    exit 1
fi

# Check if user is logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "❌ Not logged in to GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

echo "📦 Creating GitHub repository..."
REPO_NAME="hospice-scheduler-$(date +%s)"

# Create repository on GitHub
gh repo create $REPO_NAME --public --source=. --remote=origin --push

if [ $? -eq 0 ]; then
    echo "✅ Repository created successfully!"
    echo "🌐 Repository URL: https://github.com/$(gh api user --jq .login)/$REPO_NAME"
    echo ""
    echo "🎯 Next steps:"
    echo "1. Go to https://render.com"
    echo "2. Sign up/Login with your GitHub account"
    echo "3. Click 'New' → 'Blueprint'"
    echo "4. Connect your repository: $REPO_NAME"
    echo "5. Render will automatically deploy both frontend and backend"
    echo "6. Your app will be available at: https://hospice-scheduler-frontend.onrender.com"
    echo ""
    echo "📝 Note: The first deployment may take 5-10 minutes."
else
    echo "❌ Failed to create repository. Please create it manually on GitHub."
fi 