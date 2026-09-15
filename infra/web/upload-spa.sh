#!/usr/bin/env bash
# Upload the unbundled SPA to s3nt-web. Rewrites index.html to load config.js.
# Requires the deployer role. Do not commit generated config.js.
set -euo pipefail

REGION="${AWS_DEFAULT_REGION:-us-east-2}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND="${ROOT}/frontend"
STAGE="$(mktemp -d)"
trap 'rm -rf "${STAGE}"' EXIT

output() {
    local stack="$1"
    local key="$2"
    aws cloudformation describe-stacks \
        --region "${REGION}" \
        --stack-name "${stack}" \
        --query "Stacks[0].Outputs[?OutputKey=='${key}'].OutputValue" \
        --output text
}

API_URL="$(output s3nt-app ApiUrl)"
CLIENT_ID="$(output s3nt-app UserPoolClientId)"
COGNITO_DOMAIN="$(output s3nt-app CognitoDomainUrl)"
BUCKET="$(output s3nt-web SpaBucketName)"
SPA_ORIGIN="$(output s3nt-web SpaOrigin)"
DISTRIBUTION_ID="$(output s3nt-web DistributionId)"

if [[ -z "${API_URL}" || "${API_URL}" == "None" || -z "${BUCKET}" || "${BUCKET}" == "None" ]]; then
    echo "Missing s3nt-app or s3nt-web outputs. Deploy both stacks first." >&2
    exit 1
fi

API_URL="${API_URL%/}"
SPA_ORIGIN="${SPA_ORIGIN%/}"

cat > "${STAGE}/config.js" <<EOF
window.S3NT_CONFIG = {
    cognitoDomain: "${COGNITO_DOMAIN}",
    clientId: "${CLIENT_ID}",
    apiBaseUrl: "${API_URL}",
    redirectUri: "${SPA_ORIGIN}/callback",
    logoutUri: "${SPA_ORIGIN}/",
    scope: "openid email profile shared-task-api/access"
};
EOF

cp "${FRONTEND}/styles.css" "${STAGE}/"
mkdir -p "${STAGE}/scripts"
cp "${FRONTEND}/scripts/auth.js" "${FRONTEND}/scripts/api.js" "${FRONTEND}/scripts/app.js" "${STAGE}/scripts/"
sed 's|/config.local.js|/config.js|' "${FRONTEND}/index.html" > "${STAGE}/index.html"

NO_CACHE="no-cache, no-store, must-revalidate"
aws s3 sync "${STAGE}" "s3://${BUCKET}/" --region "${REGION}" --delete \
    --cache-control "${NO_CACHE}" \
    --exclude "config.local.js"

aws cloudfront create-invalidation \
    --distribution-id "${DISTRIBUTION_ID}" \
    --paths "/*" \
    --output text

echo "Uploaded to ${SPA_ORIGIN}"
echo "Next: sam deploy --config-env app with DeployedOrigin=${SPA_ORIGIN}"
