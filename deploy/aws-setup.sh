#!/usr/bin/env bash
# One-shot AWS setup for Blockchain Land Registry (run in AWS CloudShell).
# Creates: cost budget, S3 docs bucket (private), S3 website bucket (public),
# DynamoDB tables, IAM role for EC2, security group, and one EC2 server.
# Safe to re-run: anything that already exists is skipped.
#
# Usage:  bash aws-setup.sh you@example.com
set -euo pipefail

EMAIL="${1:?Usage: bash aws-setup.sh you@example.com}"
REGION=ap-south-1
export AWS_DEFAULT_REGION=$REGION

if ! ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null); then
  echo "!! CloudShell has no AWS credentials yet. Refresh the console tab (or CloudShell > Actions > Restart), wait a minute, then re-run."
  exit 1
fi
SUFFIX=${ACCOUNT: -6}
DOCS_BUCKET="blockcodem-land-docs-$SUFFIX"
WEB_BUCKET="blockcodem-land-web-$SUFFIX"
ROLE=LandRegistryEC2Role
SG_NAME=land-registry-sg
INSTANCE_NAME=land-registry-server

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }

# ---------- 1. Budget ----------
say "1/7 Budget alert (USD 5/month, email at 80%)"
if aws budgets describe-budget --region us-east-1 --account-id "$ACCOUNT" --budget-name blockcodem-monthly >/dev/null 2>&1; then
  echo "budget exists"
else
  aws budgets create-budget --region us-east-1 --account-id "$ACCOUNT" \
    --budget '{"BudgetName":"blockcodem-monthly","BudgetLimit":{"Amount":"5","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST","CostTypes":{"IncludeCredit":false,"IncludeRefund":false}}' \
    --notifications-with-subscribers "[{\"Notification\":{\"NotificationType\":\"ACTUAL\",\"ComparisonOperator\":\"GREATER_THAN\",\"Threshold\":80,\"ThresholdType\":\"PERCENTAGE\"},\"Subscribers\":[{\"SubscriptionType\":\"EMAIL\",\"Address\":\"$EMAIL\"}]}]" \
    || echo "!! Budget not created (create it from the 'Set up a cost budget' activity instead)"
fi

# ---------- 2. S3 bucket for land documents (private) ----------
say "2/7 S3 docs bucket: $DOCS_BUCKET"
if aws s3api head-bucket --bucket "$DOCS_BUCKET" 2>/dev/null; then
  echo "bucket exists"
else
  aws s3api create-bucket --bucket "$DOCS_BUCKET" --create-bucket-configuration LocationConstraint=$REGION >/dev/null
fi
aws s3api put-public-access-block --bucket "$DOCS_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-versioning --bucket "$DOCS_BUCKET" --versioning-configuration Status=Enabled

# ---------- 3. S3 bucket for the React website (public read) ----------
say "3/7 S3 website bucket: $WEB_BUCKET"
if aws s3api head-bucket --bucket "$WEB_BUCKET" 2>/dev/null; then
  echo "bucket exists"
else
  aws s3api create-bucket --bucket "$WEB_BUCKET" --create-bucket-configuration LocationConstraint=$REGION >/dev/null
fi
aws s3api put-public-access-block --bucket "$WEB_BUCKET" \
  --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3 website "s3://$WEB_BUCKET" --index-document index.html --error-document index.html
aws s3api put-bucket-policy --bucket "$WEB_BUCKET" --policy "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Sid\":\"PublicRead\",\"Effect\":\"Allow\",\"Principal\":\"*\",\"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$WEB_BUCKET/*\"}]}" \
  || echo "!! Could not make website bucket public. Check S3 > 'Block Public Access settings for this account' and turn it off, then re-run."

# ---------- 4. DynamoDB tables ----------
say "4/7 DynamoDB tables: Users, LandDocuments"
if ! aws dynamodb describe-table --table-name Users >/dev/null 2>&1; then
  aws dynamodb create-table --table-name Users \
    --attribute-definitions AttributeName=email,AttributeType=S \
    --key-schema AttributeName=email,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST >/dev/null
fi
if ! aws dynamodb describe-table --table-name LandDocuments >/dev/null 2>&1; then
  aws dynamodb create-table --table-name LandDocuments \
    --attribute-definitions AttributeName=landId,AttributeType=S AttributeName=uploadedAt,AttributeType=N \
    --key-schema AttributeName=landId,KeyType=HASH AttributeName=uploadedAt,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST >/dev/null
fi
aws dynamodb wait table-exists --table-name Users
aws dynamodb wait table-exists --table-name LandDocuments
echo "tables ready"

