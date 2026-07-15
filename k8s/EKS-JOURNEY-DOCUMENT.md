# MyBiz AWS + Kubernetes Journey

This document records the full end-to-end workflow we used to take a static website from a local folder to AWS EKS with ECR, ALB, and a public browser URL.

It is written as a reference you can reuse for study notes, interview prep, or future documentation.

## 1. Project Goal

The goal was to deploy a static website in AWS using:

- Docker for container packaging
- Amazon ECR for image storage
- Amazon EKS for Kubernetes orchestration
- AWS Load Balancer Controller for ALB creation
- Route 53 and ACM for domain and HTTPS setup

The website itself is a static frontend, so no application backend changes were required.

## 2. Starting Point

We started with a local project folder:

`C:\Users\welcome\OneDrive\Desktop\my-website`

The repository structure included:

- `index.html`
- `about.html`
- `services.html`
- `contact.html`
- `careers.html`
- `css/style.css`
- `js/script.js`
- `img/`

The website was already structured as a multi-page static site.

## 3. Docker Packaging

We created a Docker image for the website using Nginx.

### Dockerfile

```dockerfile
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

COPY . .

EXPOSE 80
```

This made Nginx serve the static site files from the container.

### .dockerignore

We added a `.dockerignore` file to keep unnecessary files out of the Docker build context.

Example contents:

```text
.git
.vscode
*.log
*.tmp
Thumbs.db
.DS_Store
```

### Build command

```cmd
docker build -t my-webserver2 .
```

Result:

```text
[+] Building ... FINISHED
```

The Docker image built successfully.

## 4. Docker to Amazon ECR

We used Amazon ECR to store the Docker image.

### ECR values used

- AWS Account ID: `323022619728`
- Region: `us-east-1`
- Repository: `mysecondrepo`
- Image name: `my-webserver2`
- Tag: `latest`

Final ECR image path:

```text
323022619728.dkr.ecr.us-east-1.amazonaws.com/mysecondrepo:latest
```

### ECR login command

```cmd
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 323022619728.dkr.ecr.us-east-1.amazonaws.com
```

### Tag command

```cmd
docker tag my-webserver2:latest 323022619728.dkr.ecr.us-east-1.amazonaws.com/mysecondrepo:latest
```

### Push command

```cmd
docker push 323022619728.dkr.ecr.us-east-1.amazonaws.com/mysecondrepo:latest
```

### Result

The image push completed successfully.

## 5. EKS Cluster Creation

We created an EKS cluster using `eksctl`.

### Cluster command

```cmd
eksctl create cluster --name my-cluster1 --region us-east-1 --nodegroup-name linux-nodes --node-type t3.small --nodes 2
```

### What happened

- The EKS control plane stack completed successfully.
- The worker nodegroup stack initially failed and rolled back.
- We inspected CloudFormation stack events to find the cause.

### Cluster stack result

```text
eksctl-my-cluster1-cluster
CREATE_COMPLETE
```

### Nodegroup failure result

The worker nodegroup failed because the earlier EC2 instance type was not suitable.

CloudFormation error excerpt:

```text
Resource handler returned message: "[Issue(Code=AsgInstanceLaunchFailures, Message=Could not launch On-Demand Instances. InvalidParameterCombination - The specified instance type is not eligible for Free Tier. ... Launching EC2 instance failed.)]"
```

### Nodegroup cleanup

We deleted the failed nodegroup stack and confirmed it no longer existed.

```cmd
aws cloudformation delete-stack --stack-name eksctl-my-cluster1-nodegroup-linux-nodes --region us-east-1
```

Verification:

```text
ValidationError: Stack with id eksctl-my-cluster1-nodegroup-linux-nodes does not exist
```

### Nodegroup recreation

We recreated the nodegroup with a better instance type:

```cmd
eksctl create nodegroup --cluster my-cluster1 --name linux-nodes --region us-east-1 --node-type t3.small --nodes 2
```

### Final node result

```cmd
kubectl get nodes
```

Result:

```text
NAME                            STATUS   ROLES    AGE    VERSION
ip-192-168-17-31.ec2.internal   Ready    <none>   6m1s   v1.34.9-eks-7d6f6ec
ip-192-168-37-91.ec2.internal   Ready    <none>   6m3s   v1.34.9-eks-7d6f6ec
```

That confirmed the EC2 worker nodes joined the cluster successfully.

## 6. kubeconfig and Cluster Access

At one point, `kubectl` was pointing to a local localhost endpoint and failed with connection refused.

### Error

```text
Unable to connect to the server: dial tcp 127.0.0.1:53022: connectex: No connection could be made because the target machine actively refused it.
```

### Fix

We updated the kubeconfig for the EKS cluster:

```cmd
aws eks update-kubeconfig --region us-east-1 --name my-cluster1
```

### Context check

```cmd
kubectl config current-context
```

Result:

```text
arn:aws:eks:us-east-1:323022619728:cluster/my-cluster1
```

After that, `kubectl get nodes` worked normally.

## 7. AWS Load Balancer Controller

