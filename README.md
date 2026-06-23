# snapscale
**SnapScale — Serverless Image Processing Pipeline on AWS**

A serverless pipeline that automatically resizes uploaded images into three variants (thumbnail, medium, HD), stores metadata in DynamoDB, and delivers them globally via CloudFront CDN — built entirely on AWS with no server management.

**Stack:** API Gateway · Lambda (Node.js) · S3 · SQS · DynamoDB · CloudFront · CloudWatch · IAM
