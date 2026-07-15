# Amazon ECR Guide for This Project

This document explains how to work with Amazon ECR for the static website image in this project.

## What ECR is

Amazon Elastic Container Registry (ECR) is AWS's managed Docker image registry.

It is used to:

- store Docker images securely in AWS
- version images with tags such as `latest` or `v1`
- pull images later from EKS, ECS, or another Docker host

## Your current values

- AWS account ID: `323022619728`
- AWS region: `us-east-2`
- ECR repository: `mysecondrepo`
- Local image name: `my-webserver2`
- Local tag: `latest`

Final ECR image path:

```text
323022619728.dkr.ecr.us-east-2.amazonaws.com/mysecondrepo:latest
```

## ECR naming syntax

The general format is:

```text
<account-id>.dkr.ecr.<region>.amazonaws.com/<repository-name>:<tag>
```

Example:

```text
323022619728.dkr.ecr.us-east-2.amazonaws.com/my-webserver2repo:latest
```

## Full workflow

1. Build the local Docker image.
2. Log in Docker to ECR.
3. Tag the local image with the ECR repository path.
4. Push the image to ECR.
5. Use that ECR image in Kubernetes or any other AWS service.

## Commands

### 1. Build the image locally

```powershell
docker build -t my-webserver2 .
```

### 2. Log in to ECR

Use the AWS CLI login method:

```powershell
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 323022619728.dkr.ecr.us-east-2.amazonaws.com
```

### 3. Tag the image for ECR

```powershell
docker tag my-webserver2:latest 323022619728.dkr.ecr.us-east-2.amazonaws.com/my-webserver2repo:latest
```

### 4. Push the image to ECR

```powershell
docker push 323022619728.dkr.ecr.us-east-2.amazonaws.com/my-webserver2repo:latest
```

### 5. Verify the image exists locally

```powershell
docker images
```

### 6. Verify the image exists in ECR

```powershell
aws ecr describe-images --repository-name my-webserver2repo --region us-east-2
```

## Why tagging matters

`docker push` does not take a local image name and magically find the repository.

Docker pushes the exact image reference you give it.

So this is correct:

```powershell
docker tag my-webserver2:latest 323022619728.dkr.ecr.us-east-2.amazonaws.com/mysecondrepo:latest
docker push 323022619728.dkr.ecr.us-east-2.amazonaws.com/mysecondrepo:latest
```

If you skip the `docker tag` step, Docker will try to push a local-only image name and will not know the ECR repository path.

## How to explain this in an interview

You can say:

"I built the Docker image locally, authenticated Docker to Amazon ECR using the AWS CLI, tagged the image with the full ECR repository URL, and pushed it to ECR. ECR then becomes the central registry that Kubernetes or EKS can pull from during deployment."

## Common mistakes

- forgetting the final `:latest` tag when pushing
- pushing the local image name instead of the ECR URL
- using the wrong AWS region
- using the wrong account ID
- logging in to ECR but not tagging the image first

## Quick example with your values

```powershell
docker build -t my-webserver2 .
aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 323022619728.dkr.ecr.us-east-2.amazonaws.com
docker tag my-webserver2:latest 323022619728.dkr.ecr.us-east-2.amazonaws.com/mysecondrepo:latest
docker push 323022619728.dkr.ecr.us-east-2.amazonaws.com/mysecondrepo:latest
```

## How Kubernetes uses it later

Your Kubernetes Deployment should reference the ECR image directly:

```yaml
image: 323022619728.dkr.ecr.us-east-2.amazonaws.com/mysecondrepo:latest
```

That tells EKS to pull the image from ECR and run it as a pod.