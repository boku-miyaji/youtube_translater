# Design Document: CI/CD環境整備: dev/stg/prod環境の構築

**Issue**: #27
**Title**: CI/CD環境整備: dev/stg/prod環境の構築
**Type**: Task
**Description**: dev, stg, prodの環境を作成。CI/CDが回るように整備。development.mdを参照。

---

## 1. Overview & Requirements Analysis

### 1.1 Current State
- ✅ Docker containerization is complete (Issue #25)
- ✅ Manual Cloud Run deployment is documented (docs/deployment.md)
- ✅ Health check endpoints (/api/health, /healthz) are implemented
- ❌ No CI/CD automation exists
- ❌ No environment separation (dev/stg/prod)
- ❌ Manual deployment process is error-prone
- ❌ No automated testing in deployment pipeline

### 1.2 Goals
1. **Automate deployment pipeline** using GitHub Actions
2. **Create 3 isolated environments**:
   - `dev` - Continuous deployment from main branch
   - `stg` - Staging environment for pre-production testing
   - `prod` - Production environment with manual approval
3. **Implement PR preview environments** - Temporary Cloud Run services for each PR
4. **Enable trunk-based development** - main branch is always deployable
5. **Ensure security** - Use OIDC/Workload Identity Federation (no service account keys)

### 1.3 Success Criteria
- ✅ Push to main → auto-deploy to dev environment
- ✅ Manual promotion: dev → stg → prod
- ✅ PR creation → auto-deploy preview environment with URL comment
- ✅ All builds pass type-check, lint, and tests
- ✅ Deployment time < 5 minutes
- ✅ Zero downtime deployments with health checks
- ✅ Rollback capability within 2 minutes

---

## 2. Technical Design

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Repository                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │   main     │  │feature/xxx │  │ PR #123    │             │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘             │
└────────┼───────────────┼───────────────┼────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌────────────────────────────────────────────────────────────┐
│                    GitHub Actions                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ CI Pipeline  │ │ CD Pipeline  │ │ PR Preview   │       │
│  │ - Type check │ │ - Build      │ │ - Deploy     │       │
│  │ - Lint       │ │ - Push image │ │ - Comment URL│       │
│  │ - Test       │ │ - Deploy     │ │ - Cleanup    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└────────┬───────────────┬───────────────┬────────────────────┘
         │               │               │
         ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google Cloud Platform                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Artifact Registry (asia-northeast1)        │  │
│  │  asia-northeast1-docker.pkg.dev/PROJECT/apps/...     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Dev Env   │  │  Stg Env   │  │  Prod Env  │           │
│  │  Run: dev  │  │  Run: stg  │  │  Run: prod │           │
│  │  Secret:   │  │  Secret:   │  │  Secret:   │           │
│  │  -api-dev  │  │  -api-stg  │  │  -api-prod │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          PR Preview Environments (temporary)          │  │
│  │  youtube-ai-pr-123, youtube-ai-pr-456, ...           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Environment Configuration

#### Environment Separation Strategy

| Aspect | Dev | Staging | Production |
|--------|-----|---------|-----------|
| **Cloud Run Service** | `youtube-ai-dev` | `youtube-ai-stg` | `youtube-ai-prod` |
| **Secret** | `openai-api-key-dev` | `openai-api-key-stg` | `openai-api-key-prod` |
| **Service Account** | `sa-dev@project.iam` | `sa-stg@project.iam` | `sa-prod@project.iam` |
| **Deploy Trigger** | Auto (push to main) | Manual (workflow_dispatch) | Manual (workflow_dispatch) |
| **Container Tag** | `dev-${GITHUB_SHA:0:7}` | `stg-${GITHUB_SHA:0:7}` | `v${VERSION}` |
| **CPU/Memory** | 1 vCPU / 1GB | 2 vCPU / 2GB | 2 vCPU / 2GB |
| **Min Instances** | 0 | 0 | 1 |
| **Max Instances** | 3 | 5 | 10 |
| **Ingress** | `all` | `all` | `all` |
| **Auth** | `allow-unauthenticated` | `allow-unauthenticated` | `allow-unauthenticated` |

#### PR Preview Configuration

| Aspect | Value |
|--------|-------|
| **Service Name** | `youtube-ai-pr-${PR_NUMBER}` |
| **Lifetime** | Until PR closed/merged |
| **Tag** | `pr-${PR_NUMBER}-${GITHUB_SHA:0:7}` |
| **Resources** | 1 vCPU / 512MB (minimum) |
| **Auto-cleanup** | On PR close event |

### 2.3 CI/CD Pipeline Design

#### Workflow 1: CI (Continuous Integration)

**Trigger**: Push to any branch, PR creation/update
**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Build TypeScript
        run: npm run build

      - name: Build Client
        run: npm run build:client
```

#### Workflow 2: CD - Deploy to Dev

**Trigger**: Push to main branch
**File**: `.github/workflows/cd-dev.yml`

```yaml
name: CD - Deploy to Dev

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  deploy-dev:
    runs-on: ubuntu-latest
    environment: development
    steps:
      - uses: actions/checkout@v4

      # Authenticate using Workload Identity Federation
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.SA_DEV }}

      # Setup Cloud SDK
      - uses: google-github-actions/setup-gcloud@v2

      # Build and push Docker image
      - name: Build image
        run: |
          docker build -t ${{ env.IMAGE }}:dev-${{ github.sha:0:7 }} .

      - name: Push to Artifact Registry
        run: |
          gcloud auth configure-docker asia-northeast1-docker.pkg.dev
          docker push ${{ env.IMAGE }}:dev-${{ github.sha:0:7 }}

      # Deploy to Cloud Run
      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy youtube-ai-dev \
            --image=${{ env.IMAGE }}:dev-${{ github.sha:0:7 }} \
            --region=asia-northeast1 \
            --platform=managed \
            --allow-unauthenticated \
            --memory=1Gi \
            --cpu=1 \
            --min-instances=0 \
            --max-instances=3 \
            --set-secrets=OPENAI_API_KEY=openai-api-key-dev:latest \
            --service-account=${{ secrets.SA_DEV }}

      - name: Get service URL
        id: url
        run: |
          URL=$(gcloud run services describe youtube-ai-dev \
            --region=asia-northeast1 \
            --format='value(status.url)')
          echo "url=$URL" >> $GITHUB_OUTPUT

      - name: Health check
        run: |
          sleep 10
          curl -f ${{ steps.url.outputs.url }}/healthz || exit 1