# ---------- 5. IAM role for EC2 (no access keys needed on the server) ----------
say "5/7 IAM role: $ROLE"
if ! aws iam get-role --role-name $ROLE >/dev/null 2>&1; then
  aws iam create-role --role-name $ROLE \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
fi
aws iam put-role-policy --role-name $ROLE --policy-name LandRegistryAccess --policy-document "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {\"Effect\": \"Allow\", \"Action\": [\"s3:PutObject\", \"s3:GetObject\"], \"Resource\": \"arn:aws:s3:::$DOCS_BUCKET/*\"},
    {\"Effect\": \"Allow\", \"Action\": [\"dynamodb:GetItem\", \"dynamodb:PutItem\", \"dynamodb:Query\"],
     \"Resource\": [\"arn:aws:dynamodb:$REGION:$ACCOUNT:table/Users\", \"arn:aws:dynamodb:$REGION:$ACCOUNT:table/LandDocuments\"]}
  ]}"
# Session Manager access (browser terminal without SSH keys)
aws iam attach-role-policy --role-name $ROLE --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
if ! aws iam get-instance-profile --instance-profile-name $ROLE >/dev/null 2>&1; then
  aws iam create-instance-profile --instance-profile-name $ROLE >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name $ROLE --role-name $ROLE
  echo "waiting for instance profile to propagate..."; sleep 15
fi

# ---------- 6. Security group ----------
say "6/7 Security group: $SG_NAME"
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
if [ "$VPC" = "None" ]; then echo "!! No default VPC in $REGION. Create one: VPC console > Actions > Create default VPC"; exit 1; fi
SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=$SG_NAME Name=vpc-id,Values="$VPC" --query 'SecurityGroups[0].GroupId' --output text)
if [ "$SG" = "None" ]; then
  SG=$(aws ec2 create-security-group --group-name $SG_NAME --description "Land registry API" --vpc-id "$VPC" --query GroupId --output text)
  # API port open to the internet (Ganache 8545 stays closed)
  aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port 5001 --cidr 0.0.0.0/0 >/dev/null
  # SSH only from the EC2 Instance Connect service (browser "Connect" button)
  PL=$(aws ec2 describe-managed-prefix-lists --filters Name=prefix-list-name,Values=com.amazonaws.$REGION.ec2-instance-connect --query 'PrefixLists[0].PrefixListId' --output text)
  if [ "$PL" != "None" ]; then
    aws ec2 authorize-security-group-ingress --group-id "$SG" --ip-permissions "IpProtocol=tcp,FromPort=22,ToPort=22,PrefixListIds=[{PrefixListId=$PL}]" >/dev/null
  fi
fi
echo "security group $SG"

# ---------- 7. EC2 server ----------
say "7/7 EC2 instance: $INSTANCE_NAME"
IID=$(aws ec2 describe-instances --filters Name=tag:Name,Values=$INSTANCE_NAME Name=instance-state-name,Values=pending,running,stopped \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
if [ "$IID" = "None" ]; then
  AMI=$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
  TYPE=t3.micro
  if ! aws ec2 describe-instance-types --instance-types t3.micro --filters Name=free-tier-eligible,Values=true --query 'InstanceTypes[0]' --output text | grep -q t3.micro; then TYPE=t2.micro; fi
  cat > /tmp/land-userdata.sh <<'EOF'
#!/bin/bash
# 2 GB swap: t3.micro has only 1 GB RAM
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git
npm install -g pm2 ganache
touch /var/log/land-registry-bootstrap-done
EOF
  IID=$(aws ec2 run-instances --image-id "$AMI" --instance-type $TYPE \
    --security-group-ids "$SG" --iam-instance-profile Name=$ROLE \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3}' \
    --user-data file:///tmp/land-userdata.sh \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
    --query 'Instances[0].InstanceId' --output text)
  echo "launched $IID ($TYPE), waiting until running..."
fi
aws ec2 wait instance-running --instance-ids "$IID"
IP=$(aws ec2 describe-instances --instance-ids "$IID" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

cat > ~/blockcodem-aws.env <<EOF
REGION=$REGION
DOCS_BUCKET=$DOCS_BUCKET
WEB_BUCKET=$WEB_BUCKET
INSTANCE_ID=$IID
PUBLIC_IP=$IP
API_URL=http://$IP:5001/api
WEBSITE_URL=http://$WEB_BUCKET.s3-website.$REGION.amazonaws.com
EOF

say "DONE. Saved to ~/blockcodem-aws.env"
cat ~/blockcodem-aws.env
echo
echo "Next: confirm the budget email from AWS, then send REGION, DOCS_BUCKET, WEB_BUCKET and PUBLIC_IP to your teammate (no keys)."
