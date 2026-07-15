pipeline {
    agent any

    options {
        timestamps()
    }

    environment {
        AWS_REGION = 'us-east-1'
        ECR_REGION = 'us-east-2'
        EKS_CLUSTER_NAME = 'my-cluster3'
        K8S_NAMESPACE = 'mywebsite'
        K8S_DEPLOYMENT = 'mywebsite'
        K8S_CONTAINER = 'nginx'
        ECR_REGISTRY = '323022619728.dkr.ecr.us-east-2.amazonaws.com'
        ECR_REPOSITORY = 'mysecondrepo'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
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
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-deploy-creds']]) {
                    sh '''
                        aws ecr get-login-password --region "$ECR_REGION" \
                            | docker login --username AWS --password-stdin "$ECR_REGISTRY"

                        docker tag "$ECR_REPOSITORY:$IMAGE_TAG" "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
                        docker tag "$ECR_REPOSITORY:$IMAGE_TAG" "$ECR_REGISTRY/$ECR_REPOSITORY:latest"

                        docker push "$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG"
                        docker push "$ECR_REGISTRY/$ECR_REPOSITORY:latest"
                    '''
                }
            }
        }

        stage('Deploy to EKS') {
            steps {
                withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-deploy-creds']]) {
                    sh '''
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