```

#### Workflow 3: CD - Deploy to Staging

**Trigger**: Manual (workflow_dispatch) from main branch
**File**: `.github/workflows/cd-stg.yml`

Similar to dev deployment but:
- Requires manual approval
- Uses staging service account
- Uses `openai-api-key-stg` secret
- Deploys to `youtube-ai-stg` service
- Higher resource allocation (2GB/2vCPU)

#### Workflow 4: CD - Deploy to Production

**Trigger**: Manual (workflow_dispatch) with version tag
**File**: `.github/workflows/cd-prod.yml`

Additional features:
- Requires approval from 2+ reviewers
- Creates GitHub Release
- Uses semantic versioning (v1.0.0)
- Enables Cloud Run traffic management for blue-green deployment
- Sends deployment notification to Slack/Email

#### Workflow 5: PR Preview

**Trigger**: PR opened/synchronized
**File**: `.github/workflows/pr-preview.yml`

```yaml
name: PR Preview

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  id-token: write
  pull-requests: write  # To comment URL

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      # ... (similar auth and build steps)

      - name: Deploy preview
        run: |
          gcloud run deploy youtube-ai-pr-${{ github.event.pull_request.number }} \
            --image=${{ env.IMAGE }}:pr-${{ github.event.pull_request.number }} \
            --region=asia-northeast1 \
            --platform=managed \
            --allow-unauthenticated \
            --memory=512Mi \
            --cpu=1 \
            --min-instances=0 \
            --max-instances=1 \
            --set-secrets=OPENAI_API_KEY=openai-api-key-dev:latest \
            --tag=pr-${{ github.event.pull_request.number }}

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const url = '${{ steps.url.outputs.url }}';
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🚀 Preview Deployed\n\n**URL**: ${url}\n\n*This preview will be automatically deleted when the PR is closed.*`
            });
```