We installed the AWS Load Balancer Controller so Kubernetes Ingress could create an AWS Application Load Balancer.

### OIDC association

```cmd
eksctl utils associate-iam-oidc-provider --cluster my-cluster1 --region us-east-1 --approve
```

Result:

```text
created IAM Open ID Connect provider for cluster "my-cluster1" in "us-east-1"
```

### cert-manager installation

```cmd
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.5/cert-manager.yaml
```

Result:

```text
namespace/cert-manager created
deployment.apps/cert-manager created
deployment.apps/cert-manager-webhook created
... created
```

### Helm installation

Helm was not installed at first, so we installed it:

```cmd
winget install Helm.Helm
```

Then we added the chart repo:

```cmd
helm repo add eks https://aws.github.io/eks-charts
helm repo update
```

### IAM policy and service account

We created the IAM policy and service account required by the controller.

Policy command:

```cmd
aws iam create-policy --policy-name AWSLoadBalancerControllerIAMPolicy --policy-document file://iam_policy.json
```

Service account command:

```cmd
eksctl create iamserviceaccount --cluster my-cluster1 --region us-east-1 --namespace kube-system --name aws-load-balancer-controller --attach-policy-arn arn:aws:iam::323022619728:policy/AWSLoadBalancerControllerIAMPolicy --override-existing-serviceaccounts --approve
```

Result:

```text
created serviceaccount "kube-system/aws-load-balancer-controller"
```

### Helm install of controller

We installed the controller using the VPC ID from the cluster.

VPC ID used:

```text
vpc-0eba021b6020c6823
```

Install command:

```cmd
helm install aws-load-balancer-controller eks/aws-load-balancer-controller -n kube-system --set clusterName=my-cluster1 --set serviceAccount.create=false --set serviceAccount.name=aws-load-balancer-controller --set region=us-east-1 --set vpcId=vpc-0eba021b6020c6823
```

Result:

```text
STATUS: deployed
DESCRIPTION: Install complete
AWS Load Balancer controller installed!
```

## 8. Kubernetes App Deployment

We deployed the Kubernetes manifests from the `k8s` folder.

### Apply command

```cmd
kubectl apply -k k8s/
```

### Result

```text
namespace/mywebsite created
service/mywebsite created
deployment.apps/mywebsite created
horizontalpodautoscaler.autoscaling/mywebsite created
ingress.networking.k8s.io/mywebsite created
```

### Pod status

```cmd
kubectl get pods -n mywebsite
```

Result:

```text
NAME                         READY   STATUS    RESTARTS   AGE
mywebsite-8654fffdf4-b4cts   1/1     Running   0          152m
mywebsite-8654fffdf4-jxmnj   1/1     Running   0          152m
```

### Service status

```cmd
kubectl get svc -n mywebsite
```

Result:

```text
NAME        TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)   AGE
mywebsite   ClusterIP   10.100.180.120   <none>        80/TCP    152m
```

### Ingress status

```cmd
kubectl get ingress -n mywebsite
```

Result:

```text
NAME        CLASS   HOSTS   ADDRESS                                                                  PORTS   AGE
mywebsite   alb     *       k8s-mywebsit-mywebsit-828b5463e0-529742011.us-east-1.elb.amazonaws.com   80      152m
```

That confirmed AWS created the ALB and attached it to the Ingress.

## 9. Browser Verification

We opened the ALB DNS name in the browser and confirmed the site loaded correctly.

Page title:

```text
MyBiz
```

The browser snapshot showed the homepage sections rendering correctly:

- hero section
- who we are section
- what we offer section
- success stories
- key services
- why choose us
- footer

This confirmed the full app path was working end to end.

## 10. Domain and HTTPS Work

We later discussed moving from the ALB DNS name to a real domain.

### Domain purchased

The domain purchased on GoDaddy was:

```text
vamsi.click
```

### Route 53 and ACM flow

- create a public hosted zone in Route 53 for `vamsi.click`
- update GoDaddy nameservers to the Route 53 name servers
- create alias records pointing `vamsi.click` and `www.vamsi.click` to the ALB
- request an ACM certificate in `us-east-1`
- update the Ingress with the certificate ARN and HTTPS listener

### ACM ARN used

```text
arn:aws:acm:us-east-1:323022619728:certificate/043732cc-f20b-44e4-94cf-797399ea560a
```

### Ingress HTTPS update

We updated the Ingress annotations to include:

- HTTPS listener on 443
- ACM certificate ARN
- HTTP to HTTPS redirect
- host rules for `vamsi.click` and `www.vamsi.click`

## 11. Error Log and Fixes

This section records the important errors and how we resolved them.

### Error: wrong shell command

PowerShell-only command used in `cmd`:

```text
Invoke-WebRequest is not recognized as an internal or external command
```

Fix:
- use `curl` in `cmd`
- or use PowerShell for `Invoke-WebRequest`

### Error: Helm not installed

```text
'helm' is not recognized as an internal or external command
```

Fix:

```cmd
winget install Helm.Helm
```

### Error: incorrect command concatenation

One command was accidentally mashed together:

