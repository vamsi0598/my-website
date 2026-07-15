# AWS + Kubernetes path for this static website

This project is a static site served by Nginx in Docker. For Kubernetes, the application code does not need to change. The work is in packaging, orchestration, and AWS infrastructure.

## Starting point

Assumptions for this guide:


## Real-world flow from here

1. Create an ECR repository in AWS.
2. Tag and push the local image to ECR.
3. Create or connect to an EKS cluster.
4. Install the AWS Load Balancer Controller in EKS.
5. Install metrics-server if it is not already present.
6. Apply the Kubernetes manifests in this folder.
7. Open the AWS Application Load Balancer DNS name.

## Cluster prerequisites


## Before you deploy

Update these placeholders in `deployment.yaml`:


You can also change the image tag from `latest` to a version like `v1` if you want safer releases.

## What each manifest does


## AWS pieces you should know for interviews

- **ECR** stores the image. In interviews, mention this is the container registry for versioned builds.
- **EKS** runs the Kubernetes workloads. It manages the control plane and connects to worker nodes or Fargate.
- **metrics-server** is required for CPU-based HPA to work correctly.

## Commands
```

Get the ECR login token and authenticate Docker:

```bash
aws ecr get-login-password --region <REGION> | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com
```

Tag the local image for ECR:

```bash
docker tag my-website:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/my-website:latest
```

Push the image to ECR:

```bash
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/my-website:latest
```

Connect kubectl to EKS:

```bash
aws eks update-kubeconfig --region <REGION> --name <CLUSTER_NAME>
```

If you need an EKS cluster, create one first and attach worker nodes or Fargate.

Install the AWS Load Balancer Controller before applying the Ingress.

Install metrics-server if your cluster does not already have it:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

Apply the Kubernetes manifests:

```bash
kubectl apply -k k8s/
```

Build the image locally if you need to recreate it:

```bash
docker build -t my-website .
```

Check status:

```bash
kubectl get ns
kubectl get deploy -n mywebsite
kubectl get pods -n mywebsite
kubectl get svc -n mywebsite
kubectl get ingress -n mywebsite
kubectl get hpa -n mywebsite
```

## Command Appendix

Use this as the exact command reference for the full journey.

### Local Docker and ECR

```cmd
docker build -t my-webserver2 .
```

```cmd
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 323022619728.dkr.ecr.us-east-1.amazonaws.com
```

```cmd
docker tag my-webserver2:latest 323022619728.dkr.ecr.us-east-1.amazonaws.com/mysecondrepo:latest
```

```cmd
docker push 323022619728.dkr.ecr.us-east-1.amazonaws.com/mysecondrepo:latest
```

### EKS cluster and nodegroup

```cmd
eksctl create cluster --name my-cluster1 --region us-east-1 --nodegroup-name linux-nodes --node-type t3.small --nodes 2
```

```cmd
eksctl create nodegroup --cluster my-cluster1 --name linux-nodes --region us-east-1 --node-type t3.small --nodes 2
```

```cmd
eksctl delete nodegroup --cluster my-cluster1 --name linux-nodes --region us-east-1
```

```cmd
eksctl utils associate-iam-oidc-provider --cluster my-cluster1 --region us-east-1 --approve
```

### Cluster access and verification

```cmd
aws eks update-kubeconfig --region us-east-1 --name my-cluster1
```

```cmd
kubectl config current-context
```

```cmd
kubectl get nodes
```

```cmd
kubectl get pods -A
```

```cmd
kubectl get svc -A
```

```cmd
kubectl get ingress -A
```

```cmd
kubectl apply -k k8s/
```

### CloudFormation debugging

```cmd
aws cloudformation describe-stacks --stack-name eksctl-my-cluster1-nodegroup-linux-nodes --region us-east-1
```

```cmd
aws cloudformation describe-stack-events --stack-name eksctl-my-cluster1-nodegroup-linux-nodes --region us-east-1 --no-cli-pager --query "StackEvents[?contains(ResourceStatus,'FAILED') || contains(ResourceStatus,'ROLLBACK')].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]" --output table
```

```cmd
aws cloudformation delete-stack --stack-name eksctl-my-cluster1-nodegroup-linux-nodes --region us-east-1
```

### AWS Load Balancer Controller setup

```cmd
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/main/docs/install/iam_policy.json
```

```cmd
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam_policy.json
```

```cmd
eksctl create iamserviceaccount --cluster my-cluster1 --region us-east-1 --namespace kube-system --name aws-load-balancer-controller --attach-policy-arn arn:aws:iam::323022619728:policy/AWSLoadBalancerControllerIAMPolicy --override-existing-serviceaccounts --approve
```

```cmd
winget install Helm.Helm
```

```cmd
helm repo add eks https://aws.github.io/eks-charts
```

```cmd
helm repo update
```

```cmd
aws eks describe-cluster --name my-cluster1 --region us-east-1 --query "cluster.resourcesVpcConfig.vpcId" --output text
```

```cmd
helm install aws-load-balancer-controller eks/aws-load-balancer-controller -n kube-system --set clusterName=my-cluster1 --set serviceAccount.create=false --set serviceAccount.name=aws-load-balancer-controller --set region=us-east-1 --set vpcId=vpc-0eba021b6020c6823
```

### cert-manager installation

```cmd
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.5/cert-manager.yaml
```

### Controller verification

```cmd
kubectl get pods -n kube-system
```

```cmd
kubectl get deployment -n kube-system aws-load-balancer-controller
```

### Application and ingress checks

```cmd
kubectl get pods -n mywebsite
```

```cmd
kubectl describe ingress -n mywebsite
```

```cmd
kubectl describe pod <pod-name> -n mywebsite
```

Replace `<pod-name>` with the real pod name when using the command.

## Interview explanation

You can describe the architecture like this:

- Docker packages the static site into an immutable Nginx image.
- ECR stores the image in AWS.
- EKS runs the image as pods through a Deployment.
- A Service provides stable internal networking.
- Ingress plus the AWS Load Balancer Controller creates an internet-facing ALB.
- HPA lets the app scale horizontally under load.

## Why this is a good learning project

- It shows the full path from local development to AWS deployment.
- It demonstrates containerization, orchestration, and cloud exposure.
- It gives you a simple but realistic story for interviews.
- It is small enough to understand, but it includes the same building blocks used in production.