#### Workflow 6: Cleanup PR Preview

**Trigger**: PR closed
**File**: `.github/workflows/pr-cleanup.yml`

```yaml
name: Cleanup PR Preview

on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - id: auth
        uses: google-github-actions/auth@v2
        # ... auth setup

      - name: Delete preview service
        run: |
          gcloud run services delete youtube-ai-pr-${{ github.event.pull_request.number }} \
            --region=asia-northeast1 \
            --quiet || true
```

### 2.4 Security Implementation

#### Workload Identity Federation Setup

**Benefits**:
- ✅ No long-lived service account keys
- ✅ Automatic token rotation
- ✅ Audit logging in Cloud IAM
- ✅ Principle of least privilege

**Setup Steps**:

```bash
# 1. Create service accounts for each environment
gcloud iam service-accounts create sa-dev --display-name="Dev Deploy SA"
gcloud iam service-accounts create sa-stg --display-name="Staging Deploy SA"
gcloud iam service-accounts create sa-prod --display-name="Production Deploy SA"

# 2. Grant Cloud Run Admin role (per environment)
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:sa-dev@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# 3. Create Workload Identity Pool
gcloud iam workload-identity-pools create github-actions \
  --location=global \
  --display-name="GitHub Actions Pool"

# 4. Create Workload Identity Provider
gcloud iam workload-identity-pools providers create-oidc github \
  --location=global \
  --workload-identity-pool=github-actions \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='boku-miyaji/youtube_translater'"

# 5. Allow GitHub Actions to impersonate service account
gcloud iam service-accounts add-iam-policy-binding sa-dev@PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/attribute.repository/boku-miyaji/youtube_translater"
```

#### Secret Management

**Strategy**:
- ✅ Separate secrets per environment (dev/stg/prod)
- ✅ Use Google Secret Manager (not GitHub Secrets for API keys)
- ✅ Least privilege: Each service account only accesses its environment's secrets
- ✅ Secrets are versioned and auditable

**Implementation**:

```bash
# Create environment-specific secrets
echo -n "DEV_API_KEY" | gcloud secrets create openai-api-key-dev --data-file=-
echo -n "STG_API_KEY" | gcloud secrets create openai-api-key-stg --data-file=-
echo -n "PROD_API_KEY" | gcloud secrets create openai-api-key-prod --data-file=-

# Grant access only to respective service accounts
gcloud secrets add-iam-policy-binding openai-api-key-dev \
  --member="serviceAccount:sa-dev@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 2.5 Monitoring & Observability

#### Logging Strategy

**Structured Logging Format**:

```typescript
// src/utils/logger.ts
export const logger = {
  info: (message: string, meta?: Record<string, any>) => {
    console.log(JSON.stringify({
      severity: 'INFO',
      message,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ...meta
    }));
  },
  // ... error, warn, debug methods
};
```

**Key Metrics to Track**:
- Deployment success/failure rate
- Deployment duration
- Build duration
- Health check success rate
- API response times
- Error rates per environment

#### Alerting

**Critical Alerts** (PagerDuty/Slack):
- Production deployment failure
- Health check failures > 3 consecutive
- Error rate > 5% in production
- Memory usage > 90%

**Warning Alerts** (Slack only):
- Staging deployment failure
- Build time > 10 minutes
- Preview environment not cleaned up after 7 days

### 2.6 Rollback Strategy

**Automatic Rollback Triggers**:
- Health check fails after deployment
- Error rate spikes > 10% within 5 minutes

**Manual Rollback Process**:

```bash
# List recent revisions
gcloud run revisions list --service=youtube-ai-prod --region=asia-northeast1