```text
aws iam create-policy ... file://iam_policy.jsoneksctl create iamserviceaccount ...
```

Fix:
- run the AWS IAM policy creation command separately
- then run the `eksctl create iamserviceaccount` command separately

### Error: cluster context pointed to localhost

```text
Unable to connect to the server: dial tcp 127.0.0.1:53022
```

Fix:

```cmd
aws eks update-kubeconfig --region us-east-1 --name my-cluster1
```

### Error: nodegroup failed with invalid instance type

CloudFormation reported:

```text
InvalidParameterCombination - The specified instance type is not eligible for Free Tier
```

Fix:
- delete the failed nodegroup stack
- recreate the nodegroup using a better instance type like `t3.small`

### Error: duplicate Helm release name

```text
cannot reuse a name that is still in use
```

Fix:
- do not run `helm install` again with the same release name
- use `kubectl get pods -n kube-system` to verify the controller instead

## 12. Acronyms and Terms

### ECR
Amazon Elastic Container Registry. Stores Docker images.

### EKS
Amazon Elastic Kubernetes Service. Managed Kubernetes on AWS.

### ALB
Application Load Balancer. AWS load balancer used for HTTP/HTTPS ingress.

### ACM
AWS Certificate Manager. Provides TLS certificates.

### OIDC
OpenID Connect. Used here to connect Kubernetes service accounts to AWS IAM.

### IAM
Identity and Access Management. Controls AWS permissions.

### HPA
Horizontal Pod Autoscaler. Scales pods based on resource usage.

### VPC
Virtual Private Cloud. The isolated AWS network where the cluster runs.

### kubeconfig
Local Kubernetes config file that tells `kubectl` which cluster to talk to.

### Ingress
Kubernetes resource that routes external HTTP/HTTPS traffic into services.

## 13. Final Outcome

By the end of the journey, the project was successfully running:

- Docker image built locally
- image pushed to Amazon ECR
- EKS cluster created in `us-east-1`
- EC2 worker nodes joined and became Ready
- AWS Load Balancer Controller installed
- Kubernetes manifests deployed
- ALB created automatically from Ingress
- site verified in the browser

The live site was reachable through the ALB DNS name and rendered the MyBiz homepage correctly.

## 14. Interview Summary

You can explain the project like this:

"I took a static website, packaged it in Docker, pushed the image to Amazon ECR, created an EKS cluster with managed worker nodes, fixed a nodegroup failure caused by an unsuitable instance type, configured kubeconfig, installed cert-manager and the AWS Load Balancer Controller, deployed Kubernetes manifests, and exposed the app publicly using an ALB through Ingress. Then I verified the live site in the browser and later prepared the domain and HTTPS setup using Route 53 and ACM."

## 15. Shutdown and Cleanup Process

Use this section when you want to stop AWS charges and tear down the environment in a clean order.

### Recommended shutdown order

1. Remove the Kubernetes application resources.
2. Delete the Ingress so the ALB is removed.
3. Uninstall the AWS Load Balancer Controller.
4. Delete the EKS cluster and its nodegroups.
5. Remove Route 53 hosted zones if you created them.
6. Remove ECR images or repositories if you no longer need them.
7. Keep ACM only if you want to reuse the certificate later.

### Delete the app resources

```cmd
kubectl delete -k k8s/
```

This removes:

- namespace
- deployment
- service
- horizontal pod autoscaler
- ingress

### Uninstall the AWS Load Balancer Controller

```cmd
helm uninstall aws-load-balancer-controller -n kube-system
```

This removes the controller that creates the ALB from the Ingress.

### Delete the EKS cluster

```cmd
eksctl delete cluster --name my-cluster1 --region us-east-1
```

This is the main step that stops EKS control-plane and EC2 node charges.

### Optional Route 53 cleanup

If you created a hosted zone for `vamsi.click`, delete it when you are done testing.

Check hosted zones:

```cmd
aws route53 list-hosted-zones
```

Delete the hosted zone only if you no longer need the domain DNS setup.

### Optional ECR cleanup

If you no longer need the pushed Docker image, delete the repository or images.

List repositories:

```cmd
aws ecr describe-repositories --region us-east-1
```

Delete the repository:

```cmd
aws ecr delete-repository --repository-name mysecondrepo --region us-east-1 --force
```

### Optional certificate cleanup

ACM certificates do not usually cost money by themselves, so you can keep them if you plan to reuse the domain later.

If you want to remove it anyway, delete the certificate from ACM in the AWS console.

### Validation after shutdown

After cleanup, verify that the cluster no longer exists:

```cmd
eksctl get cluster --region us-east-1
```

If the cluster is gone, the EKS-related infrastructure should no longer be billing.

### Notes on charges

- EKS control plane charges stop after cluster deletion.
- EC2 worker node charges stop after the nodegroup/cluster is deleted.
- ALB charges stop after the Ingress is deleted and the controller is removed.
- Route 53 hosted zones continue billing until deleted.
- ECR storage can keep billing if you leave images in the repository.
- ACM certificate storage is usually not the main charge item.
