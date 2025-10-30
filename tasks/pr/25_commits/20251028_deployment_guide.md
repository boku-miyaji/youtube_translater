# Commit: docs: add comprehensive Cloud Run deployment guide

**Commit Hash**: 0414d6b
**Date**: 2025-10-28
**Type**: Documentation

## Summary

Added comprehensive Cloud Run deployment guide with detailed step-by-step instructions, troubleshooting, cost estimation, and security best practices.

## Changes

### New Files
- `docs/deployment.md` (+589 lines)
  - Complete deployment guide for Google Cloud Run
  - Prerequisites checklist
  - Initial GCP setup instructions
  - Secret Manager configuration
  - Docker build options (Cloud Build vs local)
  - Cloud Run deployment with parameter explanations
  - Environment variable management
  - Custom domain setup
  - Monitoring and logging
  - 5 common troubleshooting scenarios
  - 3 cost estimation scenarios
  - Update and rollback procedures
  - Security best practices

### Modified Files
- `README.md` (+27 lines)
  - Added link to deployment.md in documentation section
  - Positioned as second item after tech-stack.md

## Impact

### Documentation Improvements
- **Deployment clarity**: Provides complete end-to-end deployment process
- **Cost transparency**: Three detailed cost scenarios help users estimate expenses
- **Troubleshooting**: Five common scenarios with solutions reduce support burden
- **Security guidance**: Best practices ensure secure deployments

### User Benefits
- **Reduced friction**: Step-by-step guide lowers barrier to cloud deployment
- **Cost awareness**: Upfront cost estimation prevents billing surprises
- **Self-service**: Comprehensive troubleshooting enables problem resolution
- **Production-ready**: Security best practices included from the start

## Technical Details

### Deployment Parameters Explained
```bash
gcloud run deploy youtube-ai-assistant \
  --image gcr.io/PROJECT_ID/youtube-ai-assistant \
  --platform managed \
  --region asia-northeast1 \          # Tokyo region for low latency
  --allow-unauthenticated \           # Public access
  --memory 2Gi \                      # Sufficient for video/PDF processing
  --cpu 2 \                           # 2 vCPU for parallel processing
  --timeout 300 \                     # 5 minutes for long-running tasks
  --concurrency 80 \                  # Max concurrent requests per instance
  --min-instances 0 \                 # Scale to zero when idle
  --max-instances 10 \                # Scale up to 10 instances under load
  --set-env-vars NODE_ENV=production \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest
```

### Cost Estimation Scenarios

#### Scenario 1: Small Usage (100 requests/month)
- Processing time: 30s average
- Total CPU-time: 0.83 vCPU-hours
- Total memory: 1.67 GiB-hours
- **Estimated cost: $0.16/month** (within free tier)

#### Scenario 2: Medium Usage (1,000 requests/month)
- Processing time: 30s average
- Total CPU-time: 8.33 vCPU-hours
- Total memory: 16.67 GiB-hours
- **Estimated cost: $2.39/month**

#### Scenario 3: Always-On (1 minimum instance)
- 1 instance × 730 hours/month
- 2 vCPU × 730 hours = 1,460 vCPU-hours
- 2 GiB × 730 hours = 1,460 GiB-hours
- **Estimated cost: $20.53/month**

### Troubleshooting Coverage

1. **Container fails to start**
   - Check build logs, FFmpeg installation, environment variables

2. **Request timeout errors**
   - Increase timeout to 300s, optimize code, implement streaming

3. **Out of memory errors**
   - Increase to 4Gi, implement chunking, monitor memory

4. **API key not found**
   - Verify Secret Manager setup, check IAM permissions

5. **Cold start is slow**
   - Implement minimum instances, optimize bundle size, add warming requests

## Files Modified Summary

| File | Lines Added | Lines Removed | Net Change |
|------|-------------|---------------|------------|
| docs/deployment.md | +589 | 0 | +589 |
| README.md | +27 | 0 | +27 |
| **Total** | **+616** | **0** | **+616** |

## Testing Checklist

- [ ] Verify all gcloud commands are syntactically correct
- [ ] Test deployment to Cloud Run test environment
- [ ] Verify Secret Manager integration works
- [ ] Test custom domain setup (if applicable)
- [ ] Verify monitoring and logging are accessible
- [ ] Test each troubleshooting scenario
- [ ] Validate cost estimations against actual usage

## Related Documentation

- [Technical Stack](../../docs/tech-stack.md) - Complete tech stack overview
- [Dockerfile](../../Dockerfile) - Container configuration
- [Main PR](../25_Task.md) - Full PR description
- [PR Review](../25_Task_review.md) - World-class programmer review

## Next Steps

1. Human review of deployment guide accuracy
2. Test deployment to Cloud Run staging environment
3. Verify all commands work as documented
4. Validate cost estimations
5. Consider adding automated deployment scripts