# Rollback to specific revision
gcloud run services update-traffic youtube-ai-prod \
  --to-revisions=youtube-ai-prod-00042-abc=100 \
  --region=asia-northeast1
```

**Recovery Time Objective (RTO)**: < 2 minutes

---

## 3. Testing Strategy

### 3.1 CI Pipeline Tests

**Level 1: Static Analysis** (< 1 minute)
- TypeScript type checking (`npm run type-check`)
- ESLint (`npm run lint`)
- Prettier format check (`npm run format:check`)

**Level 2: Build Verification** (< 3 minutes)
- Server build (`npm run build`)
- Client build (`npm run build:client`)
- Docker image build (cache enabled)

**Level 3: Unit Tests** (Future - Issue #28)
- Server API unit tests
- React component tests
- Coverage threshold: 70%

**Level 4: Integration Tests** (Future - Issue #29)
- YouTube processing flow
- PDF processing flow
- Chat functionality
- Health check endpoints

### 3.2 Environment-Specific Tests

**Dev Environment** (after each deployment):
- Health check: `GET /healthz` returns 200
- Smoke test: Process 1-minute YouTube video
- API availability check: All endpoints return 2xx/4xx (not 5xx)

**Staging Environment** (before promoting to prod):
- Full regression test suite
- Performance baseline: P95 latency < 3s
- Load test: 10 concurrent requests
- Security scan: OWASP ZAP

**Production Environment** (after deployment):
- Canary deployment: 10% traffic for 5 minutes
- Health check: Monitor for 10 minutes
- Synthetic monitoring: External health check from 3 regions

### 3.3 PR Preview Tests

**Automatic Checks**:
- Health check passes
- Homepage loads successfully
- API endpoints are accessible

**Manual Review Checklist** (in PR template):
- [ ] UI changes work correctly in preview
- [ ] YouTube video processing works
- [ ] PDF upload works
- [ ] Chat functionality works
- [ ] No console errors

---

## 4. Implementation Plan

### Phase 1: Foundation (Week 1)

**Tasks**:
1. Create GitHub Actions workflows structure
2. Setup Workload Identity Federation
3. Create service accounts for dev/stg/prod
4. Create environment-specific secrets

**Deliverables**:
- `.github/workflows/ci.yml`
- `.github/workflows/cd-dev.yml`
- GCP IAM configuration script
- Documentation: `docs/development.md`

**Success Metrics**:
- CI pipeline runs on every push
- Dev environment auto-deploys from main

### Phase 2: Environment Separation (Week 2)

**Tasks**:
1. Implement staging deployment workflow
2. Implement production deployment workflow
3. Configure Cloud Run services for each environment
4. Setup manual approval gates

**Deliverables**:
- `.github/workflows/cd-stg.yml`
- `.github/workflows/cd-prod.yml`
- GitHub Environment protection rules
- Deployment runbook

**Success Metrics**:
- All 3 environments are operational
- Promotion flow: dev → stg → prod works

### Phase 3: PR Preview (Week 3)

**Tasks**:
1. Implement PR preview deployment
2. Implement PR cleanup automation
3. Add PR comment with preview URL
4. Setup resource cleanup job

**Deliverables**:
- `.github/workflows/pr-preview.yml`
- `.github/workflows/pr-cleanup.yml`
- PR template with preview checklist

**Success Metrics**:
- PRs automatically get preview environments
- Preview URLs are commented on PRs
- Old previews are cleaned up automatically

### Phase 4: Monitoring & Observability (Week 4)

**Tasks**:
1. Implement structured logging
2. Setup Cloud Monitoring dashboards
3. Configure alerts
4. Implement rollback automation

**Deliverables**:
- `src/utils/logger.ts`
- Cloud Monitoring dashboard JSON
- Alert policies configuration
- Rollback script

**Success Metrics**:
- Deployment metrics are visible in dashboard
- Alerts trigger correctly
- Rollback completes in < 2 minutes

---

## 5. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Continuous integration pipeline |
| `.github/workflows/cd-dev.yml` | Deploy to dev environment |
| `.github/workflows/cd-stg.yml` | Deploy to staging environment |
| `.github/workflows/cd-prod.yml` | Deploy to production environment |
| `.github/workflows/pr-preview.yml` | Deploy PR preview environments |
| `.github/workflows/pr-cleanup.yml` | Cleanup closed PR previews |
| `scripts/setup-gcp-iam.sh` | Setup GCP IAM and Workload Identity |
| `scripts/create-secrets.sh` | Create environment-specific secrets |
| `src/utils/logger.ts` | Structured logging utility |
| `docs/development.md` | Development and deployment guide |
| `.github/PULL_REQUEST_TEMPLATE.md` | PR template with preview checklist |

### Modified Files

| File | Changes |
|------|---------|
| `package.json` | Add test scripts, CI scripts |
| `src/server.ts` | Use structured logger |
| `README.md` | Add CI/CD badges, link to development.md |
| `.dockerignore` | Ensure .github is excluded |

---

## 6. Security & Performance Considerations

### Security

**Threats & Mitigations**:

| Threat | Mitigation |
|--------|-----------|
| Leaked service account keys | Use Workload Identity Federation (no keys) |
| Secrets in logs | Mask secrets in GitHub Actions logs |
| Unauthorized access to environments | IAM policies per service account |
| Compromised PR preview | Separate service account with minimal permissions |
| Malicious PR from fork | Require approval for workflows on forks |
| Supply chain attacks | Pin action versions, use dependabot |

**Security Checklist**:
- [ ] No secrets in repository code
- [ ] No secrets in GitHub Actions logs
- [ ] Workload Identity Federation configured
- [ ] Least privilege IAM roles
- [ ] Dependabot enabled
- [ ] Branch protection rules on main
- [ ] HTTPS only (Cloud Run enforced)

### Performance

**Optimization Strategies**:

1. **Build Speed**:
   - Cache npm dependencies in GitHub Actions
   - Use Docker layer caching
   - Parallel build steps where possible
   - Target: < 5 minutes total pipeline time

2. **Deployment Speed**:
   - Health check timeout: 10 seconds
   - Startup probe: 3 retries, 10s interval
   - Use Cloud Run revision names for instant rollback
   - Target: < 2 minutes deployment time

3. **Cost Optimization**:
   - Min instances = 0 for dev/stg (cold start acceptable)
   - Min instances = 1 for prod (no cold start)
   - Auto-cleanup PR previews after 7 days
   - Use appropriate CPU/memory per environment

**Performance Metrics**:
- CI pipeline: < 5 minutes
- Deployment: < 3 minutes
- Health check response: < 100ms
- Cold start (dev/stg): < 10 seconds
- Cold start (prod): 0 seconds (min instance = 1)

---

## 7. Open Questions & Design Decisions

### Resolved

✅ **Q: Should we use service account keys or Workload Identity?**
**A**: Workload Identity Federation for security best practices.

✅ **Q: How many environments do we need?**
**A**: 3 environments (dev/stg/prod) + ephemeral PR previews.

✅ **Q: Should PR previews share the production secret?**
**A**: No, use dev secret for previews to limit blast radius.

✅ **Q: What image tagging strategy?**
**A**: Environment prefix + short SHA (e.g., `dev-a1b2c3d`, `v1.2.3` for prod).

### To Be Decided

⏳ **Q: Should we implement blue-green or canary deployments?**
**Options**:
- A) Blue-green: 0% → 100% instant switch
- B) Canary: Gradual rollout (10% → 50% → 100%)
- C) Rolling: Update instances one by one

**Recommendation**: Start with simple blue-green, add canary in Phase 4 if needed.

⏳ **Q: Should we use Cloud Build or GitHub Actions for building images?**
**Options**:
- A) Cloud Build: Native GCP integration, faster builds in same region
- B) GitHub Actions: Centralized CI/CD, easier to maintain

**Recommendation**: GitHub Actions for consistency, consider Cloud Build in future for speed.

⏳ **Q: How long should PR previews live?**
**Options**:
- A) Until PR closed (automatic cleanup)
- B) 7 days max (scheduled cleanup)
- C) 24 hours (aggressive cleanup)

**Recommendation**: Until PR closed + 7-day scheduled cleanup for orphans.

⏳ **Q: Should we implement end-to-end tests in CI?**
**Impact**: Adds 5-10 minutes to pipeline, requires test API key.

**Recommendation**: Defer to separate issue (#29), start with smoke tests only.

---

## 8. Dependencies & Prerequisites

### External Dependencies

- Google Cloud Platform account with billing enabled
- GitHub repository admin access (for secrets, environments)
- OpenAI API keys for each environment (dev/stg/prod)
- Domain name (optional, for custom URLs)

### Internal Dependencies

- ✅ Issue #25: Docker containerization complete
- ✅ Health check endpoints implemented
- ⏳ Issue #28: Unit test framework (can be parallel)
- ⏳ Issue #29: Integration tests (can be parallel)

### Technical Prerequisites

- Docker installed locally (for testing)
- gcloud CLI installed and authenticated
- Basic knowledge of GitHub Actions YAML syntax
- Understanding of Cloud Run deployment

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Workload Identity setup fails | Low | High | Document step-by-step, provide troubleshooting |
| Deployment fails during business hours | Medium | High | Schedule deployments, implement rollback |
| PR preview costs escalate | Low | Medium | Implement 7-day cleanup, set billing alerts |
| Secrets leaked in logs | Low | Critical | Mask secrets in workflows, audit regularly |
| Health check too strict (false negatives) | Medium | Medium | Tune timeout/retries, monitor metrics |
| Dev/stg/prod config drift | High | Medium | Use IaC (Terraform) in future |

---

## 10. Success Metrics

### Quantitative

- **Deployment Frequency**: 10+ deploys/week to dev
- **Lead Time**: < 1 hour from commit to dev deployment
- **Change Failure Rate**: < 5% (deployments requiring rollback)
- **MTTR** (Mean Time To Recovery): < 2 minutes
- **Pipeline Success Rate**: > 95%
- **Build Time**: < 5 minutes
- **Deployment Time**: < 3 minutes

### Qualitative

- Developers can deploy confidently without manual steps
- PR reviewers can test changes in live preview environment
- Rollbacks are simple and well-documented
- Deployment logs are clear and actionable
- Team understands the CI/CD process

---

## 11. Future Enhancements

### Phase 5+: Advanced Features

1. **Infrastructure as Code (Terraform)**
   - Manage Cloud Run, Secrets, IAM via Terraform
   - Version control infrastructure changes
   - Enable repeatable multi-region deployments

2. **Automated E2E Testing**
   - Playwright tests for critical user flows
   - Run on PR previews before merge
   - Visual regression testing

3. **Advanced Observability**
   - Distributed tracing (Cloud Trace)
   - Custom dashboards per environment
   - SLO monitoring and error budgets

4. **Multi-Region Deployment**
   - Deploy to asia-northeast1 (Tokyo) and us-central1
   - Global load balancing
   - Disaster recovery

5. **Feature Flags**
   - Gradual rollout of new features
   - A/B testing capability
   - Quick feature kill switch

---

## 12. References

- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [Trunk-Based Development](https://trunkbaseddevelopment.com/)
- Existing project documentation:
  - `docs/deployment.md` - Current Cloud Run deployment guide
  - `docs/tech-stack.md` - Technology stack overview
  - `Dockerfile` - Container build configuration

---

**Design Status**: ✅ Ready for Implementation
**Estimated Effort**: 4 weeks (1 developer)
**Priority**: High
**Next Step**: Create `.github/workflows/ci.yml` and begin Phase 1
