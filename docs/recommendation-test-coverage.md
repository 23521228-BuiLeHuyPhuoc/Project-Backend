# Recommendation Test Coverage

This matrix maps the implementation plan to the automated test suite.

| Plan area | Covered behavior | Test files |
|---|---|---|
| Phase 1 - Interaction data | Schema rules, event idempotency index, tracking validation, valid-tour filtering, cache invalidation | `interaction-tracking.test.js`, `recommendation-api.test.js` |
| Phase 2 - Feature extraction | Category, price, duration, vehicle, season, ratings, cosine similarity, user profiles, positive/negative feedback | `feature-extractor.test.js`, `content-based.test.js`, `relevance.test.js` |
| Phase 3 - Collaborative filtering | CSR construction, signal priority, ALS, SVD, serialization, seen-tour filtering, cold start | `matrix-builder.test.js`, `matrix-factorization.test.js`, `collaborative-filtering.test.js` |
| Phase 4 - Hybrid and TensorFlow.js | Documented dynamic weights, popularity, exclusions, backfill, scheduler, artifact restore, real TFJS model loading and inference | `hybrid-engine.test.js`, `training-scheduler.test.js`, `tfjs-exporter.test.js`, `tfjs-integration.test.js` |
| Phase 5 - API and UI | Personalized/similar/trending/top-rated APIs, feedback, caching, request IDs, contextual ranking, empty/error states | `recommendation-api.test.js`, `cache-manager.test.js`, `client-recommendation-engine.test.js` |
| Monitoring and deployment | CTR, conversion attribution, quality/model metrics, Vercel entrypoint isolation | `monitoring.test.js`, `serverless-entrypoint.test.js` |

Run all coverage with:

```powershell
yarn test
```
