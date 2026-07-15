pipeline {
    agent any

    options {
        timestamps()
    }

    environment {
        AWS_REGION = 'us-east-1'
        ECR_REGION = 'us-east-1'
        EKS_CLUSTER_NAME = 'my-cluster3'
        K8S_NAMESPACE = 'mywebsite'
        K8S_DEPLOYMENT = 'mywebsite'
        K8S_CONTAINER = 'nginx'
        ECR_REGISTRY = '323022619728.dkr.ecr.us-east-1.amazonaws.com'
        ECR_REPOSITORY = 'my-webserver3'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Prepare CLI Tools') {
            steps {
                sh '''
                    set -e

                    mkdir -p "$WORKSPACE/.tools/bin"

                    cat > "$WORKSPACE/.tools/env.sh" <<EOF
export PATH="$WORKSPACE/.tools/bin:$PATH"
EOF

                    chmod +x "$WORKSPACE/.tools/env.sh"

                    if ! command -v aws >/dev/null 2>&1; then
                        if [ ! -x "$WORKSPACE/.tools/bin/aws" ]; then
                            curl -sSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
                            rm -rf /tmp/awscli
                            rm -rf "$WORKSPACE/.tools/aws"
                            rm -f "$WORKSPACE/.tools/bin/aws"
                            python3 - <<'PY'
import zipfile

with zipfile.ZipFile('/tmp/awscliv2.zip') as archive:
    archive.extractall('/tmp/awscli')
PY
                            chmod +x /tmp/awscli/aws/dist/aws
                            chmod +x /tmp/awscli/aws/install
                            /tmp/awscli/aws/install --update -i "$WORKSPACE/.tools/aws" -b "$WORKSPACE/.tools/bin"
                            rm -rf /tmp/awscli /tmp/awscliv2.zip
                        fi
                    fi

                    if ! command -v kubectl >/dev/null 2>&1; then
                        if [ ! -x "$WORKSPACE/.tools/bin/kubectl" ]; then
                            curl -sSL -o "$WORKSPACE/.tools/bin/kubectl" "https://dl.k8s.io/release/v1.30.2/bin/linux/amd64/kubectl"
                            chmod +x "$WORKSPACE/.tools/bin/kubectl"
                        fi
                    fi

                    . "$WORKSPACE/.tools/env.sh"
                    aws --version
                    kubectl version --client=true
                '''
            }
        }

        stage('Prepare Image Tag') {
            steps {
                script {
                    env.IMAGE_TAG = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh 'docker build -t "$ECR_REPOSITORY:$IMAGE_TAG" .'
            }
        }

        stage('Login to ECR and Push Image') {
            steps {
                sh '''
                    . "$WORKSPACE/.tools/env.sh"

                    aws ecr get-login-password --region "$ECR_REGION" \
                        | docker login --username AWS --password-stdin "$ECR_REGISTRY"

                    docker tag "$ECR_REPOSITORY:$IMAGE_TAG" "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
                    docker tag "$ECR_REPOSITORY:$IMAGE_TAG" "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

                    docker push "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
                    docker push "$ECR_REGISTRY/$ECR_REPOSITORY:latest"
                '''
            }
        }

        stage('Deploy to EKS') {
            steps {
                sh '''
                    . "$WORKSPACE/.tools/env.sh"

                    aws eks update-kubeconfig --region "$AWS_REGION" --name "$EKS_CLUSTER_NAME"
                    kubectl apply -k k8s
                    kubectl set image deployment/"$K8S_DEPLOYMENT" \
                        "$K8S_CONTAINER"="$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" \
                        -n "$K8S_NAMESPACE"
                    kubectl rollout status deployment/"$K8S_DEPLOYMENT" -n "$K8S_NAMESPACE" --timeout=5m
                '''
            }
        }
    }

    post {
        success {
            echo 'Deployment completed successfully.'
        }

        failure {
            echo 'Deployment failed. Check the Jenkins console output for the exact stage.'
        }
    }
}
