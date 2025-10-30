#!/bin/bash

# GCP IAM and Workload Identity Federation Setup Script
# This script sets up the necessary IAM permissions and Workload Identity Federation
# for GitHub Actions to deploy to Cloud Run without service account keys.

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if required tools are installed
check_prerequisites() {
    print_info "Checking prerequisites..."

    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI is not installed. Please install it first."
        exit 1
    fi

    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI is not installed. Please install it first."
        exit 1
    fi

    print_success "All prerequisites are installed"
}

# Function to prompt for inputs
prompt_inputs() {
    print_info "Please provide the following information:"

    # Get GCP Project ID
    DEFAULT_PROJECT=$(gcloud config get-value project 2>/dev/null)
    read -p "GCP Project ID [$DEFAULT_PROJECT]: " PROJECT_ID
    PROJECT_ID=${PROJECT_ID:-$DEFAULT_PROJECT}

    if [ -z "$PROJECT_ID" ]; then
        print_error "Project ID is required"
        exit 1
    fi

    # Get GitHub repository
    if git remote get-url origin &> /dev/null; then
        REPO_URL=$(git remote get-url origin)
        GITHUB_REPO=$(echo $REPO_URL | sed -E 's/.*github\.com[:/]([^/]+\/[^.]+)(\.git)?/\1/')
        read -p "GitHub Repository [$GITHUB_REPO]: " INPUT_REPO
        GITHUB_REPO=${INPUT_REPO:-$GITHUB_REPO}
    else
        read -p "GitHub Repository (owner/repo): " GITHUB_REPO
    fi

    if [ -z "$GITHUB_REPO" ]; then
        print_error "GitHub repository is required"
        exit 1
    fi

    # Get project number
    PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

    print_success "Configuration:"
    echo "  - Project ID: $PROJECT_ID"
    echo "  - Project Number: $PROJECT_NUMBER"
    echo "  - GitHub Repo: $GITHUB_REPO"
    echo ""
}

# Function to enable required APIs
enable_apis() {
    print_info "Enabling required GCP APIs..."

    gcloud services enable \
        run.googleapis.com \
        cloudbuild.googleapis.com \
        secretmanager.googleapis.com \
        artifactregistry.googleapis.com \
        iam.googleapis.com \
        iamcredentials.googleapis.com \
        --project=$PROJECT_ID

    print_success "APIs enabled"
}

# Function to create service accounts
create_service_accounts() {
    print_info "Creating service accounts for each environment..."

    for env in dev stg prod; do
        SA_NAME="sa-${env}"
        SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

        # Set display name based on environment
        case $env in
            dev) DISPLAY_NAME="Dev Deploy Service Account" ;;
            stg) DISPLAY_NAME="Staging Deploy Service Account" ;;
            prod) DISPLAY_NAME="Production Deploy Service Account" ;;
        esac

        # Check if service account already exists
        if gcloud iam service-accounts describe $SA_EMAIL --project=$PROJECT_ID &>/dev/null; then
            print_warning "Service account $SA_NAME already exists"
        else
            gcloud iam service-accounts create $SA_NAME \
                --display-name="$DISPLAY_NAME" \
                --project=$PROJECT_ID
            print_success "Created service account: $SA_NAME"
        fi

        # Grant Cloud Run Admin role
        gcloud projects add-iam-policy-binding $PROJECT_ID \
            --member="serviceAccount:${SA_EMAIL}" \
            --role="roles/run.admin" \
            --condition=None

        # Grant Service Account User role (to act as the runtime SA)
        gcloud projects add-iam-policy-binding $PROJECT_ID \
            --member="serviceAccount:${SA_EMAIL}" \
            --role="roles/iam.serviceAccountUser" \
            --condition=None

        # Grant Artifact Registry Writer role
        gcloud projects add-iam-policy-binding $PROJECT_ID \
            --member="serviceAccount:${SA_EMAIL}" \
            --role="roles/artifactregistry.writer" \
            --condition=None

        print_success "Granted roles to $SA_NAME"
    done
}

# Function to create Workload Identity Pool
create_workload_identity_pool() {
    print_info "Creating Workload Identity Pool..."

    POOL_NAME="github-actions"
    POOL_DISPLAY_NAME="GitHub Actions Pool"

    # Check if pool already exists
    if gcloud iam workload-identity-pools describe $POOL_NAME \
       --location=global --project=$PROJECT_ID &>/dev/null; then
        print_warning "Workload Identity Pool already exists"
    else
        gcloud iam workload-identity-pools create $POOL_NAME \
            --location=global \
            --display-name="$POOL_DISPLAY_NAME" \
            --project=$PROJECT_ID

        print_success "Created Workload Identity Pool: $POOL_NAME"
    fi
}

# Function to create Workload Identity Provider
create_workload_identity_provider() {
    print_info "Creating Workload Identity Provider..."

    POOL_NAME="github-actions"
    PROVIDER_NAME="github"
    PROVIDER_DISPLAY_NAME="GitHub OIDC Provider"

    # Check if provider already exists
    if gcloud iam workload-identity-pools providers describe $PROVIDER_NAME \
       --location=global --workload-identity-pool=$POOL_NAME --project=$PROJECT_ID &>/dev/null; then
        print_warning "Workload Identity Provider already exists"
    else
        gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
            --location=global \
            --workload-identity-pool=$POOL_NAME \
            --display-name="$PROVIDER_DISPLAY_NAME" \
            --issuer-uri="https://token.actions.githubusercontent.com" \
            --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.actor=assertion.actor,attribute.aud=assertion.aud" \
            --attribute-condition="assertion.repository=='$GITHUB_REPO'" \
            --project=$PROJECT_ID

        print_success "Created Workload Identity Provider: $PROVIDER_NAME"
    fi
}

# Function to bind service accounts to Workload Identity
bind_workload_identity() {
    print_info "Binding service accounts to Workload Identity..."

    POOL_NAME="github-actions"

    for env in dev stg prod; do
        SA_NAME="sa-${env}"
        SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

        MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/attribute.repository/${GITHUB_REPO}"

        gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
            --role="roles/iam.workloadIdentityUser" \
            --member="$MEMBER" \
            --project=$PROJECT_ID

        print_success "Bound $SA_NAME to Workload Identity"
    done
}

# Function to create GitHub secrets
create_github_secrets() {
    print_info "Creating GitHub repository secrets..."

    POOL_NAME="github-actions"
    PROVIDER_NAME="github"

    # WIF Provider resource name
    WIF_PROVIDER="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_NAME}/providers/${PROVIDER_NAME}"

    # Create secrets
    echo "$PROJECT_ID" | gh secret set GCP_PROJECT_ID --repo=$GITHUB_REPO
    echo "$WIF_PROVIDER" | gh secret set WIF_PROVIDER --repo=$GITHUB_REPO
    echo "sa-dev@${PROJECT_ID}.iam.gserviceaccount.com" | gh secret set SA_DEV --repo=$GITHUB_REPO
    echo "sa-stg@${PROJECT_ID}.iam.gserviceaccount.com" | gh secret set SA_STG --repo=$GITHUB_REPO
    echo "sa-prod@${PROJECT_ID}.iam.gserviceaccount.com" | gh secret set SA_PROD --repo=$GITHUB_REPO

    print_success "GitHub secrets created"
}

# Function to print summary
print_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    print_success "Setup completed successfully!"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    print_info "Summary:"
    echo "  - Project: $PROJECT_ID"
    echo "  - Repository: $GITHUB_REPO"
    echo "  - Service Accounts: sa-dev, sa-stg, sa-prod"
    echo "  - Workload Identity Pool: github-actions"
    echo "  - Workload Identity Provider: github"
    echo ""
    print_info "GitHub Secrets created:"
    echo "  - GCP_PROJECT_ID"
    echo "  - WIF_PROVIDER"
    echo "  - SA_DEV"
    echo "  - SA_STG"
    echo "  - SA_PROD"
    echo ""
    print_info "Next steps:"
    echo "  1. Create secrets in Google Secret Manager:"
    echo "     - openai-api-key-dev"
    echo "     - openai-api-key-stg"
    echo "     - openai-api-key-prod"
    echo ""
    echo "  2. Grant secret access to service accounts:"
    echo "     gcloud secrets add-iam-policy-binding openai-api-key-dev \\"
    echo "       --member='serviceAccount:sa-dev@${PROJECT_ID}.iam.gserviceaccount.com' \\"
    echo "       --role='roles/secretmanager.secretAccessor'"
    echo ""
    echo "  3. Create Artifact Registry repository:"
    echo "     gcloud artifacts repositories create apps \\"
    echo "       --repository-format=docker \\"
    echo "       --location=asia-northeast1 \\"
    echo "       --description='App containers'"
    echo ""
    echo "  4. Create GitHub Environment 'development' with protection rules"
    echo ""
    echo "  5. Push to main branch to trigger the first deployment"
    echo ""
    print_success "CI/CD is ready to use! 🚀"
    echo "═══════════════════════════════════════════════════════════"
}

# Main execution
main() {
    echo "═══════════════════════════════════════════════════════════"
    echo "🔧 GCP IAM & Workload Identity Federation Setup"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    check_prerequisites
    prompt_inputs
    enable_apis
    create_service_accounts
    create_workload_identity_pool
    create_workload_identity_provider
    bind_workload_identity
    create_github_secrets
    print_summary
}

# Run main function
main
